import { createAudio } from './audio.js'
import { CHART, FAN, FAN_H, FAN_UP, FAN_W, GUITARIST_ARM, GUITARIST_BODY, GUITARIST_H, GUITARIST_W, HEART, SONG } from './data.js'
import { drawText, drawTextC, textWidth } from './font.js'
import { gradeForResult, isPlausibleResult, multiplierForCombo, POINTS } from './scoring.js'

/*
 * FRANCIS HERO — rythme à flèches sur quatre couloirs, dans un manche en perspective.
 * Module au contrat du site : `manifest`, `create(options)`, `validate(result)`, `grade(result)`.
 * Tout est pixel art dessiné au code et pré-rendu dans des canvas hors écran ; chaque image
 * est une pile de `drawImage`.
 */

export const manifest = {
  slug: 'francis-hero',
  title: 'FRANCIS HERO',
  tagline: 'La LAN revient. Le riff aussi.',
  releasedAt: '2026-10-09',
  status: 'live',
  orientation: 'portrait',
  size: { width: 480, height: 640 },
  controls: [
    { action: 'press', label: 'Flèches, WASD / ZQSD, ou tape sur le couloir' },
    { action: 'confirm', key: 'Enter', label: 'Entrée : démarrer' },
  ],
  settings: { song: SONG.file },
}

export const CANVAS_WIDTH = 480
export const MIN_HEIGHT = 640
export const MAX_HEIGHT = 960

/* ---------- réglages ---------- */
const HIT_PERFECT = 0.09
const HIT_GOOD = 0.2
const MAX_CROWD = 24
const STAGE_H = 300
const NECK_TOP_HALF = 78
const NECK_BOTTOM_HALF = 228
const RAIL_TOP = 5
const RAIL_BOTTOM = 16
const ARROW_SIZES = [28, 36, 44, 56]
const MISS_FADE = 0.6
const GOLD_COMBO = 25
const FIRE_COMBO = 50
const SOLO_EVERY = 50

/* ---------- palette (Sweetie 16 et quelques accents) ---------- */
const C = {
  bg: '#1a1c2c',
  wall: '#29366f',
  wallDark: '#1f2a52',
  stageEdge: '#333c57',
  neck: '#0f1322',
  neckLine: '#1e2740',
  fret: '#2a3350',
  fretBright: '#566c86',
  rail: '#8c6417',
  railLight: '#c8963a',
  railDark: '#5a4010',
  ink: '#f4f4f4',
  muted: '#94b0c2',
  gold: '#ffcd75',
  goldDark: '#b8862a',
  green: '#a7f070',
  orange: '#ef7d57',
  red: '#b13e53',
  blue: '#41a6f6',
  purple: '#9d5cff',
  gray: '#6b6b7a',
  grayDark: '#3a3a44',
}
const LANE_COLOURS = [C.orange, C.blue, C.green, C.purple]
const LANE_DARK = ['#9c4a2f', '#1f5f9c', '#5f9a3a', '#5b2fa8']
const LANE_LIGHT = ['#ffb08a', '#9ad2ff', '#d6ffb0', '#d4b4ff']
const SHIRTS = [C.orange, C.blue, C.green, C.gold, '#f4f4f4', C.red]
const HEART_COLOURS = [C.orange, '#ff7aa8', C.gold, C.red]

/* Flèches 7 × 7 par couloir : gauche, bas, haut, droite */
const ARROW_UP = ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '..xxx..', '..xxx..', '..xxx..']
const rot = (m) => m.map((_, r) => m.map((row) => row[r]).reverse().join(''))
const ARROW_RIGHT = rot(ARROW_UP)
const ARROW_DOWN = rot(ARROW_RIGHT)
const ARROW_LEFT = rot(ARROW_DOWN)
const ARROWS = [ARROW_LEFT, ARROW_DOWN, ARROW_UP, ARROW_RIGHT]

const FLAME = [['..y..', '.yo..', '.ooy.', 'yoooy', '.ooo.'], ['.y...', '..yo.', 'yooo.', '.ooo.', '..o..']]
const LIGHTER = ['..y..', '.yoy.', '.ooo.', '..o..', '.ggg.', '.ggg.', '.ggg.']

/* ---------- pré-rendu ---------- */
function sprite(rows, scale, palette, rowShift) {
  const w = Math.max(...rows.map((r) => r.length))
  const margin = rowShift ? 3 : 0
  const c = document.createElement('canvas')
  c.width = w * scale
  c.height = (rows.length + margin * 2) * scale
  const x = c.getContext('2d')
  for (let j = 0; j < rows.length; j++) {
    const shift = rowShift ? rowShift(j) : 0
    for (let i = 0; i < rows[j].length; i++) {
      const col = palette[rows[j][i]]
      if (!col) continue
      x.fillStyle = col
      x.fillRect(i * scale, (j + margin + shift) * scale, scale, scale)
    }
  }
  return c
}

/** Flèche en relief : bordure sombre, face colorée, arête claire en haut à gauche, glyphe blanc. */
function arrowSprite(lane, size, style) {
  const c = document.createElement('canvas')
  c.width = size + 8
  c.height = size + 8
  const x = c.getContext('2d')
  const face = style === 'gold' ? C.gold : style === 'gray' ? C.gray : LANE_COLOURS[lane]
  const dark = style === 'gold' ? C.goldDark : style === 'gray' ? C.grayDark : LANE_DARK[lane]
  const light = style === 'gold' ? '#fff0c0' : style === 'gray' ? '#9a9aa8' : LANE_LIGHT[lane]
  const o = 4
  // ombre portée
  x.fillStyle = 'rgba(0,0,0,.45)'
  x.fillRect(o + 4, o + 4, size, size)
  // bordure
  x.fillStyle = '#000'
  x.fillRect(o, o, size, size)
  // face
  x.fillStyle = face
  x.fillRect(o + 2, o + 2, size - 4, size - 4)
  // arêtes
  x.fillStyle = light
  x.fillRect(o + 2, o + 2, size - 4, 3)
  x.fillRect(o + 2, o + 2, 3, size - 4)
  x.fillStyle = dark
  x.fillRect(o + 2, o + size - 5, size - 4, 3)
  x.fillRect(o + size - 5, o + 2, 3, size - 4)
  // glyphe
  const map = ARROWS[lane]
  const gs = Math.max(2, Math.floor((size - 14) / 7))
  const gx = o + Math.floor((size - 7 * gs) / 2)
  const gy = o + Math.floor((size - 7 * gs) / 2)
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < 7; i++) {
      if (map[j][i] !== 'x') continue
      x.fillStyle = style === 'gold' ? LANE_COLOURS[lane] : style === 'gray' ? '#d0d0d8' : '#ffffff'
      x.fillRect(gx + i * gs, gy + j * gs, gs, gs)
    }
  // pointe brillante
  x.fillStyle = '#ffffff'
  x.fillRect(gx + 3 * gs, gy, gs, gs)
  if (style === 'gray') {
    // fissures
    x.fillStyle = '#000'
    for (let k = 0; k < size / 3; k++) x.fillRect(o + 4 + ((k * 7) % (size - 8)), o + 4 + ((k * 11) % (size - 8)), 2, 2)
  }
  return c
}

/** Réceptacle rond façon pastille de guitare, en deux états. */
function receptorSprite(lane, pressed) {
  const size = 56
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const x = c.getContext('2d')
  const r = size / 2
  const disc = (radius, colour) => {
    x.fillStyle = colour
    for (let j = -radius; j <= radius; j++) {
      const half = Math.floor(Math.sqrt(radius * radius - j * j))
      x.fillRect(r - half, r + j, half * 2, 1)
    }
  }
  disc(27, '#000')
  disc(24, pressed ? LANE_LIGHT[lane] : LANE_COLOURS[lane])
  disc(19, '#000')
  disc(16, pressed ? LANE_COLOURS[lane] : LANE_DARK[lane])
  if (!pressed) {
    x.fillStyle = LANE_LIGHT[lane]
    x.fillRect(r - 10, r - 12, 6, 2)
    x.fillRect(r - 12, r - 10, 2, 4)
  }
  const map = ARROWS[lane]
  x.fillStyle = pressed ? '#ffffff' : LANE_LIGHT[lane]
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (map[j][i] === 'x') x.fillRect(r - 10 + i * 3, r - 10 + j * 3, 3, 3)
  return c
}

/** Anneau de glow en damier (un pixel sur deux) : le halo sans dégradé. */
function glowSprite(lane, radius, thickness, density) {
  const size = radius * 2 + 4
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const x = c.getContext('2d')
  const cx = size / 2
  x.fillStyle = LANE_LIGHT[lane]
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot(i - cx + 0.5, j - cx + 0.5)
      if (d < radius - thickness || d > radius) continue
      if ((i + j) % density !== 0) continue
      x.fillRect(i, j, 1, 1)
    }
  return c
}

/** Anneau d'explosion de réussite. */
function ringSprite(colour, radius) {
  const size = radius * 2 + 4
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const x = c.getContext('2d')
  const cx = size / 2
  x.fillStyle = colour
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot(i - cx + 0.5, j - cx + 0.5)
      if (d >= radius - 3 && d <= radius) x.fillRect(i, j, 1, 1)
    }
  return c
}

/** Télécharge le morceau avec progression ; `play()` doit ensuite partir dans un geste utilisateur. */
export async function loadSong(url, onProgress, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok || !response.body) throw new Error(`Song request failed: ${response.status}`)
  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body.getReader()
  const chunks = []
  let received = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress(total ? Math.min(1, received / total) : 0)
  }
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }))
  await new Promise((resolve, reject) => {
    audio.addEventListener('loadedmetadata', () => resolve(), { once: true })
    audio.addEventListener('error', () => reject(new Error('Song decoding failed')), { once: true })
    audio.load()
  })
  onProgress(1)
  return audio
}

export function create({ canvas, song, height, onState, onEnd }) {
  const W = CANVAS_WIDTH
  const H = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height || MIN_HEIGHT)))
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const audio = createAudio()

  const HIT_Y = H - 110
  const RUNWAY = HIT_Y - STAGE_H
  const SCROLL_TIME = Math.min(2.2, Math.max(1.0, RUNWAY / 220))
  const FEET_Y = 236
  const BEAT = 60 / SONG.bpm
  const SONG_END = CHART[CHART.length - 1][0] + SONG.tailSeconds

  /* ---------- géométrie du manche ---------- */
  const neckT = (y) => Math.max(0, Math.min(1, (y - STAGE_H) / (H - STAGE_H)))
  const neckHalf = (y) => NECK_TOP_HALF + (NECK_BOTTOM_HALF - NECK_TOP_HALF) * neckT(y)
  const laneX = (lane, y) => W / 2 + (lane - 1.5) * ((neckHalf(y) * 2) / 4)
  /** Avancement 0 (haut du manche) → 1 (ligne de frappe), projeté en perspective. */
  const yForProgress = (p) => (p <= 1 ? STAGE_H + RUNWAY * Math.pow(p, 1.5) : HIT_Y + (p - 1) * RUNWAY * 1.6)
  const sizeForProgress = (p) => (p < 0.3 ? 0 : p < 0.55 ? 1 : p < 0.8 ? 2 : 3)

  /* ---------- sprites ---------- */
  const MONO = Object.fromEntries('kshrbgnw'.split('').map((k) => [k, C.ink]))
  const bodySprite = sprite(GUITARIST_BODY, 4, MONO)
  const armSprites = [0, 2, 1, -2, -3].map((shift) => sprite(GUITARIST_ARM, 4, MONO, (row) => (row >= 20 ? shift : row === 19 && shift > 0 ? 1 : 0)))
  const FAN_PAL = { k: C.bg, s: '#f0c8a0', h: '#5a3418', b: '#3b5dc9' }
  const fanSprites = SHIRTS.map((shirt) => ({ idle: sprite(FAN, 4, { ...FAN_PAL, c: shirt }), up: sprite(FAN_UP, 4, { ...FAN_PAL, c: shirt }) }))
  const heartSprites = HEART_COLOURS.map((colour) => sprite(HEART, 2, { r: colour }))
  const flameSprites = FLAME.map((f) => sprite(f, 3, { y: C.gold, o: C.orange }))
  const lighterSprite = sprite(LIGHTER, 3, { y: '#fff8c0', o: C.gold, g: C.muted })
  const arrowSprites = LANE_COLOURS.map((_, lane) => ({
    normal: ARROW_SIZES.map((s) => arrowSprite(lane, s, 'normal')),
    gold: ARROW_SIZES.map((s) => arrowSprite(lane, s, 'gold')),
    gray: ARROW_SIZES.map((s) => arrowSprite(lane, s, 'gray')),
  }))
  const receptors = LANE_COLOURS.map((_, lane) => ({ idle: receptorSprite(lane, false), pressed: receptorSprite(lane, true) }))
  const glows = LANE_COLOURS.map((_, lane) => [glowSprite(lane, 34, 4, 2), glowSprite(lane, 41, 5, 3), glowSprite(lane, 48, 6, 4)])
  const rings = { perfect: [20, 32, 44].map((r) => ringSprite(C.gold, r)), good: [18, 28].map((r) => ringSprite(C.green, r)) }

  /* ---------- placement de la foule ---------- */
  const SLOTS = (() => {
    const out = []
    const fw = FAN_W * 4
    const side = []
    for (const r of [FEET_Y + 44, FEET_Y + 14, FEET_Y + 62]) for (const c of [0, 1, 2]) side.push({ r, c })
    side.sort((a, b) => a.c + Math.abs(a.r - FEET_Y - 30) / 60 - (b.c + Math.abs(b.r - FEET_Y - 30) / 60))
    for (const sl of side) {
      const dx = 104 + sl.c * (fw + 4)
      const jitter = ((sl.c * 7 + sl.r) % 9) - 4
      out.push({ x: Math.round(W / 2 - dx - fw + jitter), y: sl.r + (sl.c % 2 ? 6 : 0), back: false })
      out.push({ x: Math.round(W / 2 + dx - jitter), y: sl.r + (sl.c % 2 ? 0 : 6), back: false })
    }
    for (let k = 0; k < 6; k++) out.push({ x: Math.round(W / 2 - 150 + k * 60 - 24), y: FEET_Y - 24 + (k % 2) * 8, back: true })
    return out.slice(0, MAX_CROWD)
  })()

  /* ---------- état ---------- */
  let G = newGame()
  let state = 'idle' // idle | playing | paused | outro | over
  let raf = 0
  let fadeTimer = null
  let destroyed = false
  let clock = 0
  let lastFrame = performance.now()
  let reveal = 0 // apparition du manche au démarrage
  let outroAt = 0
  let finalGrade = null

  function newGame() {
    return {
      notes: CHART.map(([t, lane]) => ({ t, lane, judged: false, missedAt: null, hitAt: null })),
      pos: -0.5,
      lastSongTime: -1,
      clock: 0,
      score: 0,
      shownScore: 0,
      combo: 0,
      maxCombo: 0,
      hype: 25,
      maxCrowd: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      hits: 0,
      missStreak: 0,
      arm: 0,
      armUntil: 0,
      strumAlt: 0,
      soloUntil: 0,
      multSpinAt: -1,
      lastMult: 1,
      texts: [],
      hearts: [],
      sparks: [],
      bursts: [],
      boos: [],
      confetti: [],
      lastHeart: 0,
      lastFailSound: -1,
      lanePress: [0, 0, 0, 0],
      shake: 0,
      flash: 0,
      gloom: 0,
      surfer: null,
    }
  }
  function setState(next) {
    state = next
    onState?.(next)
  }
  const crowdCount = () => Math.round(Math.pow(G.hype / 100, 1.4) * MAX_CROWD)
  function addHype(v) {
    G.hype = Math.max(0, Math.min(100, G.hype + v))
    G.maxCrowd = Math.max(G.maxCrowd, crowdCount())
  }
  function popText(lane, txt, colour, big = false) {
    G.texts.push({ x: laneX(lane, HIT_Y), y: HIT_Y - 46, txt, colour, until: G.clock + 0.7, big })
  }
  function spawnHeart(i) {
    const slot = SLOTS[i] ?? { x: W / 2, y: FEET_Y }
    G.hearts.push({ x: slot.x + 12 + Math.random() * 16, y: slot.y - FAN_H * 4 - 10, born: G.clock, phase: Math.random() * 6, sprite: heartSprites[Math.floor(Math.random() * heartSprites.length)] })
  }
  function sparks(lane, colour, n, speed) {
    const x = laneX(lane, HIT_Y)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
      G.sparks.push({ x, y: HIT_Y, vx: Math.cos(a) * speed * (0.6 + Math.random() * 0.6), vy: Math.sin(a) * speed * (0.6 + Math.random() * 0.6) - 40, born: G.clock, colour })
    }
  }
  function failSound() {
    if (G.clock - G.lastFailSound < 0.15) return
    G.lastFailSound = G.clock
    audio.fail()
  }
  function onMiss(lane, penalty) {
    G.combo = 0
    G.missStreak++
    addHype(-penalty)
    G.arm = 3
    G.armUntil = G.clock + 0.3
    G.shake = 4
    popText(lane, 'RATÉ', C.orange)
    failSound()
    if (G.missStreak === 3) {
      G.gloom = 1
      audio.boo()
      for (let i = 0; i < 3; i++) {
        const slot = SLOTS[Math.floor(Math.random() * Math.max(1, crowdCount()))] ?? SLOTS[0]
        G.boos.push({ x: slot.x + 10, y: slot.y - FAN_H * 4 - 14, born: G.clock + i * 0.15 })
      }
      G.missStreak = 0
    }
  }

  /** Jugement d'une pression ; renvoie 'perfect' | 'good' | 'miss' | null. */
  function press(lane) {
    if (state !== 'playing') return null
    const now = G.pos
    G.lanePress[lane] = G.clock
    let best = null
    let bestDistance = HIT_GOOD
    for (const n of G.notes) {
      if (n.t - now > HIT_GOOD) break
      if (n.judged || n.lane !== lane) continue
      const d = Math.abs(n.t - now)
      if (d <= bestDistance) {
        bestDistance = d
        best = n
      }
    }
    if (!best) {
      onMiss(lane, 3)
      sparks(lane, C.gray, 4, 60)
      return 'miss'
    }
    best.judged = true
    best.hitAt = G.clock
    const perfect = bestDistance <= HIT_PERFECT
    G.combo++
    G.missStreak = 0
    G.maxCombo = Math.max(G.maxCombo, G.combo)
    G.score += (perfect ? POINTS.perfect : POINTS.good) * multiplierForCombo(G.combo)
    if (perfect) G.perfect++
    else G.good++
    G.hits++
    addHype(perfect ? 4 : 2)
    G.arm = G.strumAlt++ % 2 ? 1 : 2
    G.armUntil = G.clock + 0.16
    const mult = multiplierForCombo(G.combo)
    if (mult !== G.lastMult) {
      G.lastMult = mult
      G.multSpinAt = G.clock
    }
    G.bursts.push({ lane, kind: perfect ? 'perfect' : 'good', born: G.clock })
    sparks(lane, perfect ? C.gold : C.green, perfect ? 10 : 6, perfect ? 160 : 110)
    popText(lane, perfect ? 'PARFAIT' : 'BIEN', perfect ? C.gold : C.green, perfect)
    if (perfect) G.flash = 1
    audio.ping(G.hits, perfect)
    audio.spark()
    const crowd = crowdCount()
    if (crowd > 0) {
      spawnHeart(Math.floor(Math.random() * crowd))
      if (perfect && crowd > 3) spawnHeart(Math.floor(Math.random() * crowd))
    }
    if (G.combo % 25 === 0) audio.cheer(8)
    if (G.combo > 0 && G.combo % SOLO_EVERY === 0) {
      G.soloUntil = G.clock + 1.2
      audio.solo()
    }
    return perfect ? 'perfect' : 'good'
  }

  /* ---------- boucle ---------- */
  function frame(nowMs) {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (nowMs - lastFrame) / 1000)
    lastFrame = nowMs
    clock += dt
    if (reveal < 1) reveal = Math.min(1, reveal + dt / 0.8)
    if (state === 'playing') {
      G.clock += dt
      const songTime = song.currentTime
      if (songTime !== G.lastSongTime) {
        G.lastSongTime = songTime
        G.pos = songTime
      } else if (!song.paused) G.pos += dt
      for (const n of G.notes) {
        if (!n.judged && G.pos - n.t > HIT_GOOD) {
          n.judged = true
          n.missedAt = G.clock
          G.miss++
          onMiss(n.lane, 6)
        }
      }
      if (G.pos >= SONG_END - 10 && !G.surfer) G.surfer = { x: -40, born: G.clock }
      if (G.pos >= SONG_END || song.ended) {
        startOutro()
      }
    } else if (state === 'outro') {
      G.clock += dt
      if (clock - outroAt > 1.6) finish()
    } else if (state === 'over') {
      G.clock += dt
    }
    draw()
  }

  function startOutro() {
    setState('outro')
    outroAt = clock
    fadeOutSong()
    finalGrade = gradeForResult(G)
    if (finalGrade === 'S') audio.smash()
    else audio.lightsOff()
  }
  function finish() {
    setState('over')
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(frame)
    if (finalGrade === 'S' || finalGrade === 'A') {
      for (let i = 0; i < 120; i++) G.confetti.push({ x: Math.random() * W, y: -Math.random() * 200, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80, colour: [C.gold, C.green, C.blue, C.orange, C.purple][i % 5], phase: Math.random() * 6 })
      audio.cheer(12)
    }
    onEnd?.({ score: G.score, maxCombo: G.maxCombo, perfect: G.perfect, good: G.good, miss: G.miss, maxCrowd: G.maxCrowd })
  }
  function clearFade() {
    if (fadeTimer) clearInterval(fadeTimer)
    fadeTimer = null
  }
  function fadeOutSong() {
    clearFade()
    let volume = song.volume
    fadeTimer = setInterval(() => {
      volume -= 0.05
      if (volume <= 0) {
        clearFade()
        song.pause()
      } else song.volume = volume
    }, 80)
  }

  /* ---------- dessin ---------- */
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  const beatPhase = () => ((((G.pos - SONG.offset) % BEAT) + BEAT) % BEAT) / BEAT
  const barPhase = () => ((((G.pos - SONG.offset) % (BEAT * 4)) + BEAT * 4) % (BEAT * 4)) / (BEAT * 4)

  function drawStage() {
    const bp = beatPhase()
    const pulse = 1 - bp
    const hype = G.hype / 100
    const now = G.clock
    const parallax = Math.round(Math.sin(now * 2) * 2 * hype)
    const outroK = state === 'outro' ? Math.min(1, (clock - outroAt) / 1.2) : 0
    // Mur du fond, en bandes
    rect(0, 0, W, STAGE_H, C.bg)
    for (let y = 0; y < 170; y += 6) rect(0, y, W, 3, y % 12 ? C.wallDark : C.wall)
    rect(0, 30 + parallax, W, 2, C.stageEdge)
    // Projecteurs : trois cônes qui balaient, en lignes de 4 px
    const lights = [
      { x: 90, colour: '255,205,117', speed: 0.6 },
      { x: 240, colour: '65,166,246', speed: 0.9 },
      { x: 390, colour: '239,125,87', speed: 0.7 },
    ]
    lights.forEach((l, i) => {
      if (state === 'outro' && outroK * 3 > i + 0.3) return
      const angle = Math.sin(now * l.speed * (0.4 + hype * 1.2) + i * 2) * 0.6
      const alpha = 0.08 + 0.18 * hype * pulse
      const width = 40 + hype * 50
      for (let y = 0; y < STAGE_H; y += 4) {
        const t = y / STAGE_H
        const cx = l.x + Math.tan(angle) * y
        const w = 6 + width * t
        ctx.fillStyle = `rgba(${l.colour},${(alpha * (1 - t * 0.5)).toFixed(3)})`
        ctx.fillRect(Math.round(cx - w / 2), y, Math.round(w), 4)
      }
      rect(l.x - 10, 0, 20, 8, C.stageEdge)
      rect(l.x - 6, 8, 12, 4, state === 'outro' && outroK * 3 > i + 0.3 ? C.grayDark : C.gold)
    })
    // Stroboscope sur les temps forts à forte hype
    if (state === 'playing' && G.hype > 80 && bp < 0.08 && barPhase() < 0.3) rect(0, 0, W, STAGE_H, 'rgba(255,255,255,.22)')
    // Scène
    rect(0, 170 + parallax / 2, W, 130, '#141022')
    rect(0, 170 + parallax / 2, W, 4, C.stageEdge)
    // Foule derrière, Francis, foule devant
    const crowd = crowdCount()
    const excited = G.hype > 55
    const order = []
    for (let i = 0; i < crowd; i++) order.push(i)
    order.sort((a, b) => SLOTS[a].y - SLOTS[b].y)
    const drawFan = (i) => {
      const slot = SLOTS[i]
      const bounce = excited ? Math.abs(Math.sin((now * SONG.bpm / 60 + i * 0.7) * Math.PI)) * (G.hype > 80 ? 8 : 4) : Math.sin(now * 2 + i)
      const set = fanSprites[i % fanSprites.length]
      const up = excited && (i + Math.floor(now * 4)) % 3 === 0
      const y = Math.round(slot.y - FAN_H * 4 - bounce)
      ctx.drawImage(up ? set.up : set.idle, slot.x + (slot.back ? parallax : 0), y)
      if (G.hype > 70 && i % 2 === 0) ctx.drawImage(lighterSprite, slot.x + 2 + Math.round(Math.sin(now * 3 + i) * 2), y - 22 + Math.round(Math.sin(now * 5 + i) * 2))
    }
    for (const i of order) if (SLOTS[i].back) drawFan(i)
    // Francis : repos, deux grattes, raté, solo, affaissement
    const solo = now < G.soloUntil
    const slump = state === 'playing' && G.hype < 20
    const idleArm = state === 'playing' && G.hype > 70 ? (bp < 0.5 ? 1 : 2) : 0
    const arm = solo ? 4 : now < G.armUntil ? G.arm : slump ? 0 : idleArm
    const gx = W / 2 - (GUITARIST_W * 4) / 2
    const gy = FEET_Y - GUITARIST_H * 4 + (solo ? -6 : slump ? 3 : 0)
    if (state === 'over' && finalGrade === 'S') {
      // Francis casse sa guitare : bras qui martèle, éclats
      const k = Math.floor(G.clock * 8) % 2
      ctx.drawImage(bodySprite, gx, gy)
      ctx.drawImage(armSprites[k ? 4 : 1], gx, gy - 12)
    } else {
      ctx.drawImage(bodySprite, gx, gy)
      ctx.drawImage(armSprites[arm], gx, gy - 12)
    }
    if (solo) {
      for (let i = 0; i < 6; i++) {
        const a = now * 6 + i
        rect(Math.round(W / 2 + Math.cos(a) * 60), Math.round(FEET_Y - 120 + Math.sin(a * 1.3) * 30), 4, 4, i % 2 ? C.gold : C.ink)
      }
    }
    for (const i of order) if (!SLOTS[i].back) drawFan(i)
    // Crowd surfer en fin de morceau
    if (G.surfer) {
      G.surfer.x += 0.6
      const sy = FEET_Y - 70 + Math.round(Math.sin(now * 6) * 4)
      ctx.save()
      ctx.translate(Math.round(G.surfer.x), sy)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(fanSprites[3].up, -24, -56)
      ctx.restore()
      if (G.surfer.x > W + 60) G.surfer = null
    }
    // Cœurs
    if (state === 'playing' && G.hype > 70 && crowd > 0 && now - G.lastHeart > (G.hype > 90 ? 0.25 : 0.5)) {
      spawnHeart(Math.floor(Math.random() * crowd))
      G.lastHeart = now
    }
    G.hearts = G.hearts.filter((h) => now - h.born <= 2)
    for (const h of G.hearts) {
      const age = now - h.born
      ctx.globalAlpha = Math.max(0, 1 - age / 2)
      ctx.drawImage(h.sprite, Math.round(h.x + Math.sin(age * 4 + h.phase) * 4), Math.round(h.y - age * 18))
    }
    ctx.globalAlpha = 1
    // Huées
    G.boos = G.boos.filter((b) => now - b.born < 1.4 && now >= b.born)
    for (const b of G.boos) {
      const age = now - b.born
      const y = Math.round(b.y - age * 24)
      rect(b.x - 2, y - 2, 30, 13, C.ink)
      drawText(ctx, 'BOUH', b.x + 2, y, C.bg)
    }
    // Vumètre de hype à gauche de la scène
    const vx = 8
    const vy = 60
    rect(vx - 2, vy - 2, 20, 204, '#000')
    rect(vx, vy, 16, 200, C.neck)
    const segments = 20
    const lit = Math.round((G.hype / 100) * segments)
    for (let i = 0; i < segments; i++) {
      const sy = vy + 200 - (i + 1) * 10 + 2
      const colour = i < 8 ? C.green : i < 14 ? C.gold : C.orange
      rect(vx + 2, sy, 12, 7, i < lit ? colour : '#1e2740')
    }
    const needle = vy + 200 - lit * 10 + Math.round((Math.random() - 0.5) * 4 * (G.hype > 70 ? 1 : 0.3))
    rect(vx - 2, needle, 20, 2, C.ink)
    drawTextC(ctx, 'HYPE', vx + 8, vy + 206, C.muted)
    // Extinction des projecteurs en outro
    if (state === 'outro') rect(0, 0, W, STAGE_H, `rgba(0,0,0,${(outroK * 0.6).toFixed(2)})`)
  }

  function drawNeck() {
    const now = G.clock
    const bp = beatPhase()
    const bottom = STAGE_H + Math.round((H - STAGE_H) * reveal)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, STAGE_H, W, bottom - STAGE_H)
    ctx.clip()
    // Corps du manche : trapèze en lignes de 2 px pour garder les bords en escalier
    for (let y = STAGE_H; y < H; y += 2) {
      const half = Math.round(neckHalf(y))
      rect(W / 2 - half, y, half * 2, 2, C.neck)
    }
    // Séparations des couloirs
    for (let b = 0; b <= 4; b++) {
      for (let y = STAGE_H; y < H; y += 2) {
        const half = neckHalf(y)
        const x = Math.round(W / 2 - half + (half * 2 * b) / 4)
        rect(x, y, 1, 2, C.neckLine)
      }
    }
    // Frettes : une par temps, plus épaisses sur les mesures
    const firstBeat = Math.floor((G.pos - SONG.offset) / BEAT) - 1
    for (let k = firstBeat; k < firstBeat + 40; k++) {
      const beatTime = SONG.offset + k * BEAT
      const p = 1 - (beatTime - G.pos) / SCROLL_TIME
      if (p < 0 || p > 1.12) continue
      const y = Math.round(yForProgress(p))
      const half = Math.round(neckHalf(y))
      const bar = ((k % 4) + 4) % 4 === 0
      rect(W / 2 - half, y, half * 2, bar ? 3 : 2, bar ? C.fretBright : C.fret)
      rect(W / 2 - half, y - 1, half * 2, 1, bar ? '#7f9bc9' : '#3a4568')
    }
    // Rails en bois avec reflet qui pulse
    const shine = Math.round((1 - bp) * 3)
    for (let y = STAGE_H; y < H; y += 2) {
      const half = Math.round(neckHalf(y))
      const rw = Math.round(RAIL_TOP + (RAIL_BOTTOM - RAIL_TOP) * neckT(y))
      rect(W / 2 - half - rw, y, rw, 2, C.rail)
      rect(W / 2 + half, y, rw, 2, C.rail)
      rect(W / 2 - half - rw, y, 1, 2, C.railDark)
      rect(W / 2 + half + rw - 1, y, 1, 2, C.railDark)
      if ((y >> 1) % 7 < shine) {
        rect(W / 2 - half - rw + 1, y, 2, 2, C.railLight)
        rect(W / 2 + half + rw - 3, y, 2, 2, C.railLight)
      }
    }
    // Ligne de frappe qui pulse avec le kick
    const lineHalf = Math.round(neckHalf(HIT_Y))
    ctx.globalAlpha = 0.35 + 0.45 * (1 - bp)
    rect(W / 2 - lineHalf, HIT_Y - 1, lineHalf * 2, 3, C.gold)
    ctx.globalAlpha = 1
    if (bp < 0.1) rect(W / 2 - lineHalf, HIT_Y, lineHalf * 2, 1, C.ink)
    // Réceptacles, glow et étincelles
    for (let l = 0; l < 4; l++) {
      const x = Math.round(laneX(l, HIT_Y))
      const pressed = now - G.lanePress[l] < 0.12
      const breathe = 0.5 + 0.5 * Math.sin(now * 4 + l)
      const glowSet = glows[l]
      ctx.globalAlpha = 0.35 + 0.35 * breathe + (pressed ? 0.3 : 0)
      ctx.drawImage(glowSet[0], x - glowSet[0].width / 2, HIT_Y - glowSet[0].height / 2)
      ctx.globalAlpha = 0.18 + 0.25 * breathe + (pressed ? 0.3 : 0)
      ctx.drawImage(glowSet[1], x - glowSet[1].width / 2, HIT_Y - glowSet[1].height / 2)
      if (pressed || G.hype > 60) {
        ctx.globalAlpha = pressed ? 0.5 : 0.12 * breathe
        ctx.drawImage(glowSet[2], x - glowSet[2].width / 2, HIT_Y - glowSet[2].height / 2)
      }
      ctx.globalAlpha = 1
      const spr = pressed ? receptors[l].pressed : receptors[l].idle
      ctx.drawImage(spr, x - 28, HIT_Y - 28 + (pressed ? 2 : 0))
    }
    // Flèches : fantômes de traînée puis la flèche, taille selon la distance
    const gold = G.combo >= GOLD_COMBO
    const fire = G.combo >= FIRE_COMBO
    for (const n of G.notes) {
      const missedAge = n.missedAt === null ? 0 : now - n.missedAt
      if (n.judged && (n.missedAt === null || missedAge > MISS_FADE)) continue
      const dtNote = n.t - G.pos
      const p = 1 - dtNote / SCROLL_TIME
      if (p < 0) break
      const size = sizeForProgress(Math.min(1, p))
      const set = arrowSprites[n.lane]
      if (n.missedAt !== null) {
        // La flèche ratée vire au gris, se fissure et tombe hors du manche en tournant
        const k = missedAge / MISS_FADE
        const spr = set.gray[3]
        ctx.save()
        ctx.globalAlpha = 1 - k
        ctx.translate(laneX(n.lane, HIT_Y) + (n.lane < 2 ? -1 : 1) * k * 90, HIT_Y + k * k * 220)
        ctx.rotate((n.lane < 2 ? -1 : 1) * k * 2.5)
        ctx.drawImage(spr, -spr.width / 2, -spr.height / 2)
        ctx.restore()
        continue
      }
      const y = yForProgress(p)
      const x = laneX(n.lane, y)
      const trailLen = 2 + Math.min(2, Math.floor(G.combo / 20))
      for (let g = trailLen; g >= 1; g--) {
        const pg = p - g * 0.035
        if (pg < 0) continue
        const yg = yForProgress(pg)
        const xg = laneX(n.lane, yg)
        const sg = set.normal[sizeForProgress(Math.min(1, pg))]
        ctx.globalAlpha = 0.12 * (trailLen - g + 1) / trailLen
        ctx.drawImage(sg, Math.round(xg - sg.width / 2), Math.round(yg - sg.height / 2))
      }
      ctx.globalAlpha = 1
      const spr = (gold ? set.gold : set.normal)[size]
      ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2))
      if (fire) {
        const f = flameSprites[Math.floor(now * 10 + n.lane) % 2]
        ctx.drawImage(f, Math.round(x - f.width / 2 + Math.sin(now * 9 + n.t) * 3), Math.round(y - spr.height / 2 - f.height + 4))
      }
      // Accord : lien entre deux flèches au même instant
      const twin = G.notes.find((m) => m !== n && !m.judged && m.t === n.t)
      if (twin && twin.lane > n.lane) {
        const x2 = laneX(twin.lane, y)
        rect(Math.round(Math.min(x, x2)), Math.round(y - 2), Math.round(Math.abs(x2 - x)), 4, C.ink)
      }
    }
    // Explosions de réussite
    G.bursts = G.bursts.filter((b) => now - b.born < 0.4)
    for (const b of G.bursts) {
      const k = (now - b.born) / 0.4
      const set = rings[b.kind]
      const idx = Math.min(set.length - 1, Math.floor(k * set.length))
      const r = set[idx]
      ctx.globalAlpha = 1 - k
      ctx.drawImage(r, Math.round(laneX(b.lane, HIT_Y) - r.width / 2), Math.round(HIT_Y - r.height / 2))
    }
    ctx.globalAlpha = 1
    // Étincelles
    G.sparks = G.sparks.filter((s) => now - s.born < 0.5)
    for (const s of G.sparks) {
      const age = now - s.born
      const x = s.x + s.vx * age
      const y = s.y + s.vy * age + 300 * age * age
      ctx.globalAlpha = 1 - age / 0.5
      rect(Math.round(x), Math.round(y), 3, 3, s.colour)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  function drawHud() {
    const now = G.clock
    // Textes de jugement
    G.texts = G.texts.filter((t) => now < t.until)
    for (const t of G.texts) {
      const a = (t.until - now) / 0.7
      const bounce = t.big ? Math.abs(Math.sin((1 - a) * Math.PI * 3)) * 6 : 0
      ctx.globalAlpha = Math.max(0, a)
      ctx.save()
      ctx.translate(Math.round(t.x), Math.round(t.y - (1 - a) * 30 - bounce))
      ctx.scale(2, 2)
      drawTextC(ctx, t.txt, 1, 1, '#000')
      drawTextC(ctx, t.txt, 0, 0, t.colour)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    // Score qui roule
    G.shownScore += (G.score - G.shownScore) * 0.2
    if (Math.abs(G.score - G.shownScore) < 1) G.shownScore = G.score
    ctx.save()
    ctx.translate(14, 10)
    ctx.scale(2, 2)
    drawText(ctx, 'SCORE ' + String(Math.round(G.shownScore)).padStart(6, '0'), 0, 0, C.ink)
    ctx.restore()
    ctx.save()
    ctx.translate(W - 14, 10)
    ctx.scale(2, 2)
    const crowdText = 'FOULE ' + crowdCount()
    drawText(ctx, crowdText, -textWidth(crowdText), 0, C.muted)
    ctx.restore()
    // Combo et multiplicateur
    if (G.combo >= 5) {
      const mult = multiplierForCombo(G.combo)
      const spin = G.multSpinAt >= 0 && now - G.multSpinAt < 0.35 ? Math.abs(Math.cos(((now - G.multSpinAt) / 0.35) * Math.PI)) : 1
      ctx.save()
      ctx.translate(W / 2, STAGE_H - 26)
      ctx.scale(2 + Math.min(1, G.combo / 40), 2 + Math.min(1, G.combo / 40))
      drawTextC(ctx, `${G.combo} COMBO`, 1, 1, '#000')
      drawTextC(ctx, `${G.combo} COMBO`, 0, 0, G.combo >= GOLD_COMBO ? C.gold : C.ink)
      ctx.restore()
      ctx.save()
      ctx.translate(W / 2, STAGE_H - 46)
      ctx.scale(2 * spin, 2)
      drawTextC(ctx, `x${mult}`, 0, 0, C.gold)
      ctx.restore()
    }
    // Barre de progression du morceau
    rect(0, H - 4, W, 4, C.neckLine)
    rect(0, H - 4, Math.round(W * Math.min(1, Math.max(0, G.pos / SONG_END))), 4, C.gold)
    // Cadre lumineux qui monte avec le combo
    if (G.combo >= 20) {
      const k = Math.min(1, (G.combo - 20) / 30)
      const a = (0.15 + 0.35 * k) * (0.7 + 0.3 * Math.sin(now * 6))
      ctx.globalAlpha = a
      const colour = G.combo >= FIRE_COMBO ? C.orange : C.gold
      rect(0, 0, W, 4, colour)
      rect(0, H - 8, W, 4, colour)
      rect(0, 0, 4, H, colour)
      rect(W - 4, 0, 4, H, colour)
      ctx.globalAlpha = 1
    } else {
      // Vignette sombre à combo nul
      ctx.globalAlpha = 0.25
      rect(0, 0, W, 6, '#000')
      rect(0, 0, 6, H, '#000')
      rect(W - 6, 0, 6, H, '#000')
      ctx.globalAlpha = 1
    }
    // Flash blanc d'une image sur un parfait, assombrissement après trois ratés
    if (G.flash > 0) {
      rect(0, 0, W, H, `rgba(255,255,255,${(0.18 * G.flash).toFixed(2)})`)
      G.flash = Math.max(0, G.flash - 0.35)
    }
    if (G.gloom > 0) {
      rect(0, 0, W, H, `rgba(120,120,130,${(0.22 * G.gloom).toFixed(2)})`)
      G.gloom = Math.max(0, G.gloom - 0.02)
    }
  }

  function draw() {
    ctx.save()
    if (G.shake > 0) {
      ctx.translate(Math.round((Math.random() - 0.5) * G.shake * 2), Math.round((Math.random() - 0.5) * G.shake * 2))
      G.shake *= 0.85
      if (G.shake < 0.3) G.shake = 0
    }
    rect(-10, -10, W + 20, H + 20, C.bg)
    drawStage()
    drawNeck()
    // Confettis de fin
    if (G.confetti.length) {
      for (const c of G.confetti) {
        c.x += c.vx * 0.016 + Math.sin(G.clock * 3 + c.phase) * 0.6
        c.y += c.vy * 0.016
        if (c.y > H) c.y = -10
        rect(Math.round(c.x), Math.round(c.y), 4, 3, c.colour)
      }
    }
    ctx.restore()
    drawHud()
  }

  /* ---------- contrôles ---------- */
  function onVisibility() {
    if (document.hidden && state === 'playing') pause()
  }
  document.addEventListener('visibilitychange', onVisibility)

  async function start() {
    if (destroyed) return
    clearFade()
    cancelAnimationFrame(raf)
    audio.resume()
    song.pause()
    song.currentTime = 0
    song.volume = 0.9
    G = newGame()
    finalGrade = null
    reveal = 0
    lastFrame = performance.now()
    await song.play()
    setState('playing')
    raf = requestAnimationFrame(frame)
  }
  function pause() {
    if (state !== 'playing') return
    song.pause()
    setState('paused')
  }
  async function resume() {
    if (state !== 'paused') return
    lastFrame = performance.now()
    await song.play()
    setState('playing')
  }
  function seek(seconds) {
    song.currentTime = seconds
  }
  function stop() {
    cancelAnimationFrame(raf)
    clearFade()
    song.pause()
    setState('idle')
    raf = requestAnimationFrame(frame)
  }
  function destroy() {
    destroyed = true
    cancelAnimationFrame(raf)
    clearFade()
    document.removeEventListener('visibilitychange', onVisibility)
    song.pause()
  }

  raf = requestAnimationFrame(frame)
  return {
    start,
    press,
    pause,
    resume,
    seek,
    stop,
    destroy,
    unlock: () => audio.resume(),
    get state() {
      return state
    },
    get lanes() {
      return [0, 1, 2, 3].map((l) => laneX(l, HIT_Y))
    },
  }
}

export function validate(result) {
  if (!result || typeof result !== 'object') return false
  return isPlausibleResult(result)
}
export function grade(result) {
  return gradeForResult(result)
}
