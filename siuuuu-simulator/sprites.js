/*
 * SIUUUU SIMULATOR — pixel art drawn in code.
 *
 * Ronaldo: 32 × 40 poses with three-tone shading, drawn at ×3 with a dark outline added
 * automatically. The crowd: little people assembled from parts (hair, hat, face, shirt,
 * accessory) so that every supporter is different, plus a handful of hand-drawn cameos.
 * Props: the medical cart, the cameraman, the stewards, the corner flag.
 */

// Four-tone ramps per material (dark → light). A letter in a pose names a tone of a ramp;
// the lighting pass then moves pixels one tone up or down along their ramp.
export const RAMPS = {
  hair: ['#0F0806', '#1A0F0A', '#33201A', '#4F3328', '#6B4A3A'],
  skin: ['#9A5E3C', '#C98F63', '#EBB98B', '#F6D2AE', '#FFE8D1'],
  white: ['#8C94A6', '#A3AAB8', '#CBD0D9', '#F1F1EE', '#FFFFFF'],
  navy: ['#0C1224', '#162040', '#1E2A4A', '#34477A', '#4F65A0'],
  boot: ['#050508', '#0F0F14', '#17171F', '#4A4D5A', '#6E7280'],
  mouth: ['#5E1118', '#8E1F2A', '#B9303C', '#D4505B', '#E8747C'],
}
export const INK = {
  H: ['hair', 1], h: ['hair', 2], i: ['hair', 3],
  S: ['skin', 1], s: ['skin', 2],
  D: ['white', 1], d: ['white', 2], w: ['white', 3], W: ['white', 4],
  n: ['navy', 2],
  k: ['boot', 2], K: ['boot', 3],
  r: ['mouth', 2],
}
export const OUTLINE = '#13111C'

/* ---------- colour helpers ---------- */
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (r, g, b) => '#' + ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0')
export const shade = (hex, k) => {
  const [r, g, b] = hexToRgb(hex)
  if (k >= 1) return rgbToHex(r + (255 - r) * (k - 1), g + (255 - g) * (k - 1), b + (255 - b) * (k - 1))
  return rgbToHex(r * k, g * k, b * k)
}
const rampCache = new Map()
/** A pixel value: { ramp: [...colours], t: index }. Arbitrary colours get a generated ramp. */
export function tone(colour, t = 2) {
  if (Array.isArray(colour)) return { ramp: RAMPS[colour[0]], t: colour[1] }
  let ramp = rampCache.get(colour)
  if (!ramp) {
    ramp = [shade(colour, 0.55), shade(colour, 0.76), colour, shade(colour, 1.22), shade(colour, 1.45)]
    rampCache.set(colour, ramp)
  }
  return { ramp, t }
}

/* ---------- finishing: Scale2x, lighting, outline ---------- */
// Scale2x (EPX): doubles a grid of pixel values, rounding diagonals so lines stay thin.
function scale2x(px, w, h) {
  const out = new Array(w * h * 4).fill(null)
  const same = (a, b) => (a === b) || (a && b && a.ramp === b.ramp && a.t === b.t)
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : px[y * w + x])
  const W = w * 2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = at(x, y)
      const a = at(x, y - 1)
      const b = at(x + 1, y)
      const c = at(x - 1, y)
      const d = at(x, y + 1)
      out[(y * 2) * W + x * 2] = same(c, a) && !same(c, d) && !same(a, b) ? a : p
      out[(y * 2) * W + x * 2 + 1] = same(a, b) && !same(a, c) && !same(b, d) ? b : p
      out[(y * 2 + 1) * W + x * 2] = same(d, c) && !same(d, b) && !same(c, a) ? c : p
      out[(y * 2 + 1) * W + x * 2 + 1] = same(b, d) && !same(b, a) && !same(d, c) ? d : p
    }
  return out
}
// Lighting: the top-left edge of a shape catches the light, the bottom-right edge falls in shadow.
function light(px, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : px[y * w + x])
  const out = px.slice()
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = at(x, y)
      if (!p) continue
      const edgeUp = !at(x, y - 1) || !at(x - 1, y)
      const edgeDown = !at(x, y + 1) || !at(x + 1, y)
      const edgeUp2 = !at(x, y - 2) || !at(x - 2, y)
      let t = p.t
      if (edgeUp && !edgeDown) t = Math.min(p.ramp.length - 1, t + 1)
      else if (edgeDown && !edgeUp) t = Math.max(0, t - 1)
      else if (edgeUp2 && !edgeDown && (x + y) % 2 === 0) t = Math.min(p.ramp.length - 1, t + 1)
      out[y * w + x] = t === p.t ? p : { ramp: p.ramp, t }
    }
  return out
}
/** Doubles, lights and outlines a grid of pixel values; returns a canvas drawn 1:1. */
export function finish(px, w, h, { outline = OUTLINE, smooth = true, lit = true, scale = 1 } = {}) {
  let W = w
  let H = h
  if (smooth) {
    px = scale2x(px, w, h)
    W = w * 2
    H = h * 2
  }
  if (lit) px = light(px, W, H)
  const c = document.createElement('canvas')
  c.width = (W + 2) * scale
  c.height = (H + 2) * scale
  const x = c.getContext('2d')
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? null : px[j * W + i])
  if (outline) {
    x.fillStyle = outline
    for (let j = -1; j <= H; j++)
      for (let i = -1; i <= W; i++) {
        if (at(i, j)) continue
        if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) x.fillRect((i + 1) * scale, (j + 1) * scale, scale, scale)
      }
  }
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const p = at(i, j)
      if (!p) continue
      x.fillStyle = p.ramp[p.t]
      x.fillRect((i + 1) * scale, (j + 1) * scale, scale, scale)
    }
  return c
}

/* ---------- Ronaldo ---------- */
export const POSES = {
  // Back view, arms spread down and out, legs apart: the SIUUU.
  siuuu: [
    '............HHHHHHHH............',
    '..........HHhhhhhhhhHH..........',
    '.........HhhhhiiihhhhhH.........',
    '.........HhhhiiiihhhhhH.........',
    '........HhhhhiiihhhhhhhH........',
    '........HhhhhhhhhhhhhhhH........',
    '........HhhhhhhhhhhhhhhH........',
    '........HHhhhhhhhhhhhhHH........',
    '.........HHhhhhhhhhhhHH.........',
    '..........HHHhhhhhhHHH..........',
    '............SsssssssS...........',
    '.............SssssssS...........',
    '..............ssssss............',
    '..........wwwwwwwwwwwwww........',
    '......wwwwwwwwwwwwwwwwwwwww.....',
    '....wwwwwdwwwwwwwwwwwwwwdwwww...',
    '...wwwww.dwwwwwwwwwwwwwwd.wwwww.',
    '..wwwww..dwwwwnn.nn.nnwwd..wwwww',
    '.wwwww...dwwwwwwwwwwwwwwd...wwww',
    'wwwww....dwwwwwnnnnnwwwwd....www',
    'wwww.....Dwwwwwwwwnwwwwwd.....ww',
    'SSs......Dwwwwwwwnwwwwwwd.....sS',
    'Sss......Dwwwwwwnwwwwwwwd.....sS',
    'ss.......Dwwwwwwnwwwwwwwd......s',
    '.........Dwwwwwwnwwwwwwwd.......',
    '.........DDwwwwwwwwwwwwdd.......',
    '..........DdwwwwwwwwwwdD........',
    '..........wwwwwwwwwwwwww........',
    '.........wwwwwwwwwwwwwwww.......',
    '........wwwwwwwwwdwwwwwwww......',
    '........wwwwwwww...wwwwwwww.....',
    '.......wwwwwww.......wwwwwww....',
    '.......dwwwww.........wwwwwd....',
    '.......SsssS...........SsssS....',
    '......Sssss.............sssssS..',
    '......wwwww.............wwwww...',
    '.....wwwww...............wwwww..',
    '.....wwwww...............wwwww..',
    '....kkkkkk...............kkkkkk.',
    '...kKKkkkk...............kkkkKKk',
  ],
  // Back view, arms a little lower, feet closer: a clean but modest landing.
  good: [
    '............HHHHHHHH............',
    '..........HHhhhhhhhhHH..........',
    '.........HhhhhiiihhhhhH.........',
    '.........HhhhiiiihhhhhH.........',
    '........HhhhhiiihhhhhhhH........',
    '........HhhhhhhhhhhhhhhH........',
    '........HhhhhhhhhhhhhhhH........',
    '........HHhhhhhhhhhhhhHH........',
    '.........HHhhhhhhhhhhHH.........',
    '..........HHHhhhhhhHHH..........',
    '............SsssssssS...........',
    '.............SssssssS...........',
    '..............ssssss............',
    '..........wwwwwwwwwwwwww........',
    '.......wwwwwwwwwwwwwwwwwww......',
    '.....wwwwdwwwwwwwwwwwwwwdwww....',
    '....wwww.dwwwwwwwwwwwwwwd.wwww..',
    '....www..dwwwwnn.nn.nnwwd..www..',
    '...www...dwwwwwwwwwwwwwwd...www.',
    '...www...dwwwwwnnnnnwwwwd...www.',
    '..www....Dwwwwwwwwnwwwwwd....www',
    '..www....Dwwwwwwwnwwwwwwd....www',
    '..Ss.....Dwwwwwwnwwwwwwwd....sS.',
    '..ss.....Dwwwwwwnwwwwwwwd....ss.',
    '.........Dwwwwwwnwwwwwwwd.......',
    '.........DDwwwwwwwwwwwwdd.......',
    '..........DdwwwwwwwwwwdD........',
    '..........wwwwwwwwwwwwww........',
    '..........wwwwwwwwwwwwww........',
    '.........wwwwwwwdwwwwwwww.......',
    '.........wwwwww...wwwwwww.......',
    '.........wwwww.....wwwwww.......',
    '.........dwwww.....wwwwwd.......',
    '.........SsssS.....SsssS........',
    '.........sssss.....sssss........',
    '.........wwwww.....wwwww........',
    '.........wwwww.....wwwww........',
    '.........wwwww.....wwwww........',
    '........kkkkkk.....kkkkkk.......',
    '.......kKKkkkk.....kkkkKKk......',
  ],
  // In the air, seen from behind, arms up, knees tucked.
  jumpBack: [
    '....ss....................ss....',
    '....ss....................ss....',
    '....ww......HHHHHHHH......ww....',
    '....ww....HHhhhhhhhhHH....ww....',
    '....ww...HhhhhiiihhhhhH...ww....',
    '....www..HhhhiiiihhhhhH..www....',
    '....www.HhhhhiiihhhhhhhH.www....',
    '.....ww.HhhhhhhhhhhhhhhH.ww.....',
    '.....wwwHhhhhhhhhhhhhhhHwww.....',
    '.....wwwHHhhhhhhhhhhhhHHwww.....',
    '......wwwHHhhhhhhhhhhHHwww......',
    '......wwwwHHHhhhhhhHHHwwww......',
    '.......wwwwwSsssssssSwwww.......',
    '.......wwwwwwSssssssSwwww.......',
    '........wwwwwwwssssswwww........',
    '........dwwwwwwwwwwwwwwd........',
    '........dwwwwnn.nn.nnwwd........',
    '........dwwwwwwwwwwwwwwd........',
    '........dwwwwwnnnnnwwwwd........',
    '........DwwwwwwwwnwwwwwD........',
    '........DwwwwwwwnwwwwwwD........',
    '........DwwwwwwnwwwwwwwD........',
    '........DwwwwwwnwwwwwwwD........',
    '........DDwwwwwwwwwwwwDD........',
    '.........DdwwwwwwwwwwdD.........',
    '.........wwwwwwwwwwwwww.........',
    '........wwwwwwwwwwwwwwww........',
    '........wwwwwwwdwwwwwwww........',
    '........wwwwww...wwwwwww........',
    '........SsssS.....SsssS.........',
    '.......Sssss.......sssssS.......',
    '.......wwwww.......wwwww........',
    '......wwwww.........wwwww.......',
    '......wwwww.........wwwww.......',
    '.....kkkkkk.........kkkkkk......',
    '.....kkKKkk.........kkKKkk......',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  // In the air, facing the camera, shouting, arms up.
  jumpFront: [
    '....ss....................ss....',
    '....ss....................ss....',
    '....ww......HHHHHHHH......ww....',
    '....ww....HHhhhhhhhhHH....ww....',
    '....ww...HhhhhiiihhhhhH...ww....',
    '....www..HhhhhhhhhhhhhH..www....',
    '....www.HhhhhhhhhhhhhhhH.www....',
    '.....ww.HhhSsssssssssShH.ww.....',
    '.....wwwHhssssssssssssshwww.....',
    '.....wwwHhsskksssskkssshwww.....',
    '......wwwHsskksssskkssswww......',
    '......wwwwSsssssssssssSwww......',
    '.......wwwwSssrrrrrrssSww.......',
    '.......wwwwwSsrrrrrrsSwww.......',
    '........wwwwwwSsrrrrSwww........',
    '........dwwwwwwwSssSwwwd........',
    '........dwwwwwwwwwwwwwwd........',
    '........dwwwwwwwwwwwwwwd........',
    '........dwwwwwwwdwwwwwwd........',
    '........DwwwwwwwdwwwwwwD........',
    '........DwwwwwwwdwwwwwwD........',
    '........DwwwwwwwdwwwwwwD........',
    '........DwwwwwwwwwwwwwwD........',
    '........DDwwwwwwwwwwwwDD........',
    '.........DdwwwwwwwwwwdD.........',
    '.........wwwwwwwwwwwwww.........',
    '........wwwwwwwwwwwwwwww........',
    '........wwwwwwwdwwwwwwww........',
    '........wwwwww...wwwwwww........',
    '........SsssS.....SsssS.........',
    '.......Sssss.......sssssS.......',
    '.......wwwww.......wwwww........',
    '......wwwww.........wwwww.......',
    '......wwwww.........wwwww.......',
    '.....kkkkkk.........kkkkkk......',
    '.....kkKKkk.........kkKKkk......',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  // In the air, profile (facing left), arms up.
  jumpSide: [
    '..............ss................',
    '..............ss................',
    '..............ww...HHHHHHH......',
    '..............ww..HHhhhhhhhH....',
    '..............ww.HhhhhiiihhhH...',
    '..............wwHhhhhhhhhhhhhH..',
    '..............wwSsssshhhhhhhhH..',
    '..............wsssssshhhhhhhhH..',
    '..............wsskssshhhhhhhhH..',
    '...............sssssShhhhhhhH...',
    '...............SssssSHhhhhhHH...',
    '................SssSSHHHHHH.....',
    '.................SssS...........',
    '................wwwwwww.........',
    '...............wwwwwwwww........',
    '..............dwwwwwwwwwd.......',
    '..............dwwwwwwwwwd.......',
    '..............dwwwwwwwwwd.......',
    '..............DwwwwwwwwwD.......',
    '..............DwwwwwwwwwD.......',
    '..............DwwwwwwwwwD.......',
    '..............DwwwwwwwwwD.......',
    '..............DDwwwwwwwDD.......',
    '...............DdwwwwwwdD.......',
    '...............wwwwwwwww........',
    '..............wwwwwwwwww........',
    '..............wwwwwwwwww........',
    '.............wwwwww.wwwww.......',
    '.............SsssS...SsssS......',
    '............Sssss.....sssss.....',
    '............wwwww.....wwwww.....',
    '...........wwwww.......wwwww....',
    '...........wwwww.......wwwww....',
    '..........kkkkkk.......kkkkkk...',
    '..........kkKKkk.......kkKKkk...',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  // Running to the right, stride open.
  run1: [
    '................................',
    '................................',
    '.........HHHHHHHH...............',
    '.......HHhhhhhhhhHH.............',
    '......HhhhhiiihhhhhH............',
    '......HhhhhhhhhhhhhhH...........',
    '......HhhhhhSsssssssS...........',
    '......HhhhhSsssssssss...........',
    '......HhhhhSsskksssss...........',
    '......HHhhhSsssssssss...........',
    '.......HHhhhSsssssssS...........',
    '........HHHHSssssssS............',
    '.............SsssS..............',
    '...........wwwwwwww.............',
    '.........wwwwwwwwwwww...........',
    '........swwwwwwwwwwwww..........',
    '.......ssdwwwwwwwwwwwws.........',
    '.......sS.dwwwwwwwwwwwss........',
    '..........dwwwwwwwwwwwSs........',
    '..........Dwwwwwwwwwwww.........',
    '..........Dwwwwwwwwwwww.........',
    '..........Dwwwwwwwwwwww.........',
    '..........Dwwwwwwwwwwww.........',
    '..........DDwwwwwwwwwwd.........',
    '...........Ddwwwwwwwwd..........',
    '...........wwwwwwwwwww..........',
    '..........wwwwwwwwwwwww.........',
    '.........wwwwwwwwwwwwwww........',
    '........wwwwww....wwwwwww.......',
    '.......SsssS........SsssS.......',
    '......Sssss..........ssssS......',
    '.....Sssss............sssss.....',
    '.....wwwww.............wwwww....',
    '....wwwww...............wwwww...',
    '....wwwww...............wwwww...',
    '...kkkkkk................kkkkkk.',
    '..kKKkkkk................kkkKKkk',
    '................................',
    '................................',
    '................................',
  ],
  // Running to the right, legs passing.
  run2: [
    '................................',
    '.........HHHHHHHH...............',
    '.......HHhhhhhhhhHH.............',
    '......HhhhhiiihhhhhH............',
    '......HhhhhhhhhhhhhhH...........',
    '......HhhhhhSsssssssS...........',
    '......HhhhhSsssssssss...........',
    '......HhhhhSsskksssss...........',
    '......HHhhhSsssssssss...........',
    '.......HHhhhSsssssssS...........',
    '........HHHHSssssssS............',
    '.............SsssS..............',
    '...........wwwwwwww.............',
    '.........wwwwwwwwwwww...........',
    '........wwwwwwwwwwwwww..........',
    '........dwwwwwwwwwwwwws.........',
    '.......sdwwwwwwwwwwwwwSs........',
    '.......sDwwwwwwwwwwwwws.........',
    '........Dwwwwwwwwwwwww..........',
    '........Dwwwwwwwwwwwww..........',
    '........Dwwwwwwwwwwwww..........',
    '........Dwwwwwwwwwwwww..........',
    '........DDwwwwwwwwwwwd..........',
    '.........Ddwwwwwwwwwd...........',
    '.........wwwwwwwwwwww...........',
    '.........wwwwwwwwwwww...........',
    '.........wwwwwwwwwwww...........',
    '..........wwwwwdwwwww...........',
    '..........SsssS.wwww............',
    '..........sssss.SsssS...........',
    '..........wwwww..ssss...........',
    '..........wwwww..wwww...........',
    '..........wwwww..wwww...........',
    '.........kkkkkk..wwwww..........',
    '.........kKKkkk.kkkkkkk.........',
    '................kkkKKkk.........',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  // Crouched, loading the jump, arms back.
  crouch: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........HHHHHHHH..............',
    '........HHhhhhhhhhHH............',
    '.......HhhhhiiihhhhhH...........',
    '.......HhhhhhhhhhhhhhH..........',
    '.......HhhhhhhSsssssssS.........',
    '.......HhhhhhSssssssssss........',
    '.......HhhhhhSsskksssss.........',
    '.......HHhhhhSsssssssss.........',
    '........HHhhhhSsssssssS.........',
    '.........HHHHHSssssssS..........',
    '..............SsssS.............',
    '...........wwwwwwwwww...........',
    '........wwwwwwwwwwwwwwww........',
    '......swwwwdwwwwwwwwwwwwww......',
    '.....ssS...dwwwwwwwwwwwwwww.....',
    '....sS.....Dwwwwwwwwwwwwwwws....',
    '...........Dwwwwwwwwwwwwwwss....',
    '...........DwwwwwwwwwwwwwwS.....',
    '...........DDwwwwwwwwwwwwd......',
    '............DdwwwwwwwwwwdD......',
    '............wwwwwwwwwwwwww......',
    '...........wwwwwwwwwwwwwwww.....',
    '..........wwwwwwwwdwwwwwwwww....',
    '.........wwwwwww.....wwwwwwww...',
    '........SsssS..........SsssS....',
    '.......Sssss............ssssS...',
    '.......wwwww............wwwww...',
    '......wwwww..............wwwww..',
    '......wwwww..............wwwww..',
    '.....kkkkkkk............kkkkkkk.',
    '....kKKkkkkk............kkkkKKkk',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  // Face down in the grass, one leg up, the classic.
  fail1: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........................kkkk...',
    '.........................kKkk...',
    '.........................www....',
    '.........................www....',
    '.........................sss....',
    '........................Sss.....',
    '...HHHHHH..............wwwww....',
    '..HhhhhhhHHwwwwwwwwwwwwwwwwww...',
    '.HhhhiihhhhHwwwwwwwwwwwwwwwwww..',
    '.HhhhhhhhhhHwwwwwwwwwwwwwwwwwww.',
    '.HhhhhhhhhhHwwwwnn.nn.nnwwwwwwww',
    '.HhhhhhhhhhhHwwwwwwwwwwwwwwwwwwk',
    '.HHhhhhhhhhhhdddddwwnwwwwwwwwwkk',
    '..HHhhhhhhHHDDDDDDwnwwwwwwwwwkKk',
    '....HHHHHH.sssssSDDnDDwwwwwwwkkk',
    '...........sssssS....DDDDwwwww..',
    '............SSSS.........ssss...',
    '..........................SSS...',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  // On his back, legs in the air.
  fail2: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..................kkkkk..kkkkk..',
    '..................kKKkk..kkKKk..',
    '...................www....www...',
    '...................www....www...',
    '...................www....www...',
    '...................sss....sss...',
    '...................SsS...SsS....',
    '....................www.www.....',
    '....................wwwwwww.....',
    '..................wwwwwwwwww....',
    '...............wwwwwwwwwwwwww...',
    '.............wwwwwwwwwwwwwwwww..',
    '...........wwwwwwwwwwwwwwwwwww..',
    '.........HHwwwwwwnn.nn.nnwwwww..',
    '.......HHhhHwwwwwwwwwwwwwwwwww..',
    '......HhhhhhHSwwwwwnnnnnwwwwww..',
    '.....HhhhiihhHsswwwwwwnwwwwwww..',
    '.....HhhhhhhhhHswwwwwnwwwwwwwww.',
    '.....HhhhhhhhhHsswwwwnwwwwwwwww.',
    '.....HhhhhhhhhHssSwwwnwwwwwwwww.',
    '......HhhhhhhHSssSDDDDDDDDDDDD..',
    '.......HHhhhHSsssS.ss..........s',
    '.........HHHSssssSsssss.....ssss',
    '............SSSSSsssssS.....sss.',
    '.................SSSS...........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
}

/** A pose leaning to one side: rows shift sideways with height (used for the wobbly BAD landing). */
export function lean(rows, amount) {
  const w = rows[0].length
  const h = rows.length
  return rows.map((row, j) => {
    const shift = Math.round(((h - 1 - j) / (h - 1)) * amount)
    const padded = '.'.repeat(Math.max(0, shift)) + row + '.'.repeat(Math.max(0, -shift))
    return shift >= 0 ? padded.slice(0, w) : padded.slice(-shift, -shift + w)
  })
}
POSES.bad = lean(POSES.good, 5)

const spriteCache = new Map()
/**
 * Canvas of a pose, doubled and lit, drawn 1:1 (a 32 × 40 pose becomes 64 × 80 plus a 1 px
 * outline margin). Feet sit at row 2 × rows.length + 1 of the canvas.
 */
export function sprite(rows, key, flip = false) {
  const id = key + (flip ? 'f' : '')
  let c = spriteCache.get(id)
  if (c) return c
  const h = rows.length
  const w = rows[0].length
  const px = new Array(w * h).fill(null)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i]
      if (ch === '.') continue
      px[j * w + (flip ? w - 1 - i : i)] = tone(INK[ch])
    }
  c = finish(px, w, h)
  spriteCache.set(id, c)
  return c
}

/* ---------- the crowd: supporters assembled from parts ---------- */
// A grid of colour strings, drawn at ×2 with an automatic outline.
class Grid {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Array(w * h).fill(null)
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return
    this.px[y * this.w + x] = typeof c === 'string' ? tone(c) : c
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  map(x, y, rows, inks) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        if (ch !== '.') this.set(x + i, y + j, inks[ch] || ch)
      }
    })
  }
  toCanvas(opts) {
    return finish(this.px, this.w, this.h, opts)
  }
}

export const FAN_W = 16
export const FAN_H = 18
// Head: skin block at cols 5-9, rows 6-12. Body below from row 13. Hats may climb to row 0.
const HEAD_X = 5
const HEAD_Y = 6

const SHIRTS = ['#F4F4F2', '#F4F4F2', '#E23B3B', '#FFD84A', '#2C4FA3', '#2C4FA3', '#43A047', '#9A9EAA', '#F08A24', '#7B3FA0', '#1E2A4A', '#E8D8B0', '#1B8C8C', '#C2185B']
const HAIRS = ['#2B1B14', '#2B1B14', '#111111', '#8A5A2B', '#D8B25C', '#C8502E', '#9A9EAA', '#F0E6C8', '#2B1B14', '#4A2C7A', '#E53FA0']
const SKINS = ['#EBB98B', '#F2CBA4', '#C68A5A', '#8C5A3C', '#5C3A26', '#EBB98B', '#D9A077']
const HATS = ['#E23B3B', '#1E2A4A', '#FFD84A', '#2C4FA3', '#F4F4F2', '#43A047', '#17171F']
const darken = (hex, k = 0.75) => shade(hex, k)
const pick = (rng, list) => list[Math.floor(rng() * list.length)]

/** Random description of a supporter. */
export function makeFan(rng) {
  const r = rng()
  if (r < 0.025) return { cameo: pick(rng, ['duck', 'waldo', 'wizard', 'bat', 'robot', 'banana', 'punk', 'queen']) }
  const shirt = pick(rng, SHIRTS)
  return {
    shirt,
    shirt2: rng() < 0.3 ? pick(rng, SHIRTS.filter((c) => c !== shirt)) : null,
    pattern: pick(rng, ['plain', 'plain', 'plain', 'stripes', 'hoops', 'scarf']),
    hair: pick(rng, HAIRS),
    hairStyle: pick(rng, ['short', 'short', 'short', 'long', 'long', 'bald', 'mohawk', 'afro', 'ponytail', 'bun', 'curly']),
    skin: pick(rng, SKINS),
    hat: rng() < 0.38 ? pick(rng, ['cap', 'cap', 'beanie', 'bucket', 'cone', 'viking', 'topper', 'headband']) : null,
    hatColour: pick(rng, HATS),
    glasses: rng() < 0.18 ? (rng() < 0.5 ? 'sun' : 'clear') : null,
    beard: rng() < 0.2 ? pick(rng, ['full', 'goatee', 'mustache']) : null,
    accessory: rng() < 0.3 ? pick(rng, ['flag', 'flag', 'beer', 'phone', 'scarfUp', 'foam', 'horn', 'drum', 'beer', 'phone', rng() < 0.08 ? 'sign' : 'flag']) : null,
    flagColours: [pick(rng, SHIRTS), pick(rng, SHIRTS)],
    excited: rng() < 0.1,
  }
}

const CAMEOS = {
  duck: {
    rows: [
      '......yyyy......',
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '....yykyyyky....',
      '....yyyyyyyy....',
      '...yyyyyyyyyy...',
      '..oooooooooooo..',
      '...ooooooooooo..',
      '....yyyyyyyy....',
      '....yyyyyyyy....',
      '.....yyyyyy.....',
      '......yyyy......',
      '....yyyyyyyyy...',
      '...yyyyyyyyyyy..',
      '..yyyyyyyyyyyyy.',
      '..yyyyyyyyyyyyy.',
      '..yyyyyyyyyyyyy.',
      '..yyyyyyyyyyyyy.',
    ],
    inks: { y: '#FFD23F', k: '#17171F', o: '#F08A24' },
  },
  waldo: {
    rows: [
      '......rrrrr.....',
      '.....rrrrrrr....',
      '.....wwwwwww....',
      '.....rrrrrrr....',
      '.....hhhhhhh....',
      '.....sssssss....',
      '....kkksskkk....',
      '....k.ksskk.k...',
      '.....sssssss....',
      '.....sssssss....',
      '.....ssrrrss....',
      '......sssss.....',
      '...wwwwwwwwwww..',
      '..rrrrrrrrrrrrr.',
      '..wwwwwwwwwwwww.',
      '..rrrrrrrrrrrrr.',
      '..wwwwwwwwwwwww.',
      '..rrrrrrrrrrrrr.',
    ],
    inks: { r: '#E23B3B', w: '#F4F4F2', h: '#2B1B14', s: '#EBB98B', k: '#17171F' },
  },
  wizard: {
    rows: [
      '.......gg.......',
      '......gggg......',
      '......gggg......',
      '.....gggggg.....',
      '.....gggggg.....',
      '....gggggggg....',
      '..gggggggggggg..',
      '.....sssssss....',
      '.....skssskss...',
      '.....sssssss....',
      '....wwwwwwwww...',
      '....wwwwwwwww...',
      '.....wwwwwww....',
      '......wwwww.....',
      '..gggggwwwggggg.',
      '..ggggggwgggggg.',
      '..ggggggggggggg.',
      '..ggggggggggggg.',
    ],
    inks: { g: '#8E93A3', s: '#EBB98B', k: '#17171F', w: '#F4F4F2' },
  },
  bat: {
    rows: [
      '................',
      '................',
      '....k......k....',
      '....kk....kk....',
      '....kkkkkkkk....',
      '....kkkkkkkk....',
      '....kkkkkkkk....',
      '....kkwwkkww....',
      '....kkkkkkkk....',
      '.....sssssss....',
      '.....sssssss....',
      '......sssss.....',
      '...kkkkkkkkkkk..',
      '..kkkkkyyykkkkk.',
      '..kkkkyyyyykkkk.',
      '..kkkkkyyykkkkk.',
      '..kkkkkkkkkkkkk.',
      '..kkkkkkkkkkkkk.',
    ],
    inks: { k: '#23242E', w: '#F4F4F2', s: '#EBB98B', y: '#FFD84A' },
  },
  robot: {
    rows: [
      '.......aa.......',
      '.......rr.......',
      '....gggggggg....',
      '....gGGGGGGg....',
      '....gGccccGg....',
      '....gGcGGcGg....',
      '....gGccccGg....',
      '....gGGGGGGg....',
      '....gGcccGGg....',
      '....gggggggg....',
      '......gggg......',
      '......gggg......',
      '...gggggggggg...',
      '..gGGGGGGGGGGg..',
      '..gGGrrGGccGGg..',
      '..gGGGGGGGGGGg..',
      '..gGGGGGGGGGGg..',
      '..gggggggggggg..',
    ],
    inks: { g: '#5C6170', G: '#9A9EAA', c: '#6CE3FF', r: '#E23B3B', a: '#9A9EAA' },
  },
  banana: {
    rows: [
      '.........kk.....',
      '........yy......',
      '.......yyy......',
      '......yyyy......',
      '.....yyyyy......',
      '.....yyyyyy.....',
      '....yyyyyyy.....',
      '....yyssssyy....',
      '....yyskssky....',
      '....yyssssyy....',
      '....yysrrrsy....',
      '....yyyssyyy....',
      '....yyyyyyyy....',
      '...yyyyyyyyyy...',
      '...yyyyyyyyyy...',
      '...yyyyyyyyyy...',
      '...yyyyyyyyyy...',
      '....yyyyyyyy....',
    ],
    inks: { y: '#FFE14D', k: '#5C3A26', s: '#EBB98B', r: '#B9303C' },
  },
  punk: {
    rows: [
      '.......p........',
      '......ppp.......',
      '......ppp.......',
      '......ppp.......',
      '.....ppppp......',
      '.....ppppp......',
      '.....sssssss....',
      '.....skssskss...',
      '.....sssssss....',
      '.....sssssss....',
      '.....ssrrrss....',
      '......sssss.....',
      '...kkkkkkkkkkk..',
      '..kkkkkWWWkkkkk.',
      '..kkkkWkkkWkkkk.',
      '..kkkkkWWWkkkkk.',
      '..kkkkkkkkkkkkk.',
      '..kkkkkkkkkkkkk.',
    ],
    inks: { p: '#E53FA0', s: '#EBB98B', k: '#17171F', r: '#B9303C', W: '#F4F4F2' },
  },
  queen: {
    rows: [
      '.....y.y.y.y....',
      '.....yyyyyyy....',
      '.....ycyyycy....',
      '.....yyyyyyy....',
      '.....ggggggg....',
      '....ggggggggg...',
      '....ggsssssgg...',
      '....gskssskgg...',
      '....gsssssssg...',
      '....gssrrrssg...',
      '....ggsssssgg...',
      '......sssss.....',
      '...mmmmmmmmmmm..',
      '..mmmmmmmmmmmmm.',
      '..mmmWWWWWWWmmm.',
      '..mmmmmmmmmmmmm.',
      '..mmmmmmmmmmmmm.',
      '..mmmmmmmmmmmmm.',
    ],
    inks: { y: '#FFD84A', c: '#E23B3B', g: '#F0E6C8', s: '#F2CBA4', k: '#17171F', r: '#B9303C', m: '#7B3FA0', W: '#F4F4F2' },
  },
}

/** Pixel grid of a supporter in a pose ('idle' or 'up'). */
function fanGrid(f, pose) {
  const g = new Grid(FAN_W, FAN_H)
  if (f.cameo) {
    const c = CAMEOS[f.cameo]
    g.map(0, 0, c.rows, c.inks)
    if (pose === 'up') {
      const arm = c.inks[c.rows[14][3]] || c.inks.y || '#F4F4F2'
      g.rect(1, 4, 2, 9, arm)
      g.rect(13, 4, 2, 9, arm)
    }
    return g
  }
  const skinS = darken(f.skin, 0.8)
  const up = pose === 'up'
  // body
  g.rect(3, 13, 10, 5, f.shirt)
  g.rect(2, 14, 12, 4, f.shirt)
  const c2 = f.shirt2 || darken(f.shirt, 0.7)
  if (f.pattern === 'stripes') for (let x = 3; x < 13; x += 2) g.rect(x, 13, 1, 5, c2)
  if (f.pattern === 'hoops') for (let y = 14; y < 18; y += 2) g.rect(2, y, 12, 1, c2)
  if (f.pattern === 'scarf') {
    g.rect(3, 13, 10, 2, c2)
    g.rect(4, 15, 2, 3, c2)
  }
  g.rect(13, 14, 1, 4, darken(f.shirt, 0.72))
  // arms
  if (up) {
    g.rect(1, 7, 2, 7, f.shirt)
    g.rect(13, 7, 2, 7, f.shirt)
    g.rect(1, 5, 2, 2, f.skin)
    g.rect(13, 5, 2, 2, f.skin)
  } else {
    g.rect(1, 14, 1, 4, f.shirt)
    g.rect(14, 14, 1, 4, f.shirt)
  }
  // neck and head
  g.rect(6, 12, 4, 1, skinS)
  g.rect(HEAD_X, HEAD_Y, 5, 7, f.skin)
  g.rect(HEAD_X + 4, HEAD_Y + 1, 1, 6, skinS)
  // eyes, mouth
  g.set(6, 9, '#17171F')
  g.set(8, 9, '#17171F')
  if (up || f.excited) g.rect(7, 11, 1, 1, '#B9303C')
  if (f.glasses) {
    const lens = f.glasses === 'sun' ? '#17171F' : '#BFE6FF'
    g.rect(5, 9, 2, 1, lens)
    g.rect(8, 9, 2, 1, lens)
    g.set(7, 9, '#17171F')
  }
  if (f.beard === 'full') {
    g.rect(5, 11, 5, 2, f.hair)
    g.rect(7, 11, 1, 1, '#B9303C')
  }
  if (f.beard === 'goatee') g.rect(6, 12, 3, 1, f.hair)
  if (f.beard === 'mustache' || f.beard === 'full') g.rect(6, 10, 3, 1, f.hair)
  // hair
  const H = f.hair
  const hs = f.hairStyle
  if (hs !== 'bald') {
    g.rect(5, 5, 5, 2, H)
    g.set(4, 6, H)
    g.set(10, 6, H)
  } else g.rect(4, 7, 1, 1, H)
  if (hs === 'long') {
    g.rect(4, 6, 1, 6, H)
    g.rect(10, 6, 1, 6, H)
  }
  if (hs === 'mohawk') {
    g.rect(5, 5, 5, 2, f.skin)
    g.rect(7, 2, 1, 5, H)
    g.rect(6, 4, 3, 1, H)
  }
  if (hs === 'afro') {
    g.rect(4, 3, 7, 4, H)
    g.rect(3, 4, 9, 4, H)
    g.rect(3, 8, 1, 2, H)
    g.rect(11, 8, 1, 2, H)
  }
  if (hs === 'ponytail') {
    g.rect(10, 7, 1, 5, H)
    g.rect(11, 9, 1, 4, H)
  }
  if (hs === 'bun') g.rect(6, 3, 3, 2, H)
  if (hs === 'curly') {
    g.rect(4, 4, 7, 3, H)
    g.set(4, 7, H)
    g.set(10, 7, H)
    g.set(5, 4, darken(H, 1.35))
    g.set(8, 5, darken(H, 1.35))
  }
  // hats
  const hc = f.hatColour
  const hd = darken(hc, 0.7)
  if (f.hat === 'cap') {
    g.rect(5, 4, 5, 3, hc)
    g.rect(4, 6, 1, 1, hc)
    g.rect(9, 6, 4, 1, hd)
  }
  if (f.hat === 'beanie') {
    g.rect(5, 3, 5, 4, hc)
    g.rect(4, 6, 7, 1, hd)
    g.rect(6, 2, 3, 1, '#F4F4F2')
  }
  if (f.hat === 'bucket') {
    g.rect(5, 3, 5, 3, hc)
    g.rect(3, 6, 9, 1, hd)
  }
  if (f.hat === 'cone') {
    g.rect(7, 0, 1, 2, hc)
    g.rect(6, 2, 3, 2, hc)
    g.rect(5, 4, 5, 2, hc)
    g.rect(4, 6, 7, 1, hd)
    g.set(7, 1, '#F4F4F2')
  }
  if (f.hat === 'viking') {
    g.rect(5, 3, 5, 4, '#9A9EAA')
    g.rect(4, 6, 7, 1, '#6B7080')
    g.rect(3, 2, 1, 3, '#F0E6C8')
    g.rect(11, 2, 1, 3, '#F0E6C8')
    g.set(4, 4, '#F0E6C8')
    g.set(10, 4, '#F0E6C8')
  }
  if (f.hat === 'topper') {
    g.rect(5, 1, 5, 5, '#17171F')
    g.rect(4, 6, 7, 1, '#17171F')
    g.rect(5, 4, 5, 1, hc)
  }
  if (f.hat === 'headband') g.rect(4, 5, 7, 1, hc)
  // accessories
  const a = f.accessory
  if (a === 'flag') {
    g.rect(13, 0, 1, 13, '#8E5A3C')
    const [c1, c3] = f.flagColours
    const wave = up ? 0 : 1
    g.rect(14, 1 + wave, 2, 2, c1)
    g.rect(14, 3 + wave, 2, 2, c3)
    g.rect(13, up ? 7 : 11, 2, 2, f.skin)
  }
  if (a === 'sign') {
    g.rect(0, 0, 11, 5, '#F4F4F2')
    g.map(1, 1, ['n.nnn.n.n.', 'n.n.n.n.n.', 'n.n.n.n.n.', 'n.nnn.nnn.'], { n: '#1E2A4A' })
    g.rect(1, 0, 10, 1, '#F4F4F2')
    g.rect(2, 5, 1, 8, '#8E5A3C')
    g.rect(1, 9, 2, 2, f.skin)
  }
  if (a === 'beer') {
    g.rect(13, up ? 2 : 10, 3, 4, '#FFC53D')
    g.rect(13, up ? 2 : 10, 3, 1, '#FFF4D6')
    g.rect(13, up ? 7 : 12, 2, 2, f.skin)
  }
  if (a === 'phone') {
    g.rect(13, up ? 3 : 10, 2, 4, '#2A2D3A')
    g.rect(13, up ? 4 : 11, 2, 2, '#BFE6FF')
    g.rect(13, up ? 7 : 12, 2, 2, f.skin)
  }
  if (a === 'scarfUp') {
    g.rect(1, 2, 2, 4, f.skin)
    g.rect(13, 2, 2, 4, f.skin)
    g.rect(1, 6, 2, 7, f.shirt)
    g.rect(13, 6, 2, 7, f.shirt)
    const [c1, c3] = f.flagColours
    for (let x = 1; x < 15; x++) g.rect(x, 2 + (x % 4 < 2 ? 0 : 1), 1, 2, x % 4 < 2 ? c1 : c3)
  }
  if (a === 'foam') {
    g.rect(12, 1, 4, 6, '#F4F4F2')
    g.rect(13, 0, 1, 2, '#F4F4F2')
    g.rect(13, 2, 2, 4, '#E23B3B')
    g.rect(13, 7, 2, 6, f.shirt)
  }
  if (a === 'horn') {
    g.rect(10, 9, 6, 2, '#FFD84A')
    g.rect(14, 8, 2, 4, '#F08A24')
    g.rect(10, 11, 2, 2, f.skin)
  }
  if (a === 'drum') {
    g.rect(3, 12, 10, 6, '#E23B3B')
    g.rect(3, 12, 10, 1, '#F4F4F2')
    g.rect(3, 15, 10, 1, '#F4F4F2')
    g.rect(1, 9, 2, 3, f.skin)
    g.rect(2, 7, 1, 3, '#8E5A3C')
  }
  return g
}

const fanCache = new Map()
/** Canvas (×2) of a supporter in a pose, with an outline. */
export function fanSprite(f, pose) {
  const key = JSON.stringify(f) + pose
  let c = fanCache.get(key)
  if (!c) {
    c = fanGrid(f, pose).toCanvas({ outline: '#1C1A2E' })
    fanCache.set(key, c)
  }
  return c
}

/* ---------- small people on the pitch and the track ---------- */
const MINI = {
  idle: ['..hhh..', '..sss..', '..sss..', '.wwwww.', '.swwws.', '..www..', '..p.p..', '..p.p..', '..k.k..'],
  up: ['s.....s', 's.hhh.s', 'w.sss.w', '.wsssw.', '..www..', '..www..', '..p.p..', '..p.p..', '..k.k..'],
  siuuu: ['..hhh..', '..hhh..', '..sss..', '.wwwww.', 'wwwwwww', 's.www.s', '..w.w..', '.p...p.', '.k...k.'],
  sit: ['.......', '.......', '..hhh..', '..sss..', '..sss..', '.wwwww.', '.swwws.', '..wwwp.', '..pkpk.'],
  run1: ['..hhh..', '..sss..', '.ssss..', '.wwwws.', 's.www..', '..www..', '.p..p..', 'p....p.', 'k....k.'],
  run2: ['..hhh..', '..sss..', '..sss..', '.wwwws.', '.swww..', '..www..', '..pp...', '..p.p..', '..k.k..'],
  back: ['..hhh..', '..hhh..', '..sss..', '.wwwww.', '.swwws.', '..www..', '..p.p..', '..p.p..', '..k.k..'],
}
const miniCache = new Map()
export function mini(pose, shirt, hair, skin, pants = '#2F3550') {
  const key = pose + shirt + hair + skin + pants
  let c = miniCache.get(key)
  if (c) return c
  const g = new Grid(7, 9)
  g.map(0, 0, MINI[pose], { h: hair, s: skin, w: shirt, p: pants, k: '#17171F' })
  c = g.toCanvas({ outline: '#1C1A2E' })
  miniCache.set(key, c)
  return c
}

/* ---------- props ---------- */
const PROPS = {
  cart: {
    rows: [
      '....wwwwwwwwwwwwwwwwww....',
      '...wwwwwwwwwwwwwwwwwwww...',
      '...wdddddddddddddddddddw..',
      '....k...............k.....',
      '....k...............k.....',
      '....k...bbbbbbbb....k.....',
      '....k...bbbbbbbb....k.....',
      '....k...bbbbbbbb....k.....',
      '....k.....ddd.......k.....',
      '.wwwwwwwwwwwwwwwwwwwwwwww.',
      'wwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwddddddddddddddddrrddddww',
      'wwwwwwwwwwwwwwwwwwwwwwwwww',
      '..kkkk..............kkkk..',
      '.kkKKkk............kkKKkk.',
      '.kkKKkk............kkKKkk.',
      '..kkkk..............kkkk..',
    ],
    inks: { w: '#F4F4F2', d: '#C3C7D1', k: '#2A2D3A', K: '#8E93A3', b: '#2C4FA3', r: '#E23B3B' },
  },
  camera: {
    rows: [
      '..........kkkk..',
      '.........kkkkkk.',
      '.hhhh....kKKKkkk',
      'hhhhhh...kkkkkkk',
      'hsssshkkkkkkk...',
      'hskssh..kkk.....',
      'hsssss..kkk.....',
      '.ssss...kkk.....',
      'nnnnnnnnnnnn....',
      'nnnnnnnnnnnn....',
      'nnnnnnnnnnnn....',
      '.nnnnnnnnnn.....',
      '..nnn..nnn......',
      '..kkk..kkk......',
    ],
    inks: { k: '#2A2D3A', K: '#6CE3FF', h: '#2B1B14', s: '#EBB98B', n: '#1E2A4A' },
  },
  ball: {
    rows: ['.wwww.', 'wwkwww', 'wkwwkw', 'wwwkww', 'wwkwww', '.wwww.'],
    inks: { w: '#F4F4F2', k: '#2A2D3A' },
  },
}
const propCache = new Map()
export function prop(name, scale = 1) {
  const key = name + scale
  let c = propCache.get(key)
  if (c) return c
  const p = PROPS[name]
  const g = new Grid(p.rows[0].length, p.rows.length)
  g.map(0, 0, p.rows, p.inks)
  c = g.toCanvas({ outline: '#1C1A2E', scale })
  propCache.set(key, c)
  return c
}

/* ---------- image sheets (art/*.png + art/*.json), optional ---------- */
// When present, a sheet replaces the code-drawn sprite pose by pose; see art/SPEC.md.
export const art = { ronaldo: null, fans: null }
async function loadSheet(name) {
  const base = new URL('./art/', import.meta.url).href
  const meta = await fetch(base + name + '.json').then((r) => (r.ok ? r.json() : null))
  if (!meta) return null
  const img = new Image()
  img.src = base + name + '.png'
  await img.decode()
  return { ...meta, img }
}
/** Loads the sheets that exist; resolves when both attempts are done. */
export async function loadArt() {
  const [r, f] = await Promise.all([loadSheet('ronaldo').catch(() => null), loadSheet('fans').catch(() => null)])
  art.ronaldo = r
  art.fans = f && f.ids && f.ids.length ? f : null
  return art
}
/**
 * Draws Ronaldo with his feet at (x, y): from the sheet when it has the pose, else from the
 * code-drawn pose. `flip` mirrors horizontally.
 */
export function drawRonaldo(ctx, pose, x, y, flip = false) {
  const fr = art.ronaldo && art.ronaldo.frames[pose]
  if (fr) {
    ctx.save()
    if (flip) {
      ctx.translate(Math.round(x), 0)
      ctx.scale(-1, 1)
      ctx.drawImage(art.ronaldo.img, fr.x, fr.y, fr.w, fr.h, -fr.ax, Math.round(y) - fr.ay - 1, fr.w, fr.h)
    } else ctx.drawImage(art.ronaldo.img, fr.x, fr.y, fr.w, fr.h, Math.round(x) - fr.ax, Math.round(y) - fr.ay - 1, fr.w, fr.h)
    ctx.restore()
    return
  }
  const sp = sprite(POSES[pose], pose, flip)
  ctx.drawImage(sp, Math.round(x) - 33, Math.round(y) - 81)
}
/** Draws a supporter with the given variant index (sheet) or description (code), top-left at (x, y). */
export function drawFan(ctx, f, pose, x, y) {
  if (art.fans && f.variant != null) {
    const id = art.fans.ids[f.variant % art.fans.ids.length]
    const fr = art.fans.frames[id + '-' + pose] || art.fans.frames[id + '-idle']
    if (fr) {
      ctx.drawImage(art.fans.img, fr.x, fr.y, fr.w, fr.h, x + 17 - fr.ax, y + 38 - fr.h, fr.w, fr.h)
      return
    }
  }
  ctx.drawImage(fanSprite(f.desc, pose), x, y)
}
