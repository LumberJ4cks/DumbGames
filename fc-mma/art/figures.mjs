// Joueurs au trait, debout : face, profil (regard à droite), dos.
// node carton-plein/art/figures.mjs > planche.png
import { PAL } from '../../cons-de-mime/pixel.js'
import { glyph3 } from '../../cons-de-mime/font.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { Canvas } from './lineart.mjs'
import { RAMP, KITS, LOOKS, grass, shadow } from './players.mjs'
const P = PAL

/**
 * Gabarit 26 × 32, pieds en bas. Tête 16 de large sur 14 de haut (45 %), épaules larges, bras
 * courts et épais à manches courtes, short, cuisses nues, chaussettes, crampons.
 */
export function figure({ kit = 'france', look = 0, view = 'face', number = null } = {}) {
  const K = KITS[kit]
  const L = LOOKS[look]
  const c = new Canvas(26, 32)
  const mats = { H: RAMP[L.hair], S: RAMP[L.skin], J: RAMP[K.jersey], R: RAMP[K.shorts], C: RAMP[K.socks], B: RAMP[K.boots] }
  const hair = RAMP[L.hair]
  const skin = RAMP[L.skin]

  if (view === 'profil') {
    // Jambe arrière puis jambe avant, crampons pointe à droite.
    for (const [lx, bx] of [[6, 5], [12, 11]]) {
      c.rect(lx, 24, 5, 3, 'S')
      c.rect(lx, 27, 5, 3, 'C')
      c.rect(bx, 30, 8, 2, 'B')
    }
    c.rect(7, 20, 10, 4, 'R')
    c.rect(7, 13, 10, 7, 'J')
    // Bras avant, devant le buste.
    c.rect(11, 13, 4, 4, 'J')
    c.rect(11, 17, 4, 3, 'S')
    // Tête : crâne et nuque en cheveux, visage à droite, nez, oreille.
    const h = c.rect(5, 0, 14, 6, 'H')
    c.add(h, 5, 6, 5, 7, 'H')
    c.add(h, 10, 6, 2, 1, 'H') // frange
    c.clear(5, 0, 2, 1); c.clear(17, 0, 2, 1); c.clear(5, 1); c.clear(18, 1)
    const f = c.rect(10, 6, 9, 8, 'S')
    c.add(f, 19, 8, 1, 2, 'S') // nez
    c.add(f, 12, 6, 7, 1, 'S')
    c.clear(18, 13); c.clear(10, 13)
    c.dot(15, 8, P.ink); c.dot(16, 8, P.ink) // œil
    c.dot(15, 7, hair[1]); c.dot(16, 7, hair[1]) // sourcil
    c.dot(17, 11, P.redD) // bouche
    if (L.band) for (let x = 6; x <= 18; x++) c.dot(x, 5, P.red)
    if (L.beard) for (let x = 13; x <= 18; x++) for (let y = 11; y <= 12; y++) if (!(x === 17 && y === 11)) c.dot(x, y, hair[1])
  } else {
    const back = view === 'dos'
    // Jambes.
    for (const lx of [7, 14]) {
      c.rect(lx, 24, 5, 3, 'S')
      c.rect(lx, 27, 5, 3, 'C')
      c.rect(lx - 1, 30, 7, 2, 'B')
    }
    c.rect(6, 20, 14, 4, 'R')
    c.rect(6, 13, 14, 7, 'J')
    for (const ax of [2, 20]) {
      c.rect(ax, 13, 4, 4, 'J')
      c.rect(ax, 17, 4, 3, 'S')
    }
    // Tête.
    const h = c.rect(5, 0, 16, back ? 11 : 6, 'H')
    c.clear(5, 0, 2, 1); c.clear(19, 0, 2, 1); c.clear(5, 1); c.clear(20, 1)
    if (back) {
      c.clear(5, 10); c.clear(20, 10)
      c.rect(10, 11, 6, 3, 'S') // nuque
    } else {
      c.add(h, 5, 6, 2, 4, 'H') // pattes
      c.add(h, 19, 6, 2, 4, 'H')
      for (const x of [8, 11, 14, 17]) c.add(h, x, 6, 1, 1, 'H') // frange
      const f = c.rect(7, 6, 12, 8, 'S')
      void f
      c.clear(7, 13); c.clear(18, 13)
      for (const ex of [9, 14]) {
        c.dot(ex, 8, P.ink); c.dot(ex + 1, 8, P.ink)
        c.dot(ex, 9, P.ink); c.dot(ex + 1, 9, P.white) // reflet en bas à droite
        c.dot(ex, 7, hair[1]); c.dot(ex + 1, 7, hair[1]) // sourcil
      }
      c.dot(12, 11, P.redD); c.dot(13, 11, P.redD)
      if (L.band) for (let x = 6; x <= 19; x++) c.dot(x, 5, P.red)
      if (L.beard) for (let x = 8; x <= 17; x++) for (let y = 11; y <= 12; y++) if (!(y === 11 && (x === 12 || x === 13))) c.dot(x, y, hair[1])
    }
    if (L.bald && !back) for (let x = 7; x <= 18; x++) for (let y = 1; y <= 5; y++) c.dot(x, y, skin[1])
    if (L.bald && back) for (let x = 7; x <= 18; x++) for (let y = 1; y <= 9; y++) c.dot(x, y, skin[1])
    // Rayures Paraguay et numéro dans le dos.
    if (K.jersey2) for (let y = 14; y <= 18; y++) for (let x = 7; x <= 18; x++) if (Math.floor((x - 7) / 2) % 2 === 1) c.dot(x, y, RAMP[K.jersey2][2])
    if (back && number !== null && K.num) {
      const digits = String(number).split('')
      const gw = digits.length * 4 - 1
      let gx = Math.floor((26 - gw) / 2)
      if (K.jersey2) for (let y = 14; y <= 18; y++) for (let x = gx - 1; x < gx + gw + 1; x++) c.dot(x, y, RAMP[K.jersey2][2])
      for (const d of digits) {
        glyph3(d).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') c.dot(gx + i, 14 + j, K.num) })
        gx += 4
      }
    }
    if (K.accent) for (let x = 11; x <= 14; x++) c.dot(x, 14, K.accent)
  }
  const out = c.render(mats)
  out.ax = 1 + 13
  out.ay = 1 + 32
  return out
}

if (process.argv[1] && process.argv[1].endsWith('figures.mjs')) {
  const sets = [['france', 0, 10], ['france', 1, 7], ['france', 3, 9], ['paraguay', 12, 4], ['arbitre', 11, null], ['gardien', 4, 1]]
  const g = grass(40 + sets.length * 34, 3 * 44, { lines: false })
  sets.forEach(([kit, look, num], i) => ['face', 'profil', 'dos'].forEach((view, r) => {
    const s = figure({ kit, look, view, number: num })
    const x = 24 + i * 34
    const y = 40 + r * 44
    shadow(g, x, y, 14)
    g.blit(s, x - s.ax, y - s.ay)
  }))
  process.stdout.write(pixToPng(g, Number(process.argv[2] || 5)))
}
