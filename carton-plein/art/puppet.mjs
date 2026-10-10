// Animation « pantin » d'un sprite PixelLab statique : découpe en tête / buste / jambes, puis
// déplacement des morceaux image par image. node carton-plein/art/puppet.mjs <export> > anim.gif
import path from 'node:path'
import { Pix, PAL } from '../../cons-de-mime/pixel.js'
import { pixToGif } from './gif.mjs'
import { toPix } from './pixellab-check.mjs'
const P = PAL

/** Découpe par rangées : la tête (jusqu'au bas du visage), le buste (jusqu'au bas du short), les deux jambes (gauche / droite de l'axe). */
function slice(p, headEnd, torsoEnd) {
  const part = (y0, y1, x0 = 0, x1 = p.w) => {
    const q = new Pix(p.w, p.h)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) q.px(x, y, p.get(x, y))
    q.ax = p.ax; q.ay = p.ay
    return q
  }
  return { head: part(0, headEnd), torso: part(headEnd, torsoEnd), legL: part(torsoEnd, p.h, 0, p.ax), legR: part(torsoEnd, p.h, p.ax, p.w) }
}
const blit = (dst, src, dx, dy) => { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.data[y * src.w + x]; if (c) dst.px(x + dx, y + dy, c) } }

/**
 * Course : le corps penche vers l'avant (`lean` px), la tête rebondit, chaque jambe monte et
 * descend en opposition. Pour une vue de côté, la jambe qui recule est décalée en arrière.
 */
/** Raccourcit une jambe de `k` rangées en retirant des rangées au milieu (le genou plie), le pied remonte sans se détacher. */
function shorten(leg, k, y0) {
  if (k <= 0) return leg
  const b = leg.bounds()
  if (!b) return leg
  const q = new Pix(leg.w, leg.h)
  q.ax = leg.ax; q.ay = leg.ay
  const mid = Math.floor(b.y + b.h * 0.45)
  let drop = 0
  for (let y = b.y; y < b.y + b.h; y++) {
    if (y >= mid && drop < k) { drop++; continue }
    for (let x = 0; x < leg.w; x++) { const c = leg.get(x, y); if (c) q.px(x, y - (y >= mid ? drop : 0), c) }
  }
  void y0
  return q
}
/**
 * Course : le corps penche vers l'avant (`lean` px), la tête rebondit, chaque jambe plie et se
 * tend en opposition. En vue de côté, la jambe qui recule est décalée vers l'arrière.
 */
export function runFrames(p, { frames = 6, lean = 1, bounce = 1, stride = 3, side = 0, headEnd, torsoEnd }) {
  const S = slice(p, headEnd, torsoEnd)
  const out = []
  for (let i = 0; i < frames; i++) {
    const t = (i / frames) * Math.PI * 2
    const f = new Pix(p.w + 8, p.h + 4)
    const ox = 4
    const l = Math.round(Math.sin(t) * stride)
    const r = -l
    const bob = Math.abs(Math.sin(t)) > 0.7 ? -bounce : 0
    blit(f, shorten(S.legL, Math.max(0, l)), ox + side * Math.max(0, -l), 0)
    blit(f, shorten(S.legR, Math.max(0, r)), ox + side * Math.max(0, -r), 0)
    blit(f, S.torso, ox + lean, 0)
    blit(f, S.head, ox + lean * 2, 0) // la tête posée, puis remontée par-dessus : pas de trou au cou
    if (bob) blit(f, S.head, ox + lean * 2, bob)
    f.ax = p.ax + ox; f.ay = p.ay
    out.push(f)
  }
  return out
}
export function idleFrames(p, { headEnd, torsoEnd }) {
  const S = slice(p, headEnd, torsoEnd)
  return [0, 1].map((k) => {
    const f = new Pix(p.w, p.h)
    blit(f, S.legL, 0, 0); blit(f, S.legR, 0, 0); blit(f, S.torso, 0, 0); blit(f, S.head, 0, 0); if (k) blit(f, S.head, 0, -k)
    f.ax = p.ax; f.ay = p.ay
    return f
  })
}

if (process.argv[1] && process.argv[1].endsWith('puppet.mjs')) {
  const dir = process.argv[2]
  const load = (n) => toPix(path.join(dir, 'Idle/rotations', n + '.png'), true)
  // Repères trouvés sur l'export 01 : visage jusqu'à la rangée 27, short jusqu'à la rangée 38 (sur 48).
  const cut = { headEnd: 28, torsoEnd: 40 }
  const south = load('south'), east = load('east'), north = load('north'), west = load('west')
  const anims = [idleFrames(south, cut), runFrames(south, { ...cut, lean: 0 }), runFrames(east, { ...cut, side: 1 }), runFrames(north, { ...cut, lean: 0 }), runFrames(west, { ...cut, side: -1, lean: -1 })]
  const frames = []
  for (let i = 0; i < 12; i++) {
    const g = new Pix(5 * 64, 72)
    for (let x = 0; x < g.w; x++) g.rect(x, 0, 1, g.h, Math.floor(x / 32) % 2 ? P.green : '#7fd36a')
    anims.forEach((a, k) => {
      const fr = a[i % a.length]
      const x = 32 + k * 64, y = 62
      for (let j = -3; j <= 3; j++) for (let ii = -12; ii <= 12; ii++) if ((ii / 12) ** 2 + (j / 3) ** 2 <= 1) { const c = g.get(x + ii, y + j); if (c) g.px(x + ii, y + j, c === P.green ? P.greenM : P.green) }
      g.blit(fr, x - fr.ax, y - fr.ay)
    })
    frames.push(g)
  }
  process.stdout.write(pixToGif(frames, { scale: 3, delay: 10, bg: '#63c74d' }))
}
