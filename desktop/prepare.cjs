'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const appDir = path.join(__dirname, 'app');
fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });
const files = ['server.js', 'index.html', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
for (const name of files) {
  const src = path.join(root, name);
  if (fs.existsSync(src) && fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(appDir, name));
}
for (const name of fs.readdirSync(root)) {
  if (/^sainei-mod-[a-z0-9_-]+\.js$/i.test(name)) fs.copyFileSync(path.join(root, name), path.join(appDir, name));
}
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'sainei-pos-desktop-app', version: '1.0.0', main: 'main.cjs' }, null, 2));
fs.copyFileSync(path.join(__dirname, 'main.cjs'), path.join(appDir, 'main.cjs'));
if (!fs.existsSync(path.join(appDir, 'server.js')) || !fs.existsSync(path.join(appDir, 'index.html'))) {
  throw new Error('Faltan archivos esenciales para preparar el instalador.');
}
console.log('Aplicación local preparada en desktop/app');
