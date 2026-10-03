import { createAudio } from './audio.js'
import { drawText, drawTextC, LINE_H, textWidth } from './font.js'

/*
 * OÙ EST LA VOITURE ? — « Elle était là il y a deux secondes. »
 *
 * A shell game. Buildings are the cups, the FIFA car is the pea. You always find it; a hand
 * always moves it. Sixty seconds, one action (tap a building). Follows the games-site module
 * contract: `manifest`, `create(options)`, `validate(result)`, `grade(result)`.
 * Internal resolution 320 × 180, pixel art drawn in code.
 */

export const manifest = {
  slug: 'ou-est-la-voiture',
  title: 'OÙ EST LA VOITURE ?',
  tagline: 'Elle était là il y a deux secondes.',
  releasedAt: '2026-10-20',
  status: 'draft',
  orientation: 'landscape',
  size: { width: 320, height: 180 },
  controls: [
    { action: 'pointer', label: 'Tape sur le bâtiment où est la voiture' },
    { action: 'confirm', key: 'Space', label: 'Espace ou Entrée : valider les écrans' },
  ],
  settings: { durationSeconds: 60 },
}

const W = 320
const H = 180
const P = {
  black: '#101010',
  white: '#f4f4f4',
  grey: '#c0c0c0',
  dark: '#505050',
  wall: '#3b4a6b',
  wallLight: '#4a5c80',
  counter: '#8b5a2b',
  counterTop: '#b07a40',
  counterDark: '#5c3a18',
  yellow: '#f3c40c',
  red: '#d12c2c',
  green: '#22a62f',
  blue: '#1b3a8c',
  skin: '#f0c8a0',
  paper: '#f4f1e6',
  car: '#161616',
}

/** The cups: a building silhouette with a label; colour by institution. */
const BUILDINGS = [
  { label: 'FIFA', colour: '#1b3a8c', roof: '#132a66' },
  { label: 'FFF', colour: '#1c5a9c', roof: '#143f70' },
  { label: 'PRÉFECTURE', colour: '#6a4a7a', roof: '#4a3256' },
  { label: 'GARAGE', colour: '#8a4a2a', roof: '#5e321c' },
  { label: 'FOURRIÈRE', colour: '#5a5a5a', roof: '#3a3a3a' },
]
const EXCUSES = [
  'TRANSFERT INTERNE.',
  'PAS LE BON SERVICE.',
  'LE VÉHICULE N’EST PAS DANS NOTRE SYSTÈME.',
  'VOUS AVEZ LE CERFA ?',
  'RÉORGANISATION DU PARC.',
  'LE DOSSIER A ÉTÉ TRANSMIS.',
  'C’EST LA LOGISTIQUE ÉVÉNEMENTIELLE.',
  'VEUILLEZ PATIENTER.',
  'MISE À JOUR DE L’INVENTAIRE.',
  'LE COLLÈGUE EST EN PAUSE.',
  'AUCUN ORDRE DE RESTITUTION.',
  'VOUS ÊTES DÉJÀ VENU AUJOURD’HUI ?',
  'CE N’EST PAS LA NÔTRE.',
  'ELLE EST EN COURS DE TRAITEMENT.',
]

const CUP_W = 46
const CUP_H = 40
const COUNTER_Y = 132
const LIFT = 26

/* ---------- sprites ---------- */
const CAR = ['..kkkkkkkkkkkkkk....', '.kkwwwwwwwwkkkkkk...', 'kkkkkkkkkkkkkkkkkkky', 'kkkkkkkkkkkkkkkkkkky', '..kk..........kk....']
const HAND = ['......sss.....', '....sssssss...', '..sssssssssss.', '.ssssssssssss.', 'sssssssssssss.', 'ssssssssssss..', '.sssssssss....', '..ssssssss....', '...sssss......', '...sss........']
const CLAP = ['....sss..sss..', '...sssssssss..', '..sssssssssss.', '..sssssssssss.', '..sssssssssss.', '...sssssssss..', '....sssssss...', '.....sssss....', '......sss.....', '......sss.....']

function blit(ctx, rows, map, x, y) {
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = map[rows[j][i]]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x + i, y + j, 1, 1)
    }
}

export function create({ canvas, settings = manifest.settings, onState, onEnd }) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const audio = createAudio()
  const DURATION = settings.durationSeconds ?? 60

  let phase = 'title' // title | playing | over
  let G = null
  let raf = 0
  let destroyed = false
  let lastFrame = performance.now()
  let clock = 0
  let phaseAt = 0
  const pointer = { x: 160, y: 90, touch: false, inside: false }
  let paused = false

  function setPhase(next) {
    phase = next
    phaseAt = clock
    onState?.(next === 'title' ? 'idle' : next === 'over' ? 'over' : 'playing')
  }

  function newGame() {
    return {
      t: 0,
      found: 0,
      combo: 0,
      maxCombo: 0,
      misses: 0,
      pounds: 0,
      cups: [], // { id, slot, x, lift, carUnder, twin, cerfa }
      step: 'intro',
      stepAt: 0,
      swaps: [], // remaining swaps of the current shuffle
      swap: null, // { a, b, from, to, start, dur }
      hand: null, // { x, y, from, to, start, dur, carry, clap }
      message: null, // { text, colour, until, big }
      excuse: null,
      guessDeadline: 0,
      chosen: -1,
      lastTick: 0,
      shakes: 0,
    }
  }

  /* ---------- layout ---------- */
  function slotX(slot, count) {
    const gap = Math.min(16, (W - 20 - count * CUP_W) / Math.max(1, count - 1))
    const total = count * CUP_W + (count - 1) * gap
    return Math.round((W - total) / 2 + slot * (CUP_W + gap))
  }
  function layout() {
    const n = G.cups.length
    for (const cup of G.cups) cup.x = slotX(cup.slot, n)
  }
  function cupAt(x, y) {
    const m = pointer.touch ? 6 : 2
    for (const cup of G.cups) {
      if (x >= cup.x - m && x < cup.x + CUP_W + m && y >= COUNTER_Y - CUP_H - LIFT - m && y < COUNTER_Y + 8 + m) return cup
    }
    return null
  }

  /* ---------- difficulty ---------- */
  const level = () => Math.min(1, G.t / DURATION)
  function wantedCups() {
    return G.t < 20 ? 3 : G.t < 40 ? 4 : 5
  }
  function shuffleCount() {
    return 3 + Math.floor(G.t / 9)
  }
  function swapDuration() {
    return Math.max(0.17, 0.5 - G.t * 0.0055)
  }

  function say(text, colour = P.yellow, big = false, dur = 1.2) {
    G.message = { text, colour, until: G.t + dur, big }
  }

  /* ---------- round steps ---------- */
  function setStep(step) {
    G.step = step
    G.stepAt = G.t
  }

  function addCupIfNeeded() {
    const want = wantedCups()
    while (G.cups.length < want) {
      const id = G.cups.length
      G.cups.push({ id, slot: id, x: 0, lift: 0, carUnder: false, twin: false, cerfa: false })
      layout()
      say(BUILDINGS[id].label + ' REJOINT LE DOSSIER.', P.grey)
      audio.paper()
    }
  }

  function startRound(first) {
    for (const cup of G.cups) {
      cup.twin = false
      cup.cerfa = false
    }
    addCupIfNeeded()
    if (first) {
      G.cups[0].carUnder = true
    }
    // Late game: a second, identical car under another building.
    if (G.t >= 48 && Math.random() < 0.5) {
      const others = G.cups.filter((c) => !c.carUnder)
      others[Math.floor(Math.random() * others.length)].twin = true
    }
    setStep('reveal')
    audio.lift()
  }

  function startShuffle() {
    const n = G.cups.length
    const count = shuffleCount()
    G.swaps = []
    for (let i = 0; i < count; i++) {
      let a = Math.floor(Math.random() * n)
      let b = Math.floor(Math.random() * (n - 1))
      if (b >= a) b++
      G.swaps.push([a, b])
    }
    // The hand may cheat during the shuffle, in plain sight.
    G.cheatAt = G.t >= 32 && Math.random() < 0.65 ? Math.floor(Math.random() * Math.max(1, count - 1)) + 1 : -1
    G.swapIndex = 0
    setStep('shuffle')
    nextSwap()
  }

  function nextSwap() {
    if (G.swapIndex >= G.swaps.length) {
      G.swap = null
      setStep('guess')
      G.guessDeadline = G.t >= 40 ? G.t + 3.2 : 0
      return
    }
    const [sa, sb] = G.swaps[G.swapIndex]
    const a = G.cups.find((c) => c.slot === sa)
    const b = G.cups.find((c) => c.slot === sb)
    G.swap = { a, b, fromA: a.x, fromB: b.x, start: G.t, dur: swapDuration() }
    audio.swish()
    if (G.swapIndex === G.cheatAt) startHandMove(true)
    G.swapIndex++
  }

  /** The hand carries the car from its building to another one. */
  function startHandMove(duringShuffle) {
    const from = G.cups.find((c) => c.carUnder)
    const others = G.cups.filter((c) => c !== from)
    const to = others[Math.floor(Math.random() * others.length)]
    if (!from || !to) return
    G.hand = { from, to, start: G.t, dur: duringShuffle ? 0.5 : 0.9, carry: true, duringShuffle }
    audio.hand()
  }

  function finishHandMove() {
    const h = G.hand
    h.from.carUnder = false
    h.to.carUnder = true
    G.hand = null
    if (!h.duringShuffle) startShuffle()
  }

  function guess(cup) {
    G.chosen = cup.id
    audio.tap()
    const car = cup.carUnder
    if (car && G.t >= 44 && Math.random() < 0.3) {
      // The building lifts on a form instead of the car.
      cup.cerfa = true
      setStep('cerfa')
      audio.paper()
      say('EN COURS DE TRAITEMENT.', P.grey)
      return
    }
    if (car) {
      G.found++
      G.combo++
      G.maxCombo = Math.max(G.maxCombo, G.combo)
      setStep('found')
      audio.stamp()
      say('VÉHICULE LOCALISÉ', P.green, true, 1.1)
    } else {
      G.misses++
      G.combo = 0
      setStep('missed')
      audio.buzz()
      say(cup.twin ? 'CE N’EST PAS LA NÔTRE.' : 'MAUVAIS BÂTIMENT', P.red, true, 1.4)
      G.shakes = 6
    }
  }

  function impound() {
    // Too slow: the pound takes the car; it comes back under a random building.
    G.pounds++
    G.combo = 0
    audio.siren()
    say('VÉHICULE À LA FOURRIÈRE.', P.red, true, 1.4)
    for (const c of G.cups) c.carUnder = false
    const pound = G.cups.find((c) => c.id === 4) ?? G.cups[G.cups.length - 1]
    pound.carUnder = true
    setStep('impounded')
  }

  function endGame() {
    setPhase('over')
    audio.end()
    onEnd?.({
      score: G.found,
      details: { found: G.found, maxCombo: G.maxCombo, misses: G.misses, pounds: G.pounds },
      durationMs: Math.round(G.t * 1000),
    })
  }

  /* ---------- update ---------- */
  function update(dt) {
    clock += dt
    if (phase !== 'playing') return
    G.t += dt
    if (G.t >= DURATION && G.step !== 'ending') {
      setStep('ending')
      say('FERMETURE.', P.red, true, 2)
      audio.drop()
      for (const c of G.cups) c.lift = 0
    }
    const since = G.t - G.stepAt
    // Lifts
    for (const cup of G.cups) {
      const up =
        (G.step === 'reveal' && (cup.carUnder || cup.twin)) ||
        ((G.step === 'found' || G.step === 'missed' || G.step === 'cerfa') && (cup.id === G.chosen || (G.step === 'missed' && since > 0.6 && cup.carUnder)))
      cup.lift += ((up ? LIFT : 0) - cup.lift) * Math.min(1, 12 * dt)
    }
    // Swap animation
    if (G.swap) {
      const s = G.swap
      const k = Math.min(1, (G.t - s.start) / s.dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      s.a.x = Math.round(s.fromA + (s.fromB - s.fromA) * e)
      s.b.x = Math.round(s.fromB + (s.fromA - s.fromB) * e)
      s.a.arc = Math.sin(k * Math.PI) * 6
      s.b.arc = -Math.sin(k * Math.PI) * 6
      if (k >= 1) {
        const tmp = s.a.slot
        s.a.slot = s.b.slot
        s.b.slot = tmp
        s.a.arc = 0
        s.b.arc = 0
        layout()
        if (G.hand && G.hand.duringShuffle) {
          // Wait for the hand to finish before the next swap.
        } else nextSwap()
      }
    }
    // Hand animation
    if (G.hand) {
      const h = G.hand
      const k = Math.min(1, (G.t - h.start) / h.dur)
      const fx = h.from.x + CUP_W / 2
      const tx = h.to.x + CUP_W / 2
      h.x = fx + (tx - fx) * k
      h.y = COUNTER_Y - 6
      if (k >= 1) {
        finishHandMove()
        if (G.swap === null && G.step === 'shuffle') nextSwap()
        else if (G.step === 'shuffle' && G.swap && G.t - G.swap.start >= G.swap.dur) nextSwap()
      }
    }
    switch (G.step) {
      case 'intro':
        if (since > 1.2) startRound(true)
        break
      case 'reveal':
        if (since > (G.t < 10 ? 1.1 : 0.7)) {
          setStep('lower')
          audio.drop()
        }
        break
      case 'lower':
        if (since > 0.35) startShuffle()
        break
      case 'guess':
        if (G.guessDeadline && G.t > G.guessDeadline) impound()
        else if (G.guessDeadline && G.guessDeadline - G.t < 1.5 && G.t - G.lastTick > 0.25) {
          G.lastTick = G.t
          audio.tick()
        }
        break
      case 'found':
        if (since > 1.1) {
          G.excuse = EXCUSES[Math.floor(Math.random() * EXCUSES.length)]
          say(G.excuse, P.grey, false, 1.6)
          setStep('transfer')
          startHandMove(false)
        }
        break
      case 'cerfa':
        if (since > 1.2) {
          G.cups.find((c) => c.id === G.chosen).cerfa = false
          setStep('transfer')
          G.excuse = 'VEUILLEZ RETAPER.'
          say(G.excuse, P.grey, false, 1.2)
          startHandMove(false)
        }
        break
      case 'missed':
        if (since === dt || (since > 0.3 && !G.hand && !G.clapped)) {
          G.clapped = true
          audio.clap()
        }
        if (since > 1.6) {
          G.clapped = false
          startRound(false)
        }
        break
      case 'impounded':
        if (since > 1.5) startRound(false)
        break
      case 'ending':
        if (since > 1.6) endGame()
        break
    }
    if (G.shakes > 0) G.shakes -= dt * 10
    if (G.message && G.t > G.message.until) G.message = null
  }

  /* ---------- drawing ---------- */
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  function drawCup(cup, arcOffset = 0) {
    const b = BUILDINGS[cup.id]
    const x = cup.x
    const y = COUNTER_Y - CUP_H - Math.round(cup.lift) + (cup.arc ? Math.round(cup.arc) : 0) + arcOffset
    rect(x + 2, y + 3, CUP_W, CUP_H, 'rgba(0,0,0,.35)')
    rect(x, y, CUP_W, CUP_H, b.colour)
    rect(x, y, CUP_W, 5, b.roof)
    rect(x + 4, y - 3, CUP_W - 8, 3, b.roof)
    for (let wy = y + 9; wy < y + CUP_H - 12; wy += 7)
      for (let wx = x + 5; wx < x + CUP_W - 6; wx += 8) rect(wx, wy, 4, 4, 'rgba(255,255,255,.18)')
    rect(x + CUP_W / 2 - 4, y + CUP_H - 9, 8, 9, 'rgba(0,0,0,.4)')
    const scale = textWidth(b.label) <= CUP_W - 6 ? 1 : 1
    drawTextC(ctx, b.label, x + CUP_W / 2, y + CUP_H - 20, P.white)
    void scale
  }
  function drawCar(x, y, badge) {
    blit(ctx, CAR, { k: P.car, w: '#8fb4d8', y: P.yellow }, x, y)
    if (badge) {
      rect(x + 6, y - 5, 6, 5, P.yellow)
      drawText(ctx, 'F', x + 7, y - 7, P.blue)
    }
  }
  function drawCerfa(x, y) {
    rect(x, y - 2, 16, 12, P.paper)
    for (let i = 0; i < 4; i++) rect(x + 2, y + i * 3, 12 - (i % 2) * 4, 1, P.dark)
  }

  function drawScene() {
    // Office wall, a window, the counter
    rect(0, 0, W, H, P.wall)
    rect(0, 14, W, 1, P.wallLight)
    rect(236, 24, 60, 44, P.wallLight)
    rect(238, 26, 56, 40, '#7f9bc9')
    rect(265, 26, 2, 40, P.wallLight)
    rect(238, 45, 56, 2, P.wallLight)
    rect(24, 26, 70, 40, P.paper)
    drawText(ctx, 'RESTITUTION', 28, 30, P.blue)
    drawText(ctx, 'DES VÉHICULES', 28, 39, P.blue)
    drawText(ctx, 'GUICHET 4', 28, 50, P.dark)
    rect(0, COUNTER_Y, W, 6, P.counterTop)
    rect(0, COUNTER_Y + 6, W, H - COUNTER_Y - 6, P.counter)
    rect(0, COUNTER_Y + 6, W, 2, P.counterDark)
    // Cars and forms under lifted buildings
    for (const cup of G.cups) {
      if (cup.lift > 2) {
        if (cup.carUnder) drawCar(cup.x + CUP_W / 2 - 10, COUNTER_Y - 6, cup.twin || G.cups.some((c) => c.twin))
        else if (cup.twin) drawCar(cup.x + CUP_W / 2 - 10, COUNTER_Y - 6, false)
        if (cup.cerfa) drawCerfa(cup.x + CUP_W / 2 - 8, COUNTER_Y - 10)
      }
    }
    // Buildings: the one moving to the right is drawn last (in front)
    const order = [...G.cups].sort((a, b) => (a.arc ?? 0) - (b.arc ?? 0))
    for (const cup of order) drawCup(cup)
    // The hand
    if (G.hand) {
      const hx = Math.round(G.hand.x)
      const hy = Math.round(G.hand.y)
      if (G.hand.carry) drawCar(hx - 10, hy - 4, false)
      blit(ctx, HAND, { s: P.skin }, hx - 2, hy - 2)
      rect(hx + 10, hy - 2, 14, 10, '#2a2a40')
    }
    if (G.step === 'missed' && G.t - G.stepAt > 0.3) {
      const frame = Math.floor((G.t - G.stepAt) * 2) % 2
      blit(ctx, frame ? CLAP : HAND, { s: P.skin }, 290, 100)
      rect(300, 108, 20, 10, '#2a2a40')
      drawText(ctx, '...', 292, 90, P.grey)
    }
  }

  function drawHud() {
    rect(0, 0, W, 13, P.black)
    drawText(ctx, 'LOCALISÉE : ' + G.found, 4, 2, P.white)
    if (G.combo >= 3) drawText(ctx, 'x' + G.combo, 92, 2, P.yellow)
    const left = Math.max(0, Math.ceil(DURATION - G.t))
    drawText(ctx, 'TEMPS : ' + String(left).padStart(2, '0'), 262, 2, left <= 10 ? P.red : P.white)
    if (G.step === 'guess') {
      const text = G.guessDeadline ? 'VITE !' : 'OÙ EST LA VOITURE ?'
      drawTextC(ctx, text, 160, 158, G.guessDeadline ? P.red : P.yellow)
      if (G.guessDeadline) {
        const k = Math.max(0, (G.guessDeadline - G.t) / 3.2)
        rect(100, 170, 120, 4, P.dark)
        rect(100, 170, Math.round(120 * k), 4, P.red)
      }
    }
    if (G.message) {
      const m = G.message
      if (m.big) {
        ctx.save()
        ctx.translate(160, 90)
        ctx.scale(2, 2)
        drawTextC(ctx, m.text, 1, 1, P.black)
        drawTextC(ctx, m.text, 0, 0, m.colour)
        ctx.restore()
      } else drawTextC(ctx, m.text, 160, 158, m.colour)
    }
  }

  function drawTitle() {
    rect(0, 0, W, H, P.black)
    const since = clock - phaseAt
    rect(0, 120, W, 60, P.counter)
    rect(0, 120, W, 5, P.counterTop)
    const cups = [0, 1, 2]
    cups.forEach((id, i) => {
      const x = 60 + i * 70
      const lift = i === 1 && since % 3 > 2 ? Math.round(Math.sin(((since % 3) - 2) * Math.PI) * 20) : 0
      if (lift > 2) drawCar(x + 13, 114, false)
      drawCup({ id, x, lift, arc: 0 })
    })
    ctx.save()
    ctx.translate(160, 22)
    ctx.scale(2, 2)
    drawTextC(ctx, 'OÙ EST LA VOITURE ?', 0, 0, P.yellow)
    ctx.restore()
    drawTextC(ctx, 'ELLE ÉTAIT LÀ IL Y A DEUX SECONDES.', 160, 46, P.white)
    drawTextC(ctx, 'SUIS LA BERLINE. TAPE SUR LE BÂTIMENT.', 160, 62, P.grey)
    if (since > 1 && Math.floor(clock * 1.5) % 2) drawTextC(ctx, pointer.touch ? 'TAPOTE POUR COMMENCER' : 'CLIQUE POUR COMMENCER', 160, 160, P.yellow)
  }

  function drawOver() {
    rect(0, 0, W, H, P.black)
    const since = clock - phaseAt
    const lines = [
      ['FERMETURE DU GUICHET', P.white],
      ['', P.white],
      [`VOITURE LOCALISÉE : ${G.found} FOIS`, P.yellow],
      ['VOITURE RENDUE : 0', P.red],
      ['', P.white],
      [`MEILLEURE SÉRIE : ${G.maxCombo}`, P.grey],
      [`MAUVAIS BÂTIMENTS : ${G.misses}`, P.grey],
      [`PASSAGES À LA FOURRIÈRE : ${G.pounds}`, P.grey],
    ]
    lines.forEach(([text, colour], i) => {
      if (since > 0.5 + i * 0.25) drawTextC(ctx, text, 160, 30 + i * 11, colour)
    })
    if (since > 2.8 && Math.floor(clock * 1.5) % 2) drawTextC(ctx, pointer.touch ? '[ TAP ] RÉESSAYER' : '[ CLIC ] RÉESSAYER', 160, 142, P.yellow)
  }

  function draw() {
    if (phase === 'title') return drawTitle()
    if (phase === 'over') return drawOver()
    ctx.save()
    if (G.shakes > 0) ctx.translate(Math.round((Math.random() - 0.5) * G.shakes), 0)
    drawScene()
    ctx.restore()
    drawHud()
  }

  function frame(now) {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (now - lastFrame) / 1000)
    lastFrame = now
    update(dt)
    draw()
  }

  /* ---------- input ---------- */
  function click(x, y) {
    if (phase === 'title') {
      if (clock - phaseAt > 0.4) {
        audio.resume()
        audio.boot()
        G = newGame()
        setPhase('playing')
      }
      return
    }
    if (phase === 'over') {
      if (clock - phaseAt > 2.8) {
        G = null
        setPhase('title')
      }
      return
    }
    if (G.step !== 'guess') return
    const cup = cupAt(x, y)
    if (cup) guess(cup)
  }

  function input(action, payload) {
    if (destroyed || paused) return
    if (action === 'pointer' && payload) {
      pointer.x = payload.x
      pointer.y = payload.y
      pointer.inside = true
      pointer.touch = !!payload.touch
      if (payload.type === 'down') click(payload.x, payload.y)
      return
    }
    if (action === 'confirm') {
      if (phase !== 'playing') click(0, 0)
    }
    if (action === 'key' && payload?.down && phase === 'playing' && G.step === 'guess') {
      const n = Number(payload.code.replace('Digit', '').replace('Numpad', ''))
      const cup = G.cups.find((c) => c.slot === n - 1)
      if (cup) guess(cup)
    }
  }

  function pause() {
    if (paused || phase !== 'playing') return
    paused = true
    cancelAnimationFrame(raf)
    rect(0, 0, W, H, 'rgba(0,0,0,.5)')
    drawTextC(ctx, 'PAUSE', 160, 84, P.white)
  }
  function resume() {
    if (!paused) return
    paused = false
    lastFrame = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function onVisibility() {
    if (document.hidden) pause()
  }
  document.addEventListener('visibilitychange', onVisibility)

  async function start() {
    await audio.resume()
  }
  function stop() {
    G = null
    setPhase('title')
  }
  function destroy() {
    destroyed = true
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
  }

  setPhase('title')
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
      return paused ? 'paused' : phase === 'title' ? 'idle' : phase === 'over' ? 'over' : 'playing'
    },
  }
}

/** Server side: a sixty-second game cannot hold more than about twenty rounds. */
export function validate(result, settings = manifest.settings) {
  if (!result || typeof result !== 'object') return false
  const d = result.details
  const values = [result.score, d?.found, d?.maxCombo, d?.misses, d?.pounds]
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false
  if (result.score !== d.found) return false
  if (d.maxCombo > d.found) return false
  const seconds = settings.durationSeconds ?? 60
  if (d.found + d.misses + d.pounds > seconds / 2) return false
  return result.durationMs >= seconds * 1000 - 500 && result.durationMs <= seconds * 1000 + 5000
}

export function grade(result) {
  const f = result.details.found
  return f >= 18 ? 'S' : f >= 14 ? 'A' : f >= 10 ? 'B' : f >= 6 ? 'C' : 'D'
}
