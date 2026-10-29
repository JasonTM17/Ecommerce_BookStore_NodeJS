const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', 'backend', 'src', 'main', 'java', 'com', 'bookstore', 'controller');
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.java')) continue;
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const base = (src.match(/@RequestMapping\("([^"]*)"/) || [])[1] || '';
  const methods = [...src.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(\((?:value\s*=\s*)?"?([^")]*)"?\))?/g)]
    .map((m) => m[1].toUpperCase() + ' ' + (base + (m[3] || '')).replace(/\/+/g, '/'));
  console.log('=== ' + f + '  base=' + base);
  methods.forEach((m) => console.log('   ' + m));
}
