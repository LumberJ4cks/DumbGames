/*
 * 5 × 7 pixel font (uppercase, French accents) drawn at an integer scale, with optional
 * outline or drop shadow. A glyph cell is 10 rows: 2 accent rows, 7 letter rows, 1 cedilla row.
 * Letters and digits are 5 px wide, punctuation narrower; 1 px between glyphs (× scale).
 */
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['..', '..', '..', '..', '..', '##', '##'],
  ',': ['..', '..', '..', '..', '##', '.#', '#.'],
  ':': ['..', '##', '##', '..', '##', '##', '..'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '’': ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '«': ['.....', '..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#', '.....'],
  '»': ['.....', '#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..', '.....'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '·': ['..', '..', '..', '##', '##', '..', '..'],
  '•': ['...', '...', '.#.', '###', '.#.', '...', '...'],
  '°': ['.##.', '#..#', '.##.', '....', '....', '....', '....'],
  '€': ['..###', '.#...', '####.', '.#...', '####.', '.#...', '..###'],
}
const ACUTE = ['...#.', '..#..']
const GRAVE = ['.#...', '..#..']
const CIRC = ['..#..', '.#.#.']
const TREMA = ['.#.#.', '.....']
const ACCENTS = {
  É: ['E', ACUTE], È: ['E', GRAVE], Ê: ['E', CIRC], Ë: ['E', TREMA],
  À: ['A', GRAVE], Â: ['A', CIRC], Î: ['I', CIRC], Ï: ['I', TREMA],
  Ô: ['O', CIRC], Ù: ['U', GRAVE], Û: ['U', CIRC], Ü: ['U', TREMA],
}
export const LINE_H = 10

export function glyph(ch) {
  let base = G[ch]
  let accent = null
  let cedilla = false
  if (!base) {
    if (ACCENTS[ch]) {
      base = G[ACCENTS[ch][0]]
      accent = ACCENTS[ch][1]
    } else if (ch === 'Ç') {
      base = G.C
      cedilla = true
    } else base = G['?']
  }
  const w = base[0].length
  const pad = (r) => (r.length >= w ? r.slice(Math.floor((r.length - w) / 2), Math.floor((r.length - w) / 2) + w) : r.padEnd(w, '.'))
  const rows = [accent ? pad(accent[0]) : '.'.repeat(w), accent ? pad(accent[1]) : '.'.repeat(w), ...base, cedilla ? pad('..#..') : '.'.repeat(w)]
  return { w, rows }
}

export function textWidth(text, scale = 1, smooth = false) {
  let w = 0
  for (const ch of text.toUpperCase()) w += glyph(ch).w + 1
  return Math.max(0, w - 1) * scale * (smooth ? 2 : 1)
}

// Scale2x on a 1-bit glyph: doubles it with rounded diagonals, for the big titles.
function epx(rows) {
  const h = rows.length
  const w = rows[0].length
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? rows[y][x] === '#' : false)
  const out = []
  for (let y = 0; y < h; y++) {
    const r0 = []
    const r1 = []
    for (let x = 0; x < w; x++) {
      const p = at(x, y)
      const a = at(x, y - 1)
      const b = at(x + 1, y)
      const c = at(x - 1, y)
      const d = at(x, y + 1)
      r0.push(c === a && c !== d && a !== b ? a : p)
      r0.push(a === b && a !== c && b !== d ? b : p)
      r1.push(d === c && d !== b && c !== a ? c : p)
      r1.push(b === d && b !== a && d !== c ? d : p)
    }
    out.push(r0.map((v) => (v ? '#' : '.')).join(''), r1.map((v) => (v ? '#' : '.')).join(''))
  }
  return out
}

const cache = new Map()
function glyphCanvas(ch, colour, scale, smooth = false) {
  const key = ch + colour + scale + (smooth ? 's' : '')
  let c = cache.get(key)
  if (!c) {
    const g = glyph(ch)
    const rows = smooth ? epx(g.rows) : g.rows
    c = document.createElement('canvas')
    c.width = g.w * scale * (smooth ? 2 : 1)
    c.height = LINE_H * scale * (smooth ? 2 : 1)
    const x = c.getContext('2d')
    x.fillStyle = colour
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') x.fillRect(i * scale, j * scale, scale, scale)
    })
    cache.set(key, c)
  }
  return c
}

/**
 * Draws text with its top-left at (x, y); the letter body starts 2 rows lower.
 * style.scale: integer size; style.outline: colour of a 1-cell ring; style.shadow: colour of a
 * drop shadow 1 cell down-right.
 */
export function drawText(ctx, text, x, y, colour, style = {}) {
  const s = style.scale || 1
  const sm = !!style.smooth
  const cell = s * (sm ? 2 : 1)
  const up = text.toUpperCase()
  x = Math.round(x)
  y = Math.round(y)
  const pass = (dx, dy, col) => {
    let cx = x + dx
    for (const ch of up) {
      const g = glyph(ch)
      if (ch !== ' ') ctx.drawImage(glyphCanvas(ch, col, s, sm), cx, y + dy)
      cx += (g.w + 1) * cell
    }
  }
  // extrude: a stack of layers below the text, from the first colour (top) to the last (bottom)
  if (style.extrude) {
    const n = style.extrude.length
    for (let i = n - 1; i >= 0; i--) pass(0, (i + 1) * s, style.extrude[i])
    if (style.outline) for (let i = 0; i <= n; i++) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pass(dx * s, dy * s + i * s, style.outline)
  } else if (style.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) pass(dx * s, dy * s, style.outline)
  if (style.shadow) pass(s, s, style.shadow)
  if (style.gradient) {
    // vertical bands of colour over the glyph body (rows 2..8 of the cell)
    const bands = style.gradient
    const top = y + 2 * cell
    const h = 7 * cell
    bands.forEach((col, i) => {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, Math.round(top + (h * i) / bands.length), ctx.canvas.width, Math.ceil(h / bands.length))
      ctx.clip()
      pass(0, 0, col)
      ctx.restore()
    })
  } else pass(0, 0, colour)
}
export function drawTextC(ctx, text, cx, y, colour, style = {}) {
  drawText(ctx, text, Math.round(cx - textWidth(text, style.scale || 1, !!style.smooth) / 2), y, colour, style)
}
export function drawTextR(ctx, text, rx, y, colour, style = {}) {
  drawText(ctx, text, Math.round(rx - textWidth(text, style.scale || 1, !!style.smooth)), y, colour, style)
}
