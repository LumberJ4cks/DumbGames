// Joueurs dessinés à la main, pixel par pixel, proportions réalistes (tête 7/30), sans cerne :
// les bords sont faits par les tons d'ombre, comme sur les planches de référence (SWOS, Indoor
// Soccer, Kick Off). node carton-plein/art/figures2.mjs [échelle] > planche.png
import { PAL } from '../../cons-de-mime/pixel.js'
import { Pix } from '../../cons-de-mime/pixel.js'
import { glyph3 } from '../../cons-de-mime/font.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { RAMP, KITS, LOOKS, grass, shadow } from './players.mjs'
const P = PAL

/*
 * Légende : H cheveux, h cheveux clairs ; S peau, s peau ombre, T peau lumière ; J maillot,
 * j maillot ombre, I maillot lumière ; R short, r short ombre ; C chaussette, c ombre ;
 * B crampon, b crampon clair ; o encre (œil, semelle) ; . transparent.
 */
const FACE = [
  '.....HHHHH......',
  '....HHHHHHH.....',
  '....HSSSSSH.....',
  '....HSoSoSH.....',
  '....sSSSSSs.....',
  '.....sSSSs......',
  '......sSs.......',
  '.......S........',
  '...IJJJjSjJJJj..',
  '..IJJJJJJJJJJj..',
  '..IJJJJJJJJJJj..',
  '..IJjJJJJJJJjj..',
  '.Ss.jJJJJJJj.Ss.',
  '.Ss.jJJJJJJj.Ss.',
  '.Ss.jJJJJJJj.Ss.',
  '.ss.jjJJJJjj.ss.',
  '....rRRRRRRr....',
  '....rRRRRRRr....',
  '....rRRrrRRr....',
  '....rRR..RRr....',
  '....sSs..sSs....',
  '....sSs..sSs....',
  '....sSs..sSs....',
  '....sSs..sSs....',
  '....cCc..cCc....',
  '....cCc..cCc....',
  '....cCc..cCc....',
  '....cCc..cCc....',
  '...bBBb..bBBb...',
  '...oooo..oooo...',
]
const BACK = [
  '.....HHHHH......',
  '....HHHHHHH.....',
  '....HHHHHHH.....',
  '....HHHHHHH.....',
  '....sHHHHHs.....',
  '.....HHHHH......',
  '......sSs.......',
  '.......S........',
  '...IJJJJJJJJJj..',
  '..IJJJJJJJJJJj..',
  '..IJJJJJJJJJJj..',
  '..IJjJJJJJJJjj..',
  '.Ss.jJJJJJJj.Ss.',
  '.Ss.jJJJJJJj.Ss.',
  '.Ss.jJJJJJJj.Ss.',
  '.ss.jjJJJJjj.ss.',
  '....rRRRRRRr....',
  '....rRRRRRRr....',
  '....rRRrrRRr....',
  '....rRR..RRr....',
  '....sSs..sSs....',
  '....sSs..sSs....',
  '....sSs..sSs....',
  '....sSs..sSs....',
  '....cCc..cCc....',
  '....cCc..cCc....',
  '....cCc..cCc....',
  '....cCc..cCc....',
  '...bBBb..bBBb...',
  '...oooo..oooo...',
]
// Profil, regard à droite. Le bras avant pend devant le buste, les jambes sont légèrement décalées.
const PROFILE = [
  '....HHHHH...',
  '...HHHHHHH..',
  '...HHHHSSS..',
  '...HHHSSoSS.',
  '...HHsSSSS..',
  '....sSSSs...',
  '.....sSs....',
  '.....sS.....',
  '...jJJJJj...',
  '..jJJJJJJj..',
  '..jJJJJJJj..',
  '..jJJjJJJj..',
  '..jJJjSsj...',
  '..jJJjSsj...',
  '..jJJjSsj...',
  '..jjjjss....',
  '...rRRRr....',
  '...rRRRr....',
  '...rRRRr....',
  '...rRRRr....',
  '...sSsSs....',
  '...sSsSs....',
  '...sSsSs....',
  '...sSsSs....',
  '...cCcCc....',
  '...cCcCc....',
  '...cCcCc....',
  '...cCcCc....',
  '..bBBBBBb...',
  '..ooooooo...',
]

export function figure2({ kit = 'france', look = 0, view = 'face', number = null } = {}) {
  const K = KITS[kit]
  const L = LOOKS[look]
  const hair = RAMP[L.hair]
  const skin = RAMP[L.skin]
  const jer = RAMP[K.jersey]
  const jer2 = K.jersey2 ? RAMP[K.jersey2] : null
  const sho = RAMP[K.shorts]
  const soc = RAMP[K.socks]
  const boo = RAMP[K.boots]
  const legend = {
    H: hair[1], h: hair[2],
    S: skin[2], s: skin[1], T: skin[3],
    J: jer[2], j: jer[1], I: jer[3],
    R: sho[2], r: sho[1],
    C: soc[2], c: soc[1],
    B: boo[1], b: boo[2],
    o: P.ink,
  }
  const rows = (view === 'profil' ? PROFILE : view === 'dos' ? BACK : FACE).map((r) => r.split(''))
  const w = rows[0].length
  const h = rows.length
  // Chauve : les cheveux deviennent de la peau.
  if (L.bald) for (const r of rows) for (let x = 0; x < w; x++) if (r[x] === 'H' || r[x] === 'h') r[x] = 'S'
  const p = new Pix(w + 2, h + 2)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let ch = rows[y][x]
      if (ch === '.') continue
      let c = legend[ch]
      // Rayures du Paraguay : colonnes alternées de 2 px sur le buste.
      if (jer2 && (ch === 'J' || ch === 'j') && y >= 8 && y <= 15) {
        const stripe = Math.floor((x - (view === 'profil' ? 2 : 4)) / 2) % 2 === 1
        if (stripe) c = ch === 'J' ? jer2[2] : jer2[1]
      }
      p.px(x + 1, y + 1, c)
    }
  // Bandeau du n°4, barbe.
  if (L.band && view !== 'dos') {
    const y = 3
    for (let x = 0; x < w; x++) if (rows[2][x] !== '.' && rows[2][x] !== 'o') p.px(x + 1, y, P.red)
  }
  if (L.beard && view !== 'dos') {
    for (let y = 5; y <= 6; y++) for (let x = 0; x < w; x++) if (rows[y][x] === 'S' || rows[y][x] === 's') p.px(x + 1, y + 1, hair[1])
  }
  // Col de l'arbitre, numéro dans le dos.
  if (K.accent && view !== 'profil') p.rect(1 + 7, 1 + 8, 2, 1, K.accent)
  if (view === 'dos' && number !== null && K.num) {
    const digits = String(number).split('')
    const gw = digits.length * 4 - 1
    let gx = Math.floor((w - gw) / 2)
    if (jer2) p.rect(1 + gx - 1, 1 + 10, gw + 2, 5, jer2[2])
    for (const d of digits) {
      glyph3(d).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(1 + gx + i, 1 + 10 + j, K.num) })
      gx += 4
    }
  }
  p.ax = 1 + Math.floor(w / 2)
  p.ay = 1 + h - 1
  return p
}

if (process.argv[1] && process.argv[1].endsWith('figures2.mjs')) {
  const scale = Number(process.argv[2] || 5)
  const sets = [['france', 0, 10], ['france', 1, 7], ['france', 3, 9], ['paraguay', 12, 4], ['arbitre', 11, null], ['gardien', 4, 1]]
  const g = grass(30 + sets.length * 28, 3 * 40, { lines: false })
  sets.forEach(([kit, look, num], i) => ['face', 'profil', 'dos'].forEach((view, r) => {
    const s = figure2({ kit, look, view, number: num })
    const x = 20 + i * 28
    const y = 36 + r * 40
    shadow(g, x, y, 8)
    g.blit(s, x - s.ax, y - s.ay)
  }))
  process.stdout.write(pixToPng(g, scale))
}
