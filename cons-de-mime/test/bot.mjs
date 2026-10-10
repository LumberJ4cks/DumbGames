/*
 * Bot de test : joue une partie complète dans un Chromium headless (Playwright) avec des
 * touches aléatoires, pète dès que c'est prêt, regarde la fille en jaune, et affiche le
 * résultat + les erreurs console. Sert à vérifier qu'une partie va jusqu'au bout.
 *
 *   python3 -m http.server 8787 &      (à la racine du dépôt)
 *   node cons-de-mime/test/bot.mjs [seed]     (PLAYWRIGHT_PATH=... si playwright n'est pas dans node_modules)
 */
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright')
const seed = process.argv[2] || '42'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()) })
await page.goto(`http://localhost:8787/cons-de-mime/?seed=${seed}&debug=1`)
await page.waitForTimeout(1500)
await page.keyboard.press('Space')
const t0 = Date.now()
const keys = ['ArrowUp', 'ArrowDown']
let holding = null
while (Date.now() - t0 < 100000) {
  const st = await page.evaluate(() => { const s = window.__g.state; return { mode: s.mode, fart: s.fart, look: s.lookWindow } })
  if (st.mode === 'over') break
  if (holding) { await page.keyboard.up(holding); holding = null }
  if (Math.random() < 0.6) { holding = keys[Math.random() < 0.5 ? 0 : 1]; await page.keyboard.down(holding) }
  if (st.fart >= 1 && Math.random() < 0.5) await page.keyboard.press('Space')
  if (st.look) await page.keyboard.press('KeyR')
  await page.waitForTimeout(250)
}
await page.waitForTimeout(3000)
const final = await page.evaluate(() => { const s = window.__g.state; return { mode: s.mode, score: s.score, bestCombo: s.bestCombo, looked: s.looked, mamie: s.mamie && s.mamie.state, jump: s.jump && s.jump.meters } })
console.log(JSON.stringify(final))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(final.mode === 'over' && errors.length === 0 ? 0 : 1)
