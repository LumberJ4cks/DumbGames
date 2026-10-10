/*
 * CARTON PLEIN — les joueurs, méthode METHODE.md : chaque pose est écrite à la main en deux
 * calques alignés (A matières en lettres, B tons en chiffres 1–4), plus un calque C de
 * détails à couleur fixe. Le code ne propose un calque B (règle de la brique) que là où
 * l'auteur n'en a pas écrit. Palette Endesga 32, rampes de 4 tons, contour sélectif.
 */
import { Pix, PAL, darker } from '../../cons-de-mime/pixel.js'
import { glyph3 } from '../../cons-de-mime/font.js'
import { glyph5 } from '../../cons-de-mime/font5.js'

const P = PAL

/* ---------- rampes (1 ombre → 4 lumière) ---------- */
export const RAMP = {
  skinPale: [P.clay, P.skin, P.skinL, P.cream],
  skinTan: [P.brown, P.clay, P.skin, P.skinL],
  skinDark: [P.plum, P.brown, P.clay, P.skin],
  hairBrown: [P.plum, P.brown, P.clay, P.tan],
  hairBlack: [P.ink, P.slateD, P.slate, P.grey3],
  hairBlond: [P.clay, P.tan, P.amber, P.yellow],
  hairRed: [P.brown, P.rust, P.tan, P.amber],
  hairGrey: [P.grey3, P.grey2, P.grey1, P.white],
  blueDark: [P.ink, P.slateD, P.blueD, P.blue], // maillot France
  blueLight: [P.blueD, P.blue, P.cyan, P.grey1], // short et chaussettes Paraguay
  white: [P.grey3, P.grey2, P.grey1, P.white],
  red: [P.plum, P.redD, P.red, P.pink],
  black: [P.ink, P.slateD, P.slate, P.grey3],
  yellow: [P.rust, P.orange, P.amber, P.yellow],
  purple: [P.plum, P.purple, P.magenta, P.pink], // gardien
  navy: [P.ink, P.slateD, P.slate, P.grey3],
  grass: [P.teal, P.greenD, P.greenM, P.green],
}

export const KITS = {
  france: { jersey: 'blueDark', shorts: 'white', socks: 'red', boots: 'black', num: P.white },
  paraguay: { jersey: 'red', jersey2: 'white', shorts: 'blueLight', socks: 'blueLight', boots: 'black', num: P.ink },
  arbitre: { jersey: 'black', shorts: 'black', socks: 'black', boots: 'black', num: null, accent: P.amber },
  gardien: { jersey: 'purple', shorts: 'black', socks: 'purple', boots: 'black', num: P.white },
  staff: { jersey: 'navy', shorts: 'navy', socks: 'white', boots: 'black', num: null, suit: true },
}
export const LOOKS = [
  { skin: 'skinPale', hair: 'hairBrown' },
  { skin: 'skinDark', hair: 'hairBlack' },
  { skin: 'skinTan', hair: 'hairBlack', beard: true },
  { skin: 'skinPale', hair: 'hairBlond' },
  { skin: 'skinDark', hair: 'hairBlack', bald: true },
  { skin: 'skinTan', hair: 'hairBrown' },
  { skin: 'skinPale', hair: 'hairRed', beard: true },
  { skin: 'skinDark', hair: 'hairBrown' },
  { skin: 'skinTan', hair: 'hairBlack' },
  { skin: 'skinPale', hair: 'hairBlack', beard: true },
  { skin: 'skinDark', hair: 'hairBlack', bald: true, beard: true },
  { skin: 'skinPale', hair: 'hairGrey' }, // arbitre
  { skin: 'skinTan', hair: 'hairBlack', beard: true, band: true }, // le n°4
]

/* ---------- calques écrits à la main ---------- */
// Tête de face, 14 × 12. A : matières. B : tons.
const HEAD_F_A = [
  '..HHHHHHHHHH..',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HSHSHSHSHSHH.',
  '.HSSSSSSSSSSH.',
  '.HSSSSSSSSSSH.',
  '..SEESSSSEESS.',
  '..SEESSSSEESS.',
  '..SSSSSSSSSSS.',
  '..SSSSMMSSSSS.',
  '...SSSSSSSSS..',
]
const HEAD_F_B = [
  '..4444444443..',
  '.322222222221.',
  '.322222222221.',
  '.322222222221.',
  '.333333333331.',
  '.233333333321.',
  '.233333333321.',
  '..31133331132.',
  '..31133331132.',
  '..33333333322.',
  '..33332233322.',
  '...222222221..',
]
// Tête de dos, 14 × 12 : cheveux jusqu'à la nuque, cou.
const HEAD_B_A = [
  '..HHHHHHHHHH..',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '.HHHHHHHHHHHH.',
  '..HHHHHHHHHH..',
  '....SSSSSS....',
  '....SSSSSS....',
  '.....SSSS.....',
]
const HEAD_B_B = [
  '..4444444443..',
  '.322222222221.',
  '.322222222221.',
  '.322222222221.',
  '.322222222221.',
  '.322222222221.',
  '.322222222221.',
  '.322222222221.',
  '..2222222211..',
  '....333321....',
  '....333321....',
  '.....2221.....',
]
// Tête de profil (regard à droite), 12 × 12, un pixel de nez.
const HEAD_P_A = [
  '..HHHHHHHH..',
  '.HHHHHHHHHH.',
  '.HHHHHHHHHH.',
  '.HHHHHHHHHH.',
  '.HHHHHHHHSS.',
  '.HHHHHHSSSS.',
  '.HHHHHSSSSS.',
  '.HHHHSSSSEE.',
  '.HHHHSSSSEES',
  '..HHSSSSSSSS',
  '..SSSSSSSSM.',
  '...SSSSSSS..',
]
const HEAD_P_B = [
  '..44444444..',
  '.3222222221.',
  '.3222222221.',
  '.3222222221.',
  '.3222222233.',
  '.3222223333.',
  '.3222233333.',
  '.3222333311.',
  '.32223333113',
  '..2233333332',
  '..3333333321',
  '...22222221.',
]

/* ---------- outils de calques ---------- */
/** Calque B proposé par la règle de la brique, zone par zone (4-voisinage, même lettre). */
function propose(A) {
  const h = A.length
  const w = A[0].length
  const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? A[y][x] : '.')
  return A.map((row, y) =>
    row
      .split('')
      .map((m, x) => {
        if (m === '.') return '.'
        const top = at(x, y - 1) !== m
        const left = at(x - 1, y) !== m
        const right = at(x + 1, y) !== m
        const bottom = at(x, y + 1) !== m
        if (top) return '4'
        if (right || bottom) return '1'
        if (left) return '3'
        return '2'
      })
      .join(''),
  )
}
/** Une pièce : calques A (obligatoire), B (optionnel, complété par la proposition), C (optionnel). */
function piece(A, B, C) {
  const prop = propose(A)
  const Bf = A.map((row, y) => row.split('').map((m, x) => (m === '.' ? '.' : B && B[y] && B[y][x] && B[y][x] !== '.' && B[y][x] !== ' ' ? B[y][x] : prop[y][x])).join(''))
  return { A, B: Bf, C: C || null, w: A[0].length, h: A.length }
}
const fill = (w, h, ch) => Array.from({ length: h }, () => ch.repeat(w))

/** Résout une pièce en couleurs et la pose dans `p` en (x, y). */
function stamp(p, pc, x, y, mats) {
  for (let j = 0; j < pc.h; j++)
    for (let i = 0; i < pc.w; i++) {
      const m = pc.A[j][i]
      if (m === '.') continue
      let c
      if (m === 'E') c = P.ink
      else if (m === 'W') c = P.white
      else if (m === 'M') c = P.redD
      else {
        const ramp = mats[m]
        if (!ramp) continue
        const t = Math.max(1, Math.min(4, parseInt(pc.B[j][i], 10) || 2))
        c = ramp[t - 1]
      }
      if (pc.C && pc.C[j] && pc.C[j][i] && pc.C[j][i] !== '.') c = pc.C[j][i]
      p.px(x + i, y + j, c)
    }
}

/* ---------- le joueur ---------- */
/**
 * Pose : 'idle0' 'idle1' 'run0'..'run3' 'punch0' 'punch1' 'elbow' 'throw' 'tackle0' 'tackle1'
 * 'stun' 'ko' 'hand'. Face : 'f' (face), 'b' (dos), 'p' (profil droit ; gauche = miroir).
 * Ancre aux pieds (ax, ay). Largeur variable, marge de 2 px pour le contour.
 */
export function player({ kit = 'france', look = 0, pose = 'idle0', face = 'f', number = null, flip = false } = {}) {
  const K = KITS[kit]
  const L = LOOKS[look % LOOKS.length]
  const mats = { H: RAMP[L.hair], S: RAMP[L.skin], J: RAMP[K.jersey], K: RAMP[K.jersey2 || K.jersey], R: RAMP[K.shorts], C: RAMP[K.socks], B: RAMP[K.boots] }
  const W = 36
  const H = 36
  const p = new Pix(W, H)
  const ox = 6 // x du bord gauche du gabarit 24 px
  const oy = 2 // y du haut du gabarit 32 px (rangée 0 = marge de bob)
  const bob = pose === 'idle1' || pose === 'run0' || pose === 'run2' ? -1 : 0
  const run = pose.startsWith('run') ? parseInt(pose[3], 10) : -1

  // Tête : matière des cheveux selon le look (chauve, barbe, bandeau).
  const headA = (face === 'b' ? HEAD_B_A : face === 'p' ? HEAD_P_A : HEAD_F_A).map((r) => r)
  const headB = face === 'b' ? HEAD_B_B : face === 'p' ? HEAD_P_B : HEAD_F_B
  let A = headA.slice()
  if (L.bald) A = A.map((r, y) => (y <= 6 || face === 'b' ? r.replace(/H/g, (m, i) => (y === 0 || (y <= 3 && (i === 1 || i === r.length - 2)) ? '.' : 'S')) : r))
  if (L.bald) A = A.map((r, y) => (y === 0 ? r.replace(/S/g, '.') : r))
  if (L.beard && face !== 'b') A = A.map((r, y) => (y >= 8 && y <= 11 ? r.replace(/S/g, (m, i) => (y === 10 && i >= 5 && i <= 8 ? 'S' : i < 2 || i > r.length - 3 ? 'S' : 'H')) : r))
  // Calque C de la tête : couleurs fixes (reflets des yeux, bandeau, yeux en croix).
  const hw = face === 'p' ? 12 : 14
  const C = Array.from({ length: 12 }, () => new Array(hw).fill('.'))
  if (face === 'f') {
    C[7][3] = P.white
    C[7][9] = P.white
    if (L.band) for (let x = 1; x <= 12; x++) C[4][x] = P.red
    if (pose === 'stun' || pose === 'ko') {
      for (const [x, y] of [[2, 7], [5, 7], [3, 8], [4, 8], [2, 9], [5, 9], [8, 7], [11, 7], [9, 8], [10, 8], [8, 9], [11, 9]]) C[y][x] = P.ink
      C[7][3] = '.'
      C[7][9] = '.'
      for (const [x, y] of [[3, 7], [4, 7], [9, 7], [10, 7], [3, 8], [4, 8], [9, 8], [10, 8]]) if (C[y][x] === '.') C[y][x] = RAMP[L.skin][2]
    }
  }
  if (face === 'p') {
    C[7][9] = P.white
    if (L.band) for (let x = 1; x <= 10; x++) C[4][x] = P.red
  }
  const head = piece(A, headB, C)
  // Pièces du corps selon l'orientation.
  const torsoW = face === 'p' ? 9 : 12
  const torsoA = fill(torsoW, 7, 'J')
  if (K.jersey2) for (let y = 0; y < 7; y++) torsoA[y] = torsoA[y].split('').map((m, x) => (Math.floor(x / 2) % 2 === 1 ? 'K' : 'J')).join('')
  if (K.accent) torsoA[0] = torsoA[0].split('').map((m, x) => m).join('')
  const torso = piece(torsoA)
  // Col et brassard de l'arbitre, numéro : calque C.
  if (K.accent) {
    torso.C = fill(torsoW, 7, '.').map((r) => r.split(''))
    for (let x = 0; x < torsoW; x++) torso.C[0][x] = K.accent
    if (face !== 'p') for (let y = 2; y < 4; y++) torso.C[y][0] = K.accent
  }
  if (number !== null && K.num && face !== 'p') {
    torso.C = torso.C || fill(torsoW, 7, '.').map((r) => r.split(''))
    if (face === 'b') {
      const g = glyph5(String(number))
      const gw = g.w
      const ox2 = Math.floor((torsoW - gw) / 2)
      g.rows.slice(2, 9).forEach((row, j) => {
        for (let i = 0; i < gw; i++) if (row[i] === '#') torso.C[j][ox2 + i] = K.num
      })
    } else {
      const digits = String(number).split('')
      const x0 = Math.floor((torsoW - (digits.length * 4 - 1)) / 2)
      digits.forEach((d, k) => glyph3(d).forEach((row, j) => {
        for (let i = 0; i < 3; i++) if (row[i] === '#' && j + 1 < 7) torso.C[j + 1][x0 + k * 4 + i] = K.num
      }))
    }
  }
  const shorts = piece(fill(torsoW, 4, 'R'))
  const arm = piece([...fill(3, 6, 'J'), ...fill(3, 2, 'S')])
  const armLong = piece([...fill(8, 3, 'J'), ...fill(3, 3, 'S').map((r) => r.padStart(8, '.'))].map((r, i) => (i >= 3 ? '.....SSS' : r)))
  const leg = (h) => piece(fill(4, h, 'C'))
  const boot = piece(['BBBBB', 'BBBBB'], ['22223', '11111'])
  const bootP = piece(['BBBBBB', 'BBBBBB'], ['222233', '111111'])

  // Placement (gabarit 24 × 32, y = 0 en haut, pieds en 31).
  const X = (x) => ox + x
  const Y = (y) => oy + y + bob

  if (pose === 'ko') {
    // Au sol : la pose idle de face couchée (quart de tour), yeux fermés, ancre au centre.
    const up = player({ kit, look, pose: 'stun', face: 'f', number })
    const q = up.rotate(1)
    q.ax = Math.floor(q.w / 2)
    q.ay = q.h - 3
    return q
  }

  if (pose.startsWith('tackle')) {
    // Tacle glissé, profil : tête à gauche, corps couché, jambe tendue vers la droite.
    const t = new Pix(44, 20)
    const slide = pose === 'tackle1' ? 1 : 0
    stamp(t, piece(fill(9, 7, 'J').map((r) => r), null), 13, 6 + slide, mats) // torse couché
    // Rayures Paraguay sur le torse couché.
    if (K.jersey2) stamp(t, piece(fill(9, 7, 'J').map((r, y) => r.split('').map((m, x) => (Math.floor(y / 2) % 2 === 1 ? 'K' : 'J')).join(''))), 13, 6 + slide, mats)
    stamp(t, piece(fill(5, 7, 'R')), 22, 6 + slide, mats) // short
    stamp(t, piece(fill(10, 4, 'C')), 27, 8 + slide, mats) // jambe tendue
    stamp(t, piece(['BBBBB', 'BBBBB', 'BBBBB'], ['22223', '22223', '11111']), 37, 8 + slide, mats) // crampon
    stamp(t, piece(fill(4, 5, 'C')), 23, 13 + slide, mats) // jambe repliée
    stamp(t, piece(['BBBB', 'BBBB'], ['2223', '1111']), 22, 17 + slide, mats)
    stamp(t, head, 1, 2, mats) // tête relevée
    stamp(t, piece([...fill(3, 5, 'J'), 'SSS', 'SSS']), 10, 10 + slide, mats) // bras d'appui
    const out = t.outline()
    out.ax = 22
    out.ay = 19
    return flip ? mirrorPix(out) : out
  }

  // Jambes et crampons.
  const legX = face === 'p' ? [8, 13] : [7, 13]
  const strideP = [
    [[-3, 7, 0], [4, 7, 0]], // run0 : grand écart
    [[0, 7, 0], [1, 7, 0]],
    [[4, 7, 0], [-3, 7, 0]],
    [[1, 7, 0], [0, 7, 0]],
  ]
  if (face === 'p') {
    const s = run >= 0 ? strideP[run] : [[0, 7, 0], [1, 7, 0]]
    // Jambe arrière puis jambe avant (devant).
    const order = [0, 1]
    for (const k of order) {
      const [dx, h] = s[k]
      const lx = X(legX[k] + dx)
      const lift = run >= 0 && Math.abs(dx) >= 3 ? 1 : 0
      stamp(p, leg(h - lift), lx, Y(22) + 0, mats)
      stamp(p, bootP, lx - (k === 0 ? 2 : 0), Y(29 - lift), mats)
    }
  } else {
    // Face / dos : la jambe levée est plus courte, le crampon remonte.
    const lifted = run === 0 ? 0 : run === 2 ? 1 : -1
    for (const k of [0, 1]) {
      const lift = lifted === k ? 3 : 0
      const lx = X(legX[k])
      stamp(p, leg(7 - lift), lx, Y(22), mats)
      stamp(p, boot, lx - 1 + (k === 1 ? 1 : 0), Y(29 - lift), mats)
    }
  }
  // Short, torse.
  const tx = face === 'p' ? 8 : 6
  stamp(p, shorts, X(tx), Y(18), mats)
  stamp(p, torso, X(tx), Y(11), mats)
  // Bras.
  if (face === 'p') {
    const swing = run === 0 ? -2 : run === 2 ? 2 : 0
    if (pose.startsWith('punch')) {
      const ext = pose === 'punch1' ? 0 : -4
      stamp(p, armLong, X(13 + ext), Y(12), mats)
    } else stamp(p, arm, X(11 + Math.sign(swing)), Y(12 + Math.abs(swing) / 2), mats)
  } else {
    const swingL = run === 0 ? -1 : run === 2 ? 1 : 0
    if (pose.startsWith('punch')) {
      stamp(p, arm, X(3), Y(12), mats)
      const ext = pose === 'punch1' ? 0 : -5
      stamp(p, armLong, X(18 + ext), Y(13), mats)
    } else if (pose === 'elbow') {
      stamp(p, arm, X(3), Y(12), mats)
      stamp(p, piece(['JJJJJJ', 'JJJJJJ', 'JJJJJJ', '...SSS']), X(16), Y(11), mats)
    } else if (pose === 'hand') {
      stamp(p, arm, X(3), Y(12), mats)
      stamp(p, piece(['JJJJJ.', 'JJJJJS', 'JJJJJS']), X(18), Y(13), mats)
    } else {
      stamp(p, arm, X(3), Y(12 + swingL), mats)
      stamp(p, arm, X(18), Y(12 - swingL), mats)
    }
  }
  // Tête (mord d'un pixel sur le torse).
  stamp(p, head, X(face === 'p' ? 6 : 5), Y(0), mats)
  const out = p.outline()
  out.ax = X(12)
  out.ay = oy + 31
  return flip ? mirrorPix(out) : out
}

export function mirrorPix(p) {
  const q = new Pix(p.w, p.h)
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) q.data[y * p.w + (p.w - 1 - x)] = p.data[y * p.w + x]
  q.ax = p.w - 1 - p.ax
  q.ay = p.ay
  return q
}

/* ---------- le carton jaune (interface dans le monde) ---------- */
export function cardSprite(blink = false) {
  const c = new Pix(8, 10)
  const Y = RAMP.yellow
  c.rect(1, 1, 6, 8, P.ink)
  c.rect(2, 2, 4, 6, blink ? P.white : Y[3])
  c.rect(2, 2, 4, 1, P.white)
  c.rect(5, 3, 1, 5, blink ? Y[3] : Y[2])
  c.ax = 4
  c.ay = 9
  return c
}

/* ---------- la flamme FUEGO ---------- */
/**
 * Couche derrière le joueur : goutte renversée en briques (paliers de 2 px), langues qui
 * montent et se détachent en particules. 4 images. Ancre : pieds du joueur.
 * `lean` : -1 (penche à gauche), 0, 1.
 */
export function flame(frame = 0, lean = 0) {
  const W = 44
  const H = 60
  const f = new Pix(W, H)
  const base = H - 4 // rangée des pieds
  const cx = W / 2
  const mask = Array.from({ length: H }, () => new Array(W).fill(false))
  const put = (x0, x1, y) => {
    if (y < 0 || y >= H) return
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) mask[y][x] = true
  }
  // Corps de la flamme : largeur par paliers de 2 rangées, des pieds (large) à la tête.
  const prof = [15, 15, 14, 14, 13, 13, 12, 12, 11, 11, 11, 10, 10, 10, 10, 10, 10, 10] // demi-largeurs, du bas vers le haut, par 2 rangées
  prof.forEach((hw, i) => {
    const y0 = base - i * 2
    const shift = Math.round(lean * i * 0.35)
    put(cx - hw + shift, cx + hw + shift, y0)
    put(cx - hw + shift, cx + hw + shift, y0 - 1)
  })
  // Langues au-dessus : 5 langues, hauteurs qui tournent avec l'image.
  const top = base - prof.length * 2
  const tongues = [
    { x: -9, w: 5, h: [6, 10, 8, 4] },
    { x: -4, w: 5, h: [10, 14, 12, 8] },
    { x: 0, w: 6, h: [16, 12, 18, 14] },
    { x: 4, w: 5, h: [8, 12, 10, 14] },
    { x: 8, w: 5, h: [4, 6, 10, 8] },
  ]
  for (const t of tongues) {
    const h = t.h[frame % 4]
    for (let j = 0; j < h; j += 2) {
      const shrink = Math.floor((j / h) * (t.w - 1))
      const w = Math.max(2, t.w - shrink)
      const x0 = cx + t.x - Math.floor(w / 2) + Math.round(lean * (prof.length * 2 + j) * 0.2)
      put(x0, x0 + w, top - j)
      put(x0, x0 + w, top - j - 1)
    }
    // Particule détachée au-dessus de la langue, une image sur deux.
    if ((frame + t.x) % 2 === 0) {
      const py = top - h - 4 - (frame % 2) * 2
      const px = cx + t.x + Math.round(lean * 6)
      put(px - 1, px + 1, py)
      put(px - 1, px + 1, py + 1)
    }
  }
  // Distance au bord (Chebyshev, érosion itérative) → couche de couleur.
  const dist = mask.map((r) => r.map((v) => (v ? 99 : 0)))
  for (let it = 1; it < 12; it++)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!mask[y][x] || dist[y][x] < it) continue
        const nb = [dist[y - 1]?.[x] ?? 0, dist[y + 1]?.[x] ?? 0, dist[y][x - 1] ?? 0, dist[y][x + 1] ?? 0]
        if (Math.min(...nb) < it) dist[y][x] = it
      }
  const col = (d, y) => {
    // Plus chaud vers le bas (les pieds) et vers le cœur.
    const heat = d + (y > base - 14 ? 1 : 0)
    if (heat <= 1) return P.redD
    if (heat <= 3) return P.red
    if (heat <= 6) return P.orange
    if (heat <= 8) return P.amber
    return P.yellow
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x]) f.px(x, y, col(dist[y][x], y))
  // Étincelles blanches, fixes par image.
  const sparks = [[-7, 20], [5, 28], [-2, 36], [9, 14], [-11, 10], [3, 44]]
  sparks.forEach(([sx, sy], i) => {
    if ((i + frame) % 3 === 0) return
    const x = Math.round(cx + sx + lean * 3)
    const y = base - sy - (frame % 2)
    if (mask[y]?.[x]) f.px(x, y, P.white)
  })
  f.ax = cx
  f.ay = base
  return f
}

/* ---------- les étoiles de l'assommé (couche à part, comme la flamme) ---------- */
/**
 * `count` étoiles (2 ou 3) qui tournent autour de la tête sur une ellipse vue de dessus :
 * celles qui passent derrière la tête montent d'un pixel et pâlissent. 8 images par tour.
 * Deux pièces : `back` à dessiner avant le joueur, `front` après. Ancre : pieds du joueur.
 */
export function stars(frame = 0, count = 3) {
  const W = 36
  const H = 44
  const mk = () => { const p = new Pix(W, H); p.ax = W / 2; p.ay = H - 2; return p }
  const back = mk()
  const front = mk()
  const cx = W / 2
  const cy = H - 2 - 33 // juste au-dessus du crâne
  const rx = 11
  const ry = 3
  for (let k = 0; k < count; k++) {
    const a = ((frame % 8) / 8 + k / count) * Math.PI * 2
    const x = Math.round(cx + Math.cos(a) * rx)
    const behind = Math.sin(a) < 0
    const y = Math.round(cy + Math.sin(a) * ry) - (behind ? 1 : 0)
    const dst = behind ? back : front
    const c1 = behind ? P.amber : P.yellow
    const c2 = behind ? P.orange : P.amber
    // Étoile en brique : croix de 5 avec un cœur, plus une pointe diagonale sur deux images.
    dst.px(x, y, c1)
    dst.px(x - 1, y, c2)
    dst.px(x + 1, y, c2)
    dst.px(x, y - 1, c2)
    dst.px(x, y + 1, c2)
    if ((frame + k) % 2 === 0) {
      dst.px(x - 2, y, c2)
      dst.px(x + 2, y, c2)
    } else {
      dst.px(x, y - 2, c2)
      dst.px(x, y + 2, c2)
    }
    dst.px(x, y, P.white)
  }
  return { back: back.outline(), front: front.outline() }
}

/* ---------- pelouse et ombre ---------- */
export function grass(w, h, { lines = true } = {}) {
  const g = new Pix(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const band = Math.floor(x / 24) % 2
      let c = band ? P.greenD : P.greenM
      if ((((x * 374761393 + y * 668265263) ^ (x * y * 2246822519)) >>> 0) % 29 === 0) c = band ? P.greenM : P.green
      g.px(x, y, c)
    }
  if (lines) {
    g.rect(0, 0, w, 1, P.grey1)
    g.rect(0, h - 1, w, 1, P.grey1)
    g.rect(Math.floor(w / 2), 0, 1, h, P.grey1)
  }
  return g
}
/** Ombre portée : la pelouse assombrie d'un ton dans un rectangle aux coins coupés, décalé en bas à droite. */
export function shadow(dst, x, y, w = 12) {
  for (let j = -1; j <= 2; j++)
    for (let i = -Math.floor(w / 2) + 2; i < Math.ceil(w / 2) + 2; i++) {
      const edge = (j === -1 || j === 2) && (i === -Math.floor(w / 2) + 2 || i === Math.ceil(w / 2) + 1)
      if (edge) continue
      const c = dst.get(x + i, y + j)
      if (c) dst.px(x + i, y + j, darker(c))
    }
}
export const ALL_POSES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'punch0', 'punch1', 'elbow', 'hand', 'stun', 'ko', 'tackle0', 'tackle1']
