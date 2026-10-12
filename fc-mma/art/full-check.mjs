// Export PixelLab 05 (complet) : planche des animations et poses, et GIF. node carton-plein/art/full-check.mjs png|gif
import fs from 'node:fs'
import path from 'node:path'
import { Pix, PAL, PALETTE } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { pixToGif } from './gif.mjs'
import { toPix } from './pixellab-check.mjs'
import { recolor } from './recolor.mjs'
import { LOOKS } from './players.mjs'
import { glyph3 } from '../../cons-de-mime/font.js'
const P = PAL
const RGB = PALETTE.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)])
const nearest = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let best = 0, bd = 1e9; RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11; if (d < bd) { bd = d; best = i } }); return PALETTE[best] }
const ROOT = 'carton-plein/art/pixellab/export-05-full'
const load = (f) => { const p = toPix(f, false); p.ax = 24; p.ay = 46; return p }
export const anim = (name, dir) => { const d = path.join(ROOT, 'Idle/animations', name, dir); return fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort().map((f) => load(path.join(d, f))) }
export const pose = (folder, dir) => load(path.join(ROOT, folder, 'rotations', dir + '.png'))
const label = (p, text, x, y) => { let cx = x; for (const ch of text) { glyph3(ch).slice(2, 7).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(cx + i, y + j, P.white) }); cx += 4 } }
const pitch = (w, h) => { const g = new Pix(w, h); for (let x = 0; x < w; x++) g.rect(x, 0, 1, h, Math.floor(x / 40) % 2 ? P.green : '#7fd36a'); return g }
const sh = (g, x, y, rx = 12) => { for (let j = -3; j <= 3; j++) for (let i = -rx; i <= rx; i++) if ((i / rx) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + i, y + j); if (c) g.px(x + i, y + j, c === P.green ? P.greenM : P.green) } }
const Q = (p, look = LOOKS[0]) => recolor(p, look, { nearest })

const mode = process.argv[2] || 'png'
if (mode === 'png') {
  const rows = [
    ['RUNNING S / E / N / W', ['south', 'east', 'north', 'west'].flatMap((d) => anim('Running', d))],
    ['WALKING S / E', ['south', 'east'].flatMap((d) => anim('Walking', d))],
    ['FIGHT STANCE E', anim('Fight_Stance_Idle', 'east')],
    ['THROW OBJECT E', anim('Throw_Object', 'east')],
    ['TAKING PUNCH W', anim('Taking_Punch', 'west')],
    ['FALLING BACK W', anim('Falling_Back_Death', 'west')],
    ['POSES E : PUNCH KNEE KICK FLYKICK HEADER DIVHEAD THROW KNOCKED GK', ['Straight_punch_pose', 'Rising_knee_strike_p', 'High_front_kick_pose', 'Flying_kick_pose_fr', 'Standing_header_pose', 'Diving_header_pose', 'Throwing_pose_froze', 'Knocked_back_pose_f', 'Goalkeeper_diving_sa'].map((f) => pose(f, 'east'))],
  ]
  const cell = 50
  const W = 8 + 16 * cell
  const g = pitch(W, rows.length * (cell + 10) + 8)
  rows.forEach(([name, frames], r) => {
    const y0 = 4 + r * (cell + 10)
    label(g, name, 4, y0)
    frames.forEach((p, i) => { const q = Q(p); const x = 4 + i * cell + 25, y = y0 + 8 + 46; sh(g, x, y); g.blit(q, x - q.ax, y - q.ay) })
  })
  process.stdout.write(pixToPng(g, Number(process.argv[3] || 2)))
} else {
  const sets = [anim('Running', 'south'), anim('Running', 'north'), anim('Running', 'east'), anim('Throw_Object', 'east'), anim('Taking_Punch', 'west'), anim('Falling_Back_Death', 'west'), anim('Fight_Stance_Idle', 'east')].map((a) => a.map((p) => Q(p)))
  const frames = []
  for (let f = 0; f < 28; f++) {
    const g = pitch(sets.length * 60 + 10, 70)
    sets.forEach((a, k) => { const q = a[f % a.length]; const x = 35 + k * 60, y = 60; sh(g, x, y); g.blit(q, x - q.ax, y - q.ay) })
    frames.push(g)
  }
  process.stdout.write(pixToGif(frames, { scale: 3, delay: 8, bg: '#63c74d' }))
}
