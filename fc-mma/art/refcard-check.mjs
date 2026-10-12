// Planche de contrôle : les 9 images de l'arbitre au carton (jaune, rouge) et son idle, agrandies ×4.
import fs from 'node:fs'
import { Pix, PAL } from '../../cons-de-mime/pixel.js'
import { pixToPng } from '../../cons-de-mime/test/png.mjs'
import { toPix } from './pixellab-check.mjs'
const meta = JSON.parse(fs.readFileSync('carton-plein/sprites/arbitre.json', 'utf8'))
const sheet = toPix('carton-plein/sprites/arbitre.png', false)
const g = new Pix(10 * 64, 2 * 64)
g.rect(0, 0, g.w, g.h, PAL.green)
const put = (idx, col, row) => { const sx = (idx % meta.cols) * meta.cell, sy = Math.floor(idx / meta.cols) * meta.cell; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const c = sheet.get(sx + x, sy + y); if (c) g.px(col * 64 + x, row * 64 + y, c) } }
meta.anims.card.s.forEach((i, k) => put(i, k, 0))
meta.anims.redcard.s.forEach((i, k) => put(i, k, 1))
put(meta.anims.idle.s[0], 9, 0)
put(meta.anims.run.s[0], 9, 1)
process.stdout.write(pixToPng(g, 4))
