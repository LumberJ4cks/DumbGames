// Planche de validation du style des joueurs : node carton-plein/art/proto.mjs > planche.png
// Compare proportions (réaliste 22 px / Kunio 32 px / Kunio+ 36 px) × profondeur de palette
// (NES 1 ton + contour noir / 3 tons / 4 tons), puis montre la densité en jeu et les poses.
import { Pix, PAL, RAMPS, darker } from '../../cons-de-mime/pixel.js'
import { glyph3 } from '../../cons-de-mime/font.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'

const P = PAL
const R = RAMPS

/* ---------- profondeur de palette ---------- */
const MODES = {
  nes: { label: 'NES 1 TON', ramp: (r) => [r[2]], outline: 'full' },
  r3: { label: '3 TONS', ramp: (r) => [r[1], r[2], r[3]], outline: 'sel' },
  r4: { label: '4 TONS', ramp: (r) => r, outline: 'sel' },
  r3full: { label: '3 TONS + NOIR', ramp: (r) => [r[1], r[2], r[3]], outline: 'full' },
}

/* ---------- proportions ---------- */
// H hauteur totale, hw/hh tête, bw/bh buste, sh short, lw/lh jambes, aw bras, bt bottes, sk chaussettes.
const PROPS = {
  real: { label: 'REALISTE 22', H: 22, hw: 7, hh: 6, bw: 7, bh: 6, sh: 3, lw: 2, lh: 5, aw: 2, eye: 1, gap: 1 },
  kunio: { label: 'KUNIO 32', H: 32, hw: 14, hh: 12, bw: 12, bh: 7, sh: 4, lw: 4, lh: 6, aw: 3, eye: 2, gap: 1 },
  kunioPlus: { label: 'KUNIO+ 36', H: 36, hw: 18, hh: 15, bw: 12, bh: 7, sh: 4, lw: 4, lh: 6, aw: 3, eye: 2, gap: 1 },
}

/* ---------- maillots ---------- */
const KITS = {
  france: { jersey: 'blue', shorts: 'white', socks: 'red', boots: 'black', stripes: null, num: P.white },
  paraguay: { jersey: 'red', shorts: 'blue', socks: 'blue', boots: 'black', stripes: 'white', num: P.ink },
  arbitre: { jersey: 'black', shorts: 'black', socks: 'black', boots: 'black', stripes: null, collar: P.amber },
  gardien: { jersey: 'yellow', shorts: 'black', socks: 'yellow', boots: 'black' },
  staff: { jersey: 'navy', shorts: 'navy', socks: 'white', boots: 'black', suit: true },
}
const LOOKS = [
  { skin: 'skinPale', hair: 'hairBrown' }, { skin: 'skinDark', hair: 'hairBlack' }, { skin: 'skinTan', hair: 'hairBlack', beard: true, band: true },
  { skin: 'skinPale', hair: 'hairBlond', long: true }, { skin: 'skinDark', hair: 'hairBlack', bald: true }, { skin: 'skinTan', hair: 'hairBrown' },
  { skin: 'skinPale', hair: 'hairRed' }, { skin: 'skinDark', hair: 'hairBlack', beard: true }, { skin: 'skinTan', hair: 'hairBlack', long: true },
  { skin: 'skinPale', hair: 'hairBlack', beard: true }, { skin: 'skinDark', hair: 'hairBlack' },
]

/* ---------- contours ---------- */
function outlineFull(p) {
  const out = p.clone()
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y)) continue
      if (p.get(x - 1, y) || p.get(x + 1, y) || p.get(x, y - 1) || p.get(x, y + 1)) out.data[y * p.w + x] = P.ink
    }
  return out
}

/* ---------- le joueur ---------- */
/**
 * pose : 'idle' | 'runA' | 'runB' | 'punch' | 'tackle' | 'ko'. Ancre aux pieds. Vue de face
 * légèrement de dessus (la tête mord sur le buste, les pieds sont courts).
 */
export function player({ prop = 'kunio', mode = 'r4', kit = 'france', look = 0, pose = 'idle', fire = false, card = null, number = null }) {
  const Q = PROPS[prop]
  const M = MODES[mode]
  const K = KITS[kit]
  const L = LOOKS[look % LOOKS.length]
  const rp = (name) => M.ramp(R[name])
  const Sk = rp(L.skin), Hr = rp(L.hair), J = rp(K.jersey), Sh = rp(K.shorts), So = rp(K.socks), Bo = rp(K.boots)
  const W = Math.max(Q.hw, Q.bw + 2 * Q.aw + 2) + 10
  const Hh = Q.H + (card ? 10 : 0) + (fire ? 6 : 0)
  const p = new Pix(W + 4, Hh + 6)
  const ox = Math.floor(p.w / 2), oy = p.h - 3
  const px = (x, y, c) => p.px(ox + x, oy + y, c)
  const rect = (x, y, w, h, c) => p.rect(ox + x, oy + y, w, h, c)
  const cyl = (x, y, w, h, ramp) => p.cyl(ox + x, oy + y, w, h, ramp)
  const ell = (cx, cy, rx, ry, ramp, lift) => p.ell(ox + cx, oy + cy, rx, ry, ramp, lift)

  const run = pose === 'runA' ? 1 : pose === 'runB' ? -1 : 0
  const legY = -(Q.lh)
  // Jambes : chaussettes puis bottes, l'une avancée l'autre reculée en course.
  const legs = [[-Q.lw - Q.gap + Math.floor(Q.lw / 2) - Math.floor(Q.lw / 2), run > 0 ? -1 : 0], [Q.gap, run < 0 ? -1 : 0]]
  for (const [lx, dy] of legs) {
    const lift = run && dy ? 1 : 0
    cyl(lx, legY + dy - lift, Q.lw, Q.lh - 1 - lift, So)
    rect(lx - (Q.lw > 2 ? 1 : 0), dy - lift, Q.lw + (Q.lw > 2 ? 1 : 0), Q.lw > 2 ? 2 : 1, Bo[Math.min(1, Bo.length - 1)])
    if (Bo.length > 1) px(lx + Q.lw - 1 + (Q.lw > 2 ? 0 : 0), dy - lift + (Q.lw > 2 ? 1 : 0), Bo[0])
  }
  // Short.
  const shY = legY - Q.sh + 1
  cyl(-Math.floor(Q.bw / 2), shY, Q.bw, Q.sh, Sh)
  // Buste.
  const bY = shY - Q.bh
  cyl(-Math.floor(Q.bw / 2), bY, Q.bw, Q.bh, J)
  if (K.stripes) {
    const St = rp(K.stripes)
    for (let i = 0; i < Q.bw; i++) if (Math.floor((i + 1) / 2) % 2 === 1) for (let j = 0; j < Q.bh; j++) px(-Math.floor(Q.bw / 2) + i, bY + j, St[Math.min(St.length - 1, Math.max(0, St.length - 1 - (i > Q.bw / 2 ? 1 : 0)))])
  }
  if (K.collar) rect(-1, bY, 2, 1, K.collar)
  if (number !== null && Q.bw >= 10) {
    const rows = glyph3(String(number))
    rows.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') px(-1 + i, bY + 1 + j, K.num) })
  }
  // Bras : le long du corps, balancier en course, tendu pour le poing.
  const armH = Math.max(3, Q.bh - 1)
  const arms = [[-Math.floor(Q.bw / 2) - Q.aw, run > 0 ? -1 : run < 0 ? 1 : 0], [Math.ceil(Q.bw / 2), run < 0 ? -1 : run > 0 ? 1 : 0]]
  arms.forEach(([ax, dy], i) => {
    if (pose === 'punch' && i === 1) {
      // Bras droit tendu vers la droite, poing serré.
      cyl(ax, bY + 1, Q.aw + 4, Math.max(2, Q.aw), J)
      rect(ax + Q.aw + 4, bY + 1, Q.aw, Math.max(2, Q.aw), Sk[Sk.length - 1])
      return
    }
    cyl(ax, bY + dy, Q.aw, armH - 1, J)
    rect(ax, bY + dy + armH - 1, Q.aw, Math.max(1, Q.aw - 1), Sk[Math.min(1, Sk.length - 1)])
  })
  // Tête : grosse, posée sur le buste (elle mord d'une ligne).
  const hcx = 0, hcy = bY - Math.floor(Q.hh / 2) + 1
  ell(hcx, hcy, Q.hw / 2, Q.hh / 2, Sk, 0.05)
  // Cheveux : la calotte de l'ellipse au-dessus de la ligne du front, plus les pattes.
  if (!L.bald) {
    const hair = new Pix(p.w, p.h)
    hair.ell(ox + hcx, oy + hcy, Q.hw / 2, Q.hh / 2, Hr, 0)
    const top = oy + hcy - Q.hh / 2
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = hair.data[y * p.w + x]
        if (!c) continue
        const yr = (y - top) / Q.hh
        const dx = Math.abs(x - ox)
        const fringe = ((x + (Q.hw > 10 ? 1 : 0)) % 3 === 0 ? 1 / Q.hh : 0)
        const cap = yr < (L.long ? 0.3 : 0.36) + fringe
        const side = dx >= Q.hw / 2 - (Q.hw > 10 ? 2 : 1) && yr < (L.long ? 1 : 0.62)
        if (cap || side) p.data[y * p.w + x] = c
      }
  }
  if (L.band && Q.hh >= 12) {
    const by = oy + hcy - Math.floor(Q.hh / 2) + Math.floor(Q.hh * 0.36)
    for (let x = 0; x < p.w; x++) if (p.get(x, by) && p.get(x, by) !== P.ink) p.px(x, by, P.red)
  }
  // Visage : yeux noirs avec reflet, bouche, barbe.
  const ey = hcy + (Q.hh >= 12 ? 1 : 0)
  const ex = Q.hw >= 14 ? 3 : Q.hw >= 10 ? 2 : 1
  for (const sx of [-ex - Q.eye + 1, ex]) {
    rect(sx, ey, Q.eye, Q.eye, P.ink)
    if (Q.eye > 1 && mode !== 'nes') px(sx, ey, P.white)
  }
  if (Q.hh >= 12) rect(-1, ey + 3, 2, 1, mode === 'nes' ? P.ink : P.redD)
  if (L.beard && Q.hh >= 12) {
    for (let i = -Math.floor(Q.hw / 2) + 2; i < Math.floor(Q.hw / 2) - 1; i++) for (let j = ey + 2; j <= hcy + Math.floor(Q.hh / 2) - 1; j++) {
      if (Math.abs(i) <= 1 && j === ey + 3) continue
      if (p.get(ox + i, oy + j) && p.get(ox + i, oy + j) !== P.ink && p.get(ox + i, oy + j) !== P.redD) px(i, j, Hr[Math.min(1, Hr.length - 1)])
    }
  }
  let out = M.outline === 'full' ? outlineFull(p) : p.outline()
  if (pose === 'tackle') {
    out = out.rotate(1)
    // Jambe tendue devant : on allonge la jambe du bas de 6 px.
    const q = new Pix(out.w + 8, out.h)
    q.blit(out, 0, 0)
    const b = out.bounds()
    const sockC = So[So.length - 1]
    q.rect(b.x + b.w, b.y + b.h - Q.lw - 2, 6, Q.lw, sockC)
    q.rect(b.x + b.w + 6, b.y + b.h - Q.lw - 2, 2, Q.lw, Bo[Math.min(1, Bo.length - 1)])
    q.ax = Math.floor(q.w / 2); q.ay = q.h - 3
    out = M.outline === 'full' ? outlineFull(q) : q.outline()
    return out
  }
  if (pose === 'ko') {
    out = out.rotate(3)
    out.ax = Math.floor(out.w / 2); out.ay = out.h - 3
    return out
  }
  if (card) {
    const cy = oy - Q.H - 9
    const ramp = card === 'red' ? R.red : R.yellow
    p2rect(out, ox - 2, cy, 4, 6, ramp[2]); out.px(ox - 2, cy, ramp[3]); out.rect(ox + 1, cy + 1, 1, 5, ramp[1]); out.rect(ox - 2, cy + 5, 4, 1, ramp[1])
    out.rect(ox - 3, cy - 1, 6, 1, P.ink); out.rect(ox - 3, cy + 6, 6, 1, P.ink); out.rect(ox - 3, cy, 1, 6, P.ink); out.rect(ox + 2, cy, 1, 6, P.ink)
  }
  if (fire) {
    // Flammes : rideau derrière tout le corps, plus haut au-dessus de la tête, traînée aux pieds.
    const F = [P.redD, P.orange, P.yellow]
    const top = oy - Q.H
    for (let i = -Math.floor(Q.hw / 2) - 3; i <= Math.floor(Q.hw / 2) + 3; i++) {
      const wave = Math.abs(Math.sin(i * 1.7 + 0.4))
      const h = 2 + Math.floor(4 * wave) + (Math.abs(i) < 3 ? 3 : 0)
      for (let j = -Q.H + 4; j < h; j++) {
        const x = ox + i, y = top - j
        if (out.get(x, y)) continue
        const edge = Math.abs(i) > Q.hw / 2 + 1 || j >= 0
        const v = j < 0 ? (edge ? (j < -Q.H / 2 ? 0 : 1) : null) : Math.min(2, Math.floor((j / h) * 3))
        if (v === null) continue
        if (j < 0 && ((x + y) & 1) && j > -Q.H / 2) continue
        out.px(x, y, F[v])
      }
    }
  }
  out.ax = ox; out.ay = oy
  return out
}
function p2rect(p, x, y, w, h, c) { p.rect(x, y, w, h, c) }
/** Carton seul, à dessiner dans une passe au-dessus de tous les joueurs (sinon le joueur du rang précédent le cache). */
export function cardSprite(kind) {
  const c = new Pix(8, 10)
  const ramp = kind === 'red' ? R.red : R.yellow
  c.rect(2, 2, 4, 6, ramp[2]); c.px(2, 2, ramp[3]); c.rect(5, 3, 1, 5, ramp[1]); c.rect(2, 7, 4, 1, ramp[1])
  c.rect(1, 1, 6, 1, P.ink); c.rect(1, 8, 6, 1, P.ink); c.rect(1, 2, 1, 6, P.ink); c.rect(6, 2, 1, 6, P.ink)
  c.ax = 4; c.ay = 9
  return c
}

/* ---------- pelouse ---------- */
function grass(w, h, mode = 'r4') {
  const g = new Pix(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const band = Math.floor(x / 24) % 2
      let c = band ? P.greenM : P.green
      if (mode === 'nes') c = band ? P.greenM : P.green
      else if (((x * 7 + y * 13) % 23) === 0) c = darker(c)
      g.px(x, y, c)
    }
  // Lignes.
  g.rect(0, 0, w, 1, P.white); g.rect(0, h - 1, w, 1, P.white); g.rect(Math.floor(w / 2), 0, 1, h, P.white)
  g.disc(Math.floor(w / 2), Math.floor(h / 2), 22, 14, P.white); g.disc(Math.floor(w / 2), Math.floor(h / 2), 21, 13, P.green)
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (g.get(x, y) === P.green && Math.floor(x / 24) % 2 && Math.abs(Math.hypot((x - w / 2) / 22, (y - h / 2) / 14) - 0.5) < 0.5) g.px(x, y, P.greenM)
  return g
}
function shadow(dst, x, y, w) {
  for (let i = -w; i <= w; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2 === 0 && Math.abs(i) / w + Math.abs(j) <= 1.4) { const c = dst.get(x + i, y + j); if (c) dst.px(x + i, y + j, darker(c)) }
}

/* ---------- planche ---------- */
const MAIN = process.argv[1] && process.argv[1].endsWith('proto.mjs')
if (MAIN) {
function label(p, text, x, y, c = P.white) {
  let cx = x
  for (const ch of text) { const rows = glyph3(ch); rows.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(cx + i, y + j, c) }); cx += 4 }
}
const sheet = new Pix(400, 362)
sheet.rect(0, 0, sheet.w, sheet.h, P.slateD)
label(sheet, 'CARTON PLEIN - PROPORTIONS X PALETTE', 4, 3)
// Grille.
const cols = Object.keys(PROPS), rows = Object.keys(MODES)
const colX = [20, 100, 200], rowY = [52, 102, 152, 202]
cols.forEach((c, i) => label(sheet, PROPS[c].label, colX[i], 14, P.grey1))
rows.forEach((m, j) => label(sheet, MODES[m].label, 4, rowY[j] - 30, P.grey1))
rows.forEach((m, j) => cols.forEach((c, i) => {
  const base = colX[i]
  const g = grass(70, 44, m)
  const y0 = rowY[j] - 36
  sheet.blit(g, base - 4, y0)
  const items = [player({ prop: c, mode: m, kit: 'france', look: 0, pose: 'idle', number: 10 }), player({ prop: c, mode: m, kit: 'paraguay', look: 2, pose: 'runA', number: 4 }), player({ prop: c, mode: m, kit: 'arbitre', look: 4 })]
  let x = base + 8
  for (const it of items) { shadow(sheet, x, y0 + 40, Math.floor(it.w / 4)); sheet.blit(it, x - it.ax, y0 + 40 - it.ay); x += 22 }
}))
// Densité en jeu (Kunio 32, 4 tons) : la moitié de terrain avec onze Français.
label(sheet, 'EN JEU : KUNIO 32 / 4 TONS, ONZE FRANCAIS + LE 4 + ARBITRE (ECHELLE 1:1)', 4, 220, P.grey1)
const pitch = grass(392, 112)
const F = [[20, 70], [66, 44], [60, 68], [66, 92], [70, 108], [124, 40], [118, 62], [126, 86], [130, 108], [184, 52], [190, 90]]
F.forEach(([x, y], i) => { const s = player({ kit: i === 0 ? 'gardien' : 'france', look: i, pose: i % 3 === 0 ? 'runA' : i % 3 === 1 ? 'runB' : 'idle', number: i + 1 }); shadow(pitch, x, y, 6); pitch.blit(s, x - s.ax, y - s.ay) })
const cards = () => F.forEach(([x, y], i) => { const k = i === 7 ? 'yellow' : i === 3 ? 'red' : null; if (!k) return; const c = cardSprite(k); pitch.blit(c, x - c.ax, y - 34 - c.ay) })
const t4 = player({ kit: 'paraguay', look: 2, pose: 'tackle', number: 4 }); shadow(pitch, 165, 76, 10); pitch.blit(t4, 165 - t4.ax, 76 - t4.ay)
const ko = player({ kit: 'france', look: 5, pose: 'ko', number: 9 }); pitch.blit(ko, 152 - ko.ax, 72 - ko.ay)
const ref = player({ kit: 'arbitre', look: 4, pose: 'runB' }); shadow(pitch, 240, 84, 6); pitch.blit(ref, 240 - ref.ax, 84 - ref.ay)
const fire = player({ kit: 'paraguay', look: 2, pose: 'runA', fire: true, number: 4 }); shadow(pitch, 300, 76, 6); pitch.blit(fire, 300 - fire.ax, 76 - fire.ay)
const punch = player({ kit: 'paraguay', look: 2, pose: 'punch', number: 4 }); shadow(pitch, 340, 60, 6); pitch.blit(punch, 340 - punch.ax, 60 - punch.ay)
const vict = player({ kit: 'france', look: 8, pose: 'idle', number: 7 }); shadow(pitch, 364, 60, 6); pitch.blit(vict, 364 - vict.ax, 60 - vict.ay)
cards()
sheet.blit(pitch, 4, 230)
label(sheet, 'DE GAUCHE A DROITE : GARDIEN, 4-4-2, CARTONS JAUNE ET ROUGE, KO AU SOL, TACLE, ARBITRE, EN FEU, POING', 4, 346, P.grey2)
process.stdout.write(pixToPng(sheet, 3, '#262b44'))
console.error('planche', sheet.w, 'x', sheet.h)
}
