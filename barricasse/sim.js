/*
 * BARRICASSE — simulation. « Tout fait barricade. Même le poisson. »
 *
 * Pure rules, no DOM: the same file runs in the browser (window.BarricasseSim) and in Node for
 * the deterministic scenarios in test/sim.test.js. Fixed step (CONFIG.DT), integer tick
 * counter, three seeded random streams (shots, launchers, items) so a seed replays the same
 * police pattern whatever the player does. Rendering, audio and particles live in game.js
 * and read `state.out`, the list of notifications produced by the last steps.
 */
;(function () {
  'use strict'

  /* ---------- configuration (every tunable number lives here) ---------- */
  const CONFIG = {
    W: 480,
    H: 640,
    DT: 1 / 120,
    RUN_DURATION: 90,
    // Street and build grid (7 × 6 cells of 48 px).
    STREET_L: 72,
    STREET_R: 408,
    GRID_X: 72,
    GRID_Y: 180,
    COLS: 7,
    ROWS: 6,
    CELL: 48,
    TOP_ABSORB_Y: 58,
    BOTTOM_EXIT_Y: 596,
    // Stock and deliveries.
    STOCK_LEFT: { x: 30, y: 330 },
    STOCK_RIGHT: { x: 450, y: 330 },
    RELOAD: 0.8,
    DELIVERY_MIN: 0.2,
    DELIVERY_MAX: 1.0,
    ARC_MIN: 18,
    ARC_MAX: 54,
    NEAR_MISS: 34,
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
    SECOND_LAUNCHER_AT: 37.5,
    FIRST_SHOT: 5.6,
    LAST_SHOT_BEFORE: 89,
    // Global intervals: with two launchers they alternate, the cadence is not doubled.
    PHASES: [
      { from: 0, mode: 'none' },
      { from: 5, mode: 'single', interval: 2.2, speed: 130, maxAngle: 8, launchers: 1 },
      { from: 20, mode: 'single', interval: 1.5, speed: 150, maxAngle: 24, launchers: 1 },
      { from: 40, mode: 'single', interval: 1.05, speed: 175, maxAngle: 35, launchers: 2 },
      { from: 60, mode: 'burst', count: 5, gap: 0.55, rest: 2.0, speed: 195, maxAngle: 35, launchers: 2 },
      { from: 75, mode: 'burst', count: 6, gap: 0.42, rest: 1.2, speed: 210, maxAngle: 35, launchers: 2 },
      { from: 89, mode: 'none' },
    ],
    // Crowd.
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

  /* ---------- catalogue: one cell, one hit, same box for everything ---------- */
  const ITEMS = {
    chaise: 'Chaise de jardin',
    palette: 'Palette',
    voiture: 'Voiture',
    planche: 'Planche à repasser',
    frigo: 'Frigo',
    canape: 'Canapé fleuri',
    reverbere: 'Réverbère',
    poisson: 'Poisson',
    armoire: 'Armoire normande',
    ballon: 'Ballon de foot',
    baignoire: 'Baignoire',
    photocopieuse: 'Photocopieuse',
    nain: 'Nain de jardin',
    fromage: 'Meule de fromage',
    piano: 'Piano droit',
    caddie: 'Caddie',
    plante: 'Plante verte',
    toilettes: 'Toilettes',
    cheval: 'Cheval à bascule',
    distributeur: 'Distributeur de boissons',
    gateau: 'Gâteau de mariage',
    tableau: 'Tableau de paysage',
    trophee: 'Trophée de pétanque',
    carton: 'Carton « FRAGILE »',
    barbecue: 'Barbecue',
    glaciere: 'Glacière',
    parasol: 'Parasol',
    merguez: 'Merguez géante',
  }
  const POOLS = {
    early: ['chaise', 'palette', 'frigo', 'canape', 'voiture', 'armoire'],
    full: Object.keys(ITEMS).slice(0, 24),
    rupture: ['frigo', 'canape'],
    treve: ['barbecue', 'glaciere', 'parasol', 'merguez'],
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
      cells: [],
      deliveries: [],
      balls: [],
      people: [],
      launchers: [],
      announces: [],
      stock: { x: C.STOCK_LEFT.x, y: C.STOCK_LEFT.y, readyAt: 0, next: null, side: 'left' },
      lastSent: null,
      bag: [],
      poolKey: null,
      shot: { nextFire: C.NO_SHOTS ? null : C.FIRST_SHOT, burstIndex: 0, phaseIndex: -1, turn: 0 },
      events: {},
      activeEvent: null,
      spacing: C.CROWD_SPACING,
      stats: { sent: 0, delivered: 0, tooLate: 0, destroyed: 0, evacuated: 0, passedTop: 0, lost: 0, shots: 0, capSkipped: 0, byItem: {} },
      out: [],
    }
    for (let i = 0; i < C.COLS * C.ROWS; i++) s.cells.push({ state: 'EMPTY', item: null, objId: 0, placedAt: 0 })
    let n = 0
    C.CROWD_ROWS.forEach((y, row) => {
      for (let i = 0; i < C.CROWD_PER_ROW; i++) {
        const x = C.CROWD_CENTER_X + (i - (C.CROWD_PER_ROW - 1) / 2) * C.CROWD_SPACING
        s.people.push({ id: s.nextId++, index: n++, row, x, y, tx: x, alive: true, lostAt: 0 })
      }
    })
    s.launchers.push({ id: s.nextId++, x: 240, tx: 240, active: true, lockedUntil: -1, firedAt: -9 })
    s.launchers.push({ id: s.nextId++, x: C.W + 30, tx: C.W + 30, active: false, lockedUntil: -1, firedAt: -9 })
    for (const ev of C.EVENTS) s.events[ev.id] = 'pending'
    refreshPool(s)
    return s
  }

  /* ---------- geometry helpers ---------- */
  function cellIndex(s, col, row) {
    return row * s.C.COLS + col
  }
  function cellRect(s, i) {
    const C = s.C
    const col = i % C.COLS
    const row = (i / C.COLS) | 0
    const x = C.GRID_X + col * C.CELL
    const y = C.GRID_Y + row * C.CELL
    return { x, y, w: C.CELL, h: C.CELL, cx: x + C.CELL / 2, cy: y + C.CELL / 2, col, row }
  }
  /** Logical point → cell index, or -1 outside the grid. */
  function cellAt(s, x, y) {
    const C = s.C
    const col = Math.floor((x - C.GRID_X) / C.CELL)
    const row = Math.floor((y - C.GRID_Y) / C.CELL)
    if (col < 0 || row < 0 || col >= C.COLS || row >= C.ROWS) return -1
    return cellIndex(s, col, row)
  }
  function maxDistance(s, origin) {
    let best = 0
    for (let i = 0; i < s.cells.length; i++) {
      const r = cellRect(s, i)
      best = Math.max(best, Math.hypot(r.cx - origin.x, r.cy - origin.y))
    }
    return best
  }
  function deliveryTime(s, origin, i) {
    const C = s.C
    if (s.activeEvent === 'rupture') return C.RUPTURE_FLIGHT
    const r = cellRect(s, i)
    const d = Math.hypot(r.cx - origin.x, r.cy - origin.y)
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
      // Only the last item is left: start a new bag and take something else from it.
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
  /** Returns { ok, reason }. A refused order consumes nothing and does not restart the reload. */
  function command(s, i) {
    if (s.over) return { ok: false, reason: 'over' }
    if (i < 0 || i >= s.cells.length) return { ok: false, reason: 'out' }
    if (s.t < s.stock.readyAt - 1e-9) return { ok: false, reason: 'reload' }
    const cell = s.cells[i]
    if (cell.state !== 'EMPTY') return { ok: false, reason: cell.state === 'RESERVED' ? 'reserved' : 'occupied' }
    const C = s.C
    const from = { x: s.stock.x, y: s.stock.y }
    const r = cellRect(s, i)
    const duration = deliveryTime(s, from, i)
    const dist = Math.hypot(r.cx - from.x, r.cy - from.y)
    const d = {
      id: s.nextId++,
      cell: i,
      item: s.stock.next,
      from,
      to: { x: r.cx, y: r.cy },
      sentAt: s.t,
      duration,
      arriveAt: s.t + duration,
      arc: C.ARC_MIN + (C.ARC_MAX - C.ARC_MIN) * Math.min(1, dist / maxDistance(s, from)),
      landed: false,
    }
    cell.state = 'RESERVED'
    cell.item = d.item
    s.deliveries.push(d)
    s.stock.readyAt = s.t + C.RELOAD
    s.stats.sent++
    s.lastSent = d.item
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
  function solidAt(s, col, row) {
    const C = s.C
    if (col < 0 || col >= C.COLS) return col < 0 ? C.GRID_X <= C.STREET_L : C.GRID_X + C.COLS * C.CELL >= C.STREET_R
    if (row < 0 || row >= C.ROWS) return false
    return s.cells[cellIndex(s, col, row)].state === 'OCCUPIED'
  }
  /** A corner whose neighbour continues the surface is really a face. */
  function settleCorner(s, i, b) {
    const r = cellRect(s, i)
    const sideCol = b.vx > 0 ? r.col - 1 : r.col + 1
    const sideRow = b.vy > 0 ? r.row - 1 : r.row + 1
    const horiz = solidAt(s, sideCol, r.row)
    const vert = solidAt(s, r.col, sideRow)
    if (horiz && !vert) return 'y'
    if (vert && !horiz) return 'x'
    return 'xy'
  }

  function spawnBall(s, x, y, vx, vy, extra) {
    const b = Object.assign({ id: s.nextId++, x, y, vx, vy, alive: true, born: s.t, hits: 0 }, extra || {})
    s.balls.push(b)
    return b
  }

  function moveBall(s, b, dt) {
    const C = s.C
    const r = C.BALL_RADIUS
    let remaining = dt
    for (let iter = 0; iter < 10 && remaining > 1e-12 && b.alive; iter++) {
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
      if (dx < 0 && b.x + dx < minX) consider({ t: Math.max(0, (minX - b.x) / dx), kind: 'wall', axis: 'x', prio: 2 })
      if (dx > 0 && b.x + dx > maxX) consider({ t: Math.max(0, (maxX - b.x) / dx), kind: 'wall', axis: 'x', prio: 2 })
      // Barricades near the swept path.
      const x0 = Math.min(b.x, b.x + dx) - r
      const x1 = Math.max(b.x, b.x + dx) + r
      const y0 = Math.min(b.y, b.y + dy) - r
      const y1 = Math.max(b.y, b.y + dy) + r
      const c0 = Math.max(0, Math.floor((x0 - C.GRID_X) / C.CELL))
      const c1 = Math.min(C.COLS - 1, Math.floor((x1 - C.GRID_X) / C.CELL))
      const r0 = Math.max(0, Math.floor((y0 - C.GRID_Y) / C.CELL))
      const r1 = Math.min(C.ROWS - 1, Math.floor((y1 - C.GRID_Y) / C.CELL))
      for (let row = r0; row <= r1; row++)
        for (let col = c0; col <= c1; col++) {
          const i = cellIndex(s, col, row)
          if (s.cells[i].state !== 'OCCUPIED') continue
          const cr = cellRect(s, i)
          const hit = sweep(b.x, b.y, dx, dy, cr.x - r, cr.y - r, cr.x + cr.w + r, cr.y + cr.h + r)
          if (!hit) continue
          // Ties between cells: a face beats a corner, then the cell facing the ball most.
          const off = hit.axis === 'y' ? Math.abs(b.x + dx * hit.t - cr.cx) : Math.abs(b.y + dy * hit.t - cr.cy)
          consider({ t: hit.t, kind: 'cell', axis: hit.axis, cell: i, prio: (hit.axis === 'xy' ? 0.5 : 0) + off / 1000 })
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
      } else if (best.kind === 'cell') {
        const cell = s.cells[best.cell]
        const axis = best.axis === 'xy' ? settleCorner(s, best.cell, b) : best.axis
        const item = cell.item
        cell.state = 'EMPTY'
        cell.item = null
        if (axis !== 'y') b.vx = -b.vx
        if (axis !== 'x') b.vy = -b.vy
        // Epsilon separation along the new direction.
        b.x += Math.sign(b.vx) * 1e-6
        b.y += Math.sign(b.vy) * 1e-6
        b.hits++
        s.stats.destroyed++
        s.out.push({ type: 'destroy', cell: best.cell, item, x: b.x, y: b.y, axis, ball: b.id, objId: cell.objId })
      } else if (best.kind === 'person') {
        losePerson(s, best.person, b)
      }
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
    const cell = s.cells[d.cell]
    const cr = cellRect(s, d.cell)
    d.landed = true
    const blocking = s.balls.find((b) => b.alive && insideGrown(b, cr.x, cr.y, cr.x + cr.w, cr.y + cr.h, r))
    if (blocking) {
      // Too late: posed and broken at once, the ball carries on untouched. No refund.
      cell.state = 'EMPTY'
      cell.item = null
      s.stats.tooLate++
      s.out.push({ type: 'toolate', delivery: d, cell: d.cell, item: d.item, x: cr.cx, y: cr.cy })
      return
    }
    cell.state = 'OCCUPIED'
    cell.item = d.item
    cell.objId = d.id
    cell.placedAt = s.t
    s.stats.delivered++
    s.stats.byItem[d.item] = (s.stats.byItem[d.item] || 0) + 1
    const near = s.balls.some((b) => b.alive && Math.hypot(b.x - cr.cx, b.y - cr.cy) < C.CELL / 2 + C.NEAR_MISS)
    s.out.push({ type: 'land', delivery: d, cell: d.cell, item: d.item, x: cr.cx, y: cr.cy, near })
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
    if (a.active && b.active && Math.abs(a.tx - b.tx) < 70) b.tx = a.tx < 240 ? Math.max(b.tx, a.tx + 90) : Math.min(b.tx, a.tx - 90)
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
      if (ev.id === 'fournisseur') moveStock(s, 'right')
      if (ev.id === 'treve') for (const a of s.announces) a.done = true
    }
    if (phase === 'done') {
      if (s.activeEvent === ev.id) s.activeEvent = null
      if (ev.id === 'groupes') {
        s.spacing = C.CROWD_SPACING
        regroupAll(s)
      }
      if (ev.id === 'fournisseur') moveStock(s, 'left')
    }
    s.out.push({ type: 'event', id: ev.id, phase })
  }
  function moveStock(s, side) {
    const p = side === 'right' ? s.C.STOCK_RIGHT : s.C.STOCK_LEFT
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
  /** Records: survivors first, then time held, then balls sent back down. */
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
    POOLS,
    create,
    step,
    command,
    cellAt,
    cellRect,
    cellIndex,
    deliveryTime,
    maxDistance,
    spawnBall,
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
