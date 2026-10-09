import { createAudio } from './audio.js'
import { drawText, drawTextC, textWidth } from './font.js'

/*
 * ATTENTION À LA MOUSSE ! — « 10 kilomètres d'effort. 20 centimètres de catastrophe. »
 *
 * Skaters cross the finish line of a small municipal 10 km and meet a tiny foam mat. One
 * press of Space makes every skater inside the short zone just before the mat jump; too
 * early nobody jumps, too late it is a roulé-boulé. Two minutes, from three Sunday athletes
 * to a migration of rollers. No elimination.
 * Version 2 (version 1 is kept in ./v1/): intruders that must NOT jump (the mayor, a pram,
 * a dog, the first-aid volunteer), hesitant beginners, a longer mat, the official
 * photographer's flash, pigeons, a one-off fire engine and the ola.
 * Follows the games-site module contract: `manifest`, `create(options)`, `validate(result)`,
 * `grade(result)`. Internal resolution 320 × 180, pixel art drawn in code.
 */

export const manifest = {
  slug: 'attention-a-la-mousse',
  title: 'ATTENTION À LA MOUSSE !',
  tagline: '10 kilomètres d’effort. 20 centimètres de catastrophe.',
  releasedAt: '2026-11-10',
  status: 'draft',
  orientation: 'landscape',
  size: { width: 320, height: 180 },
  controls: [
    { action: 'press', key: 'Space', label: 'Espace, clic ou tap : faire sauter' },
    { action: 'mute', key: 'KeyM', label: 'M ou bouton son : couper le son' },
  ],
  settings: {},
}

/* ---------- configuration (every tunable number lives here) ---------- */
export const CONFIG = {
  RUN_DURATION: 120,
  END_DELAY: 2,
  RESULTS_LOCK: 0.9,
  // Track geometry. Everything that lies across the track is slanted by SLANT px per px of depth.
  TRACK_TOP: 100,
  TRACK_BOTTOM: 156,
  LANE_TOP: 116,
  LANE_BOTTOM: 142,
  SLANT: 0.35,
  FINISH_X: 88,
  MAT_X: 214,
  MAT_W: 7,
  // Jump zone: the ZONE px before the mat. The last PERFECT px of it are PARFAIT.
  ZONE: 24,
  PERFECT: 7,
  LAND_AFTER: 9,
  // The jump has a fixed length: it clears the mat only from the last JUMP_REACH px before
  // it. Jump earlier in the zone and the skater lands on the mat (TROP TÔT).
  JUMP_REACH: 15,
  JUMP_HEIGHT: 12,
  JUMP_MIN: 0.4,
  // Mashing guard: after a jump the next press needs RECOVERY s. A press too soon, or with
  // nobody in the zone, is a FAUX DÉPART: no jump at all for LOCKOUT s (and pressing during
  // the lockout restarts it). Rhythm beats hammering.
  RECOVERY: 0.2,
  LOCKOUT: 0.65,
  SPAWN_X: -14,
  // Score.
  SAVE_POINTS: 100,
  PERFECT_BONUS: 50,
  PRECISION_CAP: 5,
  LEVELS: [0, 5, 15, 30, 60],
  MULTS: [1, 2, 3, 5, 8],
  // Waves, by arrival time at the mat. size/gap/spacing/speed are [min, max]; spacing is px
  // between rows of a group, `abreast` skaters per row, `vary` the individual speed spread.
  // `fast` and `slow` are the share of FUSÉES and PROMENEURS in a group: they ride at
  // FAST_SPEED / SLOW_SPEED times the group speed, break the group up and arrive off-beat.
  // `hesitant` is the share of beginners who brake just before the zone; `intruder` the chance
  // that a group carries someone who must not jump.
  WAVES: [
    { until: 20, size: [1, 1], gap: [1.7, 2.5], spacing: [0, 0], speed: [36, 62], abreast: 1, vary: 0, fast: 0, slow: 0, hesitant: 0, intruder: 0 },
    { until: 45, size: [2, 4], gap: [1.6, 2.4], spacing: [6, 12], speed: [40, 60], abreast: 1, vary: 3, fast: 0.15, slow: 0.15, hesitant: 0.2, intruder: 0 },
    { until: 75, size: [4, 8], gap: [1.3, 2.0], spacing: [4, 10], speed: [40, 64], abreast: 2, vary: 5, fast: 0.2, slow: 0.2, hesitant: 0.12, intruder: 0.45 },
    { until: 105, size: [8, 16], gap: [1.0, 1.6], spacing: [3, 8], speed: [44, 66], abreast: 3, vary: 6, fast: 0.25, slow: 0.2, hesitant: 0.1, intruder: 0.4 },
    { until: Infinity, size: [22, 38], gap: [0.6, 1.1], spacing: [3, 5], speed: [50, 70], abreast: 4, vary: 6, fast: 0.3, slow: 0.15, hesitant: 0.06, intruder: 0.35 },
  ],
  // Intruders: walking speed range per kind. Making one jump is a SCANDALE (multiplier to ×1).
  INTRUDERS: {
    maire: [24, 30],
    poussette: [28, 34],
    chien: [50, 62],
    secouriste: [32, 36],
  },
  MEDIC_EVERY: 10, // a first-aid volunteer walks the track every N victims
  // Mat extension (the mat grows towards the skaters, so the zone moves earlier) from phase 3,
  // removed for the peloton.
  MAT_EXTENSION: 16,
  MAT_GROW_SPEED: 24,
  // Pigeons land around the mat from PIGEONS_AT; any press makes them fly.
  PIGEONS_AT: 26,
  PIGEONS_EVERY: [11, 16],
  // The official photographer: comes in, aims (the tell), flashes the whole screen white.
  PHOTO_AT: 50,
  PHOTO_EVERY: [9, 14],
  PHOTO_AIM: 1.1,
  PHOTO_FLASH: 0.65,
  // The fire engine: once, from the left, sweeping everybody in its path.
  TRUCK_AT: 92,
  TRUCK_WARN: 1.8,
  TRUCK_SPEED: 115,
  TRUCK_LEN: 58,
  // Ola: OLA_EVERY consecutive presses with a PARFAIT start an ola, points ×2 for a while.
  OLA_EVERY: 8,
  OLA_DURATION: 6,
  FAST_SPEED: 1.5,
  SLOW_SPEED: 0.65,
  BREATHER_EVERY: [4, 6],
  BREATHER_FACTOR: 1.9,
  FIRST_ARRIVAL: 3.2,
  // The announcer says it on the first arrival, then more and more often.
  VOICE_INTERVAL: [7, 1.6],
}

const PHASE_NOTES = [
  null,
  'DÉBUTANTS AUTORISÉS SUR LE PARCOURS',
  'ACCÈS PUBLIC AUTORISÉ : NE PAS LES FAIRE SAUTER',
  'EXTENSION DU TAPIS HOMOLOGUÉE',
  'LE PELOTON DU DIMANCHE',
]
const INTRUDER_KINDS = new Set(['maire', 'poussette', 'chien', 'secouriste'])
const SCANDAL_NOTES = {
  maire: 'LE MAIRE A SAUTÉ. CONSEIL MUNICIPAL CONVOQUÉ',
  poussette: 'POUSSETTE EN VOL : ENQUÊTE OUVERTE',
  chien: 'CHIEN EN VOL : LA SPA EST PRÉVENUE',
  secouriste: 'SECOURISTE EN VOL : ARRÊT DE TRAVAIL',
}
const LEVEL_NOTES = [
  null,
  'DISPOSITIF HOMOLOGUÉ',
  'CONFORMITÉ PRÉFECTORALE ×3',
  'RESPONSABILITÉ MUNICIPALE ×5',
  'ARRÊTÉ MUNICIPAL N°8 : TOUT VA BIEN',
]
const FALL_NOTES = [
  'INCIDENT CONSIGNÉ',
  'FORMULAIRE CERFA À REMPLIR',
  'L’ASSURANCE EST PRÉVENUE',
  'LE TAPIS N’EST PAS EN CAUSE',
  'CLASSÉ SANS SUITE',
  'MAIN COURANTE DÉPOSÉE',
  'LE MAIRE EST INFORMÉ',
]
const SAVE_MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400]
const CROWD_LINES = ['LA MOUSSE !', 'ATTENTION !', 'SAUTEZ !', 'C’EST NORMAL ?', 'ILS SONT COMBIEN ?', 'RALENTISSEZ !', 'PAPA !', 'ALLEZ MONIQUE !']

/* ---------- palette ---------- */
const P = {
  ink: '#1d2a3a',
  white: '#f7f4ea',
  sky: '#9fd3ee',
  skyLow: '#c9e8f2',
  grass: '#5fae4f',
  grassDark: '#3f8a3a',
  asphalt: '#6f7380',
  asphaltDark: '#5e626e',
  asphaltLight: '#878b97',
  barrier: '#b9c0c8',
  barrierDark: '#7d858f',
  mat: '#2a62c9',
  matTop: '#4f86e6',
  matSide: '#1a3f88',
  red: '#e23b3b',
  redDark: '#a82525',
  yellow: '#ffd23f',
  vest: '#d6f23a',
  vestDark: '#9fb81e',
  orange: '#f07f2a',
  green: '#3fbf6a',
  wood: '#a8743e',
  woodDark: '#7a5129',
  wall: '#e9d9b6',
  roof: '#b4553f',
  grey: '#8e95a0',
  paper: '#fbf7ee',
  stamp: '#c8322f',
}
const HELMETS = ['#e23b3b', '#ffd23f', '#2a62c9', '#3fbf6a', '#f07f2a', '#9b4fc9', '#f7f4ea', '#2b2b33', '#ff7fb0']
const JERSEYS = ['#e85d75', '#3aa0e8', '#f2d03b', '#5ac46a', '#ff8c3a', '#7f5ae0', '#e8e8e8', '#1d8a8a', '#d13c3c', '#ff7fb0']
const SHORTS = ['#1b1b2a', '#2a3a6a', '#5a2a2a', '#333a40', '#3f2a5a']
const SKINS = ['#f3c9a3', '#e0ac7e', '#b9804f', '#8a5a35', '#f7dcc0']
const SKATE = '#2b2b33'
const WHEEL = '#d9d9d9'

const W = 320
const H = 180

/* ---------- tiny seeded RNG (debug reproducibility) ---------- */
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

/* ---------- skater poses: [x, y, w, h, colour key], feet at (0, 0), facing right ---------- */
const HEAD = [
  [-2, -20, 5, 1, 'H'],
  [-3, -19, 6, 2, 'H'],
  [-2, -17, 5, 3, 'S'],
  [1, -16, 1, 1, 'E'],
]
const HEAD_PANIC = [
  [-2, -20, 5, 1, 'H'],
  [-3, -19, 6, 2, 'H'],
  [-2, -17, 5, 4, 'S'],
  [0, -16, 2, 1, 'W'],
  [1, -16, 1, 1, 'E'],
  [1, -14, 2, 1, 'M'],
]
const TORSO = [
  [-2, -14, 4, 5, 'J'],
  [-2, -9, 4, 2, 'D'],
]
const BIB = [[-1, -13, 2, 2, 'B']]
const LEGS_TOGETHER = [
  [-2, -7, 1, 5, 'S'],
  [1, -7, 1, 5, 'S'],
  [-3, -2, 3, 1, 'K'],
  [1, -2, 3, 1, 'K'],
  [-3, -1, 1, 1, 'R'],
  [-1, -1, 1, 1, 'R'],
  [1, -1, 1, 1, 'R'],
  [3, -1, 1, 1, 'R'],
]
const LEGS_STRIDE = [
  [-3, -7, 1, 3, 'S'],
  [-4, -5, 1, 3, 'S'],
  [-7, -2, 3, 1, 'K'],
  [-7, -1, 1, 1, 'R'],
  [-5, -1, 1, 1, 'R'],
  [1, -7, 1, 5, 'S'],
  [1, -2, 3, 1, 'K'],
  [1, -1, 1, 1, 'R'],
  [3, -1, 1, 1, 'R'],
]
const LEGS_STAR = [
  [-3, -7, 1, 3, 'S'],
  [-4, -5, 1, 3, 'S'],
  [-6, -2, 3, 1, 'K'],
  [2, -7, 1, 3, 'S'],
  [3, -5, 1, 3, 'S'],
  [3, -2, 3, 1, 'K'],
  [-6, -1, 1, 1, 'R'],
  [5, -1, 1, 1, 'R'],
]
const ARMS_SWING = [
  [-3, -13, 1, 2, 'S'],
  [-4, -11, 1, 2, 'S'],
  [2, -13, 1, 1, 'S'],
  [3, -12, 2, 1, 'S'],
]
const ARMS_SWING_B = [
  [-3, -13, 1, 3, 'S'],
  [2, -13, 1, 2, 'S'],
  [3, -11, 1, 1, 'S'],
]
const ARMS_UP = [
  [-4, -19, 1, 5, 'S'],
  [-3, -14, 1, 1, 'S'],
  [3, -19, 1, 5, 'S'],
  [2, -14, 1, 1, 'S'],
]
const ARMS_UP_B = [
  [-5, -18, 1, 4, 'S'],
  [-4, -14, 1, 1, 'S'],
  [4, -18, 1, 4, 'S'],
  [3, -14, 1, 1, 'S'],
]
const ARMS_STIFF = [
  [-3, -14, 1, 6, 'S'],
  [2, -14, 1, 6, 'S'],
]
const ARMS_STAR = [
  [-5, -16, 3, 1, 'S'],
  [-6, -17, 1, 1, 'S'],
  [2, -16, 3, 1, 'S'],
  [5, -17, 1, 1, 'S'],
]

/* Intruders, same convention. Extra colour keys: U suit, G grey hair, b/w/r the tricolour
 * sash, C/c dog, P pram, O orange vest, A adult shirt. */
const MAIRE = [
  [-2, -20, 4, 1, 'S'],
  [-2, -19, 5, 4, 'S'],
  [-3, -19, 1, 3, 'G'],
  [1, -18, 1, 1, 'E'],
  [1, -16, 2, 1, 'G'],
  [-3, -15, 5, 8, 'U'],
  [0, -15, 1, 3, 'W'],
  [-3, -14, 1, 1, 'b'],
  [-2, -13, 1, 1, 'w'],
  [-1, -12, 1, 1, 'r'],
  [0, -11, 1, 1, 'b'],
  [1, -10, 1, 1, 'w'],
  [1, -9, 1, 1, 'r'],
]
const MAIRE_ARMS = [[-4, -14, 1, 5, 'U'], [-4, -9, 1, 1, 'S']]
const MAIRE_ARMS_UP = [[-4, -20, 1, 6, 'U'], [2, -20, 1, 6, 'U']]
const WALK_A = [[-2, -7, 2, 6, 'U'], [0, -7, 2, 6, 'U'], [-3, -1, 3, 1, 'K'], [0, -1, 3, 1, 'K']]
const WALK_B = [[-3, -7, 2, 6, 'U'], [1, -7, 2, 6, 'U'], [-4, -1, 3, 1, 'K'], [1, -1, 3, 1, 'K']]
const CHIEN = [
  [-4, -6, 8, 3, 'C'],
  [3, -8, 3, 3, 'C'],
  [3, -9, 1, 1, 'c'],
  [6, -7, 1, 1, 'E'],
  [4, -8, 1, 1, 'E'],
  [2, -6, 1, 3, 'r'],
]
const CHIEN_A = [[-3, -3, 1, 3, 'c'], [2, -3, 1, 3, 'c'], [-5, -8, 1, 2, 'C']]
const CHIEN_B = [[-4, -3, 1, 3, 'c'], [3, -3, 1, 3, 'c'], [-6, -7, 1, 1, 'C']]
const POUSSETTE = [
  // The pram (front at x = 0)...
  [-8, -12, 4, 4, 'P'],
  [-8, -8, 8, 4, 'P'],
  [-4, -10, 2, 2, 'S'],
  [-7, -3, 2, 2, 'E'],
  [-2, -3, 2, 2, 'E'],
  [-10, -11, 2, 1, 'E'],
  // ...pushed by a parent in jeans.
  [-14, -20, 4, 2, 'G'],
  [-14, -18, 4, 4, 'S'],
  [-11, -17, 1, 1, 'E'],
  [-15, -14, 5, 7, 'A'],
  [-11, -12, 2, 1, 'S'],
]
const POUSSETTE_A = [[-14, -7, 1, 6, 'D'], [-12, -7, 1, 6, 'D'], [-15, -1, 2, 1, 'K'], [-12, -1, 2, 1, 'K']]
const POUSSETTE_B = [[-15, -7, 1, 6, 'D'], [-11, -7, 1, 6, 'D'], [-16, -1, 2, 1, 'K'], [-11, -1, 2, 1, 'K']]
const SECOURISTE = [
  [-3, -21, 5, 2, 'r'],
  [-2, -19, 5, 4, 'S'],
  [1, -18, 1, 1, 'E'],
  [-3, -15, 6, 8, 'O'],
  [-1, -14, 2, 4, 'W'],
  [-2, -13, 4, 2, 'W'],
  [3, -11, 3, 4, 'r'],
  [4, -12, 1, 1, 'W'],
]

export function create({ canvas, settings = {}, onState, onEnd }) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const audio = createAudio()
  const debug = !!settings.debug
  // Debug only: override any CONFIG value for a run (e.g. a short RUN_DURATION), never in play.
  const C = { ...CONFIG, ...(debug && settings.config ? settings.config : {}) }
  const seedValue = settings.seed ?? null
  const random = seedValue !== null ? mulberry32(Number(seedValue)) : Math.random
  const rand = ([a, b]) => a + random() * (b - a)
  const randInt = ([a, b]) => a + Math.floor(random() * (b - a + 1))
  const pick = (list) => list[Math.floor(random() * list.length)]
  const matExt = () => (G ? G.matExt : 0)
  const matW = () => C.MAT_W + matExt()
  const matX = (y) => C.MAT_X - matExt() + (y - C.TRACK_TOP) * C.SLANT
  const isIntruder = (s) => INTRUDER_KINDS.has(s.kind)
  const finishX = (y) => C.FINISH_X + (y - C.TRACK_TOP) * C.SLANT

  /* ---------- persistence ---------- */
  function load(key, fallback) {
    try {
      const v = localStorage.getItem('attentionALaMousse2:' + key)
      return v === null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem('attentionALaMousse2:' + key, JSON.stringify(value))
    } catch {}
  }
  let best = Number(load('best', 0)) || 0
  audio.setMuted(load('muted', false) === true)

  /* ---------- state ---------- */
  let state = 'TITLE' // TITLE | PLAYING | RESULTS
  let stateAt = 0
  let paused = false
  let needRelease = false
  let now = 0
  let lastFrame = performance.now()
  let raf = 0
  let destroyed = false
  // Phones see « TAPOTE » from the start, before the first touch.
  let pointerTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  let G = null
  let skaters = []
  let particles = []
  let popups = []
  let bubbles = []
  let pigeons = []
  let shake = 0
  let cheer = 0
  let attractAt = 0
  let nextId = 1

  function setState(next) {
    state = next
    stateAt = now
    onState?.(state === 'TITLE' ? 'idle' : state === 'RESULTS' ? 'over' : 'playing')
  }

  function newGame() {
    return {
      t: 0,
      over: false,
      overAt: 0,
      score: 0,
      saved: 0,
      victims: 0,
      perfects: 0,
      combo: 0,
      bestCombo: 0,
      chain: 0, // progress toward the next multiplier level (a fall drops it back a level)
      level: 0,
      precision: 0, // consecutive presses with at least one PARFAIT; an empty press breaks it
      bestPrecision: 0,
      emptyPresses: 0,
      falseStarts: 0,
      readyAt: 0, // G.t from which the next press may jump
      lockedUntil: 0, // FAUX DÉPART lockout
      presses: 0,
      biggestJump: 0,
      phase: 0,
      nextGroup: null,
      breatherIn: randInt(C.BREATHER_EVERY),
      lastVoice: -99,
      voiced: false,
      notes: [],
      note: null,
      milestone: 0,
      fallNote: 0,
      lastFallNoteAt: -99,
      banner: null,
      newRecord: false,
      scandals: 0,
      evacuated: 0,
      olas: 0,
      olaAt: -99,
      olaUntil: 0,
      matExt: 0,
      matExtTarget: 0,
      mayorDone: false,
      nextMedicAt: C.MEDIC_EVERY,
      nextPigeons: C.PIGEONS_AT,
      photo: null,
      nextPhoto: C.PHOTO_AT,
      flashAt: -99,
      truck: null,
    }
  }

  /* ---------- waves ---------- */
  const zoneMid = () => matX((C.LANE_TOP + C.LANE_BOTTOM) / 2) - C.ZONE / 2
  const phaseAt = (t) => C.WAVES.findIndex((w) => t < w.until)

  function planGroup(arrival) {
    const w = C.WAVES[phaseAt(arrival)]
    const n = randInt(w.size)
    const speed = rand(w.speed)
    const spacing = rand(w.spacing)
    const members = []
    const depth = C.LANE_BOTTOM - C.LANE_TOP
    const lane = random()
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / w.abreast)
      const col = i % w.abreast
      const y =
        w.abreast === 1
          ? C.LANE_TOP + (n === 1 ? lane : (lane * 0.6 + random() * 0.4)) * depth
          : C.LANE_TOP + ((col + 0.15 + random() * 0.7) / w.abreast) * depth
      const roll = random()
      const kind =
        roll < w.fast ? 'fast' : roll < w.fast + w.slow ? 'slow' : roll < w.fast + w.slow + w.hesitant ? 'hesitant' : 'normal'
      const factor = kind === 'fast' ? C.FAST_SPEED : kind === 'slow' ? C.SLOW_SPEED : 1
      const v = (speed + (random() * 2 - 1) * w.vary) * factor
      members.push({ behind: row * spacing + (w.abreast > 1 ? random() * 3 : 0), y, v, kind })
    }
    const span = (Math.ceil(n / w.abreast) - 1) * spacing
    if (G && random() < w.intruder) {
      // The first intruder is always the mayor.
      const kind = G.mayorDone ? pick(['maire', 'poussette', 'poussette', 'chien', 'chien']) : 'maire'
      G.mayorDone = true
      members.push({ behind: random() * (span + 6), y: C.LANE_TOP + random() * depth, v: rand(C.INTRUDERS[kind]), kind })
    }
    return { arrival, speed, members, span, gap: rand(w.gap) }
  }

  function spawnDue() {
    let g = G.nextGroup
    while (g && G.t >= g.arrival - (zoneMid() - C.SPAWN_X) / g.speed) {
      const lead = zoneMid() - g.speed * (g.arrival - G.t)
      for (const m of g.members) skaters.push(makeSkater(lead - m.behind, m.y, m.v, m.kind))
      let gap = g.gap
      if (--G.breatherIn <= 0) {
        gap *= C.BREATHER_FACTOR
        G.breatherIn = randInt(C.BREATHER_EVERY)
      }
      const next = g.arrival + g.span / g.speed + gap
      g = G.nextGroup = next < C.RUN_DURATION - 0.4 ? planGroup(next) : null
    }
  }

  function makeSkater(x, y, v, kind = 'normal') {
    if (kind === 'maire' && G) notify('M. LE MAIRE SUR LE PARCOURS', P.ink)
    return {
      id: nextId++,
      kind, // normal | fast (FUSÉE) | slow (PROMENEUR) | hesitant (DÉBUTANT) | an intruder kind
      x,
      y,
      vx: v,
      base: v,
      // A beginner brakes once or twice just before the zone, then sets off again.
      brakes: kind === 'hesitant' ? (random() < 0.5 ? [rand([22, 34]), rand([3, 10])] : [rand([4, 14])]) : [],
      braking: 0,
      crossed: false,
      z: 0,
      t: 0,
      anim: random() * 4,
      state: 'roll', // roll | jump | land | fall
      rot: 0,
      slideRot: 1,
      jumpT: 1,
      announced: INTRUDER_KINDS.has(kind),
      look: {
        H: pick(HELMETS),
        J: pick(JERSEYS),
        D: pick(SHORTS),
        S: pick(SKINS),
        bib: random() < 0.5,
      },
    }
  }

  /* ---------- notifications, bubbles, popups ---------- */
  function notify(text, colour = P.ink) {
    if (!G) return
    G.notes.push({ text, colour })
    if (G.notes.length > 3) G.notes.splice(0, G.notes.length - 3)
  }
  function popup(x, y, text, colour, dur = 0.8) {
    popups.push({ x, y, text, colour, at: now, dur })
  }
  function bubble(x, y, text, dur = 1.3) {
    bubbles.push({ x, y, text, until: now + dur })
  }
  function announce(force = false) {
    const intensity = G ? G.phase / 4 : 0
    const k = G ? Math.min(1, G.t / C.RUN_DURATION) : 0
    const interval = C.VOICE_INTERVAL[0] + (C.VOICE_INTERVAL[1] - C.VOICE_INTERVAL[0]) * k
    if (!force && G && G.t - G.lastVoice < interval) return
    if (G) G.lastVoice = G.t
    bubble(262, 64, 'ATTENTION À LA MOUSSE !', 1.4)
    audio.say('Attention à la mousse !', intensity)
    // From the crowd phase, the spectators take up the chant.
    if (G && G.phase >= 2) {
      const echoes = G.phase - 1
      for (let i = 0; i < echoes; i++) bubble(20 + random() * 150, 58 + random() * 8, pick(CROWD_LINES), 1 + random() * 0.6)
    }
  }

  /* ---------- the single action ---------- */
  function press() {
    if (needRelease) return
    needRelease = true
    if (paused) {
      // The resume press is consumed without jumping.
      paused = false
      lastFrame = performance.now()
      return
    }
    if (state === 'TITLE') return startRun()
    if (state === 'RESULTS') {
      if (now - stateAt < C.RESULTS_LOCK) return
      return startRun()
    }
    if (state !== 'PLAYING' || G.over) return
    G.presses++
    scarePigeons()
    const inZone = skaters.filter((s) => s.state === 'roll' && !s.crossed && s.x >= matX(s.y) - C.ZONE && s.x < matX(s.y))
    let jumpers = inZone.filter((s) => !isIntruder(s))
    const intruders = inZone.filter(isIntruder)
    const locked = G.t < G.lockedUntil
    const tooSoon = G.t < G.readyAt
    if (!inZone.length || locked || tooSoon) {
      // FAUX DÉPART: nobody jumps, the precision streak breaks, and the zone is closed for a
      // moment. No points are taken, but whoever reaches the mat meanwhile meets it.
      if (!jumpers.length) G.emptyPresses++
      G.falseStarts++
      G.precision = 0
      G.lockedUntil = G.t + C.LOCKOUT
      if (!locked) {
        audio.falseStart()
        popup(matX(C.LANE_TOP) - C.ZONE / 2, C.LANE_TOP - 26, jumpers.length ? 'UN SAUT À LA FOIS !' : 'FAUX DÉPART !', P.red, 0.7)
        if (G.falseStarts === 3 || G.falseStarts % 15 === 0) notify('FAUX DÉPARTS : ' + G.falseStarts + ' (PV DRESSÉ)', P.stamp)
      }
      return
    }
    G.readyAt = G.t + C.RECOVERY
    const anyPerfect = jumpers.some((s) => s.x >= matX(s.y) - C.PERFECT)
    G.precision = anyPerfect ? G.precision + 1 : 0
    G.bestPrecision = Math.max(G.bestPrecision, G.precision)
    if (anyPerfect && G.precision % C.OLA_EVERY === 0) startOla()
    const ola = G.t < G.olaUntil ? 2 : 1
    // Only those within JUMP_REACH of the mat can clear it. If someone can, the ones further
    // back keep rolling and wait for the next press. If nobody can, the press was too early:
    // they all take off and land on the foam.
    const early = jumpers.filter((s) => s.x < matX(s.y) - C.JUMP_REACH)
    if (early.length === jumpers.length) {
      for (const s of early) {
        launch(s)
        s.short = true
      }
      if (early.length) popup(matX(C.LANE_TOP) - C.ZONE / 2, C.LANE_TOP - 26, 'TROP TÔT !', P.orange, 0.7)
    }
    jumpers = jumpers.filter((s) => !early.includes(s))
    for (const s of jumpers) {
      const perfect = s.x >= matX(s.y) - C.PERFECT
      const mult = C.MULTS[G.level] * ola
      // PARFAIT pays 50, times the precision streak (capped), times the multiplier.
      const bonus = perfect ? C.PERFECT_BONUS * Math.min(C.PRECISION_CAP, G.precision) : 0
      const points = (C.SAVE_POINTS + bonus) * mult
      G.score += points
      G.saved++
      G.combo++
      G.bestCombo = Math.max(G.bestCombo, G.combo)
      G.chain++
      if (perfect) G.perfects++
      launch(s)
      s.perfect = perfect
      if (jumpers.length <= 4) popup(s.x, s.y - 26, perfect ? 'PARFAIT' : '+' + points, perfect ? P.yellow : P.white)
      while (G.level < C.LEVELS.length - 1 && G.chain >= C.LEVELS[G.level + 1]) {
        G.level++
        notify(LEVEL_NOTES[G.level], P.ink)
        audio.levelUp(G.level)
        popup(160, 40, '×' + C.MULTS[G.level], P.yellow, 1.2)
      }
    }
    if (jumpers.length > 4) {
      const total = jumpers.length
      popup(matX(C.LANE_TOP), C.LANE_TOP - 30, total + ' SAUVÉS', P.yellow, 1)
      if (total >= 8) notify('BANC DE POISSONS HOMOLOGUÉ', P.ink)
      else notify('SAUT COLLECTIF ×' + total + ' : CONFORME', P.ink)
      cheer = Math.min(1, cheer + 0.5)
      audio.cheer(Math.min(1, total / 10))
    }
    G.biggestJump = Math.max(G.biggestJump, jumpers.length)
    for (const s of intruders) {
      launch(s)
      scandal(s)
    }
    while (G.milestone < SAVE_MILESTONES.length && G.saved >= SAVE_MILESTONES[G.milestone]) {
      notify(SAVE_MILESTONES[G.milestone] + ' FRACTURES ÉVITÉES', P.ink)
      G.milestone++
    }
    audio.jump(inZone.length, anyPerfect)
  }
  function launch(s) {
    s.state = 'jump'
    s.t = 0
    s.braking = 0
    s.vx = Math.max(s.vx, isIntruder(s) ? s.vx : 40)
    // Fixed length: from the last JUMP_REACH px it lands just past the mat.
    const length = matW() + C.JUMP_REACH + 3
    s.jumpT = Math.max(C.JUMP_MIN, length / s.vx)
    if (s.x + s.vx * s.jumpT < matX(s.y) + matW() + 2 && isIntruder(s)) s.jumpT = (matX(s.y) + matW() + 4 - s.x) / s.vx
  }
  function scandal(s) {
    G.scandals++
    G.level = 0
    G.chain = 0
    G.combo = 0
    G.precision = 0
    notify(SCANDAL_NOTES[s.kind], P.stamp)
    popup(s.x, s.y - 30, 'SCANDALE !', P.red, 1.2)
    for (let i = 0; i < 3; i++) bubble(30 + random() * 230, 58 + random() * 8, pick(['OH !!', 'SCANDALE !', 'DÉMISSION !', 'LA HONTE !']), 1.2)
    shake = Math.min(4, shake + 2)
    audio.scandal()
  }
  function startOla() {
    G.olas++
    G.olaAt = now
    G.olaUntil = G.t + C.OLA_DURATION
    notify('OLA RÉGLEMENTAIRE : POINTS ×2', P.ink)
    popup(160, 50, 'OLA !', P.yellow, 1.4)
    cheer = 1
    audio.ola()
  }
  function pigeonSpot(p) {
    p.ty = C.LANE_TOP - 4 + random() * (C.LANE_BOTTOM - C.LANE_TOP + 8)
    p.tx = matX(p.ty) - C.ZONE - 14 + random() * (C.ZONE + 34)
  }
  function scarePigeons(x = null, y = null) {
    // Pigeons flutter up and land again a little further, in the zone, until they get bored.
    let any = false
    for (const p of pigeons) {
      if (p.state !== 'ground') continue
      if (x !== null && (Math.abs(p.x - x) > 9 || Math.abs(p.y - y) > 6)) continue
      p.state = 'hop'
      p.t = 0
      p.fx = p.x
      p.fy = p.y
      pigeonSpot(p)
      any = true
    }
    if (x === null && any) audio.flap()
  }
  function release() {
    needRelease = false
  }

  function startRun() {
    audio.resume()
    audio.primeVoice()
    G = newGame()
    G.nextGroup = planGroup(C.FIRST_ARRIVAL)
    skaters = []
    particles = []
    popups = []
    bubbles = []
    pigeons = []
    shake = 0
    cheer = 0
    audio.setIntensity(0)
    audio.music(true)
    audio.whistle()
    setState('PLAYING')
  }

  function fall(s, thrown = false) {
    const unscored = s.state === 'roll' && !isIntruder(s)
    s.state = 'fall'
    s.t = 0
    s.slideRot = pick([1, 1, 3, 3, 2])
    s.vx = Math.max(s.vx, 40) * (1.05 + random() * 0.25)
    s.bounce = 7
    if (thrown) {
      // Swept by the fire engine: big cartoon arc, not counted as a victim, just a lost save.
      s.vx = C.TRUCK_SPEED + 30 + random() * 60
      s.bounce = 18 + random() * 12
      if (G && unscored) G.evacuated++
      return
    }
    for (let i = 0; i < 6; i++)
      particles.push({ x: s.x, y: s.y - 4, vx: (random() - 0.3) * 60, vy: -30 - random() * 50, life: 0.6, born: now, colour: i % 2 ? P.yellow : P.white, g: 160 })
    shake = Math.min(3, shake + 1.2)
    if (!G || G.over) return
    G.victims++
    G.combo = 0
    if (G.level > 0) {
      G.level--
      G.chain = C.LEVELS[G.level]
      audio.levelDown()
    } else G.chain = 0
    if (G.t - G.lastFallNoteAt > 2.5) {
      G.lastFallNoteAt = G.t
      notify(G.victims === 1 ? 'PREMIER INCIDENT CONSIGNÉ' : FALL_NOTES[G.fallNote++ % FALL_NOTES.length], P.stamp)
    }
    if (random() < 0.5) bubble(40 + random() * 160, 60, pick(['OH !', 'AÏE !', 'OUILLE', 'OH NON !']), 0.8)
    audio.fall()
  }

  function updateEvents(dt) {
    // Mat extension.
    G.matExtTarget = G.phase === 3 ? C.MAT_EXTENSION : 0
    if (G.matExt !== G.matExtTarget) {
      const d = C.MAT_GROW_SPEED * dt
      G.matExt = G.matExt < G.matExtTarget ? Math.min(G.matExtTarget, G.matExt + d) : Math.max(G.matExtTarget, G.matExt - d)
    }
    // First-aid volunteer after every MEDIC_EVERY victims.
    if (G.victims >= G.nextMedicAt) {
      G.nextMedicAt += C.MEDIC_EVERY
      if (!skaters.some((s) => s.kind === 'secouriste' && s.state === 'roll')) {
        skaters.push(makeSkater(-14, C.LANE_TOP + random() * (C.LANE_BOTTOM - C.LANE_TOP), rand(C.INTRUDERS.secouriste), 'secouriste'))
        notify('SECOURS EN ROUTE : NE PAS LE FAIRE SAUTER', P.ink)
      }
    }
    // Pigeons.
    if (G.t >= G.nextPigeons) {
      G.nextPigeons = G.t + rand(C.PIGEONS_EVERY)
      const n = randInt([4, 7])
      for (let i = 0; i < n; i++) {
        const p = { x: W + 20, y: 10, t: -i * 0.12, state: 'in', vx: 0, vy: 0, leaveAt: G.t + 8 + random() * 5 }
        pigeonSpot(p)
        pigeons.push(p)
      }
      audio.coo()
    }
    // Photographer.
    const ph = G.photo
    if (!ph && G.t >= G.nextPhoto) {
      G.photo = { phase: 'in', t: 0 }
    } else if (ph) {
      ph.t += dt
      if (ph.phase === 'in' && ph.t >= 0.5) {
        ph.phase = 'aim'
        ph.t = 0
        bubble(208, 150, 'SOURIEZ !', C.PHOTO_AIM)
      } else if (ph.phase === 'aim' && ph.t >= C.PHOTO_AIM) {
        ph.phase = 'flash'
        ph.t = 0
        G.flashAt = now
        audio.shutter()
      } else if (ph.phase === 'flash' && ph.t >= 0.5) {
        ph.phase = 'out'
        ph.t = 0
      } else if (ph.phase === 'out' && ph.t >= 0.5) {
        G.photo = null
        G.nextPhoto = G.t + rand(C.PHOTO_EVERY)
      }
    }
    // Fire engine, once.
    if (!G.truck && G.t >= C.TRUCK_AT) {
      G.truck = { state: 'warn', t: 0, x: -10, z: 0, bumped: false }
      notify('INTERVENTION DES POMPIERS', P.stamp)
      audio.siren()
    }
    const tr = G.truck
    if (tr && tr.state !== 'done') {
      tr.t += dt
      if (tr.state === 'warn' && tr.t >= C.TRUCK_WARN) {
        tr.state = 'drive'
        tr.t = 0
        audio.siren()
      } else if (tr.state === 'drive') {
        tr.x += C.TRUCK_SPEED * dt
        // The mat does not move. The truck does.
        if (!tr.bumped && tr.x >= matX(C.LANE_BOTTOM)) {
          tr.bumped = true
          tr.bumpAt = now
          shake = 4
          audio.fall()
          notify('LE TAPIS N’A PAS BOUGÉ', P.ink)
        }
        tr.z = tr.bumpAt && now - tr.bumpAt < 0.35 ? Math.sin(((now - tr.bumpAt) / 0.35) * Math.PI) * 6 : 0
        for (const s of skaters) {
          if (s.state === 'fall') continue
          if (s.x <= tr.x + 3 && s.x >= tr.x - C.TRUCK_LEN) fall(s, true)
        }
        scarePigeons()
        if (tr.x - C.TRUCK_LEN > W + 10) {
          tr.state = 'done'
          if (G.evacuated) notify(G.evacuated + ' PERSONNES ÉVACUÉES. BILAN POSITIF', P.ink)
        }
      }
    }
  }

  function finishRun() {
    if (G.score > best) {
      best = G.score
      G.newRecord = true
      save('best', best)
    }
    setState('RESULTS')
    audio.music(false)
    audio.hush()
    audio.results()
    onEnd?.({
      score: G.score,
      details: {
        saved: G.saved,
        victims: G.victims,
        perfects: G.perfects,
        bestCombo: G.bestCombo,
        bestPrecision: G.bestPrecision,
        biggestJump: G.biggestJump,
        falseStarts: G.falseStarts,
        scandals: G.scandals,
        evacuated: G.evacuated,
        olas: G.olas,
      },
      durationMs: Math.round(C.RUN_DURATION * 1000),
    })
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (paused) return
    now += dt
    shake = Math.max(0, shake - dt * 8)
    cheer = Math.max(0, cheer - dt * 0.6)

    if (state === 'TITLE') {
      // Attract mode: a lone Sunday athlete meets the mat every few seconds.
      if (now >= attractAt) {
        attractAt = now + 3.2
        skaters.push(makeSkater(-12, C.LANE_TOP + random() * (C.LANE_BOTTOM - C.LANE_TOP), 50))
      }
    }

    if (state === 'PLAYING') {
      G.t += dt
      const phase = Math.max(0, phaseAt(G.t))
      if (phase !== G.phase) {
        G.phase = phase
        audio.setIntensity(phase)
        if (phase === 4) {
          G.banner = { text: 'LE PELOTON DU DIMANCHE', at: now }
          audio.say('Le peloton du dimanche !', 1)
          G.lastVoice = G.t
        } else if (PHASE_NOTES[phase]) notify(PHASE_NOTES[phase], P.ink)
      }
      if (!G.over) {
        spawnDue()
        updateEvents(dt)
      }
      if (!G.over && G.t >= C.RUN_DURATION) {
        G.over = true
        G.overAt = now
        audio.whistle()
        audio.music(false)
      }
      if (G.over && now - G.overAt >= C.END_DELAY) finishRun()
      // Notifications: one at a time, faster when they pile up.
      if (G.note && now - G.note.at > (G.notes.length ? 1.1 : 1.8)) G.note = null
      if (!G.note && G.notes.length) {
        G.note = { ...G.notes.shift(), at: now }
        audio.stamp()
      }
    }

    for (const s of skaters) {
      if (s.state === 'roll') {
        if (s.brakes.length || s.braking > 0) {
          // DÉBUTANT: a T-stop just before the zone, then off again.
          const toZone = matX(s.y) - C.ZONE - s.x
          if (s.braking <= 0 && s.brakes.length && toZone <= s.brakes[0]) {
            s.brakes.shift()
            s.braking = 0.35 + random() * 0.4
          }
          if (s.braking > 0) {
            s.braking -= dt
            s.vx = Math.max(2, s.vx - 260 * dt)
          } else s.vx = Math.min(s.base, s.vx + 110 * dt)
        } else if (s.kind === 'hesitant') s.vx = Math.min(s.base, s.vx + 110 * dt)
        s.x += s.vx * dt
        s.anim += (s.vx * dt) / (isIntruder(s) ? 4 : 7)
        // The announcer: on the first arrival, then whenever a group passes the arch.
        if (!s.announced && s.x >= finishX(s.y) + 10) {
          s.announced = true
          if (G && !G.over) announce(!G.voiced)
          if (G) G.voiced = true
        }
        if (!s.crossed && s.x >= matX(s.y) - 1) {
          // Walkers simply step over the mat; skaters meet it.
          if (isIntruder(s)) {
            s.state = 'step'
            s.t = 0
            s.jumpT = (matW() + 4) / s.vx
          } else fall(s)
        }
        if (pigeons.length) scarePigeons(s.x, s.y)
      } else if (s.state === 'step') {
        s.t += dt
        s.x += s.vx * dt
        s.anim += (s.vx * dt) / 4
        s.z = Math.sin(Math.min(1, s.t / s.jumpT) * Math.PI) * 3
        if (s.t >= s.jumpT) {
          s.state = 'roll'
          s.crossed = true
          s.z = 0
        }
      } else if (s.state === 'jump') {
        s.t += dt
        s.x += s.vx * dt
        const u = Math.min(1, s.t / s.jumpT)
        s.z = (C.JUMP_HEIGHT + matExt() * 0.5) * 4 * u * (1 - u)
        if (u >= 1 && s.short && !isIntruder(s)) {
          // Landed on the mat.
          s.short = false
          s.z = 0
          popup(s.x, s.y - 24, 'SUR LA MOUSSE', P.orange, 0.8)
          fall(s)
        } else if (u >= 1) {
          s.state = isIntruder(s) ? 'roll' : 'land'
          s.crossed = true
          s.t = 0
          s.z = 0
          audio.land()
          particles.push({ x: s.x - 3, y: s.y - 1, vx: -20, vy: -10, life: 0.3, born: now, colour: P.asphaltLight, g: 0 })
        }
      } else if (s.state === 'land') {
        s.t += dt
        s.x += s.vx * dt
        s.vx = Math.max(32, s.vx - 12 * dt)
        s.anim += dt * 3
      } else if (s.state === 'fall') {
        s.t += dt
        s.x += s.vx * dt
        if (s.t < 0.75) {
          // Roulé-boulé: a few quarter turns while bouncing.
          s.rot = Math.floor(s.t * 14) % 4
          s.z = Math.abs(Math.sin(s.t * 9)) * s.bounce * (1 - s.t / 0.75)
        } else {
          s.rot = s.slideRot
          s.z = 0
          s.vx = Math.max(26, s.vx - 22 * dt)
          if (random() < dt * 10) particles.push({ x: s.x - 4, y: s.y - 1, vx: -10, vy: -8, life: 0.25, born: now, colour: P.asphaltLight, g: 0 })
        }
      }
    }
    skaters = skaters.filter((s) => s.x < W + 26)

    for (const p of pigeons) {
      p.t += dt
      if (G && p.state !== 'flee' && G.t >= p.leaveAt) {
        p.state = 'flee'
        p.vx = (random() < 0.5 ? -1 : 1) * (30 + random() * 50)
        p.vy = -60 - random() * 40
      }
      if (p.state === 'in') {
        const k = Math.max(0, Math.min(1, p.t / 1.1))
        p.x = p.tx + (1 - k) * 70
        p.y = p.ty - (1 - k) * (p.ty - 10)
        if (k >= 1) p.state = 'ground'
      } else if (p.state === 'hop') {
        const k = Math.min(1, p.t / 0.9)
        p.x = p.fx + (p.tx - p.fx) * k
        p.y = p.fy + (p.ty - p.fy) * k - Math.sin(k * Math.PI) * 22
        if (k >= 1) p.state = 'ground'
      } else if (p.state === 'flee') {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy -= 20 * dt
      }
    }
    pigeons = pigeons.filter((p) => p.state !== 'flee' || (p.y > -12 && p.x > -12 && p.x < W + 30))
    if (!G) pigeons = []

    for (const p of particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.g * dt
    }
    particles = particles.filter((p) => now - p.born < p.life)
    popups = popups.filter((p) => now - p.at < p.dur)
    bubbles = bubbles.filter((b) => now < b.until)
  }

  /* ---------- drawing helpers ---------- */
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }
  function outlined(x, y, w, h, fill, line = P.ink) {
    rect(x - 1, y - 1, w + 2, h + 2, line)
    rect(x, y, w, h, fill)
  }
  function pad(n, size) {
    return String(n).padStart(size, '0')
  }
  function big(text, cx, y, colour, shadow = P.ink) {
    ctx.save()
    ctx.translate(Math.round(cx), y)
    ctx.scale(2, 2)
    drawTextC(ctx, text, 0.5, 0.5, shadow)
    drawTextC(ctx, text, 0, 0, colour)
    ctx.restore()
  }

  /* ---------- static background (drawn once) ---------- */
  const bg = document.createElement('canvas')
  bg.width = W
  bg.height = H
  function paintBackground() {
    const b = bg.getContext('2d')
    const r = (x, y, w, h, c) => {
      b.fillStyle = c
      b.fillRect(Math.round(x), Math.round(y), w, h)
    }
    // Sky, bands of a summer afternoon.
    r(0, 0, W, 64, P.sky)
    r(0, 44, W, 20, P.skyLow)
    // Clouds.
    for (const [x, y] of [[30, 22], [190, 18], [282, 28]]) {
      r(x, y, 22, 4, P.white)
      r(x + 4, y - 3, 12, 3, P.white)
    }
    // The town hall with its flag and clock, a few houses and trees.
    r(140, 26, 64, 38, P.wall)
    r(136, 22, 72, 5, P.roof)
    r(164, 12, 16, 12, P.wall)
    r(162, 10, 20, 3, P.roof)
    r(169, 14, 6, 6, P.white)
    r(171, 16, 1, 3, P.ink)
    r(171, 16, 3, 1, P.ink)
    r(172, 0, 1, 10, P.ink)
    r(173, 1, 4, 2, '#2a62c9')
    r(173, 3, 4, 2, P.white)
    r(173, 5, 4, 2, P.red)
    for (let i = 0; i < 6; i++) r(144 + i * 10, 34, 5, 8, '#6a8fb5')
    for (let i = 0; i < 6; i++) r(144 + i * 10, 48, 5, 8, '#6a8fb5')
    drawText(b, 'MAIRIE', 161, 27, P.ink)
    for (const [x, w, h, roof] of [[4, 34, 26, '#b4553f'], [212, 30, 22, '#8b4a3a'], [276, 40, 28, '#b4553f']]) {
      r(x, 64 - h, w, h, P.wall)
      r(x - 2, 64 - h - 4, w + 4, 4, roof)
      r(x + 5, 64 - h + 6, 5, 6, '#6a8fb5')
      r(x + w - 10, 64 - h + 6, 5, 6, '#6a8fb5')
    }
    for (const x of [46, 120, 252]) {
      r(x + 3, 46, 3, 18, P.woodDark)
      r(x - 3, 30, 15, 18, P.grassDark)
      r(x - 1, 27, 11, 4, P.grassDark)
    }
    // Bunting.
    const flags = [P.red, P.yellow, '#2a62c9', P.green, P.white, P.orange]
    for (let x = 0, i = 0; x < W; x += 8, i++) {
      const y = 38 + Math.round(Math.sin(x / 40) * 2)
      r(x, y, 8, 1, P.ink)
      b.fillStyle = flags[i % flags.length]
      for (let k = 0; k < 4; k++) b.fillRect(x + 1 + k, y + 1 + k, 6 - k * 2, 1)
    }
    // Lawn behind the barriers.
    r(0, 64, W, 36, P.grass)
    // Track: asphalt with a white edge, slightly lighter far side.
    r(0, C.TRACK_TOP, W, C.TRACK_BOTTOM - C.TRACK_TOP, P.asphalt)
    r(0, C.TRACK_TOP, W, 4, P.asphaltDark)
    for (let i = 0; i < 160; i++) {
      const x = (i * 97) % W
      const y = C.TRACK_TOP + 5 + ((i * 53) % (C.TRACK_BOTTOM - C.TRACK_TOP - 6))
      r(x, y, 1, 1, i % 2 ? P.asphaltDark : P.asphaltLight)
    }
    r(0, C.TRACK_TOP + 3, W, 1, P.white)
    r(0, C.TRACK_BOTTOM - 2, W, 1, P.white)
    // Finish line: chequered, slanted across the track.
    for (let y = C.TRACK_TOP + 4; y < C.TRACK_BOTTOM - 2; y++) {
      const x = finishX(y)
      for (let k = 0; k < 3; k++) r(x + k * 2, y, 2, 1, (Math.floor((y - C.TRACK_TOP) / 2) + k) % 2 ? P.white : P.ink)
    }
    // Curb and lawn in front.
    for (let x = 0; x < W; x += 8) r(x, C.TRACK_BOTTOM, 8, 3, (x / 8) % 2 ? P.red : P.white)
    r(0, C.TRACK_BOTTOM + 3, W, H - C.TRACK_BOTTOM - 3, P.grass)
    // Sponsor boards along the front.
    const boards = [
      ['BOUCHERIE MOREAU', P.red, P.white],
      ['COMITÉ DES FÊTES', P.yellow, P.ink],
      ['GARAGE PATRICK', '#2a62c9', P.white],
      ['PISCINE MUNICIPALE', P.green, P.white],
      ['CRÉDIT COMMUNAL', P.white, P.ink],
    ]
    let x = -6
    for (const [text, fill, ink] of boards) {
      const w = textWidth(text) + 10
      r(x, 163, w, 15, P.ink)
      r(x + 1, 164, w - 2, 13, fill)
      drawText(b, text, x + 5, 166, ink)
      x += w + 2
    }
  }

  /* ---------- crowd and volunteers ---------- */
  const crowd = []
  {
    const rng = mulberry32(7)
    for (let row = 0; row < 2; row++)
      for (let x = 2 + row * 3; x < W; x += 7 + Math.floor(rng() * 3)) {
        if (x > 30 && x < 78) continue // the refreshment table
        if (x > 170 && x < 190) continue // RALENTIR
        if (x > 252 && x < 272) continue // announcer
        crowd.push({
          x,
          y: 74 + row * 5,
          skin: SKINS[Math.floor(rng() * SKINS.length)],
          hair: ['#3a2a1e', '#d8b25a', '#2a2a2a', '#9a4a2a', '#c9c9c9'][Math.floor(rng() * 5)],
          shirt: JERSEYS[Math.floor(rng() * JERSEYS.length)],
          phase: rng() * 6.28,
          shouter: rng() < 0.12,
        })
      }
  }
  function intensity() {
    return G ? G.phase / 4 : 0.1
  }
  function drawCrowd() {
    const k = intensity()
    for (const c of crowd) {
      const amp = 0.4 + k * 2 + cheer * 3
      let bob = Math.round(Math.max(0, Math.sin(now * (4 + k * 6) + c.phase)) * amp)
      // Ola: a wave of people standing up, arms high, running left to right.
      let wave = false
      if (G && G.t < G.olaUntil + 0.6) {
        const front = (((now - G.olaAt) * 0.8) % 1.3) - 0.15
        const d = Math.abs(c.x / W - front)
        if (d < 0.09) {
          wave = true
          bob = Math.round(8 * (1 - d / 0.09))
        }
      }
      const y = c.y - bob
      rect(c.x, y + 6, 6, 10, c.shirt)
      rect(c.x + 1, y, 4, 5, c.skin)
      rect(c.x + 1, y - 1, 4, 2, c.hair)
      if (wave) {
        rect(c.x, y - 6, 1, 6, c.skin)
        rect(c.x + 5, y - 6, 1, 6, c.skin)
      } else if ((c.shouter && k > 0.4) || cheer > 0.3) {
        rect(c.x + 2, y + 3, 2, 1, P.ink)
        rect(c.x - 1, y + 2 - bob, 1, 3, c.skin)
        rect(c.x + 6, y + 2 - bob, 1, 3, c.skin)
      }
    }
  }
  function drawBarriers() {
    for (let x = 0; x < W; x += 34) {
      rect(x, 86, 32, 2, P.barrier)
      rect(x, 98, 32, 1, P.barrier)
      for (let i = 1; i < 32; i += 3) rect(x + i, 88, 1, 10, P.barrierDark)
      rect(x, 86, 1, 14, P.barrierDark)
      rect(x + 31, 86, 1, 14, P.barrierDark)
      rect(x - 2, 99, 6, 1, P.barrierDark)
    }
  }
  function volunteer(x, y, arms) {
    // Feet at (x, y). Yellow-green vest, cap.
    rect(x - 2, y - 6, 2, 6, '#2a3a6a')
    rect(x + 1, y - 6, 2, 6, '#2a3a6a')
    rect(x - 3, y - 15, 7, 9, P.vest)
    rect(x - 3, y - 11, 7, 1, '#c9c9c9')
    rect(x - 2, y - 20, 5, 5, SKINS[0])
    rect(x - 3, y - 21, 6, 2, P.red)
    rect(x + 2, y - 20, 2, 1, P.red)
    rect(x + 1, y - 18, 1, 1, P.ink)
    if (arms) arms()
  }
  function drawVolunteers() {
    // Refreshment table with cups, a volunteer holding one out to nobody in particular.
    rect(34, 92, 38, 3, P.white)
    rect(36, 95, 2, 8, P.woodDark)
    rect(68, 95, 2, 8, P.woodDark)
    for (let i = 0; i < 7; i++) rect(37 + i * 5, 89, 2, 3, i % 3 === 0 ? '#2a62c9' : P.white)
    outlined(36, 79, 26, 8, P.white, P.red)
    drawText(ctx, 'RAVITO', 38, 79, P.red)
    volunteer(67, 92, () => {
      const reach = Math.round(Math.sin(now * 2) + 1)
      rect(69, 79, 3 + reach, 1, SKINS[0])
      rect(72 + reach, 77, 2, 3, P.white)
    })
    // RALENTIR: waved with total conviction, to no effect.
    const k = intensity()
    const wave = Math.round(Math.sin(now * (3 + k * 10)) * (1 + k * 2))
    volunteer(180, 100, () => {
      rect(182, 84, 1, 4, SKINS[0])
      rect(182 + wave, 70, 1, 15, P.woodDark)
    })
    const sx = 165 + wave
    outlined(sx, 62, 35, 9, P.white, P.red)
    drawText(ctx, 'RALENTIR', sx + 2, 62, P.red)
    // The announcer with the megaphone.
    volunteer(262, 100, () => {
      rect(264, 84, 3, 1, SKINS[0])
      rect(266, 82, 3, 4, P.white)
      rect(269, 81, 2, 6, P.white)
      rect(266, 83, 3, 1, P.red)
    })
  }

  /* ---------- the mat (the boss) ---------- */
  function drawZone() {
    // Painted line where the jump zone begins; red tape across the zone during a FAUX DÉPART.
    const locked = G && state === 'PLAYING' && G.t < G.lockedUntil
    for (let y = C.TRACK_TOP + 6; y < C.TRACK_BOTTOM - 3; y += 3) {
      rect(matX(y) - C.ZONE, y, 1, 2, locked ? P.red : 'rgba(255,255,255,0.35)')
      if (locked && Math.floor(now * 10) % 2) rect(matX(y) - C.ZONE + 1, y, C.ZONE - 1, 1, 'rgba(226,59,59,0.35)')
    }
  }
  function drawMat() {
    // The extension is a yellow municipal foam slab added in front of the blue mat.
    const ext = Math.round(matExt())
    for (let y = C.TRACK_TOP + 6; y < C.TRACK_BOTTOM - 3; y++) {
      const x = matX(y)
      if (ext > 0) {
        rect(x, y, ext, 1, (y & 3) === 0 ? '#d9a92a' : P.yellow)
        rect(x + ext - 1, y, 1, 1, '#b8861e')
      }
      rect(x + ext, y, C.MAT_W, 1, (y & 3) === 0 ? P.mat : P.matTop)
      rect(x - 1, y, 1, 1, ext > 0 ? '#b8861e' : P.matSide)
    }
    const yb = C.TRACK_BOTTOM - 3
    rect(matX(yb) - 1, yb, matW() + 1, 2, ext > 0 ? '#b8861e' : P.matSide)
  }

  /* ---------- arch ---------- */
  function drawArchBack() {
    const x = finishX(C.TRACK_TOP + 2) - 4
    rect(x, 30, 4, C.TRACK_TOP + 2 - 30, P.red)
    for (let y = 34; y < C.TRACK_TOP; y += 8) rect(x, y, 4, 3, P.white)
  }
  function drawArchFront() {
    const x = finishX(C.TRACK_BOTTOM - 2) + 6
    rect(x, 30, 5, C.TRACK_BOTTOM - 30, P.red)
    for (let y = 34; y < C.TRACK_BOTTOM - 4; y += 8) rect(x, y, 5, 3, P.white)
    // Banner across, face on: ARRIVÉE and the sponsor.
    const bx = 74
    rect(bx, 16, 66, 26, P.ink)
    rect(bx + 1, 17, 64, 24, P.red)
    rect(bx + 1, 33, 64, 8, P.yellow)
    big('ARRIVÉE', bx + 33, 18, P.white)
    drawTextC(ctx, 'GARAGE PATRICK', bx + 33, 33, P.ink)
  }

  /* ---------- skaters ---------- */
  function part(ox, oy, rot, lx, ly, w, h, c) {
    // Rotation by quarter turns around a pivot 9 px above the feet, so it stays crisp.
    const py = -9
    ly -= py
    let x, y, ww = w, hh = h
    if (rot === 1) {
      x = -(ly + h)
      y = lx
      ww = h
      hh = w
    } else if (rot === 2) {
      x = -(lx + w)
      y = -(ly + h)
    } else if (rot === 3) {
      x = ly
      y = -(lx + w)
      ww = h
      hh = w
    } else {
      x = lx
      y = ly
    }
    ctx.fillStyle = c
    ctx.fillRect(ox + x, oy + py + y, ww, hh)
  }
  function poseFor(s) {
    const f = Math.floor(s.anim) % 4
    // DÉBUTANT braking: windmilling arms, legs locked in a T-stop.
    if (s.state === 'roll' && s.braking > 0) return [Math.floor(now * 10) % 2 ? ARMS_UP : ARMS_STAR, LEGS_STRIDE, HEAD_PANIC, -1]
    const panic = s.x >= matX(s.y) - C.ZONE - 14
    if (s.state === 'roll' && s.kind === 'fast' && !panic) return [ARMS_STIFF, f % 2 ? LEGS_STRIDE : LEGS_TOGETHER, HEAD, 2]
    if (s.state === 'roll' && s.kind === 'slow' && !panic) return [ARMS_STAR, f % 2 ? LEGS_STRIDE : LEGS_TOGETHER, HEAD, 0]
    if (s.state === 'jump') return [ARMS_STIFF, LEGS_TOGETHER, HEAD, 0]
    if (s.state === 'land') return [f % 2 ? ARMS_UP : ARMS_UP_B, LEGS_TOGETHER, HEAD, 0]
    if (s.state === 'fall') return [ARMS_STAR, LEGS_STAR, HEAD_PANIC, 0]
    // Panic in the jump zone: arms up, eyes wide. That is the tell.
    if (s.x >= matX(s.y) - C.ZONE - 14) return [Math.floor(now * 12 + s.id) % 2 ? ARMS_UP : ARMS_UP_B, f % 2 ? LEGS_STRIDE : LEGS_TOGETHER, HEAD_PANIC, 1]
    return [f % 2 ? ARMS_SWING : ARMS_SWING_B, f % 2 ? LEGS_STRIDE : LEGS_TOGETHER, HEAD, 1]
  }
  const REST = [0, 4, -2, 4]
  const INTRUDER_COLOURS = {
    U: '#2b2f4a',
    G: '#c9c9c9',
    b: '#2a62c9',
    w: P.white,
    r: P.red,
    C: '#9a6a3a',
    c: '#6a4424',
    P: '#7f5ae0',
    O: P.orange,
    A: '#5a9a8a',
    D: '#3a4f7a',
  }
  function drawIntruder(s) {
    const f = Math.floor(s.anim) % 2
    const shadowW = s.kind === 'poussette' ? 18 : s.kind === 'chien' ? 9 : 8
    rect(s.x - (s.kind === 'poussette' ? 16 : 4), s.y - 1, shadowW, 2, 'rgba(20,24,34,0.35)')
    const ox = Math.round(s.x)
    const oy = Math.round(s.y - s.z + (s.state === 'fall' && s.t >= 0.75 ? REST[s.rot] : 0))
    const up = s.state === 'jump' || s.state === 'fall'
    let lists
    if (s.kind === 'maire') lists = [f ? WALK_A : WALK_B, MAIRE, up ? MAIRE_ARMS_UP : MAIRE_ARMS]
    else if (s.kind === 'chien') lists = [up ? CHIEN_B : f ? CHIEN_A : CHIEN_B, CHIEN]
    else if (s.kind === 'poussette') lists = [f ? POUSSETTE_A : POUSSETTE_B, POUSSETTE]
    else lists = [f ? WALK_A : WALK_B, SECOURISTE, up ? MAIRE_ARMS_UP : []]
    const colour = (k) => INTRUDER_COLOURS[k] || (k === 'K' ? SKATE : k === 'E' ? P.ink : k === 'W' ? P.white : k === 'S' ? s.look.S : s.look[k])
    for (const list of lists) for (const [x, y, w, h, k] of list) part(ox, oy, s.rot, x, y, w, h, colour(k))
    // A little warning triangle above intruders while they walk towards the mat.
    if (s.state === 'roll' && !s.crossed && s.x > finishX(s.y) - 20 && Math.floor(now * 4) % 2) {
      const tx = ox - (s.kind === 'poussette' ? 8 : 0)
      const ty = oy - (s.kind === 'chien' ? 14 : 27)
      rect(tx, ty, 1, 1, P.red)
      rect(tx - 1, ty + 1, 3, 1, P.red)
      rect(tx - 2, ty + 2, 5, 1, P.red)
      rect(tx, ty + 1, 1, 1, P.yellow)
    }
  }
  function drawSkater(s) {
    if (isIntruder(s)) return drawIntruder(s)
    const shadowW = s.z > 6 ? 5 : 8
    rect(s.x - shadowW / 2, s.y - 1, shadowW, 2, 'rgba(20,24,34,0.35)')
    const ox = Math.round(s.x)
    const oy = Math.round(s.y - s.z + (s.state === 'fall' && s.t >= 0.75 ? REST[s.rot] : 0))
    const rot = s.rot
    const [arms, legs, head, lean] = poseFor(s)
    const colour = (k) =>
      k === 'K' ? SKATE : k === 'R' ? WHEEL : k === 'E' ? P.ink : k === 'W' ? P.white : k === 'M' ? P.redDark : k === 'B' ? P.white : s.look[k]
    const draw = (list, dx = 0) => {
      for (const [x, y, w, h, k] of list) part(ox, oy, rot, x + dx, y, w, h, colour(k))
    }
    if (s.kind === 'fast' && s.state === 'roll') {
      // FUSÉE: speed lines behind and a pointed aero helmet.
      rect(ox - 10 - (Math.floor(now * 20) % 3), oy - 14, 4, 1, P.white)
      rect(ox - 12 - (Math.floor(now * 20 + 1) % 3), oy - 9, 5, 1, P.white)
    }
    draw(legs)
    draw(TORSO, lean)
    if (s.look.bib) draw(BIB, lean)
    draw(arms, lean)
    draw(head, lean)
    if (s.kind === 'fast' && s.state === 'roll') part(ox, oy, rot, lean - 5, -19, 2, 1, s.look.H)
    if (s.kind === 'slow' && s.state === 'roll') part(ox, oy, rot, lean - 2, -17, 1, 2, '#d8d8d8')
    if (s.kind === 'hesitant' && s.state !== 'fall') {
      // DÉBUTANT: white knee and elbow pads; a question mark while braking.
      part(ox, oy, rot, -2, -5, 1, 1, P.white)
      part(ox, oy, rot, 1, -5, 1, 1, P.white)
      if (s.braking > 0) drawText(ctx, '?', ox - 1, oy - 30, P.yellow)
    }
  }

  /* ---------- pigeons, photographer, fire engine ---------- */
  function drawPigeons() {
    for (const p of pigeons) {
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      if (p.state === 'ground') {
        const peck = Math.floor(now * 3 + p.tx) % 3 === 0
        rect(x - 2, y - 3, 5, 3, '#8a8f99')
        rect(x - 3, y - 3, 1, 1, '#6b707a')
        rect(x + 2, y - (peck ? 2 : 5), 2, 2, '#5b6b7a')
        rect(x + 4, y - (peck ? 1 : 4), 1, 1, P.orange)
        rect(x, y, 1, 1, P.orange)
      } else {
        const flap = Math.floor(now * 14 + p.tx) % 2
        rect(x - 2, y - 2, 5, 2, '#8a8f99')
        rect(x - 1, y - (flap ? 5 : 0), 3, flap ? 3 : 2, '#6b707a')
        rect(x + 3, y - 3, 1, 1, '#5b6b7a')
      }
    }
  }
  function drawPhotographer() {
    const ph = G && G.photo
    if (!ph) return
    const base = 208
    const x =
      ph.phase === 'in' ? Math.round(W + 10 - (W + 10 - base) * Math.min(1, ph.t / 0.5)) : ph.phase === 'out' ? Math.round(base + (W + 10 - base) * (ph.t / 0.5)) : base
    const y = 178
    rect(x - 2, y - 8, 2, 8, '#3a3a44')
    rect(x + 1, y - 8, 2, 8, '#3a3a44')
    rect(x - 3, y - 18, 7, 10, '#c9b48a')
    drawText(ctx, 'PRESSE', x - 11, y - 30, P.white)
    rect(x - 2, y - 24, 5, 6, SKINS[1])
    rect(x - 3, y - 25, 6, 2, '#3a2a1e')
    // Camera held up towards the track, with the red light blinking while aiming.
    rect(x - 7, y - 23, 6, 4, P.ink)
    rect(x - 8, y - 22, 2, 2, '#4a5a6e')
    rect(x - 6, y - 25, 3, 2, P.white)
    if (ph.phase === 'aim' && Math.floor(now * 8) % 2) rect(x - 3, y - 23, 1, 1, P.red)
  }
  function drawFlash() {
    if (!G) return
    const t = now - G.flashAt
    if (t < 0 || t > C.PHOTO_FLASH) return
    const a = t < 0.3 ? 1 : 1 - (t - 0.3) / (C.PHOTO_FLASH - 0.3)
    rect(0, 13, W, H - 13, `rgba(255,255,255,${a.toFixed(2)})`)
  }
  function drawTruck() {
    const tr = G && G.truck
    if (!tr || tr.state === 'done') return
    if (tr.state === 'warn') {
      // Blue lights and PIN-PON at the left edge before it comes in.
      if (Math.floor(now * 6) % 2) rect(0, 120, 4, 14, '#3a7bff')
      drawText(ctx, 'PIN-PON !', 6, 116, Math.floor(now * 6) % 2 ? P.red : P.white)
      return
    }
    const front = Math.round(tr.x)
    const base = Math.round(C.LANE_BOTTOM + 6 - tr.z)
    const back = front - C.TRUCK_LEN
    rect(back + 2, C.LANE_BOTTOM + 5, C.TRUCK_LEN, 3, 'rgba(20,24,34,0.35)')
    rect(back, base - 28, C.TRUCK_LEN, 24, P.red)
    rect(back, base - 16, C.TRUCK_LEN, 2, P.white)
    rect(front - 14, base - 34, 14, 8, P.red)
    rect(front - 11, base - 32, 9, 5, '#9fd3ee')
    rect(back + 2, base - 32, 38, 2, P.grey)
    for (let i = 0; i < 38; i += 4) rect(back + 2 + i, base - 34, 1, 4, P.grey)
    rect(front - 10, base - 37, 4, 3, Math.floor(now * 8) % 2 ? '#3a7bff' : '#1a3f88')
    drawText(ctx, 'POMPIERS', back + 6, base - 27, P.white)
    for (const wx of [back + 8, front - 12]) {
      rect(wx - 3, base - 5, 7, 6, P.ink)
      rect(wx - 1, base - 3, 3, 2, P.grey)
    }
  }

  /* ---------- overlays ---------- */
  function drawBubbles() {
    for (const b of bubbles) {
      const w = textWidth(b.text) + 6
      const x = Math.max(2, Math.min(W - w - 2, Math.round(b.x - w / 2)))
      const y = Math.round(b.y - 10)
      outlined(x, y, w, 9, P.white)
      rect(Math.round(b.x), y + 9, 2, 2, P.white)
      drawText(ctx, b.text, x + 3, y, P.ink)
    }
  }
  function drawPopups() {
    for (const p of popups) {
      const k = (now - p.at) / p.dur
      const y = Math.round(p.y - k * 10)
      drawTextC(ctx, p.text, p.x + 1, y + 1, P.ink)
      drawTextC(ctx, p.text, p.x, y, p.colour)
    }
  }
  function drawNote() {
    if (!G || !G.note) return
    const t = now - G.note.at
    const w = textWidth(G.note.text) + 26
    const x = Math.round(W / 2 - w / 2)
    const y = 17 + (t < 0.08 ? -3 : 0)
    outlined(x, y, w, 11, P.paper)
    drawText(ctx, G.note.text, x + 22, y + 1, G.note.colour)
    // A tiny municipal stamp.
    rect(x + 3, y + 2, 15, 7, P.stamp)
    rect(x + 4, y + 3, 13, 5, P.paper)
    drawText(ctx, 'OK', x + 7, y + 1, P.stamp)
  }
  const SOUND_BTN = { x: W - 20, y: 1, w: 18, h: 11 }
  function drawSoundButton() {
    const b = SOUND_BTN
    rect(b.x, b.y, b.w, b.h, '#2f4054')
    rect(b.x + 3, b.y + 4, 3, 3, P.white)
    rect(b.x + 6, b.y + 2, 2, 7, P.white)
    if (audio.muted) {
      rect(b.x + 11, b.y + 3, 1, 5, P.red)
      rect(b.x + 10, b.y + 4, 3, 1, P.red)
      rect(b.x + 10, b.y + 6, 3, 1, P.red)
    } else {
      rect(b.x + 10, b.y + 4, 1, 3, P.white)
      rect(b.x + 12, b.y + 3, 1, 5, P.white)
      rect(b.x + 14, b.y + 2, 1, 7, P.white)
    }
  }
  function drawHud() {
    rect(0, 0, W, 13, P.ink)
    if (G) {
      drawText(ctx, 'SCORE ' + pad(G.score, 6), 4, 2, P.white)
      const mult = '×' + C.MULTS[G.level]
      drawText(ctx, mult, 72, 2, G.level ? P.yellow : P.white)
      // Progress pips toward the next multiplier.
      if (G.level < C.LEVELS.length - 1) {
        const from = C.LEVELS[G.level]
        const to = C.LEVELS[G.level + 1]
        const k = (G.chain - from) / (to - from)
        rect(84, 5, 30, 3, '#2f4054')
        rect(84, 5, Math.round(30 * k), 3, P.yellow)
      } else drawText(ctx, 'MAX', 84, 2, P.yellow)
      drawText(ctx, 'SÉRIE ' + G.combo, 122, 2, P.white)
      if (G.t < G.olaUntil) {
        if (Math.floor(now * 4) % 2) drawText(ctx, 'OLA : POINTS ×2', 166, 2, P.yellow)
      } else if (G.precision > 1) drawText(ctx, 'PRÉCISION ×' + Math.min(C.PRECISION_CAP, G.precision) + ' (OLA ' + (G.precision % C.OLA_EVERY) + '/' + C.OLA_EVERY + ')', 166, 2, P.yellow)
      const left = Math.max(0, Math.ceil(C.RUN_DURATION - G.t))
      const clock = Math.floor(left / 60) + ':' + pad(left % 60, 2)
      drawText(ctx, clock, W - 42, 2, left <= 10 && Math.floor(now * 4) % 2 ? P.red : P.white)
    } else drawText(ctx, best > 0 ? 'RECORD ' + pad(best, 6) : 'COURSE DES 10 KM · ÉDITION 2026', 4, 2, P.white)
    drawSoundButton()
  }

  function drawScene() {
    ctx.save()
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake))
    ctx.drawImage(bg, 0, 0)
    drawCrowd()
    drawBarriers()
    drawArchBack()
    drawVolunteers()
    drawZone()
    drawMat()
    const sorted = [...skaters].sort((a, b) => a.y - b.y)
    for (const s of sorted) drawSkater(s)
    drawPigeons()
    drawTruck()
    for (const p of particles) rect(p.x, p.y, 2, 2, p.colour)
    drawArchFront()
    drawPhotographer()
    ctx.restore()
    drawFlash()
    drawPopups()
    drawBubbles()
  }

  function drawTitle() {
    drawScene()
    rect(40, 48, 240, 50, 'rgba(29,42,58,0.9)')
    big('ATTENTION À LA MOUSSE !', 160, 52, P.yellow)
    drawTextC(ctx, '10 KILOMÈTRES D’EFFORT. 20 CENTIMÈTRES DE CATASTROPHE.', 160, 72, P.white)
    if (Math.floor(now * 1.5) % 2) drawTextC(ctx, pointerTouch ? 'TAPOTE POUR DONNER LE DÉPART' : 'ESPACE POUR DONNER LE DÉPART', 160, 85, P.yellow)
    drawHud()
  }

  function drawPlaying() {
    drawScene()
    if (G.banner) {
      const t = now - G.banner.at
      if (t < 2.6) {
        rect(0, 56, W, 22, Math.floor(t * 8) % 2 ? P.red : P.ink)
        big(G.banner.text, 160, 60, P.yellow)
      } else G.banner = null
    }
    if (G.over) {
      rect(0, 56, W, 22, P.ink)
      big('FIN DE L’ÉPREUVE', 160, 60, P.white)
    }
    if (G.t < 7 && !G.over && Math.floor(now * 2) % 2)
      drawTextC(ctx, pointerTouch ? 'UN TAP QUAND ILS PANIQUENT. PAS AVANT.' : 'ESPACE QUAND ILS PANIQUENT. PAS AVANT.', 160, 150, P.yellow)
    drawNote()
    drawHud()
    if (paused) {
      rect(0, 0, W, H, 'rgba(29,42,58,0.7)')
      big('PAUSE', 160, 70, P.white)
      drawTextC(ctx, pointerTouch ? 'TAPOTE POUR REPRENDRE' : 'ESPACE POUR REPRENDRE', 160, 92, P.yellow)
    }
  }

  function drawResults() {
    drawScene()
    rect(30, 20, 260, 146, 'rgba(29,42,58,0.94)')
    rect(30, 20, 260, 1, P.yellow)
    rect(30, 165, 260, 1, P.yellow)
    const since = now - stateAt
    big('L’ORGANISATION PARLE', 160, 26, P.white)
    big('D’UN SUCCÈS.', 160, 42, P.white)
    const lines = [
      ['SCORE', pad(G.score, 6), P.yellow],
      ['MEILLEUR COMBO', String(G.bestCombo), P.white],
      ['SAUVÉS', String(G.saved), P.white],
      ['VICTIMES DE LA MOUSSE', String(G.victims), P.red],
      ['SAUTS PARFAITS', String(G.perfects), P.white],
      ['OLAS', String(G.olas), P.white],
      ['SCANDALES', String(G.scandals), G.scandals ? P.red : P.white],
      ['FAUX DÉPARTS', String(G.falseStarts), P.white],
      ['ÉVACUÉS PAR LES POMPIERS', String(G.evacuated), P.white],
    ]
    lines.forEach(([label, value, colour], i) => {
      if (since < 0.2 + i * 0.15) return
      const y = 58 + i * 8
      drawText(ctx, label, 56, y, P.grey)
      drawText(ctx, value, 264 - textWidth(value), y, colour)
      for (let x = 56 + textWidth(label) + 4; x < 260 - textWidth(value); x += 3) rect(x, y + 6, 1, 1, '#4a5a6e')
    })
    if (since > 1.2) {
      const verdict = G.victims === 0 ? 'AUCUN INCIDENT. LE TAPIS EST DÉÇU.' : G.victims + ' DOSSIERS TRANSMIS À L’ASSURANCE.'
      drawTextC(ctx, verdict, 160, 132, P.white)
      drawTextC(ctx, G.newRecord ? 'NOUVEAU RECORD !' : 'RECORD : ' + pad(best, 6), 160, 142, G.newRecord ? P.yellow : P.grey)
    }
    if (since > C.RESULTS_LOCK && Math.floor(now * 1.5) % 2)
      drawTextC(ctx, pointerTouch ? 'TAPOTE : RECOMMENCER' : 'ESPACE : RECOMMENCER', 160, 154, P.yellow)
    drawHud()
  }

  function draw() {
    if (state === 'TITLE') return drawTitle()
    if (state === 'RESULTS') return drawResults()
    drawPlaying()
  }

  function frame(ts) {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (ts - lastFrame) / 1000)
    lastFrame = ts
    update(dt)
    draw()
  }

  /* ---------- input ---------- */
  function input(action, payload) {
    if (destroyed) return
    if (action === 'pointer' && payload) {
      pointerTouch = !!payload.touch
      if (payload.type === 'down') {
        const b = SOUND_BTN
        if (payload.x >= b.x && payload.x < b.x + b.w && payload.y >= b.y && payload.y < b.y + b.h + 4) {
          toggleMute()
          return
        }
        // Every new finger is a new press: two thumbs can alternate in the crowd. A finger held
        // down never fires again, so holding still does nothing.
        if (payload.touch) needRelease = false
        press()
      } else if (payload.type === 'up') release()
      return
    }
    if (action === 'press') {
      if (payload?.down === false) release()
      else press()
      return
    }
    if (action === 'mute') toggleMute()
  }
  function toggleMute() {
    audio.setMuted(!audio.muted)
    save('muted', audio.muted)
  }

  function pause() {
    if (paused || state !== 'PLAYING') return
    paused = true
    audio.music(false)
    audio.hush()
  }
  function resume() {
    if (!paused) return
    paused = false
    lastFrame = performance.now()
  }
  function onVisibility() {
    if (document.hidden) pause()
  }
  document.addEventListener('visibilitychange', onVisibility)
  // Music comes back with the first frame after a resume.
  const musicWatch = setInterval(() => {
    if (!paused && state === 'PLAYING' && G && !G.over) audio.music(true)
  }, 250)

  async function start() {
    await audio.resume()
  }
  function stop() {
    G = null
    skaters = []
    audio.music(false)
    audio.hush()
    setState('TITLE')
  }
  function destroy() {
    destroyed = true
    cancelAnimationFrame(raf)
    clearInterval(musicWatch)
    audio.music(false)
    audio.hush()
    document.removeEventListener('visibilitychange', onVisibility)
  }

  paintBackground()
  setState('TITLE')
  raf = requestAnimationFrame(frame)
  return {
    start,
    input,
    pause,
    resume,
    stop,
    destroy,
    unlock: () => audio.resume(),
    get state() {
      return paused ? 'paused' : state === 'TITLE' ? 'idle' : state === 'RESULTS' ? 'over' : 'playing'
    },
    get debug() {
      return debug ? { state, G, skaters, matX, C } : null
    },
  }
}

/* A two-minute run brings a few hundred skaters at most (see WAVES). */
const MAX_SKATERS = 1500
// ×2 during an ola.
const MAX_PER_SAVE = (CONFIG.SAVE_POINTS + CONFIG.PERFECT_BONUS * CONFIG.PRECISION_CAP) * CONFIG.MULTS[CONFIG.MULTS.length - 1] * 2

export function validate(result) {
  if (!result || typeof result !== 'object') return false
  const d = result.details
  const values = [result.score, d?.saved, d?.victims, d?.perfects, d?.bestCombo, d?.bestPrecision, d?.biggestJump]
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false
  if (d.saved + d.victims > MAX_SKATERS) return false
  if (d.perfects > d.saved || d.bestCombo > d.saved || d.biggestJump > d.saved) return false
  if (d.bestPrecision > d.saved) return false
  if (result.score > d.saved * MAX_PER_SAVE) return false
  if (d.saved > 0 && result.score < d.saved * CONFIG.SAVE_POINTS) return false
  return true
}

export function grade(result) {
  const s = result.score
  return s >= 500000 ? 'S' : s >= 250000 ? 'A' : s >= 120000 ? 'B' : s >= 50000 ? 'C' : 'D'
}
