/**
 * electron/main.cjs
 * Proceso principal de Electron — modo desarrollo.
 *
 * Al arrancar:
 *  1. Lanza python3 dev-server.py  → API en :8000
 *  2. Lanza npm run dev (Vite)     → Frontend en :3000
 *  3. Espera a que :3000 responda
 *  4. Abre la ventana de la app
 *
 * Al cerrar la ventana, mata ambos procesos hijo.
 */

'use strict'

const { app, BrowserWindow, shell } = require('electron')
const { spawn }  = require('child_process')
const path       = require('path')
const http       = require('http')
const fs         = require('fs')

// ── Rutas ─────────────────────────────────────────────────────────
// En modo packaged (app.isPackaged), la ruta del proyecto está guardada
// en Resources/project-root.txt, embebida en el .app por electron-builder.
// En modo desarrollo, __dirname es electron/ dentro del proyecto.
function resolveRoot() {
  if (app.isPackaged) {
    const rootFile = path.join(process.resourcesPath, 'project-root.txt')
    if (fs.existsSync(rootFile)) {
      return fs.readFileSync(rootFile, 'utf-8').trim()
    }
    // fallback: sube desde Resources/app
    return path.join(app.getAppPath(), '..', '..', '..', '..', '..', '..')
  }
  return path.join(__dirname, '..')
}

const ROOT       = resolveRoot()
const VITE_PORT  = 3000
const API_PORT   = 8000

// ── PATH aumentado ────────────────────────────────────────────────
// Las apps de escritorio en macOS heredan un PATH mínimo (/usr/bin, /bin).
// Node/npm/python3 suelen estar en Homebrew o nvm — hay que agregarlos
// explícitamente para que spawn() los encuentre.
const EXTRA_PATHS = [
  '/opt/homebrew/bin',          // Homebrew Apple Silicon
  '/opt/homebrew/sbin',
  '/usr/local/bin',             // Homebrew Intel / instaladores clásicos
  '/usr/local/sbin',
  `${process.env.HOME}/.nvm/versions/node/$(ls ${process.env.HOME}/.nvm/versions/node 2>/dev/null | tail -1)/bin`,
  `${process.env.HOME}/.nodenv/shims`,
  `${process.env.HOME}/.volta/bin`,
  '/usr/bin',
  '/bin',
]
const CHILD_ENV = {
  ...process.env,
  PATH: [...EXTRA_PATHS, process.env.PATH || ''].filter(Boolean).join(':'),
}

// Resuelve la ruta real de un binario recorriendo EXTRA_PATHS
function resolveBin(name) {
  for (const dir of EXTRA_PATHS) {
    const full = path.join(dir, name)
    try { if (fs.existsSync(full)) return full } catch (_) {}
  }
  return name  // fallback: confiar en que esté en PATH
}

// ── Procesos hijo ─────────────────────────────────────────────────
let pyProc   = null
let viteProc = null
let mainWin  = null

// ── Lanzar Python dev-server ──────────────────────────────────────
function startPython() {
  const devServerPath = path.join(ROOT, 'dev-server.py')
  if (!fs.existsSync(devServerPath)) {
    console.error('[electron] dev-server.py no encontrado en:', devServerPath)
    return
  }
  const pythonBin = process.env.PYTHON_BIN || resolveBin('python3')
  console.log('[electron] python →', pythonBin)
  console.log('[electron] Iniciando Python dev-server en :' + API_PORT)
  pyProc = spawn(pythonBin, [devServerPath], {
    cwd:   ROOT,
    stdio: 'pipe',
    env:   CHILD_ENV,
  })
  pyProc.stdout.on('data', d => process.stdout.write('[python] ' + d))
  pyProc.stderr.on('data', d => process.stderr.write('[python] ' + d))
  pyProc.on('exit', code => console.log('[python] proceso terminó con código', code))
}

// ── Lanzar Vite ───────────────────────────────────────────────────
function startVite() {
  // Preferimos npx vite directamente para no depender de que 'npm' esté en PATH
  const npmBin  = resolveBin('npm')
  const npxBin  = resolveBin('npx')
  console.log('[electron] npm →', npmBin, '/ npx →', npxBin)
  console.log('[electron] Iniciando Vite en :' + VITE_PORT)

  // Intentar con npx vite primero; si falla, fallback a npm run dev
  viteProc = spawn(npxBin, ['vite', '--port', String(VITE_PORT)], {
    cwd:   ROOT,
    stdio: 'pipe',
    env:   { ...CHILD_ENV, FORCE_COLOR: '1' },
  })
  viteProc.stdout.on('data', d => process.stdout.write('[vite] ' + d))
  viteProc.stderr.on('data', d => process.stderr.write('[vite] ' + d))
  viteProc.on('error', err => {
    // ENOENT en npx → reintentar con npm run dev
    if (err.code === 'ENOENT') {
      console.warn('[electron] npx no encontrado, intentando npm run dev...')
      viteProc = spawn(npmBin, ['run', 'dev'], {
        cwd:   ROOT,
        stdio: 'pipe',
        env:   { ...CHILD_ENV, FORCE_COLOR: '1' },
        shell: true,   // último recurso: usar shell para resolver PATH
      })
      viteProc.stdout.on('data', d => process.stdout.write('[vite] ' + d))
      viteProc.stderr.on('data', d => process.stderr.write('[vite] ' + d))
    }
  })
  viteProc.on('exit', code => console.log('[vite] proceso terminó con código', code))
}

// ── Esperar a que un puerto esté disponible ───────────────────────
function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start    = Date.now()
    const interval = 500
    const check    = () => {
      const req = http.get(`http://localhost:${port}/`, res => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Puerto ${port} no respondió en ${timeout}ms`))
        } else {
          setTimeout(check, interval)
        }
      })
      req.setTimeout(interval, () => { req.destroy() })
    }
    check()
  })
}

// ── Crear ventana principal ───────────────────────────────────────
function createWindow() {
  mainWin = new BrowserWindow({
    width:           1440,
    height:          900,
    minWidth:        1440,
    minHeight:       600,
    title:           'Promos SS — Dashboard',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    // Barra de título nativa macOS con semáforo integrado
    titleBarStyle:        process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  })

  // Links externos → browser del sistema
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWin.loadURL(`http://localhost:${VITE_PORT}`)
  mainWin.on('closed', () => { mainWin = null })
}

// ── Pantalla de carga mientras los servidores arrancan ─────────────
function showSplash() {
  const splash = new BrowserWindow({
    width:          420,
    height:         260,
    frame:          false,
    resizable:      false,
    transparent:    true,
    backgroundColor:'#00000000',
    alwaysOnTop:    true,
    webPreferences: { nodeIntegration: false },
  })

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#1e293b;border-radius:16px;overflow:hidden;
    color:#f1f5f9;display:flex;flex-direction:column;
    align-items:center;justify-content:center;height:100vh;gap:20px;
    -webkit-app-region:drag;
  }
  .logo{font-size:32px;font-weight:900;letter-spacing:-1px}
  .logo span{color:#38bdf8}
  .sub{font-size:13px;color:#94a3b8}
  .spinner{
    width:28px;height:28px;
    border:3px solid #334155;border-top-color:#38bdf8;
    border-radius:50%;animation:spin 0.8s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
  .status{font-size:12px;color:#64748b;margin-top:4px}
</style></head>
<body>
  <div class="logo">Promos <span>SS</span></div>
  <div class="sub">Dashboard interno · lentesplus.com</div>
  <div class="spinner"></div>
  <div class="status">Iniciando servidores...</div>
</body>
</html>`

  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  return splash
}

// ── Ciclo de vida ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  const splash = showSplash()

  startPython()
  startVite()

  try {
    await waitForPort(API_PORT, 20000)
    console.log('[electron] ✓ Python API listo en :' + API_PORT)

    await waitForPort(VITE_PORT, 30000)
    console.log('[electron] ✓ Vite listo en :' + VITE_PORT)

    createWindow()
  } catch (err) {
    console.error('[electron] Error al iniciar servidores:', err.message)
    createWindow()  // abre igual, Vite mostrará su error
  } finally {
    splash.destroy()
  }
})

// ── Matar procesos hijo al cerrar ─────────────────────────────────
function killChildren() {
  if (pyProc)   { pyProc.kill();   pyProc   = null }
  if (viteProc) { viteProc.kill(); viteProc = null }
}

app.on('window-all-closed', () => { killChildren(); app.quit() })
app.on('before-quit',  killChildren)
app.on('will-quit',    killChildren)
