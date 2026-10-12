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

  // Le vendeur de hot-dogs : casquette, tablier, plateau en bandoulière garni.
  hotdog(p, step) {
    const cx = 24
    p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 7, 6, 14, 3, P.white); p.rect(cx - 7, 8, 14, 1, P.red); eyes(p, cx, 12); p.rect(cx - 2, 15, 4, 1, P.redD)
    p.rect(cx - 8, 18, 16, 14, P.white); p.rect(cx - 8, 18, 16, 2, P.red); p.rect(cx - 1, 20, 2, 12, P.red)
    p.rect(cx - 13, 24, 26, 6, P.clay); p.rect(cx - 12, 22, 24, 3, P.sand)
    for (let i = 0; i < 5; i++) { p.rect(cx - 11 + i * 5, 22, 3, 2, P.redD); p.px(cx - 10 + i * 5, 22, P.amber) }
    p.line(cx - 12, 24, cx - 4, 17, P.brown); p.line(cx + 12, 24, cx + 4, 17, P.brown)
    legs(p, cx, 32, P.slateD, P.ink, step)
  },
  // Le marié : costume noir, nœud papillon, cheveux gominés.
  marie(p, step) {
    const cx = 24
    p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 6, 6, 12, 3, P.ink); p.rect(cx - 6, 9, 2, 3, P.ink); eyes(p, cx, 12); p.rect(cx - 2, 15, 4, 1, P.redD)
    p.rect(cx - 8, 18, 16, 15, P.ink); p.rect(cx - 2, 18, 4, 15, P.white); p.rect(cx - 3, 18, 6, 2, P.red); p.px(cx, 19, P.ink)
    arms(p, cx, 19, 11, P.ink, step === 1 ? 2 : step === 2 ? -2 : 0); p.px(cx + 8, 30, P.skinL); p.px(cx - 9, 30, P.skinL)
    legs(p, cx, 33, P.ink, P.ink, step)
  },
  // La mariée : voile, robe blanche en cloche, bouquet.
  mariee(p, step) {
    const cx = 24
    p.rect(cx - 8, 4, 16, 14, P.grey1); p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 7, 5, 14, 3, P.white); p.rect(cx - 1, 2, 2, 3, P.amber)
    eyes(p, cx, 12); p.rect(cx - 2, 15, 4, 1, P.red)
    p.rect(cx - 6, 18, 12, 8, P.white)
    for (let y = 26; y < 44; y++) p.rect(cx - 6 - Math.round((y - 26) * 0.6), y, 12 + Math.round((y - 26) * 1.2), 1, y % 5 === 0 ? P.grey1 : P.white)
    p.rect(cx - 10, 20, 3, 9, P.skinL); p.rect(cx + 7, 20, 3, 9, P.skinL)
    p.disc(cx - 10, 30, 3, 3, P.pink); p.px(cx - 11, 29, P.red); p.px(cx - 9, 31, P.yellow)
    p.rect(cx - 4, 44, 3, 3, P.white); p.rect(cx + 1, 44, 3, 3, P.white)
    if (step) p.rect(cx - 7, 44, 14, 1, P.grey1)
  },
  // Le commentateur télé : casque audio, micro-casque, veste beige, bloc-notes.
  commentateur(p, step) {
    const cx = 24
    p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 6, 6, 12, 3, P.brown); p.rect(cx - 8, 9, 3, 6, P.ink); p.rect(cx + 5, 9, 3, 6, P.ink); p.rect(cx - 7, 5, 14, 2, P.ink)
    eyes(p, cx, 12); p.rect(cx - 3, 16, 6, 1, P.ink); p.rect(cx + 2, 14, 4, 1, P.grey3); p.px(cx + 1, 16, P.grey1)
    p.rect(cx - 8, 18, 16, 15, P.sand); p.rect(cx - 2, 18, 4, 15, P.white); p.rect(cx - 1, 19, 2, 8, P.red)
    arms(p, cx, 19, 11, P.sand, step === 1 ? 2 : step === 2 ? -2 : 0); p.rect(cx + 6, 26, 6, 5, P.white); p.rect(cx + 7, 27, 4, 1, P.ink); p.rect(cx + 7, 29, 3, 1, P.ink)
    legs(p, cx, 33, P.slate, P.brown, step)
  },
  // Un pigeon : petit, gris, cou vert, œil rond.
  pigeon(p, step) {
    const cx = 24
    p.disc(cx, 40, 7, 5, P.grey2); p.disc(cx - 6, 39, 3, 2, P.grey3); p.rect(cx + 2, 41, 6, 1, P.grey3)
    p.disc(cx + 5, 33, 3, 3, P.grey2); p.rect(cx + 4, 35, 3, 2, P.greenM); p.px(cx + 6, 32, P.orange); p.px(cx + 8, 33, P.amber)
    const dl = step === 1 ? -1 : step === 2 ? 1 : 0
    p.rect(cx - 2 + dl, 44, 1, 3, P.orange); p.rect(cx + 2 - dl, 44, 1, 3, P.orange); p.rect(cx - 3 + dl, 46, 3, 1, P.orange); p.rect(cx + 1 - dl, 46, 3, 1, P.orange)
    if (step) { p.rect(cx - 8, 34, 10, 2, P.grey1); p.rect(cx - 10, 32, 6, 2, P.grey1) }
  },
  // Le gendarme à cheval : grand cheval brun, cavalier en képi.
  cheval(p, step) {
    const cx = 24
    p.rect(cx - 16, 24, 30, 12, P.brown); p.disc(cx - 16, 27, 3, 4, P.brown); p.rect(cx + 8, 16, 7, 12, P.brown); p.disc(cx + 13, 15, 5, 4, P.brown); p.rect(cx + 15, 16, 4, 3, P.clay)
    p.px(cx + 14, 13, P.ink); p.rect(cx + 10, 10, 2, 3, P.brown); p.rect(cx + 7, 14, 2, 12, P.ink)
    const dl = step === 1 ? -2 : step === 2 ? 2 : 0
    p.rect(cx - 14, 36 + Math.max(0, -dl), 3, 11 - Math.max(0, -dl), P.brown); p.rect(cx - 8, 36 + Math.max(0, dl), 3, 11 - Math.max(0, dl), P.brown)
    p.rect(cx + 4, 36 + Math.max(0, dl), 3, 11 - Math.max(0, dl), P.brown); p.rect(cx + 10, 36 + Math.max(0, -dl), 3, 11 - Math.max(0, -dl), P.brown)
    p.rect(cx - 18, 24, 3, 10, P.plum)
    p.disc(cx - 2, 8, 5, 5, P.skinL); p.rect(cx - 7, 3, 10, 3, P.blueD); p.rect(cx - 7, 5, 11, 1, P.ink); eyes(p, cx - 2, 8)
    p.rect(cx - 7, 13, 11, 11, P.blueD); p.rect(cx - 7, 13, 11, 1, P.amber); p.rect(cx - 9, 15, 3, 7, P.blueD); p.rect(cx + 3, 15, 3, 7, P.blueD)
    p.rect(cx - 9, 24, 3, 8, P.slateD); p.rect(cx + 4, 24, 3, 8, P.slateD); p.rect(cx - 10, 31, 4, 2, P.ink); p.rect(cx + 4, 31, 4, 2, P.ink)
  },
  // Le kiné à la civière : blouse blanche, sacoche, civière roulée dans le dos.
  civiere(p, step) {
    const cx = 24
    p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 6, 6, 12, 3, P.grey3); eyes(p, cx, 12); p.rect(cx - 2, 15, 4, 1, P.redD)
    p.rect(cx - 8, 18, 16, 15, P.white); p.rect(cx - 2, 20, 4, 2, P.red); p.rect(cx - 1, 19, 2, 4, P.red)
    p.rect(cx - 16, 14, 4, 24, P.tan); p.rect(cx + 12, 14, 4, 24, P.tan); p.rect(cx - 14, 16, 28, 2, P.green); p.rect(cx - 14, 34, 28, 2, P.green)
    arms(p, cx, 19, 11, P.white, 0)
    legs(p, cx, 33, P.white, P.ink, step)
  },
  // Le ramasseur de balles : gamin, short, dossard fluo, trop rapide.
  ramasseur(p, step) {
    const cx = 24
    p.disc(cx, 20, 5, 5, P.skin); p.rect(cx - 5, 15, 10, 3, P.ink); eyes(p, cx, 20, P.ink, 2); p.rect(cx - 1, 23, 3, 1, P.redD)
    p.rect(cx - 6, 25, 12, 10, P.yellow); p.rect(cx - 6, 25, 12, 1, P.green); p.rect(cx - 3, 28, 6, 4, P.ink)
    p.rect(cx - 8, 26, 2, 8, P.skin); p.rect(cx + 6, 26, 2, 8, P.skin)
    legs(p, cx, 35, P.skin, P.white, step, 2); p.rect(cx - 5, 35, 10, 4, P.slateD)
  },
  // Le président de la fédération : costume bleu, écharpe tricolore, cheveux blancs plaqués.
  president(p, step) {
    const cx = 24
    p.disc(cx, 12, 6, 6, P.skinL); p.rect(cx - 6, 6, 12, 2, P.white); p.rect(cx - 6, 8, 2, 4, P.white); p.rect(cx + 4, 8, 2, 4, P.white)
    eyes(p, cx, 12); p.rect(cx - 2, 15, 4, 1, P.redD); p.rect(cx - 2, 13, 4, 1, P.grey2)
    p.rect(cx - 9, 18, 18, 16, P.blueD); p.rect(cx - 2, 18, 4, 16, P.white); p.rect(cx - 1, 19, 2, 10, P.red)
    for (let i = 0; i < 3; i++) p.rect(cx - 9, 22 + i * 2, 18, 2, [P.blue, P.white, P.red][i])
    arms(p, cx, 19, 12, P.blueD, step === 1 ? 2 : step === 2 ? -2 : 0)
    legs(p, cx, 34, P.blueD, P.ink, step)
  },
  // Un musicien de la fanfare : veste rouge à brandebourgs, shako, grosse caisse.
  musicien(p, step) {
    const cx = 24
    p.disc(cx, 13, 6, 6, P.skinL); p.rect(cx - 6, 2, 12, 7, P.red); p.rect(cx - 6, 8, 12, 1, P.amber); p.rect(cx - 1, 0, 2, 3, P.white)
    eyes(p, cx, 13); p.rect(cx - 2, 16, 4, 1, P.redD)
    p.rect(cx - 8, 19, 16, 8, P.red); p.rect(cx - 6, 20, 12, 1, P.amber); p.rect(cx - 6, 23, 12, 1, P.amber)
    p.disc(cx, 32, 11, 7, P.white); p.rect(cx - 11, 26, 22, 2, P.blue); p.rect(cx - 11, 36, 22, 2, P.blue); p.rect(cx - 2, 29, 4, 6, P.red)
    p.rect(cx - 12, 20, 3, 9, P.red); p.rect(cx + 9, 20, 3, 9, P.red); p.rect(cx + 9, 28 + (step === 1 ? -3 : 0), 2, 8, P.tan)
    legs(p, cx, 38, P.slate, P.ink, step)
  },
  // Le dinosaure gonflable : costume T-Rex vert, gros ventre, petits bras.
  dino(p, step) {
    const cx = 24
    p.disc(cx, 30, 11, 10, P.green); p.disc(cx, 32, 6, 6, P.cream)
    p.rect(cx - 4, 8, 16, 12, P.green); p.disc(cx + 8, 13, 6, 5, P.green); p.rect(cx + 10, 15, 6, 3, P.cream)
    p.px(cx + 9, 11, P.white); p.px(cx + 10, 11, P.ink); for (let i = 0; i < 4; i++) p.px(cx + 4 + i * 3, 18, P.white)
    p.rect(cx - 2, 2, 3, 6, P.skinL); p.rect(cx - 3, 1, 5, 2, P.skinL)
    p.rect(cx + 2, 24, 4, 2, P.green); p.rect(cx + 5, 26, 2, 2, P.green); p.rect(cx - 7, 24, 4, 2, P.green)
    p.rect(cx - 20, 34, 10, 4, P.green); p.rect(cx - 16, 32, 6, 3, P.green)
    const dl = step === 1 ? -2 : step === 2 ? 2 : 0
    p.rect(cx - 7, 39 + Math.max(0, -dl), 5, 8 - Math.max(0, -dl), P.green); p.rect(cx + 2, 39 + Math.max(0, dl), 5, 8 - Math.max(0, dl), P.green)
    p.rect(cx - 9, 46, 8, 1, P.greenM); p.rect(cx + 1, 46, 8, 1, P.greenM)
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
  const g = new Pix(10 * 52 + 8, Math.ceil(ABSURD_NAMES.length / 10) * 3 * 52)
  g.rect(0, 0, g.w, g.h, P.green)
  ABSURD_NAMES.forEach((n, i) => {
    const a = absurdFrames(n)
    const x = 4 + (i % 10) * 52, y = Math.floor(i / 10) * 156
    g.blit(a.idle.s[0], x, y + 2)
    g.blit(a.run.s[0], x, y + 54)
    g.blit(a.ko.s[0], x, y + 106)
  })
  process.stdout.write(pixToPng(g, scale))
}
