// Variantes de peau et de cheveux par substitution de palette sur un sprite PixelLab.
// Les couleurs brutes du personnage sont triées en deux familles (relevées sur l'export 01),
// chaque famille est remplacée par une rampe Endesga de 4 tons selon la luminance relative.
// node carton-plein/art/recolor.mjs <export> > planche.png
import path from 'node:path'
import { Pix, PAL } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { toPix } from './pixellab-check.mjs'
import { RAMP, LOOKS } from './players.mjs'
const P = PAL

const BLUE = ['#3e649a', '#1e3263', '#2d497b', '#294171', '#1b2852', '#4f78ae', '#626f8b', '#4d5a73', '#79899d', '#87b0e5', '#98bce3']
const WHITE = ['#f3f5f4', '#e2eaed', '#a0acc0', '#b3c0d1', '#8f9ab0', '#8190ac', '#b0cef1']
const RED = ['#731426', '#9f1d26', '#8e1926', '#801627', '#d83728', '#c32c26', '#d51f25', '#9e3431', '#691b1f', '#6e2b25', '#5b2a21']
const HAIR = ['#7e5130', '#401f1a', '#5c331d', '#552d1c', '#bf854c', '#ac743f', '#220f11', '#6a3d23', '#351817', '#764829', '#9a6639']
const SKIN = ['#fbc69a', '#db8b67', '#c26c4f', '#e2956d', '#ca7757', '#eba275', '#b96247', '#ac704c', '#88432b', '#964d32', '#ae583e', '#733423', '#c37c57', '#d3946a', '#b77d55', '#f2b68a', '#a94930']
export const FAMILIES = { hair: HAIR, skin: SKIN, blue: BLUE, white: WHITE, red: RED }
const lum = (c) => 0.299 * parseInt(c.slice(1, 3), 16) + 0.587 * parseInt(c.slice(3, 5), 16) + 0.114 * parseInt(c.slice(5, 7), 16)
/** Table couleur brute → ton de la rampe cible, par luminance relative dans la famille. */
function table(family, ramp) {
  const ls = family.map(lum)
  const lo = Math.min(...ls), hi = Math.max(...ls)
  const t = {}
  family.forEach((c, i) => { t[c] = ramp[Math.round(((ls[i] - lo) / (hi - lo)) * (ramp.length - 1))] })
  return t
}
const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const dist = (a, b) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b); return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2 }
/**
 * Famille d'une couleur brute : exacte si elle est dans une liste, sinon celle de la couleur
 * connue la plus proche (PixelLab redessine chaque export avec des teintes voisines), ou null si
 * trop loin (encre, inconnu).
 */
export function classify(c, families) {
  let best = null, bd = 40 * 40
  for (const [name, list] of Object.entries(families)) {
    if (list.includes(c)) return name
    for (const k of list) { const d = dist(c, k); if (d < bd) { bd = d; best = name } }
  }
  return best
}
/** Ton cible pour une couleur brute d'une famille : luminance relative dans la plage connue de la famille. */
function tone(c, family, ramp) {
  const ls = family.map(lum)
  const lo = Math.min(...ls), hi = Math.max(...ls)
  const t = Math.max(0, Math.min(1, (lum(c) - lo) / (hi - lo)))
  return ramp[Math.round(t * (ramp.length - 1))]
}
/** Recolore un Pix brut : peau et cheveux vers les rampes du look, le reste quantifié Endesga. */
export function recolor(raw, look, { nearest }) {
  const fam = { hair: HAIR, skin: SKIN, blue: BLUE, white: WHITE, red: RED } // toutes les familles, pour que les crampons rouges ne soient pas pris pour des cheveux
  const cache = new Map()
  const q = new Pix(raw.w, raw.h)
  q.ax = raw.ax; q.ay = raw.ay
  for (let i = 0; i < raw.data.length; i++) {
    const c = raw.data[i]
    if (!c) continue
    if (!cache.has(c)) {
      const k = classify(c, fam)
      cache.set(c, k === 'hair' ? tone(c, HAIR, RAMP[look.bald ? look.skin : look.hair]) : k === 'skin' ? tone(c, SKIN, RAMP[look.skin]) : nearest(c))
    }
    q.data[i] = cache.get(c)
  }
  return q
}

if (process.argv[1] && process.argv[1].endsWith('recolor.mjs')) {
  const dir = process.argv[2]
  const { PALETTE } = await import('../../cons-de-mime/pixel.js')
  const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
  const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
  const south = toPix(path.join(dir, 'Idle/rotations/south.png'), false)
  const east = toPix(path.join(dir, 'Idle/rotations/east.png'), false)
  // Onze combinaisons peau × cheveux (pas de chauve : le crâne est sous les cheveux du dessin).
  const looks = LOOKS.slice(0, 11).map((l, i) => (l.bald ? { skin: l.skin, hair: i === 4 ? 'hairGrey' : 'hairRed' } : l))
  const g = new Pix(16 + looks.length * 52, 2 * 60)
  for (let x = 0; x < g.w; x++) g.rect(x, 0, 1, g.h, Math.floor(x / 40) % 2 ? P.green : '#7fd36a')
  looks.forEach((look, i) => {
    for (const [src, row] of [[south, 0], [east, 1]]) {
      const s = recolor(src, look, { nearest })
      const x = 32 + i * 52, y = 54 + row * 60
      for (let j = -3; j <= 3; j++) for (let ii = -12; ii <= 12; ii++) if ((ii / 12) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + ii, y + j); if (c) g.px(x + ii, y + j, c === P.green ? P.greenM : P.green) }
      g.blit(s, x - s.ax, y - s.ay)
    }
  })
  process.stdout.write(pixToPng(g, Number(process.argv[3] || 3)))
  // Couleurs non classées (ni peau, ni cheveux, ni encre) sur les deux vues : à surveiller.
  const unknown = new Set()
  for (const src of [south, east]) for (const c of src.data) if (c && !HAIR.includes(c) && !SKIN.includes(c)) unknown.add(c)
  console.error('couleurs hors familles :', [...unknown].join(' '))
}

/* ---------- le Paraguayen n°4, dérivé du Français ---------- */
/**
 * Maillot rouge à rayures blanches verticales (3 px), short et chaussettes bleu clair, crampons
 * blancs, bandeau rouge sur le front, barbe noire. `headEnd` : dernière rangée de la tête,
 * `shortsEnd` : dernière rangée du short ; au-dessous, ce qui est blanc est chaussette.
 */
export function paraguay(raw, { nearest, look = { skin: 'skinTan', hair: 'hairBlack' } }) {
  const fam = { hair: HAIR, skin: SKIN, blue: BLUE, white: WHITE, red: RED }
  const kind = new Map()
  const k = (c) => { if (!kind.has(c)) kind.set(c, classify(c, fam)); return kind.get(c) }
  const base = recolor(raw, look, { nearest })
  const q = base.clone()
  // Repères calculés sur l'image : le maillot (bleus) borne la tête au-dessus et le short au-dessous.
  let jerseyTop = raw.h, jerseyBottom = -1
  for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) if (raw.get(x, y) && k(raw.get(x, y)) === 'blue') { jerseyTop = Math.min(jerseyTop, y); jerseyBottom = Math.max(jerseyBottom, y) }
  let faceTop = -1, chin = -1, hx0 = raw.w, hx1 = -1
  for (let y = 0; y <= jerseyTop; y++) for (let x = 0; x < raw.w; x++) {
    const c = raw.get(x, y)
    if (!c) continue
    const f = k(c)
    if (f === 'skin') { if (faceTop < 0) faceTop = y; chin = y }
    if (f === 'hair' || f === 'skin') { hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x) }
  }
  for (let y = 0; y < raw.h; y++)
    for (let x = 0; x < raw.w; x++) {
      const c = raw.get(x, y)
      if (!c) continue
      const f = k(c)
      if (f === 'blue') q.px(x, y, Math.floor((x - raw.ax + 30) / 3) % 2 ? tone(c, BLUE, RAMP.white) : tone(c, BLUE, RAMP.red))
      else if (f === 'white' && y > jerseyTop + 2) q.px(x, y, tone(c, WHITE, RAMP.blueLight)) // short et chaussettes (les yeux sont au-dessus du maillot)
      else if (f === 'red' && y > jerseyBottom) q.px(x, y, tone(c, RED, RAMP.white)) // crampons blancs
      // Bandeau : deux rangées sur le front, sur toute la largeur de la tête.
      if (y >= faceTop && y <= faceTop + 1 && x >= hx0 && x <= hx1 && (f === 'hair' || f === 'skin')) q.px(x, y, lum(c) > 120 ? P.red : P.redD)
      // Barbe : la peau des quatre dernières rangées du visage, sauf la bouche.
      if (f === 'skin' && y >= chin - 3 && y <= chin && y <= jerseyTop && !(Math.abs(x - raw.ax) <= 1 && y >= chin - 3 && y <= chin - 2)) q.px(x, y, lum(c) > 190 ? P.slate : P.slateD)
    }
  return q
}
