// Vérification d'un export PixelLab : node carton-plein/art/pixellab-check.mjs <dossier> > planche.png
// Rotations brutes, quantifiées Endesga 32, puis un écran 640×360 avec onze joueurs à l'échelle 1:1.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { glyph3 } from '../../cons-de-mime/font.js'

const P = PAL
/* ---------- lecteur PNG minimal (RGBA 8 bits, non entrelacé) ---------- */
function readPng(file) {
  const buf = fs.readFileSync(file)
  let pos = 8
  let w = 0, h = 0, ctype = 0, bitDepth = 0
  const idat = []
  let plte = null, trns = null
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; ctype = data[9] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'PLTE') plte = data
    else if (type === 'tRNS') trns = data
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error('PNG ' + bitDepth + ' bits non géré')
  const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 4 ? 2 : 1
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = new Uint8Array(w * h * 4)
  let prev = new Uint8Array(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0
      let v = line[i]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      line[i] = v & 255
    }
    prev = line
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (ctype === 6) { out[o] = line[x * 4]; out[o + 1] = line[x * 4 + 1]; out[o + 2] = line[x * 4 + 2]; out[o + 3] = line[x * 4 + 3] }
      else if (ctype === 2) { out[o] = line[x * 3]; out[o + 1] = line[x * 3 + 1]; out[o + 2] = line[x * 3 + 2]; out[o + 3] = 255 }
      else if (ctype === 3) { const i = line[x]; out[o] = plte[i * 3]; out[o + 1] = plte[i * 3 + 1]; out[o + 2] = plte[i * 3 + 2]; out[o + 3] = trns && i < trns.length ? trns[i] : 255 }
      else if (ctype === 0) { out[o] = out[o + 1] = out[o + 2] = line[x]; out[o + 3] = 255 }
      else if (ctype === 4) { out[o] = out[o + 1] = out[o + 2] = line[x * 2]; out[o + 3] = line[x * 2 + 1] }
    }
  }
  return { w, h, data: out }
}
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
function nearest(r, g, b) {
  let best = 0, bd = 1e9
  RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } })
  return PALETTE[best]
}
/** PNG → Pix (alpha ≥ 128), brut ou quantifié ; ancre au bas du dessin, au centre de sa boîte. */
export function toPix(file, quantize = false) {
  const img = readPng(file)
  const p = new Pix(img.w, img.h)
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const o = (y * img.w + x) * 4
    if (img.data[o + 3] < 128) continue
    p.px(x, y, quantize ? nearest(img.data[o], img.data[o + 1], img.data[o + 2]) : hex(img.data[o], img.data[o + 1], img.data[o + 2]))
  }
  const b = p.bounds()
  p.ax = b ? b.x + Math.floor(b.w / 2) : Math.floor(p.w / 2)
  p.ay = b ? b.y + b.h - 1 : p.h - 1
  p.colours = new Set(p.data.filter(Boolean)).size
  return p
}
const label = (p, text, x, y, c = P.white) => { let cx = x; for (const ch of text) { glyph3(ch).slice(2, 7).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(cx + i, y + j, c) }); cx += 4 } }
function pitch(w, h) {
  const g = new Pix(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.px(x, y, Math.floor(x / 40) % 2 ? P.green : '#7fd36a')
  g.rect(Math.floor(w / 2), 0, 1, h, P.white)
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = ((x + 0.5 - cx) / 60) ** 2 + ((y + 0.5 - cy) / 44) ** 2
    if (d <= 1 && d >= 0.9) g.px(x, y, P.white)
  }
  return g
}
function shadow(dst, x, y, rx, ry) {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i / rx) ** 2 + (j / ry) ** 2 <= 1) { const c = dst.get(x + i, y + j); if (c) dst.px(x + i, y + j, c === P.green ? P.greenM : P.green) }
}

const dir = process.argv[2]
const names = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
const files = names.map((n) => path.join(dir, 'Idle/rotations', n + '.png')).filter((f) => fs.existsSync(f))
const raw = files.map((f) => toPix(f, false))
const quant = files.map((f) => toPix(f, true))
const cell = 52
const sheet = new Pix(Math.max(8 * cell + 8, 640), 12 + 2 * (cell + 12) + 360 + 12)
sheet.rect(0, 0, sheet.w, sheet.h, P.slateD)
label(sheet, `PIXELLAB BRUT (${raw[0]?.colours ?? 0} COULEURS, ${raw[0]?.w}X${raw[0]?.h})`, 4, 3)
raw.forEach((p, i) => { const g = pitch(cell, cell); shadow(g, 26, 49, 11, 3); g.blit(p, 26 - p.ax, 49 - p.ay); sheet.blit(g, 4 + i * cell, 12) })
label(sheet, `QUANTIFIE ENDESGA 32 (${quant[0]?.colours ?? 0} COULEURS)`, 4, 12 + cell + 3)
quant.forEach((p, i) => { const g = pitch(cell, cell); shadow(g, 26, 49, 11, 3); g.blit(p, 26 - p.ax, 49 - p.ay); sheet.blit(g, 4 + i * cell, 24 + cell) })
// Écran 640×360 : onze Français en 4-4-2, le ballon, un carton jaune, à l'échelle 1:1.
label(sheet, 'ECRAN 640X360 A L ECHELLE 1:1, ONZE JOUEURS (BRUT)', 4, 24 + 2 * cell + 3)
const scr = pitch(640, 360)
const F = [[60, 190, 0], [160, 80, 2], [150, 160, 1], [150, 230, 3], [160, 310, 2], [300, 70, 2], [290, 150, 1], [290, 220, 0], [300, 300, 2], [440, 130, 2], [450, 240, 3]]
const order = F.map((f, i) => [f, i]).sort((a, b) => a[0][1] - b[0][1])
for (const [[x, y, r]] of order) { const p = raw[r]; shadow(scr, x, y, 12, 4); scr.blit(p, x - p.ax, y - p.ay) }
// Carton jaune au-dessus du joueur en (290,150).
scr.rect(286, 150 - 60, 8, 11, P.ink); scr.rect(287, 150 - 59, 6, 9, P.yellow); scr.rect(287, 150 - 59, 6, 1, P.white)
scr.disc(360, 200, 5, 5, P.white); scr.disc(359, 199, 3, 3, P.grey1)
sheet.blit(scr, 0, 36 + 2 * cell)
process.stdout.write(pixToPng(sheet, Number(process.argv[3] || 2), '#262b44'))
console.error('ok', raw.length, 'rotations')
