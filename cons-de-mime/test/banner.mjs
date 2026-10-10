/*
 * Exporte la bannière de l'accueil : assets/cons-de-mime.webp (1600 × 450), à partir de banner.html.
 *   python3 -m http.server 8787 &   (à la racine du dépôt)
 *   node cons-de-mime/test/banner.mjs     (PLAYWRIGHT_PATH=... si playwright n'est pas dans node_modules)
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 113 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:8787/cons-de-mime/test/banner.html')
await page.waitForFunction(() => window.__ready)
const data = await page.evaluate(() => {
  const src = document.getElementById('c')
  const big = document.createElement('canvas')
  big.width = 1600; big.height = 450
  const g = big.getContext('2d')
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, 400, 112.5, 0, 0, 1600, 450)
  return big.toDataURL('image/webp', 0.92)
})
writeFileSync(new URL('../../assets/cons-de-mime.webp', import.meta.url), Buffer.from(data.split(',')[1], 'base64'))
console.log('assets/cons-de-mime.webp écrit', errors.length ? errors : '')
await browser.close()
