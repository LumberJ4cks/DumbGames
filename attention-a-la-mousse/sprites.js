/*
 * Attention à la mousse ! — all the art, drawn in code into pixel buffers (see pixel.js) at
 * 1:1, from the Endesga 32 palette, one light from the top left, selective outlines.
 *
 * buildSprites(C) returns plain Pix buffers (usable in Node for the tests); the game turns
 * them into canvases once with cacheSprites(). Every sprite keeps its anchor (ax, ay): the
 * feet for characters, the bottom-left of the mat, the front bumper for the truck.
 */
import { Pix, PAL, RAMPS, darker, shade, bayer } from './pixel.js?v=4'
import { glyph3 } from './font.js?v=4'

const P = PAL
const R = RAMPS

/* ---------- helpers ---------- */
/** A rectangle with the light on its top-left edge and shade on the bottom-right one. */
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
/** Legend for character maps: one letter → one tone of a ramp. */
function legend(spec) {
  const out = {}
  for (const [ch, [ramp, i]] of Object.entries(spec)) out[ch] = typeof ramp === 'string' ? ramp : ramp[Math.max(0, Math.min(ramp.length - 1, i))]
  return out
}
/**
 * Builds a sprite: the drawing callback gets a proxy with anchor-relative coordinates, the
 * buffer keeps a 2 px frame (1 px for the outline, 1 px of margin).
 */
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
/** 3 × 5 text into a buffer (small mentions on signs and boards). */
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
export const text3Width = (text) => text.length * 4 - 1

/* ---------- looks: palette ramps for skaters and spectators ---------- */
export const HELMET_RAMPS = ['red', 'yellow', 'blue', 'green', 'orange', 'purple', 'white', 'black', 'pink']
export const JERSEY_RAMPS = ['pink', 'blue', 'yellow', 'green', 'orange', 'purple', 'white', 'teal', 'red', 'navy']
export const SHORTS_RAMPS = ['black', 'navy', 'red', 'purple', 'teal']
export const SKIN_RAMPS = ['skinPale', 'skinTan', 'skinDark']
export const HAIR_RAMPS = ['hairBrown', 'hairBlond', 'hairBlack', 'hairRed', 'hairGrey']

/* ---------- skater ---------- */
/*
 * Feet at (0, 0), facing right. Heights match the old sprite (20 px) so nothing moves. Parts:
 * head (plain / panic), torso (jersey, bib, shorts), arms (6 poses), legs (3 poses).
 */
const HEAD_ROWS = ['.HHHh.', 'HHhhhg', 'hhhggg', '.sSSz.', '.sSEz.', '.zssz.']
const HEAD_PANIC_ROWS = ['.HHHh.', 'HHhhhg', 'hhhggg', '.sWEz.', '.sSSz.', '.zMMz.']
const HEAD_AERO_ROWS = ['.HHHhh', 'HHhhhgg', 'hhhgggg', '.sSSz.', '.sSEz.', '.zssz.']
const TORSO_ROWS = ['JJjji', 'Jjjji', 'jjjji', 'jjjii', 'ijjii', 'DDddx', 'dddxx']
const TORSO_BIB_ROWS = ['JJjji', 'JjBBi', 'jjBEi', 'jjjii', 'ijjii', 'DDddx', 'dddxx']
// Legs: [x, y, w, h] in skin, plus boots and wheels drawn after.
const LEGS = {
  together: { skin: [[-2, -7, 1, 4], [1, -7, 1, 4]], socks: [[-2, -3], [1, -3]], boots: [[-3, -2, 3], [1, -2, 3]], wheels: [-3, -1, 1, 3] },
  stride: { skin: [[-3, -7, 1, 3], [-4, -5, 1, 2], [1, -7, 1, 4]], socks: [[-4, -3], [1, -3]], boots: [[-7, -2, 3], [1, -2, 3]], wheels: [-7, -5, 1, 3] },
  star: { skin: [[-3, -7, 1, 3], [-4, -5, 1, 2], [2, -7, 1, 3], [3, -5, 1, 2]], socks: [[-4, -3], [3, -3]], boots: [[-6, -2, 3], [3, -2, 3]], wheels: [-6, 5] },
}
const ARMS = {
  swingA: [[-3, -13, 1, 2], [-4, -11, 1, 2], [2, -13, 1, 1], [3, -12, 2, 1]],
  swingB: [[-3, -13, 1, 3], [2, -13, 1, 2], [3, -11, 1, 1]],
  upA: [[-4, -19, 1, 5], [-3, -14, 1, 1], [3, -19, 1, 5], [2, -14, 1, 1]],
  upB: [[-5, -18, 1, 4], [-4, -14, 1, 1], [4, -18, 1, 4], [3, -14, 1, 1]],
  stiff: [[-3, -14, 1, 6], [2, -14, 1, 6]],
  star: [[-5, -16, 3, 1], [-6, -17, 1, 1], [2, -16, 3, 1], [5, -17, 1, 1]],
}
export const SKATER_W = 16
export const SKATER_H = 24

/**
 * One skater pose. look = { H, J, D, S: ramp names, bib }, pose = { head: 'plain'|'panic',
 * arms, legs, lean, kind }. Returns a Pix anchored at the feet.
 */
export function skaterSprite(look, pose) {
  const H = R[look.H]
  const J = R[look.J]
  const D = R[look.D]
  const S = R[look.S]
  const lg = legend({
    H: [H, 3], h: [H, 2], g: [H, 1],
    s: [S, 2], S: [S, 3], z: [S, 1],
    J: [J, 3], j: [J, 2], i: [J, 1],
    D: [D, 3], d: [D, 2], x: [D, 1],
    B: [P.white], E: [P.ink], W: [P.white], M: [P.redD],
  })
  return sprite(SKATER_W, SKATER_H, 8, 22, (a) => {
    const legs = LEGS[pose.legs]
    const lean = pose.lean || 0
    for (const [x, y, w, h] of legs.skin) a.shaded(x, y, w, h, S)
    for (const [x, y] of legs.socks) a.px(x, y, P.white)
    for (const [x, y, w] of legs.boots) {
      a.px(x, y, P.slate)
      a.rect(x + 1, y, w - 1, 1, P.slateD)
      a.rect(x, y + 1, w, 1, P.ink)
    }
    const wh = legs.wheels
    for (const x of wh) a.px(x, -1, P.grey1)
    // Beginner: white pads on the knees.
    if (pose.kind === 'hesitant') {
      a.px(-2, -5, P.white)
      a.px(1, -5, P.white)
    }
    a.map(look.bib ? TORSO_BIB_ROWS : TORSO_ROWS, lg, -2 + lean, -14)
    for (const [x, y, w, h] of ARMS[pose.arms]) a.shaded(x + lean, y, w, h, S)
    const head = pose.kind === 'fast' && pose.head !== 'panic' ? HEAD_AERO_ROWS : pose.head === 'panic' ? HEAD_PANIC_ROWS : HEAD_ROWS
    a.map(head, lg, -3 + lean, -20)
    // Chin strap and a visor glint.
    a.px(-2 + lean, -16, H[1])
    a.px(-1 + lean, -19, H[3])
    if (pose.kind === 'slow') a.px(-2 + lean, -17, P.grey1) // the promeneur's goggles
  })
}
/* ---------- fall poses: the roulé-boulé, drawn for real ---------- */
/*
 * Four tumble frames (dive, head down, on the back, sitting) then three resting slides (on the
 * back, face down, head planted). Same legend as the skater; anchor on the ground under the
 * body's centre. Width 18, so a lying skater is about as long as a standing one is tall.
 */
const FALL_ROWS = {
  // Dive: head forward and down, arms out front, legs trailing up behind.
  tumble0: [
    '..........kK......',
    '.........kK.......',
    '........ss........',
    '.......ssjj.......',
    '.....JjjjjjJ......',
    '....Jjjjjjjjhhh...',
    '...zjjjjjjjhhhhh..',
    '.sSs..ddxxsSSEhg..',
    '.......xx.zssz.z..',
  ],
  // Head down: helmet on the asphalt, legs straight up, arms out.
  tumble1: [
    '......kK.kK.......',
    '......kk.kk.......',
    '......ss.ss.......',
    '......ss.ss.......',
    '......ddxxx.......',
    '....S.jjjji.S.....',
    '....ssJjjjiss.....',
    '......Jjjji.......',
    '.....zssSSz.......',
    '.....hhhhhg.......',
    '......hHHg........',
  ],
  // On the back, legs up in the air, arms up.
  tumble2: [
    '............kK....',
    '...........kK.....',
    '..........ss......',
    '..S......ss.......',
    '..s.....ss........',
    '..s....xd.........',
    '..zjjjjjd.........',
    'hhhJjjjjxx........',
    'hHhsSsjjii........',
    'hhhzEz............',
  ],
  // Sitting, back to the right, legs forward, arms flailing.
  tumble3: [
    '...........S......',
    '...........s......',
    '........hhhs......',
    '.......hHhhhg.....',
    '.......zESShs.....',
    '.S.....zssz.s.....',
    '..s....Jjjji......',
    '...s..Jjjjjii.....',
    '....ssjjjjjii.....',
    '.ss.sddxxjjii.....',
    'kkKkK.ddx.ii......',
  ],
  // Resting on the back, head left, arms spread, skates in the air.
  slideBack: [
    '..............kK..',
    '..............kK..',
    '..............ss..',
    '..............ss..',
    '.........ddxxss...',
    'hhh...Jjjjjjix....',
    'hHhsSsJjjjjjii....',
    'hhhzEz.Jjjjjii....',
    '....S..s......s...',
    '....ss.s......s...',
  ],
  // Face down, arms forward, skates behind, helmet still on.
  slideFace: [
    '..................',
    '..................',
    '..............kK..',
    '.........ddx.kk...',
    '.ss.Jjjjjjddxss...',
    '..ssJjjjjjjdd.....',
    'hhhhJjjjjjii......',
    'hHhhhzsjjii.......',
    '.hhhhzzz..........',
  ],
  // Head planted in the ground, legs in a V, arms spread: the municipal classic.
  slideHead: [
    '....kK....kK......',
    '....kk....kk......',
    '.....ss..ss.......',
    '......ssss........',
    '......ddxx........',
    '.S....jjji....S...',
    '..ss.Jjjjii.ss....',
    '....sJjjjii.s.....',
    '.....zsSSz........',
    '.....hhhhhg.......',
    '......hHHg........',
  ],
}
export const FALL_POSES = Object.keys(FALL_ROWS)
export function skaterFallSprite(look, pose) {
  const H = R[look.H]
  const J = R[look.J]
  const D = R[look.D]
  const S = R[look.S]
  const lg = legend({
    H: [H, 3], h: [H, 2], g: [H, 1],
    s: [S, 2], S: [S, 3], z: [S, 1],
    J: [J, 3], j: [J, 2], i: [J, 1],
    D: [D, 3], d: [D, 2], x: [D, 1],
    k: [P.slate], K: [P.grey1], E: [P.ink], W: [P.white], M: [P.redD],
  })
  const rows = FALL_ROWS[pose]
  return sprite(24, 16, 12, 14, (a) => {
    a.map(rows, lg, -9, -rows.length)
    // Stars for the tumbles, a few sweat drops for the slides.
    if (pose.startsWith('tumble')) {
      a.px(-8, -13, P.yellow)
      a.px(8, -12, P.yellow)
    }
  })
}

/* ---------- the stretcher team: two medics in white, a stretcher between them ---------- */
export function medicSprite(frame, kneel = false) {
  const lg = legend({ W: [R.white, 3], w: [R.white, 2], u: [R.white, 1], s: [R.skinPale, 2], S: [R.skinPale, 3], z: [R.skinPale, 1], E: [P.ink], r: [P.red], G: [R.hairBlack, 2], g: [R.hairBlack, 1], T: [R.navy, 2], t: [R.navy, 1] })
  return sprite(12, 24, 6, 22, (a) => {
    if (kneel) {
      a.map(
        ['.GGGg.', 'GsSEzg', '.sSSz.', '.zssz.', 'WwrwuW', 'wwrwuw', 'wwwwu.', 'TTttTt', 'TTttTt'],
        lg,
        -3,
        -10
      )
      a.rect(-4, -2, 8, 1, P.slateD)
      return
    }
    a.map(
      ['.GGGg.', 'GsSEzg', '.sSSz.', '.zssz.', 'WwrwuW', 'wwrwuw', 'wwwwu.', 'wwwwu.', 'uwwwu.', 'uuuuu.', '.TTt..', '.TTt..', '.TTt..', '.TTt..', '.TTt..'],
      lg,
      -3,
      -20
    )
    walker(a, frame, R.navy)
  })
}
export function stretcherSprite() {
  return sprite(26, 8, 13, 6, (a) => {
    a.rect(-12, -4, 24, 1, R.wood[3])
    a.rect(-12, -3, 24, 1, R.wood[2])
    a.rect(-11, -2, 22, 3, R.white[2])
    a.rect(-11, -2, 22, 1, R.white[3])
    a.rect(-11, 0, 22, 1, R.white[1])
    a.rect(-1, -1, 2, 1, P.red)
    a.rect(-13, -4, 1, 2, R.wood[2])
    a.rect(12, -4, 1, 2, R.wood[2])
    a.px(-10, 1, P.slateD)
    a.px(9, 1, P.slateD)
  })
}

/* ---------- the helicopter: a small white and red SAMU bird ---------- */
export function heliSprite(rotor) {
  return sprite(44, 20, 22, 18, (a) => {
    // Rotor: a long thin blur, two frames.
    if (rotor) a.rect(-20, -18, 40, 1, P.grey2)
    else {
      a.rect(-14, -18, 28, 1, P.grey3)
      a.px(-16, -18, P.grey2)
      a.px(15, -18, P.grey2)
    }
    a.rect(-1, -17, 2, 2, P.slate)
    // Body: rounded cabin in front (right), tail boom to the left, skids below.
    a.box(-4, -15, 16, 9, 2, R.white)
    a.ell(10, -10, 4, 4.5, R.white, 0.1)
    a.rect(-18, -11, 14, 3, R.white[2])
    a.rect(-18, -11, 14, 1, R.white[3])
    a.rect(-18, -9, 14, 1, R.white[1])
    a.rect(-20, -15, 3, 6, R.red[2])
    a.rect(-20, -15, 3, 1, R.red[3])
    a.rect(-21, -13, 1, 3, rotor ? P.grey2 : P.grey3)
    // Red stripe, cross, windows.
    a.rect(-4, -9, 16, 1, P.red)
    a.rect(10, -14, 3, 3, R.glass[2])
    a.px(10, -14, P.white)
    a.rect(-1, -13, 3, 2, P.red)
    a.px(0, -14, P.red)
    a.px(0, -11, P.red)
    // Skids.
    a.rect(-3, -5, 1, 2, P.grey3)
    a.rect(9, -5, 1, 2, P.grey3)
    a.rect(-6, -3, 20, 1, P.grey2)
    a.rect(-6, -3, 1, 1, P.grey1)
    a.text3('SAMU', -6, -16, P.red)
  })
}

/* ---------- la mamie: small, slow, a cane and a shopping bag, unimpressed ---------- */
export function mamieSprite(frame) {
  const lg = legend({ G: [R.hairGrey, 3], g: [R.hairGrey, 2], s: [R.skinPale, 2], S: [R.skinPale, 3], z: [R.skinPale, 1], E: [P.ink], V: [R.purple, 3], v: [R.purple, 2], u: [R.purple, 1], L: [P.grey1], l: [P.grey2], B: [R.wood, 2], b: [R.wood, 1], c: [R.orange, 2], C: [R.orange, 3] })
  return sprite(16, 20, 8, 18, (a) => {
    a.map(
      [
        '.GGGg.',
        'GGGGgg',
        'GsSEzg',
        '.sSSz.',
        '.LsszL', // glasses frame hint
        '.VVvu.',
        'VVvvuu', // cardigan, buttons
        'VvEvuu',
        'VvEvuu',
        'vvvvu.',
        'uuuuu.',
        '.llll.', // skirt
        '.llll.',
        '..s.s.',
      ],
      lg,
      -3,
      -17
    )
    // Shoes, two frames; the cane on the right, the bag on the left.
    const shoes = frame ? [[-3, -1, 3], [1, -1, 2]] : [[-2, -1, 2], [1, -1, 3]]
    for (const [x, y, w] of shoes) a.rect(x, y, w, 1, P.plum)
    a.rect(4, -9, 1, 9, R.wood[1])
    a.px(4, -10, R.wood[2])
    a.rect(3, -10, 1, 1, R.wood[2])
    a.rect(-7, -6, 4, 5, R.orange[2])
    a.rect(-7, -6, 4, 1, R.orange[3])
    a.rect(-6, -8, 2, 2, P.plum)
    a.rect(-4, -9, 1, 3, R.skinPale[2])
  })
}

/** Cache key of a look. */
export const lookKey = (look) => `${look.H}|${look.J}|${look.D}|${look.S}|${look.bib ? 1 : 0}`

/* ---------- intruders ---------- */
function walker(a, frame, legRamp, bootRamp = R.rubber) {
  // Trousers and shoes, two frames.
  const L = frame ? [[-2, -7, 2, 6], [0, -7, 2, 6]] : [[-3, -7, 2, 6], [1, -7, 2, 6]]
  for (const [x, y, w, h] of L) a.shaded(x, y, w, h, legRamp)
  const B = frame ? [[-3, -1, 3], [0, -1, 3]] : [[-4, -1, 3], [1, -1, 3]]
  for (const [x, y, w] of B) {
    a.rect(x, y, w, 1, bootRamp[1])
    a.px(x + w - 1, y, bootRamp[0])
  }
}
export function maireSprite(frame, armsUp) {
  const lg = legend({ U: [R.navy, 2], u: [R.navy, 1], V: [R.navy, 3], s: [R.skinPale, 2], S: [R.skinPale, 3], z: [R.skinPale, 1], G: [R.hairGrey, 2], g: [R.hairGrey, 1], E: [P.ink], W: [P.white], b: [P.blue], w: [P.white], r: [P.red], M: [P.redD] })
  return sprite(16, 26, 8, 24, (a) => {
    walker(a, frame, R.navy)
    a.map(
      [
        '.GGGg.', // grey hair, parted
        'GsSSzg',
        '.sSEz.',
        '.sSSz.',
        '.zMMz.', // moustache-ish mouth
        'VUUUu.', // jacket, open collar
        'VUWUu.',
        'UUWUu.',
        'UUUUu.',
        'uUUUu.',
        'uuuuu.',
      ],
      lg,
      -3,
      -20
    )
    // The tricolour sash, from the right shoulder to the left hip.
    const sash = [[1, -15, 'b'], [1, -14, 'w'], [0, -14, 'b'], [0, -13, 'w'], [-1, -13, 'r'], [-1, -12, 'w'], [-2, -12, 'r'], [-2, -11, 'r']]
    for (const [x, y, k] of sash) a.px(x, y, lg[k])
    if (armsUp) {
      a.shaded(-4, -22, 1, 7, R.navy)
      a.shaded(2, -22, 1, 7, R.navy)
      a.px(-4, -23, R.skinPale[2])
      a.px(2, -23, R.skinPale[2])
    } else {
      a.shaded(-4, -14, 1, 5, R.navy)
      a.px(-4, -9, R.skinPale[2])
      a.shaded(2, -14, 1, 4, R.navy)
      a.px(2, -10, R.skinPale[2])
    }
  })
}
export function secouristeSprite(frame, armsUp) {
  const lg = legend({ O: [R.orange, 3], o: [R.orange, 2], q: [R.orange, 1], s: [R.skinTan, 2], S: [R.skinTan, 3], z: [R.skinTan, 1], E: [P.ink], W: [P.white], r: [P.red], R: [P.redD], k: [P.slateD] })
  return sprite(16, 26, 8, 24, (a) => {
    walker(a, frame, R.navy)
    a.map(
      [
        '.rrrR.', // red cap
        'rrrrRR',
        '.sSEz.',
        '.sSSz.',
        '.zssz.',
        'OooWq.', // orange vest with the white cross
        'OoWWWq',
        'OooWq.',
        'OoWWWq',
        'oooWq.',
        'qoooq.',
      ],
      lg,
      -3,
      -20
    )
    a.rect(-2, -15, 4, 1, P.grey1) // reflective stripe
    a.rect(-2, -10, 4, 1, P.grey1)
    if (armsUp) {
      a.shaded(-4, -22, 1, 7, R.orange)
      a.shaded(2, -22, 1, 7, R.orange)
    } else {
      a.shaded(-4, -14, 1, 5, R.orange)
      a.px(-4, -9, R.skinTan[2])
      // The first-aid bag in the right hand.
      a.shaded(2, -14, 1, 3, R.orange)
      a.box(2, -11, 4, 4, 1, R.red)
      a.px(3, -9, P.white)
      a.px(4, -9, P.white)
      a.px(4, -10, P.white)
      a.px(4, -8, P.white)
    }
  })
}
export function chienSprite(frame) {
  const lg = legend({ b: [R.dog, 2], B: [R.dog, 3], d: [R.dog, 1], h: [R.dog, 2], H: [R.dog, 3], e: [R.dog, 1], E: [P.ink], n: [P.ink], p: [P.pink], r: [P.red], k: [P.plum] })
  return sprite(16, 12, 8, 10, (a) => {
    // Hand-drawn (an ellipsoid dithers into noise at this size): body, head to the right,
    // floppy ear, tongue out, red collar, tail up to the left.
    a.map(
      [
        't.....ee...',
        'tt...HHHh..',
        '.BBBBrhhEn.',
        'bbbbbbhhhp.',
        '.dbbbbbd...',
      ],
      { ...lg, t: R.dog[2] },
      -5,
      -9
    )
    const legs = frame ? ['.b..b..b.b.', '.k..k..k.k.'] : ['..b.b.b..b.', '..k.k.k..k.']
    a.map(legs, { b: R.dog[1], k: P.plum }, -5, -4)
    a.px(frame ? -1 : 0, -2, R.dog[1])
    a.px(frame ? -1 : 0, -1, P.plum)
  })
}
export function poussetteSprite(frame) {
  const lg = legend({ A: [R.teal, 3], a: [R.teal, 2], s: [R.skinPale, 2], S: [R.skinPale, 3], z: [R.skinPale, 1], G: [R.hairBrown, 2], g: [R.hairBrown, 1], E: [P.ink], W: [P.white] })
  return sprite(24, 26, 16, 24, (a) => {
    // The parent, pushing (to the left of the pram), trousers in jeans blue.
    const sx = -12
    const L = frame ? [[-2, -7, 1, 6], [0, -7, 1, 6]] : [[-3, -7, 1, 6], [1, -7, 1, 6]]
    for (const [x, y, w, h] of L) a.shaded(sx + x, y, w, h, R.blue)
    const B = frame ? [[-3, -1, 2], [0, -1, 2]] : [[-4, -1, 2], [1, -1, 2]]
    for (const [x, y, w] of B) a.rect(sx + x, y, w, 1, P.slateD)
    a.map(['.GGGg.', 'GsSSzg', '.sSEz.', '.zssz.', 'AAaaa.', 'AAaaa.', 'Aaaaa.', 'aaaaa.'], lg, sx - 3, -19)
    // Arms forward onto the handle.
    a.rect(sx + 2, -12, 5, 1, R.skinPale[2])
    a.px(sx + 7, -12, R.skinPale[1])
    // The pram: hood (purple), body, handle, two big wheels.
    a.box(-6, -13, 7, 5, 2, R.purple)
    a.box(-7, -8, 10, 4, 1, R.purple)
    a.rect(-6, -13, 1, 5, R.purple[3])
    a.rect(-5, -14, 1, 1, R.purple[0]) // handle
    a.rect(-6, -14, 1, 1, R.purple[0])
    a.rect(-1, -10, 2, 2, R.skinPale[2]) // the baby
    a.px(0, -10, P.ink)
    a.px(0, -11, R.hairBrown[1])
    a.px(-1, -11, R.hairBrown[1])
    for (const wx of [-6, 1]) {
      a.disc(wx, -2, 2, 2, P.slateD)
      a.px(wx, -2, P.grey2)
      a.px(wx - 1, -3, P.slate)
    }
  })
}

/* ---------- volunteers (body without arms; the game animates the arms) ---------- */
export function volunteerSprite(variant = 0) {
  const skins = [R.skinPale, R.skinTan, R.skinDark]
  const Sk = skins[variant % skins.length]
  const lg = legend({ V: [R.vest, 2], v: [R.vest, 1], Y: [R.vest, 0], s: [Sk, 2], S: [Sk, 3], z: [Sk, 1], E: [P.ink], r: [P.red], R: [P.redD], G: [P.grey1], T: [R.navy, 2], t: [R.navy, 1] })
  return sprite(12, 24, 6, 22, (a) => {
    a.map(
      [
        '.rrrR.', // cap
        'rrrrRR',
        '.sSEz.',
        '.sSSz.',
        '.zssz.',
        'VVvvY.', // vest
        'VGGGY.', // reflective band
        'VvvvY.',
        'VGGGY.',
        'vvvvY.',
        'YvvvY.',
        '.TTt..', // trousers
        '.TTt..',
        '.TTt..',
        '.TTt..',
        '.TTt..',
        '.TTt..',
        'ttt.tt',
      ],
      lg,
      -3,
      -21
    )
    a.rect(-3, -1, 3, 1, P.slateD)
    a.rect(1, -1, 2, 1, P.slateD)
    a.px(2, -21, P.redD) // cap peak
    a.px(3, -20, P.redD)
  })
}

/* ---------- spectators (behind the barriers; head and shoulders + arms-up frame) ---------- */
export function spectatorSprite(look, frame) {
  const Sk = R[look.skin]
  const Hr = R[look.hair]
  const Sh = R[look.shirt]
  const lg = legend({ s: [Sk, 2], S: [Sk, 3], z: [Sk, 1], G: [Hr, 2], g: [Hr, 1], H: [Hr, 3], T: [Sh, 3], t: [Sh, 2], u: [Sh, 1], E: [P.ink], M: [P.redD] })
  const hats = [null, 'cap', 'hat', null, 'bald', null, 'bun']
  const hat = hats[look.v % hats.length]
  return sprite(12, 24, 6, 22, (a) => {
    let head
    if (hat === 'cap') head = ['.HGGg.', 'GGGGgg', '.sSSz.', '.sSEz.', '.zssz.']
    else if (hat === 'hat') head = ['.GGGg.', 'HGGGgg', '.sSSz.', '.sSEz.', '.zssz.']
    else if (hat === 'bald') head = ['......', '.sSSz.', 'ssSSzz', '.sSEz.', '.zssz.']
    else if (hat === 'bun') head = ['..GG..', '.GGGg.', 'GsSSzg', '.sSEz.', '.zssz.']
    else head = ['.GGGg.', 'GGGGgg', 'GsSSzg', '.sSEz.', '.zssz.']
    const y0 = frame ? -15 : -14
    a.map(head, lg, -3, y0)
    if (frame) a.map(['.zMMz.'], lg, -3, y0 + 4) // mouth open while shouting
    // Shoulders and chest (the rest hides behind the barrier).
    a.map(['TTttu.', 'TTttu.', 'Tttuu.', 'ttuuu.', 'ttuuu.', 'ttuuu.', 'ttuuu.'], lg, -3, y0 + 5)
    if (frame) {
      a.shaded(-4, y0 - 5, 1, 9, Sk)
      a.shaded(3, y0 - 5, 1, 9, Sk)
    } else {
      a.shaded(-4, y0 + 5, 1, 5, Sk)
      a.shaded(3, y0 + 5, 1, 5, Sk)
    }
  })
}

/* ---------- pigeons ---------- */
export function pigeonSprite(kind) {
  const lg = legend({ b: [R.metal, 3], B: [R.metal, 4], d: [R.metal, 2], w: [P.white], g: [P.greenM], o: [P.orange], E: [P.ink] })
  return sprite(10, 8, 4, 6, (a) => {
    if (kind === 'idle') a.map(['...BBd..', '..bBbdd.', '.bbbbdEo', 'wbbbbd..', '.dddd...', '..o.o...'], lg, -4, -6)
    else if (kind === 'peck') a.map(['........', '..BBd...', '.bBbbdd.', 'wbbbbbdE', '.dddddo.', '..o.o...'], lg, -4, -6)
    else if (kind === 'up') a.map(['.BBB.BB.', '..bbbb..', '..bbdEo.', '.wbbdd..', '..dd....', '........'], lg, -4, -6)
    else a.map(['........', '..bbbb..', '.BbbdEo.', 'wBbbdd..', '.BB.dd..', '........'], lg, -4, -6)
    a.px(-1, -3, P.greenM) // neck sheen
  })
}

/* ---------- photographer ---------- */
export function photographerSprite(light) {
  const lg = legend({ s: [R.skinTan, 2], S: [R.skinTan, 3], z: [R.skinTan, 1], G: [R.hairBrown, 2], g: [R.hairBrown, 1], V: [R.white, 3], v: [R.white, 2], u: [R.white, 1], T: [R.black, 2], t: [R.black, 1], E: [P.ink], K: [P.ink], k: [P.slate], L: [P.grey1], r: [P.red] })
  return sprite(34, 36, 14, 34, (a) => {
    a.map(
      [
        '......GGGg.',
        '.....GGGGgg',
        '.....GsSSzg',
        'KKKK.ssSEz.', // camera held up, lens to the left
        'KkkKKsSSz..',
        'KkLKK.zssz.',
        'KKKKsvVvu..', // hands on the camera, press vest
        '.....VvVvu.',
        '.....vVvvu.',
        '.....vvvvu.',
        '.....uvvuu.',
        '.....uuuuu.',
        '.....TTtTt.',
        '.....TTtTt.',
        '.....TTtTt.',
        '.....TTtTt.',
        '.....TTtTt.',
        '.....TTtTt.',
        '.....TTtTt.',
        '....ttt.tt.',
      ],
      lg,
      -7,
      -20
    )
    a.px(-5, -17, light ? P.red : P.redD)
    a.text3('PRESSE', -4, -31, P.ink)
  })
}

/* ---------- the fire engine ---------- */
export function truckSprite(C, light) {
  const L = C.TRUCK_LEN
  // Anchor: the front bumper at x = 0, the ground at y = 0. The body spans [-L, 0].
  return sprite(L + 2, 42, L + 1, 40, (a) => {
    const back = -L
    // Cab (front) and body (back), 3/4 from above: top faces lit.
    a.box(back, -30, L - 14, 24, 3, R.fire)
    a.box(-14, -36, 14, 30, 3, R.fire)
    // Ladder on the roof.
    a.rect(back + 3, -32, L - 22, 1, P.grey2)
    a.rect(back + 3, -34, L - 22, 1, P.grey1)
    for (let i = 0; i < L - 22; i += 4) a.rect(back + 3 + i, -34, 1, 3, P.grey3)
    // Windscreen and side window.
    a.rect(-11, -33, 9, 6, P.cyan)
    a.rect(-11, -33, 9, 1, P.white)
    a.rect(-3, -33, 1, 6, P.blue)
    a.rect(-11, -28, 9, 1, P.blueD)
    // White band and the lettering.
    a.rect(back, -17, L, 2, P.white)
    a.rect(back, -15, L, 1, P.grey1)
    a.text3('POMPIERS', back + 8, -27, P.white)
    a.text3('18', -12, -24, P.white)
    // Lockers on the body.
    for (let x = back + 4; x < back + L - 20; x += 12) {
      a.rect(x, -12, 9, 6, R.fire[1])
      a.rect(x, -12, 9, 1, R.fire[3])
      a.px(x + 4, -9, P.grey1)
    }
    // Blue light, headlights, bumper.
    a.rect(-9, -39, 4, 3, light ? P.cyan : P.blueD)
    a.px(-8, -40, light ? P.white : P.blue)
    a.rect(-2, -10, 2, 2, P.yellow)
    a.rect(back, -6, L, 2, P.grey3)
    a.rect(back, -4, L, 1, P.slateD)
    // Wheels.
    for (const wx of [back + 10, -11]) {
      a.disc(wx, -4, 4, 4, P.ink)
      a.disc(wx, -4, 2, 2, P.grey3)
      a.px(wx, -4, P.grey1)
      a.px(wx - 1, -5, P.grey2)
    }
  })
}

/* ---------- arch, barrier, table, signs, boards ---------- */
export function archPostSprite(h) {
  return sprite(6, h, 0, h, (a) => {
    for (let y = -h; y < 0; y++) {
      const band = Math.floor((y + h) / 8) % 2
      const ramp = band ? R.white : R.red
      a.px(0, y, ramp[3])
      a.rect(1, y, 3, 1, ramp[2])
      a.px(4, y, ramp[1])
    }
  })
}
export function bannerSprite() {
  return sprite(70, 28, 0, 0, (a) => {
    a.box(0, 0, 70, 26, 2, R.red)
    a.rect(1, 17, 68, 8, P.yellow)
    a.rect(1, 17, 68, 1, P.amber)
    a.rect(1, 24, 68, 1, P.amber)
    // Rope holes.
    a.px(2, 2, P.plum)
    a.px(67, 2, P.plum)
  })
}
/** One module of crowd barrier (34 px wide, 14 tall), seen slightly from above. */
export function barrierSprite() {
  return sprite(34, 15, 0, 14, (a) => {
    a.rect(0, -14, 32, 1, P.grey1)
    a.rect(0, -13, 32, 1, P.grey2)
    a.rect(0, -3, 32, 1, P.grey2)
    a.rect(0, -2, 32, 1, P.grey3)
    for (let i = 2; i < 32; i += 3) {
      a.px(i, -12, P.grey1)
      a.rect(i, -11, 1, 8, P.grey2)
      a.px(i, -4, P.grey3)
    }
    a.rect(0, -14, 1, 14, P.grey1)
    a.rect(31, -14, 1, 14, P.grey3)
    a.rect(0, -1, 4, 1, P.grey3) // feet
    a.rect(28, -1, 4, 1, P.grey3)
  }, { soft: true })
}
export function tableSprite() {
  return sprite(42, 22, 0, 20, (a) => {
    a.box(0, -13, 40, 2, 2, R.paper)
    a.rect(0, -13, 40, 1, P.white)
    a.rect(2, -9, 2, 9, R.wood[1])
    a.rect(36, -9, 2, 9, R.wood[1])
    a.px(2, -9, R.wood[2])
    a.px(36, -9, R.wood[2])
    // Cups and a jug.
    for (let i = 0; i < 7; i++) {
      const cx = 4 + i * 5
      const c = i % 3 === 0 ? P.blue : P.white
      a.rect(cx, -16, 2, 3, c)
      a.px(cx + 1, -14, darker(c))
    }
    a.rect(34, -18, 4, 5, P.cyan)
    a.px(34, -18, P.white)
    a.px(38, -16, P.blue)
  }, { soft: true })
}
/** A small bevelled sign with 3 × 5 text. */
export function signSprite(text, fill, ink, border) {
  const w = text3Width(text) + 6
  const h = 9
  return sprite(w, h, 0, 0, (a) => {
    a.rect(0, 0, w, h, fill)
    a.rect(0, 0, w, 1, border)
    a.rect(0, 0, 1, h, border)
    a.rect(0, h - 1, w, 1, darker(border))
    a.rect(w - 1, 0, 1, h, darker(border))
    a.text3(text, 3, 0, ink)
  })
}
/** Sponsor board along the front lawn, bevelled. */
export function boardSprite(text, ramp, ink) {
  const w = text3Width(text) + 10
  const h = 15
  return sprite(w, h, 0, 0, (a) => {
    a.rect(0, 0, w, h, ramp[2])
    a.rect(0, 0, w, 1, ramp[3])
    a.rect(0, 0, 1, h, ramp[3])
    a.rect(0, h - 1, w, 1, ramp[1])
    a.rect(w - 1, 0, 1, h, ramp[1])
    a.text3(text, 5, 3, ink)
    // Two screws.
    a.px(1, 1, ramp[1])
    a.px(w - 2, h - 2, ramp[3])
  }, { soft: true })
}

/* ---------- UI: panels, buttons, stamp, paper ---------- */
/** Bevelled panel: light edge top-left, dark edge bottom-right, ink outline. */
export function panelSprite(w, h, ramp, { inset = false } = {}) {
  return sprite(w, h, 0, 0, (a) => {
    const n = ramp.length
    a.rect(0, 0, w, h, ramp[n - 2])
    const hi = inset ? ramp[n - 3] : ramp[n - 1]
    const lo = inset ? ramp[n - 1] : ramp[n - 3]
    a.rect(0, 0, w, 1, hi)
    a.rect(0, 0, 1, h, hi)
    a.rect(0, h - 1, w, 1, lo)
    a.rect(w - 1, 0, 1, h, lo)
  })
}
export function soundButtonSprite(muted) {
  return sprite(18, 11, 0, 0, (a) => {
    a.rect(0, 0, 18, 11, P.slate)
    a.rect(0, 0, 18, 1, P.grey3)
    a.rect(0, 0, 1, 11, P.grey3)
    a.rect(0, 10, 18, 1, P.slateD)
    a.rect(17, 0, 1, 11, P.slateD)
    a.rect(3, 4, 3, 3, P.white)
    a.rect(6, 2, 2, 7, P.white)
    a.px(6, 2, P.grey1)
    if (muted) {
      a.px(11, 3, P.red)
      a.rect(10, 4, 3, 1, P.red)
      a.rect(10, 6, 3, 1, P.red)
      a.px(11, 7, P.red)
    } else {
      a.rect(10, 4, 1, 3, P.white)
      a.rect(12, 3, 1, 5, P.white)
      a.rect(14, 2, 1, 7, P.white)
    }
  })
}
export function stampSprite() {
  return sprite(15, 7, 0, 0, (a) => {
    a.rect(0, 0, 15, 7, P.redD)
    a.rect(1, 1, 13, 5, P.cream)
    a.text3('OK', 4, -1, P.redD)
    a.px(14, 6, P.plum)
  })
}

/* ---------- background (320 × 180, drawn once) ---------- */
export function backgroundSprite(C, W, H) {
  const finishX = (y) => C.FINISH_X + (y - C.TRACK_TOP) * C.SLANT
  const matX0 = (y) => C.MAT_X + (y - C.TRACK_TOP) * C.SLANT
  const p = new Pix(W, H)
  const r = (x, y, w, h, c) => p.rect(x, y, w, h, c)
  // Sky: three bands dithered into each other, light at the horizon.
  for (let y = 0; y < 64; y++) {
    const k = y / 64
    for (let x = 0; x < W; x++) p.px(x, y, shade([P.blue, P.cyan, P.grey1, P.white], 0.15 + k * 0.6, x, y))
  }
  // Clouds: flat-bottomed, lit on top.
  for (const [x, y, w] of [[26, 20, 26], [186, 14, 30], [280, 26, 22], [100, 30, 18]]) {
    p.disc(x + w / 2, y + 2, w / 2, 2.6, P.grey1)
    p.disc(x + w * 0.35, y, w * 0.22, 3, P.white)
    p.disc(x + w * 0.65, y + 0.5, w * 0.2, 2.6, P.white)
    r(x + 2, y + 4, w - 4, 1, P.grey1)
  }
  // Houses and the town hall.
  const house = (x, w, h, roof, win = 2) => {
    p.box(x, 64 - h, w, h, 0, R.wall)
    r(x, 64 - h, w, h - 1, R.wall[1])
    p.dither(x, 64 - h, w, h, R.wall[1], R.wall[2], 0.25)
    r(x, 64 - h, w, 1, R.wall[2])
    r(x, 64 - h, 1, h, R.wall[2])
    r(x + w - 1, 64 - h, 1, h, R.wall[0])
    // Roof, overhanging, with a lit top edge.
    r(x - 2, 64 - h - 4, w + 4, 4, roof[1])
    r(x - 2, 64 - h - 4, w + 4, 1, roof[2])
    r(x - 2, 64 - h - 1, w + 4, 1, roof[0])
    for (let i = 0; i < win; i++) {
      const wx = x + 5 + i * Math.floor((w - 10) / Math.max(1, win - 1))
      const wy = 64 - h + 6
      r(wx, wy, 5, 6, R.window[1])
      r(wx, wy, 5, 1, R.window[3])
      r(wx, wy, 1, 6, R.window[2])
      r(wx + 2, wy, 1, 6, R.wall[0])
      r(wx, wy + 3, 5, 1, R.wall[0])
      r(wx - 1, wy + 6, 7, 1, R.wall[0])
    }
    // Door.
    r(x + w - 9, 56, 5, 8, R.wood[1])
    r(x + w - 9, 56, 5, 1, R.wood[2])
    p.px(x + w - 6, 60, P.amber)
  }
  house(4, 34, 26, R.roof, 2)
  house(212, 30, 22, [P.brown, P.rust, P.tan], 2)
  house(276, 40, 28, R.roof, 3)
  // Town hall: wider, pediment, clock, flag, six tall windows on two floors.
  p.box(140, 26, 64, 38, 0, R.wall)
  p.dither(140, 26, 64, 38, R.wall[1], R.wall[2], 0.3)
  r(140, 26, 64, 1, R.wall[2])
  r(140, 26, 1, 38, R.wall[2])
  r(203, 26, 1, 38, R.wall[0])
  r(136, 22, 72, 4, R.roof[1])
  r(136, 22, 72, 1, R.roof[2])
  r(136, 25, 72, 1, R.roof[0])
  r(164, 12, 16, 10, R.wall[1])
  r(164, 12, 16, 1, R.wall[2])
  r(162, 10, 20, 2, R.roof[1])
  r(162, 10, 20, 1, R.roof[2])
  p.disc(172, 17, 3, 3, P.white)
  p.disc(172, 17, 3, 3, P.white)
  p.px(172, 15, P.ink)
  p.px(172, 16, P.ink)
  p.px(173, 17, P.ink)
  p.px(172, 17, P.ink)
  r(172, 0, 1, 10, P.slateD)
  r(173, 1, 2, 5, P.blue)
  r(175, 1, 2, 5, P.white)
  r(177, 1, 2, 5, P.red)
  for (let f = 0; f < 2; f++)
    for (let i = 0; i < 6; i++) {
      const wx = 144 + i * 10
      const wy = 33 + f * 14
      r(wx, wy, 5, 8, R.window[1])
      r(wx, wy, 5, 1, R.window[3])
      r(wx, wy, 1, 8, R.window[2])
      r(wx + 2, wy, 1, 8, R.wall[0])
      r(wx, wy + 4, 5, 1, R.wall[0])
      r(wx - 1, wy + 8, 7, 1, R.wall[0])
    }
  r(140, 46, 64, 1, R.wall[0]) // floor line
  text3(p, 'MAIRIE', 160, 27, P.slateD)
  r(140, 56, 64, 1, R.wall[2])
  r(166, 56, 12, 8, R.wood[1])
  r(166, 56, 12, 1, R.wood[2])
  r(172, 56, 1, 8, R.wood[0])
  // Trees: round crowns, trunk.
  for (const x of [46, 120, 252]) {
    r(x + 3, 46, 3, 18, R.wood[1])
    p.px(x + 3, 46, R.wood[2])
    p.ell(x + 4.5, 36, 8, 8, R.grass, 0.05)
    p.ell(x + 2, 31, 5, 4.5, R.grass, 0.1)
  }
  // Bunting: a sagging line with small pennants.
  const flags = [P.red, P.yellow, P.blue, P.green, P.white, P.orange, P.pink]
  for (let x = 0, i = 0; x < W; x += 8, i++) {
    const y = 38 + Math.round(Math.sin(x / 40) * 2)
    r(x, y, 8, 1, P.slateD)
    const c = flags[i % flags.length]
    for (let k = 0; k < 4; k++) {
      r(x + 1 + k, y + 1 + k, 6 - k * 2, 1, c)
      p.px(x + 1 + k, y + 1 + k, darker(c))
    }
    p.px(x + 1, y + 1, c === P.white ? P.white : darker(c, 0))
  }
  // Lawn behind the barriers: two greens with a soft dither, a few tufts.
  p.dither(0, 64, W, 36, R.grass[2], R.grass[3], 0.35)
  for (let i = 0; i < 90; i++) {
    const x = (i * 71) % W
    const y = 66 + ((i * 37) % 32)
    p.px(x, y, R.grass[1])
    p.px(x + 1, y, R.grass[3])
  }
  // Worn path along the barriers.
  p.dither(0, 97, W, 3, R.grass[2], R.wall[0], 0.3)
  // Track: asphalt, far edge darker, with grain inside the ramp, a white line on each side.
  for (let y = C.TRACK_TOP; y < C.TRACK_BOTTOM; y++) {
    const k = (y - C.TRACK_TOP) / (C.TRACK_BOTTOM - C.TRACK_TOP)
    for (let x = 0; x < W; x++) {
      // Grain from a small integer hash, so it does not line up in stripes.
      let h = (x * 374761393 + y * 668265263) | 0
      h = ((h ^ (h >>> 13)) * 1274126177) | 0
      const g = ((h >>> 8) & 255) / 255
      const base = R.asphalt[1 + Math.round(k)] // far rows darker, near rows lighter
      p.px(x, y, g < 0.08 ? darker(base) : g > 0.94 ? R.asphalt[Math.min(3, R.asphalt.indexOf(base) + 1)] : base)
    }
  }
  r(0, C.TRACK_TOP, W, 2, P.slateD)
  r(0, C.TRACK_TOP + 2, W, 1, P.grey1)
  r(0, C.TRACK_BOTTOM - 2, W, 1, P.grey1)
  r(0, C.TRACK_BOTTOM - 1, W, 1, P.grey3)
  // Cracks and a drain.
  p.line(30, 120, 44, 134, P.slate)
  p.line(44, 134, 48, 150, P.slate)
  p.line(270, 110, 290, 128, P.slate)
  r(300, 146, 10, 3, P.slateD)
  r(301, 147, 8, 1, P.grey3)
  // Finish line: chequered, slanted across the track.
  for (let y = C.TRACK_TOP + 4; y < C.TRACK_BOTTOM - 2; y++) {
    const x = Math.round(finishX(y))
    for (let k = 0; k < 3; k++) r(x + k * 2, y, 2, 1, (Math.floor((y - C.TRACK_TOP) / 2) + k) % 2 ? P.grey1 : P.slateD)
  }
  // The painted line where the zone begins (the mat at rest; the game redraws it live).
  void matX0
  // Curb: red and white blocks with a lit top edge, then the front lawn.
  for (let x = 0; x < W; x += 8) {
    const c = (x / 8) % 2 ? R.red : R.white
    r(x, C.TRACK_BOTTOM, 8, 3, c[2])
    r(x, C.TRACK_BOTTOM, 8, 1, c[3])
    r(x + 7, C.TRACK_BOTTOM, 1, 3, c[1])
  }
  p.dither(0, C.TRACK_BOTTOM + 3, W, H - C.TRACK_BOTTOM - 3, R.grass[1], R.grass[2], 0.4)
  return p
}

/* ---------- the mat: tiles for one row (left edge, body, right edge), blue and yellow ---------- */
/** Draws the mat into a target buffer-like with px(). Shared between the game and the tests. */
export function drawMatInto(px, matX, ext, C) {
  const total = C.MAT_W + ext
  const y0 = C.TRACK_TOP + 6
  const y1 = C.TRACK_BOTTOM - 3
  for (let y = y0; y < y1; y++) {
    const x = Math.round(matX(y))
    const row = y - y0
    for (let i = 0; i < total; i++) {
      const ramp = i < ext ? R.foamYellow : R.foam
      const li = i < ext ? i : i - ext
      const lw = i < ext ? ext : C.MAT_W
      // Quilted foam, no dithering: a dark seam every 4 rows, the far rows lit, the near
      // rows mid, the left edge of each slab in the light, its right edge in shade.
      let c = row < 4 ? ramp[3] : ramp[2]
      if (row % 4 === 3) c = ramp[1]
      if (li === 0) c = row % 4 === 3 ? ramp[2] : ramp[3]
      if (li === lw - 1) c = ramp[1]
      px(x + i, y, c)
    }
    px(x - 1, y, ext > 0 ? R.foamYellow[0] : R.foam[0])
  }
  const yb = C.TRACK_BOTTOM - 3
  for (let i = -1; i < total; i++) {
    const ramp = i < ext ? R.foamYellow : R.foam
    px(Math.round(matX(yb)) + i, yb, ramp[0])
    px(Math.round(matX(yb)) + i, yb + 1, ramp[0])
  }
}

/* ---------- build everything ---------- */
export function buildSprites(C) {
  const S = {}
  S.maire = [maireSprite(0, false), maireSprite(1, false)]
  S.maireUp = [maireSprite(0, true), maireSprite(1, true)]
  S.secouriste = [secouristeSprite(0, false), secouristeSprite(1, false)]
  S.secouristeUp = [secouristeSprite(0, true), secouristeSprite(1, true)]
  S.chien = [chienSprite(0), chienSprite(1)]
  S.poussette = [poussetteSprite(0), poussetteSprite(1)]
  S.volunteer = [volunteerSprite(0), volunteerSprite(1), volunteerSprite(2)]
  S.pigeon = { idle: pigeonSprite('idle'), peck: pigeonSprite('peck'), up: pigeonSprite('up'), down: pigeonSprite('down') }
  S.photographer = [photographerSprite(false), photographerSprite(true)]
  S.truck = [truckSprite(C, false), truckSprite(C, true)]
  S.archPost = archPostSprite(C.TRACK_BOTTOM - 30)
  S.archPostBack = archPostSprite(C.TRACK_TOP + 2 - 30)
  S.banner = bannerSprite()
  S.barrier = barrierSprite()
  S.table = tableSprite()
  S.signRavito = signSprite('RAVITO', P.white, P.red, P.red)
  S.signRalentir = signSprite('RALENTIR', P.white, P.red, P.red)
  S.boards = [
    boardSprite('BOUCHERIE MOREAU', R.red, P.white),
    boardSprite('COMITÉ DES FÊTES', R.yellow, P.plum),
    boardSprite('GARAGE PATRICK', R.blue, P.white),
    boardSprite('PISCINE MUNICIPALE', R.green, P.white),
    boardSprite('CRÉDIT COMMUNAL', R.white, P.slateD),
  ]
  S.sound = [soundButtonSprite(false), soundButtonSprite(true)]
  S.stamp = stampSprite()
  S.medic = [medicSprite(0), medicSprite(1), medicSprite(0, true)]
  S.stretcher = stretcherSprite()
  S.heli = [heliSprite(0), heliSprite(1)]
  S.mamie = [mamieSprite(0), mamieSprite(1)]
  S.hud = panelSprite(320, 13, R.navy, { inset: true })
  return S
}
