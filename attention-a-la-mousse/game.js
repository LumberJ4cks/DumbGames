import { createAudio } from './audio.js?v=4'
import { drawText, drawTextC, textWidth } from './font.js?v=4'
import { drawText5, drawText5C, textWidth5, logoLine } from './font5.js?v=4'
import { Pix, PAL, RAMPS, bayer, toCanvas } from './pixel.js?v=4'
import { buildSprites, backgroundSprite, skaterSprite, skaterFallSprite, spectatorSprite, panelSprite, drawMatInto, lookKey, HELMET_RAMPS, JERSEY_RAMPS, SHORTS_RAMPS, SKIN_RAMPS, HAIR_RAMPS } from './sprites.js?v=4'

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
  // Shown on the title screen, so the loaded build can be told from a cached one.
  version: '3.2',
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
  // The guests: one appearance each per run, at these times. Rules: cochon, velo and
  // maireTrott are intruders (SCANDALE if jumped); dino, caddie, mariee, livreur follow the
  // skaters' rules; the coureur jumps the mat on his own. Debug: ?guests=0 removes them all.
  GUESTS: [
    { at: 30, kind: 'mariee' },
    { at: 40, kind: 'cochon' },
    { at: 55, kind: 'dino' },
    { at: 70, kind: 'velo' },
    { at: 85, kind: 'caddie' },
    { at: 95, kind: 'livreur' },
    { at: 110, kind: 'maireTrott' },
  ],
  COUREUR_AT: [22, 100],
  GUEST_SPEEDS: { dino: 48, cochon: 72, velo: 52, caddie: 44, mariee: 40, livreur: 50, coureur: 46, maireTrott: 80 },
  // The cyclist lifts the mat and puts it back MAT_SHIFT px further.
  MAT_SHIFT: 10,
  VELO_LIFT: 2.2,
  // Hitstop (seconds) on the first PARFAIT and the first fall: the whole world freezes.
  HITSTOP: 0.22,
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
const INTRUDER_KINDS = new Set(['maire', 'poussette', 'chien', 'secouriste', 'cochon', 'velo', 'maireTrott'])
const GUEST_KINDS = new Set(['dino', 'cochon', 'velo', 'caddie', 'mariee', 'livreur', 'coureur', 'maireTrott'])
const GUEST_NOTES = {
  mariee: 'UNE MARIÉE SUR LE PARCOURS. C’EST SON JOUR',
  cochon: 'COCHON ÉCHAPPÉ DE LA FERME PÉDAGOGIQUE',
  dino: 'DOSSARD N°9 : UN DINOSAURE. INSCRIPTION VALIDÉE',
  velo: 'UN CYCLISTE. MAUVAISE COURSE',
  caddie: 'CADDIE NON HOMOLOGUÉ EN APPROCHE',
  livreur: 'LIVRAISON EN COURS SUR LA PISTE',
  coureur: 'UN COUREUR DU SEMI-MARATHON',
  maireTrott: 'LE MAIRE REVIENT. EN TROTTINETTE',
}
const SCANDAL_NOTES = {
  maire: 'LE MAIRE A SAUTÉ. CONSEIL MUNICIPAL CONVOQUÉ',
  poussette: 'POUSSETTE EN VOL : ENQUÊTE OUVERTE',
  chien: 'CHIEN EN VOL : LA SPA EST PRÉVENUE',
  secouriste: 'SECOURISTE EN VOL : ARRÊT DE TRAVAIL',
  cochon: 'COCHON EN VOL : LA FERME PÉDAGOGIQUE PORTE PLAINTE',
  velo: 'CYCLISTE EN VOL : CE N’ÉTAIT MÊME PAS SA COURSE',
  maireTrott: 'LE MAIRE A SAUTÉ. EN TROTTINETTE. DÉMISSION',
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

/* ---------- palette: Endesga 32 (pixel.js), plus the names the rules use ---------- */
const P = {
  ...PAL,
  stamp: PAL.redD,
  redDark: PAL.redD,
  grey: PAL.grey2,
  paper: PAL.cream,
  asphaltLight: PAL.grey2,
}
// Looks are palette ramps (pixel.js RAMPS); the sprites module draws them.
const HELMETS = HELMET_RAMPS
const JERSEYS = JERSEY_RAMPS
const SHORTS = SHORTS_RAMPS
const SKINS = SKIN_RAMPS

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
  const matX = (y) => C.MAT_X - matExt() + (G ? G.matShift : 0) + (y - C.TRACK_TOP) * C.SLANT
  const isIntruder = (s) => INTRUDER_KINDS.has(s.kind)
  const isGuest = (s) => GUEST_KINDS.has(s.kind)
  const guestsOn = settings.guests !== false
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
  let freeze = 0 // hitstop, seconds left
  let litter = [] // debris lying on the track { x, y, kind, until }
  let matSquash = 0
  let burst = null // { x, y, at }
  let flagUntil = 0
  let displayScore = 0
  let multBumpAt = -99
  let shownLevel = 0
  let nextId = 1
  /*
   * The sideshow: fallen skaters that stay on the asphalt, the stretcher team and the
   * helicopter that evacuate them, and the mamie on the front lawn. Pure decoration, driven by
   * its own random generator so the run itself (and the balance test) is untouched.
   */
  const crandom = mulberry32(seedValue !== null ? Number(seedValue) + 101 : (Math.random() * 2 ** 32) >>> 0)
  const cpick = (list) => list[Math.floor(crandom() * list.length)]
  let bodies = [] // { x, y, look, pose, since, taken }
  let team = null // { state: in | load | out, x, y, body, t, frame }
  let heli = null // { state: in | hover | lift | out, x, y, tx, ty, cable, body, t }
  let mamie = null // { x, dir, t, next, line }
  let evacuations = 0
  let mamieLineAt = -99

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
      matShift: 0,
      guestsDone: {},
      coureurAt: 0,
      firstPerfectAt: -1,
      firstFallAt: -1,
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
    flagUntil = now + 1.3
    const intensity = G ? G.phase / 4 : 0
    const k = G ? Math.min(1, G.t / C.RUN_DURATION) : 0
    const interval = C.VOICE_INTERVAL[0] + (C.VOICE_INTERVAL[1] - C.VOICE_INTERVAL[0]) * k
    if (!force && G && G.t - G.lastVoice < interval) return
    if (G) G.lastVoice = G.t
    bubble(262, 64, 'ATTENTION À LA MOUSSE !', 1.4)
    audio.say(intensity)
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
      resume()
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
      if (perfect && G.firstPerfectAt < 0) {
        G.firstPerfectAt = G.t
        freeze = C.HITSTOP
      }
      if (isGuest(s)) guestJumped(s)
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
  function guestJumped(s) {
    if (s.kind === 'dino') {
      matSquash = 0.5
      burst = { x: matX(s.y) + 3, y: s.y - 2, at: now }
      notify('TAPIS ÉCRASÉ PAR UN DINOSAURE : HOMOLOGATION MAINTENUE', P.stamp)
      shake = Math.min(4, shake + 3)
      audio.fall()
    } else if (s.kind === 'caddie') {
      popup(s.x, s.y - 34, 'PÉPÉ APPLAUDIT', P.yellow, 1.2)
      for (let i = 0; i < 10; i++) particles.push({ x: s.x, y: s.y - 20, vx: (crandom() - 0.5) * 80, vy: -40 - crandom() * 40, life: 0.9, born: now, colour: P.yellow, g: 120, kind: 'confetti', ramp: cpick(['red', 'yellow', 'blue', 'green', 'pink']) })
    } else if (s.kind === 'livreur') notify('LIVRAISON MAINTENUE. LE CLIENT EST PRÉVENU', P.ink)
    else if (s.kind === 'mariee') {
      popup(s.x, s.y - 34, 'VIVE LA MARIÉE', P.pink, 1.2)
      for (let i = 0; i < 8; i++) particles.push({ x: s.x, y: s.y - 22, vx: (crandom() - 0.5) * 60, vy: -30 - crandom() * 30, life: 0.9, born: now, colour: P.white, g: 100, kind: 'confetti', ramp: 'pink' })
    }
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
    G = newGame()
    bodies = []
    team = null
    heli = null
    evacuations = 0
    mamie = { x: 40 + crandom() * 240, dir: crandom() < 0.5 ? -1 : 1, t: 0, next: 6 + crandom() * 6, pause: 0 }
    G.coureurAt = C.COUREUR_AT[0] + crandom() * (C.COUREUR_AT[1] - C.COUREUR_AT[0])
    litter = []
    matSquash = 0
    burst = null
    freeze = 0
    displayScore = 0
    shownLevel = 0
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
    // Debris: a wheel, the helmet, a glove, and a couple of sparks (drawn, not squares).
    const DEBRIS = ['wheel', 'helmet', 'glove', 'wheel', null, null]
    for (let i = 0; i < 6; i++)
      particles.push({ x: s.x, y: s.y - 4, vx: (random() - 0.3) * 60, vy: -30 - random() * 50, life: 0.6, born: now, colour: i % 2 ? P.yellow : P.white, g: 160, kind: isGuest(s) ? null : DEBRIS[i], ramp: s.look && s.look.H })
    shake = Math.min(3, shake + 1.2)
    for (const c of crowd) if (Math.abs(c.x - s.x) < 26 && crandom() < 0.6) c.hideUntil = now + 0.8 + crandom() * 0.6
    // On the foam: the mat squashes and a burst flashes.
    if (s.x >= matX(s.y) - 4) {
      matSquash = Math.max(matSquash, 0.3)
      burst = { x: s.x, y: s.y - 4, at: now }
    }
    if (G && !G.over && G.firstFallAt < 0) {
      G.firstFallAt = G.t
      freeze = C.HITSTOP
    }
    if (G && !G.over && isGuest(s)) {
      if (s.kind === 'caddie') {
        for (let i = 0; i < 7; i++) litter.push({ x: s.x + 6 + crandom() * 60, y: C.LANE_TOP + crandom() * (C.LANE_BOTTOM - C.LANE_TOP), kind: cpick(['poireau', 'bouteille', 'poireau']), until: now + 10 })
        notify('COURSES RÉPANDUES : LA VOIRIE EST PRÉVENUE', P.stamp)
      } else if (s.kind === 'livreur') {
        for (let i = 0; i < 4; i++) litter.push({ x: s.x + 6 + crandom() * 40, y: C.LANE_TOP + crandom() * (C.LANE_BOTTOM - C.LANE_TOP), kind: 'pizza', until: now + 10 })
        notify('LIVRAISON COMPROMISE', P.stamp)
      } else if (s.kind === 'dino') {
        popup(s.x, s.y - 36, 'BOING', P.green, 1)
        shake = Math.min(4, shake + 3)
      } else if (s.kind === 'mariee') notify('LA MARIÉE EST TOMBÉE. LE MARIAGE EST MAINTENU', P.stamp)
    }
    if (!G || G.over) return
    // Some of them stay down on the asphalt, waiting for the stretcher team (decoration only:
    // the skater itself slides on, invisible, so the rules see exactly the same run).
    if (bodies.length < 3 && G.t > 12 && crandom() < 0.3 && s.x > matX(s.y) - 4) {
      s.hidden = true
      bodies.push({ x: Math.min(W - 30, s.x + 24 + crandom() * 50), y: s.y, look: s.look, pose: cpick(['slideBack', 'slideFace', 'slideHead', 'slideBack']), since: now, taken: false, land: 0.75 })
    }
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
    // The guests, one appearance each.
    if (guestsOn) {
      for (const g of C.GUESTS) {
        if (G.guestsDone[g.kind] || G.t < g.at) continue
        G.guestsDone[g.kind] = true
        spawnGuest(g.kind)
      }
      if (!G.guestsDone.coureur && G.t >= G.coureurAt) {
        G.guestsDone.coureur = true
        spawnGuest('coureur')
      }
    }
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

  /* ---------- the sideshow ---------- */
  function updateSideshow(dt) {
    // Stretcher team: when a body has been lying there a moment, two medics come from the
    // right, kneel, load it and carry it off. Every third evacuation is by helicopter.
    const waiting = bodies.find((b) => !b.taken && now - b.since > 2.5)
    if (waiting && !team && !heli) {
      waiting.taken = true
      if (evacuations % 3 === 2) {
        heli = { state: 'in', x: W + 40, y: -20, tx: waiting.x, ty: waiting.y - 62, cable: 0, body: waiting, t: 0 }
        notify('ÉVACUATION HÉLIPORTÉE : DISPOSITIF PROPORTIONNÉ', P.ink)
        mamieSay('UN HÉLICO. POUR ÇA.')
        audio.heli(true)
      } else {
        team = { state: 'in', x: W + 30, y: waiting.y + 7, body: waiting, t: 0, frame: 0 }
        notify(evacuations === 0 ? 'LES BRANCARDIERS SONT LÀ' : 'ÉVACUATION N°' + (evacuations + 1) + ' : EN COURS', P.ink)
      }
      evacuations++
    }
    if (team) {
      team.t += dt
      team.frame += dt * 6
      if (team.state === 'in') {
        team.x -= 34 * dt
        if (team.x <= team.body.x + 2) {
          team.state = 'load'
          team.t = 0
        }
      } else if (team.state === 'load') {
        if (team.t > 1.3) {
          team.state = 'out'
          bodies = bodies.filter((b) => b !== team.body)
          popup(team.x, team.y - 30, 'HOP', P.white, 0.6)
        }
      } else {
        team.x += 30 * dt
        if (team.x - 20 > W + 10) team = null
      }
    }
    if (heli) {
      heli.t += dt
      const h = heli
      if (h.state === 'in') {
        h.x += (h.tx - h.x) * Math.min(1, dt * 1.6)
        h.y += (h.ty - h.y) * Math.min(1, dt * 1.6)
        if (Math.abs(h.x - h.tx) < 2 && Math.abs(h.y - h.ty) < 2) {
          h.state = 'hover'
          h.t = 0
        }
      } else if (h.state === 'hover') {
        // The cable comes down to the body; dust from the rotor wash.
        h.cable = Math.min(h.ty < h.body.y ? h.body.y - h.ty - 6 : 0, h.cable + 40 * dt)
        if (h.t > 1.6) {
          h.state = 'lift'
          h.t = 0
          bodies = bodies.filter((b) => b !== h.body)
        }
      } else if (h.state === 'lift') {
        h.cable = Math.max(8, h.cable - 30 * dt)
        if (h.t > 1.4) {
          h.state = 'out'
          h.t = 0
        }
      } else {
        h.x += 120 * dt
        h.y -= 45 * dt
        if (h.x > W + 60 || h.y < -40) {
          heli = null
          audio.heli(false)
        }
      }
      if (h.state === 'hover' || h.state === 'lift') {
        h.x = h.tx + Math.sin(now * 3) * 1.5
        if (crandom() < dt * 12) particles.push({ x: h.body.x - 10 + crandom() * 20, y: h.body.y, vx: (crandom() - 0.5) * 60, vy: -20 - crandom() * 20, life: 0.4, born: now, colour: P.grey2, g: 0 })
      }
    }
    // La mamie: strolls along the front lawn, stops, comments.
    if (mamie) {
      const m = mamie
      m.t += dt
      if (m.pause > 0) m.pause -= dt
      else {
        m.x += m.dir * 9 * dt
        if (m.x < 12) m.dir = 1
        if (m.x > W - 12) m.dir = -1
        if (crandom() < dt * 0.15) m.pause = 1.5 + crandom() * 2
      }
      if (m.t >= m.next) {
        m.next = m.t + 10 + crandom() * 8
        mamieSay(cpick(['MAIS C’EST DE LA CONNERIE LÀ', 'MAIS C’EST DE LA CONNERIE LÀ', 'ET LE MAIRE, IL DIT RIEN ?', 'DE MON TEMPS ON TOMBAIT MIEUX']))
      }
    }
  }
  function mamieSay(text) {
    if (!mamie || now - mamieLineAt < 3) return
    mamieLineAt = now
    mamie.pause = Math.max(mamie.pause, 2.4)
    bubble(mamie.x, 148, text, 2.4)
  }

  function spawnGuest(kind) {
    const depth = C.LANE_BOTTOM - C.LANE_TOP
    const y = C.LANE_TOP + 0.2 * depth + crandom() * 0.6 * depth
    const g = makeSkater(C.SPAWN_X - 10, y, C.GUEST_SPEEDS[kind], kind)
    g.guestT = 0
    g.baseY = y
    skaters.push(g)
    if (kind === 'mariee') {
      // Two skaters hide behind the dress: one press saves all three, if you guess they are there.
      for (const dy of [-5, -8]) {
        const h = makeSkater(C.SPAWN_X - 10 + (dy === -5 ? -2 : 1), y + dy, C.GUEST_SPEEDS.mariee, 'normal')
        h.anim = g.anim
        skaters.push(h)
      }
    }
    notify(GUEST_NOTES[kind], P.ink)
    if (kind === 'dino') mamieSay('C’EST QUOI CE DINOSAURE ?')
    if (kind === 'velo') mamieSay('IL VA FAIRE QUOI AVEC ÇA ?')
    audio.stamp()
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
    audio.heli(false)
    heli = null
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
    if (freeze > 0) {
      // Hitstop: the whole world holds its breath for a few frames.
      freeze -= dt
      return
    }
    now += dt
    matSquash = Math.max(0, matSquash - dt)
    if (displayScore < (G ? G.score : 0)) displayScore = Math.min(G.score, displayScore + Math.max(20, (G.score - displayScore) * dt * 8))
    if (G && G.level !== shownLevel) {
      shownLevel = G.level
      multBumpAt = now
    }
    litter = litter.filter((l) => now < l.until)
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
          audio.say(1)
          G.lastVoice = G.t
        } else if (PHASE_NOTES[phase]) notify(PHASE_NOTES[phase], P.ink)
      }
      if (!G.over) {
        spawnDue()
        updateEvents(dt)
        updateSideshow(dt)
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
      if (isGuest(s)) s.guestT += dt
      if (s.state === 'lift') {
        // The cyclist, off his bike, holds the mat up… then puts it down a little further.
        s.t += dt
        if (s.t >= C.VELO_LIFT) {
          G.matShift += C.MAT_SHIFT
          s.vx = s.base
          s.state = 'roll'
          s.crossed = true
          notify('TAPIS DÉPLACÉ DE ' + C.MAT_SHIFT + ' CM. PROCÈS-VERBAL EN COURS', P.stamp)
          audio.stamp()
        }
        continue
      }
      if (s.state === 'roll') {
        if (s.kind === 'cochon') s.y = s.baseY + Math.sin(s.guestT * 7) * 6
        if (s.kind === 'caddie' && !s.crossed) s.y = Math.min(C.LANE_BOTTOM, s.baseY + s.guestT * 3)
        if (s.kind === 'velo' && !s.crossed && s.x >= matX(s.y) - C.ZONE + 6) {
          s.state = 'lift'
          s.t = 0
          s.vx = 0
          continue
        }
        if (s.kind === 'coureur' && !s.crossed && s.x >= matX(s.y) - C.PERFECT + 1) {
          // He clears it on his own, and nobody scores.
          launch(s)
          popup(s.x, s.y - 28, 'IL SE DÉBROUILLE', P.grey1, 1)
          continue
        }
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
        const before = Math.floor(s.anim)
        s.anim += (s.vx * dt) / (isIntruder(s) ? 4 : 7)
        // A puff of dust at each push (kept light when the track is crowded).
        if (!isIntruder(s) && !isGuest(s) && Math.floor(s.anim) !== before && Math.floor(s.anim) % 2 === 0 && skaters.length < 40 && crandom() < 0.6)
          particles.push({ x: s.x - 6, y: s.y - 1, vx: -14, vy: -6, life: 0.25, born: now, colour: P.grey2, g: 0 })
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
  function pad(n, size) {
    return String(n).padStart(size, '0')
  }
  /** Draws a cached sprite canvas with its anchor at (x, y). */
  function put(c, x, y) {
    ctx.drawImage(c, Math.round(x) - c.ax, Math.round(y) - c.ay)
  }
  /** Headline text: 5 × 7 with a drop shadow; `outline` for text over busy areas. */
  function text5(text, x, y, colour, style = { shadow: P.ink }) {
    drawText5(ctx, text, x, y, colour, style)
  }
  function text5C(text, cx, y, colour, style = { shadow: P.ink }) {
    drawText5C(ctx, text, cx, y, colour, style)
  }

  /* ---------- sprite caches (built once, at start-up) ---------- */
  // Buffers become canvases, through arrays and nested objects alike.
  const toCanvases = (v) => (v instanceof Pix ? toCanvas(v) : Array.isArray(v) ? v.map(toCanvases) : Object.fromEntries(Object.entries(v).map(([k, p]) => [k, toCanvases(p)])))
  const S = toCanvases(buildSprites(C))
  // Three times of day: noon, afternoon, evening (the sky warms, the shadows stretch).
  const bgs = [0, 1, 2].map((d) => toCanvas(backgroundSprite(C, W, H, d)))
  const bg = bgs[0]
  const bgCtx = bg.getContext('2d')
  const daylight = () => (G ? (G.phase >= 4 ? 2 : G.phase >= 2 ? 1 : 0) : 0)
  // Static scenery baked over each background: barriers, the refreshment table and its sign,
  // the back post of the arch, the sponsor boards.
  for (const b of bgs) {
    const g = b.getContext('2d')
    const putB = (c, x, y) => g.drawImage(c, Math.round(x) - c.ax, Math.round(y) - c.ay)
    for (let x = 0; x < W; x += 34) putB(S.barrier, x, 100)
    putB(S.table, 33, 95)
    putB(S.archPostBack, C.FINISH_X - 4, C.TRACK_TOP + 2)
    let bx = -6
    for (const bd of S.boards) {
      putB(bd, bx, 163)
      bx += bd.width - 4 + 2
    }
  }
  void bgCtx
  // The arch banner with its lettering, drawn once.
  const banner = document.createElement('canvas')
  banner.width = S.banner.width
  banner.height = S.banner.height
  {
    const g = banner.getContext('2d')
    g.drawImage(S.banner, 0, 0)
    drawText5C(g, 'ARRIVÉE', S.banner.ax + 35, S.banner.ay + 4, P.white, { shadow: P.redD })
    drawText(g, 'GARAGE PATRICK', S.banner.ax + 35 - textWidth('GARAGE PATRICK') / 2, S.banner.ay + 18, P.plum)
  }
  banner.ax = S.banner.ax
  banner.ay = S.banner.ay
  // The title logo, two lines.
  const logo = [toCanvas(logoLine('ATTENTION')), toCanvas(logoLine('À LA MOUSSE !'))]
  // Ground shadows: opaque, in the darkened colour of the ground.
  const shadowOf = (w, colour) => toCanvas(new Pix(w + 2, 4).disc(w / 2 + 1, 2, w / 2, 1.4, colour))
  const SHADOWS = [8, 11, 14].map((w) => ({ skater: shadowOf(w, P.slateD), small: shadowOf(w - 3, P.slateD), wide: shadowOf(w + 10, P.slateD), lawn: shadowOf(w, P.greenD) }))
  let SHADOW = SHADOWS[0]
  // Overlays without translucency: solid, or a clean 50 % checkerboard (the 16-bit way).
  const overlay = (colour, checker) => {
    const p = new Pix(W, H)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!checker || (x + y) % 2 === 0) p.px(x, y, colour)
    return toCanvas(p)
  }
  const FLASH = [overlay(P.white, false), overlay(P.white, true)]
  const DIM = overlay(P.slateD, true)
  // Panels are cached by size.
  const panels = new Map()
  function panel(w, h, ramp = RAMPS.navy, inset = false) {
    const key = w + 'x' + h + ramp[0] + inset
    let c = panels.get(key)
    if (!c) {
      c = toCanvas(panelSprite(w, h, ramp, { inset }))
      panels.set(key, c)
    }
    return c
  }

  /* ---------- skaters: one canvas per look, pose and rotation, built on first use ---------- */
  const skaterCache = new Map()
  function skaterCanvas(look, pose) {
    const key = lookKey(look) + '|' + (pose.fall || pose.head + pose.arms + pose.legs + pose.lean + pose.kind + (pose.dy || 0) + (pose.flutter ? 'f' : ''))
    let c = skaterCache.get(key)
    if (!c) {
      c = toCanvas(pose.fall ? skaterFallSprite(look, pose.fall) : skaterSprite(look, pose))
      skaterCache.set(key, c)
    }
    return c
  }
  const SLIDE_POSE = { 1: 'slideFace', 2: 'slideHead', 3: 'slideBack', 0: 'slideBack' }

  /* ---------- crowd and volunteers ---------- */
  const crowd = []
  {
    const rng = mulberry32(7)
    let n = 0
    for (let row = 0; row < 2; row++)
      for (let x = 2 + row * 3; x < W; x += 7 + Math.floor(rng() * 3)) {
        if (x > 30 && x < 78) continue // the refreshment table
        if (x > 170 && x < 190) continue // RALENTIR
        if (x > 252 && x < 272) continue // announcer
        const look = {
          skin: SKINS[Math.floor(rng() * SKINS.length)],
          hair: HAIR_RAMPS[Math.floor(rng() * HAIR_RAMPS.length)],
          shirt: JERSEYS[Math.floor(rng() * JERSEYS.length)],
          v: n++,
        }
        crowd.push({
          x: x + 3,
          y: 90 + row * 5,
          phase: rng() * 6.28,
          shouter: rng() < 0.12,
          filmer: rng() < 0.1,
          hideUntil: 0,
          frames: [0, 1, 2, 3].map((f) => toCanvas(spectatorSprite(look, f))),
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
      const shouting = wave || (c.shouter && k > 0.4) || cheer > 0.3
      let frame = shouting ? 1 : 0
      if (!wave && now < c.hideUntil) frame = 2 // saw a fall right in front: hands over the eyes
      else if (!shouting && c.filmer && k > 0.3) frame = 3 // filming it all with the phone
      put(c.frames[frame], c.x, c.y - bob)
    }
  }
  const SKIN0 = RAMPS.skinPale[2]
  function drawVolunteers() {
    // Refreshment: a volunteer holding a cup out to nobody in particular.
    put(S.signRavito, 36, 79)
    put(S.volunteer[0], 67, 92)
    {
      const reach = Math.round(Math.sin(now * 2) + 1)
      rect(69, 79, 3 + reach, 1, SKIN0)
      rect(72 + reach, 77, 2, 3, P.white)
      rect(72 + reach, 77, 2, 1, P.grey1)
    }
    // The flag waver at the finish line: a chequered flag for every group that passes.
    put(S.volunteer[1], 104, 100)
    if (now < flagUntil) {
      put(S.flag[Math.floor(now * 8) % 2], 108, 86)
      rect(106, 84, 2, 2, RAMPS.skinPale[2])
    } else {
      rect(107, 84, 1, 10, RAMPS.wood[2])
      rect(106, 84, 2, 1, RAMPS.skinPale[2])
    }
    // RALENTIR: waved with total conviction, to no effect… until the peloton, when he gives up.
    const k = intensity()
    if (G && G.phase >= 4) {
      put(S.volunteerSit, 182, 100)
      put(S.signRalentir, 160, 88) // the sign, dropped against the barrier
      if (Math.floor(now * 2) % 2) drawText(ctx, 'PFFF', 190, 76, P.white)
    } else {
      const wave = Math.round(Math.sin(now * (3 + k * 10)) * (1 + k * 2))
      put(S.volunteer[1], 180, 100)
      rect(182, 84, 1, 4, RAMPS.skinTan[2])
      rect(182 + wave, 70, 1, 15, RAMPS.wood[1])
      rect(182 + wave, 70, 1, 1, RAMPS.wood[2])
      put(S.signRalentir, 165 + wave, 62)
      if (G && G.phase === 3 && Math.floor(now * 1.3) % 4 === 0) drawText(ctx, 'PFF', 188, 72, P.white)
    }
    // Between two visits to the track, the pigeons sit on the town hall roof.
    if (!pigeons.length) {
      put(S.pigeon[Math.floor(now * 2) % 3 === 0 ? 'peck' : 'idle'], 150, 22)
      put(S.pigeon[Math.floor(now * 2 + 1) % 3 === 0 ? 'peck' : 'idle'], 194, 22)
    }
    // The announcer with the megaphone.
    put(S.volunteer[2], 262, 100)
    rect(264, 84, 3, 1, RAMPS.skinDark[2])
    rect(266, 82, 3, 4, P.grey1)
    rect(269, 81, 2, 6, P.white)
    rect(269, 81, 2, 1, P.grey1)
    rect(266, 83, 3, 1, P.red)
  }

  /* ---------- the mat (the boss) and its zone ---------- */
  function drawZone() {
    // Painted line where the zone begins; red tape dithered across the zone during a FAUX DÉPART.
    const locked = G && state === 'PLAYING' && G.t < G.lockedUntil
    for (let y = C.TRACK_TOP + 6; y < C.TRACK_BOTTOM - 3; y += 3) {
      const x = Math.round(matX(y) - C.ZONE)
      rect(x, y, 1, 2, locked ? P.red : P.grey1)
      if (locked && Math.floor(now * 10) % 2)
        for (let i = 1; i < C.ZONE; i++) if (bayer(x + i, y) < 0.35) rect(x + i, y, 1, 1, P.red)
    }
  }
  function drawMat() {
    const lifter = skaters.find((s) => s.state === 'lift')
    if (lifter) {
      // Held up over the cyclist's head: drawn flat, 26 px above the ground, no shadow on it.
      drawMatInto((x, y, c) => rect(x, y - 26, 1, 1, c), matX, Math.round(matExt()), C)
      return
    }
    if (matSquash > 0) {
      // Pressed down: one row shorter, pushed 1 px lower, and spread 1 px wider at the base.
      const yb = C.TRACK_BOTTOM - 3
      drawMatInto((x, y, c) => {
        if (y === C.TRACK_TOP + 6) return
        rect(x + (y >= yb - 2 ? 1 : 0), y + 1, 1, 1, c)
      }, matX, Math.round(matExt()), C)
      return
    }
    drawMatInto((x, y, c) => rect(x, y, 1, 1, c), matX, Math.round(matExt()), C)
  }
  function drawLitter() {
    for (const l of litter) put(S.debris[l.kind], l.x, l.y)
  }
  function drawBurst() {
    if (!burst || now - burst.at > 0.22) return
    put(S.burst, burst.x, burst.y)
  }

  /* ---------- arch ---------- */
  function drawArchFront() {
    put(S.archPost, finishX(C.TRACK_BOTTOM - 2) + 6, C.TRACK_BOTTOM - 2)
    put(banner, 74, 16)
  }

  /* ---------- skaters ---------- */
  function poseFor(s) {
    const f = Math.floor(s.anim) % 4
    const kind = s.kind === 'fast' || s.kind === 'slow' || s.kind === 'hesitant' ? s.kind : 'normal'
    // DÉBUTANT braking: windmilling arms, legs locked in a T-stop.
    if (s.state === 'roll' && s.braking > 0) return { head: 'panic', arms: Math.floor(now * 10) % 2 ? 'upA' : 'star', legs: 'stride', lean: -1, kind }
    const panic = s.x >= matX(s.y) - C.ZONE - 14
    if (s.state === 'roll' && s.kind === 'fast' && !panic) return { head: 'plain', arms: 'stiff', legs: f % 2 ? 'stride' : 'together', lean: 2, kind }
    if (s.state === 'roll' && s.kind === 'slow' && !panic) return { head: 'plain', arms: 'star', legs: f % 2 ? 'stride' : 'together', lean: 0, kind }
    if (s.state === 'jump') {
      // Anticipation (crouch), take-off (stiff), stretched at the top with the bib fluttering.
      const u = s.t / s.jumpT
      if (s.t < 0.07) return { head: 'plain', arms: 'back', legs: 'crouch', lean: 0, kind, dy: 2 }
      if (u < 0.3) return { head: 'plain', arms: 'stiff', legs: 'together', lean: 0, kind }
      if (u < 0.75) return { head: 'plain', arms: 'back', legs: 'together', lean: 1, kind, flutter: true }
      return { head: 'plain', arms: 'stiff', legs: 'crouch', lean: 0, kind, dy: 1 }
    }
    if (s.state === 'land') {
      if (s.t < 0.14) return { head: 'plain', arms: 'back', legs: 'crouch', lean: 0, kind, dy: 2 }
      return { head: 'plain', arms: f % 2 ? 'upA' : 'upB', legs: 'together', lean: 0, kind }
    }
    // The roulé-boulé: squashed on impact, four tumble frames while bouncing, then a slide.
    if (s.state === 'fall') return { fall: s.t < 0.07 && s.bounce <= 7 ? 'squash' : s.t < 0.75 ? 'tumble' + s.rot : SLIDE_POSE[s.slideRot] }
    // Panic in the jump zone: arms up, eyes wide. That is the tell.
    if (panic) return { head: 'panic', arms: Math.floor(now * 12 + s.id) % 2 ? 'upA' : 'upB', legs: f % 2 ? 'stride' : 'together', lean: 1, kind }
    // The push cycle: push, glide, push with the other leg, glide; arms in opposition.
    return { head: 'plain', arms: ['swingA', 'swingB', 'swingC', 'swingD'][f], legs: ['pushA', 'together', 'pushB', 'together'][f], lean: 1, kind }
  }
  const REST = [0, 4, -2, 4] // intruders thrown by the truck still spin around a pivot
  function drawIntruder(s) {
    const f = Math.floor(s.anim) % 2
    const up = s.state === 'jump' || s.state === 'fall'
    put(s.kind === 'poussette' ? SHADOW.wide : s.kind === 'chien' ? SHADOW.small : SHADOW.skater, s.x - (s.kind === 'poussette' ? 7 : 0), s.y)
    let c
    if (s.kind === 'maire') c = (up ? S.maireUp : S.maire)[f]
    else if (s.kind === 'chien') c = S.chien[up ? 1 : f]
    else if (s.kind === 'poussette') c = S.poussette[f]
    else c = (up ? S.secouristeUp : S.secouriste)[f]
    const y = s.y - s.z + (s.state === 'fall' && s.t >= 0.75 ? REST[s.rot] : 0)
    if (s.rot) {
      // Thrown intruders tumble like the skaters: rotate the canvas around the same pivot.
      ctx.save()
      ctx.translate(Math.round(s.x), Math.round(y - 9))
      ctx.rotate((s.rot * Math.PI) / 2)
      ctx.drawImage(c, -c.ax, -c.ay + 9)
      ctx.restore()
    } else put(c, s.x, y)
    // A little warning triangle above intruders while they walk towards the mat.
    if (s.state === 'roll' && !s.crossed && s.x > finishX(s.y) - 20 && Math.floor(now * 4) % 2) {
      const tx = Math.round(s.x) - (s.kind === 'poussette' ? 8 : 0)
      const ty = Math.round(y) - (s.kind === 'chien' ? 15 : 28)
      rect(tx - 3, ty + 3, 7, 1, P.ink)
      rect(tx - 2, ty + 2, 5, 1, P.red)
      rect(tx - 1, ty + 1, 3, 1, P.red)
      rect(tx, ty, 1, 1, P.red)
      rect(tx, ty + 1, 1, 2, P.yellow)
    }
  }
  function drawGuest(s) {
    const f = Math.floor(s.anim) % 2
    const up = s.state === 'jump' || s.state === 'fall' || s.state === 'land'
    const y = s.y - s.z
    const K = s.kind
    let c
    if (K === 'dino') c = S.dino[f]
    else if (K === 'cochon') c = S.cochon[f]
    else if (K === 'velo') c = s.state === 'lift' ? S.velo[2] : S.velo[f]
    else if (K === 'caddie') c = S.caddie[f]
    else if (K === 'mariee') c = S.mariee[f]
    else if (K === 'livreur') c = S.livreur[f]
    else if (K === 'coureur') c = s.state === 'jump' ? S.coureur[2] : S.coureur[Math.floor(s.anim * 2) % 2]
    else c = S.maireTrott[f]
    put(K === 'cochon' ? SHADOW.small : K === 'dino' || K === 'coureur' ? SHADOW.skater : SHADOW.wide, s.x, s.y)
    if (s.state === 'fall') {
      // Guests tumble as a whole, around the same pivot as the old sprite.
      ctx.save()
      ctx.translate(Math.round(s.x), Math.round(y - 9))
      ctx.rotate((s.rot * Math.PI) / 2)
      ctx.drawImage(c, -c.ax, -c.ay + 9)
      ctx.restore()
    } else put(c, s.x, y)
    if (isIntruder(s) && s.state === 'roll' && !s.crossed && s.x > finishX(s.y) - 20 && Math.floor(now * 4) % 2) {
      const tx = Math.round(s.x)
      const ty = Math.round(y) - (K === 'cochon' ? 16 : 32)
      rect(tx - 3, ty + 3, 7, 1, P.ink)
      rect(tx - 2, ty + 2, 5, 1, P.red)
      rect(tx - 1, ty + 1, 3, 1, P.red)
      rect(tx, ty, 1, 1, P.red)
      rect(tx, ty + 1, 1, 2, P.yellow)
    }
    void up
  }
  function drawSkater(s) {
    if (isGuest(s)) return drawGuest(s)
    if (isIntruder(s)) return drawIntruder(s)
    if (s.hidden) return
    put(s.z > 6 ? SHADOW.small : s.state === 'fall' ? SHADOW.wide : SHADOW.skater, s.x, s.y)
    const pose = poseFor(s)
    const c = skaterCanvas(s.look, pose)
    const ox = Math.round(s.x)
    const oy = Math.round(s.y - s.z)
    if (s.kind === 'fast' && s.state === 'roll') {
      // FUSÉE: a three-tone trail behind.
      const k = Math.floor(now * 20) % 3
      for (const [dy, len] of [[-14, 4], [-9, 5], [-5, 3]]) {
        rect(ox - 8 - k - len, oy + dy, len, 1, P.grey3)
        rect(ox - 8 - k - len + 1, oy + dy, len - 1, 1, P.grey2)
        rect(ox - 8 - k, oy + dy, 1, 1, P.white)
      }
    }
    put(c, ox, oy)
    if (s.kind === 'hesitant' && s.state === 'roll' && s.braking > 0) text5('?', ox - 2, oy - 32, P.yellow)
  }

  /* ---------- the sideshow: bodies, stretcher team, helicopter, mamie ---------- */
  function drawBody(b) {
    put(SHADOW.wide, b.x, b.y)
    put(skaterCanvas(b.look, { fall: b.pose }), b.x, b.y)
    // Little stars circling the head.
    if (Math.floor(now * 4 + b.x) % 2) {
      rect(Math.round(b.x) - 9, Math.round(b.y) - 13, 1, 1, P.yellow)
      rect(Math.round(b.x) - 5, Math.round(b.y) - 15, 1, 1, P.yellow)
    }
  }
  function drawTeam() {
    if (!team) return
    const t = team
    const f = Math.floor(t.frame) % 2
    const x = Math.round(t.x)
    const y = Math.round(t.y)
    if (t.state === 'load') {
      put(S.medic[2], x - 12, y)
      put(S.stretcher, x, y - 1)
      put(S.medic[2], x + 12, y)
      return
    }
    put(SHADOW.skater, x - 14, y)
    put(SHADOW.skater, x + 14, y)
    put(S.medic[f], x - 14, y)
    put(S.stretcher, x, y - 8 - (f ? 1 : 0))
    if (t.state === 'out') put(skaterCanvas(t.body.look, { fall: t.body.pose }), x, y - 11 - (f ? 1 : 0))
    put(S.medic[1 - f], x + 14, y)
  }
  function drawHeli() {
    if (!heli) return
    const h = heli
    const x = Math.round(h.x)
    const y = Math.round(h.y)
    if (h.state !== 'out' && h.body) put(SHADOW.wide, h.body.x, h.body.y)
    // Cable and the stretcher hanging from it.
    if (h.cable > 0) {
      rect(x, y, 1, Math.round(h.cable), P.slateD)
      const by = y + Math.round(h.cable)
      if (h.state !== 'hover') {
        put(S.stretcher, x, by + 3)
        put(skaterCanvas(h.body.look, { fall: h.body.pose }), x, by)
      } else put(S.stretcher, x, by + 3)
    }
    put(S.heli[Math.floor(now * 30) % 2], x, y)
  }
  function drawMamie() {
    if (!mamie) return
    const m = mamie
    const x = Math.round(m.x)
    put(SHADOW.lawn, x, 178)
    const c = S.mamie[m.pause > 0 ? 0 : Math.floor(m.t * 3) % 2]
    if (m.dir < 0) {
      ctx.save()
      ctx.translate(x, 178)
      ctx.scale(-1, 1)
      ctx.drawImage(c, -c.ax, -c.ay)
      ctx.restore()
    } else put(c, x, 178)
  }

  /* ---------- pigeons, photographer, fire engine ---------- */
  function drawPigeons() {
    for (const p of pigeons) {
      if (p.state === 'ground') put(S.pigeon[Math.floor(now * 3 + p.tx) % 3 === 0 ? 'peck' : 'idle'], p.x, p.y)
      else put(S.pigeon[Math.floor(now * 14 + p.tx) % 2 ? 'up' : 'down'], p.x, p.y)
    }
  }
  function drawPhotographer() {
    const ph = G && G.photo
    if (!ph) return
    const base = 208
    const x =
      ph.phase === 'in' ? Math.round(W + 10 - (W + 10 - base) * Math.min(1, ph.t / 0.5)) : ph.phase === 'out' ? Math.round(base + (W + 10 - base) * (ph.t / 0.5)) : base
    put(SHADOW.lawn, x, 178)
    put(S.photographer[ph.phase === 'aim' && Math.floor(now * 8) % 2 ? 1 : 0], x, 178)
  }
  function drawFlash() {
    if (!G) return
    const t = now - G.flashAt
    if (t < 0 || t > C.PHOTO_FLASH) return
    // Solid white, then a checkerboard for the tail of the flash.
    if (t > 0.45) return
    const c = t < 0.3 ? FLASH[0] : FLASH[1]
    ctx.drawImage(c, 0, 13, W, H - 13, 0, 13, W, H - 13)
  }
  function drawTruck() {
    const tr = G && G.truck
    if (!tr || tr.state === 'done') return
    if (tr.state === 'warn') {
      // Blue lights and PIN-PON at the left edge before it comes in.
      if (Math.floor(now * 6) % 2) rect(0, 120, 4, 14, P.cyan)
      text5('PIN-PON !', 6, 114, Math.floor(now * 6) % 2 ? P.red : P.white)
      return
    }
    rect(Math.round(tr.x) - C.TRUCK_LEN + 2, C.LANE_BOTTOM + 5, C.TRUCK_LEN, 3, P.slateD)
    put(S.truck[Math.floor(now * 8) % 2], tr.x, C.LANE_BOTTOM + 6 - tr.z)
  }

  /* ---------- overlays ---------- */
  function drawBubbles() {
    for (const b of bubbles) {
      const w = textWidth(b.text) + 6
      const x = Math.max(2, Math.min(W - w - 2, Math.round(b.x - w / 2)))
      const y = Math.round(b.y - 10)
      rect(x - 1, y - 1, w + 2, 11, P.ink)
      rect(x, y, w, 9, P.white)
      rect(x, y + 8, w, 1, P.grey1)
      rect(x + w - 1, y, 1, 9, P.grey1)
      rect(Math.round(b.x) - 1, y + 10, 4, 1, P.ink)
      rect(Math.round(b.x), y + 9, 2, 2, P.white)
      drawText(ctx, b.text, x + 3, y, P.ink)
    }
  }
  function drawPopups() {
    for (const p of popups) {
      const k = (now - p.at) / p.dur
      const y = Math.round(p.y - k * 10)
      text5C(p.text, p.x, y, p.colour, { outline: P.ink })
    }
  }
  function drawNote() {
    if (!G || !G.note) return
    const t = now - G.note.at
    const w = textWidth5(G.note.text) + 28
    const x = Math.round(W / 2 - w / 2)
    const y = 16 + (t < 0.08 ? -3 : 0)
    put(panel(w, 13, RAMPS.paper), x, y)
    text5(G.note.text, x + 23, y + 2, G.note.colour, {})
    // The stamp drops onto the paper, then a few specks of ink.
    put(S.stamp, x + 4, y + 3 - (t < 0.1 ? Math.round((0.1 - t) * 60) : 0))
    if (t >= 0.1 && t < 0.3) for (const [dx, dy] of [[-1, 2], [20, 1], [8, 11], [16, 12]]) rect(x + 4 + dx, y + 3 + dy, 1, 1, P.redD)
  }
  const SOUND_BTN = { x: W - 19, y: 1, w: 18, h: 11 }
  function drawSoundButton() {
    put(S.sound[audio.muted ? 1 : 0], SOUND_BTN.x, SOUND_BTN.y)
  }
  function drawHud() {
    put(S.hud, 0, 0)
    if (G) {
      text5('SCORE ' + pad(Math.round(displayScore), 6), 3, 2, displayScore < G.score ? P.yellow : P.white, {})
      const bump = now - multBumpAt < 0.25
      text5('×' + C.MULTS[G.level], 80, bump ? 1 : 2, G.level ? P.yellow : P.white, bump ? { outline: P.white } : {})
      // Progress toward the next multiplier.
      if (G.level < C.LEVELS.length - 1) {
        const from = C.LEVELS[G.level]
        const to = C.LEVELS[G.level + 1]
        const k = (G.chain - from) / (to - from)
        rect(94, 5, 30, 4, P.ink)
        rect(95, 6, 28, 2, P.slate)
        rect(95, 6, Math.round(28 * k), 2, P.yellow)
      } else text5('MAX', 94, 2, P.yellow, {})
      text5('SÉRIE ' + G.combo, 130, 2, P.white, {})
      if (G.t < G.olaUntil) {
        if (Math.floor(now * 4) % 2) text5('OLA : POINTS ×2', 186, 2, P.yellow, {})
      } else if (G.precision > 1) text5('PRÉC ×' + Math.min(C.PRECISION_CAP, G.precision) + ' OLA ' + (G.precision % C.OLA_EVERY) + '/' + C.OLA_EVERY, 186, 2, P.yellow, {})
      const left = Math.max(0, Math.ceil(C.RUN_DURATION - G.t))
      const clock = Math.floor(left / 60) + ':' + pad(left % 60, 2)
      text5(clock, 277, 2, left <= 10 && Math.floor(now * 4) % 2 ? P.red : P.white, {})
    } else {
      text5(best > 0 ? 'RECORD ' + pad(best, 6) : 'COURSE DES 10 KM · ÉDITION 2026', 3, 2, P.white, {})
      drawText(ctx, 'V' + manifest.version, W - 40, 3, P.grey2)
    }
    drawSoundButton()
  }

  function drawScene() {
    ctx.save()
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake))
    SHADOW = SHADOWS[daylight()]
    ctx.drawImage(bgs[daylight()], 0, 0)
    drawCrowd()
    drawVolunteers()
    drawZone()
    drawMat()
    drawLitter()
    const sorted = [...skaters, ...bodies.map((b) => ({ body: b, y: b.y }))].sort((a, b) => a.y - b.y)
    for (const s of sorted) if (s.body) drawBody(s.body)
      else drawSkater(s)
    drawBurst()
    drawTeam()
    drawPigeons()
    drawTruck()
    for (const p of particles) {
      if (p.kind === 'confetti') put(S.debris.confetti[p.ramp] || S.debris.confetti.red, p.x, p.y)
      else if (p.kind === 'helmet') put(S.debris.helmet[p.ramp] || S.debris.helmet.red, p.x, p.y)
      else if (p.kind) put(S.debris[p.kind], p.x, p.y)
      else rect(p.x, p.y, 2, 2, p.colour)
    }
    drawArchFront()
    drawPhotographer()
    drawMamie()
    drawHeli()
    ctx.restore()
    drawFlash()
    drawPopups()
    drawBubbles()
  }

  function drawTitle() {
    drawScene()
    put(panel(250, 68, RAMPS.navy), 35, 42)
    put(logo[0], 160 - Math.round(logo[0].width / 2), 44)
    put(logo[1], 160 - Math.round(logo[1].width / 2), 66)
    drawTextC(ctx, '10 KILOMÈTRES D’EFFORT. 20 CENTIMÈTRES DE CATASTROPHE.', 160, 90, P.grey1)
    if (Math.floor(now * 1.5) % 2) text5C(pointerTouch ? 'TAPOTE POUR DONNER LE DÉPART' : 'ESPACE POUR DONNER LE DÉPART', 160, 98, P.yellow)
    drawHud()
  }

  function drawPlaying() {
    drawScene()
    if (G.banner) {
      const t = now - G.banner.at
      if (t < 2.6) {
        rect(0, 56, W, 22, Math.floor(t * 8) % 2 ? P.red : P.ink)
        rect(0, 56, W, 1, P.pink)
        rect(0, 77, W, 1, P.plum)
        text5C(G.banner.text, 160, 62, P.yellow)
      } else G.banner = null
    }
    if (G.over) {
      rect(0, 56, W, 22, P.ink)
      rect(0, 56, W, 1, P.slate)
      text5C('FIN DE L’ÉPREUVE', 160, 62, P.white)
    }
    if (G.t < 7 && !G.over && Math.floor(now * 2) % 2)
      text5C(pointerTouch ? 'UN TAP QUAND ILS PANIQUENT. PAS AVANT.' : 'ESPACE QUAND ILS PANIQUENT. PAS AVANT.', 160, 148, P.yellow, { outline: P.ink })
    drawNote()
    drawHud()
    if (paused) {
      ctx.drawImage(DIM, 0, 0)
      put(panel(120, 40, RAMPS.navy), 100, 60)
      text5C('PAUSE', 160, 66, P.white)
      text5C(pointerTouch ? 'TAPOTE POUR REPRENDRE' : 'ESPACE POUR REPRENDRE', 160, 82, P.yellow)
    }
  }

  function drawResults() {
    drawScene()
    put(panel(264, 154, RAMPS.navy), 28, 16)
    rect(29, 17, 262, 1, P.yellow)
    rect(29, 168, 262, 1, P.yellow)
    const since = now - stateAt
    text5C('L’ORGANISATION PARLE', 160, 20, P.white)
    text5C('D’UN SUCCÈS.', 160, 30, P.white)
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
      const y = 44 + i * 9
      text5(label, 50, y, P.grey1, {})
      text5(value, 270 - textWidth5(value), y, colour, {})
      for (let x = 50 + textWidth5(label) + 4; x < 266 - textWidth5(value); x += 3) rect(x, y + 8, 1, 1, P.grey3)
    })
    if (since > 1.2) {
      const verdict = G.victims === 0 ? 'AUCUN INCIDENT. LE TAPIS EST DÉÇU.' : G.victims + ' DOSSIERS TRANSMIS À L’ASSURANCE.'
      drawTextC(ctx, verdict, 160, 129, P.white)
      text5C(G.newRecord ? 'NOUVEAU RECORD !' : 'RECORD : ' + pad(best, 6), 160, 139, G.newRecord ? P.yellow : P.grey1, {})
    }
    if (since > C.RESULTS_LOCK && Math.floor(now * 1.5) % 2)
      text5C(pointerTouch ? 'TAPOTE : RECOMMENCER' : 'ESPACE : RECOMMENCER', 160, 154, P.yellow, {})
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
    // Debug only: ?manual=1 freezes the clock, the page drives the game with step().
    if (!(debug && settings.manual)) update(dt)
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
    audio.suspend()
  }
  function resume() {
    if (!paused) return
    paused = false
    lastFrame = performance.now()
    audio.resume()
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
    bodies = []
    team = null
    heli = null
    audio.heli(false)
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
    // Debug only: advance the simulation by dt seconds (tests and reproducible captures).
    step: debug ? (dt = 1 / 60) => update(dt) : undefined,
    get state() {
      return paused ? 'paused' : state === 'TITLE' ? 'idle' : state === 'RESULTS' ? 'over' : 'playing'
    },
    get debug() {
      return debug ? { state, G, skaters, matX, C, audio, sideshow: { bodies, team, heli, mamie } } : null
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
