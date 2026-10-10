// Planche de sprites : node cons-de-mime/test/sheet.mjs > /tmp/sheet.png (vérifie que tout se construit en Node).
import { Pix } from '../pixel.js'
import { buildSprites } from '../sprites.js'
import { pixToPng } from './png.mjs'
const C = { GH: 270, roadTop: 16, roadBottom: 70, beachTop: 204, seaTop: 246 }
const S = buildSprites(C)
const items = []
const push = (name, p) => items.push([name, p])
S.serge.forEach((p, i) => push('serge' + i, p)); S.sergeBoost.forEach((p, i) => push('sergeB' + i, p)); push('sergeLook', S.sergeLook[0]); push('sergeTrip', S.sergeTrip)
S.killer.forEach((p, i) => push('killer' + i, p)); push('taunt', S.killerTaunt)
for (const k of Object.keys(S.ped)) S.ped[k].forEach((v, i) => { push(k + i, v[0]); push(k + i + 'b', v[1]); push(k + i + 'L', S.pedLying[k][i]) })
push('chien', S.chien[0]); push('chienL', S.chienLying); S.mime.forEach((p, i) => push('mime' + i, p)); S.roller.forEach((p, i) => push('roller' + i, p))
S.mamie.forEach((p, i) => push('mamie' + i, p)); push('mamieL', S.mamieLying); push('splat', S.mamieSplat); push('truck', S.truck)
for (const [k, p] of Object.entries(S.furn)) push(k, p)
S.palm.forEach((p, i) => push('palm' + i, p)); S.parasol.forEach((p, i) => push('parasol' + i, p)); S.serviette.forEach((p, i) => push('serv' + i, p)); push('bateau', S.bateau)
S.boom.forEach((p, i) => push('boom' + i, p)); S.boomBig.forEach((p, i) => push('boomB' + i, p)); S.gas.forEach((p, i) => push('gas' + i, p)); push('scorch', S.scorch)
push('palais', S.facade.palais); push('carlton', S.facade.carlton); push('hotel', S.facade.hotel[0]); push('boutique', S.facade.boutique)
push('tile', S.tile)
// Mise en page simple en lignes de 480 px.
let x = 0, y = 0, rowH = 0
const placed = []
for (const [name, p] of items) {
  if (x + p.w > 480) { x = 0; y += rowH + 2; rowH = 0 }
  placed.push([x, y, p]); x += p.w + 2; rowH = Math.max(rowH, p.h)
}
const sheet = new Pix(480, y + rowH + 2)
for (const [px, py, p] of placed) sheet.blit(p, px, py)
process.stdout.write(pixToPng(sheet, 2, '#404040'))
console.error('sprites:', items.length, 'sheet', sheet.w, 'x', sheet.h)
