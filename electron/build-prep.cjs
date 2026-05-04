/**
 * electron/build-prep.cjs
 * Corre ANTES de electron-builder (npm run app:build).
 *
 * Escribe la ruta absoluta del proyecto en electron/project-root.txt.
 * electron-builder incluye ese archivo como extraResource en el .app,
 * y main.cjs lo lee en runtime para saber dónde está el proyecto.
 */

'use strict'

const fs   = require('fs')
const path = require('path')

// __dirname aquí es /proyecto/electron/
const projectRoot = path.join(__dirname, '..')
const outFile     = path.join(__dirname, 'project-root.txt')

fs.writeFileSync(outFile, projectRoot, 'utf-8')
console.log(`[build-prep] project-root.txt → ${projectRoot}`)
