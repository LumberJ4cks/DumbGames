/*
 * BARRICASSE — simulation. « Tout fait barricade. Même le poisson. »
 *
 * Pure rules, no DOM: the same file runs in the browser (window.BarricasseSim) and in Node for
 * the deterministic scenarios in test/sim.test.js. Fixed step (CONFIG.DT), integer tick
 * counter, three seeded random streams (shots, launchers, items) so a seed replays the same
 * police pattern whatever the player does. Rendering, audio and particles live in game.js
 * and read `state.out`, the list of notifications produced by the last steps.
 *
 * Portrait street: demonstrators at the top, police at the bottom, balls travel upwards.
 * Barricades are placed freely (overlaps allowed); each object's box is its sprite's real
 * opaque bounds × its scale, and it takes `hp` hits (the football takes none at all).
 */
;(function () {
  'use strict'

  /* ---------- configuration (every tunable number lives here) ---------- */
  const CONFIG = {
    W: 480,
    H: 640,
    DT: 1 / 120,
    RUN_DURATION: 90,
    // Street: side walls bounce the balls; the build zone spans the street between crowd and police.
    STREET_L: 72,
    STREET_R: 408,
    ZONE_T: 168,
    ZONE_B: 484,
    TOP_ABSORB_Y: 58,
    BOTTOM_EXIT_Y: 596,
    // Stock and deliveries: left sidewalk, right one during the supplier change.
    STOCK_MAIN: { x: 36, y: 330 },
    STOCK_ALT: { x: 444, y: 330 },
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
    LAUNCHER_Y: 532,
    SPAWN_Y: 512,
    LAUNCHER_MIN_X: 104,
    LAUNCHER_MAX_X: 376,
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
    // Crowd: three rows facing the police, the front row closest to it.
    CROWD_ROWS: [82, 106, 130],
    CROWD_PER_ROW: 8,
    CROWD_CENTER_X: 240,
    CROWD_SPACING: 36,
    CROWD_EVENT_SPACING: 44,
    CROWD_SPEED: 18,
    CROWD_MARGIN: 12,
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
    // Test hook: no police at all.
    NO_SHOTS: false,
  }

  /* ---------- catalogue ----------
   * scale: integer zoom of the 24 × 24 art (×1 small, ×2 normal, ×3 huge).
   * hp: hits taken before breaking; every hit bounces the ball. 0 = useless, the ball goes on.
   */
  const ITEMS = {
    chaise: { name: 'Chaise de jardin', scale: 2, hp: 1 },
    palette: { name: 'Palette', scale: 2, hp: 2 },
    voiture: { name: 'Voiture', scale: 3, hp: 2 },
    planche: { name: 'Planche à repasser', scale: 2, hp: 1 },
    frigo: { name: 'Frigo', scale: 2, hp: 2 },
    canape: { name: 'Canapé fleuri', scale: 3, hp: 3 },
    reverbere: { name: 'Réverbère', scale: 2, hp: 2 },
    poisson: { name: 'Poisson', scale: 2, hp: 1 },
    armoire: { name: 'Armoire normande', scale: 3, hp: 3 },
    ballon: { name: 'Ballon de foot', scale: 1, hp: 0 },
    baignoire: { name: 'Baignoire', scale: 2, hp: 2 },
    photocopieuse: { name: 'Photocopieuse', scale: 2, hp: 2 },
    nain: { name: 'Nain de jardin', scale: 1, hp: 1 },
    fromage: { name: 'Meule de fromage', scale: 2, hp: 2 },
    piano: { name: 'Piano droit', scale: 3, hp: 3 },
    caddie: { name: 'Caddie', scale: 2, hp: 1 },
    plante: { name: 'Plante verte', scale: 1, hp: 1 },
    toilettes: { name: 'Toilettes', scale: 2, hp: 1 },
    cheval: { name: 'Cheval à bascule', scale: 2, hp: 1 },
    distributeur: { name: 'Distributeur de boissons', scale: 2, hp: 2 },
    gateau: { name: 'Gâteau de mariage', scale: 2, hp: 1 },
    tableau: { name: 'Tableau de paysage', scale: 2, hp: 1 },
    trophee: { name: 'Trophée de pétanque', scale: 1, hp: 1 },
    carton: { name: 'Carton « FRAGILE »', scale: 2, hp: 1 },
    barbecue: { name: 'Barbecue', scale: 2, hp: 1 },
    glaciere: { name: 'Glacière', scale: 2, hp: 1 },
    parasol: { name: 'Parasol', scale: 2, hp: 1 },
    merguez: { name: 'Merguez géante', scale: 2, hp: 1 },
  }
  /* Opaque bounds [x, y, w, h] of each 24 × 24 sprite, outline included. Generated by
     `node barricasse/test/sprite-bounds.js`; a test fails if the art and this table drift. */
  const BOUNDS = {
    chaise: [3, 0, 18, 23],
    palette: [0, 2, 24, 22],
    voiture: [0, 3, 24, 19],
    planche: [0, 6, 23, 17],
    frigo: [4, 0, 16, 24],
    canape: [0, 3, 24, 20],
    reverbere: [6, 2, 16, 22],
    poisson: [0, 4, 24, 16],
    armoire: [1, 0, 22, 24],
    ballon: [2, 2, 21, 21],
    baignoire: [0, 3, 24, 20],
    photocopieuse: [0, 4, 24, 19],
    nain: [5, 0, 14, 24],
    fromage: [1, 4, 23, 18],
    piano: [0, 1, 24, 22],
    caddie: [0, 2, 23, 21],
    plante: [1, 0, 23, 24],
    toilettes: [3, 0, 19, 23],
    cheval: [1, 1, 22, 23],
    distributeur: [3, 0, 18, 24],
    gateau: [1, 1, 22, 23],
    tableau: [0, 1, 24, 23],
    trophee: [2, 0, 20, 23],
    carton: [1, 3, 22, 19],
    barbecue: [2, 6, 22, 18],
    glaciere: [1, 2, 22, 20],
    parasol: [0, 1, 24, 23],
    merguez: [0, 1, 24, 19],
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
      stats: { sent: 0, delivered: 0, tooLate: 0, hits: 0, destroyed: 0, kicked: 0, evacuated: 0, passedTop: 0, lost: 0, shots: 0, capSkipped: 0, byItem: {} },
      out: [],
    }
    let n = 0
    C.CROWD_ROWS.forEach((y, row) => {
      for (let i = 0; i < C.CROWD_PER_ROW; i++) {
        const x = C.CROWD_CENTER_X + (i - (C.CROWD_PER_ROW - 1) / 2) * C.CROWD_SPACING
        s.people.push({ id: s.nextId++, index: n++, row, x, y, tx: x, alive: true, lostAt: 0 })
      }
    })
    s.launchers.push({ id: s.nextId++, x: 240, tx: 240, active: true, lockedUntil: -1, firedAt: -9 })
    s.launchers.push({ id: s.nextId++, x: C.STREET_R + 30, tx: C.STREET_R + 30, active: false, lockedUntil: -1, firedAt: -9 })
    for (const ev of C.EVENTS) s.events[ev.id] = 'pending'
    refreshPool(s)
    return s
  }

  /* ---------- placement geometry ---------- */
  function inZone(s, x, y) {
    const C = s.C
    return x >= C.STREET_L && x <= C.STREET_R && y >= C.ZONE_T && y <= C.ZONE_B
  }
  /** Box of `item` dropped at (x, y): centred on the point, kept inside the build zone. */
  function boxAt(s, item, x, y) {
    const C = s.C
    const { w, h } = sizeOf(item)
    // Snapped to whole pixels so the art stays crisp; physics uses the same box.
    const bx = Math.round(Math.min(C.STREET_R - w, Math.max(C.STREET_L, x - w / 2)))
    const by = Math.round(Math.min(C.ZONE_B - h, Math.max(C.ZONE_T, y - h / 2)))
    return { x: bx, y: by, w, h, cx: bx + w / 2, cy: by + h / 2 }
  }
  function maxDistance(s, origin) {
    const C = s.C
    let best = 0
    for (const x of [C.STREET_L, C.STREET_R]) for (const y of [C.ZONE_T, C.ZONE_B]) best = Math.max(best, Math.hypot(x - origin.x, y - origin.y))
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
      // Side walls.
      const minX = C.STREET_L + r
      const maxX = C.STREET_R - r
      if (dx < 0 && b.x + dx < minX) consider({ t: Math.max(0, (minX - b.x) / dx), kind: 'wall', prio: 2 })
      if (dx > 0 && b.x + dx > maxX) consider({ t: Math.max(0, (maxX - b.x) / dx), kind: 'wall', prio: 2 })
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
      if (Math.min(b.y, b.y + dy) - r < C.CROWD_ROWS[C.CROWD_ROWS.length - 1] + C.PERSON_H) {
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
        b.vx = -b.vx
        b.x = Math.min(maxX, Math.max(minX, b.x))
        s.out.push({ type: 'wall', x: b.x, y: b.y, ball: b.id })
      } else if (best.kind === 'object') hitObject(s, best.obj, b, best.axis)
      else if (best.kind === 'person') losePerson(s, best.person, b)
    }
    if (!b.alive) return
    if (b.y < C.TOP_ABSORB_Y) {
      b.alive = false
      s.stats.passedTop++
      s.out.push({ type: 'top', x: b.x, ball: b.id })
    } else if (b.y > C.BOTTOM_EXIT_Y) {
      b.alive = false
      s.stats.evacuated++
      s.out.push({ type: 'evacuated', x: b.x, ball: b.id })
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
    regroupRow(s, p.row)
  }

  /* ---------- crowd: survivors close ranks, slowly, in order ---------- */
  function regroupRow(s, row) {
    const C = s.C
    const members = s.people.filter((p) => p.alive && p.row === row).sort((a, b) => a.index - b.index)
    const n = members.length
    if (!n) return
    const span = C.STREET_R - C.STREET_L - 2 * C.CROWD_MARGIN
    const sp = n > 1 ? Math.min(s.spacing, span / (n - 1)) : 0
    members.forEach((p, k) => (p.tx = C.CROWD_CENTER_X + (k - (n - 1) / 2) * sp))
  }
  function regroupAll(s) {
    for (let row = 0; row < s.C.CROWD_ROWS.length; row++) regroupRow(s, row)
  }
  function updateCrowd(s, dt) {
    const step = s.C.CROWD_SPEED * dt
    for (const p of s.people) {
      if (!p.alive) continue
      const d = p.tx - p.x
      p.moving = Math.abs(d) > 1e-6
      p.x = Math.abs(d) <= step ? p.tx : p.x + Math.sign(d) * step
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
      const x = Math.min(C.STREET_R - 14, Math.max(C.STREET_L + 14, L.x))
      const angle = (s.rngShots() * 2 - 1) * ph.maxAngle
      L.lockedUntil = f + C.LAUNCHER_RECOVER
      const a = { id: s.nextId++, launcher: li, x, angle, speed: ph.speed, announcedAt: now, fireAt: f }
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
      const b = spawnBall(s, a.x, C.SPAWN_Y, a.speed * Math.sin(rad), -a.speed * Math.cos(rad), { speed: a.speed })
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
    L.x = s.C.STREET_R + 24
    L.tx = 330
  }
  function updateLaunchers(s, dt) {
    const C = s.C
    if (s.t >= C.SECOND_LAUNCHER_AT) activateLauncher(s, 1)
    for (const L of s.launchers) {
      if (!L.active) continue
      L.walking = false
      if (s.t < L.lockedUntil || s.activeEvent === 'treve') continue
      const d = L.tx - L.x
      const step = C.LAUNCHER_SPEED * dt
      if (Math.abs(d) <= step) {
        L.x = L.tx
        L.tx = C.LAUNCHER_MIN_X + s.rngWalk() * (C.LAUNCHER_MAX_X - C.LAUNCHER_MIN_X)
      } else {
        L.x += Math.sign(d) * step
        L.walking = true
      }
    }
    // Keep the two launchers apart so their arrows never overlap.
    const [a, b] = s.launchers
    const mid = (C.STREET_L + C.STREET_R) / 2
    if (a.active && b.active && Math.abs(a.tx - b.tx) < C.LAUNCHER_GAP) b.tx = a.tx < mid ? Math.max(b.tx, a.tx + C.LAUNCHER_GAP + 20) : Math.min(b.tx, a.tx - C.LAUNCHER_GAP - 20)
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
    }
  }
  /** Records: survivors first, then time held, then balls sent back. */
  function better(a, b) {
    if (!b) return true
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
