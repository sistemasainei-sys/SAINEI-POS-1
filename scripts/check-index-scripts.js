'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => s.trim());
if (!scripts.length) throw new Error('No se encontraron scripts inline en index.html.');
scripts.forEach((source, i) => new vm.Script(source, { filename: 'index.html:inline-' + (i + 1) }));
process.stdout.write('OK: ' + scripts.length + ' scripts inline con sintaxis válida.\n');
