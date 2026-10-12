// KO PixelLab (export 03) : rotations quantifiées, variantes, Paraguayen, et étoiles en orbite en GIF.
// node carton-plein/art/ko-check.mjs png > planche.png | node carton-plein/art/ko-check.mjs gif > anim.gif
import path from 'node:path'
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { pixToGif } from './gif.mjs'
import { toPix } from './pixellab-check.mjs'
import { recolor } from './recolor.mjs'
import { LOOKS } from './players.mjs'
const P = PAL
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
const names = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
const dir = 'carton-plein/art/pixellab/export-03-ko/Lying_flat_on_his_ba/rotations'
// Un corps couché : l'ancre est le centre de l'image (le sprite tourne autour de lui-même).
const ko = names.map((n) => { const p = toPix(path.join(dir, n + '.png'), false); p.ax = 24; p.ay = 24; return p })
/** Étoiles en orbite autour d'un point (la tête du joueur au sol), 8 images par tour, ellipse vue de dessus. */
function stars(cx, cy, frame, count = 3) {
  const out = []
  for (let k = 0; k < count; k++) {
    const a = ((frame % 8) / 8 + k / count) * Math.PI * 2
    out.push({ x: Math.round(cx + Math.cos(a) * 12), y: Math.round(cy + Math.sin(a) * 5), front: Math.sin(a) >= 0, blink: (frame + k) % 2 })
  }
  return out
}
function drawStar(g, s) {
  const c1 = s.front ? P.yellow : P.amber, c2 = s.front ? P.amber : P.orange
  g.px(s.x, s.y, P.white); g.px(s.x - 1, s.y, c2); g.px(s.x + 1, s.y, c2); g.px(s.x, s.y - 1, c2); g.px(s.x, s.y + 1, c2)
  if (s.blink) { g.px(s.x - 2, s.y, c1); g.px(s.x + 2, s.y, c1) } else { g.px(s.x, s.y - 2, c1); g.px(s.x, s.y + 2, c1) }
}
const pitch = (w, h) => { const g = new Pix(w, h); for (let x = 0; x < w; x++) g.rect(x, 0, 1, h, Math.floor(x / 40) % 2 ? P.green : '#7fd36a'); return g }
const shadowFlat = (g, x, y, rx, ry) => { for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i / rx) ** 2 + (j / ry) ** 2 <= 1) { const c = g.get(x + i, y + j); if (c) g.px(x + i, y + j, c === P.green ? P.greenM : P.green) } }
// Position de la tête dans chaque rotation (pour les étoiles) : centre de la boîte des cheveux = couleurs de la famille cheveux.
const HAIRS = new Set(['#7e5130', '#401f1a', '#5c331d', '#552d1c', '#bf854c', '#ac743f', '#220f11', '#6a3d23', '#351817', '#764829', '#9a6639'])
const headOf = (p) => { let sx = 0, sy = 0, n = 0; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (HAIRS.has(p.get(x, y))) { sx += x; sy += y; n++ } return n ? [Math.round(sx / n), Math.round(sy / n)] : [24, 24] }

const mode = process.argv[2] || 'png'
if (mode === 'png') {
  const cell = 56
  const g = pitch(8 * cell + 8, 3 * cell + 8)
  ko.forEach((p, i) => {
    const q = recolor(p, LOOKS[0], { nearest }); const x = 4 + i * cell + 28, y = 4 + 28
    shadowFlat(g, x, y + 2, 20, 12); g.blit(q, x - q.ax, y - q.ay)
  })
  ko.forEach((p, i) => {
    const look = [LOOKS[1], LOOKS[3], LOOKS[5], LOOKS[7], LOOKS[8], LOOKS[9], LOOKS[2], LOOKS[6]][i]; const q = recolor(p, { skin: look.skin, hair: look.hair }, { nearest }); const x = 4 + i * cell + 28, y = 4 + cell + 28
    shadowFlat(g, x, y + 2, 20, 12); g.blit(q, x - q.ax, y - q.ay)
  })
  // Ligne 3 : d'autres Français avec les étoiles (le n°4 n'est jamais KO).
  ko.forEach((p, i) => {
    const look = [LOOKS[6], LOOKS[2], LOOKS[9], LOOKS[1], LOOKS[3], LOOKS[5], LOOKS[8], LOOKS[7]][i]; const q = recolor(p, { skin: look.skin, hair: look.hair }, { nearest }); const x = 4 + i * cell + 28, y = 4 + 2 * cell + 28
    shadowFlat(g, x, y + 2, 20, 12); g.blit(q, x - q.ax, y - q.ay)
    const [hx, hy] = headOf(p); for (const s of stars(x - q.ax + hx, y - q.ay + hy - 6, i)) drawStar(g, s)
  })
  process.stdout.write(pixToPng(g, Number(process.argv[3] || 3)))
} else {
  const frames = []
  for (let f = 0; f < 8; f++) {
    const g = pitch(4 * 64, 72)
    ;[2, 0, 6, 4].forEach((r, k) => {
      const p = ko[r]; const q = recolor(p, LOOKS[k * 3], { nearest })
      const x = 32 + k * 64, y = 40
      shadowFlat(g, x, y + 2, 20, 12); g.blit(q, x - q.ax, y - q.ay)
      const [hx, hy] = headOf(p)
      const st = stars(x - q.ax + hx, y - q.ay + hy - 6, f)
      for (const s of st) if (s.front) drawStar(g, s)
      for (const s of st) if (!s.front) drawStar(g, s)
    })
    frames.push(g)
  }
  process.stdout.write(pixToGif(frames, { scale: 3, delay: 12, bg: '#63c74d' }))
}
