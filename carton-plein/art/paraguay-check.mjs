// Le n°4 dérivé du Français : idle 8 rotations + course, à côté du Français. node ... > planche.png
import path from 'node:path'
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { toPix } from './pixellab-check.mjs'
import { recolor, paraguay } from './recolor.mjs'
import { LOOKS, mirrorPix } from './players.mjs'
const P = PAL
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
const names = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
const idle = names.map((n) => toPix(path.join('carton-plein/art/pixellab/export-01/Idle/rotations', n + '.png'), false))
const run = [0, 1, 2, 3].map((i) => { const p = toPix(`carton-plein/art/pixellab/export-02-run/west/f${i}.png`, false); p.ax = 24; p.ay = 47; return p })
const cell = 52
const g = new Pix(8 * cell + 8, 3 * (cell + 4) + 8)
for (let x = 0; x < g.w; x++) g.rect(x, 0, 1, g.h, Math.floor(x / 40) % 2 ? P.green : '#7fd36a')
const sh = (x, y) => { for (let j = -3; j <= 3; j++) for (let i = -12; i <= 12; i++) if ((i / 12) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + i, y + j); if (c) g.px(x + i, y + j, c === P.green ? P.greenM : P.green) } }
idle.forEach((p, i) => { const s = paraguay(p, { nearest }); const x = 4 + i * cell + 26, y = 50; sh(x, y); g.blit(s, x - s.ax, y - s.ay) })
run.forEach((p, i) => { const s = paraguay(p, { nearest }); const x = 4 + i * cell + 26, y = 50 + cell + 4; sh(x, y); g.blit(s, x - s.ax, y - s.ay); const m = mirrorPix(s); const x2 = 4 + (i + 4) * cell + 26; sh(x2, y); g.blit(m, x2 - m.ax, y - m.ay) })
// Ligne 3 : le Français d'origine à côté, pour comparer.
idle.slice(0, 4).forEach((p, i) => { const s = recolor(p, LOOKS[0], { nearest }); const x = 4 + i * cell + 26, y = 50 + 2 * (cell + 4); sh(x, y); g.blit(s, x - s.ax, y - s.ay) })
run.forEach((p, i) => { const s = recolor(p, LOOKS[0], { nearest }); const x = 4 + (i + 4) * cell + 26, y = 50 + 2 * (cell + 4); sh(x, y); g.blit(s, x - s.ax, y - s.ay) })
process.stdout.write(pixToPng(g, Number(process.argv[2] || 3)))
