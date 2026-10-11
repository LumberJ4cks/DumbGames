// Les absurdes : personnages dessinés en procédural (formes pleines + trait), volontairement loin
// du pantin des joueurs. Provisoires : à remplacer par de vrais sprites. Chaque dessin tient dans
// 48 × 48, pieds en 47, centre en 24, comme les rotations PixelLab.
//   node carton-plein/art/absurdes.mjs [échelle] > planche.png
import { Pix, PAL } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
const P = PAL

/** Jambes et pieds : `step` 0 debout, 1 et 2 pas de course (une jambe devant, l'autre derrière). */
function legs(p, cx, top, c, boots, step = 0, gap = 3) {
  const lx = cx - gap - 1, rx = cx + gap - 1
  const dl = step === 1 ? -2 : step === 2 ? 2 : 0
  p.rect(lx, top + Math.max(0, -dl), 3, 47 - top - Math.max(0, -dl), c)
  p.rect(rx, top + Math.max(0, dl), 3, 47 - top - Math.max(0, dl), c)
  p.rect(lx - 1, 46 - Math.max(0, -dl), 5, 2, boots)
  p.rect(rx - 1, 46 - Math.max(0, dl), 5, 2, boots)
}
function eyes(p, cx, y, c = P.ink, gap = 3) { p.px(cx - gap, y, c); p.px(cx + gap - 1, y, c) }
function arms(p, cx, top, len, c, swing = 0) {
  p.rect(cx - 10, top + swing, 3, len, c)
  p.rect(cx + 7, top - swing, 3, len, c)
}

const DRAW = {
  // Un homme en costume de banane : grand croissant jaune, trou pour le visage, jambes en collant.
  banane(p, step) {
    const cx = 24
    for (let y = 6; y < 36; y++) { const t = (y - 6) / 30; const w = 4 + Math.sin(t * Math.PI) * 7; const bend = Math.round(Math.sin(t * Math.PI) * -4); p.rect(Math.round(cx - w + bend), y, Math.round(w * 2), 1, y % 7 === 0 ? P.amber : P.yellow) }
    p.rect(cx - 3, 3, 4, 4, P.clay); p.px(cx - 2, 2, P.brown)
    p.disc(cx - 1, 17, 5, 6, P.skinL); eyes(p, cx - 1, 16); p.rect(cx - 2, 20, 3, 1, P.redD)
    arms(p, cx, 20, 9, P.yellow, step === 1 ? 2 : step === 2 ? -2 : 0)
    legs(p, cx, 35, P.yellow, P.brown, step)
  },
  // Supporter à écharpe : bonnet, doudoune bleue, jean, écharpe tricolore qui pend.
  echarpe(p, step) {
    const cx = 24
    p.disc(cx, 13, 6, 6, P.skinL); p.rect(cx - 7, 6, 14, 5, P.blueD); p.px(cx, 4, P.red); p.px(cx - 1, 4, P.red)
    eyes(p, cx, 13); p.rect(cx - 2, 16, 4, 1, P.redD)
    p.rect(cx - 9, 19, 18, 13, P.blue); p.rect(cx - 9, 23, 18, 1, P.blueD); p.rect(cx - 9, 27, 18, 1, P.blueD)
    p.rect(cx - 7, 18, 14, 3, P.blue); p.rect(cx - 7, 18, 5, 3, P.red); p.rect(cx + 2, 18, 5, 3, P.white)
    p.rect(cx + 5, 21, 3, 12, P.red); p.rect(cx + 5, 25, 3, 2, P.white); p.rect(cx + 5, 29, 3, 2, P.blue)
    arms(p, cx, 20, 10, P.blue, step === 1 ? 2 : step === 2 ? -2 : 0)
    legs(p, cx, 32, P.slate, P.white, step)
  },
  // Supporter normal : torse nu peint en bleu, bedaine, casquette, bière.
  supporter(p, step) {
    const cx = 24
    p.disc(cx, 13, 6, 6, P.skin); p.rect(cx - 7, 7, 14, 3, P.red); p.rect(cx, 9, 10, 2, P.red)
    eyes(p, cx, 13); p.rect(cx - 3, 16, 6, 1, P.redD)
    p.disc(cx, 26, 10, 8, P.skin); p.rect(cx - 6, 20, 12, 3, P.blue); p.rect(cx - 3, 23, 6, 3, P.white); p.rect(cx - 2, 26, 4, 3, P.red)
    arms(p, cx, 20, 9, P.skin, step === 1 ? 2 : step === 2 ? -2 : 0)
    p.rect(cx + 7, 17, 4, 5, P.amber); p.rect(cx + 7, 16, 4, 1, P.white)
    legs(p, cx, 33, P.slateD, P.ink, step, 4)
  },
  // Une poule : gros corps blanc, crête, bec, pattes jaunes.
  poule(p, step) {
    const cx = 24
    p.disc(cx, 30, 12, 9, P.white); p.disc(cx - 10, 30, 5, 5, P.grey1)
    p.rect(cx + 2, 12, 9, 12, P.white); p.disc(cx + 7, 11, 5, 5, P.white)
    p.rect(cx + 5, 4, 2, 3, P.red); p.rect(cx + 8, 3, 2, 4, P.red); p.rect(cx + 11, 4, 2, 3, P.red)
    p.px(cx + 10, 10, P.ink); p.rect(cx + 12, 12, 4, 2, P.amber); p.rect(cx + 9, 15, 3, 3, P.red)
    const dl = step === 1 ? -2 : step === 2 ? 2 : 0
    p.rect(cx - 4, 38 + Math.max(0, -dl), 2, 9 - Math.max(0, -dl), P.amber); p.rect(cx + 3, 38 + Math.max(0, dl), 2, 9 - Math.max(0, dl), P.amber)
    p.rect(cx - 6, 46, 5, 1, P.amber); p.rect(cx + 2, 46, 5, 1, P.amber)
  },
  // La mascotte : tête géante en mousse, bleue, bec et crête de coq, petit corps.
  mascotte(p, step) {
    const cx = 24
    p.disc(cx, 15, 14, 13, P.blue); p.disc(cx - 5, 12, 3, 4, P.white); p.disc(cx + 5, 12, 3, 4, P.white)
    p.px(cx - 5, 13, P.ink); p.px(cx + 5, 13, P.ink); p.rect(cx - 2, 20, 5, 3, P.amber)
    p.rect(cx - 4, 0, 2, 3, P.red); p.rect(cx - 1, -1, 2, 4, P.red); p.rect(cx + 2, 0, 2, 3, P.red)
    p.rect(cx - 6, 28, 12, 8, P.blue); p.rect(cx - 6, 28, 12, 2, P.white)
    arms(p, cx, 29, 7, P.blue, step === 1 ? 2 : step === 2 ? -2 : 0)
    legs(p, cx, 36, P.blue, P.red, step)
  },
  // Un CRS : casque noir à visière, tenue sombre, bouclier.
  crs(p, step) {
    const cx = 24
    p.disc(cx, 12, 7, 7, P.ink); p.rect(cx - 6, 11, 12, 5, P.cyan); p.rect(cx - 6, 16, 12, 2, P.skinL)
    p.rect(cx - 8, 19, 16, 14, P.slateD); p.rect(cx - 8, 19, 16, 2, P.slate); p.rect(cx - 2, 22, 4, 8, P.slate)
    p.rect(cx + 8, 17, 7, 16, P.grey1); p.rect(cx + 9, 18, 5, 14, P.white); p.rect(cx + 10, 24, 3, 3, P.red)
    p.rect(cx - 10, 20, 3, 10, P.slateD)
    legs(p, cx, 33, P.slateD, P.ink, step)
  },
  // Le streaker : tout nu, bandeau de censure, bras en l'air.
  streaker(p, step) {
    const cx = 24
    p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 6, 6, 12, 3, P.tan); eyes(p, cx, 12); p.rect(cx - 3, 15, 6, 2, P.redD)
    p.rect(cx - 7, 18, 14, 14, P.skinL); p.rect(cx - 5, 21, 10, 1, P.skin)
    p.rect(cx - 11, 6, 3, 14, P.skinL); p.rect(cx + 8, 4, 3, 16, P.skinL)
    p.rect(cx - 8, 30, 16, 5, P.ink); p.rect(cx - 7, 31, 14, 3, P.white); p.rect(cx - 5, 32, 10, 1, P.ink)
    legs(p, cx, 35, P.skinL, P.skin, step)
  },
  // Une mamie : voûtée, manteau violet, chignon gris, canne, sac à main.
  mamie(p, step) {
    const cx = 24
    p.disc(cx, 16, 6, 6, P.skinL); p.disc(cx - 1, 9, 4, 3, P.grey1); p.rect(cx - 6, 11, 12, 2, P.grey1)
    eyes(p, cx, 16); p.rect(cx - 4, 15, 3, 1, P.grey3); p.rect(cx + 1, 15, 3, 1, P.grey3); p.rect(cx - 2, 19, 4, 1, P.redD)
    p.rect(cx - 9, 22, 18, 15, P.purple); p.rect(cx - 9, 22, 18, 2, P.magenta); p.rect(cx - 1, 24, 2, 11, P.magenta)
    p.rect(cx - 12, 24, 3, 10, P.purple); p.rect(cx + 9, 24, 3, 10, P.purple)
    p.rect(cx + 11, 34, 2, 13, P.brown); p.rect(cx + 10, 33, 4, 2, P.brown)
    p.rect(cx - 15, 32, 6, 5, P.redD); p.rect(cx - 14, 31, 4, 1, P.redD)
    legs(p, cx, 37, P.sand, P.ink, step)
  },
}

/** Toutes les images d'un absurde : idle, run (2 pas), hit, fall, knocked, ko ; même dessin dans les 8 directions. */
export function absurdFrames(name) {
  const draw = DRAW[name]
  const frame = (step) => { const p = new Pix(48, 48); draw(p, step); const o = p.outline(); o.ax = 24; o.ay = 47; return o }
  const idle = frame(0), run1 = frame(1), run2 = frame(2)
  // Touché : décalé et penché d'un pixel par bande.
  const hit = new Pix(48, 48)
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const c = idle.get(x, y); if (c) hit.px(x + 2 - Math.floor(y / 16), y, c) }
  hit.ax = 24; hit.ay = 47
  // Au sol : couché, le bas du corps à droite, posé sur la ligne des pieds.
  const lying = idle.rotate(1) // 48 × 48 toujours
  const ko = new Pix(48, 48)
  const b = lying.bounds()
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const c = lying.get(x, y); if (c) ko.px(x, y + (47 - (b.y + b.h - 1)), c) }
  ko.ax = 24; ko.ay = 47
  const fall = idle.rotate(-1); fall.ax = 24; fall.ay = 47
  const all = (list) => Object.fromEntries(['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'].map((d) => [d, list]))
  return { idle: all([idle]), run: all([run1, idle, run2, idle]), hit: all([hit]), fall: all([fall, ko]), knocked: all([fall]), ko: all([ko]) }
}
export const ABSURD_NAMES = Object.keys(DRAW)

if (process.argv[1] && process.argv[1].endsWith('absurdes.mjs')) {
  const scale = Number(process.argv[2] || 4)
  const g = new Pix(ABSURD_NAMES.length * 52 + 8, 3 * 52)
  g.rect(0, 0, g.w, g.h, P.green)
  ABSURD_NAMES.forEach((n, i) => {
    const a = absurdFrames(n)
    g.blit(a.idle.s[0], 4 + i * 52, 2)
    g.blit(a.run.s[0], 4 + i * 52, 54)
    g.blit(a.ko.s[0], 4 + i * 52, 106)
  })
  process.stdout.write(pixToPng(g, scale))
}
