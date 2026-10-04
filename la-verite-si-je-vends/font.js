/*
 * Tiny 3×5 pixel font (uppercase only) with accents on two extra rows above and a cedilla
 * row below. Cell: 4 px wide (3 + 1 spacing), 8 px tall (2 accent rows, 5 letter rows, 1 cedilla).
 */
const G = {
  A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'],
  B: ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'],
  C: ['.xx', 'x..', 'x..', 'x..', '.xx'],
  D: ['xx.', 'x.x', 'x.x', 'x.x', 'xx.'],
  E: ['xxx', 'x..', 'xx.', 'x..', 'xxx'],
  F: ['xxx', 'x..', 'xx.', 'x..', 'x..'],
  G: ['.xx', 'x..', 'x.x', 'x.x', '.xx'],
  H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'],
  I: ['xxx', '.x.', '.x.', '.x.', 'xxx'],
  J: ['..x', '..x', '..x', 'x.x', '.x.'],
  K: ['x.x', 'x.x', 'xx.', 'x.x', 'x.x'],
  L: ['x..', 'x..', 'x..', 'x..', 'xxx'],
  M: ['x.x', 'xxx', 'xxx', 'x.x', 'x.x'],
  N: ['xx.', 'x.x', 'x.x', 'x.x', 'x.x'],
  O: ['.x.', 'x.x', 'x.x', 'x.x', '.x.'],
  P: ['xx.', 'x.x', 'xx.', 'x..', 'x..'],
  Q: ['.x.', 'x.x', 'x.x', '.x.', '..x'],
  R: ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'],
  S: ['.xx', 'x..', '.x.', '..x', 'xx.'],
  T: ['xxx', '.x.', '.x.', '.x.', '.x.'],
  U: ['x.x', 'x.x', 'x.x', 'x.x', '.xx'],
  V: ['x.x', 'x.x', 'x.x', 'x.x', '.x.'],
  W: ['x.x', 'x.x', 'xxx', 'xxx', 'x.x'],
  X: ['x.x', 'x.x', '.x.', 'x.x', 'x.x'],
  Y: ['x.x', 'x.x', '.x.', '.x.', '.x.'],
  Z: ['xxx', '..x', '.x.', 'x..', 'xxx'],
  0: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'],
  1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'],
  2: ['xx.', '..x', '.x.', 'x..', 'xxx'],
  3: ['xxx', '..x', '.x.', '..x', 'xxx'],
  4: ['x.x', 'x.x', 'xxx', '..x', '..x'],
  5: ['xxx', 'x..', 'xx.', '..x', 'xx.'],
  6: ['.xx', 'x..', 'xxx', 'x.x', 'xxx'],
  7: ['xxx', '..x', '.x.', '.x.', '.x.'],
  8: ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
  9: ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
  ' ': ['...', '...', '...', '...', '...'],
  '.': ['...', '...', '...', '...', '.x.'],
  ',': ['...', '...', '...', '.x.', 'x..'],
  ':': ['...', '.x.', '...', '.x.', '...'],
  ';': ['...', '.x.', '...', '.x.', 'x..'],
  '!': ['.x.', '.x.', '.x.', '...', '.x.'],
  '?': ['xx.', '..x', '.x.', '...', '.x.'],
  "'": ['.x.', '.x.', '...', '...', '...'],
  '-': ['...', '...', 'xxx', '...', '...'],
  '+': ['...', '.x.', 'xxx', '.x.', '...'],
  '%': ['x.x', '..x', '.x.', 'x..', 'x.x'],
  '(': ['.x.', 'x..', 'x..', 'x..', '.x.'],
  ')': ['.x.', '..x', '..x', '..x', '.x.'],
  '/': ['..x', '..x', '.x.', 'x..', 'x..'],
  _: ['...', '...', '...', '...', 'xxx'],
  '>': ['x..', '.x.', '..x', '.x.', 'x..'],
  '[': ['xx.', 'x..', 'x..', 'x..', 'xx.'],
  ']': ['.xx', '..x', '..x', '..x', '.xx'],
  '=': ['...', 'xxx', '...', 'xxx', '...'],
  '"': ['x.x', 'x.x', '...', '...', '...'],
  '*': ['x.x', '.x.', 'xxx', '.x.', 'x.x'],
  '€': ['.xx', 'xx.', 'xx.', 'x..', '.xx'],
  '’': ['.x.', '.x.', '...', '...', '...'],
  '‘': ['.x.', '.x.', '...', '...', '...'],
  '…': ['...', '...', '...', '...', 'x.x'],
  '«': ['..x', '.x.', 'x.x', '.x.', '..x'],
  '»': ['x..', '.x.', 'x.x', '.x.', 'x..'],
}

const ACUTE = ['..x', '.x.']
const GRAVE = ['x..', '.x.']
const CIRC = ['.x.', 'x.x']
const ACCENTS = {
  É: ['E', ACUTE], È: ['E', GRAVE], Ê: ['E', CIRC], Ë: ['E', CIRC],
  À: ['A', GRAVE], Â: ['A', CIRC], Î: ['I', CIRC], Ï: ['I', CIRC],
  Ô: ['O', CIRC], Û: ['U', CIRC], Ù: ['U', GRAVE],
}

export const CHAR_W = 4
export const LINE_H = 9

export function textWidth(text) {
  return text.length * CHAR_W - 1
}

/** Draws `text` with its top-left at (x, y); the letter body starts 2 px lower (accent rows). */
export function drawText(ctx, text, x, y, colour) {
  ctx.fillStyle = colour
  const upper = text.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]
    let glyph = G[ch]
    let accent = null
    let cedilla = false
    if (!glyph) {
      if (ACCENTS[ch]) {
        glyph = G[ACCENTS[ch][0]]
        accent = ACCENTS[ch][1]
      } else if (ch === 'Ç') {
        glyph = G.C
        cedilla = true
      } else glyph = G['?']
    }
    const gx = x + i * CHAR_W
    if (accent) {
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 3; c++) if (accent[r][c] === 'x') ctx.fillRect(gx + c, y + r, 1, 1)
    }
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++) if (glyph[r][c] === 'x') ctx.fillRect(gx + c, y + 2 + r, 1, 1)
    if (cedilla) ctx.fillRect(gx + 1, y + 7, 1, 1)
  }
}

/** Centred text. */
export function drawTextC(ctx, text, cx, y, colour) {
  drawText(ctx, text, Math.round(cx - textWidth(text) / 2), y, colour)
}
