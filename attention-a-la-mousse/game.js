import { createAudio } from './audio.js'
import { drawText, drawTextC, textWidth } from './font.js'

/*
 * ATTENTION À LA MOUSSE ! — « 10 kilomètres d'effort. 20 centimètres de catastrophe. »
 *
 * Skaters cross the finish line of a small municipal 10 km and meet a tiny foam mat. One
 * press of Space makes every skater inside the short zone just before the mat jump; too
 * early nobody jumps, too late it is a roulé-boulé. Two minutes, from three Sunday athletes
 * to a migration of rollers. No elimination.
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
  JUMP_HEIGHT: 15,
  JUMP_MIN: 0.45,
  SPAWN_X: -14,
  // Score.
  SAVE_POINTS: 100,
  PERFECT_BONUS: 50,
  PRECISION_CAP: 5,
  LEVELS: [0, 5, 15, 30, 60],
  MULTS: [1, 2, 3, 5, 8],
  // Waves, by arrival time at the mat. size/gap/spacing/speed are [min, max]; spacing is px
  // between rows of a group, `abreast` skaters per row, `vary` the individual speed spread.
  WAVES: [
    { until: 20, size: [1, 1], gap: [2.3, 3.0], spacing: [0, 0], speed: [42, 46], abreast: 1, vary: 0 },
    { until: 45, size: [2, 3], gap: [2.3, 3.0], spacing: [7, 12], speed: [44, 50], abreast: 1, vary: 0.5 },
    { until: 75, size: [3, 5], gap: [1.9, 2.6], spacing: [5, 11], speed: [40, 62], abreast: 2, vary: 1.5 },
    { until: 105, size: [5, 10], gap: [1.5, 2.1], spacing: [4, 8], speed: [46, 64], abreast: 2, vary: 2.5 },
    { until: Infinity, size: [16, 28], gap: [1.0, 1.5], spacing: [3, 5], speed: [54, 66], abreast: 4, vary: 2.5 },
  ],
  BREATHER_EVERY: [4, 6],
  BREATHER_FACTOR: 1.9,
  FIRST_ARRIVAL: 3.2,
  // The announcer says it on the first arrival, then more and more often.
  VOICE_INTERVAL: [7, 1.6],
}

const PHASE_NOTES = [
  null,
  'ARRIVÉES GROUPÉES SIGNALÉES',
  'AFFLUENCE CONSTATÉE',
  'FOULE NON DÉCLARÉE EN PRÉFECTURE',
  'LE PELOTON DU DIMANCHE',
]
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
  const matX = (y) => C.MAT_X + (y - C.TRACK_TOP) * C.SLANT
  const finishX = (y) => C.FINISH_X + (y - C.TRACK_TOP) * C.SLANT

  /* ---------- persistence ---------- */
  function load(key, fallback) {
    try {
      const v = localStorage.getItem('attentionALaMousse:' + key)
      return v === null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem('attentionALaMousse:' + key, JSON.stringify(value))
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
      members.push({ behind: row * spacing + (w.abreast > 1 ? random() * 3 : 0), y, v: speed + (random() * 2 - 1) * w.vary })
    }
    const span = (Math.ceil(n / w.abreast) - 1) * spacing
    return { arrival, speed, members, span, gap: rand(w.gap) }
  }

  function spawnDue() {
    let g = G.nextGroup
    while (g && G.t >= g.arrival - (zoneMid() - C.SPAWN_X) / g.speed) {
      const lead = zoneMid() - g.speed * (g.arrival - G.t)
      for (const m of g.members) skaters.push(makeSkater(lead - m.behind, m.y, m.v))
      let gap = g.gap
      if (--G.breatherIn <= 0) {
        gap *= C.BREATHER_FACTOR
        G.breatherIn = randInt(C.BREATHER_EVERY)
      }
      const next = g.arrival + g.span / g.speed + gap
      g = G.nextGroup = next < C.RUN_DURATION - 0.4 ? planGroup(next) : null
    }
  }

  function makeSkater(x, y, v) {
    return {
      id: nextId++,
      x,
      y,
      vx: v,
      z: 0,
      t: 0,
      anim: random() * 4,
      state: 'roll', // roll | jump | land | fall
      rot: 0,
      slideRot: 1,
      jumpT: 1,
      announced: false,
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
    const jumpers = skaters.filter((s) => s.state === 'roll' && s.x >= matX(s.y) - C.ZONE)
    if (!jumpers.length) {
      // Too early (or nobody at all): nobody jumps, the precision streak breaks, no points lost.
      G.emptyPresses++
      G.precision = 0
      audio.whiff()
      popup(matX(C.LANE_TOP) - C.ZONE - 6, C.LANE_TOP - 26, 'TROP TÔT', P.white, 0.5)
      return
    }
    const anyPerfect = jumpers.some((s) => s.x >= matX(s.y) - C.PERFECT)
    G.precision = anyPerfect ? G.precision + 1 : 0
    G.bestPrecision = Math.max(G.bestPrecision, G.precision)
    for (const s of jumpers) {
      const perfect = s.x >= matX(s.y) - C.PERFECT
      const mult = C.MULTS[G.level]
      // PARFAIT pays 50, times the precision streak (capped), times the multiplier.
      const bonus = perfect ? C.PERFECT_BONUS * Math.min(C.PRECISION_CAP, G.precision) : 0
      const points = (C.SAVE_POINTS + bonus) * mult
      G.score += points
      G.saved++
      G.combo++
      G.bestCombo = Math.max(G.bestCombo, G.combo)
      G.chain++
      if (perfect) G.perfects++
      s.state = 'jump'
      s.t = 0
      s.perfect = perfect
      const landX = matX(s.y) + C.MAT_W + C.LAND_AFTER
      s.jumpT = Math.max(C.JUMP_MIN, (landX - s.x) / s.vx)
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
    while (G.milestone < SAVE_MILESTONES.length && G.saved >= SAVE_MILESTONES[G.milestone]) {
      notify(SAVE_MILESTONES[G.milestone] + ' FRACTURES ÉVITÉES', P.ink)
      G.milestone++
    }
    audio.jump(jumpers.length, anyPerfect)
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
    shake = 0
    cheer = 0
    audio.setIntensity(0)
    audio.music(true)
    audio.whistle()
    setState('PLAYING')
  }

  function fall(s) {
    s.state = 'fall'
    s.t = 0
    s.slideRot = pick([1, 1, 3, 3, 2])
    s.vx = Math.max(s.vx, 40) * (1.05 + random() * 0.25)
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
      if (!G.over) spawnDue()
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
        s.x += s.vx * dt
        s.anim += (s.vx * dt) / 7
        // The announcer: on the first arrival, then whenever a group passes the arch.
        if (!s.announced && s.x >= finishX(s.y) + 10) {
          s.announced = true
          if (G && !G.over) announce(!G.voiced)
          if (G) G.voiced = true
        }
        if (s.x >= matX(s.y) - 1) fall(s)
      } else if (s.state === 'jump') {
        s.t += dt
        s.x += s.vx * dt
        const u = Math.min(1, s.t / s.jumpT)
        s.z = C.JUMP_HEIGHT * 4 * u * (1 - u)
        if (u >= 1) {
          s.state = 'land'
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
          s.z = Math.abs(Math.sin(s.t * 9)) * 7 * (1 - s.t / 0.75)
        } else {
          s.rot = s.slideRot
          s.z = 0
          s.vx = Math.max(26, s.vx - 22 * dt)
          if (random() < dt * 10) particles.push({ x: s.x - 4, y: s.y - 1, vx: -10, vy: -8, life: 0.25, born: now, colour: P.asphaltLight, g: 0 })
        }
      }
    }
    skaters = skaters.filter((s) => s.x < W + 26)

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
    // Painted deceleration zone: a dashed line where the jump zone begins (subtle).
    for (let y = C.TRACK_TOP + 6; y < C.TRACK_BOTTOM - 3; y += 3) r(matX(y) - C.ZONE, y, 1, 2, 'rgba(255,255,255,0.35)')
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
      const bob = Math.round(Math.max(0, Math.sin(now * (4 + k * 6) + c.phase)) * amp)
      const y = c.y - bob
      rect(c.x, y + 6, 6, 10, c.shirt)
      rect(c.x + 1, y, 4, 5, c.skin)
      rect(c.x + 1, y - 1, 4, 2, c.hair)
      if ((c.shouter && k > 0.4) || cheer > 0.3) {
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
  function drawMat() {
    for (let y = C.TRACK_TOP + 6; y < C.TRACK_BOTTOM - 3; y++) {
      const x = matX(y)
      rect(x, y, C.MAT_W, 1, (y & 3) === 0 ? P.mat : P.matTop)
      rect(x - 1, y, 1, 1, P.matSide)
    }
    const yb = C.TRACK_BOTTOM - 3
    rect(matX(yb) - 1, yb, C.MAT_W + 1, 2, P.matSide)
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
    if (s.state === 'jump') return [ARMS_STIFF, LEGS_TOGETHER, HEAD, 0]
    if (s.state === 'land') return [f % 2 ? ARMS_UP : ARMS_UP_B, LEGS_TOGETHER, HEAD, 0]
    if (s.state === 'fall') return [ARMS_STAR, LEGS_STAR, HEAD_PANIC, 0]
    // Panic in the jump zone: arms up, eyes wide. That is the tell.
    if (s.x >= matX(s.y) - C.ZONE - 14) return [Math.floor(now * 12 + s.id) % 2 ? ARMS_UP : ARMS_UP_B, f % 2 ? LEGS_STRIDE : LEGS_TOGETHER, HEAD_PANIC, 1]
    return [f % 2 ? ARMS_SWING : ARMS_SWING_B, f % 2 ? LEGS_STRIDE : LEGS_TOGETHER, HEAD, 1]
  }
  const REST = [0, 4, -2, 4]
  function drawSkater(s) {
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
    draw(legs)
    draw(TORSO, lean)
    if (s.look.bib) draw(BIB, lean)
    draw(arms, lean)
    draw(head, lean)
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
      if (G.precision > 1) drawText(ctx, 'PRÉCISION ×' + Math.min(C.PRECISION_CAP, G.precision), 166, 2, P.yellow)
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
    drawMat()
    const sorted = [...skaters].sort((a, b) => a.y - b.y)
    for (const s of sorted) drawSkater(s)
    for (const p of particles) rect(p.x, p.y, 2, 2, p.colour)
    drawArchFront()
    ctx.restore()
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
      drawTextC(ctx, pointerTouch ? 'TAPOTE QUAND ILS PANIQUENT !' : 'ESPACE QUAND ILS PANIQUENT !', 160, 150, P.yellow)
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
      ['PLUS GRAND SAUT COLLECTIF', String(G.biggestJump), P.white],
    ]
    lines.forEach(([label, value, colour], i) => {
      if (since < 0.2 + i * 0.15) return
      const y = 64 + i * 11
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
const MAX_SKATERS = 600
const MAX_PER_SAVE = (CONFIG.SAVE_POINTS + CONFIG.PERFECT_BONUS * CONFIG.PRECISION_CAP) * CONFIG.MULTS[CONFIG.MULTS.length - 1]

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
  return s >= 380000 ? 'S' : s >= 280000 ? 'A' : s >= 160000 ? 'B' : s >= 60000 ? 'C' : 'D'
}
