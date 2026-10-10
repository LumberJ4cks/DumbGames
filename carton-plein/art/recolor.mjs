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

const HAIR = ['#7e5130', '#401f1a', '#5c331d', '#552d1c', '#bf854c', '#ac743f', '#220f11', '#6a3d23', '#351817', '#764829', '#9a6639']
const SKIN = ['#fbc69a', '#db8b67', '#c26c4f', '#e2956d', '#ca7757', '#eba275', '#b96247', '#ac704c', '#88432b', '#964d32', '#ae583e', '#733423', '#c37c57', '#d3946a', '#b77d55', '#f2b68a', '#a94930']
const lum = (c) => 0.299 * parseInt(c.slice(1, 3), 16) + 0.587 * parseInt(c.slice(3, 5), 16) + 0.114 * parseInt(c.slice(5, 7), 16)
/** Table couleur brute → ton de la rampe cible, par luminance relative dans la famille. */
function table(family, ramp) {
  const ls = family.map(lum)
  const lo = Math.min(...ls), hi = Math.max(...ls)
  const t = {}
  family.forEach((c, i) => { t[c] = ramp[Math.round(((ls[i] - lo) / (hi - lo)) * (ramp.length - 1))] })
  return t
}
/** Recolore un Pix brut : peau et cheveux vers les rampes du look, le reste quantifié Endesga. */
export function recolor(raw, look, { nearest }) {
  const th = table(HAIR, RAMP[look.hair])
  const ts = table(SKIN, RAMP[look.skin])
  const q = new Pix(raw.w, raw.h)
  q.ax = raw.ax; q.ay = raw.ay
  for (let i = 0; i < raw.data.length; i++) {
    const c = raw.data[i]
    if (!c) continue
    q.data[i] = look.bald && th[c] ? ts[SKIN[0]] : th[c] || ts[c] || nearest(c)
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
