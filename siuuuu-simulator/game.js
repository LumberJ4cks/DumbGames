import { createAudio } from './audio.js'
import { makeFan, mini, prop, loadArt, drawRonaldo, drawFan } from './sprites.js'
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
const STAND_BOTTOM = 138
const WALL_BOTTOM = 156
const BOARD_BOTTOM = 182
const PITCH_TOP = 190
const TOUCHLINE = 198
const GOAL_LINE = 578
const NET_X = 606
const RUN_START_X = -110
const RUN_END_X = 400
const RUN_Y = 318 // feet line of the run
const LAND_DX = 44
const RS = 3 // Ronaldo scale
const RON_CX = 17 * RS // centre of the sprite canvas
const RON_FEET = 41 * RS // feet row inside the sprite canvas
const AISLES = [[192, 212], [428, 448]]

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
  const artRng = mulberry32(seed * 7 + 3)

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
  if (settings.art !== false) loadArt().catch(() => {})

  /* ----- persistent scene: the crowd, the bench, the officials, the props ----- */
  const fans = []
  for (let row = 0; row < 8; row++) {
    const y = row * 16 - 10
    for (let x = -6 + (row % 2) * 7; x < GW - 10; x += 13) {
      const jx = x + Math.floor(artRng() * 5) - 2
      if (AISLES.some(([a, b]) => jx + 24 > a && jx + 8 < b)) continue
      fans.push({ x: jx, y, desc: makeFan(artRng), variant: Math.floor(artRng() * 1000), phase: artRng() * Math.PI * 2, rate: 5 + artRng() * 3, up: false })
    }
  }
  const subs = Array.from({ length: 6 }, (_, i) => ({
    x: 22 + i * 17,
    hair: ['#2B1B14', '#111111', '#8A5A2B', '#D8B25C', '#C8502E', '#2B1B14'][i],
    skin: ['#EBB98B', '#C68A5A', '#F2CBA4', '#8C5A3C', '#EBB98B', '#5C3A26'][i],
    phase: artRng() * 6,
  }))
  const refs = [
    { x: 520, y: 300, hair: '#111111', skin: '#F2CBA4', flag: false },
    { x: 588, y: 250, hair: '#8A5A2B', skin: '#C68A5A', flag: true },
  ]
  const stewards = [
    { x: 194, y: PITCH_TOP },
    { x: 430, y: PITCH_TOP },
  ]
  const flashes = []
  const BOARDS = [
    { bg: '#161423', fg: P.lime, text: 'DUMB GAMES', icon: 'joystick' },
    { bg: '#D32F2F', fg: '#FFFFFF', text: 'SIUUU COLA', icon: 'bottle' },
    { bg: '#1E2A4A', fg: '#F1E7C9', text: 'BANQUE DU COIN', icon: 'coin' },
    { bg: '#FFD84A', fg: '#161423', text: 'PIZZA N°7', icon: 'pizza' },
    { bg: '#2F7D4F', fg: '#FFFFFF', text: 'GAZON PRO', icon: 'mower' },
    { bg: '#F4F4F2', fg: '#D32F2F', text: 'TAXI SIUUU', icon: 'taxi' },
  ].map((b) => ({ ...b, w: textWidth(b.text, 2) + 50 }))
  const ICONS = {
    joystick: { rows: ['...rr...', '..rrrr..', '..rrrr..', '...kk...', '...kk...', '.kkkkkk.', 'kkkkkkkk', 'kkkkkkkk'], inks: { r: '#E23B3B', k: '#9A9EAA' } },
    bottle: { rows: ['...ww...', '...ww...', '..wwww..', '..wwww..', '..wwww..', '..wkkw..', '..wkkw..', '..wwww..'], inks: { w: '#FFFFFF', k: '#D32F2F' } },
    coin: { rows: ['..yyyy..', '.yyyyyy.', 'yyyooyyy', 'yyyoyyyy', 'yyyooyyy', 'yyyyoyyy', '.yyooyy.', '..yyyy..'], inks: { y: '#FFD84A', o: '#B8860B' } },
    pizza: { rows: ['kkkkkkkk', '.yyryyy.', '.yyyyry.', '..yryy..', '..yyyy..', '...yr...', '...yy...', '....y...'], inks: { k: '#8E5A3C', y: '#FFE9A8', r: '#D32F2F' } },
    mower: { rows: ['......kk', '.....kk.', '....kk..', 'rrrrrr..', 'rrrrrr..', 'rrrrrr..', 'kk.kk.k.', 'kk.kk.k.'], inks: { k: '#161423', r: '#E23B3B' } },
    taxi: { rows: ['........', '..yyyy..', '.yykkyy.', 'yyyyyyyy', 'yyyyyyyy', 'kyyyyyyk', '.kk..kk.', '........'], inks: { y: '#FFD84A', k: '#161423' } },
  }
  function drawIcon(c, name, x, y, scale = 2) {
    const ic = ICONS[name]
    ic.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        if (ch === '.') continue
        c.fillStyle = ic.inks[ch]
        c.fillRect(x + i * scale, y + j * scale, scale, scale)
      }
    })
  }

  /* ----- prerendered layers ----- */
  const layer = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    x.imageSmoothingEnabled = false
    return [c, x]
  }
  const [standsLayer, sl] = layer(GW, STAND_BOTTOM)
  {
    for (let row = 0; row < 10; row++) {
      const y = row * 16 - 12
      sl.fillStyle = row % 2 ? '#C2C5CD' : '#B4B7C0'
      sl.fillRect(0, y, GW, 16)
      sl.fillStyle = '#8C909B'
      sl.fillRect(0, y + 12, GW, 3)
      sl.fillStyle = '#6A6E79'
      sl.fillRect(0, y + 15, GW, 1)
      sl.fillStyle = '#D8DAE0'
      sl.fillRect(0, y, GW, 1)
      for (let i = 0; i < 40; i++) {
        sl.fillStyle = artRng() < 0.5 ? '#A5A8B2' : '#CFD1D8'
        sl.fillRect(Math.floor(artRng() * GW), y + 1 + Math.floor(artRng() * 10), 1 + Math.floor(artRng() * 3), 1)
      }
    }
    const roof = sl.createLinearGradient(0, 0, 0, 100)
    roof.addColorStop(0, 'rgba(10,10,30,0.45)')
    roof.addColorStop(1, 'rgba(10,10,30,0)')
    sl.fillStyle = roof
    sl.fillRect(0, 0, GW, 100)
    for (const [a, b] of AISLES) {
      sl.fillStyle = '#DADCE2'
      sl.fillRect(a, 0, b - a, STAND_BOTTOM)
      for (let y = 2; y < STAND_BOTTOM; y += 8) {
        sl.fillStyle = '#A5A8B2'
        sl.fillRect(a, y, b - a, 2)
        sl.fillStyle = '#F2F3F6'
        sl.fillRect(a, y + 2, b - a, 1)
      }
      sl.fillStyle = '#FFD84A'
      sl.fillRect(a + (b - a) / 2 - 1, 0, 2, STAND_BOTTOM)
      sl.fillStyle = '#B8860B'
      sl.fillRect(a + (b - a) / 2 + 1, 0, 1, STAND_BOTTOM)
    }
  }
  const [frontLayer, fl] = layer(GW, GH - STAND_BOTTOM)
  {
    const Y = (y) => y - STAND_BOTTOM
    // wall and railing
    fl.fillStyle = '#E4E6EA'
    fl.fillRect(0, Y(STAND_BOTTOM), GW, WALL_BOTTOM - STAND_BOTTOM)
    fl.fillStyle = '#1E2A4A'
    fl.fillRect(0, Y(STAND_BOTTOM), GW, 3)
    fl.fillStyle = '#5A6A8E'
    fl.fillRect(0, Y(STAND_BOTTOM) + 3, GW, 1)
    fl.fillStyle = '#C8CBD3'
    fl.fillRect(0, Y(WALL_BOTTOM) - 3, GW, 3)
    for (let i = 0; i < 60; i++) {
      fl.fillStyle = artRng() < 0.5 ? '#D4D6DC' : '#F2F3F6'
      fl.fillRect(Math.floor(artRng() * GW), Y(STAND_BOTTOM) + 5 + Math.floor(artRng() * 9), 1 + Math.floor(artRng() * 4), 1)
    }
    fl.fillStyle = '#9A9EAA'
    for (let x = 0; x < GW; x += 64) fl.fillRect(x, Y(STAND_BOTTOM) + 4, 1, WALL_BOTTOM - STAND_BOTTOM - 7)
    // dugout
    fl.fillStyle = '#161423'
    fl.fillRect(8, Y(STAND_BOTTOM) + 2, 126, BOARD_BOTTOM - STAND_BOTTOM - 2)
    fl.fillStyle = '#1E2A4A'
    fl.fillRect(11, Y(STAND_BOTTOM) + 5, 120, BOARD_BOTTOM - STAND_BOTTOM - 9)
    fl.fillStyle = '#3A4D7A'
    fl.fillRect(11, Y(STAND_BOTTOM) + 5, 120, 2)
    fl.fillStyle = '#27365E'
    for (let x = 14; x < 130; x += 6) fl.fillRect(x, Y(STAND_BOTTOM) + 8, 3, 14)
    fl.fillStyle = '#8E93A3'
    fl.fillRect(16, Y(BOARD_BOTTOM) - 12, 110, 3)
    fl.fillRect(18, Y(BOARD_BOTTOM) - 9, 2, 6)
    fl.fillRect(122, Y(BOARD_BOTTOM) - 9, 2, 6)
    drawText(fl, 'BANC', 14, Y(STAND_BOTTOM) + 8, '#F1E7C9')
    // boards
    let bx = 136
    let bi = 0
    while (bx < GW) {
      const b = BOARDS[bi % BOARDS.length]
      fl.fillStyle = b.bg
      fl.fillRect(bx, Y(WALL_BOTTOM), b.w, BOARD_BOTTOM - WALL_BOTTOM)
      fl.fillStyle = 'rgba(0,0,0,0.25)'
      fl.fillRect(bx, Y(BOARD_BOTTOM) - 3, b.w, 3)
      fl.fillStyle = 'rgba(255,255,255,0.18)'
      fl.fillRect(bx, Y(WALL_BOTTOM), b.w, 2)
      fl.fillStyle = '#161423'
      fl.fillRect(bx + b.w - 2, Y(WALL_BOTTOM), 2, BOARD_BOTTOM - WALL_BOTTOM)
      drawIcon(fl, b.icon, bx + 8, Y(WALL_BOTTOM) + 5)
      drawText(fl, b.text, bx + 30, Y(WALL_BOTTOM) + 4, b.fg, { scale: 1, smooth: true })
      bx += b.w
      bi++
    }
    // track
    fl.fillStyle = '#8E5A3C'
    fl.fillRect(0, Y(BOARD_BOTTOM), GW, PITCH_TOP - BOARD_BOTTOM)
    fl.fillStyle = '#A86E4A'
    fl.fillRect(0, Y(BOARD_BOTTOM), GW, 1)
    fl.fillStyle = '#6E432B'
    fl.fillRect(0, Y(PITCH_TOP) - 1, GW, 1)
    // pitch: stripes, checker, blades
    for (let y = PITCH_TOP; y < GH + 20; y += 20) {
      const band = ((y - PITCH_TOP) / 20) % 2
      for (let x = 0; x < GW; x += 40) {
        const chk = (x / 40) % 2
        const k = band ^ chk
        fl.fillStyle = k ? '#3A9336' : '#4AAE45'
        fl.fillRect(x, Y(y), 40, 20)
      }
    }
    for (let i = 0; i < 1400; i++) {
      const x = Math.floor(artRng() * GW)
      const y = PITCH_TOP + Math.floor(artRng() * (GH - PITCH_TOP))
      fl.fillStyle = artRng() < 0.5 ? '#358A33' : '#55B84E'
      fl.fillRect(x, Y(y), 1, 1 + Math.floor(artRng() * 2))
    }
    // lines, arc
    fl.fillStyle = '#F3F7EE'
    fl.fillRect(0, Y(TOUCHLINE) - 1, GOAL_LINE + 2, 3)
    fl.fillRect(GOAL_LINE - 1, Y(TOUCHLINE) - 1, 3, GH)
    for (let a = 0; a <= 24; a++) {
      const t = (a / 24) * Math.PI * 0.5
      fl.fillRect(Math.round(GOAL_LINE - Math.cos(t) * 24) - 1, Math.round(Y(TOUCHLINE) + Math.sin(t) * 24) - 1, 3, 3)
    }
    // beyond the goal line: grass, then the side netting in perspective
    fl.fillStyle = '#161423'
    fl.fillRect(NET_X, Y(PITCH_TOP), GW - NET_X, GH - PITCH_TOP)
    fl.fillStyle = '#8E93A3'
    for (let y = PITCH_TOP; y < GH; y += 7) fl.fillRect(NET_X, Y(y), GW - NET_X, 1)
    for (let x = NET_X; x < GW; x += 7) fl.fillRect(x, Y(PITCH_TOP), 1, GH - PITCH_TOP)
    fl.fillStyle = '#C8CBD3'
    for (let i = 0; i < 24; i++) fl.fillRect(NET_X + i, Y(PITCH_TOP) + i * 7, 1, 1)
    fl.fillStyle = '#FFFFFF'
    fl.fillRect(NET_X - 4, Y(PITCH_TOP) - 6, 4, GH - PITCH_TOP + 6)
    fl.fillStyle = '#C8CBD3'
    fl.fillRect(NET_X - 1, Y(PITCH_TOP) - 6, 1, GH - PITCH_TOP + 6)
  }
  const [scanLayer, sc] = layer(GW, GH)
  {
    sc.fillStyle = 'rgba(0,0,0,0.16)'
    for (let y = 0; y < GH; y += 2) sc.fillRect(0, y, GW, 1)
    const g1 = sc.createLinearGradient(0, 0, 0, GH)
    g1.addColorStop(0, 'rgba(0,0,0,0.28)')
    g1.addColorStop(0.25, 'rgba(0,0,0,0)')
    g1.addColorStop(0.8, 'rgba(0,0,0,0)')
    g1.addColorStop(1, 'rgba(0,0,0,0.3)')
    sc.fillStyle = g1
    sc.fillRect(0, 0, GW, GH)
    const g2 = sc.createLinearGradient(0, 0, GW, 0)
    g2.addColorStop(0, 'rgba(0,0,0,0.22)')
    g2.addColorStop(0.15, 'rgba(0,0,0,0)')
    g2.addColorStop(0.85, 'rgba(0,0,0,0)')
    g2.addColorStop(1, 'rgba(0,0,0,0.22)')
    sc.fillStyle = g2
    sc.fillRect(0, 0, GW, GH)
  }

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
    burst(g.ronaldo.x + RON_CX, RUN_Y, 10, [P.cream, P.grass2], 60, 1)
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
    const cx = r.x + RON_CX
    const cy = r.y - 156
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
      popups.push({ text: 'COMBO ×' + Math.min(CONFIG.MAX_MULT, 1 + g.combo), x: cx - 110, y: r.y - 50, life: 0.8, scale: 2, colour: P.cream, outline: P.navy })
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
    audio.setTempo(1.12)
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
        const d = f.desc
        invaders.push({ x: 40 + rng() * 520, y: PITCH_TOP - 2, tx: 0, ty: 0, t: rng() * 2, shirt: d.shirt || P.yellow, hair: d.hair || P.hair, skin: d.skin || P.skin, phase: rng() * 6, delay: i * 0.12 })
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
    tickFlashes(dt)
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
  function tickFlashes(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].ttl -= dt) <= 0) flashes.splice(i, 1)
    const combo = g ? g.combo : 0
    const rate = 1.5 + combo * 1.2 + (g && inFever() ? 14 : 0) + (g && g.events.has('crowd') ? 3 : 0) + (state === 'RESULT' && g.cycle.result === 'PERFECT' ? 30 : 0)
    if (rng() < rate * dt) {
      const f = fans[Math.floor(rng() * fans.length)]
      flashes.push({ x: f.x + 17, y: f.y + 10, ttl: 0.07 + rng() * 0.06 })
    }
  }

  function drawScene() {
    const { ox, oy } = sceneOffset()
    const chaos = g && diff().chaos
    const fever = g && inFever()
    // sky behind everything, visible once the stadium lifts off
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
    ctx.drawImage(standsLayer, 0, 0)

    // the crowd, back rows first
    const excited = g && (g.events.has('crowd') || fever)
    for (const f of fans) {
      const s = Math.sin(clock * f.rate + f.phase)
      const jumping = excited || f.up || f.desc.excited
      let dy = jumping ? (s > 0 ? -4 : 0) : s > 0.6 ? -1 : 0
      let dx = 0
      if (excited) dy += Math.round(Math.sin(clock * 6 - f.x * 0.02) * 2)
      if (shockwave > 0) {
        const front = shockwave * (GW + 260) - 120
        const d = Math.abs(f.x - front)
        if (d < 110) dy -= Math.round(16 * Math.cos((d / 110) * Math.PI * 0.5))
      }
      if (chaos) dx = Math.round(Math.sin(clock * 9 + f.phase))
      const pose = jumping && s > 0 ? 'up' : 'idle'
      drawFan(ctx, f, pose, f.x + dx, f.y + dy)
    }
    const roofShade = ctx.createLinearGradient(0, oy, 0, oy + 70)
    roofShade.addColorStop(0, 'rgba(10,10,30,0.4)')
    roofShade.addColorStop(1, 'rgba(10,10,30,0)')
    ctx.fillStyle = roofShade
    ctx.fillRect(0, 0, GW, 70)
    for (const fl of flashes) {
      ctx.fillStyle = P.white
      ctx.fillRect(fl.x - 1, fl.y - 3, 3, 7)
      ctx.fillRect(fl.x - 3, fl.y - 1, 7, 3)
      ctx.fillStyle = P.sky2
      ctx.fillRect(fl.x, fl.y, 1, 1)
    }
    ctx.drawImage(frontLayer, 0, STAND_BOTTOM)

    // bench, stewards, cameraman (the track)
    const subsUp = g && g.events.has('subs')
    if (!subsUp) for (const s of subs) ctx.drawImage(mini('sit', P.white, s.hair, s.skin, P.white), s.x, BOARD_BOTTOM - 26)
    for (const st of stewards) ctx.drawImage(mini('back', '#FFD84A', '#2B1B14', '#C68A5A', '#2A2D3A'), st.x, st.y - 18)
    ctx.drawImage(prop('camera'), 552, PITCH_TOP - 28)

    // pitch mood: fever and chaos tints over the grass only
    if (fever || chaos) {
      ctx.globalAlpha = 0.22
      ctx.fillStyle = chaos ? ['#3B8FB0', '#A03BB0', '#B0803B', '#B03B3B'][Math.floor(clock * 2) % 4] : P.lime
      ctx.fillRect(0, PITCH_TOP, NET_X - 4, GH - PITCH_TOP)
      ctx.globalAlpha = 1
    }
    // corner flag
    const sway = Math.round(Math.sin(clock * 3) * 1.5)
    ctx.fillStyle = P.ink
    ctx.fillRect(GOAL_LINE - 1, TOUCHLINE - 30, 2, 30)
    ctx.fillStyle = P.yellow
    ctx.fillRect(GOAL_LINE + 1, TOUCHLINE - 30 + sway, 12, 4)
    ctx.fillStyle = P.red
    ctx.fillRect(GOAL_LINE + 1, TOUCHLINE - 26 + sway, 12, 4)
    ctx.fillStyle = P.yellow
    ctx.fillRect(GOAL_LINE + 1, TOUCHLINE - 22 + sway, 8, 3)
    ctx.drawImage(prop('ball'), 548, 216)
    ctx.drawImage(prop('cart'), 584, 206)

    if (subsUp)
      for (const s of subs) {
        const bob = Math.sin(clock * 6 + s.phase) > 0 ? -2 : 0
        ctx.drawImage(mini('siuuu', P.white, s.hair, s.skin, P.white), s.x + 6, PITCH_TOP - 4 + bob)
      }
    for (const inv of invaders) {
      if (inv.delay > 0) continue
      const pose = Math.floor(clock * 8 + inv.phase) % 2 ? 'run1' : 'run2'
      ctx.drawImage(mini(pose, inv.shirt, inv.hair, inv.skin), Math.round(inv.x), Math.round(inv.y) - 18)
    }
    const refsUp = g && g.events.has('refs')
    for (const r of refs) {
      const bob = refsUp && Math.sin(clock * 6 + r.x) > 0 ? -2 : 0
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(r.x + 2, r.y - 2, 12, 3)
      ctx.drawImage(mini(refsUp ? 'siuuu' : 'idle', P.black, r.hair, r.skin, P.black), r.x, r.y - 18 + bob)
      if (r.flag && !refsUp) {
        ctx.fillStyle = P.ink
        ctx.fillRect(r.x + 14, r.y - 26, 1, 14)
        ctx.fillStyle = P.orange
        ctx.fillRect(r.x + 15, r.y - 26, 6, 5)
      }
    }

    // Ronaldo, with a soft shadow that shrinks as he rises
    const r = g ? g.ronaldo : { x: RUN_END_X + LAND_DX, y: RUN_Y, pose: 'siuuu', flip: false, air: 0 }
    const sh = Math.max(0.3, 1 - r.air / 120)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    const sw = Math.round(44 * sh)
    ctx.fillRect(Math.round(r.x + RON_CX - sw / 2), r.y - 3, sw, 5)
    ctx.fillRect(Math.round(r.x + RON_CX - sw / 2) + 4, r.y - 4, sw - 8, 7)
    drawRonaldo(ctx, r.pose, r.x + RON_CX, r.y - r.air, r.flip)

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

  /* ----- gauges ----- */
  const BAR_X = 150
  const BAR_Y = 334
  const BAR_W = 340
  const BAR_H = 14
  function zonesFor(center, wp) {
    const half = BAR_W / 2
    const px = (e) => Math.round(e * half)
    return { center, perfect: px(wp), good: px(errorFor(CONFIG.GOOD_MIN, wp)), bad: px(errorFor(CONFIG.BAD_MIN, wp)) }
  }
  function drawBar(z, hot) {
    const x0 = BAR_X
    const y0 = BAR_Y
    const w = BAR_W
    const h = BAR_H
    const cx = x0 + Math.round(z.center * w)
    ctx.fillStyle = P.ink
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8)
    ctx.fillStyle = hot ? P.lime : P.navy2
    ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4)
    ctx.fillStyle = '#6B1520'
    ctx.fillRect(x0, y0, w, h)
    const band = (half, colour, top) => {
      ctx.fillStyle = colour
      const a = Math.max(x0, cx - half)
      const b = Math.min(x0 + w, cx + half)
      if (b > a) ctx.fillRect(a, y0, b - a, h)
      ctx.fillStyle = top
      if (b > a) ctx.fillRect(a, y0, b - a, 2)
    }
    band(z.bad, '#D83A3A', '#F06A6A')
    band(z.good, '#F39A2E', '#FFC16A')
    band(z.perfect, '#3FBF5A', '#8CE89A')
    ctx.fillStyle = P.lime
    ctx.fillRect(cx - 1, y0 - 2, 2, h + 4)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(x0, y0 + h - 2, w, 2)
  }
  function cursor(px, colour) {
    ctx.fillStyle = P.ink
    ctx.fillRect(px - 4, BAR_Y - 8, 8, BAR_H + 16)
    ctx.fillStyle = colour
    ctx.fillRect(px - 2, BAR_Y - 6, 4, BAR_H + 12)
    ctx.fillStyle = P.white
    ctx.fillRect(px - 1, BAR_Y - 6, 1, BAR_H + 12)
  }
  function drawGauge() {
    const c = g.cycle
    const wp = diff().perfect
    const labelY = BAR_Y - 24
    if (state === 'RUNUP' && c.t >= CONFIG.GAUGE_DELAY) {
      const z = zonesFor(jumpTarget(), wp)
      const p = jumpCursor()
      const hot = Math.abs(p - z.center) / 0.5 <= wp
      drawBar(z, hot)
      cursor(BAR_X + Math.round(p * BAR_W), hot ? P.lime : P.cream)
      drawTextC(ctx, touch ? 'TAP POUR SAUTER !' : 'APPUIE POUR SAUTER !', GW / 2, labelY, hot ? P.lime : P.white, { scale: 2, outline: P.ink })
    } else if (state === 'AIRBORNE') {
      const z = zonesFor(CONFIG.SPIN_TARGET, wp)
      const inZone = Math.abs(c.spinP - CONFIG.SPIN_TARGET) / 0.5 <= wp
      drawBar(z, inZone)
      const fx = Math.round(c.spinP * BAR_W)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(BAR_X, BAR_Y + 3, fx, BAR_H - 6)
      cursor(BAR_X + fx, inZone ? P.lime : P.cream)
      drawTextC(ctx, inZone ? 'RELÂCHE !' : 'MAINTIENS… RELÂCHE DANS LE VERT', GW / 2, labelY, inZone ? P.lime : P.white, { scale: 2, outline: P.ink })
    } else if (state === 'RESULT' || state === 'LANDING') {
      const zj = zonesFor(0.5, wp)
      drawBar(zj, false)
      const mark = (e, colour, dy) => {
        const px = BAR_X + Math.round((0.5 + e * 0.5) * BAR_W)
        ctx.fillStyle = P.ink
        ctx.fillRect(px - 3, BAR_Y + dy - 1, 6, BAR_H / 2 + 2)
        ctx.fillStyle = colour
        ctx.fillRect(px - 2, BAR_Y + dy, 4, BAR_H / 2)
      }
      if (c.jumpErr != null) mark(c.jumpHit ?? c.jumpErr, P.white, 0)
      if (c.spinErr != null) mark(c.spinHit ?? c.spinErr, P.yellow, BAR_H / 2)
      drawTextC(ctx, 'SAUT', GW / 2 - 60, BAR_Y - 20, P.white, { outline: P.ink })
      drawTextC(ctx, 'ROTATION', GW / 2 + 60, BAR_Y - 20, P.yellow, { outline: P.ink })
    }
  }

  /* ----- HUD ----- */
  function board(x, y, w, h) {
    ctx.fillStyle = P.ink
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
    ctx.fillStyle = '#0A0A14'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    for (let yy = y; yy < y + h; yy += 2) ctx.fillRect(x, yy, w, 1)
    ctx.fillStyle = P.navy2
    ctx.fillRect(x, y, w, 1)
  }
  function drawHUD() {
    const left = Math.max(0, CONFIG.RUN_DURATION - g.elapsed)
    const secs = Math.ceil(left)
    const urgent = left <= 10 && left > 0
    // timer, scoreboard style
    board(10, 8, 74, 44)
    drawText(ctx, 'TEMPS', 16, 10, P.grey)
    drawText(ctx, String(secs).padStart(2, '0'), 16, 20, urgent && Math.floor(clock * 4) % 2 ? P.red : P.lime, { scale: 3 })
    ctx.fillStyle = 'rgba(201,242,59,0.12)'
    ctx.fillRect(16, 26, 36, 21)
    // score and record
    board(GW - 176, 8, 166, 44)
    drawText(ctx, 'SCORE', GW - 170, 10, P.grey)
    drawTextR(ctx, 'RECORD ' + fmt(Math.max(best, g.score)), GW - 16, 10, P.yellow)
    drawTextR(ctx, fmt(g.score), GW - 16, 20, P.white, { scale: 3 })
    // combo meter
    const m = multiplier()
    board(10, 300, 110, 50)
    drawText(ctx, 'COMBO', 16, 302, P.grey)
    drawText(ctx, '×' + m, 16, 312, m >= CONFIG.MAX_MULT ? P.lime : m > 1 ? P.yellow : P.white, { scale: 3 })
    for (let i = 0; i < CONFIG.MAX_MULT; i++) {
      ctx.fillStyle = i < m - 1 ? (m >= CONFIG.MAX_MULT ? P.lime : P.yellow) : '#2A2D3A'
      ctx.fillRect(16 + i * 10, 342, 8, 4)
    }
    // fever
    const fx = 522
    board(fx - 6, 300, 112, 50)
    drawText(ctx, 'SIUUU FEVER', fx, 302, inFever() ? P.yellow : P.grey)
    ctx.fillStyle = '#2A2D3A'
    ctx.fillRect(fx, 314, 100, 10)
    if (inFever()) {
      const k = g.feverTime / CONFIG.FEVER_DURATION
      ctx.fillStyle = Math.floor(clock * 8) % 2 ? P.yellow : P.orange
      ctx.fillRect(fx, 314, Math.round(100 * k), 10)
    } else {
      ctx.fillStyle = P.lime
      ctx.fillRect(fx, 314, Math.round(100 * g.fever), 10)
      ctx.fillStyle = '#8CE89A'
      ctx.fillRect(fx, 314, Math.round(100 * g.fever), 2)
    }
    drawText(ctx, inFever() ? 'POINTS ×2 !' : Math.round(g.fever * 100) + '% — 4 PERFECT', fx, 330, inFever() ? P.yellow : P.cream)

    drawGauge()
    if (inFever()) {
      const t = Math.floor(clock * 10) % 2
      ctx.fillStyle = t ? P.yellow : P.orange
      ctx.fillRect(0, 0, GW, 3)
      ctx.fillRect(0, GH - 3, GW, 3)
      ctx.fillRect(0, 0, 3, GH)
      ctx.fillRect(GW - 3, 0, 3, GH)
    }
    if (g.elapsed >= CONFIG.CHAOS_AT && !g.ending) drawTextC(ctx, 'CHAOS', GW / 2, 10, [P.red, P.yellow, P.lime][Math.floor(clock * 6) % 3], { scale: 1, smooth: true, outline: P.ink, extrude: [P.ink] })
  }

  function drawPopups() {
    for (const p of popups) {
      const k = p.life
      const grow = p.scale + (k > 0.9 ? 1 : 0)
      ctx.globalAlpha = k < 0.25 ? k / 0.25 : 1
      const sm = p.scale >= 3
      const sc = sm ? Math.round(grow / 2) : grow
      const w = textWidth(p.text, sc, sm)
      const x = clamp(p.x, w / 2 + 4, GW - w / 2 - 4)
      drawTextC(ctx, p.text, x, clamp(p.y, 50, 290), p.colour, { scale: sc, smooth: sm, outline: p.outline })
      ctx.globalAlpha = 1
    }
    if (banner) {
      const y = 70 + (banner.life > 2.7 ? Math.round((banner.life - 2.7) * 120) : 0)
      ctx.fillStyle = 'rgba(10,10,20,0.85)'
      ctx.fillRect(0, y - 6, GW, 34)
      ctx.fillStyle = P.lime
      ctx.fillRect(0, y - 6, GW, 2)
      ctx.fillRect(0, y + 26, GW, 2)
      const wob = Math.round(Math.sin(clock * 20) * 2)
      drawTextC(ctx, banner.text, GW / 2 + wob, y, P.yellow, { scale: 1, smooth: true, outline: P.ink, extrude: [P.red2] })
    }
    if (comment) {
      ctx.globalAlpha = comment.life < 0.4 ? comment.life / 0.4 : 1
      ctx.fillStyle = 'rgba(10,10,20,0.7)'
      ctx.fillRect(GW / 2 - textWidth(comment.text) / 2 - 6, 56, textWidth(comment.text) + 12, 14)
      drawTextC(ctx, comment.text, GW / 2, 58, P.white)
      ctx.globalAlpha = 1
    }
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,10,20,0.55)'
    ctx.fillRect(0, 0, GW, GH)
    ctx.fillStyle = P.ink
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
    ctx.fillStyle = 'rgba(22,32,64,0.92)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = P.navy2
    ctx.fillRect(x, y, w, 2)
    ctx.fillRect(x, y, 2, h)
    ctx.fillStyle = '#0C1224'
    ctx.fillRect(x, y + h - 2, w, 2)
    ctx.fillRect(x + w - 2, y, 2, h)
  }
  function drawLogo(cx, y) {
    const bounce = Math.round(Math.sin(clock * 4) * 3)
    drawTextC(ctx, 'SIUUUU', cx, y + bounce, P.yellow, {
      scale: 4,
      smooth: true,
      outline: P.ink,
      extrude: ['#B8860B', '#8E5A1E', '#5E3A14', '#3A2410'],
      gradient: ['#FFF7C2', '#FFE14D', '#FFC53D', '#FF9A2E', '#F06A2E', '#D63A3A', '#B02040'],
    })
    drawTextC(ctx, 'SIMULATOR', cx, y + 66, P.white, { scale: 2, smooth: true, outline: P.ink, extrude: ['#8C94A6', '#4F65A0'] })
  }
  function drawTitle() {
    const blink = Math.floor(clock * 2) % 2 === 0
    drawPanel(60, 22, 520, 316)
    drawLogo(GW / 2, 36)
    drawTextC(ctx, '90 SECONDES. ZÉRO BUT. UN MAXIMUM DE SIUUUU.', GW / 2, 150, P.cream, { scale: 1, smooth: true })
    drawTextC(ctx, touch ? 'TAP POUR JOUER' : 'ESPACE POUR JOUER', GW / 2, 186, blink ? P.yellow : P.orange, { scale: 2, smooth: true, outline: P.ink, extrude: [P.red2] })
    drawTextC(ctx, touch ? 'TAP POUR SAUTER • RELÂCHE POUR TERMINER TA ROTATION' : 'APPUIE POUR SAUTER • RELÂCHE POUR TERMINER TA ROTATION', GW / 2, 228, P.white)
    drawTextC(ctx, 'VISE LE VERT, DEUX FOIS DE SUITE.', GW / 2, 242, P.grey)
    drawTextC(ctx, best ? 'RECORD : ' + fmt(best) : 'RECORD : TOUJOURS LIBRE', GW / 2, 270, P.yellow, { scale: 1, smooth: true, outline: P.ink })
    drawTextC(ctx, (touch ? 'BOUTON SON EN BAS À DROITE' : 'M : SON  •  P : PAUSE') + '  •  DUMB GAMES', GW / 2, 310, P.grey)
  }
  function drawGameOver() {
    const r = g.result
    const blink = Math.floor(clock * 2) % 2 === 0
    drawPanel(60, 18, 520, 324)
    drawTextC(ctx, 'FULL TIME — SIUUUUUU !', GW / 2, 28, P.lime, { scale: 2, smooth: true, outline: P.ink, extrude: ['#2F7D4F'] })
    drawTextC(ctx, fmt(r.score), GW / 2, 60, P.white, { scale: 3, smooth: true, outline: P.ink, extrude: ['#8C94A6', '#4F65A0', '#1E2A4A'] })
    if (r.score > 0 && r.score >= r.best) drawTextC(ctx, 'NOUVEAU RECORD !', GW / 2, 130, blink ? P.yellow : P.orange, { scale: 2, outline: P.ink })
    else drawTextC(ctx, 'RECORD : ' + fmt(r.best), GW / 2, 130, P.yellow, { scale: 2 })
    const lines = [
      ['SIUUU RÉUSSIS', r.siuuus],
      ['PERFECT', r.perfects],
      ['COMBO MAX', '×' + Math.min(CONFIG.MAX_MULT, 1 + r.maxCombo)],
      ['FEVER', r.fevers],
      ['GAMELLES', r.fails],
    ]
    lines.forEach(([k, v], i) => {
      const y = 160 + i * 22
      drawText(ctx, k, 150, y, P.cream, { scale: 2 })
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(150, y + 18, 340, 1)
      drawTextR(ctx, String(v), 490, y, P.white, { scale: 2 })
    })
    drawTextC(ctx, 'RANG : ' + r.rank, GW / 2, 274, P.yellow, { scale: 2, outline: P.ink })
    drawTextC(ctx, touch ? 'TAP — REJOUER' : 'ESPACE — REJOUER', GW / 2, 306, blink ? P.lime : P.green, { scale: 2, smooth: true, outline: P.ink, extrude: ['#2F7D4F'] })
  }
  function drawMute() {
    const x = 608
    const y = 338
    ctx.fillStyle = 'rgba(10,10,20,0.8)'
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
    else if (state === 'GAME_OVER') drawGameOver()
    else {
      drawHUD()
      drawPopups()
      if (paused) {
        ctx.fillStyle = 'rgba(10,10,20,0.7)'
        ctx.fillRect(0, 0, GW, GH)
        drawTextC(ctx, 'PAUSE', GW / 2, 140, P.white, { scale: 3, smooth: true, outline: P.ink })
        drawTextC(ctx, 'P OU ÉCHAP POUR REPRENDRE', GW / 2, 210, P.cream, { scale: 2 })
      }
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.7, flash * 4)
      ctx.fillStyle = flashColour
      ctx.fillRect(0, 0, GW, GH)
      ctx.globalAlpha = 1
    }
    ctx.drawImage(scanLayer, 0, 0)
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
