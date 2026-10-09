// Balancing harness: plays full games with simple bots on the pure simulation.
// Run: node barricasse/test/bots.js [games]
// A bot is not a player: these numbers compare strategies, they do not validate difficulty.
const Sim = require('../sim.js')

const C = Sim.CONFIG

/** Where a leftward ball will be, ignoring barricades (curbs bounce), until it leaves the zone. */
function path(b) {
  const out = []
  if (b.vx >= 0) return out
  let x = b.x
  let y = b.y
  let vy = b.vy
  const r = C.BALL_RADIUS
  for (let t = 0; t < 4 && x > C.ZONE_L; t += 1 / 120) {
    x += b.vx / 120
    y += vy / 120
    if (y < C.STREET_T + r || y > C.STREET_B - r) vy = -vy
    if (x < C.ZONE_R) out.push({ t, x, y })
  }
  return out
}
function covered(s, pts) {
  const boxes = s.objects.map((o) => o.box).concat(s.deliveries.map((d) => d.box))
  return pts.some((p) => boxes.some((q) => p.x > q.x - 5 && p.x < q.x + q.w + 5 && p.y > q.y - 5 && p.y < q.y + q.h + 5))
}
function aimAt(s, b, margin) {
  const pts = path(b)
  if (!pts.length || covered(s, pts)) return false
  // The ball meets the box's right edge before its centre.
  const lead = (Sim.sizeOf(s.stock.next).w / 2 + C.BALL_RADIUS) / Math.abs(b.vx)
  const target = pts.find((p) => p.t - lead > Sim.deliveryTime(s, s.stock, p.x, p.y) + margin)
  return target ? Sim.command(s, target.x, target.y).ok : false
}
/** Largest vertical gap on the line x = lx, or null when the line is closed. */
function gap(s, lx) {
  const spans = s.objects
    .map((o) => o.box)
    .concat(s.deliveries.map((d) => d.box))
    .filter((q) => q.x <= lx && q.x + q.w >= lx)
    .map((q) => [q.y, q.y + q.h])
    .sort((a, b) => a[0] - b[0])
  let y = C.STREET_T
  let best = null
  for (const [a, b] of spans) {
    if (a - y > 9 && (!best || a - y > best[1] - best[0])) best = [y, a]
    y = Math.max(y, b)
  }
  if (C.STREET_B - y > 9 && (!best || C.STREET_B - y > best[1] - best[0])) best = [y, C.STREET_B]
  return best
}

const bots = {
  idle: () => {},
  random(s) {
    // A frantic clicker: about 4 clicks per second anywhere in the zone.
    if (Math.random() < 4 * C.DT) Sim.command(s, C.ZONE_L + Math.random() * (C.ZONE_R - C.ZONE_L), C.STREET_T + Math.random() * (C.STREET_B - C.STREET_T))
  },
  novice(s, st) {
    // Reacts to balls already flying, 0.45 s late.
    if (s.t < s.stock.readyAt) return
    for (const b of s.balls) {
      if (!b.alive || b.vx >= 0 || s.t - b.born < 0.45 || st.handled.has(b.id)) continue
      st.handled.add(b.id)
      if (aimAt(s, b, 0.05)) return
    }
  },
  builder(s) {
    // Anticipation: close a wall, then a second one, and cover live threats first.
    if (s.t < s.stock.readyAt) return
    for (const b of s.balls) if (b.alive && aimAt(s, b, 0.03)) return
    for (const lx of [300, 420, 200]) {
      const g = gap(s, lx)
      if (g && Sim.command(s, lx, (g[0] + g[1]) / 2).ok) return
    }
  },
}

function play(name, seed) {
  const s = Sim.create(seed)
  const st = { handled: new Set() }
  while (!s.over) {
    bots[name](s, st)
    Sim.step(s)
    s.out.length = 0
  }
  return Sim.summary(s)
}

const games = Number(process.argv[2] || 20)
for (const name of Object.keys(bots)) {
  const res = []
  for (let g = 0; g < games; g++) res.push(play(name, 'bot' + g))
  const avg = (k) => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(1)
  const surv = res.map((r) => r.survivors).sort((a, b) => a - b)
  console.log(`${name.padEnd(8)} survivants moy ${avg('survivors')} (min ${surv[0]}, médiane ${surv[surv.length >> 1]}, max ${surv[surv.length - 1]}) · temps ${avg('time')} s · renvoyées ${avg('evacuated')} · livrés ${avg('delivered')} · trop tard ${avg('tooLate')}`)
}
