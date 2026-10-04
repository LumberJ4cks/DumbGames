import { createAudio } from './audio.js'
import { drawText, drawTextC, LINE_H, textWidth } from './font.js'

/*
 * LA VÉRITÉ SI JE VENDS ! — « Une seule touche. Aucune dignité. »
 *
 * A wholesaler sells an unsellable purple leopard jacket. The customer's offer rises with
 * time; one press closes the sale. Wait too long and the hand is withdrawn. Sixty seconds.
 * Follows the games-site module contract: `manifest`, `create(options)`, `validate(result)`,
 * `grade(result)`. Internal resolution 320 × 180, pixel art drawn in code.
 */

export const manifest = {
  slug: 'la-verite-si-je-vends',
  title: 'LA VÉRITÉ SI JE VENDS !',
  tagline: 'Une seule touche. Aucune dignité.',
  releasedAt: '2026-10-27',
  status: 'draft',
  orientation: 'landscape',
  size: { width: 320, height: 180 },
  controls: [
    { action: 'press', key: 'Space', label: 'Espace, clic ou tap : conclure la vente' },
    { action: 'mute', key: 'KeyM', label: 'M ou bouton son : couper le son' },
  ],
  settings: {},
}

/* ---------- configuration (every tunable number lives here) ---------- */
export const CONFIG = {
  RUN_DURATION: 60,
  MIN_NEGOTIATION: 2.4,
  MAX_NEGOTIATION: 4.2,
  FIRST_NEGOTIATION: 4.0,
  ENTRY_DURATION: 0.25,
  SUCCESS_DURATION: 0.4,
  FAILURE_DURATION: 0.45,
  PERFECT_THRESHOLD: 0.93,
  MAX_TIER: 8,
  BASE_PRICE: 10,
  TIER_GROWTH: 1.3,
  CURVE_GAIN: 29,
  CURVE_POWER: 3,
  PHASES: { hesitant: 0.5, impatient: 0.75, leaving: 0.88 },
  RESULTS_LOCK: 0.5,
  ESCALATION: { bills: 3, phones: 6, sign: 9, accounting: 12, employee: 15 },
}

export function offerFor(p, tier) {
  const base = CONFIG.BASE_PRICE * Math.pow(CONFIG.TIER_GROWTH, tier)
  const k = Math.max(0, Math.min(1, p))
  return Math.floor(base * (1 + CONFIG.CURVE_GAIN * Math.pow(k, CONFIG.CURVE_POWER)))
}

/* ---------- palette ---------- */
const P = {
  cream: '#F1DCAB',
  bordeaux: '#762D42',
  ink: '#251C26',
  yellow: '#FFD45A',
  green: '#79AE69',
  purple: '#994CAA',
  purpleDark: '#5e2a6b',
  skin: '#f0c8a0',
  skinDark: '#c9956b',
  skinLight: '#f7dcc0',
  shadow: '#4a3a3e',
  wood: '#9c6a3a',
  woodDark: '#6b4524',
  white: '#fbf7ee',
  grey: '#9a8f8a',
  greyDark: '#5b5257',
  red: '#d13c3c',
  blue: '#4a6fb5',
  card: '#c9a46c',
}

const W = 320
const H = 180

const LINES = [
  'JE GAGNE RIEN DESSUS !',
  'TU ME RUINES !',
  'C’EST LE PRIX DU CINTRE !',
  'ELLE EST RÉVERSIBLE. MOCHE DES DEUX CÔTÉS.',
  'C’EST DU CUIR VÉGÉTAL. DE LA NAPPE.',
  'À CE PRIX-LÀ, JE TE LA GARDE !',
  'C’EST UNE PIÈCE UNIQUE. J’EN AI HUIT MILLE.',
]

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

/* ---------- pixel helpers ---------- */
function blit(ctx, rows, map, x, y, flip = false) {
  const w = rows[0].length
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = map[rows[j][i]]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x + (flip ? w - 1 - i : i), y + j, 1, 1)
    }
}

/* Faces: 14 × 12. k outline, s skin, w white, e eye, m mouth, h hair, b brow. */
const FACE = {
  seller: [
    '..hhhhhhhhhh..',
    '.hhhhhhhhhhhh.',
    '.hsssssssssss.',
    '.sbbs.sss.bbs.',
    '.swwws.s.wwws.',
    '.swews.s.wews.',
    '.sssssssssssss',
    '.ssssmmmmmsss.',
    '.sssmmmmmmmss.',
    '..ssssssssss..',
    '...ssssssss...',
    '....ssssss....',
  ],
  smile: ['......', '.m..m.', '..mm..'],
  hesitant: ['......', '......', '.mmmm.'],
  crisped: ['.mmmm.', '......', '......'],
  open: ['.mmmm.', '.m..m.', '.mmmm.'],
}

/* Customer heads: 14 × 12 base, hair/hat differs per appearance. */
const HEADS = [
  // suit, too large: short hair, square face
  ['..hhhhhhhhhh..', '.hhhhhhhhhhhh.', '.hhsssssssshh.', '.ssbbs.s.sbbs.', '.swwwssssswwws', '.swwessssswwes', '.sssssssssssss', '.ssss.....sss.', '.ssss.....sss.', '.sssssssssssss', '..ssssssssss..', '...ssssssss...'],
  // sportsman: cap
  ['..cccccccccc..', '.cccccccccccccc', '..sssssssssss.', '.ssbbs.s.sbbs.', '.swwwssssswwws', '.swwessssswwes', '.sssssssssssss', '.ssss.....sss.', '.ssss.....sss.', '.sssssssssssss', '..ssssssssss..', '...ssssssss...'],
  // lady in a huge coat: big hair
  ['.hhhhhhhhhhhh.', 'hhhhhhhhhhhhhh', 'hhsssssssssshh', 'hhsbbs.s.sbbsh', 'hhswwwssswwwsh', 'hhswwesssswesh', 'hhssssssssssshh', 'hhsss.....ssshh', 'hhsss.....ssshh', 'hhssssssssssshh', '.hhsssssssssshh', '..hhhhhhhhhhhh'],
]
const CUSTOMER_STYLE = [
  { hair: '#3a2a1e', body: '#6f6f7a', bodyDark: '#4c4c56', accent: P.red, name: 'COSTUME' },
  { hair: '#2a2a2a', body: '#2f8f5a', bodyDark: '#1f6a40', accent: P.yellow, name: 'SPORTIF' },
  { hair: '#b8742a', body: '#d9c39a', bodyDark: '#b39a70', accent: P.bordeaux, name: 'MANTEAU' },
]

/* Hands: 28 × 20, drawn large. k outline, s skin, d skin shade. */
const HAND_OPEN = [
  '........kkkk........kkkk....',
  '.......kssssk......kssssk...',
  '.......kssssk.kkkk.kssssk...',
  '.......kssssk.kssk.kssssk...',
  '..kkkk.kssssk.kssk.kssssk...',
  '.kssssk.kssssk.kssk.kssssk..',
  '.kssssk.ksssskssssskssssk...',
  '.kssssk.kssssssssssssssssk..',
  '..kssssksssssssssssssssssk..',
  '..ksssssssssssssssssssssk...',
  '...kssssssssssssssssssssk...',
  '...kssssssssssssssssssddk...',
  '....ksssssssssssssssssddk...',
  '....kssssssssssssssssssdk...',
  '.....ksssssssssssssssssk....',
  '......kssssssssssssssssk....',
  '.......ksssssssssssssssk....',
  '........kkssssssssssssk.....',
  '..........kkkkkkkkkkkk......',
  '............................',
]
const HAND_FIST = [
  '............................',
  '............................',
  '........kkkkkkkkkkk.........',
  '.......kssssssssssssk.......',
  '......ksssssssssssssssk.....',
  '.....kssskssskssskssssk.....',
  '.....kssssssssssssssssk.....',
  '....ksssssssssssssssssk.....',
  '....ksssssssssssssssssk.....',
  '....kssssssssssssssssdk.....',
  '....ksssssssssssssssddk.....',
  '.....kssssssssssssssdk......',
  '.....ksssssssssssssssk......',
  '......kssssssssssssk........',
  '.......kkssssssssskk........',
  '.........kkkkkkkkk..........',
  '............................',
  '............................',
  '............................',
  '............................',
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
  let random = seedValue !== null ? mulberry32(Number(seedValue)) : Math.random
  const durations = Array.isArray(settings.durations) ? [...settings.durations] : null

  /* ---------- persistence ---------- */
  function load(key, fallback) {
    try {
      const v = localStorage.getItem('laVeriteSiJeVends:' + key)
      return v === null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem('laVeriteSiJeVends:' + key, JSON.stringify(value))
    } catch {}
  }
  let best = Number(load('best', 0)) || 0
  audio.setMuted(load('muted', false) === true)

  /* ---------- state ---------- */
  let state = 'TITLE' // TITLE | CUSTOMER_ENTER | NEGOTIATING | SUCCESS | FAILURE | RESULTS
  let stateAt = 0 // game clock when the state began
  let paused = false
  let pausedByVisibility = false
  let needRelease = false // a press was consumed: wait for the key/pointer to be released
  let now = 0 // monotonic game clock in seconds (does not advance while paused)
  let lastFrame = performance.now()
  let raf = 0
  let destroyed = false
  let G = null
  let customer = null
  let reaction = null // { kind, p, line, bills: [], plaster, pull }
  let bubble = null // the long line kept in the bottom band
  let title = { at: 0 }
  let effects = { glasses: 0, shake: 0, particles: [] }

  function setState(next) {
    state = next
    stateAt = now
    onState?.(state === 'TITLE' ? 'idle' : state === 'RESULTS' ? 'over' : 'playing')
  }

  function newGame() {
    return {
      remainingTime: C.RUN_DURATION,
      revenue: 0,
      bestSale: 0,
      perfectDeals: 0,
      successfulSales: 0,
      missedCustomers: 0,
      tier: 0,
      closingRequested: false,
      closingShown: false,
      customersSeen: 0,
      inputsConsumed: 0,
      newRecord: false,
      employeeX: null,
    }
  }

  function nextDuration() {
    if (durations && durations.length) return durations.shift()
    if (G.customersSeen === 0) return C.FIRST_NEGOTIATION
    return C.MIN_NEGOTIATION + random() * (C.MAX_NEGOTIATION - C.MIN_NEGOTIATION)
  }

  function spawnCustomer() {
    customer = {
      appearanceId: G.customersSeen % 3,
      duration: nextDuration(),
      elapsed: 0,
      phase: 'confident',
      currentOffer: offerFor(0, G.tier),
      resolved: false,
      lastOffer: -1,
    }
    G.customersSeen++
    setState('CUSTOMER_ENTER')
    audio.enter()
  }

  const progress = () => (customer ? Math.max(0, Math.min(1, customer.elapsed / customer.duration)) : 0)
  function phaseFor(p) {
    if (p >= 1) return 'gone'
    if (p >= C.PHASES.leaving) return 'leaving'
    if (p >= C.PHASES.impatient) return 'impatient'
    if (p >= C.PHASES.hesitant) return 'hesitant'
    return 'confident'
  }

  /* ---------- resolution ---------- */
  function resolveSale() {
    const p = customer.elapsed / customer.duration
    if (customer.resolved || p >= 1) return false
    customer.resolved = true
    const amount = offerFor(p, G.tier)
    customer.currentOffer = amount
    G.revenue += amount
    G.bestSale = Math.max(G.bestSale, amount)
    G.successfulSales++
    G.tier = Math.min(C.MAX_TIER, G.tier + 1)
    const perfect = p >= C.PERFECT_THRESHOLD
    if (perfect) G.perfectDeals++
    const kind = perfect ? 'perfect' : p >= C.PHASES.impatient ? 'two-hands' : p >= C.PHASES.hesitant ? 'strong' : 'weak'
    reaction = { kind, p, amount, line: kind === 'weak' ? 'BON. T’AS PAYÉ LE CINTRE.' : perfect ? 'AFFAIRE DU SIÈCLE !' : null }
    bubble = LINES[Math.floor(random() * LINES.length)]
    if (kind === 'weak') audio.handshake(0.2)
    else if (kind === 'strong') {
      audio.handshake(0.7)
      audio.glasses()
      effects.glasses = 1
    } else if (kind === 'two-hands') {
      audio.handshake(1)
      audio.bills()
      for (let i = 0; i < 8; i++) effects.particles.push({ x: 252, y: 150, vx: -30 - random() * 50, vy: -60 - random() * 60, kind: 'bill', born: now })
    } else {
      audio.handshake(1)
      audio.perfect()
      audio.plaster()
      effects.particles.push({ x: 60 + random() * 200, y: 0, vx: 0, vy: 40, kind: 'plaster', born: now })
      effects.shake = 2
    }
    audio.register()
    setState('SUCCESS')
    return true
  }

  function resolveFailure() {
    if (customer.resolved) return
    customer.resolved = true
    G.missedCustomers++
    G.tier = Math.max(0, G.tier - 1)
    reaction = { kind: 'fail', p: 1, amount: 0, line: 'ELLE T’ALLAIT PAS.' }
    audio.fail()
    setState('FAILURE')
  }

  function finishRun() {
    if (G.revenue > best) {
      best = G.revenue
      G.newRecord = true
      save('best', best)
    }
    customer = null
    setState('RESULTS')
    audio.music(false)
    audio.results()
    onEnd?.({
      score: G.revenue,
      details: {
        revenue: G.revenue,
        bestSale: G.bestSale,
        perfectDeals: G.perfectDeals,
        sales: G.successfulSales,
        missed: G.missedCustomers,
      },
      durationMs: Math.round((C.RUN_DURATION - Math.min(0, G.remainingTime)) * 1000),
    })
  }

  /* ---------- the single action ---------- */
  function press() {
    if (needRelease) return
    needRelease = true
    if (paused) {
      // The resume press is consumed without selling.
      paused = false
      pausedByVisibility = false
      lastFrame = performance.now()
      return
    }
    if (state === 'TITLE') {
      audio.resume()
      G = newGame()
      effects = { glasses: 0, shake: 0, particles: [] }
      bubble = null
      reaction = null
      audio.music(true)
      spawnCustomer()
      return
    }
    if (state === 'RESULTS') {
      if (now - stateAt < C.RESULTS_LOCK) return
      G = null
      customer = null
      setState('TITLE')
      title.at = now
      return
    }
    if (state === 'NEGOTIATING' && customer && !customer.resolved) {
      G.inputsConsumed++
      if (customer.elapsed < customer.duration) resolveSale()
      else resolveFailure()
    }
    // Presses during CUSTOMER_ENTER, SUCCESS or FAILURE are ignored, never queued.
  }
  function release() {
    needRelease = false
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (paused) return
    now += dt
    if (state === 'TITLE' || state === 'RESULTS') {
      updateEffects(dt)
      return
    }
    // The run clock runs through entries and reactions.
    G.remainingTime -= dt
    if (G.remainingTime <= 0 && !G.closingRequested) {
      G.closingRequested = true
      audio.curtain()
    }
    switch (state) {
      case 'CUSTOMER_ENTER':
        if (now - stateAt >= C.ENTRY_DURATION) {
          customer.elapsed = 0
          setState('NEGOTIATING')
        }
        break
      case 'NEGOTIATING': {
        customer.elapsed += dt
        const p = progress()
        customer.phase = phaseFor(p)
        if (customer.elapsed >= customer.duration) {
          resolveFailure()
          break
        }
        const offer = offerFor(p, G.tier)
        if (offer !== customer.lastOffer) {
          customer.lastOffer = offer
          audio.tick(p)
        }
        customer.currentOffer = offer
        break
      }
      case 'SUCCESS':
      case 'FAILURE': {
        const dur = state === 'SUCCESS' ? C.SUCCESS_DURATION : C.FAILURE_DURATION
        if (now - stateAt >= dur) {
          reaction = null
          if (G.closingRequested) finishRun()
          else spawnCustomer()
        }
        break
      }
    }
    // Escalation: the employee crossing the back room
    if (G.successfulSales >= C.ESCALATION.employee) {
      if (G.employeeX === null) G.employeeX = W + 20
      G.employeeX -= dt * 18
      if (G.employeeX < -30) G.employeeX = W + 20
    }
    updateEffects(dt)
  }
  function updateEffects(dt) {
    if (effects.glasses > 0) effects.glasses = Math.max(0, effects.glasses - dt * 2.5)
    if (effects.shake > 0) effects.shake = Math.max(0, effects.shake - dt * 10)
    for (const pt of effects.particles) {
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += (pt.kind === 'bill' ? 120 : 220) * dt
    }
    effects.particles = effects.particles.filter((pt) => now - pt.born < 1.4 && pt.y < H + 10)
  }

  /* ---------- drawing ---------- */
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  function outlined(x, y, w, h, fill) {
    rect(x - 1, y - 1, w + 2, h + 2, P.ink)
    rect(x, y, w, h, fill)
  }
  function euros(n) {
    return n.toLocaleString('fr-FR').replace(/ /g, ' ') + ' €'
  }

  function drawShop() {
    // Walls, floor, counter
    rect(0, 0, W, H, P.cream)
    rect(0, 0, W, 27, P.ink)
    for (let x = 0; x < W; x += 16) rect(x, 27, 8, 1, P.bordeaux)
    rect(0, 122, W, 58, P.wood)
    rect(0, 122, W, 4, P.card)
    rect(0, 126, W, 2, P.woodDark)
    for (let x = 8; x < W; x += 40) rect(x, 134, 24, 1, P.woodDark)
    // Boxes
    outlined(6, 96, 30, 24, P.card)
    outlined(10, 80, 22, 16, P.card)
    drawText(ctx, 'FRAGILE', 8, 102, P.woodDark)
    outlined(284, 100, 30, 20, P.card)
    // Rack with the jacket
    rect(150, 30, 2, 92, P.greyDark)
    rect(130, 30, 42, 2, P.greyDark)
    rect(150, 32, 1, 6, P.ink)
    rect(140, 38, 22, 3, P.ink)
    // The jacket: purple leopard, drawn with spots
    rect(136, 41, 30, 34, P.purple)
    rect(136, 41, 30, 34, P.purple)
    rect(134, 43, 4, 26, P.purple)
    rect(164, 43, 4, 26, P.purple)
    rect(147, 41, 8, 6, P.purpleDark)
    for (const [sx, sy] of [[139, 46], [148, 52], [158, 47], [141, 60], [155, 62], [160, 68], [144, 69], [150, 58]]) {
      rect(sx, sy, 3, 2, P.ink)
      rect(sx + 1, sy - 1, 1, 1, P.ink)
    }
    // Tag "ACHAT : 3 €"
    outlined(168, 60, 40, 11, P.white)
    drawText(ctx, 'ACHAT: 3 €', 170, 62, P.ink)
    // Phone on the counter
    outlined(100, 112, 16, 9, P.ink)
    rect(102, 114, 12, 2, P.grey)
    // Escalation
    const sales = G ? G.successfulSales : 0
    if (sales >= C.ESCALATION.bills) {
      for (let i = 0; i < 4; i++) outlined(226, 112 - i * 3, 22, 3, P.green)
    }
    if (sales >= C.ESCALATION.phones) {
      for (let i = 0; i < 3; i++) {
        const shake = Math.floor(now * 20 + i) % 2
        outlined(44 + i * 20 + shake, 110, 14, 8, P.ink)
        rect(46 + i * 20 + shake, 112, 10, 2, P.grey)
      }
    }
    if (sales >= C.ESCALATION.sign) {
      outlined(190, 30, 118, 12, P.yellow)
      drawTextC(ctx, 'OUVERTURE EXCEPTIONNELLE', 249, 32, P.ink)
    } else {
      outlined(200, 30, 100, 12, P.red)
      drawTextC(ctx, 'LIQUIDATION TOTALE', 250, 32, P.white)
    }
    if (sales >= C.ESCALATION.accounting) {
      outlined(266, 86, 40, 16, P.card)
      drawText(ctx, 'COMPTA', 270, 90, P.woodDark)
      for (let i = 0; i < 6; i++) rect(264 + i * 7, 80 + (i % 2) * 3, 6, 4, P.green)
    }
    if (G && G.employeeX !== null) {
      const ex = Math.round(G.employeeX)
      rect(ex, 70, 10, 24, P.blue)
      rect(ex + 2, 62, 6, 8, P.skin)
      for (let i = 0; i < 9; i++) rect(ex - 4, 58 - i * 4, 18, 4, i % 2 ? P.purple : P.purpleDark)
    }
  }

  function drawSeller() {
    const x = 28
    const y = 62
    const r = reaction
    // Body and arm
    rect(x, y + 14, 34, 50, P.bordeaux)
    rect(x + 4, y + 14, 26, 10, P.white)
    rect(x + 14, y + 16, 6, 14, P.yellow)
    // Head
    blit(ctx, FACE.seller, { h: '#4a3a3a', s: P.skin, w: P.white, e: P.ink, b: '#4a3a3a', m: P.skinDark }, x + 10, y)
    // Moustache
    rect(x + 13, y + 8, 8, 2, P.ink)
    // Glasses, jumping on a strong sale
    const gy = y + 4 - Math.round(Math.sin(effects.glasses * Math.PI) * 6)
    rect(x + 11, gy, 5, 1, P.ink)
    rect(x + 18, gy, 5, 1, P.ink)
    rect(x + 16, gy + 1, 2, 1, P.ink)
    rect(x + 11, gy + 1, 1, 3, P.ink)
    rect(x + 15, gy + 1, 1, 3, P.ink)
    rect(x + 18, gy + 1, 1, 3, P.ink)
    rect(x + 22, gy + 1, 1, 3, P.ink)
    // Expression in the results screen: offended
    if (state === 'RESULTS') rect(x + 14, y + 10, 6, 1, P.ink)
    void r
  }

  function drawCustomer() {
    if (!customer) return
    const style = CUSTOMER_STYLE[customer.appearanceId]
    const p = progress()
    const r = reaction
    let x = 258
    let y = 62
    if (state === 'CUSTOMER_ENTER') x += Math.round((1 - (now - stateAt) / C.ENTRY_DURATION) * 40)
    if (state === 'NEGOTIATING' && customer.phase === 'leaving') x += 4
    if (r && r.kind === 'perfect') {
      const k = Math.min(1, (now - stateAt) / C.SUCCESS_DURATION)
      x -= Math.round(Math.sin(k * Math.PI) * 40)
      y -= Math.round(Math.sin(k * Math.PI) * 18)
    }
    if (r && r.kind === 'fail') x += Math.round(((now - stateAt) / C.FAILURE_DURATION) * 70)
    // Body: suit too large / tracksuit / huge coat
    const bodyW = customer.appearanceId === 2 ? 46 : customer.appearanceId === 0 ? 40 : 32
    const bx = x + 17 - bodyW / 2
    rect(bx, y + 14, bodyW, 50, style.body)
    rect(bx, y + 14, bodyW, 3, style.bodyDark)
    if (customer.appearanceId === 0) {
      rect(x + 12, y + 14, 10, 12, P.white)
      rect(x + 16, y + 16, 2, 14, style.accent)
    }
    if (customer.appearanceId === 1) {
      for (let i = 0; i < 3; i++) rect(bx + 2, y + 24 + i * 6, 6, 3, style.accent)
    }
    if (customer.appearanceId === 2) rect(bx + 4, y + 14, bodyW - 8, 8, '#efe3c6')
    // Body turning towards the exit when impatient
    if (customer.phase === 'impatient' || customer.phase === 'leaving') rect(bx + bodyW - 4, y + 14, 4, 50, style.bodyDark)
    // Head
    blit(ctx, HEADS[customer.appearanceId], { h: style.hair, c: style.accent, s: P.skin, w: P.white, e: P.ink, b: style.hair }, x + 10, y)
    // Eyes looking at the jacket (hesitant) or the door (leaving)
    if (customer.phase === 'hesitant') {
      rect(x + 13, y + 5, 1, 1, P.ink)
      rect(x + 21, y + 5, 1, 1, P.ink)
    }
    if (customer.phase === 'leaving') {
      rect(x + 15, y + 5, 1, 1, P.ink)
      rect(x + 23, y + 5, 1, 1, P.ink)
    }
    // Eyebrows and mouth by phase
    const mouthY = y + 8
    if (customer.phase === 'confident' || state !== 'NEGOTIATING') {
      rect(x + 14, mouthY, 1, 1, P.skinDark)
      rect(x + 15, mouthY + 1, 4, 1, P.skinDark)
      rect(x + 19, mouthY, 1, 1, P.skinDark)
    } else if (customer.phase === 'hesitant') {
      rect(x + 20, y + 2, 4, 1, style.hair) // raised brow
      rect(x + 14, mouthY + 1, 6, 1, P.skinDark)
    } else if (customer.phase === 'impatient') {
      rect(x + 13, mouthY + 1, 8, 1, P.ink)
      rect(x + 12, mouthY, 1, 1, P.ink)
      rect(x + 21, mouthY, 1, 1, P.ink)
      // Sweat drop
      rect(x + 25, y + 3 + Math.floor((now * 4) % 3), 2, 3, P.blue)
    } else if (customer.phase === 'leaving') {
      rect(x + 14, mouthY, 6, 3, P.ink)
      rect(x + 15, mouthY + 1, 4, 1, P.red)
      rect(x + 25, y + 2 + Math.floor((now * 6) % 4), 2, 3, P.blue)
    }
    if (r && r.kind === 'fail') {
      // The customer leaves; a mannequin takes the handshake.
      void 0
    }
    void p
  }

  function drawHands() {
    const map = { k: P.ink, s: P.skin, d: P.skinDark }
    const r = reaction
    const p = progress()
    // Seller hand, from the left, pointing right
    let sx = 108
    let sy = 96
    // Customer hand, from the right, mirrored
    let cx = 184
    let cy = 96
    let customerHand = HAND_OPEN
    let showCustomer = !!customer
    if (state === 'NEGOTIATING') {
      if (customer.phase === 'hesitant') cy += Math.floor(now * 8) % 2
      if (customer.phase === 'impatient') {
        cy += Math.floor(now * 12) % 2
        cx += 4
      }
      if (customer.phase === 'leaving') {
        const k = (p - C.PHASES.leaving) / (1 - C.PHASES.leaving)
        cx += 8 + Math.round(k * 22)
      }
    }
    if (state === 'CUSTOMER_ENTER') cx += Math.round((1 - (now - stateAt) / C.ENTRY_DURATION) * 60)
    if (r && r.kind !== 'fail') {
      // Contact: both hands meet at the centre, shaking
      const k = (now - stateAt) / C.SUCCESS_DURATION
      const shake = Math.round(Math.sin(k * Math.PI * (r.kind === 'weak' ? 2 : 6)) * (r.kind === 'weak' ? 1 : 3))
      sx = 126
      cx = 166
      sy = 98 + shake
      cy = 98 + shake
      customerHand = HAND_FIST
      if (r.kind === 'perfect') {
        cx -= Math.round(Math.sin(k * Math.PI) * 30)
        cy -= Math.round(Math.sin(k * Math.PI) * 14)
      }
    }
    if (r && r.kind === 'fail') {
      // Mannequin hand: pale, on a stick
      showCustomer = false
      rect(176, 110, 2, 12, P.grey)
      blit(ctx, HAND_OPEN, { k: P.greyDark, s: P.white, d: P.grey }, 170, 96, true)
      sx = 136
      sy = 98 + (Math.floor(now * 10) % 2)
    }
    if (r && r.kind === 'two-hands') blit(ctx, HAND_OPEN, map, sx - 6, sy + 10)
    blit(ctx, HAND_OPEN, map, sx, sy)
    if (showCustomer) blit(ctx, customerHand, map, cx, cy, true)
  }

  function drawOffer() {
    if (!customer && state !== 'SUCCESS') return
    const amount = customer ? customer.currentOffer : 0
    const text = euros(amount)
    const colour = reaction ? (reaction.kind === 'fail' ? P.red : P.green) : customer && customer.phase === 'leaving' ? P.red : P.yellow
    ctx.save()
    ctx.translate(160, 36)
    ctx.scale(3, 3)
    drawTextC(ctx, text, 1, 1, P.ink)
    drawTextC(ctx, text, 0, 0, colour)
    ctx.restore()
    if (reaction && reaction.kind === 'fail') drawTextC(ctx, '0 €', 160, 62, P.red)
  }

  function drawHud() {
    drawText(ctx, 'CAISSE ' + euros(G ? G.revenue : 0), 4, 8, P.white)
    const left = G ? Math.max(0, Math.ceil(G.remainingTime)) : C.RUN_DURATION
    const timeText = String(left).padStart(2, '0') + ' S'
    drawText(ctx, timeText, W - 36 - textWidth(timeText), 8, left <= 10 && G ? P.red : P.white)
    drawSoundButton()
    // Bottom band
    rect(0, 158, W, 22, P.ink)
    if (state === 'TITLE') {
      drawTextC(ctx, 'LE PRIX MONTE. ESPACE POUR VENDRE', 160, 160, P.yellow)
      drawTextC(ctx, 'AVANT QU’IL SE BARRE !', 160, 169, P.yellow)
    } else if (reaction && reaction.line) {
      drawTextC(ctx, reaction.line, 160, 164, reaction.kind === 'fail' ? P.red : reaction.kind === 'perfect' ? P.yellow : P.white)
    } else if (bubble) {
      const lines = wrap(bubble, 40)
      lines.forEach((l, i) => drawTextC(ctx, l, 160, 160 + i * LINE_H, P.cream))
    }
    if (G && G.closingRequested && state !== 'RESULTS') {
      drawTextC(ctx, 'DERNIÈRE AFFAIRE !', 160, 48 + 24, P.red)
    }
    if (paused) {
      rect(0, 0, W, H, 'rgba(37,28,38,.6)')
      drawTextC(ctx, 'PAUSE', 160, 80, P.white)
      drawTextC(ctx, pointerTouch ? 'TAPOTE POUR REPRENDRE' : 'ESPACE POUR REPRENDRE', 160, 96, P.yellow)
    }
    if (debug && G) {
      const lines = [
        `ETAT ${state}`,
        customer ? `T ${customer.duration.toFixed(2)} T0 ${customer.elapsed.toFixed(2)} P ${progress().toFixed(2)}` : 'PAS DE CLIENT',
        `TIER ${G.tier} ENTREES ${G.inputsConsumed}`,
      ]
      lines.forEach((l, i) => drawText(ctx, l, 4, 30 + i * 9, P.ink))
      if (customer) {
        rect(4, 58, 60, 3, P.grey)
        rect(4, 58, Math.round(60 * progress()), 3, P.red)
      }
    }
  }
  function wrap(text, max) {
    const words = text.split(' ')
    const out = []
    let line = ''
    for (const w of words) {
      if ((line + ' ' + w).trim().length > max && line) {
        out.push(line)
        line = w
      } else line = (line + ' ' + w).trim()
    }
    if (line) out.push(line)
    return out.slice(0, 2)
  }

  const SOUND_BTN = { x: W - 30, y: 6, w: 26, h: 15 }
  function drawSoundButton() {
    const b = SOUND_BTN
    rect(b.x, b.y, b.w, b.h, P.bordeaux)
    rect(b.x + 3, b.y + 5, 4, 5, P.white)
    rect(b.x + 7, b.y + 3, 3, 9, P.white)
    if (audio.muted) {
      rect(b.x + 13, b.y + 4, 1, 7, P.red)
      rect(b.x + 12, b.y + 5, 3, 1, P.red)
      rect(b.x + 12, b.y + 9, 3, 1, P.red)
    } else {
      rect(b.x + 12, b.y + 6, 1, 3, P.white)
      rect(b.x + 14, b.y + 4, 1, 7, P.white)
      rect(b.x + 16, b.y + 2, 1, 11, P.white)
    }
  }

  function drawCurtain() {
    if (!G || !G.closingRequested) return
    const k = Math.min(1, (-G.remainingTime) / 1.2)
    const h = Math.round(k * 56)
    rect(0, 28, W, h, P.bordeaux)
    for (let x = 0; x < W; x += 12) rect(x, 28, 4, h, '#5e2234')
    rect(0, 28 + h, W, 2, P.yellow)
  }

  function drawTitle() {
    drawShop()
    customer = customer ?? null
    // A customer already in place, hand out, waiting for the start
    const style = CUSTOMER_STYLE[0]
    rect(255, 76, 40, 50, style.body)
    rect(267, 76, 10, 12, P.white)
    blit(ctx, HEADS[0], { h: style.hair, s: P.skin, w: P.white, e: P.ink, b: style.hair }, 268, 62)
    drawSeller()
    blit(ctx, HAND_OPEN, { k: P.ink, s: P.skin, d: P.skinDark }, 108, 96)
    blit(ctx, HAND_OPEN, { k: P.ink, s: P.skin, d: P.skinDark }, 184, 96, true)
    rect(70, 28, 180, 30, 'rgba(37,28,38,.85)')
    ctx.save()
    ctx.translate(160, 32)
    ctx.scale(2, 2)
    drawTextC(ctx, 'LA VÉRITÉ SI JE VENDS !', 0, 0, P.yellow)
    ctx.restore()
    drawTextC(ctx, 'UNE SEULE TOUCHE. AUCUNE DIGNITÉ.', 160, 48, P.cream)
    if (best > 0) drawTextC(ctx, 'RECORD : ' + euros(best), 160, 138, P.white)
    if (Math.floor(now * 1.5) % 2) drawTextC(ctx, pointerTouch ? 'TAPOTE POUR OUVRIR LA BOUTIQUE' : 'ESPACE POUR OUVRIR LA BOUTIQUE', 160, 148, P.yellow)
    drawHud()
  }

  function drawResults() {
    drawShop()
    rect(0, 28, W, 130, P.bordeaux)
    for (let x = 0; x < W; x += 12) rect(x, 28, 4, 130, '#5e2234')
    drawSeller()
    const since = now - stateAt
    const lines = [
      ['CHIFFRE D’AFFAIRES : ' + euros(G.revenue), P.yellow],
      ['VESTE LA PLUS CHÈRE : ' + euros(G.bestSale), P.white],
      ['AFFAIRES DU SIÈCLE : ' + G.perfectDeals, P.white],
      ['', P.white],
      ['SELON LE VENDEUR :', P.cream],
      ['« J’AI RIEN GAGNÉ. »', P.cream],
    ]
    lines.forEach(([t, c], i) => {
      if (since > 0.1 + i * 0.15) drawTextC(ctx, t, 190, 40 + i * 11, c)
    })
    if (since > 1.1) {
      if (G.newRecord) drawTextC(ctx, 'NOUVEAU RECORD !', 190, 110, P.yellow)
      else drawTextC(ctx, 'RECORD : ' + euros(best), 190, 110, P.white)
    }
    if (since > C.RESULTS_LOCK && Math.floor(now * 1.5) % 2) drawTextC(ctx, pointerTouch ? 'TAPOTE POUR RECOMMENCER' : 'ESPACE POUR RECOMMENCER', 190, 130, P.yellow)
    rect(0, 158, W, 22, P.ink)
    drawText(ctx, 'CAISSE ' + euros(G.revenue), 4, 8, P.white)
    drawSoundButton()
  }

  let pointerTouch = false
  function draw() {
    if (state === 'TITLE') return drawTitle()
    if (state === 'RESULTS') return drawResults()
    ctx.save()
    if (effects.shake > 0 && reaction) ctx.translate(Math.round((Math.random() - 0.5) * effects.shake * 2), 0)
    drawShop()
    drawSeller()
    drawCustomer()
    drawHands()
    for (const pt of effects.particles) {
      if (pt.kind === 'bill') outlined(Math.round(pt.x), Math.round(pt.y), 8, 4, P.green)
      else rect(Math.round(pt.x), Math.round(pt.y), 5, 4, P.white)
    }
    drawCurtain()
    ctx.restore()
    drawOffer()
    drawHud()
  }

  function frame(ts) {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (ts - lastFrame) / 1000)
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
        if (payload.x >= b.x && payload.x < b.x + b.w && payload.y >= b.y && payload.y < b.y + b.h) {
          toggleMute()
          return
        }
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
    if (paused || state === 'TITLE' || state === 'RESULTS') return
    paused = true
    pausedByVisibility = true
  }
  function resume() {
    // Resuming requires a press (consumed without selling); the shell may call this too.
    if (!paused) return
    paused = false
    pausedByVisibility = false
    lastFrame = performance.now()
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
    customer = null
    audio.music(false)
    setState('TITLE')
  }
  function destroy() {
    destroyed = true
    cancelAnimationFrame(raf)
    audio.music(false)
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
    get state() {
      return paused ? 'paused' : state === 'TITLE' ? 'idle' : state === 'RESULTS' ? 'over' : 'playing'
    },
    get debug() {
      return debug ? { state, customer, G, pausedByVisibility } : null
    },
  }
}

/** Server side: a sixty-second run can hold about twenty customers at most. */
export function validate(result) {
  if (!result || typeof result !== 'object') return false
  const d = result.details
  const values = [result.score, d?.revenue, d?.bestSale, d?.perfectDeals, d?.sales, d?.missed]
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false
  if (result.score !== d.revenue) return false
  if (d.perfectDeals > d.sales) return false
  const customers = d.sales + d.missed
  const maxCustomers = Math.ceil(CONFIG.RUN_DURATION / (CONFIG.ENTRY_DURATION + CONFIG.SUCCESS_DURATION)) + 2
  if (customers > maxCustomers) return false
  // Each sale is at most the top of the curve at the maximal tier.
  const maxSale = offerFor(1, CONFIG.MAX_TIER)
  if (d.bestSale > maxSale || d.revenue > maxSale * customers) return false
  return true
}

export function grade(result) {
  const r = result.details.revenue
  return r >= 15000 ? 'S' : r >= 9000 ? 'A' : r >= 5000 ? 'B' : r >= 2000 ? 'C' : 'D'
}
