/*
 * 5 × 7 pixel font (uppercase, French accents) for the HUD, titles and buttons, plus the title
 * logo. A glyph cell is 9 rows: 2 accent rows, 7 letter rows; a cedilla hangs one row lower.
 * Letters and digits are 5 px wide, punctuation is narrower; 1 px between glyphs.
 * The 3 × 5 font (font.js) stays for small mentions.
 */
import { Pix, PAL, darker } from './pixel.js?v=3'

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
  ';': ['..', '##', '##', '..', '##', '.#', '#.'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '’': ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '°': ['.##.', '#..#', '#..#', '.##.', '....', '....', '....'],
  '«': ['.....', '..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#', '.....'],
  '»': ['.....', '#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..', '.....'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '·': ['..', '..', '..', '##', '##', '..', '..'],
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
export const LINE_H5 = 10

/** Bitmap of a glyph: { w, rows } with 10 rows (2 accent + 7 letter + 1 cedilla). */
export function glyph5(ch) {
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
export function hasGlyph5(ch) {
  return !!(G[ch] || ACCENTS[ch] || ch === 'Ç')
}
export function textWidth5(text) {
  let w = 0
  for (const ch of text.toUpperCase()) w += glyph5(ch).w + 1
  return Math.max(0, w - 1)
}

/* ---------- drawing, with a glyph cache per colour ---------- */
const cache = new Map()
function glyphCanvas(ch, colour) {
  const key = ch + colour
  let c = cache.get(key)
  if (!c) {
    const g = glyph5(ch)
    c = document.createElement('canvas')
    c.width = g.w
    c.height = LINE_H5
    const x = c.getContext('2d')
    x.fillStyle = colour
    g.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') x.fillRect(i, j, 1, 1)
    })
    cache.set(key, c)
  }
  return c
}
/**
 * Draws text with its top-left at (x, y) (the letter body starts 2 px lower).
 * style.shadow: drop shadow 1 px down-right; style.outline: 1 px ring all round.
 */
export function drawText5(ctx, text, x, y, colour, style = {}) {
  const up = text.toUpperCase()
  x = Math.round(x)
  y = Math.round(y)
  const pass = (dx, dy, col) => {
    let cx = x + dx
    for (const ch of up) {
      const g = glyph5(ch)
      if (ch !== ' ') ctx.drawImage(glyphCanvas(ch, col), cx, y + dy)
      cx += g.w + 1
    }
  }
  if (style.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pass(dx, dy, style.outline)
  else if (style.shadow) pass(1, 1, style.shadow)
  pass(0, 0, colour)
}
export function drawText5C(ctx, text, cx, y, colour, style) {
  drawText5(ctx, text, Math.round(cx - textWidth5(text) / 2), y, colour, style)
}

/* ---------- logo ---------- */
// EPX / Scale2x: doubles the resolution of a 1-bit glyph with rounded diagonals, so the logo
// letters are larger but still drawn with the same 1 px pixel as everything else.
function epx(rows) {
  const h = rows.length
  const w = rows[0].length
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? rows[y][x] === '#' : false)
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill(false))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = at(x, y)
      const a = at(x, y - 1)
      const b = at(x + 1, y)
      const c = at(x - 1, y)
      const d = at(x, y + 1)
      out[y * 2][x * 2] = c === a && c !== d && a !== b ? a : p
      out[y * 2][x * 2 + 1] = a === b && a !== c && b !== d ? b : p
      out[y * 2 + 1][x * 2] = d === c && d !== b && c !== a ? c : p
      out[y * 2 + 1][x * 2 + 1] = b === d && b !== a && d !== c ? d : p
    }
  return out
}

/**
 * Title logo: EPX letters with a vertical gradient, a highlight on top edges, a thick ink
 * outline (2 px) and a drop shadow. Returns a Pix; one Pix per line of text.
 */
export function logoLine(text, ramp = [PAL.rust, PAL.orange, PAL.amber, PAL.yellow, PAL.white]) {
  const up = text.toUpperCase()
  const glyphs = [...up].map((ch) => (ch === ' ' ? null : epx(glyph5(ch).rows)))
  const widths = [...up].map((ch, i) => (glyphs[i] ? glyphs[i][0].length : 6))
  const inner = widths.reduce((a, b) => a + b, 0) + 2 * (up.length - 1)
  const pad = 3
  const H = 20
  const p = new Pix(inner + pad * 2 + 2, H + pad * 2 + 2)
  const fill = new Pix(p.w, p.h)
  let cx = pad
  glyphs.forEach((g, i) => {
    if (g)
      g.forEach((row, j) =>
        row.forEach((on, k) => {
          if (on) fill.px(cx + k, pad + j, '#')
        })
      )
    cx += widths[i] + 2
  })
  const on = (x, y) => fill.get(x, y) === '#'
  // Drop shadow (2 px down-right), then the thick outline, then the letters.
  const shadowCol = PAL.plum
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      let near = false
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && on(x - 2 - dx, y - 2 - dy)) near = true
      if (near) p.px(x, y, shadowCol)
    }
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      let near = false
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && on(x + dx, y + dy)) near = true
      if (near) p.px(x, y, PAL.ink)
    }
  // Letters: gradient from light (top) to dark (bottom) over the 14 letter rows.
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!on(x, y)) continue
      const row = y - pad - 4 // letter body starts after the 2 accent rows (×2)
      const k = Math.max(0, Math.min(1, row / 13))
      const idx = Math.round((1 - k) * (ramp.length - 2))
      let c = ramp[idx]
      if (!on(x, y - 1)) c = ramp[ramp.length - 1] // highlight along top edges
      else if (!on(x, y + 1) || !on(x + 1, y)) c = darker(ramp[Math.max(0, idx - 1)]) // shade bottom-right edges
      p.px(x, y, c)
    }
  return p
}
