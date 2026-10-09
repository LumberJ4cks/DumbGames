// Balancing harness: plays full games with simple bots on the pure simulation.
// Run: node barricasse/test/bots.js [games]
// A bot is not a player: these numbers compare strategies, they do not validate difficulty.
const Sim = require('../sim.js')

const C = Sim.CONFIG

/** Cells a ball would cross before reaching the crowd, ignoring barricades, with arrival times. */
function path(s, b) {
  const out = []
  let x = b.x
  let y = b.y
  let vx = b.vx
  const vy = b.vy
  if (vy >= 0) return out
  const dt = 1 / 240
  let t = 0
  let last = -1
  const r = C.BALL_RADIUS
  while (y > C.GRID_Y - r && t < 4) {
    x += vx * dt
    y += vy * dt
    t += dt
    if (x < C.STREET_L + r || x > C.STREET_R - r) vx = -vx
    // Cells whose grown box contains the centre.
    for (let col = 0; col < C.COLS; col++)
      for (let row = 0; row < C.ROWS; row++) {
        const i = Sim.cellIndex(s, col, row)
        const cr = Sim.cellRect(s, i)
        if (x > cr.x - r && x < cr.x + cr.w + r && y > cr.y - r && y < cr.y + cr.h + r && i !== last && !out.some((o) => o.i === i)) out.push({ i, t })
      }
  }
  return out
}

const bots = {
  idle: () => {},
  random(s, st) {
    // A frantic clicker: about 4 clicks per second anywhere on the grid.
    if (Math.random() < 4 * C.DT) Sim.command(s, Math.floor(Math.random() * s.cells.length))
  },
  novice(s, st) {
    // Reacts to balls already flying, 0.45 s late, aims at the ball's next cell.
    if (s.t < s.stock.readyAt) return
    for (const b of s.balls) {
      if (!b.alive || b.vy >= 0 || s.t - b.born < 0.45 || st.handled.has(b.id)) continue
      const p = path(s, b)
      if (p.some((o) => s.cells[o.i].state !== 'EMPTY')) {
        st.handled.add(b.id)
        continue
      }
      const target = p.find((o) => o.t > Sim.deliveryTime(s, s.stock, o.i) + 0.05) || p[p.length - 1]
      if (target && Sim.command(s, target.i).ok) st.handled.add(b.id)
      return
    }
  },
  builder(s, st) {
    // Anticipation: keep two full lines (rows 2 and 4), refill holes, then cover live threats.
    if (s.t < s.stock.readyAt) return
    for (const b of s.balls) {
      if (!b.alive || b.vy >= 0) continue
      const p = path(s, b)
      if (p.some((o) => s.cells[o.i].state !== 'EMPTY')) continue
      const target = p.find((o) => o.t > Sim.deliveryTime(s, s.stock, o.i) + 0.03)
      if (target && Sim.command(s, target.i).ok) return
    }
    for (const row of [2, 4, 3, 1, 5, 0])
      for (const col of [3, 2, 4, 1, 5, 0, 6]) {
        const i = Sim.cellIndex(s, col, row)
        if (s.cells[i].state === 'EMPTY' && Sim.command(s, i).ok) return
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
