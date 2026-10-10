// Direction cartoon (référence : Bad Football) : grosse tête expressive, cheveux en mèches,
// sourcils froncés, cerne fin d'un pixel, aplats avec une seule ombre. Cartes écrites à la main.
// node carton-plein/art/figures3.mjs [échelle] > planche.png
import { PAL, Pix } from '../../cons-de-mime/pixel.js'
import { glyph3 } from '../../cons-de-mime/font.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { RAMP, KITS, LOOKS, grass, shadow } from './players.mjs'
const P = PAL

/*
 * Légende : o cerne ; H cheveux, h mèches sombres ; S peau, s peau ombre ; W blanc de l'œil,
 * E pupille et sourcil ; m bouche ; J maillot, j ombre ; R short, r ombre ; C chaussette ;
 * B crampon, b semelle ; . transparent.
 */
const FRONT = [
  '.............o..o..o....',
  '...........ooHooHooHo...',
  '........oooHHHHHHHHHHo..',
  '......ooHHHHHHHHHHHHHo..',
  '.....oHHHHHHHHHHHHHHHo..',
  '....oHHHHHHHHHHHHHHHHo..',
  '....oHHhHHHHHHHHHHHHHo..',
  '....oHhSSSSSSSSSSSSSho..',
  '....oHhSESSSSSSSSSESho..',
  '....oHsSSEESSSSSEESSho..',
  '....oHsSWWWWSSSWWWWSho..',
  '....oHsSWWEWSSSWEWWSho..',
  '....oHsSWWEWSSSWEWWSho..',
  '.....osSSSSSSSSSSSSSo...',
  '......osSSSSmmSSSSSo....',
  '.......osSSSSSSSSSo.....',
  '........oossssssoo......',
  '.....oJJJJJJJJJJo.......',
  '..ooJjJJJJJJJJJJjJoo....',
  '.oJJojJJJJJJJJJJjoJJo...',
  '.oJJojJJJJJJJJJJjoJJo...',
  '.oSSojjJJJJJJJJjjoSSo...',
  '.oSSoojjjjjjjjjjooSSo...',
  '.ossooRRRRRRRRRRoosso...',
  '..oo.oRRRRRRRRRRo.oo....',
  '.....orRRRooRRRro.......',
  '.....oSSSo.oSSSo........',
  '.....oSSSo.oSSSo........',
  '.....oCCCo.oCCCo........',
  '.....oCCCo.oCCCo........',
  '....oBBBBo.oBBBBo.......',
  '....obbbbo.obbbbo.......',
]
const PROFILE = [
  '.............o..o..o....',
  '...........ooHooHooHo...',
  '........oooHHHHHHHHHHo..',
  '......ooHHHHHHHHHHHHHo..',
  '.....oHHHHHHHHHHHHHHHo..',
  '....oHHHHHHHHHHHHHHHHo..',
  '....oHHhHHHHHHHHHHHHHo..',
  '....oHHHHHHHHhSSSSSSo...',
  '....oHHHHHHHHhSEESSSo...',
  '....oHHHHHHHhSSSEESSo...',
  '....oHHHHHHhSSSWWWWSoo..',
  '....oHHHHHHhSSSWEWWSSSo.',
  '....oHHHHHHhSSSWEWWSSSo.',
  '.....oHHHHhsSSSSSSSSoo..',
  '......oHHhsSSSSSmSo.....',
  '.......oosSSSSSSSo......',
  '.........oossssoo.......',
  '........oJJJJJJo........',
  '........oJJJjJJJo.......',
  '........oJJJoJJJo.......',
  '........oJJJoJJJo.......',
  '........oJJJoSSSo.......',
  '........ojjjoSSSo.......',
  '........oRRRoSSSo.......',
  '........oRRRRooo........',
  '........orRRRRo.........',
  '........oSSoSSo.........',
  '........oSSoSSo.........',
  '........oCCoCCo.........',
  '........oCCoCCo.........',
  '.......oBBBoBBBBo.......',
  '.......obbbobbbbo.......',
]
const BACK = [
  '.............o..o..o....',
  '...........ooHooHooHo...',
  '........oooHHHHHHHHHHo..',
  '......ooHHHHHHHHHHHHHo..',
  '.....oHHHHHHHHHHHHHHHo..',
  '....oHHHHHHHHHHHHHHHHo..',
  '....oHHhHHHHHHHHHHHHHo..',
  '....oHHHHHHHHHHHHHHHHo..',
  '....oHHhHHHHHHHHHHHHHo..',
  '....oHHHHHHHHHHhHHHHHo..',
  '....oHHHHHHHHHHHHHHHHo..',
  '....oHHhHHHHHHHHHHHHHo..',
  '....oHHHHHHHHHHHHHHHHo..',
  '.....oHHHHHHHHHHHHHHo...',
  '......oHHHHHHHHHHHHo....',
  '.......ohhhhhhhhhho.....',
  '........oosSSSSsoo......',
  '.....oJJJJJJJJJJo.......',
  '..ooJjJJJJJJJJJJjJoo....',
  '.oJJojJJJJJJJJJJjoJJo...',
  '.oJJojJJJJJJJJJJjoJJo...',
  '.oSSojjJJJJJJJJjjoSSo...',
  '.oSSoojjjjjjjjjjooSSo...',
  '.ossooRRRRRRRRRRoosso...',
  '..oo.oRRRRRRRRRRo.oo....',
  '.....orRRRooRRRro.......',
  '.....oSSSo.oSSSo........',
  '.....oSSSo.oSSSo........',
  '.....oCCCo.oCCCo........',
  '.....oCCCo.oCCCo........',
  '....oBBBBo.oBBBBo.......',
  '....obbbbo.obbbbo.......',
]
const BOOTS = { france: 'red', paraguay: 'white', arbitre: 'black', gardien: 'red', staff: 'black' }

export function figure3({ kit = 'france', look = 0, view = 'face', number = null } = {}) {
  const K = KITS[kit]
  const L = LOOKS[look]
  const hair = RAMP[L.hair]
  const skin = RAMP[L.skin]
  const jer = RAMP[K.jersey]
  const jer2 = K.jersey2 ? RAMP[K.jersey2] : null
  const sho = RAMP[K.shorts]
  const soc = RAMP[K.socks]
  const boo = RAMP[BOOTS[kit] || K.boots]
  const legend = {
    o: P.ink,
    H: hair[2], h: hair[1],
    S: skin[2], s: skin[1],
    W: P.white, E: P.ink, m: P.redD,
    J: jer[2], j: jer[1],
    R: sho[2], r: sho[1],
    C: soc[2],
    B: boo[2], b: boo[1],
  }
  const rows = (view === 'profil' ? PROFILE : view === 'dos' ? BACK : FRONT).map((r) => r.split(''))
  const prof = view === 'profil'
  const w = rows[0].length
  const h = rows.length
  const p = new Pix(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x]
      if (ch === '.') continue
      let c = legend[ch]
      if (jer2 && (ch === 'J' || ch === 'j') && y >= 17 && y <= 22 && Math.floor((x - (prof ? 9 : 6)) / 2) % 2 === 1) c = ch === 'J' ? jer2[2] : jer2[1]
      p.px(x, y, c)
    }
  if (L.band && view !== 'dos') for (let x = 5; x <= 21; x++) if (rows[7][x] !== '.' && rows[7][x] !== 'o') p.px(x, 7, P.red)
  if (L.band && view === 'dos') for (let x = 5; x <= 20; x++) if (rows[8][x] === 'H' || rows[8][x] === 'h') p.px(x, 8, P.red)
  // Barbe : le menton et les joues, pas la bouche.
  if (L.beard && view !== 'dos') for (let y = 14; y <= 16; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if ((ch === 'S' || ch === 's') && (y === 16 || y === 15 || (y === 14 && (x <= 9 || x >= 16))) && !(prof && x >= 15 && y < 16)) p.px(x, y, hair[1]) }
  if (K.accent && !prof) p.rect(9, 17, 4, 1, K.accent)
  if (view === 'dos' && number !== null && K.num) {
    const digits = String(number).split('')
    const gw = digits.length * 4 - 1
    let gx = Math.floor((22 - gw) / 2)
    if (jer2) p.rect(gx - 1, 18, gw + 2, 5, jer2[2])
    for (const d of digits) {
      glyph3(d).slice(2, 7).forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(gx + i, 18 + j, K.num) })
      gx += 4
    }
  }
  p.ax = 11
  p.ay = 31
  return p
}

if (process.argv[1] && process.argv[1].endsWith('figures3.mjs')) {
  const scale = Number(process.argv[2] || 5)
  const sets = [['france', 0, 10], ['france', 1, 7], ['france', 3, 9], ['paraguay', 12, 4], ['arbitre', 11, null], ['gardien', 4, 1]]
  const g = new Pix(30 + sets.length * 30, 3 * 42)
  g.rect(0, 0, g.w, g.h, P.green)
  for (let x = 0; x < g.w; x += 24) if (Math.floor(x / 24) % 2) g.rect(x, 0, 24, g.h, '#7fd36a')
  sets.forEach(([kit, look, num], i) => ['face', 'profil', 'dos'].forEach((view, r) => {
    const s = figure3({ kit, look, view, number: num })
    const x = 20 + i * 30
    const y = 38 + r * 42
    shadow(g, x, y, 12)
    g.blit(s, x - s.ax, y - s.ay)
  }))
  process.stdout.write(pixToPng(g, scale))
}
