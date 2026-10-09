// Deterministic scenarios for the rules of BARRICASSE. Run: node --test barricasse/test/sim.test.js
const test = require('node:test')
const assert = require('node:assert/strict')
const Sim = require('../sim.js')
const { bounds } = require('./sprite-bounds.js')

const C = Sim.CONFIG
const quiet = () => Sim.create('test', { NO_SHOTS: true })
const run = (s, seconds) => {
  const n = Math.round(seconds / s.C.DT)
  for (let i = 0; i < n && !s.over; i++) Sim.step(s)
}
const drain = (s) => s.out.splice(0)
const types = (evs, t) => evs.filter((e) => e.type === t)
const R = C.BALL_RADIUS

test('hitboxes are the sprites: bounds table matches the art', () => {
  assert.deepEqual(bounds(), Sim.BOUNDS)
})

test('sizes differ: a sofa is much bigger and sturdier than a football', () => {
  const sofa = Sim.sizeOf('canape')
  const ball = Sim.sizeOf('ballon')
  assert.ok(sofa.w * sofa.h > 8 * ball.w * ball.h)
  assert.equal(Sim.ITEMS.canape.hp, 3)
  assert.equal(Sim.ITEMS.ballon.hp, 0)
  const sizes = new Set(Object.keys(Sim.ITEMS).map((k) => Sim.sizeOf(k).w))
  assert.ok(sizes.size >= 8)
})

test('1. new game: crowd at the top, police at the bottom, empty street, stock ready', () => {
  const s = Sim.create('a')
  assert.equal(s.people.length, 24)
  assert.deepEqual([...new Set(s.people.map((p) => p.y))], C.CROWD_ROWS)
  assert.ok(s.people.every((p) => p.y < C.ZONE_T))
  assert.ok(C.SPAWN_Y > C.ZONE_B)
  assert.equal(s.objects.length, 0)
  assert.equal(Sim.command(s, 240, 300).ok, true)
  assert.ok(Sim.POOLS.early.includes(s.lastSent))
})

test('free placement: centred on the point, clamped inside the zone, overlaps allowed', () => {
  const s = quiet()
  const r1 = Sim.command(s, 250, 300)
  assert.ok(r1.ok)
  const b = r1.delivery.box
  assert.ok(Math.abs(b.cx - 250) <= 0.5 && Math.abs(b.cy - 300) <= 0.5)
  assert.ok(Number.isInteger(b.x) && Number.isInteger(b.y))
  run(s, 0.8)
  assert.ok(Sim.command(s, 255, 305).ok) // on top of the first one, still in the air
  run(s, 1.2)
  assert.equal(s.objects.length, 2)
  const s2 = quiet()
  const r3 = Sim.command(s2, C.STREET_R - 1, C.ZONE_T + 1)
  assert.ok(r3.ok)
  const q = r3.delivery.box
  assert.ok(q.x + q.w <= C.STREET_R && q.y >= C.ZONE_T)
  assert.equal(Sim.command(s2, 240, C.ZONE_T - 5).reason, 'out')
})

test('2. an order flies; nothing protects before arrival', () => {
  const s = quiet()
  assert.ok(Sim.command(s, 380, 180).ok)
  assert.equal(s.objects.length, 0)
  assert.equal(s.deliveries.length, 1)
  const b = Sim.spawnBall(s, 380, 240, 0, -400)
  run(s, 0.1)
  assert.equal(b.vy, -400)
})

test('3. flight time follows distance and stays within [0.2, 1]', () => {
  const s = quiet()
  const near = Sim.deliveryTime(s, s.stock, 90, 330)
  const far = Sim.deliveryTime(s, s.stock, C.STREET_R, C.ZONE_T)
  assert.ok(near >= 0.2 && near < 0.35, `near ${near}`)
  assert.ok(far > 0.95 && far <= 1, `far ${far}`)
  for (let x = C.STREET_L; x <= C.STREET_R; x += 20)
    for (let y = C.ZONE_T; y <= C.ZONE_B; y += 20) {
      const t = Sim.deliveryTime(s, s.stock, x, y)
      assert.ok(t >= 0.2 && t <= 1)
    }
})

test('4. frantic clicking during the reload delivers nothing more and queues nothing', () => {
  const s = quiet()
  assert.ok(Sim.command(s, 200, 300).ok)
  let refused = 0
  for (let k = 0; k < 90; k++) {
    if (!Sim.command(s, 100 + k, 200 + k).ok) refused++
    Sim.step(s)
  }
  assert.equal(refused, 90)
  run(s, 2)
  assert.equal(s.stats.sent, 1)
})

test('5. a long delivery does not block the next once the reload is over', () => {
  const s = quiet()
  assert.ok(Sim.command(s, C.STREET_R, C.ZONE_T).ok)
  run(s, 0.8)
  assert.ok(Sim.command(s, C.STREET_R - 60, C.ZONE_T).ok)
  assert.equal(s.deliveries.length, 2)
})

test('6. a refused click consumes nothing', () => {
  const s = quiet()
  assert.ok(Sim.command(s, 240, 300).ok)
  const ready = s.stock.readyAt
  assert.equal(Sim.command(s, 10, 300).reason, 'out')
  assert.equal(Sim.command(s, 240, 300).reason, 'reload')
  assert.equal(s.stock.readyAt, ready)
})

test('7a. one hit = one bounce; a 1-hp object breaks, a 3-hp sofa takes three', () => {
  const s = quiet()
  const o = Sim.placeNow(s, 'chaise', 240, 300)
  const b = Sim.spawnBall(s, 240, 460, 0, -150)
  drain(s)
  run(s, 1.5)
  assert.equal(types(drain(s), 'destroy').length, 1)
  assert.equal(o.alive, false)
  assert.equal(b.vy, 150)
  const s2 = quiet()
  const sofa = Sim.placeNow(s2, 'canape', 240, 300)
  for (let k = 0; k < 3; k++) {
    const bb = Sim.spawnBall(s2, 240, 470, 0, -300)
    drain(s2)
    run(s2, 0.6)
    const ev = drain(s2)
    assert.equal(bb.vy, 300, `bounce ${k}`)
    assert.equal(types(ev, k < 2 ? 'hit' : 'destroy').length, 1)
  }
  assert.equal(sofa.alive, false)
})

test('7b. no tunnelling at very high speed', () => {
  for (const speed of [600, 3000, 20000]) {
    const s = quiet()
    Sim.placeNow(s, 'nain', 240, 300)
    const b = Sim.spawnBall(s, 242, 480, 0, -speed)
    drain(s)
    run(s, 0.4)
    assert.equal(types(drain(s), 'destroy').length, 1, `speed ${speed}`)
    assert.ok(b.vy > 0)
  }
})

test('7c. exact corner: both components flip, one hit', () => {
  const s = quiet()
  const o = Sim.placeNow(s, 'frigo', 240, 300)
  const q = o.box
  const b = Sim.spawnBall(s, q.x + q.w + R + 20, q.y + q.h + R + 20, -100, -100)
  drain(s)
  run(s, 0.5)
  assert.equal(drain(s).filter((e) => e.type === 'hit' || e.type === 'destroy').length, 1)
  assert.equal(b.vx, 100)
  assert.equal(b.vy, 100)
})

test('7d. bottom face flips vy only, side face flips vx only', () => {
  const s = quiet()
  const o = Sim.placeNow(s, 'frigo', 240, 300)
  const b = Sim.spawnBall(s, o.box.cx, o.box.y + o.box.h + 30, 0, -120)
  run(s, 0.5)
  assert.equal(b.vy, 120)
  assert.equal(b.vx, 0)
  const s2 = quiet()
  const o2 = Sim.placeNow(s2, 'frigo', 240, 300)
  const b2 = Sim.spawnBall(s2, o2.box.x - 30, o2.box.cy, 120, 0)
  run(s2, 0.5)
  assert.equal(b2.vx, -120)
  assert.equal(b2.vy, 0)
})

test('overlapping objects: the ball meets the first surface only', () => {
  const s = quiet()
  const a = Sim.placeNow(s, 'frigo', 240, 290)
  const c = Sim.placeNow(s, 'frigo', 240, 300)
  Sim.spawnBall(s, 240, 470, 0, -200)
  drain(s)
  run(s, 1)
  const ev = drain(s).filter((e) => e.type === 'hit' || e.type === 'destroy')
  assert.equal(ev.length, 1)
  assert.equal(ev[0].obj, c)
  assert.equal(a.hp, a.maxHp)
})

test('the football is useless: kicked away, the ball keeps going', () => {
  const s = quiet()
  const o = Sim.placeNow(s, 'ballon', 240, 300)
  const b = Sim.spawnBall(s, 240, 460, 0, -150)
  drain(s)
  run(s, 1.2)
  assert.equal(types(drain(s), 'kicked').length, 1)
  assert.equal(o.alive, false)
  assert.ok(b.vy === -150 || !b.alive)
  assert.equal(s.stats.evacuated, 0)
})

test('8. fish and car: hitbox is the drawn size, same rule for everything', () => {
  for (const item of ['poisson', 'voiture']) {
    const s = quiet()
    const o = Sim.placeNow(s, item, 240, 300)
    const sz = Sim.sizeOf(item)
    assert.equal(o.box.w, sz.w)
    assert.equal(o.box.h, sz.h)
    // A ball skimming just inside the drawn edge bounces; just outside it passes.
    const inside = Sim.spawnBall(s, o.box.x - R + 1, 470, 0, -200)
    const outside = Sim.spawnBall(s, o.box.x - R - 1, 470, 0, -200)
    run(s, 1)
    assert.ok(inside.vy > 0, item)
    assert.ok(outside.vy < 0 || !outside.alive, item)
  }
})

test('9. a ball touching a demonstrator removes exactly one and disappears', () => {
  const s = quiet()
  const p = s.people.find((q) => q.row === 2 && q.index === 19)
  const b = Sim.spawnBall(s, p.x, 300, 0, -200)
  drain(s)
  run(s, 2)
  assert.equal(types(drain(s), 'lost').length, 1)
  assert.equal(Sim.survivors(s), 23)
  assert.equal(b.alive, false)
})

test('10. a ball between demonstrators leaves through the top without a loss', () => {
  const s = quiet()
  const p = s.people.find((q) => q.index === 3)
  const b = Sim.spawnBall(s, p.x + C.CROWD_SPACING / 2, 300, 0, -200)
  run(s, 3)
  assert.equal(Sim.survivors(s), 24)
  assert.equal(b.alive, false)
  assert.equal(s.stats.passedTop, 1)
})

test('11. the crowd closes gaps progressively, centred, in order', () => {
  const s = quiet()
  const row = s.people.filter((p) => p.row === 2)
  Sim.spawnBall(s, row[0].x, 300, 0, -300)
  run(s, 1.5)
  assert.equal(row[0].alive, false)
  const before = row[1].x
  Sim.step(s)
  const moved = Math.abs(row[1].x - before)
  assert.ok(moved > 0 && moved <= C.CROWD_SPEED * C.DT + 1e-9)
  run(s, 12)
  const xs = row.filter((p) => p.alive).map((p) => p.x)
  for (let k = 1; k < xs.length; k++) assert.ok(Math.abs(xs[k] - xs[k - 1] - C.CROWD_SPACING) < 1e-6)
  assert.ok(Math.abs((xs[0] + xs[xs.length - 1]) / 2 - C.CROWD_CENTER_X) < 1e-6)
})

test('a very fast ball cannot skip over a demonstrator', () => {
  const s = quiet()
  const p = s.people.find((q) => q.row === 2 && q.index === 20)
  Sim.spawnBall(s, p.x, 400, 0, -9000)
  run(s, 0.2)
  assert.equal(p.alive, false)
})

test('12. the truce stops new shots only; deliveries and reload continue', () => {
  const s = Sim.create('truce')
  run(s, 58)
  const shots = s.stats.shots
  assert.equal(s.activeEvent, 'treve')
  assert.ok(Sim.POOLS.treve.includes(s.stock.next))
  assert.ok(Sim.command(s, 100, 330).ok)
  run(s, 0.5)
  assert.ok(s.stats.delivered >= 1)
  run(s, 3.4)
  assert.equal(s.stats.shots, shots)
})

test('13. no stored shots after the truce; spacing never below the phase gap', () => {
  const s = Sim.create('catchup')
  run(s, 62)
  const at62 = s.stats.shots
  run(s, 1.0)
  assert.ok(s.stats.shots - at62 <= 1)
  const s3 = Sim.create('spacing')
  const times = []
  for (let k = 0; k < 90 / C.DT && !s3.over; k++) {
    Sim.step(s3)
    for (const e of s3.out.splice(0)) if (e.type === 'fire' || e.type === 'capskip') times.push(s3.t)
  }
  for (let k = 1; k < times.length; k++) assert.ok(times[k] - times[k - 1] > 0.38, `gap ${times[k] - times[k - 1]}`)
  assert.ok(times.every((t) => t < 89 + 1e-6 && !(t >= 58 && t < 62)))
})

test('14. supplier change: future deliveries only, flights keep their origin', () => {
  const s = Sim.create('supplier', { NO_SHOTS: true })
  run(s, 72.9)
  assert.ok(Sim.command(s, C.STREET_R, C.ZONE_T).ok)
  const flight = s.deliveries[0]
  run(s, 0.2)
  assert.equal(s.stock.x, C.STOCK_ALT.x)
  assert.equal(flight.from.x, C.STOCK_MAIN.x)
  run(s, 0.7)
  assert.ok(Sim.command(s, 200, 300).ok)
  assert.equal(s.deliveries[s.deliveries.length - 1].from.x, C.STOCK_ALT.x)
  run(s, 6)
  assert.equal(s.stock.x, C.STOCK_MAIN.x)
})

test('15. end at 90 s or zero survivors is stable', () => {
  const q = Sim.create('end', { NO_SHOTS: true })
  run(q, 100)
  assert.equal(q.endReason, 'time')
  assert.equal(Sim.summary(q).time, 90)
  const s = Sim.create('end')
  run(s, 100)
  assert.equal(s.over, true)
  const snap = JSON.stringify(Sim.summary(s))
  Sim.step(s)
  assert.equal(JSON.stringify(Sim.summary(s)), snap)
  const w = quiet()
  for (const p of w.people) if (p.index !== 23) p.alive = false
  Sim.spawnBall(w, w.people[23].x, 300, 0, -300)
  run(w, 3)
  assert.equal(w.endReason, 'wiped')
})

test('rupture: fridges and sofas, 1 s flights even next door', () => {
  const s = Sim.create('rupture', { NO_SHOTS: true })
  run(s, 24.1)
  assert.equal(s.activeEvent, 'rupture')
  assert.ok(['frigo', 'canape'].includes(s.stock.next))
  assert.ok(Sim.command(s, 90, 330).ok)
  assert.equal(s.deliveries[0].duration, 1)
})

test('too late: posed and broken at once, ball untouched', () => {
  const s = quiet()
  assert.ok(Sim.command(s, 240, 300).ok)
  const d = s.deliveries[0]
  const speed = 100
  const b = Sim.spawnBall(s, d.box.cx, d.box.cy + speed * d.duration, 0, -speed)
  drain(s)
  run(s, d.duration + 0.05)
  assert.equal(types(drain(s), 'toolate').length, 1)
  assert.equal(s.objects.length, 0)
  assert.equal(b.vy, -speed)
})

test('groupes: spacing widens to 44 then returns to 36', () => {
  const s = Sim.create('grp', { NO_SHOTS: true })
  run(s, 47.9)
  const row = s.people.filter((p) => p.row === 0)
  assert.ok(Math.abs(row[1].tx - row[0].tx - C.CROWD_EVENT_SPACING) < 1e-9)
  run(s, 20)
  assert.ok(Math.abs(row[1].x - row[0].x - C.CROWD_SPACING) < 1e-9)
})

test('determinism: same seed, same police pattern, whatever the player does', () => {
  const record = (clicky) => {
    const s = Sim.create('same')
    const shots = []
    for (let k = 0; k < 45 / C.DT; k++) {
      if (clicky && k % 50 === 0) Sim.command(s, 80 + (k % 300), 180 + (k % 280))
      Sim.step(s)
      for (const e of s.out.splice(0)) if (e.type === 'announce') shots.push([e.announce.fireAt.toFixed(3), e.announce.x.toFixed(2), e.announce.angle.toFixed(3)])
    }
    return JSON.stringify(shots)
  }
  assert.equal(record(false), record(true))
})

test('item bag: no immediate repeat, familiar objects before 20 s', () => {
  const s = quiet()
  const seq = []
  for (let k = 0; k < 2400 && !s.over; k++) {
    if (s.t >= s.stock.readyAt) {
      const item = s.stock.next
      if (Sim.command(s, 240, 300).ok) seq.push([s.t, item])
    }
    Sim.step(s)
    s.objects.length = 0
  }
  for (let k = 1; k < seq.length; k++) assert.notEqual(seq[k][1], seq[k - 1][1])
  assert.ok(seq.filter(([t]) => t < 20).every(([, it]) => Sim.POOLS.early.includes(it)))
})
