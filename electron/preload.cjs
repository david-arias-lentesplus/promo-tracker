/**
 * electron/preload.cjs
 * Preload script — ejecutado en el renderer con acceso limitado a Node.
 * Por ahora sólo expone la versión de Electron para que la app
 * pueda saber que está corriendo dentro de una ventana nativa.
 */

'use strict'

const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('__electron__', {
  isElectron: true,
  platform:   process.platform,
})
