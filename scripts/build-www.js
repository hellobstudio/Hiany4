// A src mappa tartalmát és az Excel-könyvtárat a www mappába másolja.
const fs = require('fs');
const path = require('path');

fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www');
for (const f of fs.readdirSync('src')) {
  fs.copyFileSync(path.join('src', f), path.join('www', f));
}
fs.copyFileSync(
  path.join('node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'),
  path.join('www', 'xlsx.full.min.js')
);
console.log('www mappa elkészült');
