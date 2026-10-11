// Ingestion de l'export PixelLab complet → carton-plein/sprites/<perso>.png + .json
// Chaque atlas : grille de cases 64 × 64, 16 colonnes ; le JSON donne, par animation et par
// direction (s, se, e, ne, n, nw, w, sw), la liste des indices de cases. Ancre : (32, 60).
//   node carton-plein/art/ingest.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { Pix, PALETTE } from '../../cons-de-mime/pixel.js'
import { toPix } from './pixellab-check.mjs'
import { recolor, rekit, paraguay } from './recolor.mjs'
import { LOOKS, RAMP } from './players.mjs'

const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
const ROOT = 'carton-plein/art/pixellab/export-05-full'
const OUT = 'carton-plein/sprites'
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
const SHORT = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']
const CELL = 64 // les rotations font 48 × 48, les animations 80 × 80 : tout est recalé sur une ancre commune
const COLS = 16
const AX = 32
const AY = 60

const animFrames = (name, dir) => { const d = path.join(ROOT, 'Idle/animations', name, dir); return fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort().map((f) => toPix(path.join(d, f), false)) }
const poseFrame = (folder, dir) => toPix(path.join(ROOT, folder, 'rotations', dir + '.png'), false)
const rotations = (folder) => Object.fromEntries(DIRS.map((d, i) => [SHORT[i], [poseFrame(folder, d)]]))
const animation = (name) => Object.fromEntries(DIRS.map((d, i) => [SHORT[i], animFrames(name, d)]))

/* ---------- écriture PNG RGBA ---------- */
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]) }
function pngRGBA(pix) {
  const W = pix.w, H = pix.h
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const c = pix.data[y * W + x]
      const o = y * (W * 4 + 1) + 1 + x * 4
      if (!c) { raw[o] = raw[o + 1] = raw[o + 2] = raw[o + 3] = 0; continue }
      raw[o] = parseInt(c.slice(1, 3), 16); raw[o + 1] = parseInt(c.slice(3, 5), 16); raw[o + 2] = parseInt(c.slice(5, 7), 16); raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** Construit un atlas : `anims` = { nom: { dir: [Pix] } }, `paint` = fonction de recoloration par image. */
function atlas(name, anims, paint) {
  const frames = []
  const index = {}
  for (const [an, dirs] of Object.entries(anims)) {
    index[an] = {}
    for (const [d, list] of Object.entries(dirs)) index[an][d] = list.map((p) => { frames.push(paint(p)); return frames.length - 1 })
  }
  const rows = Math.ceil(frames.length / COLS)
  const sheet = new Pix(COLS * CELL, rows * CELL)
  frames.forEach((p, i) => {
    // Rotations 48 × 48 : pieds en 47, centre 24. Animations 80 × 80 : pieds en 63, centre 40.
    const ox = p.w === 48 ? 8 : -8
    const oy = p.w === 48 ? 13 : -3
    const x0 = (i % COLS) * CELL, y0 = Math.floor(i / COLS) * CELL
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const c = p.data[y * p.w + x]; const tx = x + ox, ty = y + oy; if (c && tx >= 0 && ty >= 0 && tx < CELL && ty < CELL) sheet.px(x0 + tx, y0 + ty, c) }
  })
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name + '.png'), pngRGBA(sheet))
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ cell: CELL, cols: COLS, ax: AX, ay: AY, anims: index }))
  console.error(name, frames.length, 'images', sheet.w + 'x' + sheet.h)
}

// Animations partagées (chargées une fois).
const A = {
  idle: animation('Breathing_Idle'),
  run: animation('Running'),
  walk: animation('Walking'),
  hit: animation('Taking_Punch'),
  fall: animation('Falling_Back_Death'),
  ko: rotations('Lying_flat_on_his_ba'),
  stance: animation('Fight_Stance_Idle'),
  throw: animation('Throw_Object'),
  tackle: rotations('Slide_tackle_pose_f'),
  punch: rotations('Straight_punch_pose'),
  knee: rotations('Rising_knee_strike_p'),
  kick: rotations('High_front_kick_pose'),
  flykick: rotations('Flying_kick_pose_fr'),
  header: rotations('Diving_header_pose'),
  knocked: rotations('Knocked_back_pose_f'),
  dive: rotations('Goalkeeper_diving_sa'),
}
/**
 * Planche 3 × 3 générée hors PixelLab (arbitre qui siffle et brandit le carton) : cases de 256 px,
 * figure d'environ 220 px, réduite par blocs de `scale` (majorité des pixels opaques) en 48 × 48,
 * pieds en 47, centre en 24, comme les rotations.
 */
function sheetFrames(file, cols, rows, cellPx, scale) {
  const sheet = toPix(file, false)
  const out = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const w = Math.floor(cellPx / scale), h = w
    const small = new Pix(w, h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const count = {}
      let n = 0
      for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) { const k = sheet.get(c * cellPx + x * scale + i, r * cellPx + y * scale + j); if (k) { n++; count[k] = (count[k] || 0) + 1 } }
      if (n * 2 >= scale * scale) small.px(x, y, Object.entries(count).sort((a, b) => b[1] - a[1])[0][0])
    }
    const b = small.bounds()
    const f = new Pix(48, 48)
    const ox = 24 - (b.x + Math.floor(b.w / 2)), oy = 47 - (b.y + b.h - 1)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = small.get(x, y); if (k && x + ox >= 0 && x + ox < 48 && y + oy >= 0 && y + oy < 48) f.px(x + ox, y + oy, k) }
    f.ax = 24; f.ay = 47
    out.push(f)
  }
  return out
}
/** Arbitre au carton : peau pâle, cheveux gris, rayures blanches du maillot → jaune, carton → `card`. */
function paintRefCard(raw, cardRamp) {
  const q = recolor(raw, { skin: 'skinPale', hair: 'hairGrey' }, { nearest })
  const b = raw.bounds()
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
    const c = raw.get(x, y)
    if (!c) continue
    const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), bl = parseInt(c.slice(5, 7), 16)
    const rel = (y - b.y) / b.h
    if (r > 150 && g < 90 && bl < 90) q.px(x, y, cardRamp[r > 190 ? 3 : 2]) // le carton
    else if (r > 170 && g > 170 && bl > 170 && rel > 0.42 && rel < 0.74) q.px(x, y, RAMP.yellow[r > 240 ? 2 : 1]) // rayures du maillot
  }
  q.painted = true
  return q
}
const CARD = sheetFrames('carton-plein/art/pixellab/export-06-referee-card/sheet.png', 3, 3, 256, 5)
const allDirs = (list) => Object.fromEntries(SHORT.map((d) => [d, list]))
const pick = (...names) => Object.fromEntries(names.map((n) => [n, A[n]]))

// Onze Français : peau × cheveux seulement (pas de changement de coupe pour l'instant).
// Onze Français au même design : peau pâle, tous blonds.
const FR = [{ skin: 'skinPale', hair: 'hairBlond' }]
const paintLook = (look) => (p) => recolor(p, look, { nearest })
FR.forEach((look, i) => atlas('france-' + i, pick('idle', 'run', 'hit', 'fall', 'ko', 'knocked'), paintLook(look)))
// Le n°4.
atlas('paraguay', pick('stance', 'run', 'throw', 'tackle', 'punch', 'knee', 'kick', 'flykick', 'header', 'hit'), (p) => paraguay(p, { nearest, look: { skin: 'skinTan', hair: 'hairBrown', band: true, beard: true } }))
// L'arbitre : jaune fluo, cheveux gris. Le gardien : violet, chauve, barbu, avec son plongeon.
atlas('arbitre', { ...pick('idle', 'run', 'walk', 'hit', 'fall', 'ko'), card: allDirs(CARD.map((p) => paintRefCard(p, RAMP.yellow))), redcard: allDirs(CARD.map((p) => paintRefCard(p, RAMP.red))) }, (p) => p.painted ? p : rekit(p, { nearest, kit: { jersey: 'yellow', shorts: 'black', socks: 'black', boots: 'black' }, look: { skin: 'skinPale', hair: 'hairGrey' } }))
atlas('gardien', { ...pick('idle', 'run', 'hit', 'fall', 'ko'), dive: A.dive }, (p) => rekit(p, { nearest, kit: { jersey: 'purple', shorts: 'black', socks: 'purple', boots: 'red' }, look: { skin: 'skinDark', hair: 'hairBlack', beard: true } }))
