// The art pass must not change the rules: the same seeded run, driven by the same bot, gives
// the same score in v2/ and in the current version. Needs Playwright's Chromium and a static
// server on the repository root: `python3 -m http.server 8765` then
// `node --test attention-a-la-mousse/test/balance.test.mjs`. Skipped when neither is there.
import test from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.MOUSSE_URL || 'http://localhost:8765/attention-a-la-mousse/'
let chromium = null
try {
  ;({ chromium } = await import('playwright'))
} catch {
  try {
    ;({ chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs'))
  } catch {}
}
let reachable = false
try {
  reachable = (await fetch(BASE)).ok
} catch {}

const BOT = () => {
  const INTR = new Set(['maire', 'poussette', 'chien', 'secouriste'])
  const P = () => { game.input('press', { down: true }); game.input('press', { down: false }) }
  P()
  for (let i = 0; i < 60 * 130; i++) {
    const d = game.debug
    if (d.state === 'RESULTS') break
    const G = d.G
    if (G && d.state === 'PLAYING' && !G.over) {
      const ready = G.t >= G.readyAt && G.t >= G.lockedUntil
      const roll = d.skaters.filter((s) => s.state === 'roll' && !s.crossed && s.x < d.matX(s.y))
      const intr = roll.some((s) => INTR.has(s.kind) && s.x >= d.matX(s.y) - d.C.ZONE)
      if (ready && !intr && roll.some((s) => !INTR.has(s.kind) && s.x >= d.matX(s.y) - d.C.PERFECT + 2)) P()
    }
    game.step(1 / 60)
  }
  const G = game.debug.G
  return { score: G.score, saved: G.saved, victims: G.victims, perfects: G.perfects, scandals: G.scandals, olas: G.olas, evacuated: G.evacuated, falseStarts: G.falseStarts }
}

test('same seed, same bot, same result before and after the art pass', { skip: !chromium || !reachable ? 'needs Playwright and a local server' : false }, async () => {
  const browser = await chromium.launch()
  const run = async (path) => {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => { try { localStorage.clear() } catch {} })
    await page.goto(BASE + path + '?debug=1&seed=6&manual=1&guests=0')
    await page.waitForTimeout(300)
    const r = await page.evaluate(BOT)
    await page.close()
    assert.deepEqual(errors, [], path + ' errors')
    return r
  }
  const before = await run('v2/')
  const after = await run('')
  await browser.close()
  assert.deepEqual(after, before)
  assert.ok(before.saved > 300)
})
