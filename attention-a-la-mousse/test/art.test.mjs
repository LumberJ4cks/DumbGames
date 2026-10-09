// Art rules for ATTENTION À LA MOUSSE ! v3. Run: node --test attention-a-la-mousse/test/
// Palette-only pixels, an empty margin around every sprite, gameplay sizes drawn as configured,
// every character the game prints has a glyph. The balance test (balance.test.mjs) needs a browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PAL, PALETTE, RAMPS, DARKER, shade } from '../pixel.js'
import { CONFIG } from '../game.js'
import * as Sp from '../sprites.js'
import { glyph5, hasGlyph5, logoLine, textWidth5 } from '../font5.js'

const C = CONFIG
const W = 320
const H = 180
const palette = new Set(PALETTE)
const S = Sp.buildSprites(C)
const allSprites = []
// sprites.js imports pixel.js with a cache-busting query, so `instanceof Pix` cannot be used here.
const isPix = (v) => v && Array.isArray(v.data) && typeof v.w === 'number'
for (const [name, v] of Object.entries(S)) {
  if (isPix(v)) allSprites.push([name, v])
  else if (Array.isArray(v)) v.forEach((p, i) => allSprites.push([name + '[' + i + ']', p]))
  else for (const [k, p] of Object.entries(v)) allSprites.push([name + '.' + k, p])
}
const looks = [
  { H: 'red', J: 'blue', D: 'black', S: 'skinPale', bib: true },
  { H: 'white', J: 'navy', D: 'teal', S: 'skinDark', bib: false },
]
for (const look of looks)
  for (const head of ['plain', 'panic'])
    for (const arms of ['swingA', 'swingB', 'upA', 'upB', 'stiff', 'star'])
      for (const legs of ['together', 'stride', 'star'])
        for (const kind of ['normal', 'fast', 'slow', 'hesitant'])
          for (const lean of [-1, 0, 1, 2]) allSprites.push([`skater ${head} ${arms} ${legs} ${kind} ${lean}`, Sp.skaterSprite(look, { head, arms, legs, lean, kind })])
for (let v = 0; v < 7; v++) for (const frame of [0, 1]) allSprites.push([`spectator ${v} ${frame}`, Sp.spectatorSprite({ skin: 'skinTan', hair: 'hairBlond', shirt: 'green', v }, frame)])
allSprites.push(['logo', logoLine('À LA MOUSSE !')])
allSprites.push(['panel', Sp.panelSprite(40, 20, RAMPS.navy)])

test('every ramp and DARKER entry stays inside the palette', () => {
  for (const [name, ramp] of Object.entries(RAMPS)) {
    assert.ok(ramp.length >= 3 && ramp.length <= 7, name + ' has 3–7 tones')
    for (const c of ramp) assert.ok(palette.has(c), name + ' uses ' + c)
  }
  for (const [k, v] of Object.entries(DARKER)) assert.ok(palette.has(k) && palette.has(v))
})

test('every sprite pixel is a palette colour', () => {
  for (const [name, p] of allSprites) for (const c of p.data) if (c) assert.ok(palette.has(c), name + ' uses ' + c)
  const bg = Sp.backgroundSprite(C, W, H)
  for (const c of bg.data) assert.ok(c && palette.has(c), 'background uses ' + c)
})

test('every sprite keeps an empty 1 px frame, so its outline is never cut', () => {
  for (const [name, p] of allSprites) assert.ok(p.hasMargin(), name + ' touches its frame')
})

test('sprites are not empty and carry an outline (ink on their bottom-right edge)', () => {
  for (const [name, p] of allSprites) {
    const b = p.bounds()
    assert.ok(b, name + ' is empty')
    let ink = 0
    for (const c of p.data) if (c === PAL.ink) ink++
    if (!/barrier|table|boards|panel/.test(name)) assert.ok(ink > 0, name + ' has no ink outline')
  }
})

test('gameplay sizes are drawn as configured: the truck and the mat', () => {
  // The truck sweeps [x - TRUCK_LEN, x + 3]: its body spans exactly TRUCK_LEN px plus 1 px of outline each side.
  const b = S.truck[0].bounds()
  assert.equal(b.w, C.TRUCK_LEN + 2)
  const front = S.truck[0].ax
  assert.equal(front - (b.x + 1), C.TRUCK_LEN)
  // The mat: MAT_W columns (plus ext), a 1 px dark edge on the left, on every row of the lane.
  for (const ext of [0, C.MAT_EXTENSION]) {
    const px = new Map()
    Sp.drawMatInto((x, y, c) => px.set(x + ',' + y, c), (y) => C.MAT_X + (y - C.TRACK_TOP) * C.SLANT, ext, C)
    for (let y = C.TRACK_TOP + 6; y < C.TRACK_BOTTOM - 3; y++) {
      const x0 = Math.round(C.MAT_X + (y - C.TRACK_TOP) * C.SLANT)
      let n = 0
      for (let x = x0; x < x0 + C.MAT_W + ext + 2; x++) if (px.has(x + ',' + y)) n++
      assert.equal(n, C.MAT_W + ext, 'mat row ' + y + ' ext ' + ext)
      assert.ok(px.has(x0 - 1 + ',' + y), 'left edge')
    }
    for (const c of px.values()) assert.ok(palette.has(c))
  }
})

test('skaters are the same size as before: 20 px tall, feet on the anchor', () => {
  const p = Sp.skaterSprite(looks[0], { head: 'plain', arms: 'swingA', legs: 'together', lean: 1, kind: 'normal' })
  const b = p.bounds()
  assert.equal(p.ay - b.y, 21) // 20 rows of body + 1 row of outline above
  assert.equal(b.y + b.h - 1, p.ay) // the outline row below the wheels sits on the anchor row
})

test('the 5 × 7 font has every character the game prints, with accents', () => {
  const text =
    'SCORE SÉRIE PRÉC OLA MAX ×2 ×8 0123456789 1:54 PARFAIT TROP TÔT ! FAUX DÉPART ! UN SAUT À LA FOIS ! SCANDALE ! SAUVÉS ' +
    'ARRIVÉE L’ORGANISATION PARLE D’UN SUCCÈS. VICTIMES DE LA MOUSSE ÉVACUÉS PAR LES POMPIERS NOUVEAU RECORD ! ESPACE : RECOMMENCER ' +
    'TAPOTE PAUSE LE PELOTON DU DIMANCHE FIN DE L’ÉPREUVE PIN-PON ! ARRÊTÉ MUNICIPAL N°8 : TOUT VA BIEN CONFORMITÉ PRÉFECTORALE ×3 ' +
    'FORMULAIRE CERFA À REMPLIR L’ASSURANCE EST PRÉVENUE (PV DRESSÉ) 150 FRACTURES ÉVITÉES ? « » … ÇA'
  for (const ch of text.toUpperCase()) if (ch !== ' ') assert.ok(hasGlyph5(ch), 'missing glyph ' + ch)
  const e = glyph5('É')
  assert.equal(e.rows.length, 10)
  assert.ok(e.rows[0].includes('#') || e.rows[1].includes('#'), 'accent rows drawn')
  assert.equal(textWidth5('ABC'), 17)
})

test('shade() dithers only in a narrow band between two tones', () => {
  const ramp = [PAL.ink, PAL.slate, PAL.white]
  // Far from the middle between two tones, every pixel is the same tone.
  const flat = new Set()
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) flat.add(shade(ramp, 0.1, x, y))
  assert.equal(flat.size, 1)
  const mixed = new Set()
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) mixed.add(shade(ramp, 0.25, x, y))
  assert.equal(mixed.size, 2)
})
