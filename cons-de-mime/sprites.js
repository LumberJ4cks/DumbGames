/*
 * Cons de mime ! — tout l'art, dessiné au code dans des buffers de pixels (voir pixel.js),
 * à l'échelle 1:1, palette Endesga 32, lumière en haut à gauche, contours sélectifs.
 *
 * Chaque sprite garde son ancre (ax, ay) : les pieds pour les personnages, la base pour le
 * mobilier, le centre pour les effets. buildSprites() rend des Pix (utilisables en Node),
 * le jeu les transforme en canvas une fois au démarrage avec cacheSprites().
 */
import { Pix, PAL, RAMPS, darker, shade, bayer } from './pixel.js'
import { glyph3 } from './font.js'

const P = PAL
const R = RAMPS

/* ---------- outils ---------- */
export function shadedRect(p, x, y, w, h, ramp) {
  const n = ramp.length
  const mid = ramp[Math.max(0, n - 2)]
  const light = ramp[n - 1]
  const dark = ramp[Math.max(0, n - 3)]
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let c = mid
      if (w >= 2 && h >= 2) {
        if (j === h - 1 || i === w - 1) c = dark
        if ((j === 0 || i === 0) && !(j === h - 1 || i === w - 1)) c = light
        if (i === 0 && j === h - 1 && h > 2) c = mid
      } else if (w === 1 && h >= 3) c = j === 0 ? light : j === h - 1 ? dark : mid
      else if (h === 1 && w >= 3) c = i === 0 ? light : i === w - 1 ? dark : mid
      else if (w === 1 && h === 2) c = j ? dark : mid
      else if (h === 1 && w === 2) c = i ? dark : mid
      p.px(x + i, y + j, c)
    }
}
function legend(spec) {
  const out = {}
  for (const [ch, [ramp, i]] of Object.entries(spec)) out[ch] = typeof ramp === 'string' ? ramp : ramp[Math.max(0, Math.min(ramp.length - 1, i))]
  return out
}
/** Un sprite : le callback dessine en coordonnées relatives à l'ancre, 2 px de marge autour. */
export function sprite(w, h, ax, ay, draw, { soft = false, outline = true } = {}) {
  const p = new Pix(w + 4, h + 4)
  const ox = ax + 2
  const oy = ay + 2
  const at = {
    px: (x, y, c) => p.px(ox + x, oy + y, c),
    rect: (x, y, w, h, c) => p.rect(ox + x, oy + y, w, h, c),
    shaded: (x, y, w, h, ramp) => shadedRect(p, ox + x, oy + y, w, h, ramp),
    map: (rows, lg, x, y, flip) => p.map(rows, lg, ox + x, oy + y, flip),
    ell: (cx, cy, rx, ry, ramp, lift) => p.ell(ox + cx, oy + cy, rx, ry, ramp, lift),
    disc: (cx, cy, rx, ry, c) => p.disc(ox + cx, oy + cy, rx, ry, c),
    box: (x, y, w, h, d, ramp) => p.box(ox + x, oy + y, w, h, d, ramp),
    cyl: (x, y, w, h, ramp, cap) => p.cyl(ox + x, oy + y, w, h, ramp, cap),
    line: (x0, y0, x1, y1, c) => p.line(ox + x0, oy + y0, ox + x1, oy + y1, c),
    dither: (x, y, w, h, c1, c2, k) => p.dither(ox + x, oy + y, w, h, c1, c2, k),
    text3: (text, x, y, c) => text3(p, text, ox + x, oy + y, c),
    raw: p,
    ox,
    oy,
  }
  draw(at)
  const out = outline ? p.outline(soft) : p
  out.ax = ox
  out.ay = oy
  return out
}
export function text3(p, text, x, y, c) {
  let cx = x
  for (const ch of text) {
    const rows = glyph3(ch)
    rows.forEach((row, j) => {
      for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(cx + i, y + j, c)
    })
    cx += 4
  }
}
/** Miroir horizontal, l'ancre suit. */
export function mirror(p) {
  const q = new Pix(p.w, p.h)
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) q.data[y * p.w + (p.w - 1 - x)] = p.data[y * p.w + x]
  q.ax = p.w - 1 - p.ax
  q.ay = p.ay
  return q
}
/** Couché par terre : un quart de tour, la tête à droite, ancre au milieu du corps. */
export function lying(p) {
  const q = p.rotate(1)
  q.ax = Math.round(q.w / 2)
  q.ay = q.h - 2
  return q
}

/* ---------- jambes et bras communs ---------- */
function walker(a, frame, legRamp, bootRamp = R.rubber, dy = 0) {
  const L = frame ? [[-2, -7 + dy, 2, 6], [0, -7 + dy, 2, 6]] : [[-3, -7 + dy, 2, 6], [1, -7 + dy, 2, 6]]
  for (const [x, y, w, h] of L) a.shaded(x, y, w, h, legRamp)
  const B = frame ? [[-3, -1, 3], [0, -1, 3]] : [[-4, -1, 3], [1, -1, 3]]
  for (const [x, y, w] of B) {
    a.rect(x, y, w, 1, bootRamp[1])
    a.px(x + w - 1, y, bootRamp[0])
  }
}
/** Jambes de course (4 images) : grandes foulées, un pied en l'air. */
function runner(a, frame, legRamp, bootRamp = R.rubber) {
  const F = [
    { legs: [[-4, -7, 2, 4], [-5, -4, 1, 3], [2, -7, 2, 4], [3, -4, 1, 2]], boots: [[-6, -1, 3], [3, -2, 3]] },
    { legs: [[-2, -7, 2, 6], [1, -7, 2, 5]], boots: [[-3, -1, 3], [1, -2, 3]] },
    { legs: [[1, -7, 2, 4], [2, -4, 1, 3], [-3, -7, 2, 4], [-4, -4, 1, 2]], boots: [[1, -1, 3], [-5, -2, 3]] },
    { legs: [[-1, -7, 2, 6], [-3, -7, 2, 5]], boots: [[-1, -1, 3], [-4, -2, 3]] },
  ][frame % 4]
  for (const [x, y, w, h] of F.legs) a.shaded(x, y, w, h, legRamp)
  for (const [x, y, w] of F.boots) {
    a.rect(x, y, w, 1, bootRamp[1])
    a.px(x + w - 1, y, bootRamp[0])
  }
}

/* ---------- Serge Karamazov ---------- */
/*
 * Cheveux longs bruns, moustache, blouson de cuir noir ouvert sur un tee-shirt blanc,
 * jean moulant, santiags. Pieds en (0, 0), regard à droite. 4 images de course.
 */
export function sergeSprite(frame, { look = false, trip = false, boost = false } = {}) {
  const lg = legend({ G: [R.hairBrown, 1], g: [R.hairBrown, 0], H: [R.hairBrown, 2], s: [R.skinTan, 2], S: [R.skinTan, 3], z: [R.skinTan, 1], E: [P.ink], M: [R.hairBrown, 0], J: [R.black, 2], j: [R.black, 1], i: [R.black, 0], W: [P.white], w: [P.grey1], D: [R.blue, 1], d: [R.blue, 0] })
  if (trip) {
    // À plat ventre, les bras devant, les cheveux étalés.
    return sprite(22, 10, 11, 8, (a) => {
      a.map(['..JJjjji.....', '.sJJjjjiiGGg.', 'sSJjjjiiGGGHg', '..DDddi..GGg.'], lg, -8, -7)
      a.rect(-10, -4, 2, 1, R.skinTan[2])
      a.rect(4, -3, 3, 1, P.plum)
      a.px(-2, -3, P.plum)
    })
  }
  return sprite(20, 24, 10, 22, (a) => {
    const bob = frame % 2 ? 0 : -1
    runner(a, frame, R.blue, R.rubber)
    // Buste : blouson ouvert, tee-shirt blanc au milieu.
    a.map(['JJWWji', 'JjWwji', 'JjWwji', 'jjWwii', 'jjwwii', 'DDDddi'], lg, -3, -14 + bob)
    // Bras : balancier opposé aux jambes, en cuir.
    const arms = frame % 2 ? [[-4, -13, 1, 3], [3, -13, 1, 2], [4, -11, 1, 1]] : [[-5, -12, 2, 1], [-4, -13, 1, 1], [3, -13, 1, 3]]
    for (const [x, y, w, h] of arms) a.shaded(x, y + bob, w, h, R.black)
    a.px(frame % 2 ? -4 : -5, -10 + bob, R.skinTan[2])
    a.px(frame % 2 ? 4 : 3, -10 + bob, R.skinTan[2])
    // Tête : cheveux longs qui descendent sur les épaules, moustache.
    const head = look
      ? ['.GGGHg.', 'GGGGGgg', 'GGGGGgg', 'GGGGGgg', 'gGGGgg.', '.gg.g..']
      : ['.GGGHg.', 'GGGGGgg', 'GsSSzgg', 'GsSEzgg', 'gzMMzg.', '.gg.g..']
    a.map(head, lg, -4, -21 + bob)
    if (look) a.text3('?', 4, -24 + bob, P.yellow)
    if (boost) {
      // Les cheveux fouettent en arrière.
      a.rect(-7, -19 + bob, 3, 1, R.hairBrown[1])
      a.rect(-8, -17 + bob, 4, 1, R.hairBrown[0])
    }
  })
}

/* ---------- le tueur ---------- */
export function killerSprite(frame, taunt = false) {
  const lg = legend({ K: [R.black, 2], k: [R.black, 1], i: [R.black, 0], s: [R.skinPale, 1], S: [R.skinPale, 2], z: [R.skinPale, 0], E: [P.hot], H: [R.black, 3], W: [P.grey1], w: [P.grey2] })
  return sprite(20, 26, 10, 24, (a) => {
    runner(a, frame, R.black, R.rubber)
    // Long manteau noir, col relevé.
    a.map(['KKkkki', 'Kkkkki', 'Kkkkki', 'kkkkii', 'kkkkii', 'kkkiii', 'kkkiii'], lg, -3, -15)
    // Chapeau, visage dans l'ombre, yeux rouges.
    a.map(['.HHHHH.', 'KKKKKKk', '.zssz..', '.zEEz..', '.zssz..'], lg, -4, -21)
    if (taunt) {
      // Il se retourne et fait coucou : le visage vers Serge, le couteau levé.
      a.rect(-4, -20, 7, 2, R.black[2])
      a.rect(-6, -14, 1, 4, R.skinPale[1])
      a.rect(-7, -18, 1, 4, P.grey1)
      a.px(-7, -19, P.white)
    } else {
      // Le couteau dans la main avant.
      a.rect(4, -12, 1, 2, R.skinPale[1])
      a.rect(5, -11, 4, 1, P.grey1)
      a.px(9, -11, P.white)
      a.px(5, -10, P.grey3)
    }
  })
}

/* ---------- la population ---------- */
/*
 * Un piéton générique : look = { skin, hair, top, bottom, hat, acc }. Tous regardent à droite,
 * le jeu renverse pour la gauche. Deux images de marche.
 */
export function pedSprite(look, frame) {
  const Sk = R[look.skin]
  const Hr = R[look.hair]
  const T = R[look.top]
  const B = R[look.bottom]
  const lg = legend({ s: [Sk, 2], S: [Sk, 3], z: [Sk, 1], G: [Hr, 2], g: [Hr, 1], H: [Hr, 3], T: [T, 3], t: [T, 2], u: [T, 1], E: [P.ink], M: [P.redD], W: [P.white], w: [P.grey1], K: [P.ink], y: [P.yellow], b: [P.blue] })
  const h = look.hunched ? 20 : 22
  return sprite(18, h + 2, 9, h, (a) => {
    const dy = look.hunched ? 1 : 0
    walker(a, frame, B, look.boots || R.rubber)
    // Buste.
    a.map(['TTttu.', 'Ttttu.', 'tttuu.', 'tttuu.', 'ttuuu.', 'ttuuu.'], lg, -3, -13 + dy)
    // Bras (balancier).
    const arms = frame ? [[-4, -12, 1, 3], [3, -12, 1, 2]] : [[-4, -12, 1, 2], [3, -12, 1, 3]]
    for (const [x, y, w, hh] of arms) a.shaded(x, y + dy, w, hh, T)
    a.px(-4, -9 + dy, Sk[2])
    a.px(3, -9 + dy, Sk[2])
    // Tête selon le couvre-chef.
    let head
    if (look.hat === 'cap') head = ['.HGGgg', 'GGGGgg', '.sSSz.', '.sSEz.', '.zssz.']
    else if (look.hat === 'bald') head = ['......', '.sSSz.', 'ssSSzz', '.sSEz.', '.zssz.']
    else if (look.hat === 'bun') head = ['..GG..', '.GGGg.', 'GsSSzg', '.sSEz.', '.zssz.']
    else if (look.hat === 'helmet') head = ['.WWww.', 'WWWwww', 'WsSSzw', '.sSEz.', '.zssz.']
    else if (look.hat === 'long') head = ['.GGGg.', 'GGGGgg', 'GsSSzg', 'GsSEzg', 'gzsszg']
    else head = ['.GGGg.', 'GGGGgg', 'GsSSzg', '.sSEz.', '.zssz.']
    a.map(head, lg, -3, -18 + dy + (look.hunched ? 1 : 0))
    // Accessoires.
    if (look.acc === 'shades') a.map(['KKKKK'], lg, -3, -15 + dy)
    if (look.acc === 'glasses') a.map(['wwwww'], lg, -3, -15 + dy)
    if (look.acc === 'cane') {
      a.rect(5, -8, 1, 8, R.wood[1])
      a.px(5, -9, R.wood[2])
      a.px(4, -9, R.wood[2])
    }
    if (look.acc === 'ice') {
      a.rect(5, -13, 2, 2, P.pink)
      a.px(5, -14, P.white)
      a.px(6, -11, R.wood[3])
    }
    if (look.acc === 'phone') {
      a.rect(4, -14, 2, 3, P.ink)
      a.px(5, -13, P.cyan)
    }
    if (look.acc === 'bowtie') {
      a.map(['WWWW'], lg, -2, -13)
      a.px(0, -13, P.ink)
    }
    if (look.acc === 'shield') {
      a.box(3, -14, 4, 9, 1, R.glass)
    }
    if (look.acc === 'bag') {
      a.box(-7, -11, 3, 5, 1, R.red)
    }
    if (look.acc === 'poodle') {
      // Petit sac à main et une permanente.
      a.rect(-7, -9, 3, 3, R.purple[2])
      a.px(-6, -10, R.purple[1])
    }
  })
}

export const PED_LOOKS = {
  vieux: [
    { skin: 'skinPale', hair: 'hairGrey', top: 'purple', bottom: 'white', acc: 'cane', hunched: true },
    { skin: 'skinPale', hair: 'hairGrey', top: 'teal', bottom: 'navy', hat: 'bald', acc: 'glasses', hunched: true },
    { skin: 'skinTan', hair: 'hairGrey', top: 'pink', bottom: 'white', hat: 'bun', acc: 'poodle', hunched: true },
  ],
  jeune: [
    { skin: 'skinTan', hair: 'hairBlack', top: 'white', bottom: 'black', acc: 'shades' },
    { skin: 'skinPale', hair: 'hairBlond', top: 'pink', bottom: 'white', hat: 'long', acc: 'phone' },
    { skin: 'skinDark', hair: 'hairBlack', top: 'yellow', bottom: 'navy', acc: 'shades' },
  ],
  touriste: [
    { skin: 'skinPale', hair: 'hairRed', top: 'red', bottom: 'blue', hat: 'cap', acc: 'ice' },
    { skin: 'skinPale', hair: 'hairBrown', top: 'green', bottom: 'orange', hat: 'cap', acc: 'phone' },
  ],
  smoking: [{ skin: 'skinPale', hair: 'hairBlack', top: 'black', bottom: 'black', acc: 'bowtie' }],
  CRS: [{ skin: 'skinPale', hair: 'hairBlack', top: 'navy', bottom: 'navy', hat: 'helmet', acc: 'shield' }],
  livreur: [{ skin: 'skinDark', hair: 'hairBlack', top: 'teal', bottom: 'black', hat: 'cap', acc: 'bag' }],
}

export function chienSprite(frame) {
  const lg = legend({ b: [R.dog, 2], B: [R.dog, 3], d: [R.dog, 1], h: [R.dog, 2], H: [R.dog, 3], e: [R.dog, 1], E: [P.ink], n: [P.ink], p: [P.pink], r: [P.red], k: [P.plum] })
  return sprite(16, 12, 8, 10, (a) => {
    a.map(['t.....ee...', 'tt...HHHh..', '.BBBBrhhEn.', 'bbbbbbhhhp.', '.dbbbbbd...'], { ...lg, t: R.dog[2] }, -5, -9)
    const legs = frame ? ['.b..b..b.b.', '.k..k..k.k.'] : ['..b.b.b..b.', '..k.k.k..k.']
    a.map(legs, { b: R.dog[1], k: P.plum }, -5, -4)
  })
}

/* ---------- le con de mime ---------- */
export function mimeSprite(frame) {
  const lg = legend({ W: [P.white], w: [P.grey1], K: [P.ink], k: [P.slateD], s: [P.white], S: [P.white], z: [P.grey1], E: [P.ink], M: [P.red], B: [P.ink], R: [P.red] })
  return sprite(20, 24, 10, 22, (a) => {
    a.rect(-3, -1, 3, 1, P.ink)
    a.rect(1, -1, 3, 1, P.ink)
    a.shaded(-3, -7, 2, 6, R.black)
    a.shaded(1, -7, 2, 6, R.black)
    // Marinière.
    a.map(['KKKKKK', 'WWWWWW', 'KKKKKK', 'WWWWWW', 'KKKKKK', 'WWWWWW'], lg, -3, -13)
    // Bretelles rouges.
    a.rect(-2, -13, 1, 6, P.red)
    a.rect(1, -13, 1, 6, P.red)
    // Les mains sur le mur : elles tâtent (2 images).
    const hy = frame ? -12 : -10
    a.shaded(-6, hy - 1, 3, 1, R.black)
    a.rect(-8, hy - 2, 2, 2, P.white)
    a.shaded(3, hy + 1, 3, 1, R.black)
    a.rect(6, hy, 2, 2, P.white)
    // Béret, visage blanc, larme, bouche rouge.
    a.map(['.KKKKK.', 'KKKKKKk', '.sSSSz.', '.sEsEz.', '.zsMsz.', '..zzz..'], lg, -4, -19)
    a.px(2, -19, P.ink) // la queue du béret
    a.px(-1, -15, P.cyan) // la larme
  })
}

/* ---------- la fille en roller en jaune ---------- */
export function rollerSprite(frame) {
  const lg = legend({ Y: [R.yellow, 3], y: [R.yellow, 2], o: [R.yellow, 1], s: [R.skinPale, 2], S: [R.skinPale, 3], z: [R.skinPale, 1], G: [R.hairBlond, 2], g: [R.hairBlond, 1], H: [R.hairBlond, 3], E: [P.ink], M: [P.red], K: [P.ink], w: [P.grey2] })
  return sprite(22, 26, 11, 24, (a) => {
    // Rollers : bottes jaunes et roues.
    const L = frame ? [[-3, -8, 2, 6], [1, -8, 2, 5]] : [[-2, -8, 2, 6], [2, -8, 2, 5]]
    for (const [x, y, w, h] of L) a.shaded(x, y, w, h, R.skinPale)
    a.rect(-4, -3, 4, 2, R.yellow[2])
    a.rect(1, -4, 4, 2, R.yellow[2])
    for (const wx of [-4, -2, 1, 3]) a.px(wx, -1, P.grey3)
    a.px(0, -1, P.grey3)
    a.px(4, -2, P.grey3)
    // Body jaune moulant, short jaune.
    a.map(['YYyyo.', 'Yyyyo.', 'yyyoo.', 'yyyoo.', 'YYyyo.', 'yyyoo.'], lg, -3, -14)
    // Bras en arrière, patineuse.
    a.shaded(-6, -11, 3, 1, R.skinPale)
    a.shaded(3, -13, 1, 3, R.skinPale)
    // Queue de cheval blonde au vent, lunettes de soleil, sourire.
    a.map(['.HGGg.', 'GGGGgg', 'gsKKKg', '.sSSz.', '.zMMz.'], lg, -3, -19)
    a.rect(-7, -18, 4, 1, R.hairBlond[2])
    a.rect(-9, -17, 3, 1, R.hairBlond[1])
    a.px(-10, -16, R.hairBlond[1])
    // Walkman jaune à la ceinture.
    a.rect(3, -9, 2, 2, P.yellow)
  })
}

/* ---------- la mamie et son caddie ---------- */
export function mamieSprite(frame) {
  const lg = legend({ G: [R.hairGrey, 3], g: [R.hairGrey, 2], s: [R.skinPale, 2], S: [R.skinPale, 3], z: [R.skinPale, 1], E: [P.ink], V: [R.purple, 3], v: [R.purple, 2], u: [R.purple, 1], L: [P.grey1], l: [P.grey2], w: [P.grey2], W: [P.grey1], d: [P.grey3], T: [R.red, 2], t: [R.red, 1] })
  // Elle regarde à droite et pousse le caddie devant elle ; le jeu la renverse (elle marche à gauche).
  return sprite(34, 22, 10, 20, (a) => {
    a.map(['wwwwwwwwww', 'wdwdwdwdww', 'wdwdwdwdww', 'wdwdwdwdww', 'wwwwwwwwww'], lg, 6, -11)
    a.rect(5, -13, 1, 8, P.grey2)
    a.rect(16, -12, 1, 7, P.grey2)
    for (const wx of [8, 15]) {
      a.rect(wx - 1, -5, 3, 3, P.slateD)
      a.px(wx, -4, P.grey2)
    }
    a.rect(9, -14, 1, 3, P.white) // poireau
    a.rect(9, -16, 1, 2, P.green)
    a.rect(12, -14, 2, 3, P.cyan) // bouteille
    a.rect(4, -14, 1, 11, P.grey2) // la barre poussée
    // La mamie.
    const shoes = frame ? [[-3, -1, 3], [1, -1, 2]] : [[-2, -1, 2], [1, -1, 3]]
    for (const [x, y, w] of shoes) a.rect(x, y, w, 1, P.plum)
    a.map(['.GGGg.', 'GGGGgg', 'GsSEzg', '.sSSz.', '.LsszL', '.VVvu.', 'VVvvuu', 'VvEvuu', 'VvEvuu', 'vvvvu.', 'uuuuu.', '.llll.', '.llll.', '..s.s.'], lg, -3, -17)
    a.shaded(3, -12, 2, 1, R.skinPale) // les bras tendus vers la barre
    a.shaded(2, -11, 2, 1, R.skinPale)
    // Le sac à main rouge au coude.
    a.rect(-7, -9, 3, 3, R.red[2])
    a.rect(-7, -9, 3, 1, R.red[3])
    a.px(-6, -10, P.plum)
  })
}
/** Écrasée : à plat, le caddie renversé, les courses partout. */
export function mamieSplatSprite() {
  return sprite(36, 14, 18, 12, (a) => {
    a.disc(0, -4, 14, 5, P.redD)
    a.disc(-2, -5, 10, 3, P.red)
    a.rect(-6, -8, 12, 3, R.purple[2])
    a.rect(6, -8, 4, 3, R.hairGrey[3])
    a.px(8, -7, P.ink)
    a.rect(-16, -9, 10, 4, P.grey2)
    a.rect(-16, -5, 10, 1, P.grey3)
    a.rect(-14, -11, 1, 3, P.green)
    a.rect(10, -3, 2, 2, P.cyan)
    a.rect(-9, -2, 1, 2, P.white)
  })
}

/* ---------- le camion (vu de dessus, il descend de la route) ---------- */
export function truckSprite() {
  return sprite(30, 60, 15, 58, (a) => {
    // Cabine en bas (vers la plage), caisse au-dessus. Vue de dessus avec un peu de flanc.
    a.box(-14, -58, 28, 40, 3, R.white)
    a.rect(-12, -54, 24, 1, P.grey1)
    a.rect(-12, -30, 24, 1, P.grey1)
    a.text3('BERLIOZ', -13, -46, P.redD)
    a.text3('ET FILS', -13, -38, P.redD)
    a.box(-14, -15, 28, 13, 3, R.red)
    a.rect(-11, -10, 22, 5, P.cyan) // pare-brise
    a.rect(-11, -10, 22, 1, P.white)
    a.rect(-12, -2, 24, 2, P.grey3)
    a.rect(-11, -1, 2, 1, P.yellow)
    a.rect(9, -1, 2, 1, P.yellow)
    for (const [x, y] of [[-16, -50], [14, -50], [-16, -24], [14, -24], [-16, -8], [14, -8]]) a.rect(x, y, 2, 6, P.ink)
  })
}

/* ---------- mobilier urbain ---------- */
export function poubelleSprite() {
  return sprite(10, 14, 5, 12, (a) => {
    a.cyl(-4, -11, 8, 11, R.green, 1)
    a.rect(-4, -12, 8, 1, R.green[3])
    a.rect(-2, -9, 4, 1, P.ink) // la fente
    a.rect(-3, -6, 2, 1, P.white)
    a.rect(-4, -1, 8, 1, R.green[0])
  })
}
export function reverbereSprite() {
  return sprite(10, 34, 5, 32, (a) => {
    a.cyl(-1, -30, 3, 30, R.metal, 0)
    a.rect(-3, -1, 7, 1, P.slateD)
    a.rect(-3, -2, 7, 1, P.grey3)
    // Lanterne à l'ancienne.
    a.rect(-3, -34, 7, 1, P.slateD)
    a.rect(-4, -33, 9, 1, P.slateD)
    a.rect(-3, -32, 7, 3, P.amber)
    a.rect(-2, -32, 5, 1, P.yellow)
    a.rect(-3, -29, 7, 1, P.slateD)
  })
}
export function bancSprite() {
  return sprite(28, 12, 14, 10, (a) => {
    a.box(-13, -10, 26, 3, 1, R.wood)
    for (let x = -13; x < 13; x += 4) a.rect(x, -10, 1, 3, R.wood[1])
    a.box(-13, -5, 26, 3, 1, R.wood)
    a.rect(-12, -2, 1, 2, P.slateD)
    a.rect(11, -2, 1, 2, P.slateD)
    a.rect(-12, -7, 1, 2, P.slateD)
    a.rect(11, -7, 1, 2, P.slateD)
  })
}
export function kiosqueSprite() {
  return sprite(32, 30, 16, 28, (a) => {
    a.box(-15, -22, 30, 20, 3, R.green)
    a.rect(-16, -25, 32, 3, R.green[1])
    a.rect(-16, -25, 32, 1, R.green[3])
    a.rect(-13, -27, 26, 2, R.green[2])
    a.text3('PRESSE', -12, -24, P.yellow)
    // Journaux et magazines accrochés.
    const covers = [P.red, P.blue, P.yellow, P.pink, P.cyan, P.orange]
    for (let i = 0; i < 6; i++) {
      a.rect(-13 + i * 4, -17, 3, 5, covers[i])
      a.px(-13 + i * 4, -17, P.white)
    }
    a.rect(-13, -10, 26, 6, R.green[0])
    a.rect(-12, -9, 24, 4, P.grey1)
    for (let i = 0; i < 6; i++) a.rect(-12 + i * 4, -9, 3, 1, covers[(i + 3) % 6])
  })
}
export function chaiseSprite() {
  // La chaise bleue de la Croisette, vue de 3/4.
  return sprite(10, 12, 5, 10, (a) => {
    a.rect(-3, -10, 6, 4, R.blue[2])
    a.rect(-3, -10, 6, 1, R.blue[3])
    a.rect(-3, -6, 7, 2, R.blue[1])
    a.rect(-3, -4, 1, 4, R.blue[0])
    a.rect(3, -4, 1, 4, R.blue[0])
    a.rect(-2, -6, 1, 2, R.blue[2])
  })
}
export function palmSprite(v = 0) {
  return sprite(28, 36, 14, 34, (a) => {
    // Tronc en écailles, légèrement penché.
    for (let y = -24; y < 0; y++) {
      const x = Math.round((-24 - y) * 0.12)
      a.rect(x - 1, y, 3, 1, y % 3 === 0 ? R.wood[1] : R.wood[2])
      a.px(x + 1, y, R.wood[0])
    }
    // Les palmes : 6 courbes.
    const cx = -3
    const cy = -25
    const G = R.grass
    const dirs = [[-1, -0.3], [1, -0.3], [-0.8, -0.9], [0.8, -0.9], [-0.3, -1], [0.3, -1], [-1, 0.3], [1, 0.3]]
    dirs.forEach(([dx, dy], i) => {
      for (let t = 0; t < 11; t++) {
        const x = cx + dx * t
        const y = cy + dy * t + (t * t) * 0.06
        a.px(x, y, G[i % 2 ? 3 : 2])
        a.px(x, y + 1, G[1])
      }
    })
    a.rect(cx - 1, cy - 1, 3, 2, R.wood[3])
    if (v) {
      a.px(cx - 2, cy + 1, P.orange)
      a.px(cx + 2, cy + 1, P.orange)
    }
  }, { soft: true })
}
export function parasolSprite(v = 0) {
  const ramps = [R.red, R.blue, R.yellow, R.white]
  const C = ramps[v % ramps.length]
  return sprite(22, 20, 11, 18, (a) => {
    a.rect(0, -8, 1, 8, R.wood[2])
    for (let y = -16; y < -8; y++) {
      const w = Math.round(10 * Math.sqrt(1 - ((y + 12) / 4) ** 2)) + 1
      for (let x = -w; x <= w; x++) a.px(x, y, ((x + 10) >> 2) % 2 ? C[2] : P.white)
    }
    a.rect(-10, -9, 21, 1, C[1])
    a.px(0, -17, C[3])
  }, { soft: true })
}
export function servietteSprite(v = 0) {
  const cols = [P.cyan, P.pink, P.orange, P.greenM]
  return sprite(16, 8, 8, 6, (a) => {
    a.rect(-7, -5, 14, 5, cols[v % cols.length])
    a.rect(-7, -5, 14, 1, P.white)
    a.rect(-7, -1, 14, 1, darker(cols[v % cols.length]))
    if (v % 2) {
      a.disc(-3, -3, 2, 2, R.skinTan[2]) // quelqu'un qui bronze
      a.rect(-1, -3, 7, 2, R.skinTan[1])
    }
  }, { soft: true })
}
export function bateauSprite() {
  return sprite(26, 12, 13, 10, (a) => {
    a.rect(-12, -4, 24, 3, P.white)
    a.rect(-12, -1, 24, 1, P.grey2)
    a.rect(-6, -8, 12, 4, P.grey1)
    a.rect(-4, -7, 8, 1, P.blueD)
    a.rect(2, -10, 1, 2, P.grey1)
  }, { soft: true })
}

/* ---------- façades (le haut de l'écran) ---------- */
export function facadeSprite(kind, w = 150) {
  return sprite(w, 18, 0, 16, (a) => {
    if (kind === 'palais') {
      a.rect(0, -16, w, 16, P.cream)
      a.rect(0, -16, w, 1, P.white)
      a.rect(0, -4, w, 4, P.red) // le tapis rouge, les marches
      a.rect(0, -4, w, 1, P.pink)
      for (let x = 6; x < w - 6; x += 12) {
        a.rect(x, -9, 6, 5, P.slateD)
        a.rect(x, -9, 6, 1, P.cyan)
      }
      a.text3('PALAIS DES FESTIVALS', 4, -15, P.ink)
    } else if (kind === 'carlton') {
      a.rect(0, -14, w, 14, P.cream)
      a.rect(0, -14, w, 1, P.white)
      for (const cx of [20, w - 20]) {
        a.disc(cx, -14, 7, 4, P.grey2)
        a.disc(cx, -15, 5, 3, P.grey1)
        a.px(cx, -18, P.grey1)
      }
      for (let x = 32; x < w - 32; x += 8) a.rect(x, -8, 4, 4, P.slate)
      a.rect(0, -3, w, 3, P.redD)
      a.rect(0, -3, w, 1, P.red)
      a.text3('CARLTON', Math.round(w / 2) - 14, -14, P.plum)
    } else if (kind === 'hotel') {
      const wall = [P.sand, P.cream, P.grey1][w % 3]
      a.rect(0, -15, w, 15, wall)
      a.rect(0, -15, w, 1, P.white)
      for (let x = 4; x < w - 4; x += 8) {
        a.rect(x, -12, 4, 5, P.slate)
        a.rect(x, -12, 4, 1, P.cyan)
        a.rect(x, -6, 4, 1, P.blue) // les stores
      }
      a.rect(0, -3, w, 3, P.blue)
      a.rect(0, -3, w, 1, P.cyan)
    } else if (kind === 'boutique') {
      a.rect(0, -15, w, 15, P.grey1)
      a.rect(0, -15, w, 1, P.white)
      const awn = [P.red, P.greenM, P.orange, P.magenta]
      for (let x = 0, i = 0; x < w; x += 30, i++) {
        a.rect(x + 2, -11, 26, 7, P.slateD)
        a.rect(x + 3, -10, 24, 4, P.cyan)
        for (let s = 0; s < 26; s += 2) a.rect(x + 2 + s, -5, 1, 3, s % 4 ? awn[i % 4] : P.white)
        a.rect(x + 2, -2, 26, 2, darker(awn[i % 4]))
      }
    }
  }, { soft: true, outline: false })
}

/* ---------- effets ---------- */
export function boomSprite(frame, big = false) {
  const r = (big ? 10 : 6) + frame * (big ? 5 : 3)
  return sprite(r * 2 + 4, r * 2 + 4, r + 2, r + 2, (a) => {
    const cols = [P.white, P.yellow, P.orange, P.red, P.redD]
    a.disc(0, 0, r, r * 0.8, cols[Math.min(4, frame + 1)])
    a.disc(0, 0, r * 0.7, r * 0.55, cols[Math.min(4, frame)])
    a.disc(-r * 0.2, -r * 0.2, r * 0.35, r * 0.3, frame < 2 ? P.white : P.yellow)
    if (frame >= 2) {
      // Fumée noire qui monte.
      a.disc(-r * 0.4, -r * 0.7, r * 0.3, r * 0.3, P.slate)
      a.disc(r * 0.3, -r * 0.8, r * 0.35, r * 0.3, P.slateD)
    }
  }, { outline: false })
}
export function gasSprite(frame) {
  const r = 5 + frame * 4
  return sprite(r * 2 + 2, r * 2 + 2, r + 1, r + 1, (a) => {
    const c1 = frame < 2 ? P.green : P.greenM
    const c2 = frame < 2 ? P.yellow : P.green
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = (x * x) / (r * r) + (y * y) / (r * r * 0.6)
        if (d <= 1 && bayer(x, y) < 1 - d * 0.6 - frame * 0.15) a.px(x, y, bayer(x + 2, y) < 0.5 ? c1 : c2)
      }
  }, { outline: false })
}
export function shadowSprite(w) {
  return sprite(w + 2, 4, Math.round(w / 2) + 1, 2, (a) => {
    for (let x = -Math.round(w / 2); x <= Math.round(w / 2); x++) if (bayer(x, 0) < 0.6) a.px(x, 0, P.slateD)
    for (let x = -Math.round(w / 2) + 1; x < Math.round(w / 2); x++) a.px(x, -1, P.slate)
  }, { outline: false })
}
export function debrisSprite(kind) {
  return sprite(6, 6, 3, 3, (a) => {
    if (kind === 'shoe') { a.rect(-2, -1, 4, 2, P.plum); a.px(2, 0, P.ink) }
    else if (kind === 'glasses') { a.rect(-2, -1, 2, 1, P.ink); a.rect(1, -1, 2, 1, P.ink); a.px(0, -1, P.grey3) }
    else if (kind === 'hat') { a.rect(-2, -1, 5, 1, P.slateD); a.rect(-1, -2, 3, 1, P.slate) }
    else if (kind === 'phone') { a.rect(-1, -2, 2, 3, P.ink); a.px(-1, -1, P.cyan) }
    else { a.rect(-1, -1, 2, 2, P.red) }
  }, { outline: false })
}
/** La marque au sol d'un explosé. */
export function scorchSprite() {
  return sprite(20, 8, 10, 4, (a) => {
    for (let y = -3; y <= 3; y++) for (let x = -9; x <= 9; x++) if ((x * x) / 81 + (y * y) / 9 <= 1 && bayer(x, y) < 0.7) a.px(x, y, P.slateD)
  }, { outline: false })
}

/* ---------- le décor défilant : une tuile de 120 px ---------- */
export const TILE_W = 120
export function groundTile(C) {
  const p = new Pix(TILE_W, C.GH)
  // Route : asphalte dithéré, bande blanche discontinue, caniveau.
  for (let y = C.roadTop; y < C.roadBottom; y++)
    for (let x = 0; x < TILE_W; x++) p.px(x, y, bayer(x, y) < 0.15 ? P.slate : P.slateD)
  for (let x = 0; x < TILE_W; x += 40) p.rect(x + 4, Math.round((C.roadTop + C.roadBottom) / 2), 20, 2, P.grey1)
  p.rect(0, C.roadBottom - 3, TILE_W, 1, P.grey3)
  p.rect(0, C.roadBottom - 2, TILE_W, 2, P.grey2)
  // Haie et plate-bande côté route.
  for (let y = C.roadBottom; y < C.roadBottom + 8; y++)
    for (let x = 0; x < TILE_W; x++) p.px(x, y, bayer(x, y) < 0.35 ? P.greenM : P.greenD)
  p.rect(0, C.roadBottom, TILE_W, 1, P.green)
  for (let x = 3; x < TILE_W; x += 9) p.px(x, C.roadBottom + 3 + (x % 3), P.pink)
  p.rect(0, C.roadBottom + 8, TILE_W, 1, P.grey3)
  // Trottoir : dalles claires de la Croisette, joints tous les 20 px.
  for (let y = C.roadBottom + 9; y < C.beachTop - 7; y++)
    for (let x = 0; x < TILE_W; x++) {
      const joint = x % 20 === 0 || (y - C.roadBottom) % 20 === 0
      p.px(x, y, joint ? P.grey2 : bayer(x, y) < 0.1 ? P.cream : P.grey1)
    }
  // Bordure côté plage : muret et végétation.
  p.rect(0, C.beachTop - 7, TILE_W, 1, P.white)
  p.rect(0, C.beachTop - 6, TILE_W, 2, P.grey1)
  for (let y = C.beachTop - 4; y < C.beachTop; y++)
    for (let x = 0; x < TILE_W; x++) p.px(x, y, bayer(x, y) < 0.4 ? P.green : P.greenM)
  // Plage : sable dithéré, puis la mer avec quelques crêtes.
  for (let y = C.beachTop; y < C.seaTop; y++)
    for (let x = 0; x < TILE_W; x++) p.px(x, y, bayer(x, y) < 0.2 ? P.cream : P.sand)
  for (let y = C.seaTop; y < C.GH; y++)
    for (let x = 0; x < TILE_W; x++) {
      const deep = (y - C.seaTop) / (C.GH - C.seaTop)
      p.px(x, y, y === C.seaTop ? P.white : bayer(x, y) < deep ? P.blueD : P.blue)
    }
  for (let x = 0; x < TILE_W; x += 30) p.rect(x + ((x / 30) % 2) * 8, C.seaTop + 6 + ((x / 30) % 3) * 5, 8, 1, P.cyan)
  return p
}

/* ---------- la boîte à sprites ---------- */
export function buildSprites(C) {
  const S = {}
  S.serge = [0, 1, 2, 3].map((f) => sergeSprite(f))
  S.sergeBoost = [0, 1, 2, 3].map((f) => sergeSprite(f, { boost: true }))
  S.sergeLook = [0, 1, 2, 3].map((f) => sergeSprite(f, { look: true }))
  S.sergeTrip = sergeSprite(0, { trip: true })
  S.killer = [0, 1, 2, 3].map((f) => killerSprite(f))
  S.killerTaunt = killerSprite(1, true)
  S.ped = {}
  S.pedLying = {}
  for (const [kind, looks] of Object.entries(PED_LOOKS)) {
    S.ped[kind] = looks.map((lk) => [0, 1].map((f) => pedSprite(lk, f)))
    S.pedLying[kind] = looks.map((lk) => lying(pedSprite(lk, 0)))
  }
  S.chien = [0, 1].map(chienSprite)
  S.chienLying = lying(chienSprite(0))
  S.mime = [0, 1].map(mimeSprite)
  S.roller = [0, 1].map(rollerSprite)
  S.mamie = [0, 1].map(mamieSprite)
  S.mamieLying = lying(mamieSprite(0))
  S.mamieSplat = mamieSplatSprite()
  S.truck = truckSprite()
  S.furn = { poubelle: poubelleSprite(), reverbere: reverbereSprite(), banc: bancSprite(), kiosque: kiosqueSprite(), 'chaise bleue': chaiseSprite() }
  S.palm = [0, 1].map(palmSprite)
  S.parasol = [0, 1, 2, 3].map(parasolSprite)
  S.serviette = [0, 1, 2, 3].map(servietteSprite)
  S.bateau = bateauSprite()
  S.facade = { palais: facadeSprite('palais', 160), carlton: facadeSprite('carlton', 160), hotel: [150, 151, 152].map((w) => facadeSprite('hotel', w)), boutique: facadeSprite('boutique', 150) }
  S.boom = [0, 1, 2, 3].map((f) => boomSprite(f))
  S.boomBig = [0, 1, 2, 3].map((f) => boomSprite(f, true))
  S.gas = [0, 1, 2, 3].map(gasSprite)
  S.shadow = { s: shadowSprite(8), m: shadowSprite(12), l: shadowSprite(20) }
  S.debris = ['shoe', 'glasses', 'hat', 'phone', 'bit'].map(debrisSprite)
  S.scorch = scorchSprite()
  S.tile = groundTile(C)
  return S
}
