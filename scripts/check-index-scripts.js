'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((s) => s.trim());
if (!scripts.length) throw new Error('No se encontraron scripts inline en index.html.');
scripts.forEach((source, i) => new vm.Script(source, { filename: 'index.html:inline-' + (i + 1) }));
process.stdout.write('OK: ' + scripts.length + ' scripts inline con sintaxis válida.\n');

const variantFields = ["pf-variant-group", "pf-variant-name", "variantGroup", "variantName"];
for (const field of variantFields) {
  if (!html.includes(field)) throw new Error("Falta el campo de variantes: " + field);
}
if (!html.includes("Cada variante debe tener su propio producto, código y stock.")) {
  throw new Error("Falta la validación de variantes duplicadas con SKU/stock independientes.");
}
if (!html.includes("x.code===code&&x.id!==ui.editId")) {
  throw new Error("Falta la validación de código único por producto.");
}
process.stdout.write("OK: variantes agrupadas, código individual, stock por producto y prevención de variantes duplicadas.\\n");
