'use strict';
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 43821;
const URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;
let mainWindow = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(start);
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (serverProcess && serverProcess.exitCode !== null) throw new Error('El servidor local se cerró inesperadamente.');
    try { const r = await fetch(URL + '/api/ping'); if (r.ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('SAINEI POS no pudo iniciar su servidor local.');
}

async function start() {
  const root = app.getAppPath();
  const serverFile = path.join(root, 'server.js');
  if (!fs.existsSync(serverFile)) {
    await dialog.showMessageBox({ type: 'error', title: 'SAINEI POS', message: 'No se encontró el servidor de SAINEI POS.' });
    app.quit(); return;
  }
  const dataDir = path.join(app.getPath('userData'), 'datos');
  fs.mkdirSync(dataDir, { recursive: true });
  serverProcess = spawn(process.execPath, [serverFile, '--port=' + PORT, '--host=127.0.0.1', '--data=' + dataDir, '--app=' + path.join(root, 'index.html')], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', SAINEI_DATA: dataDir, SAINEI_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  serverProcess.stdout.on('data', d => console.log('[SAINEI]', String(d).trim()));
  serverProcess.stderr.on('data', d => console.error('[SAINEI]', String(d).trim()));
  serverProcess.on('exit', code => {
    if (!quitting && code !== 0 && mainWindow) dialog.showErrorBox('SAINEI POS', 'El servidor local se cerró. Código: ' + code);
  });

  try { await waitForServer(); }
  catch (e) { await dialog.showMessageBox({ type: 'error', title: 'SAINEI POS', message: e.message }); app.quit(); return; }

  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 650,
    title: 'SAINEI POS',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await mainWindow.loadURL(URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('before-quit', () => {
  quitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
app.on('window-all-closed', () => app.quit());
