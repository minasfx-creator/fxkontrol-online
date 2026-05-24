/**
 * FX KONTROL — Electron Main Process
 * Loads the Vite build from dist/ via file:// protocol.
 * WebGPU enabled via Chromium flags.
 */

// ── WebGPU + hardware acceleration flags (must be set BEFORE app.ready) ──
const { app, BrowserWindow, shell, Menu } = require('electron');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('disable-gpu-sandbox');

const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 720,
    title: 'FX KONTROL',
    icon: path.join(__dirname, '../public/pwa-icon-512.png'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,      // allow file:// to load local assets
      experimentalFeatures: true,
    },
    show: false,
    frame: true,
    titleBarStyle: 'default',
  });

  // dist/index.html built with --base ./ so all assets are relative
  const indexPath = path.join(
    app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'dist')
      : path.join(__dirname, '..', 'dist'),
    'index.html'
  );

  mainWindow.loadURL(pathToFileURL(indexPath).toString());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

Menu.setApplicationMenu(null);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
