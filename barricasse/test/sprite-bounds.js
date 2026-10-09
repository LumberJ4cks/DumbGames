// Loads font.js + sprites.js in Node with a tiny pixel-buffer canvas, and measures the opaque
// bounds of every object sprite (outline included). The simulation's hitboxes come from these
// numbers: `node barricasse/test/sprite-bounds.js` prints the table pasted into sim.js, and the
// test suite checks the two never drift apart.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function parseColour(c) {
  if (c[0] === '#') return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255]
  const m = c.match(/rgba?\(([^)]+)\)/)
  const v = m[1].split(',').map((x) => parseFloat(x))
  return [v[0], v[1], v[2], Math.round((v[3] ?? 1) * 255)]
}
function fakeCanvas() {
  const c = { width: 0, height: 0, data: null }
  const ensure = () => {
    if (!c.data || c.data.length !== c.width * c.height * 4) c.data = new Uint8ClampedArray(c.width * c.height * 4)
  }
  const g = {
    fillStyle: '#000',
    fillRect(x, y, w, h) {
      ensure()
      const col = parseColour(this.fillStyle)
      for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) c.data.set(col, (yy * c.width + xx) * 4)
    },
    clearRect(x, y, w, h) {
      ensure()
      for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) c.data.set([0, 0, 0, 0], (yy * c.width + xx) * 4)
    },
    getImageData() {
      ensure()
      return { data: new Uint8ClampedArray(c.data) }
    },
    putImageData(img) {
      c.data = new Uint8ClampedArray(img.data)
    },
  }
  c.getContext = () => g
  return c
}

function loadSprites() {
  const ctx = { document: { createElement: () => fakeCanvas() } }
  ctx.window = ctx
  vm.createContext(ctx)
  for (const f of ['font.js', 'sprites.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx)
  return ctx.window.BarricasseSprites
}

function measure(c) {
  let x0 = c.width
  let y0 = c.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (c.data[(y * c.width + x) * 4 + 3]) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
}

function bounds() {
  const SP = loadSprites()
  const out = {}
  for (const [id, fn] of Object.entries(SP.DRAW)) if (!id.includes('_')) out[id] = measure(SP.art(24, 24, fn))
  return out
}

module.exports = { bounds }
if (require.main === module) {
  const b = bounds()
  console.log('{\n' + Object.entries(b).map(([k, v]) => `    ${k}: [${v.join(', ')}],`).join('\n') + '\n  }')
}
