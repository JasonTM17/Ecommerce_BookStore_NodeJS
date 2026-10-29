const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'modules');
function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}
for (const file of walk(dir).sort()) {
  const src = fs.readFileSync(file, 'utf8');
  const base = (src.match(/@Controller\('([^']*)'\)/) || [])[1] || '';
  const methods = [...src.matchAll(/@(Get|Post|Put|Patch|Delete)\('?([^')]*)'?\)/g)]
    .map((m) => m[1].toUpperCase() + ' ' + (base + '/' + (m[2] || '')).replace(/\/+/g, '/'));
  console.log('=== ' + path.relative(dir, file).replace(/\\/g, '/') + '  base=' + base);
  methods.forEach((m) => console.log('   ' + m));
}
