// Tacle glissé au trait : node carton-plein/art/tackle-line.mjs > tacle.png
import { PAL } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { Canvas } from './lineart.mjs'
import { RAMP, KITS, LOOKS, grass, shadow } from './players.mjs'
const P = PAL

export function tackleLine({ kit = 'paraguay', look = 12, frame = 0 } = {}) {
  const K = KITS[kit]
  const L = LOOKS[look]
  const c = new Canvas(42, 27)
  const k = frame ? 1 : 0
  // Jambe du dessous, tendue au sol : chaussette puis crampon (la cuisse est cachée par la jambe du dessus).
  c.rect(24, 22, 8, 5, 'C')
  const b1 = c.rect(32, 22, 7, 5, 'B')
  c.add(b1, 38, 21, 1, 1, 'B') // pointe relevée
  // Hanche assise au sol.
  c.rect(12, 20, 12, 7, 'R')
  // Buste à 45° en arrière : des épaules (x 6..17, rangée 13) à la hanche.
  c.band(6, 13, 12, 1, 1, 1, 7, 'J')
  // Jambe du dessus, genou en l'air : la cuisse monte depuis la hanche, le tibia redescend, le pied se pose devant.
  c.band(22, 19 - k, 4, 3, 1, -1, 6, 'S')
  c.band(29, 14 - k, 3, 3, 1, 1, 3, 'C')
  const b2 = c.rect(33, 16, 7, 5, 'B')
  c.add(b2, 39, 15, 1, 1, 'B')
  // Bras avant planté au sol : manche courte, bras, main à plat devant la hanche.
  c.rect(16, 13, 5, 3, 'J')
  const arm = c.rect(17, 16, 4, 7, 'S')
  c.add(arm, 17, 23, 5, 4, 'S')
  // Tête de profil, grosse, posée sur les épaules et un peu en arrière : cheveux puis visage.
  const hair = c.rect(2, 0, 14, 6, 'H')
  c.add(hair, 2, 6, 4, 4, 'H')
  c.clear(2, 0, 2, 1); c.clear(14, 0, 2, 1); c.clear(2, 1); c.clear(15, 1) // coins du crâne
  const face = c.rect(6, 6, 10, 7, 'S')
  c.add(face, 16, 8, 1, 2, 'S') // nez
  c.add(face, 6, 13, 9, 1, 'S') // menton
  c.clear(15, 12); c.clear(14, 13); c.clear(6, 13)
  c.rect(12, 7, 2, 2, 'E') // œil
  c.rect(12, 7, 1, 1, 'W')
  c.rect(13, 11, 2, 1, 'M') // bouche
  const mats = { H: RAMP[L.hair], S: RAMP[L.skin], J: RAMP[K.jersey], R: RAMP[K.shorts], C: RAMP[K.socks], B: RAMP[K.boots], E: P.ink, W: P.white, M: P.redD }
  const out = c.render(mats)
  out.ax = 1 + 20
  out.ay = 1 + 27
  return out
}

if (process.argv[1] && process.argv[1].endsWith('tackle-line.mjs')) {
  const g = grass(250, 44, { lines: false })
  for (const [k, kit, look, x] of [[0, 'paraguay', 12, 42], [1, 'france', 1, 124]]) {
    const t = tackleLine({ kit, look, frame: k })
    shadow(g, x, 38, 22)
    g.blit(t, x - t.ax, 38 - t.ay)
  }
  for (const [kit, look, x] of [['france', 0, 180], ['paraguay', 12, 215]]) {
    const t = idleLine({ kit, look })
    shadow(g, x, 38, 12)
    g.blit(t, x - t.ax, 38 - t.ay)
  }
  process.stdout.write(pixToPng(g, 5))
}

/** Joueur debout de face, même méthode au trait, pour juger le style sur une pose simple. */
export function idleLine({ kit = 'france', look = 0, frame = 0 } = {}) {
  const K = KITS[kit]
  const L = LOOKS[look]
  const c = new Canvas(26, 33)
  const bob = frame ? 1 : 0
  // Jambes : cuisse en peau, chaussette, crampon.
  for (const lx of [7, 14]) {
    c.rect(lx, 21, 5, 3, 'S')
    c.rect(lx, 24, 5, 5, 'C')
    const b = c.rect(lx - 1, 29, 7, 3, 'B')
    void b
  }
  // Short, buste, bras.
  c.rect(6, 17, 14, 4, 'R')
  c.rect(6, 11 + bob, 14, 6, 'J')
  for (const ax of [2, 20]) {
    c.rect(ax, 12 + bob, 4, 5, 'J')
    c.rect(ax, 17 + bob, 4, 3, 'S')
  }
  // Tête : crâne de cheveux, visage, yeux, bouche.
  const hair = c.rect(5, 0 + bob, 16, 5, 'H')
  c.add(hair, 5, 5 + bob, 2, 4, 'H')
  c.add(hair, 19, 5 + bob, 2, 4, 'H')
  c.clear(5, 0 + bob, 2, 1); c.clear(19, 0 + bob, 2, 1); c.clear(5, 1 + bob); c.clear(20, 1 + bob)
  const face = c.rect(7, 5 + bob, 12, 8, 'S')
  c.clear(7, 12 + bob); c.clear(18, 12 + bob)
  void face
  for (const ex of [9, 14]) {
    c.rect(ex, 7 + bob, 2, 2, 'E')
    c.rect(ex, 7 + bob, 1, 1, 'W')
  }
  c.rect(12, 10 + bob, 2, 1, 'M')
  const mats = { H: RAMP[L.hair], S: RAMP[L.skin], J: RAMP[K.jersey], R: RAMP[K.shorts], C: RAMP[K.socks], B: RAMP[K.boots], E: P.ink, W: P.white, M: P.redD }
  const out = c.render(mats)
  out.ax = 1 + 13
  out.ay = 1 + 32
  return out
}
