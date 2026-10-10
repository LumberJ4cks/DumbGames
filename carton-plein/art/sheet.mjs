// Planches de validation : node carton-plein/art/sheet.mjs <palette|sprites|scene|anim> > fichier.png
// `anim` sort un GIF animé (gif.mjs).
import fs from 'node:fs'
import { Pix, PAL } from '../../cons-de-mime/pixel.js'
import { glyph3 } from '../../cons-de-mime/font.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { pixToGif } from './gif.mjs'
import { player, flame, stars, grass, shadow, cardSprite, RAMP, KITS, LOOKS, ALL_POSES } from './players.mjs'

const P = PAL
const label = (p, text, x, y, c = P.grey1) => {
  let cx = x
  for (const ch of text) {
    const rows = glyph3(ch)
    rows.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') p.px(cx + i, y + j, c) })
    cx += 4
  }
}
const grey = (c) => {
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16)
  const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  return '#' + l.toString(16).padStart(2, '0').repeat(3)
}
const toGrey = (p) => { const q = p.clone(); q.data = q.data.map((c) => (c ? grey(c) : null)); return q }

/* ---------- le CRS de Barricasse, pour comparaison ---------- */
const CRS_UPPER = ['....................', '......kkkkk.........', '.....khhkkkk........', '....kkhkkkkkk.......', '....kkkkkkkVVV......', '....KkkkkkVSSv......', '....KKkkkkVSsv......', '.....KKKKKvvvv......', '......nSSn..........', '....PPNNNNPP........', '...PNNNNNNNNP.......', '...nNNWWWWNNNN......', '...nNNNNNNNNNN......', '...nNNNNNNNNn.......', '....nNNNNNNn........', '....BBBGBBBB........']
const CRS_LEGS = ['....LLLLlLLL........', '....LLL..LLL........', '....LPL..LPL........', '....LLL..LLL........', '....LLL..LLL........', '...OOOO..OOOO.......']
const CRS_COL = { K: P.slateD, k: P.slate, h: P.grey2, V: P.cyan, v: P.blue, S: P.skinL, s: P.skin, N: P.slate, n: P.slateD, P: P.grey3, W: P.grey1, B: P.ink, G: P.amber, L: P.slateD, l: P.slate, O: P.ink }
function crs() {
  const p = new Pix(24, 27)
  CRS_LEGS.forEach((row, y) => { for (let x = 0; x < 20; x++) if (row[x] !== '.') p.px(x + 2, 18 + y, CRS_COL[row[x]]) })
  CRS_UPPER.forEach((row, y) => { for (let x = 0; x < 20; x++) if (row[x] !== '.') p.px(x + 2, y + 2, CRS_COL[row[x]]) })
  const o = p.outline(); o.ax = 10; o.ay = 25; return o
}

const put = (dst, spr, x, y, withShadow = true) => { if (withShadow) shadow(dst, x, y, Math.min(14, spr.w - 12)); dst.blit(spr, x - spr.ax, y - spr.ay) }

function palette() {
  const names = Object.keys(RAMP)
  const sheet = new Pix(300, 14 + names.length * 10)
  sheet.rect(0, 0, sheet.w, sheet.h, P.slateD)
  label(sheet, 'RAMPES (4 TONS)  COULEUR / GRIS', 4, 3)
  names.forEach((n, i) => {
    const y = 14 + i * 10
    label(sheet, n.toUpperCase(), 4, y + 1, P.grey2)
    RAMP[n].forEach((c, t) => { sheet.rect(60 + t * 10, y, 10, 8, c); sheet.rect(110 + t * 10, y, 10, 8, grey(c)) })
  })
  // Les trois maillots côte à côte, couleur et gris.
  const g = grass(140, 44)
  const kits = ['france', 'paraguay', 'arbitre', 'gardien']
  kits.forEach((k, i) => put(g, player({ kit: k, look: i, pose: 'idle0', number: 10 }), 18 + i * 34, 40))
  sheet.rect(160, 14, 140, 44, null)
  const g2 = toGrey(g)
  const big = new Pix(sheet.w, sheet.h + 100)
  big.rect(0, 0, big.w, big.h, P.slateD)
  big.blit(sheet, 0, 0)
  big.blit(g, 4, sheet.h + 4)
  big.blit(g2, 150, sheet.h + 4)
  label(big, 'FRANCE / PARAGUAY / ARBITRE / GARDIEN SUR PELOUSE, PUIS EN GRIS', 4, sheet.h + 52)
  return big
}

function sprites() {
  const faces = [['f', 'FACE'], ['b', 'DOS'], ['p', 'PROFIL']]
  const sets = [['france', 0, 10], ['paraguay', 12, 4], ['arbitre', 11, null]]
  const colW = 40
  const sheet = new Pix(16 + ALL_POSES.length * colW, 30 + sets.length * faces.length * 46 + 70)
  sheet.rect(0, 0, sheet.w, sheet.h, P.slateD)
  label(sheet, 'SPRITES COMPLETS — METHODE CALQUES A/B/C — ECHELLE 1:1 (x3 A L AFFICHAGE)', 4, 3)
  ALL_POSES.forEach((pose, i) => label(sheet, pose.toUpperCase(), 16 + i * colW, 12, P.grey2))
  let y = 22
  for (const [kit, look, num] of sets)
    for (const [face, fname] of faces) {
      const row = grass(sheet.w - 8, 44, { lines: false })
      label(row, (kit + ' ' + fname).toUpperCase(), 2, 2, P.white)
      ALL_POSES.forEach((pose, i) => {
        if (face !== 'p' && pose.startsWith('tackle')) return
        if (face === 'p' && (pose === 'elbow' || pose === 'hand')) return
        const s = player({ kit, look, pose, face, number: num })
        put(row, s, 16 + i * colW + 12 - 4, 41)
      })
      sheet.blit(row, 4, y)
      y += 46
    }
  // Le CRS à côté d'un Français, et le carton.
  const cmp = grass(200, 60, { lines: false })
  label(cmp, 'CRS BARRICASSE / FRANCAIS / PARAGUAY N4 / CARTON', 2, 2, P.white)
  put(cmp, crs(), 20, 54)
  put(cmp, player({ kit: 'france', look: 0, number: 7 }), 60, 54)
  put(cmp, player({ kit: 'paraguay', look: 12, number: 4 }), 100, 54)
  const f8 = player({ kit: 'france', look: 5, number: 8 })
  put(cmp, f8, 140, 54)
  const c = cardSprite(false); cmp.blit(c, 140 - c.ax, 54 - 34 - c.ay)
  sheet.blit(cmp, 4, y + 2)
  // La flamme : 4 images, immobile.
  const fl = grass(220, 66, { lines: false })
  label(fl, 'FUEGO, 4 IMAGES', 2, 2, P.white)
  for (let i = 0; i < 4; i++) {
    const x = 28 + i * 50
    const F = flame(i, 0)
    fl.blit(F, x - F.ax, 60 - F.ay)
    put(fl, player({ kit: 'paraguay', look: 12, pose: 'run' + i, number: 4 }), x, 60)
  }
  sheet.blit(fl, 210, y + 2)
  const se = grass(130, 66, { lines: false })
  label(se, 'ETOILES, 8 IMAGES', 2, 2, P.white)
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 32
    const st = stars(i * 2, 3)
    se.blit(st.back, x - st.back.ax, 60 - st.back.ay)
    put(se, player({ kit: 'france', look: i, pose: 'stun', number: 5 }), x, 60)
    se.blit(st.front, x - st.front.ax, 60 - st.front.ay)
  }
  sheet.blit(se, 436, y + 2)
  return sheet
}

function scene() {
  const pitch = grass(392, 120)
  const F = [[20, 72], [66, 46], [60, 70], [66, 94], [70, 112], [124, 42], [118, 64], [126, 88], [130, 112], [184, 54], [190, 92]]
  F.forEach(([x, y], i) => put(pitch, player({ kit: i === 0 ? 'gardien' : 'france', look: i, pose: i % 3 === 0 ? 'run0' : i % 3 === 1 ? 'run2' : 'idle0', face: i % 2 ? 'b' : 'f', number: i + 1 }), x, y))
  const yc = cardSprite(false); pitch.blit(yc, 126 - yc.ax, 88 - 36 - yc.ay)
  const ko = player({ kit: 'france', look: 5, pose: 'ko', number: 9 }); pitch.blit(ko, 152 - ko.ax, 74 - ko.ay)
  put(pitch, player({ kit: 'paraguay', look: 12, pose: 'tackle0', number: 4 }), 170, 80)
  put(pitch, player({ kit: 'arbitre', look: 11, pose: 'run1', face: 'p' }), 240, 86)
  const F1 = flame(1, -1); pitch.blit(F1, 300 - F1.ax, 78 - F1.ay)
  put(pitch, player({ kit: 'paraguay', look: 12, pose: 'run1', face: 'p', number: 4 }), 300, 78)
  put(pitch, player({ kit: 'paraguay', look: 12, pose: 'punch1', number: 4 }), 340, 60)
  const st = stars(2, 3); pitch.blit(st.back, 364 - st.back.ax, 60 - st.back.ay)
  put(pitch, player({ kit: 'france', look: 8, pose: 'stun', number: 7 }), 364, 60)
  pitch.blit(st.front, 364 - st.front.ax, 60 - st.front.ay)
  return pitch
}

function anim() {
  const frames = []
  for (let i = 0; i < 8; i++) {
    const fr = i % 4
    const g = grass(390, 70, { lines: false })
    put(g, player({ kit: 'france', look: 0, pose: 'run' + fr, face: 'f', number: 10 }), 24, 60)
    put(g, player({ kit: 'france', look: 1, pose: 'run' + fr, face: 'b', number: 10 }), 60, 60)
    put(g, player({ kit: 'france', look: 3, pose: 'run' + fr, face: 'p', number: 10 }), 96, 60)
    put(g, player({ kit: 'paraguay', look: 12, pose: i % 8 < 4 ? 'idle' + (fr % 2) : 'punch' + (fr % 2), number: 4 }), 136, 60)
    const Fl = flame(fr, 1); g.blit(Fl, 190 - Fl.ax, 60 - Fl.ay)
    put(g, player({ kit: 'paraguay', look: 12, pose: 'run' + fr, face: 'p', number: 4 }), 190, 60)
    put(g, player({ kit: 'paraguay', look: 12, pose: 'tackle' + (fr % 2), number: 4 }), 250, 62)
    put(g, player({ kit: 'arbitre', look: 11, pose: 'run' + fr, face: 'p' }), 285, 60)
    const st = stars(i, 3); g.blit(st.back, 330 - st.back.ax, 60 - st.back.ay)
    put(g, player({ kit: 'france', look: 8, pose: 'stun', number: 7 }), 330, 60)
    g.blit(st.front, 330 - st.front.ax, 60 - st.front.ay)
    const s2 = stars(i, 2); g.blit(s2.back, 366 - s2.back.ax, 60 - s2.back.ay)
    put(g, player({ kit: 'france', look: 3, pose: 'stun', face: 'b', number: 2 }), 366, 60)
    g.blit(s2.front, 366 - s2.front.ax, 60 - s2.front.ay)
    frames.push(g)
  }
  return pixToGif(frames, { scale: 4, delay: 12 })
}

const what = process.argv[2] || 'sprites'
if (what === 'anim') process.stdout.write(anim())
else {
  const p = what === 'palette' ? palette() : what === 'scene' ? scene() : sprites()
  process.stdout.write(pixToPng(p, 3, '#262b44'))
  console.error(what, p.w, 'x', p.h)
}
