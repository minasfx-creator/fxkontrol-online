/**
 * FX KONTROL — Electron Preload
 * Exposes safe APIs to renderer (none needed for a pure web app).
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  platform: process.platform,
  version: process.versions.electron,
});
