/**
 * electron/main.cjs
 * Proceso principal de Electron.
 * Lanza Python (:8000) + Vite (:3000), espera, abre ventana.
 */

'use strict'

const { app, BrowserWindow, shell } = require('electron')
const { spawn }  = require('child_process')
const path       = require('path')
const http       = require('http')
const fs         = require('fs')

// ── Log a archivo (diagnóstico en app packaged) ───────────────────
const LOG_FILE = path.join(app.getPath('userData'), 'promos-ss.log')
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`
  process.stdout.write(line)
  try { fs.appendFileSync(LOG_FILE, line) } catch (_) {}
}

log('=== Promos SS arrancando ===')
log('isPackaged:', app.isPackaged)
log('resourcesPath:', process.resourcesPath || '(no packaged)')
log('__dirname:', __dirname)

// ── Ruta del proyecto ─────────────────────────────────────────────
function resolveRoot() {
  if (app.isPackaged) {
    const rootFile = path.join(process.resourcesPath, 'project-root.txt')
    log('Buscando project-root.txt en:', rootFile)
    if (fs.existsSync(rootFile)) {
      const root = fs.readFileSync(rootFile, 'utf-8').trim()
      log('project-root.txt → ', root)
      return root
    }
    log('ADVERTENCIA: project-root.txt no encontrado')
    return path.join(app.getAppPath(), '..', '..', '..', '..', '..', '..')
  }
  return path.join(__dirname, '..')
}

const ROOT      = resolveRoot()
const VITE_PORT = 3000
const API_PORT  = 8000

log('ROOT:', ROOT)
log('dev-server.py existe:', fs.existsSync(path.join(ROOT, 'dev-server.py')))
log('package.json existe:', fs.existsSync(path.join(ROOT, 'package.json')))

// ── PATH aumentado ────────────────────────────────────────────────
// Las apps de escritorio macOS heredan un PATH mínimo sin Homebrew/Node.
const HOME = process.env.HOME || ''
const EXTRA_PATHS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  `${HOME}/.volta/bin`,
  `${HOME}/.nodenv/shims`,
  `${HOME}/.nodenv/bin`,
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
]

// Buscar nvm activo dinámicamente
const nvmDir = `${HOME}/.nvm/versions/node`
try {
  if (fs.existsSync(nvmDir)) {
    const versions = fs.readdirSync(nvmDir).sort()
    if (versions.length) {
      EXTRA_PATHS.unshift(`${nvmDir}/${versions[versions.length - 1]}/bin`)
    }
  }
} catch (_) {}

const CHILD_ENV = {
  ...process.env,
  PATH: [...EXTRA_PATHS, process.env.PATH || ''].filter(Boolean).join(':'),
}

log('PATH usado:', CHILD_ENV.PATH)

// Busca el binario recorriendo EXTRA_PATHS
function resolveBin(name) {
  for (const dir of EXTRA_PATHS) {
    try {
      const full = path.join(dir, name)
      if (fs.existsSync(full)) {
        log(`resolveBin(${name}) → ${full}`)
        return full
      }
    } catch (_) {}
  }
  log(`resolveBin(${name}) → fallback (no encontrado en EXTRA_PATHS)`)
  return name
}

// ── Procesos hijo ─────────────────────────────────────────────────
let pyProc   = null
let viteProc = null
let mainWin  = null

function startPython() {
  const devServerPath = path.join(ROOT, 'dev-server.py')
  if (!fs.existsSync(devServerPath)) {
    log('ERROR: dev-server.py no encontrado en', devServerPath)
    return
  }
  const pythonBin = process.env.PYTHON_BIN || resolveBin('python3')
  log('Lanzando Python:', pythonBin, devServerPath)

  pyProc = spawn(pythonBin, [devServerPath], {
    cwd:   ROOT,
    stdio: 'pipe',
    shell: false,
    env:   CHILD_ENV,
  })
  pyProc.stdout.on('data', d => log('[python]', String(d).trim()))
  pyProc.stderr.on('data', d => log('[python]', String(d).trim()))
  pyProc.on('error', err => log('ERROR python spawn:', err.message))
  pyProc.on('exit',  code => log('[python] salió con código', code))
}

function startVite() {
  // Usar directorio de caché en /tmp para evitar EACCES en node_modules/.vite
  // (ocurre cuando node_modules/.vite fue creado por otro proceso/usuario)
  const cacheDir = path.join(require('os').tmpdir(), 'promos-ss-vite-cache')
  log('Vite cacheDir:', cacheDir)

  const npxBin = resolveBin('npx')
  log('Lanzando Vite con npx:', npxBin)

  const viteArgs = [
    'vite',
    '--port',     String(VITE_PORT),
    '--host',     'localhost',
    '--cacheDir', cacheDir,
  ]

  viteProc = spawn(npxBin, viteArgs, {
    cwd:   ROOT,
    stdio: 'pipe',
    shell: false,
    env:   { ...CHILD_ENV, FORCE_COLOR: '0' },
  })
  viteProc.stdout.on('data', d => log('[vite]', String(d).trim()))
  viteProc.stderr.on('data', d => log('[vite]', String(d).trim()))
  viteProc.on('error', err => {
    log('ERROR vite spawn (npx):', err.message, '— reintentando con shell:true...')
    const npmBin = resolveBin('npm')
    viteProc = spawn(npmBin, ['run', 'dev'], {
      cwd:   ROOT,
      stdio: 'pipe',
      shell: true,
      env:   { ...CHILD_ENV, FORCE_COLOR: '0', VITE_CACHE_DIR: cacheDir },
    })
    viteProc.stdout.on('data', d => log('[vite-sh]', String(d).trim()))
    viteProc.stderr.on('data', d => log('[vite-sh]', String(d).trim()))
    viteProc.on('error', e => log('ERROR vite spawn (shell):', e.message))
    viteProc.on('exit', c => log('[vite-sh] salió con código', c))
  })
  viteProc.on('exit', code => log('[vite] salió con código', code))
}

// ── Esperar puerto ────────────────────────────────────────────────
function waitForPort(port, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const req = http.get({ hostname: 'localhost', port, path: '/', timeout: 1000 }, res => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        const elapsed = Date.now() - start
        if (elapsed > timeout) {
          reject(new Error(`Puerto ${port} no respondió en ${timeout}ms`))
        } else {
          setTimeout(check, 800)
        }
      })
      req.on('timeout', () => req.destroy())
    }
    check()
  })
}

// ── Página de error ───────────────────────────────────────────────
function errorHtml(msg) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,sans-serif;background:#0f172a;color:#f1f5f9;
     display:flex;flex-direction:column;align-items:center;justify-content:center;
     height:100vh;margin:0;gap:16px;padding:32px;box-sizing:border-box}
h2{color:#f87171;font-size:18px;margin:0}
pre{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;
    font-size:12px;color:#94a3b8;white-space:pre-wrap;max-width:640px;width:100%;overflow:auto}
p{color:#64748b;font-size:13px;margin:0}
a{color:#38bdf8;font-size:12px}
</style></head><body>
<h2>⚠ Error al iniciar los servidores</h2>
<pre>${msg.replace(/</g,'&lt;')}</pre>
<p>Revisa el log en: ~/Library/Application Support/Promos SS/promos-ss.log</p>
</body></html>`)}`
}

// ── Splash ────────────────────────────────────────────────────────
function showSplash() {
  const splash = new BrowserWindow({
    width: 420, height: 260,
    frame: false, resizable: false,
    transparent: true, backgroundColor: '#00000000',
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  })
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#1e293b;border-radius:16px;
     overflow:hidden;color:#f1f5f9;display:flex;flex-direction:column;
     align-items:center;justify-content:center;height:100vh;gap:20px;
     -webkit-app-region:drag}
.logo{font-size:32px;font-weight:900;letter-spacing:-1px}
.logo span{color:#38bdf8}
.sub{font-size:13px;color:#94a3b8}
.spinner{width:28px;height:28px;border:3px solid #334155;border-top-color:#38bdf8;
         border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.status{font-size:12px;color:#64748b}
</style></head><body>
<div class="logo">Promos <span>SS</span></div>
<div class="sub">Dashboard interno · lentesplus.com</div>
<div class="spinner"></div>
<div class="status">Iniciando servidores...</div>
</body></html>`
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  return splash
}

// ── Ventana principal ─────────────────────────────────────────────
function createWindow(url) {
  mainWin = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1440, minHeight: 600,
    title: 'Promos SS — Dashboard',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  })
  mainWin.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith('http://localhost')) return { action: 'allow' }
    shell.openExternal(u)
    return { action: 'deny' }
  })
  mainWin.loadURL(url)
  mainWin.on('closed', () => { mainWin = null })
}

// ── Ciclo de vida ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  log('App ready, LOG_FILE:', LOG_FILE)
  const splash = showSplash()

  startPython()
  startVite()

  let startupError = null

  try {
    log('Esperando Python en :', API_PORT)
    await waitForPort(API_PORT, 25000)
    log('✓ Python listo')

    log('Esperando Vite en :', VITE_PORT)
    await waitForPort(VITE_PORT, 45000)
    log('✓ Vite listo')
  } catch (err) {
    startupError = err.message
    log('ERROR startup:', startupError)
  }

  splash.destroy()

  if (startupError) {
    const details = [
      `ROOT: ${ROOT}`,
      `dev-server.py existe: ${fs.existsSync(path.join(ROOT, 'dev-server.py'))}`,
      `Error: ${startupError}`,
      `Log: ${LOG_FILE}`,
    ].join('\n')
    createWindow(errorHtml(details))
  } else {
    createWindow(`http://localhost:${VITE_PORT}`)
  }
})

// ── Cleanup ───────────────────────────────────────────────────────
function killChildren() {
  log('Cerrando procesos hijo...')
  if (pyProc)   { try { pyProc.kill()   } catch (_) {}; pyProc   = null }
  if (viteProc) { try { viteProc.kill() } catch (_) {}; viteProc = null }
}

app.on('window-all-closed', () => { killChildren(); app.quit() })
app.on('before-quit', killChildren)
app.on('will-quit',   killChildren)
