// Course PixelLab (export 02, GIF → PNG) : cycle à 12 i/s, miroir pour l'est, variantes, écran 1:1.
// node carton-plein/art/run-check.mjs > anim.gif
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToGif } from './gif.mjs'
import { toPix } from './pixellab-check.mjs'
import { recolor } from './recolor.mjs'
import { LOOKS } from './players.mjs'
import { mirrorPix } from './players.mjs'
const P = PAL
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
// Ancre commune : pieds en 47 (rangée la plus basse des images au sol), centre en 24.
const west = [0, 1, 2, 3].map((i) => { const p = toPix(`carton-plein/art/pixellab/export-02-run/west/f${i}.png`, false); p.ax = 24; p.ay = 47; return p })
const idleS = toPix('carton-plein/art/pixellab/export-01/Idle/rotations/south.png', false); idleS.ax = 24; idleS.ay = 47
const looks = LOOKS.slice(0, 11).map((l, i) => (l.bald ? { skin: l.skin, hair: i === 4 ? 'hairGrey' : 'hairRed' } : l))
function pitch(w, h) {
  const g = new Pix(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.px(x, y, Math.floor(x / 40) % 2 ? P.green : '#7fd36a')
  g.rect(Math.floor(w / 2), 0, 1, h, P.white)
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = ((x + 0.5 - cx) / 60) ** 2 + ((y + 0.5 - cy) / 44) ** 2; if (d <= 1 && d >= 0.9) g.px(x, y, P.white) }
  return g
}
const shadow = (g, x, y) => { for (let j = -3; j <= 3; j++) for (let i = -12; i <= 12; i++) if ((i / 12) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + i, y + j); if (c) g.px(x + i, y + j, c === P.green ? P.greenM : P.green) } }
// Onze Français : positions, direction (ouest ou est), look, décalage de phase.
const team = [[70, 180, 'e', 0], [160, 80, 'e', 1], [150, 160, 'w', 2], [150, 240, 'e', 3], [160, 320, 'w', 4], [300, 70, 'e', 5], [290, 150, 'w', 6], [290, 230, 'e', 7], [300, 310, 'w', 8], [440, 130, 'e', 9], [450, 250, 'w', 10]]
const frames = []
for (let f = 0; f < 8; f++) {
  const g = pitch(640, 360)
  const sorted = team.map((t, i) => [t, i]).sort((a, b) => a[0][1] - b[0][1])
  for (const [[x, y, dir, k], i] of sorted) {
    let s = recolor(west[(f + k) % 4], looks[k], { nearest })
    if (dir === 'e') s = mirrorPix(s)
    shadow(g, x, y)
    g.blit(s, x - s.ax, y - s.ay)
  }
  // Un joueur à l'arrêt pour l'échelle.
  const idle = recolor(idleS, looks[0], { nearest }); shadow(g, 560, 300); g.blit(idle, 560 - idle.ax, 300 - idle.ay)
  frames.push(g)
}
process.stdout.write(pixToGif(frames, { scale: 2, delay: 8, bg: '#63c74d' }))
