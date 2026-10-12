// Test de coupes sur un sprite PixelLab : classique (tel quel), boule à zéro (érosion du masque
// de cheveux en crâne, rempli de peau), afro (dilatation en boule, remplie de cheveux sombres).
// node carton-plein/art/hair.mjs > planche.png
import path from 'node:path'
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { toPix } from './pixellab-check.mjs'
import { recolor, classify, FAMILIES } from './recolor.mjs'
import { RAMP, LOOKS } from './players.mjs'
const P = PAL
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }

const mask = (w, h) => Array.from({ length: h }, () => new Array(w).fill(false))
const morph = (m, r, dilate) => {
  const h = m.length, w = m[0].length
  const out = mask(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let hit = dilate ? false : true
    for (let j = -r; j <= r && (dilate ? !hit : hit); j++) for (let i = -r; i <= r; i++) {
      if (i * i + j * j > r * r + r) continue
      const v = m[y + j]?.[x + i] ?? false
      if (dilate && v) { hit = true; break }
      if (!dilate && !v) { hit = false; break }
    }
    out[y][x] = hit
  }
  return out
}
/** Masques du sprite brut : cheveux, contour des cheveux (encre collée aux cheveux), corps (tout le reste). */
function masks(raw) {
  const w = raw.w, h = raw.h
  const hair = mask(w, h), ink = mask(w, h), body = mask(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = raw.get(x, y)
    if (!c) continue
    const f = classify(c, FAMILIES)
    if (f === 'hair') hair[y][x] = true
    else if (c === '#000000' || c === '#010002' || c === '#040000' || c === '#0d090a') ink[y][x] = true
    else body[y][x] = true
  }
  // Encre des cheveux : encre dont un voisin est cheveu et aucun voisin n'est corps.
  const hairInk = mask(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!ink[y][x]) continue
    let nh = false, nb = false
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (hair[y + j]?.[x + i]) nh = true; if (body[y + j]?.[x + i]) nb = true }
    if (nh && !nb) hairInk[y][x] = true
  }
  return { hair, ink, body, hairInk }
}
const outlineAround = (p, solid) => {
  const w = p.w, h = p.h
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid[y][x]) continue
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + j, xx = x + i; if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue; if (!p.get(xx, yy)) p.px(xx, yy, P.ink) }
  }
}

/** Boule à zéro : le crâne est le masque cheveux+contour érodé de `r`, rempli de peau ombrée. */
export function shaved(raw, look, r = 3) {
  const { hair, hairInk } = masks(raw)
  const base = recolor(raw, look, { nearest })
  const q = new Pix(raw.w, raw.h); q.ax = raw.ax; q.ay = raw.ay
  const skin = RAMP[look.skin]
  const full = hair.map((row, y) => row.map((v, x) => v || hairInk[y][x]))
  const skull = morph(morph(morph(full, r, false), r, true), 1, false) // ouverture : la masse sans les mèches
  const core = morph(skull, 2, false)
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
    if (full[y][x]) { if (skull[y][x]) q.px(x, y, core[y][x] ? skin[2] : skin[1]) }
    else if (base.get(x, y)) q.px(x, y, base.get(x, y))
  }
  // Encre orpheline (ancien contour des mèches) : on retire toute encre qui ne touche plus rien de plein.
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
    if (q.get(x, y) !== P.ink && q.get(x, y) !== '#000000') continue
    let touch = false
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = q.get(x + i, y + j); if (c && c !== P.ink && c !== '#000000') touch = true }
    if (!touch) q.data[y * q.w + x] = null
  }
  // Reflet sur le crâne, en haut à gauche du cœur.
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) if (core[y][x] && !core[y - 1]?.[x] && !core[y]?.[x - 1]) q.px(x, y, skin[3])
  const solid = q.data.map(Boolean)
  const solidM = mask(raw.w, raw.h); for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) solidM[y][x] = solid[y * raw.w + x]
  outlineAround(q, solidM)
  return q
}
/** Afro : boule = masque cheveux dilaté de `r`, sans recouvrir le corps ; remplie de cheveux sombres avec un grain. */
export function afro(raw, look, r = 3) {
  const { hair, hairInk, body } = masks(raw)
  const base = recolor(raw, look, { nearest })
  const q = new Pix(raw.w, raw.h); q.ax = raw.ax; q.ay = raw.ay
  const hr = RAMP[look.hair]
  const full = hair.map((row, y) => row.map((v, x) => v || hairInk[y][x]))
  const ball = morph(morph(full, r + 2, true), 2, false) // fermeture : une boule ronde
  const inner = morph(ball, 2, false)
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
    if (body[y][x]) { q.px(x, y, base.get(x, y)); continue }
    if (ball[y][x]) {
      const hsh = (((x * 374761393 + y * 668265263) ^ (x * y * 2246822519)) >>> 0) % 7
      q.px(x, y, inner[y][x] ? (hsh === 0 ? hr[2] : hr[1]) : hr[0])
    } else if (base.get(x, y) && !full[y][x]) q.px(x, y, base.get(x, y))
  }
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
    if (q.get(x, y) !== P.ink && q.get(x, y) !== '#000000') continue
    let touch = false
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = q.get(x + i, y + j); if (c && c !== P.ink && c !== '#000000') touch = true }
    if (!touch) q.data[y * q.w + x] = null
  }
  const solidM = mask(raw.w, raw.h); for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) solidM[y][x] = !!q.get(x, y)
  outlineAround(q, solidM)
  return q
}

if (process.argv[1] && process.argv[1].endsWith('hair.mjs')) {
  const dir = 'carton-plein/art/pixellab/export-01/Idle/rotations'
  const views = ['south', 'east', 'north'].map((n) => toPix(path.join(dir, n + '.png'), false))
  const cuts = [['CLASSIQUE', (p, l) => recolor(p, l, { nearest })], ['BOULE A ZERO', shaved], ['AFRO', afro]]
  const looks = [LOOKS[0], LOOKS[1], LOOKS[3]]
  const cell = 56
  const g = new Pix(8 + 9 * cell, 8 + 3 * cell)
  for (let x = 0; x < g.w; x++) g.rect(x, 0, 1, g.h, Math.floor(x / 40) % 2 ? P.green : '#7fd36a')
  const sh = (x, y) => { for (let j = -3; j <= 3; j++) for (let i = -12; i <= 12; i++) if ((i / 12) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + i, y + j); if (c) g.px(x + i, y + j, c === P.green ? P.greenM : P.green) } }
  looks.forEach((look, r) => cuts.forEach(([, fn], c) => views.forEach((p, v) => {
    const s = fn(p, look)
    const x = 4 + (c * 3 + v) * cell + 28, y = 4 + r * cell + 52
    sh(x, y); g.blit(s, x - s.ax, y - s.ay)
  })))
  process.stdout.write(pixToPng(g, Number(process.argv[2] || 3)))
}
