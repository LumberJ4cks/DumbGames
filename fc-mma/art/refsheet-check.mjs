import { toPix } from './pixellab-check.mjs'
const p = toPix('carton-plein/art/pixellab/export-06-referee-card/sheet.png', false)
// taille native : plus petit run horizontal de couleur identique
let minRun = 1e9
for (let y = 0; y < p.h; y++) { let run = 1; for (let x = 1; x < p.w; x++) { if (p.data[y * p.w + x] === p.data[y * p.w + x - 1]) run++; else { if (p.data[y*p.w+x-1] && run < minRun) minRun = run; run = 1 } } }
console.log('w', p.w, 'minRun', minRun, 'colours', p.colours)
// bornes de chaque cellule 256
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
  let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0
  for (let y = r * 256; y < (r + 1) * 256; y++) for (let x = c * 256; x < (c + 1) * 256; x++) if (p.data[y * p.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  console.log(r, c, x0 - c * 256, y0 - r * 256, x1 - c * 256, y1 - r * 256)
}
const cols = {}
for (const c of p.data) if (c) cols[c] = (cols[c] || 0) + 1
console.log(Object.entries(cols).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([c, n]) => c + ':' + n).join(' '))
