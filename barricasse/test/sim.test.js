// Deterministic scenarios for the rules of BARRICASSE. Run: node --test barricasse/test/
const test = require('node:test')
const assert = require('node:assert/strict')
const Sim = require('../sim.js')

const quiet = () => Sim.create('test', { NO_SHOTS: true })
const run = (s, seconds) => {
  const n = Math.round(seconds / s.C.DT)
  for (let i = 0; i < n && !s.over; i++) Sim.step(s)
}
const idx = (s, col, row) => Sim.cellIndex(s, col, row)
const place = (s, i, item = 'voiture') => {
  s.cells[i].state = 'OCCUPIED'
  s.cells[i].item = item
}
const drain = (s) => s.out.splice(0)

test('1. new game: crowd top, police bottom, empty grid, stock ready', () => {
  const s = Sim.create('a')
  assert.equal(s.people.length, 24)
  assert.deepEqual([...new Set(s.people.map((p) => p.y))], [82, 106, 130])
  assert.ok(s.cells.every((c) => c.state === 'EMPTY'))
  assert.equal(Sim.command(s, 0).ok, true)
  assert.equal(Sim.POOLS.early.includes(s.lastSent), true)
})

test('2. an order reserves at once and flies; nothing is solid before arrival', () => {
  const s = quiet()
  const i = idx(s, 3, 5)
  const r = Sim.command(s, i)
  assert.ok(r.ok)
  assert.equal(s.cells[i].state, 'RESERVED')
  assert.equal(s.deliveries.length, 1)
  // A ball crossing the reserved cell before arrival goes straight through.
  const rect = Sim.cellRect(s, i)
  const b = Sim.spawnBall(s, rect.cx, rect.y + rect.h + 20, 0, -400)
  run(s, 0.1)
  assert.equal(b.vy, -400)
  assert.equal(s.cells[i].state, 'RESERVED')
})

test('3. flight time follows distance and stays within [0.2, 1]', () => {
  const s = quiet()
  const near = Sim.deliveryTime(s, s.stock, idx(s, 0, 3))
  const far = Sim.deliveryTime(s, s.stock, idx(s, 6, 0))
  assert.ok(near >= 0.2 && near < 0.45, `near ${near}`)
  assert.ok(Math.abs(far - 1) < 1e-9, `far ${far}`)
  for (let i = 0; i < s.cells.length; i++) {
    const t = Sim.deliveryTime(s, s.stock, i)
    assert.ok(t >= 0.2 && t <= 1)
  }
})

test('4. frantic clicking during the reload delivers nothing more and queues nothing', () => {
  const s = quiet()
  assert.ok(Sim.command(s, 0).ok)
  let refused = 0
  for (let k = 0; k < 90; k++) {
    if (!Sim.command(s, 1 + (k % 20)).ok) refused++
    Sim.step(s) // 90 steps = 0.75 s < 0.8 s
  }
  assert.equal(refused, 90)
  assert.equal(s.stats.sent, 1)
  run(s, 2)
  assert.equal(s.stats.sent, 1, 'no hidden queue fired later')
})

test('5. a long delivery does not block the next once the reload is over', () => {
  const s = quiet()
  assert.ok(Sim.command(s, idx(s, 6, 0)).ok) // 1 s flight
  run(s, 0.8)
  assert.ok(Sim.command(s, idx(s, 6, 1)).ok)
  assert.equal(s.deliveries.length, 2, 'two objects in the air')
})

test('6. reserved or occupied cells refuse without consuming the reload', () => {
  const s = quiet()
  const i = idx(s, 6, 0) // 1 s flight: still in the air after the reload
  assert.ok(Sim.command(s, i).ok)
  run(s, 0.8)
  const ready = s.stock.readyAt
  assert.equal(Sim.command(s, i).reason, 'reserved')
  assert.equal(s.stock.readyAt, ready)
  run(s, 0.5)
  assert.equal(s.cells[i].state, 'OCCUPIED')
  assert.equal(Sim.command(s, i).reason, 'occupied')
  assert.ok(Sim.command(s, idx(s, 4, 4)).ok, 'reload still available')
})

test('7a. a ball destroys one barricade and bounces exactly once (face)', () => {
  const s = quiet()
  const i = idx(s, 3, 3)
  place(s, i)
  const r = Sim.cellRect(s, i)
  const b = Sim.spawnBall(s, r.cx, r.y + r.h + 30, 0, -150)
  drain(s)
  run(s, 0.5)
  const destroys = drain(s).filter((e) => e.type === 'destroy')
  assert.equal(destroys.length, 1)
  assert.equal(s.cells[i].state, 'EMPTY')
  assert.equal(b.vy, 150)
  assert.equal(b.vx, 0)
})

test('7b. no tunnelling at very high speed', () => {
  for (const speed of [600, 3000, 20000]) {
    const s = quiet()
    const i = idx(s, 1, 4)
    place(s, i)
    const r = Sim.cellRect(s, i)
    const b = Sim.spawnBall(s, r.cx + 7, r.y + r.h + 40, 0, -speed)
    drain(s)
    run(s, 0.2)
    const destroys = drain(s).filter((e) => e.type === 'destroy')
    assert.equal(destroys.length, 1, `speed ${speed}`)
    assert.ok(b.vy > 0)
  }
})

test('7c. exact corner: both components flip, one destruction', () => {
  const s = quiet()
  const i = idx(s, 3, 2)
  place(s, i)
  const r = Sim.cellRect(s, i)
  const R = s.C.BALL_RADIUS
  // Aim exactly at the bottom-left corner of the grown box, 45°.
  const cx = r.x - R
  const cy = r.y + r.h + R
  const b = Sim.spawnBall(s, cx - 20, cy + 20, 100, -100)
  drain(s)
  run(s, 0.5)
  assert.equal(drain(s).filter((e) => e.type === 'destroy').length, 1)
  assert.equal(b.vx, -100)
  assert.equal(b.vy, 100)
})

test('7d. side face flips vx only; a corner continued by a neighbour is a face', () => {
  const s = quiet()
  const i = idx(s, 3, 2)
  place(s, i)
  const r = Sim.cellRect(s, i)
  const b = Sim.spawnBall(s, r.x - 30, r.cy, 120, 0)
  run(s, 0.5)
  assert.equal(b.vx, -120)
  assert.equal(b.vy, 0)
  // Seam between two neighbours on the same row: one destroyed, vertical bounce.
  const s2 = quiet()
  const a = idx(s2, 2, 3)
  const c = idx(s2, 3, 3)
  place(s2, a)
  place(s2, c)
  const ra = Sim.cellRect(s2, a)
  const R = s2.C.BALL_RADIUS
  const b2 = Sim.spawnBall(s2, ra.x + ra.w + R - 20, ra.y + ra.h + R + 20, 100, -100)
  drain(s2)
  run(s2, 0.5)
  const d = drain(s2).filter((e) => e.type === 'destroy')
  assert.equal(d.length, 1)
  assert.equal(b2.vy, 100)
  assert.equal(b2.vx, 100)
})

test('8. fish and car: same box, same single hit', () => {
  for (const item of ['poisson', 'voiture']) {
    const s = quiet()
    const i = idx(s, 3, 3)
    place(s, i, item)
    const r = Sim.cellRect(s, i)
    const b = Sim.spawnBall(s, r.x - 3, r.y + r.h + 30, 0, -150) // grazes the left edge, inside the grown box
    run(s, 0.4)
    assert.equal(s.cells[i].state, 'EMPTY', item)
    assert.equal(b.vy, 150, item)
  }
})

test('9. a ball touching a demonstrator removes exactly one and disappears', () => {
  const s = quiet()
  const p = s.people.find((q) => q.row === 2 && q.index === 19)
  const b = Sim.spawnBall(s, p.x, 300, 0, -200)
  drain(s)
  run(s, 1.5)
  const lost = drain(s).filter((e) => e.type === 'lost')
  assert.equal(lost.length, 1)
  assert.equal(Sim.survivors(s), 23)
  assert.equal(b.alive, false)
  assert.equal(s.balls.length, 0)
})

test('10. a ball between demonstrators leaves through the top without a loss', () => {
  const s = quiet()
  const p = s.people.find((q) => q.index === 3)
  const b = Sim.spawnBall(s, p.x + 18, 300, 0, -200)
  run(s, 2)
  assert.equal(Sim.survivors(s), 24)
  assert.equal(b.alive, false)
  assert.equal(s.stats.passedTop, 1)
})

test('11. the crowd closes gaps progressively; collisions use real positions', () => {
  const s = quiet()
  const row = s.people.filter((p) => p.row === 2)
  const victim = row[0]
  Sim.spawnBall(s, victim.x, 300, 0, -200)
  run(s, 1.2)
  assert.equal(victim.alive, false)
  const next = row[1]
  const before = next.x
  Sim.step(s)
  const moved = Math.abs(next.x - before)
  assert.ok(moved > 0 && moved <= s.C.CROWD_SPEED * s.C.DT + 1e-9, 'walks, never teleports')
  // While walking, the old target is empty and the real position is hit.
  const x = next.x
  const b = Sim.spawnBall(s, next.tx, 300, 0, -400)
  run(s, 0.6)
  assert.ok(next.alive || Math.abs(x - next.tx) < 18, 'target position is not a hitbox')
  void b
  run(s, 10)
  const xs = row.filter((p) => p.alive).map((p) => p.x)
  for (let k = 1; k < xs.length; k++) assert.ok(Math.abs(xs[k] - xs[k - 1] - 36) < 1e-6)
  assert.ok(Math.abs((xs[0] + xs[xs.length - 1]) / 2 - 240) < 1e-6, 'centred')
})

test('12. the truce stops new shots only; deliveries, reload and balls continue', () => {
  const s = Sim.create('truce')
  run(s, 58)
  const shotsAt58 = s.stats.shots
  const inPlay = s.balls.filter((b) => b.alive).length
  const before = inPlay ? s.balls[0] : null
  assert.equal(s.activeEvent, 'treve')
  assert.ok(Sim.POOLS.treve.includes(s.stock.next))
  assert.ok(Sim.command(s, idx(s, 0, 5)).ok)
  run(s, 0.5)
  assert.equal(s.stats.delivered, 1)
  run(s, 3.4)
  assert.equal(s.stats.shots, shotsAt58)
  if (before && before.alive) assert.ok(before.y !== undefined)
})

test('13. no burst of stored shots after the truce or a long pause', () => {
  const s = Sim.create('catchup')
  run(s, 62)
  const at62 = s.stats.shots
  run(s, 1.0)
  assert.ok(s.stats.shots - at62 <= 1, `after truce ${s.stats.shots - at62}`)
  // A pause is simply no steps: nothing is owed when stepping resumes.
  const s2 = Sim.create('pause')
  run(s2, 30)
  const n = s2.stats.shots
  Sim.step(s2)
  assert.ok(s2.stats.shots - n <= 1)
  // Shots never come closer than the phase allows.
  const s3 = Sim.create('spacing')
  const times = []
  for (let k = 0; k < 90 / s3.C.DT && !s3.over; k++) {
    Sim.step(s3)
    for (const e of s3.out.splice(0)) if (e.type === 'fire' || e.type === 'capskip') times.push(s3.t)
  }
  for (let k = 1; k < times.length; k++) assert.ok(times[k] - times[k - 1] > 0.4, `gap ${times[k] - times[k - 1]} at ${times[k]}`)
  assert.ok(times.every((t) => t < 89 + 1e-6 && !(t >= 58 && t < 62)))
})

test('14. supplier change: future deliveries only, flights keep their origin', () => {
  const s = Sim.create('supplier', { NO_SHOTS: true })
  run(s, 72.9)
  assert.ok(Sim.command(s, idx(s, 6, 0)).ok)
  const flight = s.deliveries[0]
  assert.equal(flight.from.x, 30)
  run(s, 0.2)
  assert.equal(s.stock.x, 450)
  assert.equal(flight.from.x, 30)
  run(s, 0.7)
  assert.ok(Sim.command(s, idx(s, 0, 0)).ok)
  assert.equal(s.deliveries[s.deliveries.length - 1].from.x, 450)
  run(s, 6)
  assert.equal(s.stock.x, 30)
})

test('15. end at 90 s or zero survivors is stable; replay starts clean', () => {
  const q = Sim.create('end', { NO_SHOTS: true })
  run(q, 100)
  assert.equal(q.over, true)
  assert.equal(q.endReason, 'time')
  assert.ok(Math.abs(q.t - 90) < 1e-9)
  const s = Sim.create('end')
  run(s, 100)
  assert.equal(s.over, true)
  const snap = JSON.stringify(Sim.summary(s))
  Sim.step(s)
  assert.equal(JSON.stringify(Sim.summary(s)), snap)
  const w = quiet()
  for (const p of w.people) {
    if (p.index === 23) continue
    p.alive = false
  }
  const last = w.people[23]
  Sim.spawnBall(w, last.x, 300, 0, -300)
  run(w, 2)
  assert.equal(w.over, true)
  assert.equal(w.endReason, 'wiped')
  const fresh = Sim.create('end')
  assert.equal(fresh.balls.length + fresh.deliveries.length + fresh.announces.length, 0)
})

test('rupture: fridges and sofas, 1 s flights even next door; flights already sent unchanged', () => {
  const s = Sim.create('rupture', { NO_SHOTS: true })
  run(s, 23.9)
  assert.ok(Sim.command(s, idx(s, 0, 3)).ok)
  const early = s.deliveries[0]
  run(s, 0.8)
  assert.equal(s.activeEvent, 'rupture')
  assert.ok(['frigo', 'canape'].includes(s.stock.next))
  assert.ok(early.duration < 0.5)
  assert.ok(Sim.command(s, idx(s, 0, 4)).ok)
  assert.equal(s.deliveries[s.deliveries.length - 1].duration, 1)
})

test('too late: posed and broken at once, ball untouched, cell freed', () => {
  const s = quiet()
  const i = idx(s, 0, 2)
  assert.ok(Sim.command(s, i).ok)
  const d = s.deliveries[0]
  const r = Sim.cellRect(s, i)
  // Ball crossing the cell exactly at landing time.
  const speed = 100
  const b = Sim.spawnBall(s, r.cx, r.cy + speed * d.duration, 0, -speed)
  drain(s)
  run(s, d.duration + 0.05)
  const ev = drain(s)
  assert.equal(ev.filter((e) => e.type === 'toolate').length, 1)
  assert.equal(s.cells[i].state, 'EMPTY')
  assert.equal(b.vy, -speed)
})

test('groupes: spacing widens to 44 then returns to 36', () => {
  const s = Sim.create('grp', { NO_SHOTS: true })
  run(s, 47.9)
  const row = s.people.filter((p) => p.row === 0)
  assert.ok(Math.abs(row[1].tx - row[0].tx - 44) < 1e-9)
  run(s, 20)
  assert.ok(Math.abs(row[1].x - row[0].x - 36) < 1e-9)
})

test('determinism: same seed, same police pattern, whatever the player does', () => {
  const record = (clicky) => {
    const s = Sim.create('same')
    const shots = []
    for (let k = 0; k < 45 / s.C.DT; k++) {
      if (clicky && k % 50 === 0) Sim.command(s, k % 42)
      Sim.step(s)
      for (const e of s.out.splice(0)) if (e.type === 'announce') shots.push([e.announce.fireAt.toFixed(3), e.announce.x.toFixed(2), e.announce.angle.toFixed(3)])
    }
    return JSON.stringify(shots)
  }
  assert.equal(record(false), record(true))
})

test('item bag: no immediate repeat, familiar objects before 20 s, never three in a row', () => {
  const s = quiet()
  const seq = []
  for (let k = 0; k < 2400 && !s.over; k++) {
    if (s.t >= s.stock.readyAt) {
      const free = s.cells.findIndex((c) => c.state === 'EMPTY')
      if (free >= 0) {
        const item = s.stock.next
        Sim.command(s, free)
        seq.push([s.t, item])
      }
    }
    Sim.step(s)
    for (const c of s.cells) if (c.state === 'OCCUPIED') c.state = 'EMPTY'
  }
  for (let k = 1; k < seq.length; k++) assert.notEqual(seq[k][1], seq[k - 1][1])
  assert.ok(seq.filter(([t]) => t < 20).every(([, it]) => Sim.POOLS.early.includes(it)))
})

test('a very fast ball cannot skip over a demonstrator', () => {
  const s = quiet()
  const p = s.people.find((q) => q.row === 2 && q.index === 20)
  Sim.spawnBall(s, p.x, 400, 0, -9000)
  run(s, 0.2)
  assert.equal(p.alive, false)
  assert.equal(Sim.survivors(s), 23)
})
