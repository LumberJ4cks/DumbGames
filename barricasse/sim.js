/*
 * BARRICASSE — simulation. « Tout fait barricade. Même le poisson. »
 *
 * Pure rules, no DOM: the same file runs in the browser (window.BarricasseSim) and in Node for
 * the deterministic scenarios in test/sim.test.js. Fixed step (CONFIG.DT), integer tick
 * counter, three seeded random streams (shots, launchers, items) so a seed replays the same
 * police pattern whatever the player does. Rendering, audio and particles live in game.js
 * and read `state.out`, the list of notifications produced by the last steps.
 *
 * Landscape street: police on the left, demonstrators on the right, balls travel rightwards.
 * Barricades are placed freely (overlaps allowed); each object's box is its sprite's real
 * opaque bounds × its scale, and it takes `hp` hits (the football takes none at all).
 */
;(function () {
  'use strict'

  /* ---------- configuration (every tunable number lives here) ---------- */
  const CONFIG = {
    W: 640,
    H: 360,
    DT: 1 / 120,
    RUN_DURATION: 90,
    // Street: curbs at the top and bottom bounce the balls; the build zone sits in between.
    STREET_T: 60,
    STREET_B: 316,
    ZONE_L: 140,
    ZONE_R: 520,
    // A ball that slips through the crowd is absorbed on the right; one sent back leaves on the left.
    CROWD_ABSORB_X: 626,
    EXIT_X: 28,
    // Stock and deliveries.
    STOCK_MAIN: { x: 340, y: 338 },
    STOCK_ALT: { x: 340, y: 42 },
    RELOAD: 0.8,
    DELIVERY_MIN: 0.2,
    DELIVERY_MAX: 1.0,
    ARC_MIN: 16,
    ARC_MAX: 46,
    NEAR_MISS: 30,
    // Balls and launchers.
    BALL_RADIUS: 5,
    BALL_CAP: 10,
    ANNOUNCE: 0.6,
    LAUNCHER_X: 98,
    SPAWN_X: 118,
    LAUNCHER_MIN_Y: 84,
    LAUNCHER_MAX_Y: 292,
    LAUNCHER_SPEED: 55,
    LAUNCHER_RECOVER: 0.18,
    LAUNCHER_GAP: 70,
    SECOND_LAUNCHER_AT: 37.5,
    FIRST_SHOT: 5.6,
    LAST_SHOT_BEFORE: 89,
    // Global intervals: with two launchers they alternate, the cadence is not doubled.
    PHASES: [
      { from: 0, mode: 'none' },
      { from: 5, mode: 'single', interval: 2.0, speed: 135, maxAngle: 8, launchers: 1 },
      { from: 20, mode: 'single', interval: 1.4, speed: 155, maxAngle: 24, launchers: 1 },
      { from: 40, mode: 'single', interval: 0.95, speed: 180, maxAngle: 35, launchers: 2 },
      { from: 60, mode: 'burst', count: 5, gap: 0.5, rest: 1.8, speed: 200, maxAngle: 35, launchers: 2 },
      { from: 75, mode: 'burst', count: 6, gap: 0.4, rest: 1.1, speed: 215, maxAngle: 35, launchers: 2 },
      { from: 89, mode: 'none' },
    ],
    // Crowd: three lines facing left, back to front (the last one is closest to the police).
    CROWD_LINES: [606, 582, 558],
    CROWD_PER_LINE: 8,
    CROWD_CENTER_Y: 188,
    CROWD_SPACING: 30,
    CROWD_EVENT_SPACING: 34,
    CROWD_SPEED: 18,
    CROWD_MARGIN: 10,
    PERSON_W: 14,
    PERSON_H: 18,
    // Absurd events, fixed order for the first prototype.
    EVENT_ANNOUNCE: 1.5,
    EVENTS: [
      { id: 'rupture', start: 24, duration: 6 },
      { id: 'groupes', start: 42, duration: 6 },
      { id: 'treve', start: 58, duration: 4 },
      { id: 'fournisseur', start: 73, duration: 6 },
    ],
    RUPTURE_FLIGHT: 1.0,
    SUPPLIER_RETURN_WARN: 1,
    TRUCE_RESUME_DELAY: 1.0,
    EARLY_POOL_UNTIL: 20,
    // Score and combos: points never reward a loss. A ball sent back feeds the combo; the combo
    // ends after COMBO_WINDOW s without one, or at once when someone is hit.
    SCORE_EVAC: 100,
    SCORE_HIT: 10,
    SCORE_JUST_IN_TIME: 50,
    SCORE_SURVIVOR: 500,
    COMBO_WINDOW: 4,
    COMBO_TIERS: [0, 4, 9, 16, 25],
    // Test hook: no police at all.
    NO_SHOTS: false,
  }

  /* ---------- catalogue ----------
   * scale: kept at 1 (v2 sprites are drawn at their real size, so sizes differ by design).
   * hp: hits taken before breaking; every hit bounces the ball. 0 = useless, the ball goes on.
   */
  const ITEMS = {
    chaise: { name: 'Chaise de jardin', scale: 1, hp: 1 },
    palette: { name: 'Palette', scale: 1, hp: 2 },
    voiture: { name: 'Voiture', scale: 1, hp: 2 },
    planche: { name: 'Planche à repasser', scale: 1, hp: 1 },
    frigo: { name: 'Frigo', scale: 1, hp: 2 },
    canape: { name: 'Canapé fleuri', scale: 1, hp: 3 },
    reverbere: { name: 'Réverbère', scale: 1, hp: 2 },
    poisson: { name: 'Poisson', scale: 1, hp: 1 },
    armoire: { name: 'Armoire normande', scale: 1, hp: 3 },
    ballon: { name: 'Ballon de foot', scale: 1, hp: 0 },
    baignoire: { name: 'Baignoire', scale: 1, hp: 2 },
    photocopieuse: { name: 'Photocopieuse', scale: 1, hp: 2 },
    nain: { name: 'Nain de jardin', scale: 1, hp: 1 },
    fromage: { name: 'Meule de fromage', scale: 1, hp: 2 },
    piano: { name: 'Piano droit', scale: 1, hp: 3 },
    caddie: { name: 'Caddie', scale: 1, hp: 1 },
    plante: { name: 'Plante verte', scale: 1, hp: 1 },
    toilettes: { name: 'Toilettes', scale: 1, hp: 1 },
    cheval: { name: 'Cheval à bascule', scale: 1, hp: 1 },
    distributeur: { name: 'Distributeur de boissons', scale: 1, hp: 2 },
    gateau: { name: 'Gâteau de mariage', scale: 1, hp: 1 },
    tableau: { name: 'Tableau de paysage', scale: 1, hp: 1 },
    trophee: { name: 'Trophée de pétanque', scale: 1, hp: 1 },
    carton: { name: 'Carton « FRAGILE »', scale: 1, hp: 1 },
    barbecue: { name: 'Barbecue', scale: 1, hp: 1 },
    glaciere: { name: 'Glacière', scale: 1, hp: 1 },
    parasol: { name: 'Parasol', scale: 1, hp: 1 },
    merguez: { name: 'Merguez géante', scale: 1, hp: 1 },
  }
  /* Opaque bounds [x, y, w, h] of each sprite canvas, outline included. Generated by
     `node barricasse/test/sprite-bounds.js`; a test fails if the art and this table drift. */
  const BOUNDS = {
    chaise: [3, 2, 28, 41],
    palette: [1, 2, 46, 38],
    voiture: [1, 6, 70, 45],
    planche: [2, 8, 42, 27],
    frigo: [1, 2, 30, 47],
    canape: [1, 4, 71, 48],
    reverbere: [6, 2, 19, 44],
    poisson: [2, 1, 47, 27],
    armoire: [1, 0, 56, 71],
    ballon: [1, 1, 20, 20],
    baignoire: [1, 1, 48, 37],
    photocopieuse: [0, 3, 47, 37],
    nain: [1, 1, 16, 26],
    fromage: [2, 3, 43, 30],
    piano: [1, 1, 66, 60],
    caddie: [1, 3, 41, 36],
    plante: [1, 1, 22, 26],
    toilettes: [3, 2, 32, 43],
    cheval: [2, 3, 43, 42],
    distributeur: [1, 2, 34, 49],
    gateau: [2, 0, 38, 45],
    tableau: [1, 1, 46, 43],
    trophee: [1, 1, 18, 24],
    carton: [2, 4, 40, 32],
    barbecue: [3, 6, 40, 32],
    glaciere: [2, 2, 40, 33],
    parasol: [1, 1, 47, 46],
    merguez: [0, 1, 48, 26],
  }
  const POOLS = {
    early: ['chaise', 'palette', 'frigo', 'canape', 'voiture', 'armoire'],
    full: Object.keys(ITEMS).slice(0, 24),
    rupture: ['frigo', 'canape'],
    treve: ['barbecue', 'glaciere', 'parasol', 'merguez'],
  }
  /** Physical size of an object, in logical pixels. */
  function sizeOf(item) {
    const b = BOUNDS[item]
    const k = ITEMS[item].scale
    return { w: b[2] * k, h: b[3] * k }
  }

  /* ---------- seeded random ---------- */
  function hashSeed(seed) {
    let h = 2166136261 >>> 0
    const str = String(seed)
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    return h >>> 0
  }
  function mulberry32(a) {
    return function () {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /* ---------- state ---------- */
  function create(seed, overrides) {
    const C = Object.assign({}, CONFIG, overrides || {})
    const base = hashSeed(seed)
    const s = {
      C,
      seed,
      rngShots: mulberry32(base ^ 0x5eed01),
      rngWalk: mulberry32(base ^ 0x5eed02),
      rngItems: mulberry32(base ^ 0x5eed03),
      tick: 0,
      endTick: Math.round(C.RUN_DURATION / C.DT),
      t: 0,
      over: false,
      endReason: null,
      nextId: 1,
      objects: [],
      deliveries: [],
      balls: [],
      people: [],
      launchers: [],
      announces: [],
      stock: { x: C.STOCK_MAIN.x, y: C.STOCK_MAIN.y, readyAt: 0, next: null, side: 'main' },
      lastSent: null,
      bag: [],
      poolKey: null,
      shot: { nextFire: C.NO_SHOTS ? null : C.FIRST_SHOT, burstIndex: 0, phaseIndex: -1, turn: 0 },
      events: {},
      activeEvent: null,
      spacing: C.CROWD_SPACING,
      score: 0,
      combo: 0,
      comboUntil: 0,
      bestCombo: 0,
      mult: 1,
      stats: { sent: 0, delivered: 0, tooLate: 0, hits: 0, destroyed: 0, kicked: 0, evacuated: 0, passedCrowd: 0, lost: 0, shots: 0, capSkipped: 0, byItem: {} },
      out: [],
    }
    let n = 0
    C.CROWD_LINES.forEach((x, line) => {
      for (let i = 0; i < C.CROWD_PER_LINE; i++) {
        const y = C.CROWD_CENTER_Y + (i - (C.CROWD_PER_LINE - 1) / 2) * C.CROWD_SPACING
        s.people.push({ id: s.nextId++, index: n++, line, x, y, ty: y, alive: true, lostAt: 0 })
      }
    })
    const midY = (C.STREET_T + C.STREET_B) / 2
    s.launchers.push({ id: s.nextId++, y: midY, ty: midY, active: true, lockedUntil: -1, firedAt: -9 })
    s.launchers.push({ id: s.nextId++, y: C.STREET_B + 30, ty: C.STREET_B + 30, active: false, lockedUntil: -1, firedAt: -9 })
    for (const ev of C.EVENTS) s.events[ev.id] = 'pending'
    refreshPool(s)
    return s
  }

  /* ---------- placement geometry ---------- */
  function inZone(s, x, y) {
    const C = s.C
    return x >= C.ZONE_L && x <= C.ZONE_R && y >= C.STREET_T && y <= C.STREET_B
  }
  /** Box of `item` dropped at (x, y): centred on the point, kept inside the build zone. */
  function boxAt(s, item, x, y) {
    const C = s.C
    const { w, h } = sizeOf(item)
    // Snapped to whole pixels so the art stays crisp; physics uses the same box.
    const bx = Math.round(Math.min(C.ZONE_R - w, Math.max(C.ZONE_L, x - w / 2)))
    const by = Math.round(Math.min(C.STREET_B - h, Math.max(C.STREET_T, y - h / 2)))
    return { x: bx, y: by, w, h, cx: bx + w / 2, cy: by + h / 2 }
  }
  function maxDistance(s, origin) {
    const C = s.C
    let best = 0
    for (const x of [C.ZONE_L, C.ZONE_R]) for (const y of [C.STREET_T, C.STREET_B]) best = Math.max(best, Math.hypot(x - origin.x, y - origin.y))
    return best
  }
  function deliveryTime(s, origin, x, y) {
    const C = s.C
    if (s.activeEvent === 'rupture') return C.RUPTURE_FLIGHT
    const d = Math.hypot(x - origin.x, y - origin.y)
    const t = C.DELIVERY_MIN + (C.DELIVERY_MAX - C.DELIVERY_MIN) * (d / maxDistance(s, origin))
    return Math.min(C.DELIVERY_MAX, Math.max(C.DELIVERY_MIN, t))
  }
  function phaseIndexAt(s, time) {
    const P = s.C.PHASES
    let idx = 0
    for (let i = 0; i < P.length; i++) if (time >= P[i].from) idx = i
    return idx
  }
  function eventWindow(s, id) {
    const ev = s.C.EVENTS.find((e) => e.id === id)
    return ev ? { start: ev.start, end: ev.start + ev.duration } : null
  }

  /* ---------- item bag: shuffled, never the same twice in a row ---------- */
  function currentPoolKey(s) {
    if (s.activeEvent === 'rupture') return 'rupture'
    if (s.activeEvent === 'treve') return 'treve'
    return s.t < s.C.EARLY_POOL_UNTIL ? 'early' : 'full'
  }
  function refill(s) {
    const bag = POOLS[s.poolKey].slice()
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(s.rngItems() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    s.bag = bag
  }
  function drawItem(s) {
    if (!s.bag.length) refill(s)
    let k = s.bag.findIndex((id) => id !== s.lastSent)
    if (k < 0) {
      refill(s)
      k = Math.max(0, s.bag.findIndex((id) => id !== s.lastSent))
    }
    return s.bag.splice(k, 1)[0]
  }
  /** The preview is always the object that will leave: a pool change replaces it at once. */
  function refreshPool(s) {
    const key = currentPoolKey(s)
    if (key === s.poolKey) return
    s.poolKey = key
    refill(s)
    s.stock.next = drawItem(s)
    s.out.push({ type: 'preview', item: s.stock.next, pool: key })
  }

  /* ---------- commands ---------- */
  /** Order the next object at (x, y). A refused order consumes nothing. Overlaps are allowed. */
  function command(s, x, y) {
    if (s.over) return { ok: false, reason: 'over' }
    if (!inZone(s, x, y)) return { ok: false, reason: 'out' }
    if (s.t < s.stock.readyAt - 1e-9) return { ok: false, reason: 'reload' }
    const C = s.C
    const item = s.stock.next
    const box = boxAt(s, item, x, y)
    const from = { x: s.stock.x, y: s.stock.y }
    const duration = deliveryTime(s, from, box.cx, box.cy)
    const dist = Math.hypot(box.cx - from.x, box.cy - from.y)
    const d = {
      id: s.nextId++,
      item,
      box,
      from,
      to: { x: box.cx, y: box.cy },
      sentAt: s.t,
      duration,
      arriveAt: s.t + duration,
      arc: C.ARC_MIN + (C.ARC_MAX - C.ARC_MIN) * Math.min(1, dist / maxDistance(s, from)),
      landed: false,
    }
    s.deliveries.push(d)
    s.stock.readyAt = s.t + C.RELOAD
    s.stats.sent++
    s.lastSent = item
    s.stock.next = drawItem(s)
    s.out.push({ type: 'send', delivery: d })
    return { ok: true, delivery: d }
  }

  /* ---------- continuous collision: circle swept against a box grown by the radius ---------- */
  const AXIS_EPS = 1e-9
  function sweep(px, py, dx, dy, minx, miny, maxx, maxy) {
    let txE, txX, tyE, tyX
    if (dx === 0) {
      if (px <= minx || px >= maxx) return null
      txE = -Infinity
      txX = Infinity
    } else {
      const a = (minx - px) / dx
      const b = (maxx - px) / dx
      txE = Math.min(a, b)
      txX = Math.max(a, b)
    }
    if (dy === 0) {
      if (py <= miny || py >= maxy) return null
      tyE = -Infinity
      tyX = Infinity
    } else {
      const a = (miny - py) / dy
      const b = (maxy - py) / dy
      tyE = Math.min(a, b)
      tyX = Math.max(a, b)
    }
    const tE = Math.max(txE, tyE)
    const tX = Math.min(txX, tyX)
    // Starting inside (tE < 0) or grazing (tE >= tX) is not a contact.
    if (tE < 0 || tE > 1 || tE >= tX) return null
    const axis = txE > tyE + AXIS_EPS ? 'x' : tyE > txE + AXIS_EPS ? 'y' : 'xy'
    return { t: tE, axis }
  }
  function insideGrown(b, x0, y0, x1, y1, r) {
    return b.x > x0 - r && b.x < x1 + r && b.y > y0 - r && b.y < y1 + r
  }

  function spawnBall(s, x, y, vx, vy, extra) {
    const b = Object.assign({ id: s.nextId++, x, y, vx, vy, alive: true, born: s.t, hits: 0 }, extra || {})
    s.balls.push(b)
    return b
  }
  /** Test and debug helper: an object already standing at (x, y). */
  function placeNow(s, item, x, y) {
    const box = boxAt(s, item, x, y)
    const o = { id: s.nextId++, item, box, hp: ITEMS[item].hp, maxHp: ITEMS[item].hp, alive: true, placedAt: s.t }
    s.objects.push(o)
    return o
  }

  /* ---------- score and combos ---------- */
  function multiplierFor(s, combo) {
    let m = 1
    s.C.COMBO_TIERS.forEach((need, i) => {
      if (combo >= need) m = i + 1
    })
    return m
  }
  function addScore(s, amount, reason, x, y) {
    s.score += amount
    s.out.push({ type: 'score', amount, reason, x, y, mult: s.mult, combo: s.combo })
  }
  function feedCombo(s) {
    s.combo++
    s.comboUntil = s.t + s.C.COMBO_WINDOW
    s.bestCombo = Math.max(s.bestCombo, s.combo)
    const m = multiplierFor(s, s.combo)
    if (m > s.mult) s.out.push({ type: 'combo-tier', mult: m, combo: s.combo })
    s.mult = m
  }
  function breakCombo(s, why) {
    if (s.combo > 0) s.out.push({ type: 'combo-end', combo: s.combo, why })
    s.combo = 0
    s.mult = 1
  }

  function moveBall(s, b, dt) {
    const C = s.C
    const r = C.BALL_RADIUS
    let remaining = dt
    for (let iter = 0; iter < 12 && remaining > 1e-12 && b.alive; iter++) {
      const dx = b.vx * remaining
      const dy = b.vy * remaining
      let best = null
      const consider = (hit) => {
        if (!best || hit.t < best.t - 1e-12) best = hit
        else if (Math.abs(hit.t - best.t) <= 1e-12 && hit.prio < best.prio) best = hit
      }
      // Curbs, top and bottom.
      const minY = C.STREET_T + r
      const maxY = C.STREET_B - r
      if (dy < 0 && b.y + dy < minY) consider({ t: Math.max(0, (minY - b.y) / dy), kind: 'wall', prio: 2 })
      if (dy > 0 && b.y + dy > maxY) consider({ t: Math.max(0, (maxY - b.y) / dy), kind: 'wall', prio: 2 })
      // Barricades (free boxes, possibly overlapping).
      const x0 = Math.min(b.x, b.x + dx) - r
      const x1 = Math.max(b.x, b.x + dx) + r
      const y0 = Math.min(b.y, b.y + dy) - r
      const y1 = Math.max(b.y, b.y + dy) + r
      for (const o of s.objects) {
        if (!o.alive) continue
        const q = o.box
        if (q.x > x1 || q.x + q.w < x0 || q.y > y1 || q.y + q.h < y0) continue
        const hit = sweep(b.x, b.y, dx, dy, q.x - r, q.y - r, q.x + q.w + r, q.y + q.h + r)
        if (!hit) continue
        // Ties between boxes: a face beats a corner, then the box facing the ball most.
        const off = hit.axis === 'y' ? Math.abs(b.x + dx * hit.t - q.cx) : Math.abs(b.y + dy * hit.t - q.cy)
        consider({ t: hit.t, kind: 'object', axis: hit.axis, obj: o, prio: (hit.axis === 'xy' ? 0.5 : 0) + off / 10000 })
      }
      // Demonstrators, at their real (moving) position.
      if (Math.max(b.x, b.x + dx) + r > C.CROWD_LINES[C.CROWD_LINES.length - 1] - C.PERSON_W) {
        const hw = C.PERSON_W / 2
        const hh = C.PERSON_H / 2
        for (const p of s.people) {
          if (!p.alive) continue
          if (insideGrown(b, p.x - hw, p.y - hh, p.x + hw, p.y + hh, r)) {
            consider({ t: 0, kind: 'person', person: p, prio: 3 })
            continue
          }
          const hit = sweep(b.x, b.y, dx, dy, p.x - hw - r, p.y - hh - r, p.x + hw + r, p.y + hh + r)
          if (hit) consider({ t: hit.t, kind: 'person', person: p, prio: 3 })
        }
      }
      if (!best) {
        b.x += dx
        b.y += dy
        remaining = 0
        break
      }
      b.x += dx * best.t
      b.y += dy * best.t
      remaining *= 1 - best.t
      if (best.kind === 'wall') {
        b.vy = -b.vy
        b.y = Math.min(maxY, Math.max(minY, b.y))
        s.out.push({ type: 'wall', x: b.x, y: b.y, ball: b.id })
      } else if (best.kind === 'object') hitObject(s, best.obj, b, best.axis)
      else if (best.kind === 'person') losePerson(s, best.person, b)
    }
    if (!b.alive) return
    if (b.x > C.CROWD_ABSORB_X) {
      b.alive = false
      s.stats.passedCrowd++
      s.out.push({ type: 'passed', y: b.y, ball: b.id })
    } else if (b.x < C.EXIT_X) {
      b.alive = false
      s.stats.evacuated++
      addScore(s, C.SCORE_EVAC * s.mult, 'evac', b.x, b.y)
      feedCombo(s)
      s.out.push({ type: 'evacuated', y: b.y, ball: b.id })
    }
  }

  function hitObject(s, o, b, axis) {
    if (o.hp <= 0) {
      // Useless object (the football): kicked away, the ball does not even slow down.
      o.alive = false
      s.stats.kicked++
      s.out.push({ type: 'kicked', obj: o, item: o.item, x: b.x, y: b.y, vx: b.vx, vy: b.vy, ball: b.id })
      return
    }
    if (axis !== 'y') b.vx = -b.vx
    if (axis !== 'x') b.vy = -b.vy
    // Epsilon separation along the new direction.
    b.x += Math.sign(b.vx) * 1e-6
    b.y += Math.sign(b.vy) * 1e-6
    b.hits++
    o.hp--
    s.stats.hits++
    addScore(s, s.C.SCORE_HIT, 'hit', b.x, b.y)
    if (o.hp <= 0) {
      o.alive = false
      s.stats.destroyed++
      s.out.push({ type: 'destroy', obj: o, item: o.item, x: b.x, y: b.y, axis, ball: b.id })
    } else s.out.push({ type: 'hit', obj: o, item: o.item, x: b.x, y: b.y, axis, ball: b.id })
  }

  function losePerson(s, p, b) {
    p.alive = false
    p.lostAt = s.t
    b.alive = false
    s.stats.lost++
    s.out.push({ type: 'lost', person: p, x: p.x, y: p.y, ball: b.id })
    breakCombo(s, 'lost')
    regroupLine(s, p.line)
  }

  /* ---------- crowd: survivors close ranks, slowly, in order ---------- */
  function regroupLine(s, line) {
    const C = s.C
    const members = s.people.filter((p) => p.alive && p.line === line).sort((a, b) => a.index - b.index)
    const n = members.length
    if (!n) return
    const span = C.STREET_B - C.STREET_T - 2 * C.CROWD_MARGIN - C.PERSON_H
    const sp = n > 1 ? Math.min(s.spacing, span / (n - 1)) : 0
    members.forEach((p, k) => (p.ty = C.CROWD_CENTER_Y + (k - (n - 1) / 2) * sp))
  }
  function regroupAll(s) {
    for (let line = 0; line < s.C.CROWD_LINES.length; line++) regroupLine(s, line)
  }
  function updateCrowd(s, dt) {
    const step = s.C.CROWD_SPEED * dt
    for (const p of s.people) {
      if (!p.alive) continue
      const d = p.ty - p.y
      p.moving = Math.abs(d) > 1e-6
      p.y = Math.abs(d) <= step ? p.ty : p.y + Math.sign(d) * step
    }
  }

  /* ---------- deliveries ---------- */
  function land(s, d) {
    const C = s.C
    const r = C.BALL_RADIUS
    const q = d.box
    d.landed = true
    const blocking = s.balls.find((b) => b.alive && insideGrown(b, q.x, q.y, q.x + q.w, q.y + q.h, r))
    if (blocking) {
      // Too late: posed and broken at once, the ball carries on untouched. No refund.
      s.stats.tooLate++
      s.out.push({ type: 'toolate', delivery: d, item: d.item, x: q.cx, y: q.cy })
      return
    }
    const o = { id: d.id, item: d.item, box: q, hp: ITEMS[d.item].hp, maxHp: ITEMS[d.item].hp, alive: true, placedAt: s.t }
    s.objects.push(o)
    s.stats.delivered++
    s.stats.byItem[d.item] = (s.stats.byItem[d.item] || 0) + 1
    const near = s.balls.some((b) => b.alive && b.x > q.x - C.NEAR_MISS && b.x < q.x + q.w + C.NEAR_MISS && b.y > q.y - C.NEAR_MISS && b.y < q.y + q.h + C.NEAR_MISS)
    s.out.push({ type: 'land', obj: o, delivery: d, item: d.item, x: q.cx, y: q.cy, near })
    if (near) addScore(s, C.SCORE_JUST_IN_TIME * s.mult, 'just', q.cx, q.y)
  }

  /* ---------- police: announces locked 0.6 s ahead, no catch-up ever ---------- */
  function shotsBlockedAt(s, time) {
    if (time >= s.C.LAST_SHOT_BEFORE) return 'end'
    const w = eventWindow(s, 'treve')
    if (w && time >= w.start && time < w.end) return 'treve'
    return null
  }
  function scheduleShots(s, now) {
    const C = s.C
    const sh = s.shot
    let guard = 0
    while (sh.nextFire !== null && now >= sh.nextFire - C.ANNOUNCE && guard++ < 8) {
      const f = sh.nextFire
      const blocked = shotsBlockedAt(s, f)
      if (blocked === 'end') {
        sh.nextFire = null
        break
      }
      if (blocked === 'treve') {
        // Planned shots are dropped, not stored: the cadence restarts after the truce.
        sh.nextFire = eventWindow(s, 'treve').end + C.TRUCE_RESUME_DELAY
        sh.burstIndex = 0
        continue
      }
      const pi = phaseIndexAt(s, f)
      const ph = C.PHASES[pi]
      if (ph.mode === 'none') {
        sh.nextFire = C.PHASES[pi + 1] ? C.PHASES[pi + 1].from : null
        continue
      }
      if (pi !== sh.phaseIndex) {
        sh.phaseIndex = pi
        sh.burstIndex = 0
      }
      const li = ph.launchers > 1 ? sh.turn++ % 2 : 0
      const L = s.launchers[li]
      if (!L.active) activateLauncher(s, li)
      const y = Math.min(C.STREET_B - 14, Math.max(C.STREET_T + 14, L.y))
      const angle = (s.rngShots() * 2 - 1) * ph.maxAngle
      L.lockedUntil = f + C.LAUNCHER_RECOVER
      const a = { id: s.nextId++, launcher: li, y, angle, speed: ph.speed, announcedAt: now, fireAt: f }
      s.announces.push(a)
      s.out.push({ type: 'announce', announce: a })
      if (ph.mode === 'single') sh.nextFire = f + ph.interval
      else if (++sh.burstIndex >= ph.count) {
        sh.burstIndex = 0
        sh.nextFire = f + ph.rest
      } else sh.nextFire = f + ph.gap
    }
    for (const a of s.announces) {
      if (a.fireAt > now + 1e-9) continue
      a.done = true
      if (shotsBlockedAt(s, a.fireAt)) continue
      const live = s.balls.filter((b) => b.alive).length
      if (live >= C.BALL_CAP) {
        // At the cap the shot is skipped, never stored for later.
        s.stats.capSkipped++
        s.out.push({ type: 'capskip', announce: a })
        continue
      }
      const rad = (a.angle * Math.PI) / 180
      const b = spawnBall(s, C.SPAWN_X, a.y, a.speed * Math.cos(rad), a.speed * Math.sin(rad), { speed: a.speed })
      s.launchers[a.launcher].firedAt = now
      s.stats.shots++
      s.out.push({ type: 'fire', ball: b, launcher: a.launcher })
    }
    if (s.announces.some((a) => a.done)) s.announces = s.announces.filter((a) => !a.done)
  }
  function activateLauncher(s, li) {
    const L = s.launchers[li]
    if (L.active) return
    L.active = true
    L.y = s.C.STREET_B + 24
    L.ty = 240
  }
  function updateLaunchers(s, dt) {
    const C = s.C
    if (s.t >= C.SECOND_LAUNCHER_AT) activateLauncher(s, 1)
    for (const L of s.launchers) {
      if (!L.active) continue
      L.walking = false
      if (s.t < L.lockedUntil || s.activeEvent === 'treve') continue
      const d = L.ty - L.y
      const step = C.LAUNCHER_SPEED * dt
      if (Math.abs(d) <= step) {
        L.y = L.ty
        L.ty = C.LAUNCHER_MIN_Y + s.rngWalk() * (C.LAUNCHER_MAX_Y - C.LAUNCHER_MIN_Y)
      } else {
        L.y += Math.sign(d) * step
        L.walking = true
      }
    }
    // Keep the two launchers apart so their arrows never overlap.
    const [a, b] = s.launchers
    const mid = (C.STREET_T + C.STREET_B) / 2
    if (a.active && b.active && Math.abs(a.ty - b.ty) < C.LAUNCHER_GAP) b.ty = a.ty < mid ? Math.max(b.ty, a.ty + C.LAUNCHER_GAP + 20) : Math.min(b.ty, a.ty - C.LAUNCHER_GAP - 20)
  }

  /* ---------- events ---------- */
  function updateEvents(s) {
    const C = s.C
    for (const ev of C.EVENTS) {
      const t = s.t
      const end = ev.start + ev.duration
      const was = s.events[ev.id]
      const now = t < ev.start - C.EVENT_ANNOUNCE ? 'pending' : t < ev.start ? 'announce' : t < end ? 'active' : 'done'
      if (now === was) {
        if (now === 'active' && ev.id === 'fournisseur' && !s.supplierWarned && t >= end - C.SUPPLIER_RETURN_WARN) {
          s.supplierWarned = true
          s.out.push({ type: 'event', id: ev.id, phase: 'warn' })
        }
        continue
      }
      // Walk through skipped phases in order (a big step never skips a start or an end).
      const order = ['pending', 'announce', 'active', 'done']
      for (let k = order.indexOf(was) + 1; k <= order.indexOf(now); k++) enterEventPhase(s, ev, order[k])
      s.events[ev.id] = now
    }
  }
  function enterEventPhase(s, ev, phase) {
    const C = s.C
    if (phase === 'active') {
      s.activeEvent = ev.id
      if (ev.id === 'groupes') {
        s.spacing = C.CROWD_EVENT_SPACING
        regroupAll(s)
      }
      if (ev.id === 'fournisseur') moveStock(s, 'alt')
      if (ev.id === 'treve') for (const a of s.announces) a.done = true
    }
    if (phase === 'done') {
      if (s.activeEvent === ev.id) s.activeEvent = null
      if (ev.id === 'groupes') {
        s.spacing = C.CROWD_SPACING
        regroupAll(s)
      }
      if (ev.id === 'fournisseur') moveStock(s, 'main')
    }
    s.out.push({ type: 'event', id: ev.id, phase })
  }
  function moveStock(s, side) {
    const p = side === 'alt' ? s.C.STOCK_ALT : s.C.STOCK_MAIN
    s.stock.x = p.x
    s.stock.y = p.y
    s.stock.side = side
  }

  /* ---------- one fixed step ---------- */
  function step(s) {
    if (s.over) return
    const C = s.C
    const t0 = s.t
    const t1 = (s.tick + 1) * C.DT
    s.t = t1
    updateEvents(s)
    refreshPool(s)
    s.t = t0
    // Arrivals and contacts in time order: balls advance up to each landing, then the rest.
    const due = s.deliveries.filter((d) => d.arriveAt <= t1 + 1e-12).sort((a, b) => a.arriveAt - b.arriveAt || a.id - b.id)
    let tc = t0
    for (const d of due) {
      const ta = Math.max(tc, d.arriveAt)
      advanceBalls(s, ta - tc)
      tc = ta
      s.t = ta
      land(s, d)
    }
    advanceBalls(s, t1 - tc)
    if (due.length) s.deliveries = s.deliveries.filter((d) => !d.landed)
    s.tick++
    s.t = t1
    if (s.combo > 0 && s.t > s.comboUntil) breakCombo(s, 'timeout')
    if (!C.NO_SHOTS) scheduleShots(s, t1)
    updateCrowd(s, C.DT)
    updateLaunchers(s, C.DT)
    if (s.balls.some((b) => !b.alive)) s.balls = s.balls.filter((b) => b.alive)
    if (s.objects.some((o) => !o.alive)) s.objects = s.objects.filter((o) => o.alive)
    const alive = s.people.reduce((n, p) => n + (p.alive ? 1 : 0), 0)
    if (alive === 0) finish(s, 'wiped')
    else if (s.tick >= s.endTick) finish(s, 'time')
  }
  function advanceBalls(s, dt) {
    if (dt <= 0) return
    for (const b of s.balls) if (b.alive) moveBall(s, b, dt)
  }
  function finish(s, reason) {
    s.over = true
    s.endReason = reason
    const alive = survivors(s)
    if (alive) addScore(s, alive * s.C.SCORE_SURVIVOR, 'survivors', 0, 0)
    s.out.push({ type: 'end', reason })
  }

  /* ---------- results ---------- */
  function survivors(s) {
    return s.people.reduce((n, p) => n + (p.alive ? 1 : 0), 0)
  }
  function summary(s) {
    let mostUsed = null
    for (const [id, n] of Object.entries(s.stats.byItem)) if (!mostUsed || n > s.stats.byItem[mostUsed]) mostUsed = id
    return {
      seed: s.seed,
      survivors: survivors(s),
      total: s.people.length,
      time: s.endReason === 'time' ? s.C.RUN_DURATION : Math.min(s.C.RUN_DURATION, s.t),
      evacuated: s.stats.evacuated,
      delivered: s.stats.delivered,
      tooLate: s.stats.tooLate,
      mostUsed,
      reason: s.endReason,
      score: s.score,
      bestCombo: s.bestCombo,
    }
  }
  /** Records: score first, then survivors, then time held, then balls sent back. */
  function better(a, b) {
    if (!b) return true
    if ((a.score ?? 0) !== (b.score ?? 0)) return (a.score ?? 0) > (b.score ?? 0)
    if (a.survivors !== b.survivors) return a.survivors > b.survivors
    if (Math.abs(a.time - b.time) > 1e-6) return a.time > b.time
    return a.evacuated > b.evacuated
  }
  function phaseAt(s) {
    return phaseIndexAt(s, s.t)
  }

  const api = {
    CONFIG,
    ITEMS,
    BOUNDS,
    POOLS,
    sizeOf,
    create,
    step,
    command,
    inZone,
    boxAt,
    deliveryTime,
    maxDistance,
    spawnBall,
    placeNow,
    survivors,
    summary,
    better,
    phaseAt,
    regroupAll,
    eventWindow,
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else window.BarricasseSim = api
})()
