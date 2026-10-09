// Sprite sheet: every sprite on the game background, scaled ×3. node attention-a-la-mousse/test/sheet.mjs out.png
import fs from 'node:fs'
import { Pix, PAL } from '../pixel.js'
import { CONFIG } from '../game.js'
import * as Sp from '../sprites.js'
import { logoLine } from '../font5.js'
import { pixToPng } from './png.mjs'

const C = CONFIG
const W = 320
const H = 180
const out = process.argv[2] || 'sheet.png'
const bg = Sp.backgroundSprite(C, W, H)
const sheet = new Pix(W * 2, H * 3)
// Background twice (plain, and as the base of the sheet).
sheet.blit(bg, 0, 0)
for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) if (!sheet.data[y * sheet.w + x]) sheet.data[y * sheet.w + x] = y < H ? (x < W ? null : PAL.slateD) : PAL.grey3
const S = Sp.buildSprites(C)
const put = (p, x, y) => sheet.blit(p, Math.round(x - p.ax), Math.round(y - p.ay))
// Column 1: skaters, every pose and kind.
let x = W + 14
let y = 30
const looks = [
  { H: 'red', J: 'blue', D: 'black', S: 'skinPale', bib: true },
  { H: 'yellow', J: 'green', D: 'navy', S: 'skinTan', bib: false },
  { H: 'white', J: 'pink', D: 'red', S: 'skinDark', bib: true },
]
const poses = [
  ['plain', 'swingA', 'stride', 1, 'normal'], ['plain', 'swingB', 'together', 1, 'normal'],
  ['panic', 'upA', 'stride', 1, 'normal'], ['panic', 'upB', 'together', 1, 'normal'],
  ['plain', 'stiff', 'together', 0, 'normal'], ['plain', 'upA', 'together', 0, 'normal'],
  ['panic', 'star', 'star', 0, 'normal'], ['plain', 'stiff', 'stride', 2, 'fast'], ['plain', 'star', 'together', 0, 'slow'],
  ['panic', 'upA', 'stride', -1, 'hesitant'],
]
looks.forEach((look, li) => {
  poses.forEach(([head, arms, legs, lean, kind], pi) => {
    put(Sp.skaterSprite(look, { head, arms, legs, lean, kind }), x + pi * 18, y + li * 28)
  })
})
// Fallen (rotated) skaters.
const fallen = Sp.skaterSprite(looks[0], { head: 'panic', arms: 'star', legs: 'star', lean: 0, kind: 'normal' })
;[1, 2, 3].forEach((k, i) => put(fallen.rotate(k), x + 190 + i * 30, y + 20))
// Column 2: intruders, volunteers, spectators, pigeons, photographer.
y = 120
put(S.maire[0], x, y); put(S.maire[1], x + 18, y); put(S.maireUp[0], x + 36, y)
put(S.secouriste[0], x + 60, y); put(S.secouriste[1], x + 78, y); put(S.secouristeUp[1], x + 96, y)
put(S.chien[0], x + 120, y); put(S.chien[1], x + 140, y)
put(S.poussette[0], x + 175, y); put(S.poussette[1], x + 205, y)
put(S.volunteer[0], x + 240, y); put(S.volunteer[1], x + 256, y); put(S.volunteer[2], x + 272, y)
y = 170
const specLooks = [
  { skin: 'skinPale', hair: 'hairBrown', shirt: 'red', v: 0 }, { skin: 'skinTan', hair: 'hairBlond', shirt: 'blue', v: 1 },
  { skin: 'skinDark', hair: 'hairBlack', shirt: 'yellow', v: 2 }, { skin: 'skinPale', hair: 'hairGrey', shirt: 'green', v: 4 },
  { skin: 'skinTan', hair: 'hairRed', shirt: 'purple', v: 6 },
]
specLooks.forEach((l, i) => { put(Sp.spectatorSprite(l, 0), x + i * 14, y); put(Sp.spectatorSprite(l, 1), x + 80 + i * 14, y) })
;['idle', 'peck', 'up', 'down'].forEach((k, i) => put(S.pigeon[k], x + 170 + i * 14, y))
put(S.photographer[0], x + 240, y + 6); put(S.photographer[1], x + 262, y + 6)
// Row 3 (left): truck, mat, arch, barrier, table, signs, boards, UI.
y = H + 60
put(S.truck[1], 70, y)
put(S.truck[0], 140, y)
Sp.drawMatInto((px, py, c) => sheet.px(px, py - 100 + H + 10, c), (yy) => 150 + (yy - C.TRACK_TOP) * C.SLANT, 0, C)
Sp.drawMatInto((px, py, c) => sheet.px(px, py - 100 + H + 10, c), (yy) => 170 + (yy - C.TRACK_TOP) * C.SLANT, C.MAT_EXTENSION, C)
put(S.archPost, 220, y); put(S.banner, 230, H + 10)
put(S.barrier, 10, H + 100); put(S.table, 50, H + 100)
put(S.signRavito, 100, H + 86); put(S.signRalentir, 130, H + 86)
S.boards.forEach((b, i) => put(b, 10 + i * 64, H + 120))
put(S.sound[0], 10, H + 150); put(S.sound[1], 32, H + 150); put(S.stamp, 60, H + 152)
put(Sp.panelSprite(60, 20, Sp.RAMPS?.navy || [PAL.ink, PAL.slateD, PAL.slate, PAL.grey3]), 90, H + 146)
put(logoLine('ATTENTION'), 160, H + 140)
put(logoLine('À LA MOUSSE !'), 160, H + 164)
// Row 4-5: the 2× background with the live scene composed (skaters on track, crowd).
sheet.blit(bg, 0, H * 2)
// Crowd rows.
let cx = 2
let i = 0
while (cx < W) {
  const l = specLooks[i % specLooks.length]
  put(Sp.spectatorSprite({ ...l, v: i }, i % 7 === 0 ? 1 : 0), cx, H * 2 + 90 - (i % 2) * 5)
  cx += 8 + (i % 3)
  i++
}
for (let bx = 0; bx < W; bx += 34) put(S.barrier, bx, H * 2 + 100)
put(S.table, 34, H * 2 + 95); put(S.signRavito, 36, H * 2 + 79)
put(S.volunteer[0], 67, H * 2 + 92); put(S.volunteer[1], 180, H * 2 + 100); put(S.volunteer[2], 262, H * 2 + 100)
put(S.signRalentir, 165, H * 2 + 62)
Sp.drawMatInto((px, py, c) => sheet.px(px, py + H * 2, c), (yy) => C.MAT_X + (yy - C.TRACK_TOP) * C.SLANT, 0, C)
put(S.archPostBack, C.FINISH_X - 4 + 0, H * 2 + C.TRACK_TOP + 2)
;[[40, 120, 0], [70, 130, 1], [150, 125, 2], [190, 138, 3], [200, 120, 7], [120, 140, 8], [230, 128, 4]].forEach(([sx, sy, pi]) =>
  put(Sp.skaterSprite(looks[pi % 3], { head: poses[pi][0], arms: poses[pi][1], legs: poses[pi][2], lean: poses[pi][3], kind: poses[pi][4] }), sx, H * 2 + sy))
put(S.maire[0], 100, H * 2 + 130); put(S.chien[1], 260, H * 2 + 145); put(S.pigeon.idle, 205, H * 2 + 150)
put(S.archPost, C.FINISH_X + 6 + (C.TRACK_BOTTOM - 2 - C.TRACK_TOP) * C.SLANT, H * 2 + C.TRACK_BOTTOM - 2)
put(S.banner, 74, H * 2 + 16)
S.boards.forEach((b, k) => put(b, -6 + k * 66, H * 2 + 163))
put(S.hud, 0, H * 2)
put(S.sound[0], W - 20, H * 2 + 1)
fs.writeFileSync(out, pixToPng(sheet, 3, '#000000'))
console.log('wrote', out, sheet.w * 3, 'x', sheet.h * 3)
