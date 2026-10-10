import { createAudio } from './audio.js'
import { drawText, drawTextC, drawTextR, textWidth, LINE_H } from './font.js'

/*
 * SIUUUU SIMULATOR — « 90 secondes. Zéro but. Un maximum de SIUUUU. »
 *
 * A caricature of the famous celebration: Ronaldo no longer scores, he only celebrates. Each
 * cycle is run-up → one key press (jump timing) → hold (spin) → release (landing timing) →
 * verdict. Ninety seconds, combos, a Fever mode and a stadium that escalates into absurdity.
 * The view is a corner of the pitch seen from above and slightly behind, the stands filling
 * the top of the screen, the corner flag at the right.
 *
 * Follows the games-site module contract: `manifest`, `create(options)`, `validate(result)`,
 * `grade(result)`. Internal resolution 640 × 360, pixel art drawn in code, no external asset.
 */

export const manifest = {
  slug: 'siuuuu-simulator',
  title: 'SIUUUU SIMULATOR',
  tagline: '90 secondes. Zéro but. Un maximum de SIUUUU.',
  releasedAt: '2026-10-10',
  status: 'draft',
  orientation: 'landscape',
  size: { width: 640, height: 360 },
  controls: [
    { action: 'press', key: 'Space', label: 'Espace, clic ou tap : appuie pour sauter, relâche pour finir la rotation' },
    { action: 'mute', key: 'KeyM', label: 'M ou bouton son : couper le son' },
    { action: 'pause', key: 'KeyP', label: 'P ou Échap : pause' },
  ],
  settings: {},
}

/* ---------- configuration (every tunable number lives here) ---------- */
export const CONFIG = {
  RUN_DURATION: 90,
  // Run-up: time to jog from the touchline to the corner, when the jump gauge shows up, and the
  // number of full back-and-forth sweeps allowed before the jump is forced (a FAIL).
  RUN_TIME: 0.9,
  GAUGE_DELAY: 0.25,
  GAUGE_SWEEPS: 2,
  // Spin gauge: the release target sits a little past the middle; auto-release at the end.
  SPIN_TARGET: 0.55,
  SPIN_MIN_HOLD: 0.05,
  // Airborne/landing/verdict pacing (seconds).
  JUMP_HEIGHT: 78,
  LAND_TIME: 0.28,
  RESULT_TIME: { PERFECT: 0.9, GOOD: 0.7, BAD: 0.75, FAIL: 0.95 },
  FREEZE_PERFECT: 0.08,
  // Verdicts: combined precision thresholds, and the floor each single timing must reach for a PERFECT.
  PERFECT_MIN: 0.9,
  PERFECT_EACH_MIN: 0.8,
  GOOD_MIN: 0.7,
  BAD_MIN: 0.4,
  BASE_POINTS: { PERFECT: 1000, GOOD: 500, BAD: 100, FAIL: 0 },
  MAX_MULT: 10,
  FEVER_PER_PERFECT: 0.25,
  FEVER_DURATION: 5,
  FEVER_BONUS: 2,
  // Difficulty tiers by elapsed time (values are interpolated between tiers): `sweep` is the
  // seconds for the jump cursor to cross the bar once, `spin` the seconds for the spin gauge
  // to fill, `perfect` the half-width of the perfect zone (0..1 of the half bar), `wind` the
  // amplitude of the target drift.
  DIFFICULTY: [
    { at: 0, sweep: 1.5, spin: 1.5, perfect: 0.24, wind: 0 },
    { at: 20, sweep: 1.25, spin: 1.05, perfect: 0.2, wind: 0 },
    { at: 40, sweep: 1.0, spin: 0.85, perfect: 0.14, wind: 0 },
    { at: 60, sweep: 0.8, spin: 0.68, perfect: 0.12, wind: 0.07 },
    { at: 80, sweep: 0.68, spin: 0.58, perfect: 0.1, wind: 0.09 },
  ],
  CHAOS_AT: 80,
  // Stadium escalation, once per game, at total score (a flawless run ends around 400 000).
  EVENTS: [
    { at: 5000, id: 'crowd', text: 'LES SUPPORTERS SAUTENT ET CRIENT SIUUU' },
    { at: 15000, id: 'subs', text: 'LES REMPLAÇANTS IMITENT RONALDO' },
    { at: 30000, id: 'refs', text: 'LES ARBITRES FONT AUSSI LE SIUUU' },
    { at: 60000, id: 'invasion', text: 'DES SUPPORTERS ENVAHISSENT LA PELOUSE' },
    { at: 100000, id: 'quake', text: 'LE STADE SE MET À TREMBLER' },
    { at: 200000, id: 'shockwave', text: 'UNE ONDE DE CHOC SOULÈVE LES TRIBUNES' },
    { at: 350000, id: 'liftoff', text: 'LE STADE DÉCOLLE' },
  ],
  COMMENTS: { 3: 'IL EST CHAUD !', 5: 'C’EST UN HOMME, ÇA ?', 7: 'LE GAZON DEMANDE GRÂCE !', 9: 'APPELEZ LA FIFA !', 10: 'MULTIPLICATEUR MAXIMUM. INHUMAIN.' },
  RESULTS_LOCK: 0.6,
  INVADERS: 14,
}

/* ---------- palette ---------- */
const P = {
  ink: '#161423',
  navy: '#1E2A4A',
  navy2: '#27365E',
  grass: '#3F9C3B',
  grass2: '#47AC43',
  grassDark: '#2E7A2D',
  line: '#F3F7EE',
  white: '#F6F6F6',
  cream: '#F1E7C9',
  grey: '#9A9EAA',
  grey2: '#6E7280',
  grey3: '#4A4D5A',
  concrete: '#B8BAC2',
  concrete2: '#8F929C',
  lime: '#C9F23B',
  yellow: '#FFD84A',
  orange: '#FF9A2E',
  red: '#E23B3B',
  red2: '#8E1F2A',
  green: '#4CD964',
  skin: '#E9B687',
  hair: '#2B1B14',
  black: '#1B1B22',
  sky: '#7CC4F5',
  sky2: '#B9E3FF',
}

/* ---------- Ronaldo: 24 × 24 pixel poses, drawn ×3 with a dark outline ---------- */
const INKS = { h: P.hair, s: P.skin, w: P.white, d: '#CBD0DA', k: P.black, n: P.navy, r: '#C8343E' }
const POSES = {
  run1: [
    '........hhhhhhh.........',
    '.......hhhhhhhhh........',
    '.......hhhhhhhhh........',
    '.......hhsssssss........',
    '.......hhssskssss.......',
    '........ssssssss........',
    '........sssssss.........',
    '.........sss............',
    '.......wwwwwww..........',
    '......wwwwwwwww.........',
    '.....swwwwwwwwws........',
    '.....sdwwwwwwwwss.......',
    '......dwwwwwwww.........',
    '......dwwwwwwww.........',
    '......dwwwwwwww.........',
    '.......wwwwwwww.........',
    '.......wwwwwwww.........',
    '......wwww..wwww........',
    '.....sss......sss.......',
    '....sss........sss......',
    '....www.........www.....',
    '...www...........www....',
    '...www...........www....',
    '..kkk.............kkk...',
  ],
  run2: [
    '........hhhhhhh.........',
    '.......hhhhhhhhh........',
    '.......hhhhhhhhh........',
    '.......hhsssssss........',
    '.......hhssskssss.......',
    '........ssssssss........',
    '........sssssss.........',
    '.........sss............',
    '.......wwwwwww..........',
    '......wwwwwwwww.........',
    '......wwwwwwwwww........',
    '.....sdwwwwwwwwws.......',
    '......dwwwwwwww.........',
    '......dwwwwwwww.........',
    '......dwwwwwwww.........',
    '.......wwwwwwww.........',
    '.......wwwwwwww.........',
    '.......wwwwwww..........',
    '.......ssssss...........',
    '.......sss.sss..........',
    '.......www.www..........',
    '.......www.www..........',
    '.......www..www.........',
    '......kkk...kkk.........',
  ],
  crouch: [
    '........................',
    '........................',
    '........................',
    '........hhhhhhh.........',
    '.......hhhhhhhhh........',
    '.......hhhhhhhhh........',
    '.......hhsssssss........',
    '.......hhssskssss.......',
    '........ssssssss........',
    '........sssssss.........',
    '.........sss............',
    '......wwwwwwwww.........',
    '....swwwwwwwwwwww.......',
    '...ssdwwwwwwwwwwws......',
    '......dwwwwwwwwwws......',
    '......dwwwwwwwww........',
    '.......wwwwwwwww........',
    '......wwwwwwwwwww.......',
    '.....wwwww..wwwwww......',
    '....sss.......ssss......',
    '....www........www......',
    '....www........www......',
    '...kkkk.........kkkk....',
    '........................',
  ],
  jumpBack: [
    '...s..............s.....',
    '...s..............s.....',
    '...ww....hhhhhhh..ww....',
    '...ww...hhhhhhhhh.ww....',
    '...ww...hhhhhhhhh.ww....',
    '....ww..hhhhhhhhh.ww....',
    '....ww..hhhhhhhhh.ww....',
    '....ww...sssssss.ww.....',
    '.....ww..sssss..ww......',
    '.....wwwwwwwwwwwww......',
    '......wwwwwwwwwww.......',
    '......wwwnnnwwwww.......',
    '......wwwwwnwwwww.......',
    '......wwwwnwwwwww.......',
    '......wwwwnwwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '......ssss...ssss.......',
    '.....sss.....sss........',
    '....www.......www.......',
    '....www.......www.......',
    '...kkkk.......kkkk......',
    '........................',
  ],
  jumpSide: [
    '..........s.............',
    '..........s.............',
    '.........ww.hhhhhh......',
    '.........ww.hhhhhhh.....',
    '.........ww.hhhhhhh.....',
    '.........wwsssssshh.....',
    '.........wwsskssshh.....',
    '..........wssssss.......',
    '..........wwsssss.......',
    '..........wwwsss........',
    '.........wwwwwwww.......',
    '.........wwwwwwww.......',
    '.........dwwwwwww.......',
    '.........dwwwwwww.......',
    '.........dwwwwwww.......',
    '.........dwwwwwww.......',
    '..........wwwwww........',
    '..........wwwwww........',
    '.........sssss..........',
    '........sss.sss.........',
    '.......www...www........',
    '.......www...www........',
    '......kkkk...kkkk.......',
    '........................',
  ],
  jumpFront: [
    '...s..............s.....',
    '...s..............s.....',
    '...ww....hhhhhhh..ww....',
    '...ww...hhhhhhhhh.ww....',
    '...ww...hhhhhhhhh.ww....',
    '....ww..hsssssssh.ww....',
    '....ww..sskssskss.ww....',
    '....ww...sssssss.ww.....',
    '.....ww..ssrrrs..ww.....',
    '.....wwwwwwwwwwwww......',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwwwdwwwww.......',
    '......wwwwwdwwwww.......',
    '......wwwwwdwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '......ssss...ssss.......',
    '.....sss.....sss........',
    '....www.......www.......',
    '....www.......www.......',
    '...kkkk.......kkkk......',
    '........................',
  ],
  siuuu: [
    '........hhhhhhh.........',
    '.......hhhhhhhhh........',
    '......hhhhhhhhhhh.......',
    '......hhhhhhhhhhh.......',
    '......hhhhhhhhhhh.......',
    '.......hhhhhhhhh........',
    '........sssssss.........',
    '.........sssss..........',
    '....wwwwwwwwwwwwwww.....',
    '..wwwwwwwwwwwwwwwwwww...',
    '.wwww.wwwwwwwwwww.wwww..',
    'wwww..wwwnnnwwwww..wwww.',
    'sss...wwwwwnwwwww...sss.',
    'ss....wwwwnwwwwww....ss.',
    '......wwwwnwwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '.....wwwww...wwwww......',
    '.....wwww.....wwww......',
    '....ssss.......ssss.....',
    '....wwww.......wwww.....',
    '...wwww.........wwww....',
    '...wwww.........wwww....',
    '..kkkk...........kkkk...',
  ],
  good: [
    '........hhhhhhh.........',
    '.......hhhhhhhhh........',
    '......hhhhhhhhhhh.......',
    '......hhhhhhhhhhh.......',
    '......hhhhhhhhhhh.......',
    '.......hhhhhhhhh........',
    '........sssssss.........',
    '.........sssss..........',
    '.....wwwwwwwwwwwww......',
    '....wwwwwwwwwwwwwww.....',
    '...wwwwwwwwwwwwwwwww....',
    '..wwwwwwwnnnwwwwwwwww...',
    '..www.wwwwwnwwwww.www...',
    '.sss..wwwwnwwwwww..sss..',
    '.ss...wwwwnwwwwww...ss..',
    '......wwwwwwwwwww.......',
    '......wwwwwwwwwww.......',
    '......wwwww.wwwww.......',
    '......wwww...wwww.......',
    '......ssss...ssss.......',
    '.....wwww.....wwww......',
    '.....wwww.....wwww......',
    '.....wwww.....wwww......',
    '....kkkk.......kkkk.....',
  ],
  bad: [
    '......hhhhhhh...........',
    '.....hhhhhhhhh....s.....',
    '....hhhhhhhhhhh...s.....',
    '....hhhhhhhhhhh...ww....',
    '....hhhhhhhhhhh...ww....',
    '.....hhhhhhhhh....ww....',
    '......sssssss.....ww....',
    '.......sssss.....ww.....',
    '.....wwwwwwwwwwwwww.....',
    '....wwwwwwwwwwwwww......',
    '...wwwwwwwwwwwwww.......',
    '..wwww.wwnnnwwww........',
    '.www...wwwwnwwww........',
    'ss.....wwwnwwwww........',
    'ss.....wwwnwwwww........',
    '.......wwwwwwwww........',
    '.......wwwwwwwww........',
    '......wwwww.wwwwww......',
    '......wwww...wwwwww.....',
    '......ssss.....ssss.....',
    '.....wwww.......www.....',
    '.....wwww......www......',
    '.....wwww.....www.......',
    '....kkkk.....kkkk.......',
  ],
  fail1: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..................ss....',
    '..................ww....',
    '..hhhhh...........ww....',
    '.hhhhhhhwwwwwwwwwwwww...',
    '.hhhhhhhwwwwwwwwwwwwww..',
    '.hhssssswwwwwwwwwwwwwwww',
    '..sssss.dddddddwwwwwwkkk',
    '...sss..ddddddd..wwww...',
    '........................',
    '........................',
  ],
  fail2: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..............kkk..kkk..',
    '..............www..www..',
    '..............www..www..',
    '..............sss..sss..',
    '..............sss.sss...',
    '...............wwwwww...',
    '.......wwwwwwwwwwwwww...',
    '.....hhwwwwwwwwwwwwwww..',
    '....hhhhwwwwnnnwwwwwww..',
    '...hhhhhhsssswnwwwwwwww.',
    '...hhhhhhsssswnwwwwwwww.',
    '...hhhhhhssssswwwwwwww..',
    '....hhhhhhsss.wwwwwwww..',
    '.....hhhhsss..wwwwwwww..',
    '.......sss....ss....ss..',
    '..............ss....ss..',
    '........................',
  ],
}
const SPRITE_SCALE = 4
const spriteCache = new Map()
function sprite(name, flip = false) {
  const key = name + (flip ? 'f' : '')
  let c = spriteCache.get(key)
  if (c) return c
  const rows = POSES[name]
  const h = rows.length
  const w = rows[0].length
  const S = SPRITE_SCALE
  c = document.createElement('canvas')
  c.width = (w + 2) * S
  c.height = (h + 2) * S
  const x = c.getContext('2d')
  const at = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? rows[j][i] : '.')
  const col = (i) => (flip ? w - 1 - i : i)
  // outline pass
  x.fillStyle = P.ink
  for (let j = -1; j <= h; j++)
    for (let i = -1; i <= w; i++) {
      if (at(i, j) !== '.') continue
      if (at(i - 1, j) !== '.' || at(i + 1, j) !== '.' || at(i, j - 1) !== '.' || at(i, j + 1) !== '.') x.fillRect((col(i) + 1) * S, (j + 1) * S, S, S)
    }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i]
      if (ch === '.') continue
      x.fillStyle = INKS[ch]
      x.fillRect((col(i) + 1) * S, (j + 1) * S, S, S)
    }
  spriteCache.set(key, c)
  return c
}

/* ---------- small people (fans, substitutes, referees, invaders): 7 × 9 pixel maps ×2 ---------- */
const MINI = {
  idle: ['..hhh..', '..sss..', '..sss..', '.wwwww.', '.swwws.', '..www..', '..p.p..', '..p.p..', '..k.k..'],
  up: ['s.....s', 's.hhh.s', 'w.sss.w', '.wsssw.', '..www..', '..www..', '..p.p..', '..p.p..', '..k.k..'],
  siuuu: ['..hhh..', '..hhh..', '..sss..', '.wwwww.', 'wwwwwww', 's.www.s', '..w.w..', '.p...p.', '.k...k.'],
  sit: ['.......', '.......', '..hhh..', '..sss..', '..sss..', '.wwwww.', '.swwws.', '..wwwp.', '..pkpk.'],
  run1: ['..hhh..', '..sss..', '.ssss..', '.wwwws.', 's.www..', '..www..', '.p..p..', 'p....p.', 'k....k.'],
  run2: ['..hhh..', '..sss..', '..sss..', '.wwwws.', '.swww..', '..www..', '..pp...', '..p.p..', '..k.k..'],
}
const miniCache = new Map()
function mini(pose, shirt, hair, skin, pants = '#2F3550') {
  const key = pose + shirt + hair + skin + pants
  let c = miniCache.get(key)
  if (c) return c
  const rows = MINI[pose]
  c = document.createElement('canvas')
  c.width = 14
  c.height = 18
  const x = c.getContext('2d')
  const inks = { h: hair, s: skin, w: shirt, p: pants, k: P.black }
  rows.forEach((row, j) => {
    for (let i = 0; i < 7; i++) {
      const ch = row[i]
      if (ch === '.') continue
      x.fillStyle = inks[ch]
      x.fillRect(i * 2, j * 2, 2, 2)
    }
  })
  miniCache.set(key, c)
  return c
}
const SHIRTS = ['#F6F6F6', '#F6F6F6', '#E23B3B', '#FFD84A', '#2C4FA3', '#2C4FA3', '#4CAF50', '#9A9EAA', '#F08A24', '#7B3FA0', '#1E2A4A', '#E8D8B0']
const HAIRS = ['#2B1B14', '#2B1B14', '#111', '#8A5A2B', '#D8B25C', '#C8502E', '#9A9EAA', '#F6F6F6', '#2B1B14', '#4A2C7A']
const SKINS = ['#E9B687', '#F2CBA4', '#C68A5A', '#8C5A3C', '#5C3A26', '#E9B687']

/* ---------- utilities ---------- */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')

/** Accuracy (0..1) of a timing error e (0 = on the target, 1 = far end) with a perfect zone half-width wp. */
export function accuracy(e, wp) {
  if (e <= wp) return 1
  return Math.max(0, 0.9 - 0.9 * ((e - wp) / (1 - wp)))
}
/** Error at which the accuracy drops to `acc` (inverse of the above), used to paint the gauge zones. */
export function errorFor(acc, wp) {
  if (acc >= 1) return wp
  return wp + ((0.9 - acc) / 0.9) * (1 - wp)
}
/** Verdict for two timings. */
export function verdict(jumpAcc, spinAcc) {
  const total = (jumpAcc + spinAcc) / 2
  if (total >= CONFIG.PERFECT_MIN && jumpAcc >= CONFIG.PERFECT_EACH_MIN && spinAcc >= CONFIG.PERFECT_EACH_MIN) return 'PERFECT'
  if (total >= CONFIG.GOOD_MIN) return 'GOOD'
  if (total >= CONFIG.BAD_MIN) return 'BAD'
  return 'FAIL'
}
/** Difficulty values interpolated for an elapsed time. */
export function difficultyAt(elapsed) {
  const tiers = CONFIG.DIFFICULTY
  let i = 0
  while (i < tiers.length - 1 && elapsed >= tiers[i + 1].at) i++
  const a = tiers[i]
  const b = tiers[Math.min(tiers.length - 1, i + 1)]
  const span = b.at - a.at || 1
  const t = clamp((elapsed - a.at) / span, 0, 1)
  return { sweep: lerp(a.sweep, b.sweep, t), spin: lerp(a.spin, b.spin, t), perfect: lerp(a.perfect, b.perfect, t), wind: lerp(a.wind, b.wind, t), chaos: elapsed >= CONFIG.CHAOS_AT }
}

/* ---------- scene geometry ---------- */
const GW = 640
const GH = 360
const STAND_BOTTOM = 148
const WALL_BOTTOM = 166
const BOARD_BOTTOM = 192
const PITCH_TOP = 200
const TOUCHLINE = 207
const GOAL_LINE = 598
const RUN_START_X = -60
const RUN_END_X = 436
const RUN_Y = 300 // feet line of the run
const LAND_DX = 36

/* ---------- the game ---------- */
export function create({ canvas, settings = {}, onState, onEnd }) {
  const ctx = canvas.getContext('2d', { alpha: false })
  canvas.width = GW
  canvas.height = GH
  ctx.imageSmoothingEnabled = false
  if (settings.config) Object.assign(CONFIG, settings.config)
  const debug = !!settings.debug
  const seed = settings.seed != null ? Number(settings.seed) || 1 : (Date.now() & 0xffff) || 1
  const rng = mulberry32(seed)

  const load = (key, fallback) => {
    try {
      const v = localStorage.getItem('siuuuuSimulator:' + key)
      return v == null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  }
  const save = (key, value) => {
    try {
      localStorage.setItem('siuuuuSimulator:' + key, JSON.stringify(value))
    } catch {}
  }

  const audio = createAudio()
  audio.setMuted(load('muted', false) === true)

  /* ----- persistent scene: fans, substitutes, referees ----- */
  const fans = []
  const AISLES = [[196, 214], [436, 454]]
  for (let row = 0; row < 9; row++) {
    const y = 4 + row * 15
    for (let x = 2 + (row % 2) * 7; x < GW - 12; x += 15) {
      if (AISLES.some(([a, b]) => x + 14 > a && x < b)) continue
      fans.push({
        x: x + Math.floor(rng() * 3) - 1,
        y,
        shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
        hair: HAIRS[Math.floor(rng() * HAIRS.length)],
        skin: SKINS[Math.floor(rng() * SKINS.length)],
        phase: rng() * Math.PI * 2,
        rate: 5 + rng() * 3,
        up: rng() < 0.08,
      })
    }
  }
  const subs = Array.from({ length: 6 }, (_, i) => ({
    x: 22 + i * 18,
    y: 168,
    hair: HAIRS[Math.floor(rng() * HAIRS.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    phase: rng() * 6,
  }))
  const refs = [
    { x: 540, y: 318, hair: '#111', skin: SKINS[1], flag: false },
    { x: 606, y: 246, hair: '#8A5A2B', skin: SKINS[2], flag: true },
  ]

  /* ----- mutable state ----- */
  let state = 'TITLE'
  let best = Number(load('best', 0)) || 0
  let g = null
  let raf = 0
  let last = 0
  let running = false
  let paused = false
  let clock = 0 // global time for ambient animation
  let held = false
  let lock = 0
  let freeze = 0
  let flash = 0
  let flashColour = P.white
  let shake = 0
  let shakeAmp = 0
  let banner = null // stadium event banner
  let comment = null
  const particles = []
  const popups = []
  const invaders = []
  const clouds = Array.from({ length: 7 }, (_, i) => ({ x: rng() * GW, y: 20 + rng() * 300, w: 60 + rng() * 80, v: 20 + rng() * 40 }))
  let liftoff = 0 // 0..1 progress of the stadium take-off
  let shockwave = 0
  const titleIdle = { t: 0 }

  function setState(s) {
    state = s
    onState?.(s === 'TITLE' ? 'idle' : s === 'GAME_OVER' ? 'over' : 'playing')
  }

  function newGame() {
    g = {
      elapsed: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      siuuus: 0,
      perfects: 0,
      goods: 0,
      bads: 0,
      fails: 0,
      cycles: 0,
      fever: 0,
      feverTime: 0,
      feverCount: 0,
      events: new Set(),
      cycle: null,
      ending: false,
      ronaldo: { x: RUN_START_X, y: RUN_Y, pose: 'run1', flip: false, air: 0 },
    }
    particles.length = 0
    popups.length = 0
    invaders.length = 0
    banner = null
    comment = null
    liftoff = 0
    shockwave = 0
    shake = 0
    flash = 0
    startRunup()
    audio.setCrowd(0)
    audio.setTempo(1)
    audio.startMusic()
    audio.whistle()
    setState('RUNUP')
  }

  function startRunup() {
    g.cycle = {
      t: 0,
      jumpErr: null,
      spinErr: null,
      gaugeT: 0, // time since the jump gauge appeared
      spinT: 0,
      spinP: 0,
      windPhase: rng() * 6.28,
      hold: 0,
      jumpX: 0,
      result: null,
      resultT: 0,
      failPose: 'fail1',
      timedOut: false,
    }
    g.ronaldo.x = RUN_START_X
    g.ronaldo.y = RUN_Y
    g.ronaldo.air = 0
    g.ronaldo.flip = false
    g.ronaldo.pose = 'run1'
    setState('RUNUP')
  }

  const diff = () => difficultyAt(g.elapsed)
  const multiplier = () => Math.min(CONFIG.MAX_MULT, 1 + g.combo)
  const inFever = () => g.feverTime > 0
  function windOffset() {
    return diff().wind * Math.sin(clock * 1.7 + g.cycle.windPhase)
  }
  /** Position (0..1) of the sweeping jump cursor for a gauge time. */
  function jumpCursor() {
    const d = diff()
    const u = (g.cycle.gaugeT / d.sweep) % 2
    return u <= 1 ? u : 2 - u
  }
  function jumpTarget() {
    return 0.5 + windOffset()
  }

  /* ----- input ----- */
  function press(down) {
    if (down) {
      if (held) return
      held = true
      onKeyDown()
    } else {
      if (!held) return
      held = false
      onKeyUp()
    }
  }
  function onKeyDown() {
    audio.resume()
    if (state === 'TITLE') {
      if (lock > 0) return
      newGame()
      return
    }
    if (state === 'GAME_OVER') {
      if (lock > 0) return
      newGame()
      return
    }
    if (paused) return
    if (state === 'RUNUP') {
      const c = g.cycle
      if (c.t < CONFIG.GAUGE_DELAY) return // not yet: the gauge is not shown
      const target = jumpTarget()
      const signed = clamp((jumpCursor() - target) / 0.5, -1, 1)
      c.jumpHit = signed
      c.jumpErr = Math.abs(signed)
      takeOff()
    }
  }
  function onKeyUp() {
    if (state === 'AIRBORNE' && g.cycle.spinErr == null) {
      const c = g.cycle
      const signed = clamp((c.spinP - CONFIG.SPIN_TARGET) / 0.5, -1, 1)
      c.spinHit = signed
      c.spinErr = Math.abs(signed)
      startLanding()
    }
  }
  function takeOff() {
    const c = g.cycle
    c.jumpX = g.ronaldo.x
    c.spinT = 0
    c.spinP = 0
    g.ronaldo.pose = 'crouch'
    audio.jump()
    audio.spinStart()
    burst(g.ronaldo.x + 13 * SPRITE_SCALE, RUN_Y, 10, [P.cream, P.grass2], 60, 1)
    setState('AIRBORNE')
  }
  function startLanding() {
    audio.spinStop()
    g.cycle.landT = 0
    setState('LANDING')
  }
  function forcedFail(reason) {
    const c = g.cycle
    c.jumpErr = c.jumpErr == null ? 1 : c.jumpErr
    c.spinErr = c.spinErr == null ? 1 : c.spinErr
    c.timedOut = true
    c.reason = reason
    audio.spinStop()
    resolve()
  }

  /* ----- verdict ----- */
  function resolve() {
    const c = g.cycle
    const ja = accuracy(c.jumpErr, diff().perfect)
    const sa = accuracy(c.spinErr, diff().perfect)
    const v = c.timedOut ? 'FAIL' : verdict(ja, sa)
    c.result = v
    c.resultT = 0
    c.jumpAcc = ja
    c.spinAcc = sa
    g.cycles++
    const r = g.ronaldo
    const landX = c.jumpX + LAND_DX
    r.x = landX
    r.y = RUN_Y
    r.air = 0
    let pts = 0
    const feverMul = inFever() ? CONFIG.FEVER_BONUS : 1
    if (v === 'PERFECT' || v === 'GOOD') {
      pts = CONFIG.BASE_POINTS[v] * multiplier() * feverMul
      g.combo++
      g.maxCombo = Math.max(g.maxCombo, g.combo)
      g.siuuus++
      if (v === 'PERFECT') {
        g.perfects++
        if (!inFever()) {
          g.fever = Math.min(1, g.fever + CONFIG.FEVER_PER_PERFECT)
          if (g.fever >= 1 - 1e-6) startFever()
        }
      } else g.goods++
      r.pose = v === 'PERFECT' ? 'siuuu' : 'good'
      r.flip = false
    } else if (v === 'BAD') {
      pts = CONFIG.BASE_POINTS.BAD * feverMul
      g.combo = 0
      g.bads++
      r.pose = 'bad'
      r.flip = rng() < 0.5
    } else {
      pts = 0
      g.combo = 0
      g.fails++
      r.pose = rng() < 0.5 ? 'fail1' : 'fail2'
      r.flip = rng() < 0.5
    }
    addScore(pts)
    // feedback
    const cx = r.x + 13 * SPRITE_SCALE
    const cy = r.y - 150
    if (v === 'PERFECT') {
      audio.perfect()
      freeze = CONFIG.FREEZE_PERFECT
      flash = 0.18
      flashColour = P.lime
      shake = Math.max(shake, 0.25)
      shakeAmp = 4
      burst(cx, r.y - 30, 40, [P.lime, P.yellow, P.white], 170, 1.1)
      ring(cx, r.y - 20)
      popups.push({ text: 'PERFECT SIUUU !', x: cx, y: cy, life: 1.1, scale: 4, colour: P.lime, outline: P.navy })
    } else if (v === 'GOOD') {
      audio.good()
      burst(cx, r.y - 30, 18, [P.white, P.yellow], 120, 0.9)
      popups.push({ text: 'GOOD SIUUU', x: cx, y: cy, life: 0.9, scale: 3, colour: P.yellow, outline: P.navy })
    } else if (v === 'BAD') {
      audio.bad()
      burst(cx, r.y - 10, 10, [P.grey, P.cream], 70, 0.7)
      popups.push({ text: 'BAD SIUUU…', x: cx, y: cy, life: 0.9, scale: 3, colour: P.orange, outline: P.navy })
    } else {
      audio.fail()
      burst(cx, r.y - 6, 16, [P.grassDark, P.grass2, '#8B5A2B'], 90, 0.8)
      popups.push({ text: c.reason === 'late' ? 'TROP TARD !' : 'FAIL', x: cx, y: cy, life: 1, scale: 3, colour: P.red, outline: P.white })
    }
    if (pts > 0) popups.push({ text: '+' + fmt(pts), x: cx + (rng() * 40 - 20), y: cy - 26, life: 1.2, scale: 2, colour: P.white, outline: P.ink, rise: 30 })
    if ((v === 'PERFECT' || v === 'GOOD') && g.combo >= 2) {
      popups.push({ text: 'COMBO ×' + Math.min(CONFIG.MAX_MULT, 1 + g.combo), x: cx - 120, y: r.y - 60, life: 0.8, scale: 2, colour: P.cream, outline: P.navy })
      const line = CONFIG.COMMENTS[Math.min(CONFIG.MAX_MULT, 1 + g.combo)]
      if (line) comment = { text: 'COMMENTATEUR : ' + line, life: 2.6 }
    }
    audio.setCrowd(Math.min(1, g.combo / 8 + (inFever() ? 0.4 : 0)))
    setState('RESULT')
  }

  function addScore(pts) {
    g.score += pts
    for (const ev of CONFIG.EVENTS) {
      if (g.score >= ev.at && !g.events.has(ev.id)) {
        g.events.add(ev.id)
        triggerEvent(ev)
      }
    }
  }
  function startFever() {
    g.feverTime = CONFIG.FEVER_DURATION
    g.feverCount++
    audio.fever()
    audio.setTempo(1.25)
    popups.push({ text: 'SIUUU FEVER !', x: GW / 2, y: 120, life: 1.4, scale: 4, colour: P.yellow, outline: P.red2 })
    burst(GW / 2, 140, 60, [P.yellow, P.lime, P.orange, P.white], 200, 1.4)
  }
  function endFever() {
    g.feverTime = 0
    g.fever = 0
    audio.setTempo(1)
  }
  function triggerEvent(ev) {
    banner = { text: ev.text, life: 3 }
    audio.event()
    flash = 0.1
    flashColour = P.white
    if (ev.id === 'crowd') for (const f of fans) f.up = true
    if (ev.id === 'invasion') {
      for (let i = 0; i < CONFIG.INVADERS; i++) {
        const f = fans[Math.floor(rng() * fans.length)]
        invaders.push({ x: 40 + rng() * 520, y: WALL_BOTTOM - 4, tx: 0, ty: 0, t: rng() * 2, shirt: f.shirt, hair: f.hair, skin: f.skin, phase: rng() * 6, delay: i * 0.12 })
      }
    }
    if (ev.id === 'quake') {
      shake = 999
      shakeAmp = 2
    }
    if (ev.id === 'shockwave') shockwave = 0.001
    if (ev.id === 'liftoff') liftoff = 0.001
  }

  /* ----- particles ----- */
  function burst(x, y, n, colours, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2
      const s = speed * (0.3 + rng() * 0.7)
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4, life: life * (0.5 + rng() * 0.5), max: life, colour: colours[Math.floor(rng() * colours.length)], size: 2 + Math.floor(rng() * 3), g: 220 })
    }
  }
  function ring(x, y) {
    particles.push({ ring: true, x, y, r: 6, life: 0.45, max: 0.45, colour: P.lime })
  }
  function confetti(n) {
    for (let i = 0; i < n; i++) particles.push({ x: rng() * GW, y: -8, vx: rng() * 40 - 20, vy: 60 + rng() * 80, life: 3, max: 3, colour: [P.lime, P.yellow, P.orange, P.white, P.red][Math.floor(rng() * 5)], size: 3, g: 0, sway: rng() * 6 })
  }

  /* ----- update ----- */
  function update(dt) {
    clock += dt
    if (lock > 0) lock -= dt
    if (flash > 0) flash -= dt
    if (comment && (comment.life -= dt) <= 0) comment = null
    if (banner && (banner.life -= dt) <= 0) banner = null
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]
      p.life -= dt
      if (p.rise) p.y -= p.rise * dt
      if (p.life <= 0) popups.splice(i, 1)
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life -= dt
      if (p.ring) p.r += 260 * dt
      else {
        p.x += p.vx * dt + (p.sway ? Math.sin(clock * p.sway) * 20 * dt : 0)
        p.y += p.vy * dt
        p.vy += (p.g || 0) * dt
      }
      if (p.life <= 0 || p.y > GH + 10) particles.splice(i, 1)
    }
    if (shake > 0 && shake < 999) shake -= dt
    if (shockwave > 0 && shockwave < 1) shockwave = Math.min(1, shockwave + dt / 2.2)
    if (liftoff > 0 && liftoff < 1) liftoff = Math.min(1, liftoff + dt / 6)
    for (const c of clouds) {
      c.x -= c.v * dt * (0.4 + liftoff * 2)
      if (c.x + c.w < -10) {
        c.x = GW + 10
        c.y = 10 + rng() * 320
      }
    }
    if (state === 'TITLE' || state === 'GAME_OVER') {
      titleIdle.t += dt
      return
    }
    if (paused) return
    if (freeze > 0) {
      freeze -= dt
      return
    }
    if (!g) return
    g.elapsed += dt
    if (g.feverTime > 0) {
      g.feverTime -= dt
      if (g.feverTime <= 0) endFever()
      else if (Math.floor(clock * 20) % 2 === 0) confetti(1)
    }
    if (diff().chaos && Math.floor(clock * 15) % 3 === 0) confetti(1)
    const r = g.ronaldo
    const c = g.cycle
    c.t += dt
    if (state === 'RUNUP') {
      const k = smooth(clamp(c.t / CONFIG.RUN_TIME, 0, 1))
      r.x = lerp(RUN_START_X, RUN_END_X, k)
      r.pose = Math.floor(clock * 10) % 2 ? 'run1' : 'run2'
      if (c.t >= CONFIG.GAUGE_DELAY) {
        c.gaugeT += dt
        const timeout = CONFIG.GAUGE_SWEEPS * 2 * diff().sweep
        if (c.gaugeT >= timeout) {
          c.jumpX = r.x
          c.failPose = 'fail1'
          forcedFail('late')
        }
      }
      if (g.elapsed >= CONFIG.RUN_DURATION) finish()
    } else if (state === 'AIRBORNE') {
      c.spinT += dt
      c.spinP = clamp(c.spinT / diff().spin, 0, 1)
      const k = clamp(c.spinT / (diff().spin * 1.05), 0, 1)
      r.x = c.jumpX + LAND_DX * 0.7 * k
      r.air = Math.sin(Math.min(1, k) * Math.PI * 0.5) * CONFIG.JUMP_HEIGHT
      const frames = ['jumpBack', 'jumpSide', 'jumpFront', 'jumpSideR']
      const f = frames[Math.floor(c.spinT * 11) % 4]
      r.pose = f === 'jumpSideR' ? 'jumpSide' : f
      r.flip = f === 'jumpSideR'
      if (c.spinP >= 1) {
        c.spinErr = 1
        c.spinHit = 1
        startLanding()
      }
    } else if (state === 'LANDING') {
      c.landT += dt
      const k = clamp(c.landT / CONFIG.LAND_TIME, 0, 1)
      const startAir = r.air
      r.x = lerp(r.x, c.jumpX + LAND_DX, k * 0.5)
      r.air = lerp(startAir, 0, k * k)
      r.pose = 'jumpBack'
      if (k >= 1) resolve()
    } else if (state === 'RESULT') {
      c.resultT += dt
      const dur = CONFIG.RESULT_TIME[c.result]
      if (c.resultT >= dur) {
        if (g.elapsed >= CONFIG.RUN_DURATION) finish()
        else startRunup()
      }
    }
    // ambient actors
    for (const inv of invaders) {
      inv.delay -= dt
      if (inv.delay > 0) continue
      inv.t -= dt
      if (inv.t <= 0) {
        inv.t = 0.8 + rng() * 1.6
        inv.tx = 20 + rng() * 560
        inv.ty = PITCH_TOP + 10 + rng() * 130
      }
      const dx = inv.tx - inv.x
      const dy = inv.ty - inv.y
      const d = Math.hypot(dx, dy) || 1
      const sp = 70
      if (d > 3) {
        inv.x += (dx / d) * sp * dt
        inv.y += (dy / d) * sp * dt
      }
    }
  }

  function finish() {
    if (g.ending) return
    g.ending = true
    audio.spinStop()
    audio.stopMusic()
    audio.whistle()
    audio.roar(1.3, 0.3)
    if (g.feverTime > 0) endFever()
    if (g.score > best) {
      best = g.score
      save('best', best)
    }
    lock = CONFIG.RESULTS_LOCK
    const result = {
      score: g.score,
      best,
      siuuus: g.siuuus,
      perfects: g.perfects,
      goods: g.goods,
      bads: g.bads,
      fails: g.fails,
      maxCombo: g.maxCombo,
      fevers: g.feverCount,
      cycles: g.cycles,
      duration: CONFIG.RUN_DURATION,
      seed,
    }
    result.rank = grade(result)
    g.result = result
    g.ronaldo.pose = g.score > 0 ? 'siuuu' : 'fail2'
    g.ronaldo.air = 0
    setState('GAME_OVER')
    onEnd?.(result)
  }

  /* ----- drawing ----- */
  const BOARDS = [
    { bg: P.ink, fg: P.lime, text: 'DUMB GAMES' },
    { bg: P.red, fg: P.white, text: 'SIUUU COLA' },
    { bg: P.navy, fg: P.cream, text: 'BANQUE DU COIN' },
    { bg: P.yellow, fg: P.ink, text: 'PIZZA N°7' },
    { bg: '#2F7D4F', fg: P.white, text: 'GAZON PRO' },
    { bg: P.white, fg: P.red, text: 'TAXI SIUUU' },
  ].map((b) => ({ ...b, w: textWidth(b.text, 2) + 28 }))
  let touch = false

  function sceneOffset() {
    let ox = 0
    let oy = 0
    if (shake > 0) {
      ox += (rng() * 2 - 1) * shakeAmp
      oy += (rng() * 2 - 1) * shakeAmp
    }
    if (liftoff > 0) oy += -liftoff * 26 + Math.sin(clock * 2.3) * 3 * liftoff
    return { ox: Math.round(ox), oy: Math.round(oy) }
  }

  function drawScene() {
    const { ox, oy } = sceneOffset()
    const chaos = g && diff().chaos
    const fever = g && inFever()
    // sky behind everything, visible once the stadium lifts
    ctx.fillStyle = P.sky
    ctx.fillRect(0, 0, GW, GH)
    if (liftoff > 0) {
      ctx.fillStyle = P.sky2
      for (const c of clouds) {
        ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w), 10)
        ctx.fillRect(Math.round(c.x + c.w * 0.2), Math.round(c.y - 6), Math.round(c.w * 0.5), 6)
      }
    }
    ctx.save()
    ctx.translate(ox, oy)

    // stands: concrete steps
    for (let row = 0; row < 10; row++) {
      ctx.fillStyle = row % 2 ? P.concrete : P.concrete2
      ctx.fillRect(0, row * 15, GW, 15)
      ctx.fillStyle = P.grey3
      ctx.fillRect(0, row * 15 + 14, GW, 1)
    }
    for (const [a, b] of AISLES) {
      ctx.fillStyle = '#D5D7DD'
      ctx.fillRect(a, 0, b - a, STAND_BOTTOM)
      ctx.fillStyle = P.grey2
      for (let y = 4; y < STAND_BOTTOM; y += 8) ctx.fillRect(a, y, b - a, 1)
    }
    // fans, back rows first
    const excited = g && (g.events.has('crowd') || fever)
    for (const f of fans) {
      const s = Math.sin(clock * f.rate + f.phase)
      const jumping = excited || f.up
      let dy = jumping ? (s > 0 ? -3 : 0) : Math.round(s * 0.6)
      let dx = 0
      if (shockwave > 0) {
        const front = shockwave * (GW + 260) - 120
        const d = Math.abs(f.x - front)
        if (d < 110) dy -= Math.round(16 * Math.cos((d / 110) * Math.PI * 0.5))
      }
      if (chaos) dx = Math.round(Math.sin(clock * 9 + f.phase) * 1)
      const pose = jumping && s > 0 ? 'up' : 'idle'
      ctx.drawImage(mini(pose, f.shirt, f.hair, f.skin), f.x + dx, f.y + dy)
    }
    // railing + wall
    ctx.fillStyle = P.grey3
    ctx.fillRect(0, STAND_BOTTOM - 2, GW, 2)
    ctx.fillStyle = '#CDCFD6'
    ctx.fillRect(0, STAND_BOTTOM, GW, WALL_BOTTOM - STAND_BOTTOM)
    ctx.fillStyle = P.concrete2
    ctx.fillRect(0, WALL_BOTTOM - 3, GW, 3)
    // dugout with the substitutes, bottom-left of the stands
    ctx.fillStyle = P.navy
    ctx.fillRect(8, STAND_BOTTOM, 122, BOARD_BOTTOM - STAND_BOTTOM)
    ctx.fillStyle = P.navy2
    ctx.fillRect(12, STAND_BOTTOM + 4, 114, BOARD_BOTTOM - STAND_BOTTOM - 8)
    ctx.fillStyle = '#5A6A8E'
    ctx.fillRect(12, STAND_BOTTOM + 4, 114, 2)
    drawText(ctx, 'BANC', 14, STAND_BOTTOM + 2, P.cream)
    const subsUp = g && g.events.has('subs')
    if (!subsUp) for (const s of subs) ctx.drawImage(mini('sit', P.white, s.hair, s.skin, P.white), s.x, s.y)
    ctx.fillStyle = P.grey3
    ctx.fillRect(12, BOARD_BOTTOM - 6, 114, 2)
    // advertising boards
    let bx = 132
    let bi = 0
    while (bx < GW) {
      const b = BOARDS[bi % BOARDS.length]
      ctx.fillStyle = b.bg
      ctx.fillRect(bx, WALL_BOTTOM, b.w, BOARD_BOTTOM - WALL_BOTTOM)
      ctx.fillStyle = P.ink
      ctx.fillRect(bx + b.w - 2, WALL_BOTTOM, 2, BOARD_BOTTOM - WALL_BOTTOM)
      drawTextC(ctx, b.text, bx + b.w / 2, WALL_BOTTOM + 4, b.fg, { scale: 2 })
      bx += b.w
      bi++
    }
    // cinder track then the pitch
    ctx.fillStyle = '#8E5A3C'
    ctx.fillRect(0, BOARD_BOTTOM, GW, PITCH_TOP - BOARD_BOTTOM)
    for (let y = PITCH_TOP; y < GH + 40; y += 20) {
      const band = ((y - PITCH_TOP) / 20) % 2
      let colour = band ? P.grass : P.grass2
      if (chaos) colour = band ? ['#3F9C3B', '#3B8FB0', '#A03BB0', '#B0803B'][Math.floor(clock * 2) % 4] : P.grass2
      if (fever && !chaos) colour = band ? '#4EA83C' : '#5CBE44'
      ctx.fillStyle = colour
      ctx.fillRect(0, y, GW, 20)
    }
    // lines, corner arc and flag
    ctx.fillStyle = P.line
    ctx.fillRect(0, TOUCHLINE - 1, GOAL_LINE + 1, 2)
    ctx.fillRect(GOAL_LINE - 1, TOUCHLINE - 1, 2, GH)
    for (let a = 0; a <= 16; a++) {
      const t = (a / 16) * Math.PI * 0.5
      ctx.fillRect(Math.round(GOAL_LINE - Math.cos(t) * 22) - 1, Math.round(TOUCHLINE + Math.sin(t) * 22) - 1, 2, 2)
    }
    // corner flag
    const sway = Math.round(Math.sin(clock * 3) * 1.5)
    ctx.fillStyle = P.ink
    ctx.fillRect(GOAL_LINE - 1, TOUCHLINE - 28, 2, 28)
    ctx.fillStyle = P.yellow
    ctx.fillRect(GOAL_LINE + 1, TOUCHLINE - 28 + sway, 12, 4)
    ctx.fillStyle = P.red
    ctx.fillRect(GOAL_LINE + 1, TOUCHLINE - 24 + sway, 12, 4)
    ctx.fillStyle = P.yellow
    ctx.fillRect(GOAL_LINE + 1, TOUCHLINE - 20 + sway, 8, 3)
    // the side netting beyond the goal line
    ctx.fillStyle = P.navy
    ctx.fillRect(618, PITCH_TOP, GW - 618, GH - PITCH_TOP)
    ctx.fillStyle = '#6B7691'
    for (let y = PITCH_TOP; y < GH; y += 6) ctx.fillRect(618, y, GW - 618, 1)
    for (let x = 618; x < GW; x += 6) ctx.fillRect(x, PITCH_TOP, 1, GH - PITCH_TOP)
    ctx.fillStyle = P.white
    ctx.fillRect(615, PITCH_TOP, 3, GH - PITCH_TOP)

    // substitutes standing on the track, imitating the master
    if (subsUp)
      for (const s of subs) {
        const bob = Math.sin(clock * 6 + s.phase) > 0 ? -2 : 0
        ctx.drawImage(mini('siuuu', P.white, s.hair, s.skin, P.white), s.x + 6, BOARD_BOTTOM - 2 + bob)
      }
    // pitch invaders (ambience only)
    for (const inv of invaders) {
      if (inv.delay > 0) continue
      const pose = Math.floor(clock * 8 + inv.phase) % 2 ? 'run1' : 'run2'
      ctx.drawImage(mini(pose, inv.shirt, inv.hair, inv.skin), Math.round(inv.x), Math.round(inv.y) - 18)
    }
    // referees
    const refsUp = g && g.events.has('refs')
    for (const r of refs) {
      const bob = refsUp && Math.sin(clock * 6 + r.x) > 0 ? -2 : 0
      ctx.drawImage(mini(refsUp ? 'siuuu' : 'idle', P.black, r.hair, r.skin, P.black), r.x, r.y - 18 + bob)
      if (r.flag && !refsUp) {
        ctx.fillStyle = P.ink
        ctx.fillRect(r.x + 13, r.y - 26, 1, 14)
        ctx.fillStyle = P.orange
        ctx.fillRect(r.x + 14, r.y - 26, 6, 5)
      }
    }

    // Ronaldo, with his shadow
    const r = g ? g.ronaldo : { x: RUN_END_X + LAND_DX, y: RUN_Y, pose: 'siuuu', flip: false, air: 0 }
    const sh = Math.max(0.3, 1 - r.air / 120)
    const half = 6 * SPRITE_SCALE
    ctx.fillStyle = P.grassDark
    ctx.fillRect(Math.round(r.x + 13 * SPRITE_SCALE - half * sh), r.y - 2, Math.round(2 * half * sh), 4)
    const sp = sprite(r.pose, r.flip)
    ctx.drawImage(sp, Math.round(r.x), Math.round(r.y - 25 * SPRITE_SCALE - r.air))

    // particles
    for (const p of particles) {
      if (p.ring) {
        ctx.strokeStyle = p.colour
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.fillStyle = p.colour
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
      }
    }
    ctx.restore()
    // lift-off thrusters, under the stadium
    if (liftoff > 0) {
      const base = GH + oy
      for (let i = 0; i < 5; i++) {
        const x = 60 + i * 130
        const h = 10 + Math.round(Math.abs(Math.sin(clock * 20 + i)) * 10)
        ctx.fillStyle = P.orange
        ctx.fillRect(x - 12, base, 24, h)
        ctx.fillStyle = P.yellow
        ctx.fillRect(x - 6, base, 12, h - 4)
      }
    }
  }

  function zonesFor(center, wp) {
    const half = 180
    const px = (e) => Math.round(e * half)
    return { center, half, perfect: px(wp), good: px(errorFor(CONFIG.GOOD_MIN, wp)), bad: px(errorFor(CONFIG.BAD_MIN, wp)) }
  }
  function drawBar(x0, y0, w, h, z) {
    const cx = x0 + Math.round(z.center * w)
    ctx.fillStyle = P.navy
    ctx.fillRect(x0 - 3, y0 - 3, w + 6, h + 6)
    ctx.fillStyle = P.red2
    ctx.fillRect(x0, y0, w, h)
    const band = (half, colour) => {
      ctx.fillStyle = colour
      const a = Math.max(x0, cx - half)
      const b = Math.min(x0 + w, cx + half)
      if (b > a) ctx.fillRect(a, y0, b - a, h)
    }
    band(z.bad, P.red)
    band(z.good, P.orange)
    band(z.perfect, P.green)
    ctx.fillStyle = P.lime
    ctx.fillRect(cx - 1, y0, 2, h)
  }
  function drawGauge() {
    const c = g.cycle
    const x0 = 140
    const y0 = 320
    const w = 360
    const h = 20
    const wp = diff().perfect
    const showJump = state === 'RUNUP' && c.t >= CONFIG.GAUGE_DELAY
    const showSpin = state === 'AIRBORNE'
    if (showJump) {
      const z = zonesFor(jumpTarget(), wp)
      drawBar(x0, y0, w, h, z)
      const cx = x0 + Math.round(jumpCursor() * w)
      ctx.fillStyle = P.navy
      ctx.fillRect(cx - 4, y0 - 7, 8, h + 14)
      ctx.fillStyle = P.white
      ctx.fillRect(cx - 2, y0 - 5, 4, h + 10)
      drawTextC(ctx, touch ? 'TAP POUR SAUTER !' : 'APPUIE POUR SAUTER !', GW / 2, y0 - 26, P.white, { scale: 2, outline: P.navy })
    } else if (showSpin) {
      const z = zonesFor(CONFIG.SPIN_TARGET, wp)
      drawBar(x0, y0, w, h, z)
      const fx = Math.round(c.spinP * w)
      ctx.fillStyle = P.cream
      ctx.fillRect(x0, y0 + 6, fx, h - 12)
      ctx.fillStyle = P.white
      ctx.fillRect(x0 + fx - 2, y0 - 5, 4, h + 10)
      ctx.fillStyle = P.navy
      ctx.fillRect(x0 + fx - 3, y0 - 7, 6, 2)
      ctx.fillRect(x0 + fx - 3, y0 + h + 5, 6, 2)
      const inZone = Math.abs(c.spinP - CONFIG.SPIN_TARGET) / 0.5 <= wp
      drawTextC(ctx, inZone ? 'RELÂCHE !' : 'MAINTIENS… RELÂCHE DANS LE VERT', GW / 2, y0 - 26, inZone ? P.lime : P.white, { scale: 2, outline: P.navy })
    } else if (state === 'RESULT' || state === 'LANDING') {
      // the two hits, as a recap
      const zj = zonesFor(0.5, wp)
      drawBar(x0, y0, w, h, zj)
      const mark = (e, colour, dy) => {
        const px = x0 + Math.round((0.5 + e * 0.5) * w)
        ctx.fillStyle = P.navy
        ctx.fillRect(px - 3, y0 + dy - 1, 6, h / 2 + 2)
        ctx.fillStyle = colour
        ctx.fillRect(px - 2, y0 + dy, 4, h / 2)
      }
      if (c.jumpErr != null) mark(c.jumpHit ?? c.jumpErr, P.white, 0)
      if (c.spinErr != null) mark(c.spinHit ?? c.spinErr, P.cream, h / 2)
      drawText(ctx, 'SAUT', x0 - 56, y0 - 2, P.white, { outline: P.navy })
      drawText(ctx, 'ROTATION', x0 - 56, y0 + 9, P.cream, { outline: P.navy })
    }
  }

  function drawHUD() {
    // timer (top-left)
    const left = Math.max(0, CONFIG.RUN_DURATION - g.elapsed)
    const secs = Math.ceil(left)
    const urgent = left <= 10 && left > 0
    drawText(ctx, 'TEMPS', 12, 8, P.cream, { outline: P.navy })
    drawText(ctx, String(secs), 12, 18, urgent && Math.floor(clock * 4) % 2 ? P.red : P.white, { scale: 4, outline: P.navy })
    // score / record (top-right)
    drawTextR(ctx, 'SCORE', GW - 12, 8, P.cream, { outline: P.navy })
    drawTextR(ctx, fmt(g.score), GW - 12, 18, P.white, { scale: 3, outline: P.navy })
    drawTextR(ctx, 'RECORD ' + fmt(Math.max(best, g.score)), GW - 12, 50, P.yellow, { outline: P.navy })
    // combo (bottom-left)
    const m = multiplier()
    drawText(ctx, 'COMBO', 12, 318, P.cream, { outline: P.navy })
    drawText(ctx, '×' + m, 12, 328, m >= CONFIG.MAX_MULT ? P.lime : m > 1 ? P.yellow : P.white, { scale: 3, outline: P.navy })
    // fever (bottom-right)
    const fx = 520
    const fy = 322
    drawText(ctx, 'SIUUU FEVER', fx, fy - 12, inFever() ? P.yellow : P.cream, { outline: P.navy })
    ctx.fillStyle = P.navy
    ctx.fillRect(fx - 2, fy, 92, 12)
    ctx.fillStyle = P.grey3
    ctx.fillRect(fx, fy + 2, 88, 8)
    if (inFever()) {
      const k = g.feverTime / CONFIG.FEVER_DURATION
      ctx.fillStyle = Math.floor(clock * 8) % 2 ? P.yellow : P.orange
      ctx.fillRect(fx, fy + 2, Math.round(88 * k), 8)
    } else {
      ctx.fillStyle = P.lime
      ctx.fillRect(fx, fy + 2, Math.round(88 * g.fever), 8)
    }
    drawText(ctx, inFever() ? '×2 !' : Math.round(g.fever * 100) + '%', fx + 92 + 6, fy + 1, P.white, { outline: P.navy })

    drawGauge()
    // fever frame
    if (inFever()) {
      const t = Math.floor(clock * 10) % 2
      ctx.fillStyle = t ? P.yellow : P.orange
      ctx.fillRect(0, 0, GW, 4)
      ctx.fillRect(0, GH - 4, GW, 4)
      ctx.fillRect(0, 0, 4, GH)
      ctx.fillRect(GW - 4, 0, 4, GH)
    }
    if (g.elapsed >= CONFIG.CHAOS_AT && !g.ending) drawTextC(ctx, 'CHAOS', GW / 2, 8, [P.red, P.yellow, P.lime][Math.floor(clock * 6) % 3], { scale: 2, outline: P.ink })
  }

  function drawPopups() {
    for (const p of popups) {
      const k = p.life
      const grow = p.scale + (k > 0.9 ? 1 : 0)
      ctx.globalAlpha = k < 0.25 ? k / 0.25 : 1
      const x = clamp(p.x, textWidth(p.text, grow) / 2 + 4, GW - textWidth(p.text, grow) / 2 - 4)
      drawTextC(ctx, p.text, x, clamp(p.y, 50, 290), p.colour, { scale: grow, outline: p.outline })
      ctx.globalAlpha = 1
    }
    if (banner) {
      const y = 74 + (banner.life > 2.7 ? Math.round((banner.life - 2.7) * 120) : 0)
      ctx.fillStyle = P.ink
      ctx.fillRect(0, y - 6, GW, 34)
      ctx.fillStyle = P.lime
      ctx.fillRect(0, y - 6, GW, 2)
      ctx.fillRect(0, y + 26, GW, 2)
      const wob = Math.round(Math.sin(clock * 20) * 2)
      drawTextC(ctx, banner.text, GW / 2 + wob, y, P.yellow, { scale: 2, shadow: P.red2 })
    }
    if (comment) {
      ctx.globalAlpha = comment.life < 0.4 ? comment.life / 0.4 : 1
      drawTextC(ctx, comment.text, GW / 2, 52, P.white, { outline: P.ink })
      ctx.globalAlpha = 1
    }
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = P.ink
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
    ctx.fillStyle = P.navy
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = P.navy2
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
  }
  function drawTitle() {
    const blink = Math.floor(clock * 2) % 2 === 0
    drawPanel(70, 28, 500, 304)
    const bounce = Math.round(Math.sin(clock * 4) * 3)
    drawTextC(ctx, 'SIUUUU', GW / 2, 40 + bounce, P.lime, { scale: 7, outline: P.ink, shadow: P.red2 })
    drawTextC(ctx, 'SIMULATOR', GW / 2, 112, P.white, { scale: 4, outline: P.ink })
    drawTextC(ctx, '90 SECONDES. ZÉRO BUT. UN MAXIMUM DE SIUUUU.', GW / 2, 160, P.cream, { scale: 2 })
    drawTextC(ctx, touch ? 'TAP POUR JOUER' : 'ESPACE POUR JOUER', GW / 2, 196, blink ? P.yellow : P.orange, { scale: 3, outline: P.ink })
    drawTextC(ctx, touch ? 'TAP POUR SAUTER • RELÂCHE POUR TERMINER TA ROTATION' : 'APPUIE POUR SAUTER • RELÂCHE POUR TERMINER TA ROTATION', GW / 2, 236, P.white, { scale: 1 })
    drawTextC(ctx, 'VISE LE VERT, DEUX FOIS DE SUITE.', GW / 2, 250, P.grey, { scale: 1 })
    drawTextC(ctx, best ? 'RECORD : ' + fmt(best) : 'RECORD : TOUJOURS LIBRE', GW / 2, 276, P.yellow, { scale: 2, outline: P.ink })
    drawTextC(ctx, (touch ? 'BOUTON SON EN BAS À DROITE' : 'M : SON  •  P : PAUSE') + '  •  DUMB GAMES', GW / 2, 306, P.grey, { scale: 1 })
  }
  function drawGameOver() {
    const r = g.result
    const blink = Math.floor(clock * 2) % 2 === 0
    drawPanel(60, 20, 520, 320)
    drawTextC(ctx, 'FULL TIME — SIUUUUUU !', GW / 2, 30, P.lime, { scale: 3, outline: P.ink })
    drawTextC(ctx, fmt(r.score), GW / 2, 64, P.white, { scale: 6, outline: P.ink, shadow: P.red2 })
    if (r.score > 0 && r.score >= r.best) drawTextC(ctx, 'NOUVEAU RECORD !', GW / 2, 128, blink ? P.yellow : P.orange, { scale: 2, outline: P.ink })
    else drawTextC(ctx, 'RECORD : ' + fmt(r.best), GW / 2, 128, P.yellow, { scale: 2 })
    const lines = [
      ['SIUUU RÉUSSIS', r.siuuus],
      ['PERFECT', r.perfects],
      ['COMBO MAX', '×' + Math.min(CONFIG.MAX_MULT, 1 + r.maxCombo)],
      ['FEVER', r.fevers],
      ['GAMELLES', r.fails],
    ]
    lines.forEach(([k, v], i) => {
      const y = 158 + i * 22
      drawText(ctx, k, 150, y, P.cream, { scale: 2 })
      drawTextR(ctx, String(v), 490, y, P.white, { scale: 2 })
    })
    drawTextC(ctx, 'RANG : ' + r.rank, GW / 2, 272, P.yellow, { scale: 2, outline: P.ink })
    drawTextC(ctx, touch ? 'TAP — REJOUER' : 'ESPACE — REJOUER', GW / 2, 304, blink ? P.lime : P.green, { scale: 3, outline: P.ink })
  }
  function drawMute() {
    const x = 608
    const y = 338
    ctx.fillStyle = P.ink
    ctx.fillRect(x, y, 26, 18)
    ctx.fillStyle = P.white
    ctx.fillRect(x + 4, y + 6, 4, 6)
    ctx.fillRect(x + 8, y + 4, 2, 10)
    ctx.fillRect(x + 10, y + 2, 2, 14)
    if (audio.muted) {
      ctx.fillStyle = P.red
      ctx.fillRect(x + 15, y + 5, 2, 8)
      ctx.fillRect(x + 19, y + 5, 2, 8)
      ctx.fillRect(x + 17, y + 8, 2, 2)
    } else {
      ctx.fillStyle = P.lime
      ctx.fillRect(x + 15, y + 7, 2, 4)
      ctx.fillRect(x + 18, y + 5, 2, 8)
      ctx.fillRect(x + 21, y + 3, 2, 12)
    }
  }

  function draw() {
    drawScene()
    if (state === 'TITLE') drawTitle()
    else if (state === 'GAME_OVER') {
      drawGameOver()
    } else {
      drawHUD()
      drawPopups()
      if (paused) {
        ctx.fillStyle = 'rgba(22,20,35,0.7)'
        ctx.fillRect(0, 0, GW, GH)
        drawTextC(ctx, 'PAUSE', GW / 2, 140, P.white, { scale: 5, outline: P.ink })
        drawTextC(ctx, 'P OU ÉCHAP POUR REPRENDRE', GW / 2, 200, P.cream, { scale: 2 })
      }
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.7, flash * 4)
      ctx.fillStyle = flashColour
      ctx.fillRect(0, 0, GW, GH)
      ctx.globalAlpha = 1
    }
    drawMute()
    if (debug && g) {
      const c = g.cycle
      const lines = [`STATE ${state} T ${g.elapsed.toFixed(1)} SEED ${seed}`, `DIFF ${JSON.stringify(diff()).replace(/"/g, '').slice(0, 70)}`, `JUMP ${c.jumpErr?.toFixed(2) ?? '-'} SPIN ${c.spinErr?.toFixed(2) ?? '-'} RESULT ${c.result ?? '-'}`, `FANS ${fans.length} PARTICLES ${particles.length} EVENTS ${[...g.events].join(',')}`]
      lines.forEach((l, i) => drawText(ctx, l, 8, 70 + i * 10, P.white, { outline: P.ink }))
    }
  }

  /* ----- loop & public API ----- */
  function frame(now) {
    if (!running) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    update(dt)
    // last-ten-seconds ticks
    if (g && !g.ending && state !== 'GAME_OVER' && !paused) {
      const left = CONFIG.RUN_DURATION - g.elapsed
      const s = Math.ceil(left)
      if (left <= 10 && s !== g.lastTick) {
        g.lastTick = s
        audio.tick(s <= 3)
      }
    }
    draw()
    raf = requestAnimationFrame(frame)
  }
  function start() {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function stop() {
    running = false
    cancelAnimationFrame(raf)
    audio.stopMusic()
  }
  function unlock() {
    audio.init()
    audio.resume()
  }
  function toggleMute() {
    audio.setMuted(!audio.muted)
    save('muted', audio.muted)
  }
  function togglePause() {
    if (state === 'TITLE' || state === 'GAME_OVER') return
    paused = !paused
    if (paused) {
      audio.spinStop()
      audio.stopMusic()
      held = false
    } else audio.startMusic()
  }
  function input(action, payload = {}) {
    if (action === 'press') {
      if (paused && payload.down) {
        togglePause()
        return
      }
      press(!!payload.down)
    } else if (action === 'pointer') {
      if (payload.touch) touch = true
      if (payload.type === 'down') {
        if (payload.x >= 600 && payload.y >= 332) {
          toggleMute()
          return
        }
        if (paused) {
          togglePause()
          return
        }
        press(true)
      } else press(false)
    } else if (action === 'mute') toggleMute()
    else if (action === 'pause') togglePause()
    else if (action === 'blur') {
      press(false)
      if (state !== 'TITLE' && state !== 'GAME_OVER' && !paused) togglePause()
    }
  }

  draw()
  return { start, stop, input, unlock, get state() { return state }, get snapshot() { return g } }
}

/* ---------- module contract helpers ---------- */
export function validate(result) {
  if (!result || typeof result !== 'object') return false
  const ints = ['score', 'siuuus', 'perfects', 'maxCombo', 'cycles']
  if (!ints.every((k) => Number.isInteger(result[k]) && result[k] >= 0)) return false
  if (result.perfects > result.siuuus || result.siuuus > result.cycles) return false
  // the upper bound: every cycle a Fever-doubled, ×10 PERFECT, cycles capped by the shortest possible cycle
  const minCycle = CONFIG.GAUGE_DELAY + CONFIG.LAND_TIME + CONFIG.RESULT_TIME.PERFECT
  if (result.cycles > Math.ceil(CONFIG.RUN_DURATION / minCycle) + 1) return false
  if (result.score > result.cycles * CONFIG.BASE_POINTS.PERFECT * CONFIG.MAX_MULT * CONFIG.FEVER_BONUS) return false
  return true
}
export function grade(result) {
  const s = result.score
  if (s < 3000) return 'STAGIAIRE DU SIUUU'
  if (s < 12000) return 'REMPLAÇANT MOTIVÉ'
  if (s < 35000) return 'TITULAIRE INDISCUTABLE'
  if (s < 80000) return 'BALLON D’OR DU GESTE'
  if (s < 150000) return 'LÉGENDE DU POTEAU DE CORNER'
  return 'DIVINITÉ DU SIUUU'
}
