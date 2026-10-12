// Tacle PixelLab (export 04) : est et ouest, variantes, Paraguayen, mottes et poussière derrière.
import path from 'node:path'
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { toPix } from './pixellab-check.mjs'
import { recolor, paraguay } from './recolor.mjs'
import { LOOKS } from './players.mjs'
const P = PAL
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
const dir = 'carton-plein/art/pixellab/export-04-tacle/Slide_tackle_pose_f/rotations'
const names = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
const tk = names.map((n) => { const p = toPix(path.join(dir, n + '.png'), false); p.ax = 24; p.ay = 46; return p })
const cell = 56
const g = new Pix(8 + 8 * cell, 8 + 2 * cell)
for (let x = 0; x < g.w; x++) g.rect(x, 0, 1, g.h, Math.floor(x / 40) % 2 ? P.green : '#7fd36a')
const sh = (x, y, rx) => { for (let j = -3; j <= 3; j++) for (let i = -rx; i <= rx; i++) if ((i / rx) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + i, y + j); if (c) g.px(x + i, y + j, c === P.green ? P.greenM : P.green) } }
const dust = (x, y, dir) => { for (const [dx, dy, c] of [[-14, -2, P.sand], [-17, -1, P.clay], [-20, -4, P.sand], [-23, -2, P.grey1], [-12, 1, P.clay], [-26, -5, P.grey1]]) { g.rect(x + dx * dir - 1, y + dy, 3, 1, c); g.rect(x + dx * dir, y + dy + 1, 2, 1, c) } }
// Ligne 1 : les huit rotations, Français quantifié.
tk.forEach((p, i) => { const q = recolor(p, LOOKS[0], { nearest }); const x = 4 + i * cell + 28, y = 4 + 50; sh(x, y, 20); g.blit(q, x - q.ax, y - q.ay) })
// Ligne 2 : est et ouest en situation : n°4 avec poussière, puis trois Français variés.
;[[2, 1], [6, -1]].forEach(([r, d], k) => { const q = paraguay(tk[r], { nearest }); const x = 4 + k * cell + 28, y = 4 + cell + 50; sh(x, y, 20); dust(x, y - 4, d); g.blit(q, x - q.ax, y - q.ay) })
;[1, 3, 5, 7, 8, 9].forEach((l, k) => { const q = recolor(tk[k % 2 ? 6 : 2], LOOKS[l], { nearest }); const x = 4 + (k + 2) * cell + 28, y = 4 + cell + 50; sh(x, y, 20); g.blit(q, x - q.ax, y - q.ay) })
process.stdout.write(pixToPng(g, Number(process.argv[2] || 3)))
