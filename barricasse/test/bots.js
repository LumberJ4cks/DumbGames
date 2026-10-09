// Balancing harness: plays full games with simple bots on the pure simulation.
// Run: node barricasse/test/bots.js [games]
// A bot is not a player: these numbers compare strategies, they do not validate difficulty.
const Sim = require('../sim.js')

const C = Sim.CONFIG

/** Where a rising ball will be, ignoring barricades (walls bounce), until it leaves the zone. */
function path(b) {
  const out = []
  if (b.vy >= 0) return out
  let x = b.x
  let y = b.y
  let vx = b.vx
  const r = C.BALL_RADIUS
  for (let t = 0; t < 4 && y > C.ZONE_T; t += 1 / 120) {
    x += vx / 120
    y += b.vy / 120
    if (x < C.STREET_L + r || x > C.STREET_R - r) vx = -vx
    if (y < C.ZONE_B) out.push({ t, x, y })
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
  // The ball meets the box's bottom edge before its centre.
  const lead = (Sim.sizeOf(s.stock.next).h / 2 + C.BALL_RADIUS) / Math.abs(b.vy)
  const target = pts.find((p) => p.t - lead > Sim.deliveryTime(s, s.stock, p.x, p.y) + margin)
  return target ? Sim.command(s, target.x, target.y).ok : false
}
/** Largest horizontal gap on the line y = ly, or null when the line is closed. */
function gap(s, ly) {
  const spans = s.objects
    .map((o) => o.box)
    .concat(s.deliveries.map((d) => d.box))
    .filter((q) => q.y <= ly && q.y + q.h >= ly)
    .map((q) => [q.x, q.x + q.w])
    .sort((a, b) => a[0] - b[0])
  let x = C.STREET_L
  let best = null
  for (const [a, b] of spans) {
    if (a - x > 9 && (!best || a - x > best[1] - best[0])) best = [x, a]
    x = Math.max(x, b)
  }
  if (C.STREET_R - x > 9 && (!best || C.STREET_R - x > best[1] - best[0])) best = [x, C.STREET_R]
  return best
}

const bots = {
  idle: () => {},
  random(s) {
    // A frantic clicker: about 4 clicks per second anywhere in the zone.
    if (Math.random() < 4 * C.DT) Sim.command(s, C.STREET_L + Math.random() * (C.STREET_R - C.STREET_L), C.ZONE_T + Math.random() * (C.ZONE_B - C.ZONE_T))
  },
  novice(s, st) {
    // Reacts to balls already flying, 0.45 s late.
    if (s.t < s.stock.readyAt) return
    for (const b of s.balls) {
      if (!b.alive || b.vy >= 0 || s.t - b.born < 0.45 || st.handled.has(b.id)) continue
      st.handled.add(b.id)
      if (aimAt(s, b, 0.05)) return
    }
  },
  builder(s) {
    // Anticipation: close a wall, then a second one, and cover live threats first.
    if (s.t < s.stock.readyAt) return
    for (const b of s.balls) if (b.alive && aimAt(s, b, 0.03)) return
    for (const ly of [330, 430, 230]) {
      const g = gap(s, ly)
      if (g && Sim.command(s, (g[0] + g[1]) / 2, ly).ok) return
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
