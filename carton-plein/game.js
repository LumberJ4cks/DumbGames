/*
 * FC MMA (ex Carton plein) — prototype jouable. France – Paraguay, Coupe du monde 2026. Tu es le dernier
 * Paraguayen sur le terrain ; les Français jouent au foot, toi tu fais des fautes.
 *
 * Flèches / ZQSD / WASD : se déplacer. Espace, Entrée ou clic droit : frapper (poing de près,
 * tacle glissé de loin). Tactile : joystick à gauche, bouton à droite. P : pause. M : son.
 * ?seed=42 rejoue la même partie, ?run=30 raccourcit le match, ?debug=1 affiche les hitboxes.
 *
 * Sprites : carton-plein/sprites/*.png (PixelLab, quantifiés Endesga 32 par art/ingest.mjs).
 */
'use strict'

/* ---------- réglages ---------- */
const W = 640
const H = 360
const FIELD = { x: 72, y: 64, w: 940, h: 500 } // monde, en pixels : resserré pour que ça se bouscule
const GOAL_H = 120
const MATCH_SECONDS = 90 // ne sert plus qu'au bot : la partie s'arrête au 3e but
const LIVES = 3
const BUS = { w: 54, h: 144, speed: 460, park: 10 }
const DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']
const PAL = { ink: '#181425', white: '#ffffff', grey1: '#c0cbdc', grey2: '#8b9bb4', slate: '#3a4466', slateD: '#262b44', green: '#63c74d', greenL: '#7fd36a', greenM: '#3e8948', greenD: '#265c42', yellow: '#fee761', amber: '#feae34', orange: '#f77622', red: '#e43b44', redD: '#a22633', pink: '#f6757a', cyan: '#2ce8f5', blue: '#0099db', sand: '#e4a672', clay: '#b86f50' }

const params = new URLSearchParams(location.search)
const DEBUG = params.get('debug') === '1'
const RUN = Number(params.get('run') || MATCH_SECONDS)
let seed = Number(params.get('seed') || (Math.random() * 1e9) | 0)
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const rr = (a, b) => a + rnd() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const dirOf = (dx, dy) => { if (!dx && !dy) return null; const a = Math.atan2(dy, dx); return DIRS[Math.round(a / (Math.PI / 4)) & 7] }

/* ---------- barème ---------- */
const FOULS = {
  POING: { pts: 100, big: false }, GENOU: { pts: 150, big: false }, 'COUP DE PIED': { pts: 300, big: true }, PROJECTION: { pts: 300, big: true },
  TACLE: { pts: 200, big: false }, 'PAR DERRIERE': { pts: 400, big: true }, SEMELLE: { pts: 500, big: true }, ACHARNEMENT: { pts: 50, big: true },
  PERCUTE: { pts: 200, big: false }, 'FAUTE SUR LE GARDIEN': { pts: 600, big: true }, "FAUTE SUR L'ARBITRE": { pts: 2000, big: true },
  'BALLON DEGAGE': { pts: 150, big: false, noWhistle: true }, CASSE: { pts: 250, big: false, noWhistle: true }, 'FAUTE SUR LE BANC': { pts: 800, big: true },
  'LA CAGE EST PAR TERRE': { pts: 3000, big: true }, 'FAUTE SUR LE STAFF': { pts: 1500, big: true },
  'PIED SAUTE': { pts: 450, big: true }, 'COUP DE BOULE': { pts: 500, big: true }, DOMINO: { pts: 150, big: false, noWhistle: true }, 'VOL DE BALLON': { pts: 100, big: false, noWhistle: true },
  'FAUTE SUR UN JOURNALISTE': { pts: 1200, big: true }, 'FAUTE SUR UN SUPPORTER': { pts: 900, big: true },
  'ECRASE PAR LE BUS': { pts: 800, big: true, noWhistle: true }, 'FAUTE SUR LA BANANE': { pts: 1000, big: true }, 'FAUTE SUR LE VENDEUR DE HOT-DOGS': { pts: 1100, big: true }, 'FAUTE SUR LE MARIE': { pts: 1400, big: true }, 'FAUTE SUR LA MARIEE': { pts: 1600, big: true }, 'FAUTE SUR LE COMMENTATEUR': { pts: 1300, big: true }, 'FAUTE SUR UN PIGEON': { pts: 2000, big: false, noWhistle: true }, 'FAUTE SUR LE GENDARME A CHEVAL': { pts: 3000, big: true }, 'FAUTE SUR LE KINE': { pts: 1500, big: true }, 'FAUTE SUR LE RAMASSEUR DE BALLES': { pts: 1700, big: true }, 'FAUTE SUR LE PRESIDENT': { pts: 5000, big: true }, 'FAUTE SUR LA FANFARE': { pts: 900, big: true }, 'FAUTE SUR LE DINOSAURE': { pts: 1200, big: true }, SOUFFLE: { pts: 300, big: false, noWhistle: true }, 'FAUTE SUR LA POULE': { pts: 1500, big: true }, 'FAUTE SUR LA MASCOTTE': { pts: 1200, big: true }, 'FAUTE SUR UN CRS': { pts: 1800, big: true }, 'FAUTE SUR LE STREAKER': { pts: 1300, big: true }, 'FAUTE SUR UNE MAMIE': { pts: 2500, big: true },
}
const TIERS = ['', 'CHAUD', 'BAGARRE', 'EMEUTE', 'CARTON PLEIN']
const COMBO_STEPS = [0, 2, 4, 7, 10] // seuils pour ×1..×5

/* ---------- sprites ---------- */
const ATLAS = {}
async function loadAtlas(name) {
  const [meta, img] = await Promise.all([
    fetch(`sprites/${name}.json`).then((r) => r.json()),
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `sprites/${name}.png` }),
  ])
  ATLAS[name] = { ...meta, img }
}
function drawSprite(g, name, anim, dir, frame, x, y, flip = false) {
  const a = ATLAS[name]
  if (!a) return
  const an = a.anims[anim] || a.anims.idle || a.anims.stance || Object.values(a.anims)[0]
  const list = an[dir] || an.s || Object.values(an)[0]
  const idx = list[((frame % list.length) + list.length) % list.length]
  const sx = (idx % a.cols) * a.cell
  const sy = Math.floor(idx / a.cols) * a.cell
  g.save()
  g.translate(Math.round(x), Math.round(y))
  if (flip) g.scale(-1, 1)
  g.drawImage(a.img, sx, sy, a.cell, a.cell, -a.ax, -a.ay, a.cell, a.cell)
  g.restore()
}

/* ---------- son (synthétisé) ---------- */
const audio = { ctx: null, muted: localStorage.getItem('carton.muted') === '1' }
const beepLast = {}
/* ---------- musique : démarre à la première mise en jeu, en boucle, coupée par M ---------- */
const music = { buf: null, src: null, gain: null, loading: false, wanted: false }
function ctx() { if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); return audio.ctx }
function startMusic() {
  music.wanted = true
  try {
    const c = ctx()
    if (music.src) return
    if (!music.buf) {
      if (music.loading) return
      music.loading = true
      fetch('audio/mma_foot.mp3').then((r) => r.arrayBuffer()).then((ab) => c.decodeAudioData(ab)).then((buf) => { music.buf = buf; music.loading = false; if (music.wanted) startMusic() }).catch(() => { music.loading = false })
      return
    }
    music.gain = c.createGain(); music.gain.gain.value = audio.muted ? 0 : 0.55; music.gain.connect(c.destination)
    music.src = c.createBufferSource(); music.src.buffer = music.buf; music.src.loop = true; music.src.connect(music.gain); music.src.start()
  } catch (e) { /* pas de musique */ }
}
let noiseBuf = null
function noise(c) {
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
  const n = c.createBufferSource(); n.buffer = noiseBuf; return n
}
/** Impact : un souffle filtré (le vêtement, l'air) + un coup sourd (le corps). */
function thud(c, t, { low = 140, drop = 45, body = 0.12, bodyGain = 0.5, air = 0.06, airGain = 0.35, airFreq = 900, q = 0.8 }) {
  const o = c.createOscillator(), g1 = c.createGain()
  o.type = 'sine'; o.frequency.setValueAtTime(low, t); o.frequency.exponentialRampToValueAtTime(drop, t + body)
  g1.gain.setValueAtTime(bodyGain, t); g1.gain.exponentialRampToValueAtTime(0.001, t + body)
  o.connect(g1); g1.connect(c.destination); o.start(t); o.stop(t + body + 0.02)
  const n = noise(c), f = c.createBiquadFilter(), g2 = c.createGain()
  f.type = 'bandpass'; f.frequency.setValueAtTime(airFreq, t); f.frequency.exponentialRampToValueAtTime(airFreq * 0.4, t + air); f.Q.value = q
  g2.gain.setValueAtTime(airGain, t); g2.gain.exponentialRampToValueAtTime(0.001, t + air)
  n.connect(f); f.connect(g2); g2.connect(c.destination); n.start(t); n.stop(t + air + 0.02)
}
function beep(kind) {
  if (audio.muted) return
  const now = performance.now()
  if (beepLast[kind] && now - beepLast[kind] < 70) return // une rafale de coups = un seul son
  beepLast[kind] = now
  try {
    const c = ctx()
    const t = c.currentTime
    if (kind === 'hit') return thud(c, t, { low: 160, drop: 50, body: 0.1, bodyGain: 0.45, air: 0.05, airGain: 0.3, airFreq: 1100 })
    if (kind === 'hitBig') return thud(c, t, { low: 110, drop: 35, body: 0.2, bodyGain: 0.7, air: 0.09, airGain: 0.45, airFreq: 700, q: 0.6 })
    if (kind === 'pass') return thud(c, t, { low: 320, drop: 160, body: 0.05, bodyGain: 0.25, air: 0.03, airGain: 0.18, airFreq: 2400, q: 1.5 }) // petit « poc » de cuir
    if (kind === 'shoot') return thud(c, t, { low: 190, drop: 70, body: 0.13, bodyGain: 0.55, air: 0.07, airGain: 0.4, airFreq: 1500, q: 1 }) // frappe pleine
    if (kind === 'bounce') return thud(c, t, { low: 260, drop: 140, body: 0.05, bodyGain: 0.15, air: 0.02, airGain: 0.08, airFreq: 1800 })
    if (kind === 'land') return thud(c, t, { low: 90, drop: 40, body: 0.14, bodyGain: 0.35, air: 0.1, airGain: 0.2, airFreq: 400, q: 0.5 })
    const o = c.createOscillator()
    const gn = c.createGain()
    o.connect(gn)
    gn.connect(c.destination)
    if (kind === 'whistle') {
      // Sifflet à bille : deux partiels qui trillent.
      const o2 = c.createOscillator(), g2 = c.createGain(); o2.connect(g2); g2.connect(c.destination)
      o.type = 'square'; o2.type = 'square'
      for (let i = 0; i < 14; i++) { const tt = t + i * 0.025; o.frequency.setValueAtTime(i % 2 ? 2350 : 2200, tt); o2.frequency.setValueAtTime(i % 2 ? 3540 : 3300, tt) }
      gn.gain.setValueAtTime(0.07, t); gn.gain.setValueAtTime(0.07, t + 0.28); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      g2.gain.setValueAtTime(0.025, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      o.start(t); o.stop(t + 0.4); o2.start(t); o2.stop(t + 0.4)
    }
    else if (kind === 'card') { o.type = 'triangle'; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.1); gn.gain.setValueAtTime(0.15, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.start(t); o.stop(t + 0.4) }
    else if (kind === 'fire') { o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(640, t + 0.5); gn.gain.setValueAtTime(0.2, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.start(t); o.stop(t + 0.7); thud(c, t, { low: 60, drop: 30, body: 0.5, bodyGain: 0.4, air: 0.5, airGain: 0.25, airFreq: 600, q: 0.3 }) }
    else if (kind === 'drum') { o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); gn.gain.setValueAtTime(0.4, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.start(t); o.stop(t + 0.3) }
    else if (kind === 'cymbal') { gn.gain.value = 0; const n = noise(c), f = c.createBiquadFilter(), g2 = c.createGain(); f.type = 'highpass'; f.frequency.value = 5000; g2.gain.setValueAtTime(0.2, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.6); n.connect(f); f.connect(g2); g2.connect(c.destination); n.start(t); n.stop(t + 0.6) }
    else if (kind === 'trumpet') { o.type = 'sawtooth'; o.frequency.setValueAtTime(440, t); o.frequency.setValueAtTime(554, t + 0.12); o.frequency.setValueAtTime(659, t + 0.24); gn.gain.setValueAtTime(0.12, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.start(t); o.stop(t + 0.5) }
    else if (kind === 'goal') { o.type = 'square'; o.frequency.setValueAtTime(330, t); o.frequency.setValueAtTime(440, t + 0.12); o.frequency.setValueAtTime(550, t + 0.24); gn.gain.setValueAtTime(0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.start(t); o.stop(t + 0.6) }
  } catch (e) { /* pas de son */ }
}

/* ---------- état ---------- */
const S = {
  phase: 'title', // title | play | kickoff | freekick | goal | end
  t: 0, clock: 0, added: 0, addedShown: false,
  score: 0, fouls: 0, bigFouls: 0, goals: 0, yellows: 0, reds: 0, refHits: 0, maxCombo: 1, fires: 0, evac: 0, koCount: 0, teamDoneAt: 0,
  combo: 0, comboT: 0, comboAt: 0, tier: 1, fuego: 0, fire: 0, fury: 0, furyCharge: 0, furies: 0, hitStopCd: 0, shakeCd: 0, lastPts: 0, lastPtsT: 9, chains: 0, busUsed: false, bus: null, busHits: 0, refDown: 0, wave: 0, waveT: 14, intruders: 0, stopAll: 0,
  popups: [], banners: [], particles: [], debris: [], log: [],
  cam: { x: 0, y: 0 }, shake: 0, freeze: 0,
  phaseT: 0,
}
const hero = { x: 0, y: 0, vx: 0, vy: 0, dir: 's', anim: 'stance', frame: 0, ft: 0, act: null, actT: 0, chain: 0, chainT: 0, stun: 0, speed: 235, z: 0, vz: 0, atlas: 'paraguay', team: 'par', isHero: true, r: 10 }
const ball = { x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, owner: null, r: 4 }
const ref = { x: 0, y: 0, vx: 0, vy: 0, dir: 's', anim: 'idle', frame: 0, ft: 0, patience: 100, calm: 0, down: 0, flee: 0, hits: 0, atlas: 'arbitre', team: 'ref', r: 10, stun: 0, hp: 3, card: 0, cardTarget: null, cardT: 0 }
let french = []
let subsUsed = 0
let nextLook = 0
const FORMATION = [[-0.42, 0], [-0.2, -0.3], [-0.2, -0.1], [-0.2, 0.1], [-0.2, 0.3], [0.02, -0.32], [0.02, -0.11], [0.02, 0.11], [0.02, 0.32], [0.2, -0.14], [0.2, 0.14]]

function makeFrench(i, look) {
  const gk = i === 0
  return { x: 0, y: 0, vx: 0, vy: 0, dir: 'e', anim: 'idle', frame: 0, ft: 0, team: 'fra', gk, slot: i, atlas: gk ? 'gardien' : 'france-0', number: gk ? 1 : 2 + i, hp: 3, stun: 0, down: 0, state: 'play', card: 0, r: 10, speed: 135 + rnd() * 50, z: 0, vz: 0, jx: rr(-36, 36), jy: rr(-28, 28), phase: rnd() * Math.PI * 2, spin: rr(0.5, 1.1) * (rnd() < 0.5 ? -1 : 1), cardBob: rnd() * 6, sub: false, fly: null }
}
function resetTeam() {
  french = []
  for (let i = 0; i < 11; i++) french.push(makeFrench(i, nextLook++))
}
function slotPos(f, ballX) {
  const [fx, fy] = FORMATION[f.slot % FORMATION.length]
  const cx = FIELD.x + FIELD.w * 0.5 + clamp(ballX - (FIELD.x + FIELD.w * 0.5), -FIELD.w * 0.3, FIELD.w * 0.38) * 0.9 + (ball.owner && ball.owner.team === 'fra' ? 70 : 0)
  return { x: f.gk ? FIELD.x + 30 : cx + fx * FIELD.w, y: FIELD.y + FIELD.h * 0.5 + fy * FIELD.h }
}
function kickoff() {
  S.phase = 'kickoff'
  S.kickedOff = true
  S.phaseT = S.goals ? 0.5 : 0.9
  ball.x = FIELD.x + FIELD.w / 2
  ball.y = FIELD.y + FIELD.h / 2
  ball.vx = ball.vy = 0
  ball.z = ball.vz = 0; ball.air = 0; ball.out = false
  ball.owner = null
  for (const f of french) {
    const p = slotPos(f, ball.x - 200)
    f.x = p.x; f.y = p.y; f.state = 'play'; f.stun = 0; f.down = 0; f.anim = 'idle'
    if (f.hp <= 0) f.hp = 3
  }
  french[9].x = ball.x - 14; french[9].y = ball.y
  french[10].x = ball.x - 40; french[10].y = ball.y + 30
  hero.x = ball.x + 90; hero.y = ball.y + 10
  ref.x = ball.x; ref.y = ball.y - 110
}

/* ---------- entrées ---------- */
const keys = {}
const touch = { joy: null, jx: 0, jy: 0, btn: false, btnId: null }
let attackPressed = false
let restartPressed = false
const RESTART_BTN = { x: W / 2 - 80, y: H - 54, w: 160, h: 24 }
const inRestart = (x, y) => x >= RESTART_BTN.x && x <= RESTART_BTN.x + RESTART_BTN.w && y >= RESTART_BTN.y && y <= RESTART_BTN.y + RESTART_BTN.h
const canvasXY = (e) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H } }
let lastDownTap = -9, lastRightClick = -9
function tryBus() { if (S.chains >= 3 && !S.busUsed && !S.bus && (S.phase === 'play' || S.phase === 'freekick' || S.phase === 'goal')) { callBus(); return true } return false }
addEventListener('keydown', (e) => {
  if (e.repeat) return
  if (music.wanted && !music.src) startMusic()
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { const now = performance.now(); if (now - lastDownTap < 300) { if (tryBus()) lastDownTap = -9 } else lastDownTap = now }
  keys[e.code] = true
  if (e.code === 'Space' || e.code === 'Enter') { attackPressed = true; restartPressed = true; e.preventDefault() }
  if (e.code === 'KeyP') S.paused = !S.paused
  if (e.code === 'KeyM') { audio.muted = !audio.muted; localStorage.setItem('carton.muted', audio.muted ? '1' : '0'); if (music.gain) music.gain.gain.value = audio.muted ? 0 : 0.55 }
})
addEventListener('keyup', (e) => { keys[e.code] = false })
addEventListener('contextmenu', (e) => e.preventDefault())
const canvas = document.getElementById('c')
addEventListener('mousedown', (e) => {
  if (music.wanted && !music.src) startMusic()
  if (S.phase === 'end') { const { x, y } = canvasXY(e); if (inRestart(x, y)) restartPressed = true; return }
  if (e.button === 2) { const now = performance.now(); if (now - lastRightClick < 300 && tryBus()) { lastRightClick = -9; return } lastRightClick = now }
  if (e.button === 2 || S.phase === 'title') attackPressed = true
})
canvas.addEventListener('pointerdown', (e) => {
  if (music.wanted && !music.src) startMusic()
  if (e.pointerType === 'mouse') return
  const { x, y } = canvasXY(e)
  if (S.phase === 'end') { if (inRestart(x, y)) restartPressed = true; return }
  if (x < W / 2) touch.joy = { id: e.pointerId, x, y }
  else { const now = performance.now(); if (now - lastRightClick < 300 && tryBus()) { lastRightClick = -9; return } lastRightClick = now; touch.btn = true; touch.btnId = e.pointerId; attackPressed = true }
  if (S.phase === 'title') attackPressed = true
})
canvas.addEventListener('pointermove', (e) => {
  if (!touch.joy || e.pointerId !== touch.joy.id) return
  const r = canvas.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * W
  const y = ((e.clientY - r.top) / r.height) * H
  const dx = x - touch.joy.x, dy = y - touch.joy.y
  const d = Math.hypot(dx, dy)
  const k = d > 24 ? 24 / d : 1
  touch.jx = (dx * k) / 24; touch.jy = (dy * k) / 24
})
const endTouch = (e) => { if (touch.joy && e.pointerId === touch.joy.id) { touch.joy = null; touch.jx = touch.jy = 0 } if (e.pointerId === touch.btnId) { touch.btn = false; touch.btnId = null } }
canvas.addEventListener('pointerup', endTouch)
canvas.addEventListener('pointercancel', endTouch)
function inputVector() {
  let dx = 0, dy = 0
  if (keys.ArrowLeft || keys.KeyA || keys.KeyQ) dx -= 1
  if (keys.ArrowRight || keys.KeyD) dx += 1
  if (keys.ArrowUp || keys.KeyW || keys.KeyZ) dy -= 1
  if (keys.ArrowDown || keys.KeyS) dy += 1
  if (touch.joy) { dx = touch.jx; dy = touch.jy }
  const d = Math.hypot(dx, dy)
  if (d > 1) { dx /= d; dy /= d }
  return { dx, dy }
}

/* ---------- fautes, combo, feu ---------- */
function popup(x, y, text, color = PAL.white, big = false) { S.popups.push({ x, y, text, color, t: 0, big }) }
function banner(text, color = PAL.yellow) { S.banners.push({ text, color, t: 0 }) }
function comboMult() { let m = 1; for (let i = 1; i < COMBO_STEPS.length; i++) if (S.combo >= COMBO_STEPS[i]) m = i + 1; return m }
function foul(name, victim, extra = {}) {
  const def = FOULS[name]
  let pts = def.pts
  const mods = []
  if (victim && ball.owner === victim) { pts *= 1.5; mods.push('PORTEUR') }
  if (victim && victim.card === 1) { pts *= 1.5; mods.push('CIBLE') }
  if (victim && french.some((g) => g.atlas === 'commentateur' && g.state === 'play' && dist(g, victim) < 130)) { pts *= 1.25; mods.push('EN DIRECT'); S.shake = Math.max(S.shake, 5) }
  if (S.fire > 0) { pts *= 2; mods.push('FEU') }
  if (S.goals === LIVES - 1) { pts *= 1.5; mods.push('DERNIER BALLON') }
  if (S.refDown > 0 && name !== "FAUTE SUR L'ARBITRE") { pts *= 0.5; mods.push('PAS VU') }
  if (extra.penalty) { pts += 250; mods.push('PENALTY') }
  S.combo++
  S.comboT = 3.2 - comboMult() * 0.35 // ×5 : 1,45 s pour trouver la prochaine victime
  const m = comboMult()
  S.comboAt = 0
  if (m > S.tier) { S.tier = m; S.shake = Math.max(S.shake, 8) }
  S.maxCombo = Math.max(S.maxCombo, m)
  pts = Math.round(pts * m)
  S.score += pts
  S.fouls++
  if (def.big) S.bigFouls++
  if (m >= 3) S.fuego = Math.min(100, S.fuego + (def.big ? 14 : 8))
  if (S.fuego >= 100 && S.fire <= 0) startFire()
  // En feu, chaque faute charge la FURIE ; à 100, transformation.
  if (S.fire > 0 && S.fury <= 0) { S.furyCharge = Math.min(100, S.furyCharge + (def.big ? 12 : 7)); S.fire = Math.max(S.fire, 2.5); if (S.furyCharge >= 100) startFury() }
  const vx = victim ? victim.x : hero.x, vy = victim ? victim.y : hero.y
  const fanfare = victim && victim.atlas === 'musicien'
  const bam = fanfare ? ['POUM', 'TSOIN', 'TUUUT'][(victim.marchRank || 0) % 3] : def.big ? 'BOOM' : rnd() < 0.5 ? 'BAM' : 'BIM'
  if (fanfare) beep(['drum', 'cymbal', 'trumpet'][(victim.marchRank || 0) % 3])
  popup(vx + rr(-6, 6), vy - 56, bam, def.big ? PAL.orange : m >= 3 ? PAL.yellow : PAL.white, def.big || m >= 4)
  S.log.push({ t: S.clock, name, pts })
  // Arbitre : patience et cartons.
  if (S.refDown <= 0 && name !== "FAUTE SUR L'ARBITRE" && !def.noWhistle) {
    ref.patience = Math.max(0, ref.patience - (def.big ? 18 : 8) * (ref.strict || 1))
    ref.calm = 5
    if (ref.patience <= 0 && def.big && victim && victim.team === 'fra' && !ref.cardTarget && S.phase !== 'goal') startCard(victim)
  }
  if (S.hitStopCd <= 0 && S.fury <= 0) { S.freeze = Math.max(S.freeze, def.big ? 0.07 : 0.035); S.hitStopCd = 0.3 }
  if (S.shakeCd <= 0) { S.shake = Math.max(S.shake, def.big ? 6 : 3); S.shakeCd = 0.12 }
  S.lastPts = pts; S.lastPtsT = 0
  if (def.noWhistle) return
  if (def.big && S.t - (S.lastWhistle || -9) > 1.5) { S.lastWhistle = S.t; beep('whistle') }
  if (victim && victim.team === 'fra') freeKick(vx, vy, victim)
}
/** Phase à reprendre après une interruption : le jeu, ou le retour du ballon au centre s'il n'a pas été remis en jeu. */
function resumePhase() { return S.kickedOff ? 'play' : 'goal' }
function startCard(victim) {
  ref.cardTarget = victim
  ref.cardT = 0
  ref.flee = 0
  ref.patience = 0
  banner("L'ARBITRE ARRIVE", PAL.grey1)
  beep('whistle')
}
function giveCard(victim) {
  if (victim.card === 0) {
    victim.card = 1
    S.yellows++
    S.score += 1000
    banner('CARTON JAUNE POUR LA FRANCE', PAL.yellow)
  } else {
    victim.card = 2
    S.reds++
    S.score += 3000 + (victim.gk ? 2000 : 0)
    banner('CARTON ROUGE POUR LA FRANCE', PAL.red)
    victim.state = 'leaving'
    victim.leaveT = 0
  }
  ref.patience = 60
  ref.cardTarget = null
  ref.cardShow = 0.9
  beep('card')
}
function startFire() {
  S.fire = 6
  S.fires++
  S.fuego = 0
  banner('¡ EN FEU !', PAL.orange)
  beep('fire')
}
function startFury() {
  S.fury = 12
  S.furies++
  S.furyCharge = 0
  S.fire = 12
  S.stopAll = 0.9
  S.freeze = 0.12
  S.shake = 16
  hero.act = null; hero.stun = 0
  banner('¡¡ FURIE !!  TOUT CE QUE TU TOUCHES S\'ENVOLE', PAL.yellow)
  for (let i = 0; i < 40; i++) S.particles.push({ x: hero.x + rr(-30, 30), y: hero.y - rr(0, 50), vx: rr(-200, 200), vy: rr(-300, -60), t: 0, life: 0.8, c: i % 3 ? PAL.yellow : PAL.white })
  // La foule arrive : c'est maintenant qu'il faut du monde.
  S.waveT = Math.min(S.waveT, 0.5)
  beep('fire'); beep('card')
}
function freeKick(x, y, victim) {
  if (S.phase !== 'play' || ref.cardTarget) return
  S.phase = 'freekick'
  S.phaseT = 0.7
  ball.vx = ball.vy = 0; ball.out = false; ball.z = ball.vz = 0
  ball.owner = null
  ball.x = clamp(x + rr(-6, 6), FIELD.x + 20, FIELD.x + FIELD.w - 20)
  ball.y = clamp(y + rr(-6, 6), FIELD.y + 20, FIELD.y + FIELD.h - 20)
}

/* ---------- décor cassable, banc, staff ---------- */
let props = []
let npcs = []
const SPONSORS = ['BIERE', 'BANQUE', 'CRYPTO', 'KEBAB', 'ASSURANCE', 'VOITURE', 'SODA', 'PARIS SPORTIFS', 'TELEPHONE', 'MOUSSE']
function makeProps() {
  props = []
  npcs = []
  // Panneaux publicitaires le long des deux touches.
  for (let x = FIELD.x; x < FIELD.x + FIELD.w - 10; x += 84) {
    props.push({ kind: 'board', x, y: FIELD.y - 20, w: 80, h: 12, hp: 1, label: SPONSORS[((x / 84) | 0) % SPONSORS.length], color: [PAL.red, PAL.blue, PAL.amber, PAL.cyan, PAL.pink][((x / 84) | 0) % 5] })
    props.push({ kind: 'board', x, y: FIELD.y + FIELD.h + 10, w: 80, h: 12, hp: 1, label: SPONSORS[((x / 84) | 0 + 3) % SPONSORS.length], color: [PAL.blue, PAL.amber, PAL.red, PAL.pink, PAL.cyan][((x / 84) | 0) % 5] })
  }
  // Drapeaux de corner, cages, banc, glacière, caméra.
  for (const [cx, cy] of [[FIELD.x, FIELD.y], [FIELD.x + FIELD.w, FIELD.y], [FIELD.x, FIELD.y + FIELD.h], [FIELD.x + FIELD.w, FIELD.y + FIELD.h]]) props.push({ kind: 'flag', x: cx - 3, y: cy - 24, w: 6, h: 24, hp: 1 })
  props.push({ kind: 'goal', x: FIELD.x - 28, y: FIELD.y + FIELD.h / 2 - GOAL_H / 2, w: 28, h: GOAL_H, hp: 3, side: 0 })
  props.push({ kind: 'goal', x: FIELD.x + FIELD.w, y: FIELD.y + FIELD.h / 2 - GOAL_H / 2, w: 28, h: GOAL_H, hp: 3, side: 1 })
  props.push({ kind: 'bench', x: FIELD.x + FIELD.w / 2 - 270, y: FIELD.y + FIELD.h + 34, w: 250, h: 16, hp: 1 })
  props.push({ kind: 'cooler', x: FIELD.x + FIELD.w / 2 - 20, y: FIELD.y + FIELD.h + 36, w: 12, h: 14, hp: 1 })
  props.push({ kind: 'camera', x: FIELD.x + FIELD.w / 2 + 60, y: FIELD.y - 44, w: 14, h: 22, hp: 1 })
  // Remplaçants assis, sélectionneur, kiné.
  for (let i = 0; i < 11; i++) npcs.push({ ...makeFrench(5, nextLook++), x: FIELD.x + FIELD.w / 2 - 260 + i * 23, y: FIELD.y + FIELD.h + 44, team: 'staff', role: 'sub', dir: 'n', anim: 'idle', number: 12 + i })
  npcs.push({ ...makeFrench(5, 10), x: FIELD.x + FIELD.w / 2 + 40, y: FIELD.y + FIELD.h + 46, team: 'staff', role: 'coach', atlas: 'france-0', dir: 'w', anim: 'idle', speed: 70, name: 'LE SELECTIONNEUR' })
  npcs.push({ ...makeFrench(5, 8), x: FIELD.x + FIELD.w / 2 + 120, y: FIELD.y + FIELD.h + 46, team: 'staff', role: 'kine', atlas: 'france-0', dir: 'w', anim: 'idle', speed: 150, name: 'LE KINE' })
}
function propCenter(p) { return { x: p.x + p.w / 2, y: p.y + p.h / 2 } }
function propDist(from, p) { const dx = Math.max(p.x - from.x, 0, from.x - p.x - p.w), dy = Math.max(p.y - from.y, 0, from.y - p.y - p.h); return Math.hypot(dx, dy) }
function nearestProp(from, maxD) { let best = null, bd = maxD; for (const p of props) { if (p.hp <= 0) continue; const d = propDist(from, p); if (d < bd) { bd = d; best = p } } if (best) best.prop = true; return best }
function hitProps(how) { for (const p of props) if (p.hp > 0 && propDist(hero, p) < 10) { breakProp(p, how); hero.propHit = true } }
function breakProp(p, how) {
  p.hp -= how === 'tackle' ? 1 : 1
  const c = propCenter(p)
  for (let i = 0; i < 10; i++) S.debris.push({ x: c.x + rr(-p.w / 2, p.w / 2), y: c.y, vx: rr(-120, 120), vy: rr(-160, -40), z: 0, color: p.kind === 'goal' ? PAL.white : p.kind === 'board' ? p.color : p.kind === 'flag' ? PAL.yellow : PAL.clay, t: 0 })
  S.shake = Math.max(S.shake, 6)
  if (p.hp > 0) { popup(c.x, c.y - 20, 'CRAC', PAL.grey1); beep('hit'); return }
  p.broken = true
  if (p.kind === 'goal') foul('LA CAGE EST PAR TERRE', null)
  else if (p.kind === 'bench') { foul('FAUTE SUR LE BANC', null); for (const n of npcs) if (n.role === 'sub' && n.state === 'play') { n.vx = rr(-150, 150); n.vy = rr(-120, -60); knockDown(n, 0.4) } }
  else { foul('CASSE', null); popup(c.x, c.y - 30, 'CRAC', PAL.white, true) }
}
function hitBoard(b) {
  const p = props.filter((q) => q.kind === 'board' && q.hp > 0).sort((a, c) => propDist(b, a) - propDist(b, c))[0]
  if (p && propDist(b, p) < 30 && Math.hypot(b.vx, b.vy) > 300) breakProp(p, 'ball')
}
function updateNpcs(dt) {
  for (const n of npcs) {
    n.ft += dt
    if (n.state === 'fall') { updateFall(n, dt); continue }
    if (n.state === 'ko') { if (dist(n, hero) > 70) n.down -= dt; if (n.down <= 0) { n.state = 'play'; n.hp = 3; n.anim = 'idle' } continue }
    if (n.stun > 0) { n.stun -= dt; n.x += n.vx * dt; n.y += n.vy * dt; n.vx *= 0.85; n.vy *= 0.85; if (n.vz || n.z > 0) { n.z += n.vz * dt; n.vz -= 900 * dt; if (n.z <= 0) { n.z = 0; n.vz = 0 } } n.frame = Math.floor(n.ft * 10); continue }
    let target = null
    if (n.role === 'kine') {
      const hurt = french.find((f) => f.state === 'ko')
      target = hurt ? { x: hurt.x + 20, y: hurt.y } : { x: n.home ? n.home.x : n.x, y: n.home ? n.home.y : n.y }
      if (!n.home) n.home = { x: n.x, y: n.y }
    } else if (n.role === 'coach') {
      if (!n.home) n.home = { x: n.x, y: n.y }
      // Il fait les cent pas, et entre sur la pelouse quand l'arbitre craque.
      target = ref.patience <= 0 ? { x: ref.x - 30, y: ref.y + 20 } : { x: n.home.x + Math.sin(S.t * 0.7) * 60, y: n.home.y }
    }
    if (target) {
      const dx = target.x - n.x, dy = target.y - n.y, d = Math.hypot(dx, dy)
      if (d > 6) { n.vx = (dx / d) * n.speed; n.vy = (dy / d) * n.speed; n.x += n.vx * dt; n.y += n.vy * dt; const nd = dirOf(dx, dy); if (nd) n.dir = nd; n.anim = 'run' } else { n.vx = n.vy = 0; n.anim = 'idle' }
      n.frame = Math.floor(n.ft * (n.anim === 'run' ? 8 : 4))
    } else n.frame = Math.floor(n.ft * 4)
  }
}
function drawProp(p, cx, cy) {
  if (p.kind === 'board') {
    if (p.broken) { g.fillStyle = PAL.slateD; g.fillRect(p.x + cx, p.y + cy + 8, p.w, 5); g.fillStyle = p.color; g.fillRect(p.x + cx + 4, p.y + cy + 9, p.w - 8, 3); return }
    g.fillStyle = PAL.ink; g.fillRect(p.x + cx - 1, p.y + cy - 1, p.w + 2, p.h + 2)
    g.fillStyle = p.color; g.fillRect(p.x + cx, p.y + cy, p.w, p.h)
    text(p.label, p.x + cx + p.w / 2, p.y + cy + 2, { size: 8, align: 'center', color: PAL.white })
  } else if (p.kind === 'flag') {
    if (p.broken) { g.fillStyle = PAL.grey1; g.fillRect(p.x + cx - 10, p.y + cy + 22, 22, 2); g.fillStyle = PAL.yellow; g.fillRect(p.x + cx + 8, p.y + cy + 18, 6, 5); return }
    g.fillStyle = PAL.grey1; g.fillRect(p.x + cx + 2, p.y + cy, 2, p.h)
    g.fillStyle = PAL.yellow; g.beginPath(); g.moveTo(p.x + cx + 4, p.y + cy); g.lineTo(p.x + cx + 14, p.y + cy + 4); g.lineTo(p.x + cx + 4, p.y + cy + 8); g.fill()
  } else if (p.kind === 'goal') {
    const gx = p.x + cx, gy = p.y + cy
    if (p.broken) { g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(gx - 6, gy + GOAL_H - 16, 40, 18); g.fillStyle = PAL.white; g.fillRect(gx - 8, gy + GOAL_H - 6, 44, 3); g.fillRect(gx + 10, gy + 20, 3, GOAL_H - 30); return }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(gx, gy, 28, GOAL_H)
    g.strokeStyle = PAL.grey1; g.lineWidth = 1
    for (let i = 0; i <= 28; i += 6) { g.beginPath(); g.moveTo(gx + i, gy); g.lineTo(gx + i, gy + GOAL_H); g.stroke() }
    for (let j = 0; j <= GOAL_H; j += 6) { g.beginPath(); g.moveTo(gx, gy + j); g.lineTo(gx + 28, gy + j); g.stroke() }
    g.fillStyle = PAL.white; g.fillRect(p.side ? gx - 2 : gx + 26, gy - 2, 4, GOAL_H + 4)
    if (p.hp < 3) { g.fillStyle = PAL.ink; for (let k = 0; k < 3 - p.hp; k++) g.fillRect(gx + 6 + k * 8, gy + 30 + k * 25, 2, 14) }
  } else if (p.kind === 'bench') {
    g.fillStyle = PAL.ink; g.fillRect(p.x + cx - 1, p.y + cy - 1, p.w + 2, p.h + 2)
    g.fillStyle = p.broken ? PAL.slate : PAL.clay; g.fillRect(p.x + cx, p.y + cy + (p.broken ? 8 : 0), p.w, p.broken ? 6 : p.h)
    if (!p.broken) { g.fillStyle = PAL.sand; g.fillRect(p.x + cx, p.y + cy, p.w, 3) }
  } else if (p.kind === 'cooler') {
    g.fillStyle = PAL.ink; g.fillRect(p.x + cx - 1, p.y + cy - 1, p.w + 2, p.h + 2)
    if (p.broken) { g.fillStyle = PAL.cyan; g.fillRect(p.x + cx - 6, p.y + cy + 10, 24, 5) }
    g.fillStyle = PAL.blue; g.fillRect(p.x + cx, p.y + cy + (p.broken ? 9 : 0), p.w, p.broken ? 5 : p.h)
    g.fillStyle = PAL.white; g.fillRect(p.x + cx + 2, p.y + cy + 2, p.w - 4, 3)
  } else if (p.kind === 'camera') {
    g.fillStyle = PAL.ink
    if (p.broken) { g.fillRect(p.x + cx - 4, p.y + cy + 16, 22, 6); return }
    g.fillRect(p.x + cx + 6, p.y + cy + 8, 2, 14); g.fillRect(p.x + cx + 2, p.y + cy + 20, 10, 2)
    g.fillStyle = PAL.slate; g.fillRect(p.x + cx, p.y + cy, 14, 9)
    g.fillStyle = PAL.cyan; g.fillRect(p.x + cx + 10, p.y + cy + 2, 3, 4)
  }
}

/* ---------- héros ---------- */
function nearestFrench(from, maxD, pred = () => true, withStaff = true) {
  let best = null, bd = maxD
  for (const f of withStaff ? [...french, ...npcs] : french) { if (f.state !== 'play' || !pred(f)) continue; const d = dist(from, f); if (d < bd) { bd = d; best = f } }
  return best
}
function hitFrench(f, name, { throwIt = false, knock = 0 } = {}) {
  if (f.hp <= 0) { foul('ACHARNEMENT', f); return }
  if (f.absurd) name = f.absurd.name
  else if (f.team === 'staff') { const k = f.kind || f.role; name = k === 'sub' ? 'FAUTE SUR LE BANC' : k === 'press' ? 'FAUTE SUR UN JOURNALISTE' : k === 'fan' ? 'FAUTE SUR UN SUPPORTER' : 'FAUTE SUR LE STAFF' }
  else if (f.gk && name !== "FAUTE SUR L'ARBITRE") name = 'FAUTE SUR LE GARDIEN'
  f.hp -= 1
  f.stun = 0.45
  f.anim = 'knocked'; f.frame = 0; f.ft = 0
  f.z = 0; f.vz = 170
  if (ball.owner === f) { ball.owner = null; ball.vx = (f.x - hero.x) * 2; ball.vy = (f.y - hero.y) * 2 }
  const dx = f.x - hero.x, dy = f.y - hero.y
  const d = Math.hypot(dx, dy) || 1
  const air = knock || (throwIt ? 300 : name === 'COUP DE PIED' ? 240 : name === 'PIED SAUTE' || name === 'COUP DE BOULE' ? 280 : 0)
  const push = air ? 220 + air * 0.4 : 120
  f.vx = (dx / d) * push; f.vy = (dy / d) * push
  foul(name, f, { penalty: inBox(f) })
  if (f.absurd && f.absurd.debris) for (let i = 0; i < 8; i++) S.debris.push({ x: f.x + rr(-10, 10), y: f.y - 20, vx: rr(-150, 150), vy: rr(-200, -60), z: 0, color: f.absurd.debris[i % f.absurd.debris.length], t: 0 })
  if (f.atlas === 'president') { ref.patience = 0; banner('LE PRESIDENT EST PAR TERRE, L\'ARBITRE CRAQUE', PAL.red) }
  if (f.carrying) { f.carrying.carriedBy = null; f.carrying.down = 2; f.carrying = null; popup(f.x, f.y - 70, 'PLOUF', PAL.white, true) }
  if (f.hp <= 0 || throwIt || air) knockDown(f, air ? 0.9 : 0.35, air)
  for (let i = 0; i < 6; i++) S.particles.push({ x: f.x, y: f.y - 30, vx: rr(-60, 60), vy: rr(-80, -20), t: 0, life: 0.5, c: i % 2 ? PAL.yellow : PAL.white })
  beep(air || throwIt || (FOULS[name] && FOULS[name].big) ? 'hitBig' : 'hit')
}
function knockDown(f, flight, air = 0) {
  f.state = 'fall'
  f.fly = flight
  f.hp = 0
  f.z = 0; f.vz = air
  f.hitList = new Set()
  f.anim = air ? 'knocked' : 'fall'; f.frame = 0; f.ft = 0
  f.down = 3.2
  if (ball.owner === f) ball.owner = null
}
/** Un corps qui vole ou glisse fauche ceux qu'il croise : dominos. */
function dominoes(f) {
  const sp = Math.hypot(f.vx, f.vy)
  if (sp < 90) return
  for (const g of [...french, ...npcs]) {
    if (g === f || g.state !== 'play' || f.hitList.has(g) || dist(f, g) > 22) continue
    f.hitList.add(g)
    g.hp = 0
    g.vx = f.vx * 0.8 + rr(-40, 40); g.vy = f.vy * 0.8 + rr(-40, 40)
    knockDown(g, 0.5, f.z > 6 ? 160 : 0)
    foul('DOMINO', g)
  }
}
/** Pendant un arrêt général, les corps en l'air continuent de voler et les sauts retombent. */
function settleAir(dt) {
  for (const f of [...french, ...npcs]) {
    if (f.state === 'fall') { updateFall(f, dt); continue }
    if (f.vz || f.z > 0) { f.z += f.vz * dt; f.vz -= 900 * dt; if (f.z <= 0) { f.z = 0; f.vz = 0 } f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9 }
  }
  if (ref.down > 0 && !ref.landed) { ref.x += ref.vx * dt; ref.y += ref.vy * dt; ref.z += ref.vz * dt; ref.vz -= 900 * dt; if (ref.z <= 0 && ref.vz < 0) { ref.z = 0; ref.vz = 0; ref.landed = true; ref.vx = ref.vy = 0; ref.anim = 'ko' } }
  for (const f of [...french, ...npcs]) if (f.state === 'fall' || f.z > 0) f.ft += dt
}
function updateFall(f, dt) {
  f.fly -= dt
  f.x += f.vx * dt; f.y += f.vy * dt
  if (f.vz || f.z > 0) {
    f.z += f.vz * dt; f.vz -= 900 * dt
    if (f.z <= 0 && f.vz < 0) { f.z = 0; f.vz = 0; f.vx *= 0.4; f.vy *= 0.4; S.shake = Math.max(S.shake, 4); beep('land'); for (let i = 0; i < 6; i++) S.particles.push({ x: f.x + rr(-8, 8), y: f.y, vx: rr(-50, 50), vy: rr(-40, -5), t: 0, life: 0.4, c: PAL.sand }) }
  } else { f.vx *= 0.92; f.vy *= 0.92 }
  f.frame = Math.floor(f.ft * 10)
  dominoes(f)
  f.x = clamp(f.x, FIELD.x - 30, FIELD.x + FIELD.w + 30)
  f.y = clamp(f.y, FIELD.y - 40, FIELD.y + FIELD.h + 60)
  if (f.fly <= 0 && f.z <= 0) { f.state = 'ko'; f.anim = 'ko'; f.frame = 0; f.koDir = f.dir; f.vx = f.vy = 0 }
}
function inBox(p) { return (p.x < FIELD.x + 165 || p.x > FIELD.x + FIELD.w - 165) && Math.abs(p.y - (FIELD.y + FIELD.h / 2)) < 200 }
function heroAttack() {
  if (hero.stun > 0) return
  if (hero.act) {
    // Appuyer pendant le coup : trop tôt, ça casse l'enchaînement ; dans la fenêtre de fin, ça enchaîne.
    if (hero.act !== 'tackle' && hero.act !== 'flykick' && hero.act !== 'header' && hero.act !== 'ballthrow') {
      if (hero.actT > 0.07) hero.early = true
      else hero.buffered = true
    }
    return
  }
  const refNear = S.refDown <= 0 && dist(hero, ref) <= 40 && ref.flee <= 0
  const f = nearestFrench(hero, 40)
  if (refNear && (!f || dist(hero, ref) < dist(hero, f))) {
    hero.act = 'punch'; hero.actT = 0.3; hero.dir = dirOf(ref.x - hero.x, ref.y - hero.y) || hero.dir
    hero.hitTarget = ref
    return
  }
  const prop = nearestProp(hero, 44)
  if (!f && prop) {
    hero.act = 'punch'; hero.actT = 0.2; hero.hitTarget = prop; hero.hitDone = false
    hero.dir = dirOf(prop.x + prop.w / 2 - hero.x, prop.y + prop.h / 2 - hero.y) || hero.dir
    return
  }
  const moving = Math.hypot(hero.vx, hero.vy) > 60
  const far = nearestFrench(hero, 115)
  if (!f && far && moving && dist(hero, far) > 40) {
    // Pied sauté à la Ryu, ou coup de boule plongeant quand on est en feu.
    hero.act = S.fire > 0 && rnd() < 0.5 ? 'header' : 'flykick'
    hero.actT = 0.42; hero.hitDone = false; hero.hitTarget = far; hero.airHit = new Set()
    const dx = far.x - hero.x, dy = far.y - hero.y, d = Math.hypot(dx, dy) || 1
    const v = Math.min(620, d / 0.3)
    hero.tvx = (dx / d) * v; hero.tvy = (dy / d) * v
    hero.z = 0; hero.vz = 260
    hero.dir = dirOf(dx, dy) || hero.dir
    hero.chain = 0
    return
  }
  if (f) {
    const chain = ['punch', 'knee', 'kick', 'throw']
    const step = hero.chainT > 0 ? Math.min(hero.chain, 3) : 0
    hero.act = chain[step]
    hero.actT = step === 3 ? 0.36 : 0.2
    if (step === 3 && !S.busUsed && S.chains < 3) { S.chains++; popup(hero.x, hero.y - 70, S.chains >= 3 ? 'BUS PRET !' : 'ENCHAINEMENT ' + S.chains + '/3', PAL.cyan, true); if (S.chains >= 3) { banner('BUS PRET : DOUBLE BAS (OU DOUBLE CLIC DROIT)', PAL.cyan); beep('card') } }
    hero.chain = step + 1
    hero.chainT = 0.55 // fenêtre courte : il faut le rythme, pas le spam
    if (hero.linked) { S.score += 50 * comboMult(); hero.linked = false }
    hero.dir = dirOf(f.x - hero.x, f.y - hero.y) || hero.dir
    hero.hitTarget = f
    hero.hitDone = false
  } else {
    hero.act = 'tackle'
    hero.actT = 0.3
    hero.tackled = new Set()
    hero.tackleFrom = { x: hero.x, y: hero.y }
    const v = inputVector()
    const dx = v.dx || (hero.dir.includes('e') ? 1 : hero.dir.includes('w') ? -1 : 0)
    const dy = v.dy || (hero.dir.includes('s') ? 1 : hero.dir.includes('n') ? -1 : 0)
    const d = Math.hypot(dx, dy) || 1
    hero.tvx = (dx / d) * (S.fire > 0 ? 640 : 460); hero.tvy = (dy / d) * (S.fire > 0 ? 640 : 460)
    hero.dir = dirOf(dx, dy) || hero.dir
    hero.chain = 0
  }
}
function updateHero(dt) {
  const v = inputVector()
  const speed = hero.speed * (S.fury > 0 ? 1.9 : S.fire > 0 ? 1.6 : 1)
  if (hero.stun > 0) { hero.stun -= dt; hero.vx = hero.vy = 0 }
  else if (hero.act === 'tackle') {
    hero.vx = hero.tvx; hero.vy = hero.tvy
    hero.x += hero.vx * dt; hero.y += hero.vy * dt
    for (const f of [...french, ...npcs]) {
      if (f.state !== 'play' || hero.tackled.has(f)) continue
      if (dist(hero, f) < 34 && f.stun <= 0 && !f.intruder && !f.gk && S.fury <= 0 && dist(hero, hero.tackleFrom) > 70 && rnd() < 0.3) {
        // Il a vu venir : saut de côté, et le n°4 glisse dans le vide.
        hero.tackled.add(f)
        const px = -hero.tvy, py = hero.tvx, d = Math.hypot(px, py) || 1
        const sg = rnd() < 0.5 ? 1 : -1
        f.vx = (px / d) * 260 * sg; f.vy = (py / d) * 260 * sg
        f.stun = 0.35; f.z = 0; f.vz = 200; f.anim = 'knocked'; f.ft = 0; f.dodged = true
        popup(f.x, f.y - 56, 'ESQUIVE', PAL.cyan, true)
        continue
      }
      if (dist(hero, f) < 26) {
        hero.tackled.add(f)
        const behind = (f.dir.includes('e') && hero.x < f.x) || (f.dir.includes('w') && hero.x > f.x)
        const late = hero.actT < 0.15
        hitFrench(f, late ? 'SEMELLE' : behind ? 'PAR DERRIERE' : 'TACLE')
        if (hero.tackled.size === 2) { S.score += 300 * comboMult(); popup(hero.x, hero.y - 70, 'BOOM BOOM', PAL.orange, true) }
      }
    }
    if (S.refDown <= 0 && !hero.tackled.has(ref) && dist(hero, ref) < 22) { hero.tackled.add(ref); hitRef() }
    hero.actT -= dt
    hitProps('tackle')
    if (hero.actT <= 0) {
      hero.act = null
      if ([...hero.tackled].every((t) => t.dodged) && !hero.propHit) { for (const t of hero.tackled) t.dodged = false; hero.stun = 0.22; S.combo = Math.floor(S.combo / 2); S.tier = comboMult(); popup(hero.x, hero.y - 50, 'GLISSADE', PAL.grey1) }
      hero.propHit = false
    }
  } else if (hero.act === 'flykick' || hero.act === 'header') {
    hero.vx = hero.tvx; hero.vy = hero.tvy
    hero.x += hero.vx * dt; hero.y += hero.vy * dt
    hero.z += hero.vz * dt; hero.vz -= 1300 * dt
    if (hero.z < 0) hero.z = 0
    hero.actT -= dt
    const name = hero.act === 'header' ? 'COUP DE BOULE' : 'PIED SAUTE'
    for (const f of [...french, ...npcs]) {
      if (f.state !== 'play' || hero.airHit.has(f) || dist(hero, f) > 44) continue
      hero.airHit.add(f)
      hitFrench(f, name)
    }
    if (S.refDown <= 0 && !hero.airHit.has(ref) && dist(hero, ref) < 26) { hero.airHit.add(ref); hitRef() }
    hitProps('tackle')
    if (hero.actT <= 0) { hero.act = null; hero.z = 0; hero.vz = 0; if (hero.airHit.size === 0 && !hero.propHit) { hero.stun = 0.15; popup(hero.x, hero.y - 50, 'DANS LE VIDE', PAL.grey1) } hero.propHit = false }
  } else if (hero.act) {
    // On peut continuer d'avancer (lentement) pendant un coup : jamais bloqué.
    hero.vx = v.dx * speed * 0.35; hero.vy = v.dy * speed * 0.35
    hero.x += hero.vx * dt; hero.y += hero.vy * dt
    hero.actT -= dt
    const dur = hero.act === 'throw' ? 0.36 : hero.act === 'ballthrow' ? 0.4 : 0.2
    if (!hero.hitDone && hero.actT < dur - 0.08) {
      hero.hitDone = true
      const t = hero.hitTarget
      if (hero.act === 'ballthrow') throwBall()
      else if (t === ref) hitRef()
      else if (t && t.prop) breakProp(t, 'punch')
      else if (t && t.state === 'play' && dist(hero, t) < 52) hitFrench(t, { punch: 'POING', knee: 'GENOU', kick: 'COUP DE PIED', throw: 'PROJECTION' }[hero.act], { throwIt: hero.act === 'throw' })
      else if (t && t.state !== 'play' && t.hp <= 0 && dist(hero, t) < 52) foul('ACHARNEMENT', t)
    }
    if (hero.actT <= 0) {
      hero.act = null
      if (hero.early) { hero.early = false; hero.buffered = false; hero.stun = 0.4; hero.chain = 0; hero.chainT = 0; S.combo = Math.max(0, S.combo - 2); S.tier = comboMult(); popup(hero.x, hero.y - 56, 'TROP TOT', PAL.grey1, true) }
      else if (hero.buffered) { hero.buffered = false; hero.linked = true; heroAttack() }
    }
  } else {
    hero.vx = v.dx * speed; hero.vy = v.dy * speed
    hero.x += hero.vx * dt; hero.y += hero.vy * dt
    const d = dirOf(v.dx, v.dy)
    if (d) hero.dir = d
    if (S.fury > 0) { for (const f of [...french, ...npcs]) if (f.state === 'play' && dist(hero, f) < 30) hitFrench(f, 'SOUFFLE', { knock: 340 }); if (S.refDown <= 0 && dist(hero, ref) < 28) hitRef() }
    // Le ballon à portée : on le ramasse et on le balance loin, comme une brute.
    const wants = v.dx || v.dy // c'est le n°4 qui va au ballon, jamais l'inverse
    if ((S.phase === 'play' || S.phase === 'freekick' || S.phase === 'goal') && wants && (ball.z || 0) < 12 && dist(hero, ball) < 22 && ball.owner !== hero) {
      const o = ball.owner
      ball.out = false
      if (o === ref) { ball.owner = null; popup(ref.x, ref.y - 60, 'EH !', PAL.grey1, true) }
      else if (o && o !== hero) { o.stun = 0.5; o.anim = 'hit'; o.ft = 0; o.vx = (o.x - hero.x) * 4; o.vy = (o.y - hero.y) * 4; foul('VOL DE BALLON', o) }
      hero.act = 'ballthrow'; hero.actT = 0.4; hero.hitDone = false; ball.owner = hero
    }
  }
  if (ball.owner === hero) { ball.x = hero.x; ball.y = hero.y - 20; ball.vx = ball.vy = 0 }
  hero.chainT -= dt
  if (hero.chainT <= 0) hero.chain = 0
  hero.x = clamp(hero.x, FIELD.x - 20, FIELD.x + FIELD.w + 20)
  hero.y = clamp(hero.y, FIELD.y - 10, FIELD.y + FIELD.h + 10)
  // Animation.
  const moving = Math.hypot(hero.vx, hero.vy) > 5
  const anim = hero.act === 'tackle' ? 'tackle' : hero.act === 'ballthrow' ? 'throw' : hero.act ? hero.act : moving ? 'run' : 'stance'
  if (anim !== hero.anim) { hero.anim = anim; hero.frame = 0; hero.ft = 0 }
  hero.ft += dt
  const fps = anim === 'run' ? 8 : anim === 'throw' ? 10 : 6
  hero.frame = Math.floor(hero.ft * fps)
}
function throwBall() {
  ball.owner = null
  const dx = hero.dir.includes('e') ? 1 : hero.dir.includes('w') ? -1 : 0
  const dy = hero.dir.includes('s') ? 1 : hero.dir.includes('n') ? -1 : 0
  const d = Math.hypot(dx, dy) || 1
  ball.out = false
  ball.vx = (dx / d) * 900; ball.vy = (dy / d) * 900
  ball.z = 10; ball.vz = 520
  ball.air = 1.2
  S.stopAll = 0.7
  S.freeze = Math.max(S.freeze, 0.1)
  S.shake = Math.max(S.shake, 4)
  ball.x = hero.x + (dx / d) * 14; ball.y = hero.y + (dy / d) * 14 - 6
  ball.spin = 1
  foul('BALLON DEGAGE', null)
  ref.patience = Math.max(0, ref.patience - 4)
  for (const f of french) if (f.state === 'play' && f.stun <= 0) f.react = 0.4
}
function hitRef() {
  S.refHits++
  ref.hits++
  S.refDown = 2.2
  ref.down = 2.2
  ref.patience = 0
  ref.anim = 'fall'; ref.frame = 0; ref.ft = 0
  // Il part en vol plané, comme les autres.
  const dx = ref.x - hero.x, dy = ref.y - hero.y, d = Math.hypot(dx, dy) || 1
  const air = hero.act === 'throw' || hero.act === 'flykick' || hero.act === 'header' || hero.act === 'kick' || S.fire > 0 ? 300 : 200
  ref.vx = (dx / d) * (200 + air * 0.5); ref.vy = (dy / d) * (200 + air * 0.5); ref.z = 0; ref.vz = air; ref.landed = false
  if (ref.cardTarget) { popup(ref.x, ref.y - 66, 'IL NE DIRA RIEN', PAL.grey1, true); ref.cardTarget = null; if (S.phase === 'card') S.phase = resumePhase() }
  ref.cardShow = 0
  if (ball.owner === ref) { ball.owner = null; ball.vx = rr(-200, 200); ball.vy = rr(-200, 200) }
  foul("FAUTE SUR L'ARBITRE", null)
  if (ref.hits >= 3 && !ref.strict) { ref.strict = 1.25; banner('LE 4E ARBITRE PREND LE SIFFLET', PAL.grey1); S.evac++ }
}

/* ---------- Français (IA de foot) ---------- */
function updateFrench(dt) {
  const goal = { x: FIELD.x + FIELD.w + 6, y: FIELD.y + FIELD.h / 2 }
  const regroup = S.phase === 'freekick' || S.phase === 'kickoff' || S.phase === 'goal'
  const frozen = S.phase === 'card'
  // Deux appels de balle devant le porteur, renouvelés à chaque changement de porteur.
  const o = ball.owner
  if (o && o.team === 'fra') {
    if (S.lastOwner !== o) {
      S.lastOwner = o
      for (const g of french) g.runner = 0
      french.filter((g) => g !== o && g.state === 'play' && !g.gk && g.role !== 'fan' && g.role !== 'press' && g.x > o.x - 120).sort((a, b) => dist(a, o) - dist(b, o)).slice(0, 2).forEach((g, i) => { g.runner = i + 1 })
    }
  } else if (S.lastOwner) { S.lastOwner = null; for (const g of french) g.runner = 0 }
  for (const f of french) {
    f.ft += dt
    if (f.state === 'leaving') {
      f.leaveT += dt
      f.anim = 'run'
      const ty = f.y < FIELD.y + FIELD.h / 2 ? FIELD.y - 60 : FIELD.y + FIELD.h + 60
      f.dir = ty < f.y ? 'n' : 's'
      f.y += (ty < f.y ? -1 : 1) * 90 * dt
      f.frame = Math.floor(f.ft * 8)
      if (Math.abs(f.y - ty) < 4) removePlayer(f)
      continue
    }
    if (f.state === 'fall') { updateFall(f, dt); continue }
    if (f.state === 'ko') {
      if (f.carriedBy) { if (french.includes(f.carriedBy) && f.carriedBy.state === 'play') { f.x = f.carriedBy.x; f.y = f.carriedBy.y + 6; continue } f.carriedBy = null }
      // Personne ne se relève tant que le n°4 rôde : les corps s'empilent.
      f.down -= dt * (dist(f, hero) > 70 ? 1 : 0.35) // il reste au sol plus longtemps si le n°4 rôde
      if (f.down <= 0) { if (f.absurd && f.absurd.bounce && !f.bounced) { f.bounced = true; f.state = 'play'; f.hp = 3; f.anim = 'idle'; f.z = 0; f.vz = 0; knockDown(f, 0.5, 260); f.state = 'fall'; f.hp = 1; popup(f.x, f.y - 60, 'REBONDIT', PAL.green, true); f.down = 1.5 } else { f.state = 'fade'; f.fadeT = 0.9; f.ft = 0 } }
      continue
    }
    if (f.state === 'fade') {
      // Il clignote sur place et disparaît ; un remplaçant entre, tant qu'il en reste.
      f.fadeT -= dt
      if (f.fadeT <= 0) removePlayer(f)
      continue
    }
    if (f.stun > 0) {
      f.stun -= dt
      f.x += f.vx * dt; f.y += f.vy * dt
      f.vx *= 0.85; f.vy *= 0.85
      if (f.vz || f.z > 0) { f.z += f.vz * dt; f.vz -= 900 * dt; if (f.z <= 0) { f.z = 0; f.vz = 0 } }
      f.frame = Math.floor(f.ft * 10)
      continue
    }
    if (f.z > 0 && !f.flying) { f.z = 0; f.vz = 0 }
    if (frozen) { f.vx = f.vy = 0; f.anim = 'idle'; f.frame = Math.floor(f.ft * 4); if (ref.cardTarget) { const nd = dirOf(ref.x - f.x, ref.y - f.y); if (nd && dist(f, ref) < 160) f.dir = nd } continue }
    // Cible de déplacement.
    let target
    const carrier = ball.owner === f
    if (S.phase === 'goal') target = slotPos(f, FIELD.x + FIELD.w / 2 - 120)
    else if (regroup) {
      const near = french.filter((g) => g.state === 'play' && !g.gk).sort((a, b) => (dist(a, ball) - (a.near ? 60 : 0)) - (dist(b, ball) - (b.near ? 60 : 0))).slice(0, 4)
      for (const g of french) g.near = near.includes(g)
      target = near.includes(f) ? { x: ball.x + (f.slot % 2 ? -1 : 1) * (16 + (f.slot % 3) * 14), y: ball.y + ((f.slot % 4) - 1.5) * 16 } : slotPos(f, ball.x)
    } else if (carrier) {
      target = { x: goal.x, y: goal.y + (f.slot % 2 ? -30 : 30) }
      f.holdT = (f.holdT || 0) + dt
      // Il conduit un peu, puis passe (vite si le n°4 approche), et tire dès qu'il est dans la surface.
      const threat = dist(hero, f)
      const mates = french.filter((g) => g !== f && g.state === 'play' && !g.gk && !(g.intruder && g.role !== 'player') && dist(g, hero) > 70 && g.x > f.x - 80 && dist(g, f) > 50 && dist(g, f) < 320)
      if (f.x > FIELD.x + FIELD.w - 260 && Math.abs(f.y - goal.y) < 180 && (rnd() < dt * 1.5 || (f.holdT > 0.4 && f.x > FIELD.x + FIELD.w - 90))) { shoot(f, goal); f.holdT = 0 }
      else if (mates.length && f.holdT > 0.25 && (f.holdT > rr(0.9, 1.6) || (threat < 110 && rnd() < 0.35))) {
        // Le mieux placé : le plus avancé, avec un bonus pour celui qui est démarqué.
        const mate = mates.sort((a, b) => (b.x - dist(b, hero) * 0.3) - (a.x - dist(a, hero) * 0.3))[0]
        pass(f, mate); f.holdT = 0
      }
    } else if (ball.owner && ball.owner.team === 'fra' && !f.gk && f.runner) {
      // Appel : deux coureurs se projettent devant le porteur.
      const o = ball.owner
      target = { x: Math.min(FIELD.x + FIELD.w - 60, o.x + 150), y: clamp(o.y + (f.runner === 1 ? -90 : 90), FIELD.y + 30, FIELD.y + FIELD.h - 30) }
    } else if (!ball.owner && !f.gk) {
      const chasers = french.filter((g) => g.state === 'play' && !g.gk && !(g.intruder && g.role !== 'player')).sort((a, b) => (dist(a, ball) - (a.chaser ? 40 : 0)) - (dist(b, ball) - (b.chaser ? 40 : 0))).slice(0, 2)
      if (f === french[0] || !S.chaserTick || S.chaserTick !== S.t) { S.chaserTick = S.t; for (const g of french) g.chaser = false; for (const g of chasers) g.chaser = true }
      target = chasers.includes(f) ? { x: ball.x + ball.vx * 0.25, y: ball.y + ball.vy * 0.25, exact: true } : slotPos(f, ball.x)
    } else target = slotPos(f, ball.x)
    if (f.intruder && !carrier && !regroup) {
      if (f.role === 'fan') target = { x: ball.x + Math.cos(S.t * f.spin + f.phase) * 150, y: ball.y + Math.sin(S.t * f.spin + f.phase) * 95 } // ils tournent autour du ballon en chantant
      else if (f.role === 'press') target = { x: hero.x + Math.cos(f.phase + S.t * 0.2) * 120, y: hero.y + Math.sin(f.phase + S.t * 0.2) * 80 } // ils suivent le n°4 à distance
      else if (f.role === 'staff') { const ko = french.find((g) => g.state === 'ko'); if (ko) target = { x: ko.x + 18, y: ko.y + 4 } } // ils vont voir les blessés
      else if (f.role === 'couple') { const pt = f.partner; if (pt && french.includes(pt)) target = pt.state === 'play' ? { x: pt.x + (f.atlas === 'marie' ? -18 : 18) + Math.sin(S.t * 0.8 + f.phase) * 40, y: pt.y + Math.cos(S.t * 0.6 + f.phase) * 30 } : { x: pt.x + 22, y: pt.y } } // ils ne se lâchent pas
      else if (f.role === 'bird') { const dh = dist(f, hero); f.wanderT -= dt; if (dh < 110) { target = { x: f.x + (f.x - hero.x) * 3, y: f.y + (f.y - hero.y) * 3 }; f.z = Math.abs(Math.sin(S.t * 18)) * 10; f.flying = true } else { f.flying = false; f.z = 0; if (f.wanderT <= 0 || !f.wander) { f.wanderT = rr(1.5, 4); f.wander = rnd() < 0.5 ? { x: f.x, y: f.y } : { x: rr(FIELD.x + 30, FIELD.x + FIELD.w - 30), y: rr(FIELD.y + 30, FIELD.y + FIELD.h - 30) } } target = f.wander } } // ils s'envolent quand on approche
      else if (f.role === 'patrol') { f.wanderT -= dt; if (f.wanderT <= 0 || !f.wander) { f.wanderT = rr(3, 6); f.wander = { x: rr(FIELD.x + 60, FIELD.x + FIELD.w - 60), y: rr(FIELD.y + 60, FIELD.y + FIELD.h - 60) } } target = f.wander } // le cheval patrouille lentement
      else if (f.role === 'stretcher') {
        // Il va chercher un blessé, le charge sur la civière et l'emmène hors du terrain.
        if (f.carrying && (!french.includes(f.carrying) || f.carrying.state !== 'ko')) f.carrying = null
        if (f.carrying) { const ty = f.y < FIELD.y + FIELD.h / 2 ? FIELD.y - 20 : FIELD.y + FIELD.h + 20; target = { x: f.x, y: ty }; if (Math.abs(f.y - ty) < 14) { removePlayer(f.carrying); f.carrying = null } }
        else { const hurt = french.filter((g) => g.state === 'ko' && !g.carriedBy && g !== f).sort((a, b) => dist(a, f) - dist(b, f))[0]; if (hurt) { target = { x: hurt.x, y: hurt.y }; if (dist(f, hurt) < 14) { f.carrying = hurt; hurt.carriedBy = f } } }
      }
      else if (f.role === 'ballboy') { if (ball.out) target = { x: ball.x, y: ball.y, exact: true }; else { const side = f.y < FIELD.y + FIELD.h / 2 ? FIELD.y + 14 : FIELD.y + FIELD.h - 14; target = { x: clamp(ball.x, FIELD.x + 40, FIELD.x + FIELD.w - 40), y: side } } } // il longe la touche et bondit sur les ballons sortis
      else if (f.role === 'calm') { const dh = dist(f, hero); target = dh > 50 ? { x: hero.x, y: hero.y } : { x: f.x, y: f.y }; if (dh < 70) { const nd = dirOf(hero.x - f.x, hero.y - f.y); if (nd) f.dir = nd } } // il vient te raisonner, les mains en avant
      else if (f.role === 'march') { f.marchX += f.marchDir * 45 * dt; if (f.marchX > FIELD.x + FIELD.w - 30 || f.marchX < FIELD.x + 30) f.marchDir *= -1; target = { x: f.marchX - (f.marchRank || 0) * 22 * f.marchDir, y: f.marchY } } // la fanfare traverse au pas
      else if (f.role === 'wander') { f.wanderT -= dt; if (f.wanderT <= 0 || !f.wander) { f.wanderT = rr(0.6, 1.6); f.wander = { x: rr(FIELD.x + 30, FIELD.x + FIELD.w - 30), y: rr(FIELD.y + 30, FIELD.y + FIELD.h - 30) } } target = f.wander } // la poule et le streaker courent n'importe où
    }
    if (!carrier && !regroup && !target.exact) { target = { x: target.x + f.jx, y: target.y + f.jy } }
    if (f.gk) target = { x: FIELD.x + 30, y: clamp(ball.y, FIELD.y + FIELD.h / 2 - 50, FIELD.y + FIELD.h / 2 + 50) }
    // Évitement léger du n°4 pour les non-porteurs.
    const dh = dist(f, hero)
    if (!carrier && dh < 80 && dh > 0.01 && (!regroup || S.phase === 'goal')) { const k = clamp((80 - dh) / 40, 0, 1); target = { x: target.x + ((f.x - hero.x) / dh) * 140 * k, y: target.y + ((f.y - hero.y) / dh) * 140 * k, exact: target.exact } } // déviation progressive, jamais une bascule
    f.tgt = target
    const dx = target.x - f.x, dy = target.y - f.y
    const d = Math.hypot(dx, dy)
    const sp = f.speed * (carrier ? 0.95 : 1) * (regroup ? (S.phase === 'goal' ? 0.8 : 1.3) : 1) * (f.intruder ? 1 : 1 + Math.min(0.5, Math.floor(S.clock / 30) * 0.08)) // la France accélère toutes les 30 s
    if (d > 6) { f.vx = (dx / d) * sp; f.vy = (dy / d) * sp } else { f.vx = f.vy = 0 }
    // Séparation entre Français.
    const px0 = f.x, py0 = f.y
    f.x += f.vx * dt; f.y += f.vy * dt
    // Séparation : un glissement de position (un tiers du chevauchement), jamais une vitesse, sinon ça tremble sur place.
    for (const g of french) if (g !== f && g.state === 'play') { const dd = dist(f, g); const rad = (g.r > 12 ? g.r + 14 : 22); if (dd < rad && dd > 0.01) { const k = (rad - dd) * (g.r > 12 ? 0.6 : 0.33); f.x += ((f.x - g.x) / dd) * k; f.y += ((f.y - g.y) / dd) * k } }
    const m = ball.out && target.exact ? -16 : f.role === 'ballboy' ? 2 : 8
    f.x = clamp(f.x, FIELD.x + m, FIELD.x + FIELD.w - m)
    f.y = clamp(f.y, FIELD.y + m, FIELD.y + FIELD.h - m)
    // Animation sur le déplacement réel, lissé : pas de course sur place, pas de direction qui saute.
    const mvx = (f.x - px0) / Math.max(dt, 0.001), mvy = (f.y - py0) / Math.max(dt, 0.001)
    f.svx = (f.svx || 0) * 0.7 + mvx * 0.3; f.svy = (f.svy || 0) * 0.7 + mvy * 0.3
    const spd = Math.hypot(f.svx, f.svy)
    const moving = f.anim === 'run' ? spd > 14 : spd > 34 // hystérésis : pas de va-et-vient course/arrêt
    const nd = dirOf(f.svx, f.svy)
    if (moving && nd && spd > 34) { if (nd !== f.dir) { f.dirT = (f.dirT || 0) + dt; if (f.dirT > 0.1) { f.dir = nd; f.dirT = 0 } } else f.dirT = 0 }
    const anim = moving ? 'run' : 'idle'
    if (anim !== f.anim) f.anim = anim // le compteur continue : l'image avance toujours
    f.frame = Math.floor(f.ft * (moving ? 8 : 4))
    // Prise de balle.
    if (ball.out && !ball.owner && S.phase !== 'goal' && dist(f, ball) < 16 && !f.gk && f.role !== 'bird') {
      // Remise en jeu : à deux mains, vers un coéquipier ou le centre, bien moins fort que le n°4.
      const mate = french.filter((g) => g !== f && g.state === 'play' && !g.gk && dist(g, f) < 300).sort((a, b) => dist(a, f) - dist(b, f))[0]
      const anywhere = f.role === 'ballboy'
      const tx = anywhere ? rr(FIELD.x + 40, FIELD.x + FIELD.w - 40) : mate ? mate.x : FIELD.x + FIELD.w / 2, ty = anywhere ? rr(FIELD.y + 40, FIELD.y + FIELD.h - 40) : mate ? mate.y : FIELD.y + FIELD.h / 2
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1
      ball.out = false; ball.noTake = 0.3; ball.vx = (dx / d) * 380; ball.vy = (dy / d) * 380; ball.z = 20; ball.vz = 240; ball.air = 0.5
      ball.x = clamp(f.x, FIELD.x + 6, FIELD.x + FIELD.w - 6); ball.y = clamp(f.y, FIELD.y + 6, FIELD.y + FIELD.h - 6)
      f.stun = 0.3; f.anim = 'idle'; f.ft = 0
      beep('pass')
    }
    if (!regroup && !ball.owner && !ball.out && !(ball.noTake > 0) && dist(f, ball) < 14 && !f.gk && (ball.z || 0) < 10) { ball.owner = f; f.holdT = 0 }
    if (carrier && ball.owner === f) { const nx = clamp(f.x + (f.vx || 60) * 0.12, FIELD.x + 6, FIELD.x + FIELD.w - 6), ny = f.y + f.vy * 0.12 + 6; ball.x = nx; ball.y = ny; ball.vx = ball.vy = 0; ball.z = Math.min(ball.z || 0, 4) }
  }
}
function pass(from, to) {
  ball.owner = null
  beep('pass')
  ball.noTake = 0.25
  S.passes = (S.passes || 0) + 1
  const dx = to.x + to.vx * 0.25 - from.x, dy = to.y + to.vy * 0.25 - from.y
  const d = Math.hypot(dx, dy) || 1
  const v = Math.min(640, 260 + d * 1.6)
  ball.vx = (dx / d) * v; ball.vy = (dy / d) * v
  ball.x = from.x + (dx / d) * 10; ball.y = from.y + (dy / d) * 10
  from.stun = 0.15
}
function shoot(from, goal) {
  ball.owner = null
  beep('shoot')
  ball.noTake = 0.35
  S.shots = (S.shots || 0) + 1
  const ty = goal.y + rr(-GOAL_H / 2 - 50, GOAL_H / 2 + 50)
  const dx = goal.x + 30 - from.x, dy = ty - from.y
  const d = Math.hypot(dx, dy) || 1
  ball.vx = (dx / d) * 680; ball.vy = (dy / d) * 680
  from.stun = 0.2
}
/** Un Français sort pour de bon : remplacé tant que le banc n'est pas vide, puis l'équipe fond. */
function removePlayer(f) {
  if (!f.intruder) {
    S.koCount++
    if (S.koCount >= 22 && !S.teamDoneAt) { S.teamDoneAt = S.clock; banner('EQUIPE DE FRANCE DEFONCEE EN ' + S.clock.toFixed(1) + ' S', PAL.orange); S.waveT = 1.5 }
  }
  const i = french.indexOf(f)
  if (!f.intruder && subsUsed < 11) substitute(f)
  else {
    if (i >= 0) french.splice(i, 1)
    // À partir du 12e défoncé, c'est n'importe qui qui entre : un absurde pour chaque sortant.
    if (S.koCount >= 12 && french.filter((g) => g.state === 'play').length < (S.fury > 0 ? 44 : 16)) spawnAbsurd(ABSURD[S.intruders % ABSURD.length], f)
  }
}
function substitute(f) {
  const idx = french.indexOf(f)
  subsUsed++
  const bench = npcs.find((n) => n.role === 'sub')
  let n
  if (bench) {
    // Il se lève du banc, même sonné, et entre en jeu (la France fait entrer n'importe qui).
    npcs.splice(npcs.indexOf(bench), 1)
    n = Object.assign(bench, { team: 'fra', role: undefined, slot: f.slot, gk: f.gk, atlas: f.gk ? 'gardien' : 'france-0', state: 'play', hp: 3, stun: 0, down: 0, anim: 'run', card: 0, intruder: false })
  } else { n = makeFrench(f.slot, nextLook++); n.x = FIELD.x + FIELD.w / 2; n.y = FIELD.y + FIELD.h + 40; n.number = 11 + subsUsed }
  if (idx >= 0) french[idx] = n; else french.push(n)
  banner('ENTREE DU N°' + n.number + (subsUsed >= 11 ? ' (LE DERNIER DU BANC)' : ''), PAL.grey1)
}

/* ---------- les absurdes : ils entrent à partir du 12e Français défoncé ---------- */
const ABSURD = [
  { atlas: 'banane', name: 'FAUTE SUR LA BANANE', behave: 'player', speed: 150, overlay: 'banane', banner: 'UN HOMME EN BANANE ENTRE EN JEU' },
  { atlas: 'echarpe', name: 'FAUTE SUR UN SUPPORTER', behave: 'fan', speed: 130, overlay: 'echarpe', banner: 'UN SUPPORTER AVEC ECHARPE ENTRE EN JEU' },
  { atlas: 'supporter', name: 'FAUTE SUR UN SUPPORTER', behave: 'fan', speed: 120, overlay: 'casquette', banner: 'UN SUPPORTER ENTRE EN JEU' },
  { atlas: 'poule', name: 'FAUTE SUR LA POULE', behave: 'wander', speed: 210, overlay: 'poule', banner: 'UNE POULE SUR LA PELOUSE' },
  { atlas: 'mascotte', name: 'FAUTE SUR LA MASCOTTE', behave: 'player', speed: 110, overlay: 'mascotte', banner: 'LA MASCOTTE ENTRE EN JEU' },
  { atlas: 'crs', name: 'FAUTE SUR UN CRS', behave: 'press', speed: 140, overlay: 'casque', banner: 'LES CRS INTERVIENNENT' },
  { atlas: 'streaker', name: 'FAUTE SUR LE STREAKER', behave: 'wander', speed: 240, overlay: 'censure', banner: 'UN STREAKER !' },
  { atlas: 'mamie', name: 'FAUTE SUR UNE MAMIE', behave: 'player', speed: 55, overlay: 'chignon', banner: 'UNE MAMIE ENTRE EN JEU' },
  { atlas: 'hotdog', name: 'FAUTE SUR LE VENDEUR DE HOT-DOGS', behave: 'wander', speed: 140, banner: 'LE VENDEUR DE HOT-DOGS TRAVERSE', debris: [PAL.redD, PAL.tan, PAL.amber] },
  { atlas: 'marie', name: 'FAUTE SUR LE MARIE', behave: 'couple', speed: 90, banner: 'LES MARIES SE SONT TROMPES DE SALLE', group: 'couple' },
  { atlas: 'commentateur', name: 'FAUTE SUR LE COMMENTATEUR', behave: 'press', speed: 120, banner: 'LE COMMENTATEUR DESCEND SUR LA PELOUSE' },
  { atlas: 'pigeon', name: 'FAUTE SUR UN PIGEON', behave: 'bird', speed: 250, banner: 'DES PIGEONS', group: 3, hp: 1, r: 7 },
  { atlas: 'cheval', name: 'FAUTE SUR LE GENDARME A CHEVAL', behave: 'patrol', speed: 65, banner: 'LA GENDARMERIE A CHEVAL', hp: 6, r: 18 },
  { atlas: 'civiere', name: 'FAUTE SUR LE KINE', behave: 'stretcher', speed: 150, banner: 'LE KINE ARRIVE AVEC LA CIVIERE' },
  { atlas: 'ramasseur', name: 'FAUTE SUR LE RAMASSEUR DE BALLES', behave: 'ballboy', speed: 240, banner: 'UN RAMASSEUR DE BALLES TROP RAPIDE' },
  { atlas: 'president', name: 'FAUTE SUR LE PRESIDENT', behave: 'calm', speed: 60, banner: 'LE PRESIDENT DE LA FEDERATION DESCEND CALMER LE JEU' },
  { atlas: 'musicien', name: 'FAUTE SUR LA FANFARE', behave: 'march', speed: 50, banner: 'LA FANFARE ENTRE AU PAS', group: 3 },
  { atlas: 'dino', name: 'FAUTE SUR LE DINOSAURE', behave: 'wander', speed: 170, banner: 'UN DINOSAURE GONFLABLE', bounce: true },
]
const MARIEE = { atlas: 'mariee', name: 'FAUTE SUR LA MARIEE', behave: 'couple', speed: 90 }
function spawnAbsurd(kind, near) {
  const f = makeFrench(11 + S.intruders, nextLook++)
  S.intruders++
  const role = ['bird', 'stretcher', 'ballboy'].includes(kind.behave) ? kind.behave : 'player'
  Object.assign(f, { intruder: true, absurd: kind, team: 'staff', role, atlas: kind.atlas, number: 12 + S.intruders, speed: kind.speed * rr(0.9, 1.15), wanderT: 0 })
  const side = rnd() < 0.5
  f.x = clamp((near ? near.x : ball.x) + rr(-220, 220), FIELD.x + 20, FIELD.x + FIELD.w - 20)
  f.y = side ? FIELD.y - 30 - rr(0, 40) : FIELD.y + FIELD.h + 30 + rr(0, 40)
  f.dir = side ? 's' : 'n'
  if (kind.hp) f.hp = kind.hp
  if (kind.r) f.r = kind.r
  french.push(f)
  if (kind.banner) banner(kind.banner, PAL.pink)
  if (kind.group === 'couple') { const m = spawnAbsurd(MARIEE, f); m.x = f.x + 18; m.y = f.y; f.partner = m; m.partner = f }
  else if (typeof kind.group === 'number') for (let k = 1; k < kind.group; k++) { const g2 = spawnAbsurd({ ...kind, group: 0, banner: null }, f); g2.x = f.x + k * 22; g2.y = f.y; g2.marchRank = k }
  if (kind.behave === 'march') { f.marchX = f.x; f.marchY = clamp(f.y, FIELD.y + 60, FIELD.y + FIELD.h - 60); f.marchDir = f.x < FIELD.x + FIELD.w / 2 ? 1 : -1 }
  return f
}

/* ---------- le bus des supporters : pouvoir unique, se gare devant notre but 10 s ---------- */
function callBus() {
  S.busUsed = true
  const gy = FIELD.y + FIELD.h / 2
  S.bus = { x: FIELD.x + FIELD.w - BUS.w / 2 - 6, y: FIELD.y - 200, state: 'in', t: 0, hit: new Set(), ty: gy } // collé à la ligne de but
  banner('LE BUS DES SUPPORTERS DEBARQUE', PAL.cyan)
  S.shake = Math.max(S.shake, 8)
  beep('hitBig')
}
function busRect(b, pad = 0) { return { x: b.x - BUS.w / 2 - pad, y: b.y - BUS.h / 2 - pad, w: BUS.w + pad * 2, h: BUS.h + pad * 2 } }
function inRect(p, r) { return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h }
function updateBus(dt) {
  const b = S.bus
  if (!b) return
  b.t += dt
  if (b.state === 'in') { b.y += BUS.speed * dt; if (b.y >= b.ty) { b.y = b.ty; b.state = 'park'; b.t = 0; S.shake = Math.max(S.shake, 10); beep('land'); banner('STATIONNEMENT GENANT', PAL.cyan) } }
  else if (b.state === 'park') { if (b.t > BUS.park) { b.state = 'out'; b.hit.clear(); banner('LE BUS REPART', PAL.grey1) } }
  else if (b.state === 'out') { b.y += BUS.speed * dt; if (b.y > FIELD.y + FIELD.h + 260) S.bus = null }
  const moving = b.state !== 'park'
  const r = busRect(b, moving ? 8 : 0)
  // Tout ce qui est sur le passage s'envole ; à l'arrêt, on ne fait que pousser.
  for (const f of [...french, ...npcs]) {
    if (f.state !== 'play' || !inRect(f, r)) continue
    if (moving) { if (b.hit.has(f)) continue; b.hit.add(f); f.vx = (f.x - b.x) * 6 + rr(-80, 80); f.vy = BUS.speed * 0.6; knockDown(f, 0.9, 320); foul('ECRASE PAR LE BUS', f); S.busHits++ }
    else { const side = f.x < b.x ? -1 : 1; f.x = b.x + side * (BUS.w / 2 + 6) }
  }
  if (S.refDown <= 0 && inRect(ref, r)) { if (moving && !b.hit.has(ref)) { b.hit.add(ref); hitRef(); ref.vy = BUS.speed * 0.5 } else if (!moving) ref.x = b.x + (ref.x < b.x ? -1 : 1) * (BUS.w / 2 + 8) }
  if (inRect(hero, busRect(b, 2))) { const side = hero.x < b.x ? -1 : 1; hero.x = b.x + side * (BUS.w / 2 + 10) }
  // Le ballon rebondit dessus : c'est le but du bus.
  if (!ball.owner && inRect(ball, busRect(b, 4)) && ball.z < 60) { const side = ball.x < b.x ? -1 : 1; ball.x = b.x + side * (BUS.w / 2 + 6); ball.vx = side * Math.max(220, Math.abs(ball.vx) * 0.8); ball.vy += rr(-80, 80); ball.noTake = 0.1; beep('bounce'); if (b.state === 'park') { popup(b.x - 30, b.y - 80, 'CONTRE', PAL.cyan, true); S.score += 200; S.lastPts = 200; S.lastPtsT = 0 } }
}
function drawBus(b, cx, cy) {
  const r = busRect(b)
  const x = Math.round(r.x + cx), y = Math.round(r.y + cy), w = r.w, h = r.h
  const R = (xx, yy, ww, hh, c) => { g.fillStyle = c; g.fillRect(xx, yy, ww, hh) }
  // Roues qui dépassent des flancs, puis la caisse.
  for (const wy of [y + 22, y + h - 40]) { R(x - 4, wy, 5, 16, PAL.ink); R(x + w - 1, wy, 5, 16, PAL.ink); R(x - 3, wy + 2, 2, 12, PAL.slate); R(x + w + 1, wy + 2, 2, 12, PAL.slate) }
  R(x - 1, y - 1, w + 2, h + 2, PAL.ink)
  R(x, y, w, h, PAL.blueD)
  // Flancs : bandeau de vitres avec montants, et liseré tricolore.
  for (const sx of [x + 1, x + w - 8]) {
    R(sx, y + 14, 7, h - 36, PAL.cyan)
    for (let j = y + 14; j < y + h - 22; j += 12) R(sx, j, 7, 2, PAL.ink)
    R(sx, y + h - 22, 7, 2, PAL.blue); R(sx, y + h - 20, 7, 2, PAL.white); R(sx, y + h - 18, 7, 2, PAL.red)
  }
  // Toit : plus clair, bande blanche, deux blocs de clim, et le nom.
  R(x + 9, y + 10, w - 18, h - 30, PAL.blue)
  R(x + 11, y + 12, w - 22, h - 34, PAL.blue)
  R(x + w / 2 - 2, y + 12, 4, h - 34, PAL.white)
  R(x + 12, y + 30, w - 24, 10, PAL.grey1); R(x + 13, y + 31, w - 26, 2, PAL.white)
  R(x + 12, y + h - 56, w - 24, 10, PAL.grey1); R(x + 13, y + h - 55, w - 26, 2, PAL.white)
  g.save(); g.translate(x + w / 2, y + h / 2 - 2); g.rotate(-Math.PI / 2)
  text('FC MMA', 0, -9, { size: 10, color: PAL.white, align: 'center' })
  text('SUPPORTERS', 0, 2, { size: 6, color: PAL.yellow, align: 'center' })
  g.restore()
  // Arrière (en haut) : lunette, feux rouges, plaque.
  R(x + 8, y + 2, w - 16, 7, PAL.slateD); R(x + 9, y + 3, w - 18, 2, PAL.grey2)
  R(x + 3, y + 3, 5, 4, PAL.red); R(x + w - 8, y + 3, 5, 4, PAL.red)
  // Avant (en bas) : pare-brise incliné, essuie-glaces, calandre, phares, pare-chocs, rétros.
  R(x + 4, y + h - 20, w - 8, 12, PAL.cyan); R(x + 5, y + h - 19, w - 10, 2, PAL.white); R(x + 6, y + h - 12, 10, 1, PAL.ink); R(x + w - 16, y + h - 12, 10, 1, PAL.ink)
  R(x + 4, y + h - 8, w - 8, 4, PAL.slate); for (let i = x + 8; i < x + w - 8; i += 4) R(i, y + h - 7, 1, 2, PAL.ink)
  R(x + 3, y + h - 7, 7, 4, PAL.yellow); R(x + w - 10, y + h - 7, 7, 4, PAL.yellow); R(x + 4, y + h - 6, 2, 2, PAL.white); R(x + w - 9, y + h - 6, 2, 2, PAL.white)
  R(x, y + h - 3, w, 3, PAL.grey2); R(x + w / 2 - 6, y + h - 3, 12, 3, PAL.white)
  R(x - 5, y + h - 24, 5, 3, PAL.ink); R(x - 5, y + h - 24, 3, 2, PAL.grey1); R(x + w, y + h - 24, 5, 3, PAL.ink); R(x + w + 2, y + h - 24, 3, 2, PAL.grey1)
  // Phares allumés quand il roule, et fumée.
  if (b.state !== 'park') {
    g.fillStyle = 'rgba(254,231,97,0.25)'; g.beginPath(); g.moveTo(x + 6, y + h); g.lineTo(x - 10, y + h + 40); g.lineTo(x + 20, y + h + 40); g.fill(); g.beginPath(); g.moveTo(x + w - 6, y + h); g.lineTo(x + w - 20, y + h + 40); g.lineTo(x + w + 10, y + h + 40); g.fill()
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(192,203,220,0.5)'; g.fillRect(x + 4 + rr(0, w - 8), y + (b.state === 'in' ? -6 - i * 7 : h + 4 + i * 7), 5, 4) }
  }
}

/* ---------- vagues : le banc, puis la presse, puis la tribune ---------- */
const WAVES = [
  { role: 'staff', n: 3, text: 'LE STAFF ENTRE EN JEU' },
  { role: 'press', n: 3, text: 'LES JOURNALISTES ENTRENT EN JEU' },
  { role: 'fan', n: 3, text: 'LES SUPPORTERS ENVAHISSENT LA PELOUSE' },
  { role: 'fan', n: 3, text: 'ENCORE DES SUPPORTERS' },
  { role: 'press', n: 2, text: 'LA PRESSE ETRANGERE' },
  { role: 'fan', n: 4, text: 'TOUT LE STADE DESCEND' },
]
function spawnIntruder(role, k) {
  const f = makeFrench(11 + S.intruders, nextLook++)
  S.intruders++
  f.intruder = true
  f.role = 'player'
  f.kind = role
  f.team = 'staff'
  f.number = 12 + S.intruders
  f.speed = role === 'fan' ? 120 + rnd() * 90 : role === 'press' ? 110 + rnd() * 40 : 140 + rnd() * 40
  const side = rnd() < 0.5
  f.x = clamp(ball.x + rr(-300, 300), FIELD.x + 20, FIELD.x + FIELD.w - 20)
  f.y = side ? FIELD.y - 30 - rr(0, 60) : FIELD.y + FIELD.h + 30 + rr(0, 60)
  f.dir = side ? 's' : 'n'
  french.push(f)
}
function updateWaves(dt) {
  if (S.phase !== 'play' && S.phase !== 'freekick') return
  if (S.koCount < 12) return // les onze premiers tombent, puis n'importe qui entre
  S.waveT -= dt
  const alive = french.filter((f) => f.state === 'play').length
  const late = S.clock > 70 || S.goals >= 2
  const crowd = S.fury > 0 || late
  if (S.waveT > 0 || alive > (crowd ? 44 : 16)) return
  const w = WAVES[Math.min(S.wave, WAVES.length - 1)]
  S.wave++
  S.waveT = crowd ? rr(1.2, 2.5) : Math.max(8, 15 - S.wave)
  const n = crowd ? w.n + 4 : w.n
  for (let k = 0; k < n; k++) { if (k % 2) spawnIntruder(w.role, k); else spawnAbsurd(ABSURD[(S.intruders + k) % ABSURD.length]) }
  if (crowd && S.wave % 3 === 0) banner('LA FOULE DESCEND SUR LA PELOUSE', PAL.pink)
  S.shake = Math.max(S.shake, 5)
}

/* ---------- ballon et buts ---------- */
function updateBall(dt) {
  if (ball.noTake > 0) ball.noTake -= dt
  if (ball.out && ball.x > FIELD.x + 2 && ball.x < FIELD.x + FIELD.w - 2 && ball.y > FIELD.y + 2 && ball.y < FIELD.y + FIELD.h - 2) ball.out = false // remis dedans par un coup franc ou autre
  if (ball.owner || S.phase === 'kickoff' || S.phase === 'card') return
  ball.x += ball.vx * dt; ball.y += ball.vy * dt
  if (ball.z > 0 || ball.vz) {
    ball.z += ball.vz * dt; ball.vz -= 900 * dt
    if (ball.z <= 0) { ball.z = 0; if (ball.vz < -120) { ball.vz = -ball.vz * 0.45; beep('bounce'); for (let i = 0; i < 4; i++) S.particles.push({ x: ball.x, y: ball.y, vx: rr(-40, 40), vy: rr(-30, -5), t: 0, life: 0.3, c: PAL.sand }) } else { ball.vz = 0; ball.air = 0 } }
  }
  if (ball.air > 0) { ball.air -= dt; ball.vx *= Math.pow(0.9, dt); ball.vy *= Math.pow(0.9, dt) } else { ball.vx *= Math.pow(0.5, dt); ball.vy *= Math.pow(0.5, dt) }
  const gy = FIELD.y + FIELD.h / 2
  if (ball.x > FIELD.x + FIELD.w - 4 && Math.abs(ball.y - gy) < GOAL_H / 2 && ball.z < 60) {
    if (S.kickedOff) { goalScored(); return }
    ball.x = FIELD.x + FIELD.w - 5; ball.vx = -Math.abs(ball.vx) * 0.4 // pas de remise en jeu, pas de but : ça ressort mollement
  }
  // Sorti : le ballon s'arrête juste derrière la ligne (il casse le panneau s'il arrive fort), et
  // un joueur vient le ramasser pour la remise en jeu.
  const out = ball.x < FIELD.x - 2 || ball.x > FIELD.x + FIELD.w + 2 || ball.y < FIELD.y - 2 || ball.y > FIELD.y + FIELD.h + 2
  if (out && ball.x > FIELD.x + FIELD.w - 4 && Math.abs(ball.y - gy) < GOAL_H / 2 && ball.z < 60 && S.kickedOff) { goalScored(); return } // derrière la ligne dans la largeur de la cage : but, cage ou pas cage
  if (out && !ball.out) {
    if (Math.hypot(ball.vx, ball.vy) > 300) hitBoard(ball)
    ball.out = true; ball.vx = ball.vy = 0; ball.vz = 0; ball.z = 0; ball.air = 0; ball.noTake = 0
    ball.x = clamp(ball.x, FIELD.x - 8, FIELD.x + FIELD.w + 8); ball.y = clamp(ball.y, FIELD.y - 8, FIELD.y + FIELD.h + 8)
    for (let i = 0; i < 5; i++) S.particles.push({ x: ball.x, y: ball.y, vx: rr(-40, 40), vy: rr(-30, -5), t: 0, life: 0.3, c: PAL.white })
  }
  // Le ballon fauche un Français qui le prend en pleine tête.
  const sp = Math.hypot(ball.vx, ball.vy)
  if (sp > 500 && ball.z < 30) for (const f of french) if (f.state === 'play' && f.stun <= 0 && dist(f, ball) < 12) { f.stun = 0.5; f.vx = ball.vx * 0.3; f.vy = ball.vy * 0.3; f.anim = 'hit'; f.ft = 0; popup(f.x, f.y - 50, 'PAF', PAL.white, true); ball.vx *= -0.4; ball.vy *= -0.4; beep('hit') }
}
function goalScored() {
  S.goals++
  ball.vx = ball.vy = 0
  ball.x = FIELD.x + FIELD.w + 14
  S.phase = 'goal'
  S.phaseT = 6 // garde-fou : si l'arbitre n'y arrive pas, on relance
  S.kickedOff = false // pas de nouveau but tant que le ballon n'a pas été remis en jeu au centre
  S.lifeLostT = 0
  S.shake = Math.max(S.shake, 10)
  const left = LIVES - S.goals
  S.goalFx = 0
  S.goalFxSub = left <= 0 ? 'C\'EST FINI' : left === 1 ? 'DERNIER BALLON !' : 'IL T\'EN RESTE ' + left
  if (left <= 0) S.endAt = 1.6
  beep('goal')
}

/* ---------- arbitre ---------- */
function updateRef(dt) {
  ref.ft += dt
  if (ref.down > 0) {
    ref.down -= dt; S.refDown = ref.down
    if (!ref.landed) {
      ref.x += ref.vx * dt; ref.y += ref.vy * dt
      ref.z += ref.vz * dt; ref.vz -= 900 * dt
      ref.x = clamp(ref.x, FIELD.x - 20, FIELD.x + FIELD.w + 30); ref.y = clamp(ref.y, FIELD.y - 30, FIELD.y + FIELD.h + 50)
      if (ref.z <= 0 && ref.vz < 0) { ref.z = 0; ref.vz = 0; ref.landed = true; ref.vx = ref.vy = 0; ref.anim = 'ko'; S.shake = Math.max(S.shake, 4); for (let i = 0; i < 6; i++) S.particles.push({ x: ref.x + rr(-8, 8), y: ref.y, vx: rr(-50, 50), vy: rr(-40, -5), t: 0, life: 0.4, c: PAL.sand }) }
    }
    ref.frame = Math.floor(ref.ft * 8)
    if (ref.down <= 0) { ref.flee = S.phase === 'goal' ? 0 : 5; ref.anim = 'run'; ref.ft = 0; ref.z = 0 }
    return
  }
  S.refDown = 0
  ref.calm -= dt
  if (ref.cardShow > 0) ref.cardShow -= dt
  if (ref.calm <= 0) ref.patience = Math.min(100, ref.patience + 4 * dt)
  let target
  const ct = ref.cardTarget
  if (ct && (ct.state === 'leaving' || (!french.includes(ct) && !npcs.includes(ct)))) ref.cardTarget = null
  else if (ct) {
    // Il accourt vers le fautif, siffle, arrête le jeu et brandit le carton. Il est frappable tout du long.
    const dx = ct.x - ref.x, dy = ct.y - ref.y, d = Math.hypot(dx, dy)
    if (d > 30) {
      ref.vx = (dx / d) * 210; ref.vy = (dy / d) * 210
      ref.x += ref.vx * dt; ref.y += ref.vy * dt
      const nd = dirOf(dx, dy); if (nd) ref.dir = nd
      if (ref.anim !== 'run') { ref.anim = 'run'; ref.ft = 0 }
      ref.frame = Math.floor(ref.ft * 8)
      ref.cardT = 0
    } else {
      ref.vx = ref.vy = 0
      const nd = dirOf(dx, dy); if (nd) ref.dir = nd
      if (ref.cardT === 0) { S.phase = 'card'; S.phaseT = 1.1; S.freeze = 0.05; beep('whistle'); ball.vx = ball.vy = 0; if (ball.owner && ball.owner !== hero) ball.owner = null; ref.ft = 0 }
      ref.cardT += dt
      ref.anim = ct.card === 1 ? 'redcard' : 'card'; ref.frame = Math.floor(ref.ft * 8)
      if (ref.cardT > 0.6) { giveCard(ct); S.phase = resumePhase() }
    }
    return
  }
  if (S.phase === 'goal') ref.flee = 0
  if (ref.flee > 0) { ref.flee -= dt; const dx = ref.x - hero.x, dy = ref.y - hero.y; const d = Math.hypot(dx, dy) || 1; target = { x: ref.x + (dx / d) * 100, y: ref.y + (dy / d) * 100 } }
  else if (S.phase === 'goal') target = ball.owner === ref ? { x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2 } : { x: ball.x, y: ball.y }
  else target = { x: ball.x - 110, y: ball.y - 80 }
  if (ref.cardShow > 0) { ref.vx = ref.vy = 0; ref.frame = Math.floor(ref.ft * 10); return }
  const dx = target.x - ref.x, dy = target.y - ref.y
  const d = Math.hypot(dx, dy)
  const sp = ref.flee > 0 ? 170 : S.phase === 'goal' ? 150 : d > 160 ? 180 : 95
  if (d > 10) { ref.vx = (dx / d) * sp; ref.vy = (dy / d) * sp } else ref.vx = ref.vy = 0
  ref.x = clamp(ref.x + ref.vx * dt, FIELD.x - 20, FIELD.x + FIELD.w + 30)
  ref.y = clamp(ref.y + ref.vy * dt, FIELD.y - 20, FIELD.y + FIELD.h + 40)
  if (S.phase === 'goal') {
    // Il va chercher le ballon au fond des filets, le ramène au centre et le pose. Pas de coupure.
    if (ball.owner !== ref && d < 16) { ball.owner = ref; ball.z = 0; ball.vz = 0; ball.out = false; ball.vx = ball.vy = 0 }
    if (ball.owner === ref) { ball.x = ref.x + (ref.dir.includes('w') ? -10 : 10); ball.y = ref.y + 2; ball.vx = ball.vy = 0; if (d < 12) { ball.owner = null; ball.x = FIELD.x + FIELD.w / 2; ball.y = FIELD.y + FIELD.h / 2; S.phase = 'play'; S.kickedOff = true; ball.noTake = 0.4; beep('whistle') } }
  }
  const moving = Math.hypot(ref.vx, ref.vy) > 15
  const nd = dirOf(ref.vx, ref.vy)
  if (moving && nd) ref.dir = nd
  const anim = moving ? (sp > 100 ? 'run' : 'walk') : 'idle'
  if (anim !== ref.anim) { ref.anim = anim; ref.ft = 0 }
  ref.frame = Math.floor(ref.ft * (moving ? 8 : 4))
}

/* ---------- boucle ---------- */
function startMatch() {
  S.goalFx = undefined
  Object.assign(S, { phase: 'kickoff', t: 0, clock: 0, added: 0, addedShown: false, score: 0, fouls: 0, bigFouls: 0, goals: 0, yellows: 0, reds: 0, refHits: 0, maxCombo: 1, fires: 0, evac: 0, koCount: 0, teamDoneAt: 0, combo: 0, comboT: 0, comboAt: 0, tier: 1, fuego: 0, fire: 0, fury: 0, furyCharge: 0, furies: 0, hitStopCd: 0, shakeCd: 0, lastPts: 0, lastPtsT: 9, chains: 0, busUsed: false, bus: null, busHits: 0, refDown: 0, wave: 0, waveT: 14, intruders: 0, stopAll: 0, popups: [], banners: [], particles: [], debris: [], log: [], shake: 0, freeze: 0 })
  Object.assign(ref, { patience: 100, calm: 0, down: 0, flee: 0, hits: 0, strict: 0, anim: 'idle', cardTarget: null, cardT: 0, cardShow: 0 })
  Object.assign(hero, { act: null, chain: 0, stun: 0, anim: 'stance', z: 0, vz: 0 })
  subsUsed = 0
  nextLook = 0
  resetTeam()
  makeProps()
  kickoff()
  startMusic()
  S.cam.x = clamp(hero.x - W / 2, 0, FIELD.x * 2 + FIELD.w - W); S.cam.y = clamp(hero.y - H / 2, 0, FIELD.y * 2 + FIELD.h - H)
  beep('whistle')
}
function update(dt) {
  if (S.phase === 'end') { S.endT = (S.endT || 0) + dt; S.t += dt; S.shake *= Math.pow(0.02, dt); attackPressed = false; if (restartPressed) { restartPressed = false; if (S.endT > 2) startMatch() } return }
  if (S.phase === 'title') { restartPressed = false; if (attackPressed) { attackPressed = false; startMatch() } return }
  if (S.paused) { attackPressed = false; return }
  S.hitStopCd -= dt; S.shakeCd -= dt; S.lastPtsT += dt
  if (S.freeze > 0) { S.freeze -= dt; attackPressed = false; settleAir(dt * 0.5); return }
  S.t += dt
  if (S.phase === 'play' || S.phase === 'freekick' || S.phase === 'card' || S.phase === 'goal') S.clock += dt
  S.lifeLostT = (S.lifeLostT || 9) + dt
  if (S.goalFx !== undefined) { S.goalFx += dt; if (S.goalFx > 1) S.goalFx = undefined }
  if (S.endAt !== undefined) { S.endAt -= dt; if (S.endAt <= 0) { S.endAt = undefined; endMatch(); return } }
  if (S.phase === 'kickoff' || S.phase === 'goal') { S.phaseT -= dt; if (S.phaseT <= 0) { if (S.phase === 'goal') { if (ball.owner === ref) ball.owner = null; kickoff() } else { S.phase = 'play'; ball.owner = french[9] } } }
  if (S.phase === 'kickoff' && S.goals) { S.phase = 'play'; ball.owner = nearestFrench(ball, 120, (f) => !f.gk) }
  if (S.phase === 'card') { S.phaseT -= dt; if (S.phaseT <= 0 && !ref.cardTarget) S.phase = resumePhase() }
  if (!S.kickedOff && S.phase === 'play') { S.phase = 'goal'; S.phaseT = Math.max(S.phaseT, 3) } // filet de sécurité : jamais de jeu sans remise en jeu
  if (S.phase === 'freekick') { S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = resumePhase(); const taker = nearestFrench(ball, 80, (f) => !f.gk); if (taker && S.phase === 'play') ball.owner = taker } }
  if (attackPressed) { attackPressed = false; heroAttack() }
  updateHero(dt)
  updateBall(dt)
  updateBus(dt)
  if (S.stopAll > 0) { S.stopAll -= dt; settleAir(dt) }
  else { updateFrench(dt); updateRef(dt); updateNpcs(dt); updateWaves(dt) }
  for (const d of S.debris) { if (d.t < 0) continue; d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 300 * dt; if (d.t > 0.6) { d.t = -1; d.vx = d.vy = 0 } }
  // Combo, feu.
  S.comboAt += dt
  if (S.comboT > 0 && S.fire <= 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 0; S.tier = 1 } }
  if (S.fury > 0) { S.fury -= dt; S.fire = Math.max(S.fire, S.fury); if (S.fury <= 0) { banner('FIN DE LA FURIE', PAL.grey1); S.fire = 0 } }
  if (S.fire > 0) { S.fire -= dt; if (S.fire <= 0) { banner('FIN DU FEU', PAL.grey1); S.furyCharge = 0 } }
  else S.fuego = Math.max(0, S.fuego - 2 * dt)
  // Effets.
  for (const p of S.popups) p.t += dt
  S.popups = S.popups.filter((p) => p.t < 0.7)
  if (S.popups.length > 14) S.popups.splice(0, S.popups.length - 14)
  for (const b of S.banners) b.t += dt
  S.banners = S.banners.filter((b) => b.t < 1.8)
  if (S.banners.length > 2) S.banners.splice(0, S.banners.length - 2)
  for (const p of S.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt }
  S.particles = S.particles.filter((p) => p.t < p.life)
  if (S.particles.length > 240) S.particles.splice(0, S.particles.length - 240)
  if (S.debris.length > 160) S.debris.splice(0, S.debris.length - 160)
  S.shake = Math.min(10, S.shake) * Math.pow(0.02, dt)
  // Caméra : suit le ballon, tirée vers le héros.
  // Caméra accrochée au n°4, toujours au centre, avec un léger retard lissé de quelques pixels.
  const tx = hero.x + hero.vx * 0.05 - W / 2, ty = hero.y + hero.vy * 0.05 - H / 2
  const k = 1 - Math.pow(0.001, dt) // ~63 % du chemin en 0,14 s, jamais saccadé
  S.cam.x += (clamp(tx, 0, FIELD.x * 2 + FIELD.w - W) - S.cam.x) * k
  S.cam.y += (clamp(ty, 0, FIELD.y * 2 + FIELD.h - H) - S.cam.y) * k
}
function endMatch() {
  S.phase = 'end'
  S.final = S.score
  const best = Number(localStorage.getItem('carton.record') || 0)
  S.newRecord = S.final > best
  S.record = Math.max(best, S.final)
  S.endT = 0; S.stampShake = undefined
  localStorage.setItem('carton.record', String(S.record))
  beep('whistle')
}

/* ---------- rendu ---------- */
const g = canvas.getContext('2d')
g.imageSmoothingEnabled = false
let fontReady = false
function text(t, x, y, { size = 8, color = PAL.white, align = 'left', shadow = true } = {}) {
  g.font = `bold ${size}px monospace`
  g.textAlign = align
  g.textBaseline = 'top'
  if (shadow) { g.fillStyle = PAL.ink; g.fillText(t, x + 1, y + 1) }
  g.fillStyle = color
  g.fillText(t, x, y)
}
function drawPitch() {
  const cx = -Math.round(S.cam.x), cy = -Math.round(S.cam.y)
  g.fillStyle = PAL.greenD
  g.fillRect(0, 0, W, H)
  // Pelouse à bandes.
  for (let x = 0; x < FIELD.w + 2 * FIELD.x; x += 40) { g.fillStyle = Math.floor(x / 40) % 2 ? PAL.green : PAL.greenL; g.fillRect(x + cx, cy, 40, FIELD.h + 2 * FIELD.y) }
  // Lignes.
  g.strokeStyle = PAL.white
  g.lineWidth = 2
  g.strokeRect(FIELD.x + cx, FIELD.y + cy, FIELD.w, FIELD.h)
  g.beginPath(); g.moveTo(FIELD.x + FIELD.w / 2 + cx, FIELD.y + cy); g.lineTo(FIELD.x + FIELD.w / 2 + cx, FIELD.y + FIELD.h + cy); g.stroke()
  g.beginPath(); g.ellipse(FIELD.x + FIELD.w / 2 + cx, FIELD.y + FIELD.h / 2 + cy, 70, 52, 0, 0, Math.PI * 2); g.stroke()
  g.strokeRect(FIELD.x + cx, FIELD.y + FIELD.h / 2 - 200 + cy, 165, 400)
  g.strokeRect(FIELD.x + FIELD.w - 165 + cx, FIELD.y + FIELD.h / 2 - 200 + cy, 165, 400)
  if (false) for (const side of [0, 1]) {
    const gx = side ? FIELD.x + FIELD.w + cx : FIELD.x + cx - 28
    const gy = FIELD.y + FIELD.h / 2 - GOAL_H / 2 + cy
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.fillRect(gx, gy, 28, GOAL_H)
    g.strokeStyle = PAL.grey1
    g.lineWidth = 1
    for (let i = 0; i <= 28; i += 6) { g.beginPath(); g.moveTo(gx + i, gy); g.lineTo(gx + i, gy + GOAL_H); g.stroke() }
    for (let j = 0; j <= GOAL_H; j += 6) { g.beginPath(); g.moveTo(gx, gy + j); g.lineTo(gx + 28, gy + j); g.stroke() }
    g.fillStyle = PAL.white
    g.fillRect(side ? gx - 2 : gx + 26, gy - 2, 4, GOAL_H + 4)
  }
}
function drawShadow(x, y, rx = 12) { g.fillStyle = 'rgba(24,20,37,0.22)'; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), rx, 4, 0, 0, Math.PI * 2); g.fill() }
function drawFlame(x, y, t, fury = false) {
  // Aura en briques derrière le n°4 : goutte, langues, particules. Dorée et deux fois plus haute en furie.
  const F = fury ? [PAL.amber, PAL.yellow, PAL.yellow, PAL.white, PAL.white] : [PAL.redD, PAL.red, PAL.orange, PAL.amber, PAL.yellow]
  const fr = Math.floor(t * 12) % 4
  const span = fury ? 24 : 16
  for (let i = -span; i <= span; i += 2) {
    const h = (fury ? 44 : 26) + 10 * Math.abs(Math.sin(i * 0.4 + fr)) + (Math.abs(i) < 6 ? (fury ? 26 : 14) : 0)
    for (let j = 0; j < h; j += 2) {
      const d = Math.min(Math.abs(i) / span, 1) * 0.6 + (j / h) * 0.6
      const c = F[clamp(4 - Math.floor(d * 5), 0, 4)]
      g.fillStyle = c
      g.fillRect(Math.round(x + i), Math.round(y - 4 - j), 2, 2)
    }
  }
}
/** Accessoires des absurdes, dessinés au-dessus du pantin recoloré. */
function drawOverlay(kind, x, y) {
  const hx = x, hy = y - 36 // centre de la tête
  if (kind === 'banane') { g.strokeStyle = PAL.yellow; g.lineWidth = 4; g.beginPath(); g.arc(hx, hy, 11, Math.PI * 0.75, Math.PI * 2.25); g.stroke(); g.fillStyle = PAL.clay; g.fillRect(hx - 2, hy - 18, 3, 6) }
  else if (kind === 'echarpe') { for (let i = 0; i < 3; i++) { g.fillStyle = [PAL.blue, PAL.white, PAL.red][i]; g.fillRect(hx - 7 + i * 5, hy + 9, 5, 3) } g.fillStyle = PAL.red; g.fillRect(hx + 5, hy + 12, 3, 8) }
  else if (kind === 'casquette') { g.fillStyle = PAL.red; g.fillRect(hx - 7, hy - 11, 14, 4); g.fillRect(hx - 1, hy - 8, 11, 2) }
  else if (kind === 'poule') { g.fillStyle = PAL.red; g.fillRect(hx - 4, hy - 14, 3, 4); g.fillRect(hx - 1, hy - 16, 3, 6); g.fillRect(hx + 2, hy - 14, 3, 4); g.fillStyle = PAL.amber; g.fillRect(hx - 2, hy - 1, 5, 3) }
  else if (kind === 'mascotte') { g.fillStyle = PAL.ink; g.beginPath(); g.arc(hx, hy - 2, 13, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.blue; g.beginPath(); g.arc(hx, hy - 2, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.white; g.fillRect(hx - 7, hy - 6, 5, 5); g.fillRect(hx + 2, hy - 6, 5, 5); g.fillStyle = PAL.ink; g.fillRect(hx - 5, hy - 4, 2, 2); g.fillRect(hx + 4, hy - 4, 2, 2); g.fillStyle = PAL.red; g.fillRect(hx - 3, hy - 17, 2, 4); g.fillRect(hx, hy - 19, 2, 6); g.fillRect(hx + 3, hy - 17, 2, 4); g.fillStyle = PAL.amber; g.fillRect(hx - 2, hy + 2, 4, 3) }
  else if (kind === 'casque') { g.fillStyle = PAL.ink; g.beginPath(); g.arc(hx, hy - 3, 10, Math.PI, Math.PI * 2); g.fill(); g.fillRect(hx - 10, hy - 3, 20, 3); g.fillStyle = PAL.cyan; g.globalAlpha = 0.6; g.fillRect(hx - 8, hy - 1, 16, 7); g.globalAlpha = 1 }
  else if (kind === 'censure') { g.fillStyle = PAL.ink; g.fillRect(hx - 8, y - 16, 16, 6) }
  else if (kind === 'chignon') { g.fillStyle = PAL.grey1; g.beginPath(); g.arc(hx, hy - 12, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.grey2; g.fillRect(hx - 1, hy - 13, 2, 2) }
}
const koOff = (name) => (ATLAS[name] && ATLAS[name].koOff !== undefined ? ATLAS[name].koOff : 22)
function drawCard(x, y, blink) { g.fillStyle = PAL.ink; g.fillRect(x - 4, y - 6, 8, 11); g.fillStyle = blink ? PAL.white : PAL.yellow; g.fillRect(x - 3, y - 5, 6, 9); g.fillStyle = PAL.white; g.fillRect(x - 3, y - 5, 6, 1) }
function drawStars(x, y, t, n = 3) {
  for (let k = 0; k < n; k++) {
    const a = (t * 1.5 + (k / n) * Math.PI * 2)
    const sx = Math.round(x + Math.cos(a) * 12), sy = Math.round(y + Math.sin(a) * 4)
    g.fillStyle = Math.sin(a) >= 0 ? PAL.yellow : PAL.amber
    g.fillRect(sx - 2, sy, 5, 1); g.fillRect(sx, sy - 2, 1, 5)
    g.fillStyle = PAL.white; g.fillRect(sx, sy, 1, 1)
  }
}
function render() {
  g.save()
  if (S.shake > 0.5) g.translate(Math.round(rr(-S.shake, S.shake)), Math.round(rr(-S.shake, S.shake)))
  drawPitch()
  const cx = -Math.round(S.cam.x), cy = -Math.round(S.cam.y)
  if (S.phase === 'title') { g.restore(); drawTitle(); return }
  // Débris au sol, puis tri par profondeur de tout ce qui est debout (joueurs, staff, décor).
  for (const d of S.debris) { g.fillStyle = d.color; g.fillRect(Math.round(d.x + cx), Math.round(d.y + cy), 3, 2) }
  const ents = [...french, ...npcs, ref, hero]
  for (const p of props) ents.push({ isProp: true, p, y: p.y + p.h, x: p.x })
  if (S.bus) ents.push({ isBus: true, b: S.bus, y: S.bus.y + BUS.h / 2, x: S.bus.x })
  const flat = (e) => !e.isProp && (e.state === 'ko' || e.state === 'fade' || (e === ref && ref.landed && ref.down > 0))
  ents.sort((a, b) => (flat(a) ? 0 : 1) - (flat(b) ? 0 : 1) || a.y - b.y)
  // Ombres et marquage.
  if (S.bus) { g.fillStyle = 'rgba(24,20,37,0.25)'; const r = busRect(S.bus); g.fillRect(Math.round(r.x + cx + 4), Math.round(r.y + cy + 6), r.w, r.h) }
  for (const e of ents) if (!e.isProp && !e.isBus && e.state !== 'ko' && e.state !== 'fade' && !(e === ref && ref.landed && ref.down > 0)) drawShadow(e.x + cx, e.y + cy + 1, Math.max(6, (e.state === 'fall' ? 14 : 12) - (e.z || 0) * 0.15))
  drawShadow(ball.x + cx, ball.y + cy + 2, Math.max(2, 4 - (ball.z || 0) / 40))
  if (S.fire > 0) drawFlame(hero.x + cx, hero.y + cy - (hero.z || 0), S.t, S.fury > 0)
  for (const e of ents) {
    if (e.isProp) { drawProp(e.p, cx, cy); continue }
    if (e.isBus) { drawBus(e.b, cx, cy); continue }
    if (e.state === 'ko') { drawSprite(g, e.atlas, 'ko', e.koDir || e.dir, 0, e.x + cx, e.y + cy - koOff(e.atlas)); drawStars(e.x + cx, e.y + cy - 30, S.t); continue }
    if (e.state === 'fade') { g.globalAlpha = clamp((Math.floor(e.ft * 24) % 2 ? 0.15 : 0.9) * Math.min(1, e.fadeT / 0.5 + 0.2), 0, 1); drawSprite(g, e.atlas, 'ko', e.koDir || e.dir, 0, e.x + cx, e.y + cy - koOff(e.atlas)); g.globalAlpha = 1; continue }
    if (e.state === 'fall') { const z = e.z || 0; if (z > 2) { g.save(); g.translate(e.x + cx, e.y + cy - z); g.rotate(Math.sin(e.ft * 9) * 0.5); drawSprite(g, e.atlas, 'knocked', e.dir, e.frame, 0, 0); g.restore() } else drawSprite(g, e.atlas, z > 0 ? 'knocked' : 'fall', e.dir, e.frame, e.x + cx, e.y + cy - z); continue }
    if (e === ref && ref.down > 0) { if (!ref.landed) { g.save(); g.translate(e.x + cx, e.y + cy - ref.z); g.rotate(Math.sin(e.ft * 9) * 0.6); drawSprite(g, 'arbitre', 'fall', e.dir, e.frame, 0, 0); g.restore() } else { drawSprite(g, 'arbitre', 'ko', e.dir, 0, e.x + cx, e.y + cy - 22); drawStars(e.x + cx, e.y + cy - 30, S.t) } continue }
    let anim = e.anim
    if (e === hero && hero.act && hero.act !== 'tackle') anim = hero.act === 'ballthrow' ? 'throw' : hero.act
    drawSprite(g, e === hero && S.fury > 0 && ATLAS['paraguay-furie'] ? 'paraguay-furie' : e.atlas, anim, e.dir, e.frame, e.x + cx, e.y + cy - (e.z || 0))
    if (e.card === 1) drawCard(e.x + cx, e.y + cy - 58 + Math.round(Math.sin(S.t * 6 + e.cardBob)), dist(e, hero) < 60 && Math.floor(S.t * 6) % 2 === 0)
    if (e.stun > 0 && e.team === 'fra') drawStars(e.x + cx, e.y + cy - 52, S.t, 2)
  }
  // Ballon.
  { const z = ball.z || 0, r = 4 + Math.min(3, z / 40); g.fillStyle = PAL.white; g.beginPath(); g.arc(ball.x + cx, ball.y + cy - 3 - z, r, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.ink; g.fillRect(ball.x + cx - 1, ball.y + cy - 4 - z, 2, 2) }
  // Particules et popups.
  for (const p of S.particles) { g.fillStyle = p.c; g.fillRect(Math.round(p.x + cx), Math.round(p.y + cy), 2, 2) }
  for (const p of S.popups) { const k = p.t < 0.1 ? 1 + (0.1 - p.t) * 8 : 1; text(p.text, Math.round(p.x + cx), Math.round(p.y + cy - p.t * 16), { size: Math.round((p.big ? 16 : 11) * k), color: p.color, align: 'center' }) }
  if (DEBUG) {
    g.strokeStyle = PAL.cyan
    for (const e of ents) { g.beginPath(); g.arc(e.x + cx, e.y + cy, 40, 0, Math.PI * 2); if (e === hero) g.stroke() }
    text(`phase ${S.phase} combo ${S.combo} x${comboMult()} fuego ${S.fuego | 0} patience ${ref.patience | 0} owner ${ball.owner ? ball.owner.number : '-'}`, 4, H - 10, { size: 7 })
  }
  g.restore()
  drawHUD()
  if (S.phase === 'end') drawEnd()
}
function panel(x, y, w, h, accent) {
  g.fillStyle = 'rgba(24,20,37,0.82)'; g.fillRect(x, y, w, h)
  g.fillStyle = PAL.slate; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h)
  if (accent) { g.fillStyle = accent; g.fillRect(x, y, 3, h) }
}
/** Texte cerné d'encre, lisible sur la pelouse sans bandeau. */
function outlined(t, x, y, { size = 10, color = PAL.white, align = 'center' } = {}) {
  g.font = `bold ${size}px monospace`; g.textAlign = align; g.textBaseline = 'top'
  g.fillStyle = PAL.ink
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 2], [2, 0]]) g.fillText(t, x + dx, y + dy)
  g.fillStyle = color; g.fillText(t, x, y)
}
function flag(x, y, cols) { cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * 3, y, 3, 7) }); g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, 11, 1); g.fillRect(x - 1, y + 7, 11, 1) }
function segments(x, y, w, h, n, frac, on, off = PAL.slateD) {
  const sw = (w - (n - 1)) / n
  for (let i = 0; i < n; i++) { g.fillStyle = i < Math.round(frac * n) ? on : off; g.fillRect(Math.round(x + i * (sw + 1)), y, Math.floor(sw), h) }
}
function drawGoalFx(t) {
  const bh = Math.round(H * 0.25), by = Math.round(H / 2 - bh / 2)
  // 0 → 0,1 s : la bande entre par la gauche ; 0,75 → 0,95 s : elle sort par la droite.
  const slideIn = Math.min(1, t / 0.1), slideOut = t > 0.75 ? Math.min(1, (t - 0.75) / 0.2) : 0
  const ox = Math.round(-W * (1 - slideIn) + W * slideOut)
  const jitter = t < 0.3 ? Math.round(rr(-3, 3)) : 0
  g.save(); g.translate(ox, jitter)
  g.fillStyle = PAL.ink; g.fillRect(-4, by - 3, W + 8, bh + 6)
  const cols = [PAL.blue, PAL.white, PAL.red]
  for (let i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.fillRect(0, by + Math.round((bh / 3) * i), W, Math.ceil(bh / 3)) }
  // Rayures diagonales qui défilent, pour que ça vibre.
  g.fillStyle = 'rgba(24,20,37,0.18)'
  for (let x = -bh + ((t * 600) % 24); x < W + bh; x += 24) { g.beginPath(); g.moveTo(x, by); g.lineTo(x + 12, by); g.lineTo(x + 12 - bh, by + bh); g.lineTo(x - bh, by + bh); g.fill() }
  // Le mot s'écrase : énorme puis à sa taille en 0,12 s, et il tremble.
  const k = t < 0.12 ? 1 + (0.12 - t) * 14 : 1
  const size = Math.round(bh * 0.62 * k)
  g.font = `bold ${size}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'
  const txt = 'BUUUUUT !!!'
  const cx = W / 2 + (t < 0.3 ? Math.round(rr(-4, 4)) : 0), cy = by + bh / 2 - 4
  g.fillStyle = PAL.ink
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [2, -2], [-2, 2], [0, 5], [4, 4]]) g.fillText(txt, cx + dx, cy + dy)
  g.fillStyle = t < 0.2 && Math.floor(t * 40) % 2 ? PAL.white : PAL.yellow
  g.fillText(txt, cx, cy)
  if (t > 0.25) outlined(S.goalFxSub || '', W / 2, by + bh - 14, { size: 9, color: PAL.white })
  g.restore()
}
function drawHUD() {
  // Tableau d'affichage, en haut à gauche : chrono qui monte, et nos trois ballons de vie.
  panel(6, 6, 172, 28, S.goals >= 2 ? PAL.red : PAL.yellow)
  const mm = Math.floor(S.clock / 60), ss = Math.floor(S.clock % 60)
  text(`${mm}:${String(ss).padStart(2, '0')}`, 16, 12, { size: 14, color: PAL.yellow })
  flag(72, 15, [PAL.blue, PAL.white, PAL.red]); text('FRA ' + S.goals, 86, 14, { size: 8, color: PAL.grey1 })
  for (let i = 0; i < LIVES; i++) {
    const alive = i < LIVES - S.goals
    const justLost = !alive && i === LIVES - S.goals && S.lifeLostT < 0.6
    const bx = 128 + i * 16, by = 20
    const r = justLost ? 6 + Math.round((0.6 - S.lifeLostT) * 8) : 6
    g.fillStyle = PAL.ink; g.beginPath(); g.arc(bx, by, r + 1, 0, Math.PI * 2); g.fill()
    g.fillStyle = alive ? PAL.white : justLost && Math.floor(S.t * 12) % 2 ? PAL.red : PAL.slate; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill()
    if (alive) { g.fillStyle = PAL.ink; g.fillRect(bx - 1, by - 2, 3, 3); g.fillRect(bx - 4, by + 1, 2, 2); g.fillRect(bx + 3, by + 1, 2, 2); g.fillRect(bx - 1, by - 6, 2, 2) }
    else if (!justLost) { g.fillStyle = PAL.slateD; g.fillRect(bx - 4, by - 1, 8, 2) }
  }
  // Score, en haut à droite : points, fautes, état de l'équipe de France.
  panel(W - 178, 6, 172, 28, PAL.amber)
  text(String(S.score).padStart(7, '0'), W - 12, 10, { size: 14, color: PAL.yellow, align: 'right' })
  text('FAUTES ' + S.fouls, W - 170, 24, { size: 7, color: PAL.grey1 })
  if (S.lastPtsT < 0.8 && S.lastPts) text('+' + S.lastPts, W - 12, 25, { size: 7, color: PAL.white, align: 'right' })
  panel(W - 178, 36, 172, 14)
  const bench = npcs.filter((n) => n.role === 'sub').length
  text('FRANCE', W - 170, 39, { size: 7, color: PAL.grey2 })
  segments(W - 128, 40, 66, 6, 22, Math.min(22, S.koCount) / 22, S.koCount >= 22 ? PAL.orange : PAL.red, PAL.blueD)
  text(S.teamDoneAt ? 'KO EN ' + S.teamDoneAt.toFixed(0) + 'S' : 'BANC ' + bench, W - 12, 39, { size: 7, color: S.teamDoneAt ? PAL.orange : PAL.grey1, align: 'right' })
  // Combo, au centre : gros multiplicateur cerné, palier, crans et anneau de temps.
  if (S.combo > 0) {
    const m = comboMult()
    const pop = Math.max(0, 1 - S.comboAt * 5)
    const col = m >= 5 ? PAL.orange : m >= 4 ? PAL.red : m >= 3 ? PAL.amber : m >= 2 ? PAL.yellow : PAL.white
    const cx = W / 2, cy = 30
    const frac = S.fire > 0 ? 1 : S.comboT / (3.2 - m * 0.35)
    // Anneau de temps.
    g.lineWidth = 4; g.strokeStyle = PAL.ink; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke()
    g.lineWidth = 2; g.strokeStyle = PAL.slate; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke()
    g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke()
    g.fillStyle = 'rgba(24,20,37,0.85)'; g.beginPath(); g.arc(cx, cy, 23, 0, Math.PI * 2); g.fill()
    if (pop > 0) { g.fillStyle = col; g.globalAlpha = pop * 0.5; g.beginPath(); g.arc(cx, cy, 23 + pop * 10, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1 }
    outlined(`×${m}`, cx, cy - 11 - Math.round(pop * 3), { size: Math.round(22 + pop * 8), color: pop > 0.6 ? PAL.white : col })
    // Palier et crans vers le suivant, sous l'anneau.
    const next = COMBO_STEPS[Math.min(m, COMBO_STEPS.length - 1)]
    const prev = COMBO_STEPS[m - 1]
    const f2 = m >= 5 ? 1 : (S.combo - prev) / Math.max(1, next - prev)
    const label = m >= 5 ? 'CARTON PLEIN' : TIERS[m - 1] || 'COMBO'
    const lw = label.length * 6 + 10
    g.fillStyle = col; g.fillRect(cx - lw / 2, 58, lw, 11)
    text(label, cx, 60, { size: 8, color: PAL.ink, align: 'center', shadow: false })
    for (let i = 0; i < 10; i++) { const on = i < Math.round(f2 * 10); g.fillStyle = PAL.ink; g.fillRect(cx - 40 + i * 8, 71, 7, 5); g.fillStyle = on ? col : PAL.slate; g.fillRect(cx - 39 + i * 8, 72, 5, 3) }
    text(S.combo + ' FAUTES', cx, 78, { size: 7, color: PAL.grey1, align: 'center' })
  }
  // FUEGO / FURIE, en bas à gauche.
  const furyOn = S.fury > 0, fireOn = S.fire > 0
  panel(6, H - 30, 172, 24, furyOn ? PAL.white : fireOn ? PAL.yellow : PAL.orange)
  text(furyOn ? 'FURIE' : fireOn ? 'FURIE ?' : 'FUEGO', 16, H - 25, { size: 9, color: furyOn ? (Math.floor(S.t * 10) % 2 ? PAL.white : PAL.yellow) : fireOn ? PAL.yellow : PAL.orange })
  segments(72, H - 23, 98, 10, 12, furyOn ? S.fury / 12 : fireOn ? S.furyCharge / 100 : S.fuego / 100, furyOn ? PAL.white : fireOn ? PAL.yellow : PAL.orange)
  if (fireOn && !furyOn) text('EN FEU ' + Math.ceil(S.fire) + 'S', 72, H - 11 - 1, { size: 6, color: PAL.orange })
  // Le bus : trois crans d'enchaînement, puis prêt.
  if (!S.busUsed || S.bus) {
    panel(W / 2 - 52, H - 24, 104, 18, PAL.cyan)
    const ready = S.chains >= 3 && !S.busUsed
    text(S.bus ? 'BUS ' + (S.bus.state === 'park' ? Math.ceil(BUS.park - S.bus.t) + 'S' : '') : ready ? (Math.floor(S.t * 3) % 2 ? 'BUS PRET' : 'BAS BAS') : 'BUS', W / 2 - 44, H - 19, { size: 7, color: ready ? PAL.cyan : PAL.grey1 })
    if (!S.bus) segments(W / 2 + 4, H - 18, 44, 6, 3, S.chains / 3, PAL.cyan)
    else segments(W / 2 + 4, H - 18, 44, 6, 10, S.bus.state === 'park' ? 1 - S.bus.t / BUS.park : 1, PAL.cyan)
  }
  // Arbitre, en bas à droite.
  panel(W - 178, H - 30, 172, 24, ref.patience <= 0 ? PAL.red : ref.patience > 40 ? PAL.green : PAL.amber)
  text('ARBITRE', W - 168, H - 25, { size: 9, color: ref.patience <= 0 ? PAL.red : PAL.grey1 })
  segments(W - 108, H - 23, 96, 10, 10, ref.patience / 100, ref.patience > 40 ? PAL.green : ref.patience > 0 ? PAL.amber : PAL.red)
  if (ref.patience <= 0 && Math.floor(S.t * 4) % 2) text('IL CRAQUE', W - 60, H - 21, { size: 8, color: PAL.white, align: 'center' })
  if (S.goalFx !== undefined) drawGoalFx(S.goalFx)
  // Bandeaux : texte cerné, sans bande, qui glisse depuis le haut.
  S.banners.forEach((b, i) => {
    const a = b.t < 0.15 ? b.t / 0.15 : b.t > 1.4 ? (1.8 - b.t) / 0.4 : 1
    g.globalAlpha = clamp(a, 0, 1)
    outlined(b.text, W / 2, 96 + i * 18 - Math.round((1 - Math.min(1, b.t / 0.15)) * 10), { size: 11, color: b.color })
    g.globalAlpha = 1
  })
  // Tactile : joystick et bouton.
  if (touch.joy) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(touch.joy.x, touch.joy.y, 24, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(touch.joy.x + touch.jx * 24, touch.joy.y + touch.jy * 24, 8, 0, Math.PI * 2); g.fill() }
  // Repère de l'arbitre quand il est hors champ.
  { const rx = ref.x - S.cam.x, ry = ref.y - S.cam.y - 30
    if (rx < 0 || rx > W || ry < 0 || ry > H) { const px = clamp(rx, 30, W - 30), py = clamp(ry, 56, H - 40); outlined('ARBITRE', px, py - 4, { size: 7, color: PAL.amber }) } }
  if (S.phase === 'card' && ref.cardTarget) outlined('JEU ARRETE', W / 2, H / 2 - 40, { size: 12, color: PAL.yellow })
  if (S.paused) outlined('PAUSE', W / 2, H / 2 - 8, { size: 16 })
}
function drawTitle() {
  g.fillStyle = 'rgba(24,20,37,0.75)'
  g.fillRect(0, 0, W, H)
  text('FC MMA', W / 2, 52, { size: 40, color: PAL.yellow, align: 'center' })
  text('FRANCE – PARAGUAY, COUPE DU MONDE 2026', W / 2, 92, { size: 8, color: PAL.amber, align: 'center' })
  text('UN PARAGUAYEN. ONZE FRANCAIS. ZERO INTENTION DE JOUER AU BALLON.', W / 2, 108, { size: 8, color: PAL.grey1, align: 'center' })
  text('FLECHES : BOUGER   ESPACE / CLIC DROIT : FRAPPER', W / 2, 140, { size: 9, align: 'center' })
  text('LOIN = TACLE GLISSE     COLLE = POING, GENOU, PIED, PROJECTION', W / 2, 156, { size: 9, align: 'center' })
  text('3 ENCHAINEMENTS COMPLETS = LE BUS. DOUBLE BAS POUR LE GARER DEVANT TON BUT.', W / 2, 168, { size: 8, color: PAL.cyan, align: 'center' })
  text('TROIS BALLONS DE VIE : AU TROISIEME BUT ENCAISSE, C\'EST FINI.', W / 2, 180, { size: 8, color: PAL.grey1, align: 'center' })
  text('FAIS UN MAXIMUM DE DEGATS AVANT. LA FRANCE ACCELERE AVEC LE TEMPS.', W / 2, 192, { size: 8, color: PAL.grey1, align: 'center' })
  text("QUAND L'ARBITRE CRAQUE, UNE GROSSE FAUTE = CARTON POUR LA FRANCE", W / 2, 206, { size: 8, color: PAL.grey1, align: 'center' })
  const blink = Math.floor(performance.now() / 500) % 2 === 0
  if (blink) text('ESPACE POUR COMMENCER', W / 2, 250, { size: 12, color: PAL.yellow, align: 'center' })
  text('RECORD ' + (localStorage.getItem('carton.record') || 0), W / 2, 300, { size: 8, color: PAL.grey2, align: 'center' })
  drawSprite(g, 'paraguay', 'stance', 's', Math.floor(performance.now() / 120), W / 2 - 160, 300)
  drawSprite(g, 'france-0', 'ko', 'e', 0, W / 2 + 160, 290)
}
function drawEnd() {
  // Panneau récap : il se déplie, puis les lignes tombent une à une, puis le tampon claque.
  const T = S.endT || 0
  const open = Math.min(1, T / 0.35)
  const pw = W - 100, ph = Math.round((H - 40) * open)
  const px = 50, py = Math.round((H - ph) / 2)
  g.fillStyle = 'rgba(24,20,37,0.6)'; g.fillRect(0, 0, W, H)
  g.fillStyle = PAL.ink; g.fillRect(px - 2, py - 2, pw + 4, ph + 4)
  g.fillStyle = PAL.slateD; g.fillRect(px, py, pw, ph)
  g.fillStyle = PAL.red; g.fillRect(px, py, pw, 3)
  if (open < 1) return
  // En-tête.
  text('FIN DU MATCH', px + 14, py + 10, { size: 14, color: PAL.yellow })
  text('FRANCE ' + S.goals + ' - 0 PARAGUAY', W - 64, py + 12, { size: 9, color: PAL.grey1, align: 'right' })
  for (let i = 0; i < LIVES; i++) { const bx = px + 150 + i * 14, by = py + 18; g.fillStyle = PAL.ink; g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.slate; g.beginPath(); g.arc(bx, by, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.ink; g.fillRect(bx - 3, by - 1, 6, 2) }
  text('TROIS BUTS ENCAISSES. TEMPS TENU ' + Math.floor(S.clock / 60) + ':' + String(Math.floor(S.clock % 60)).padStart(2, '0'), px + 14, py + 30, { size: 7, color: PAL.grey2 })
  g.fillStyle = PAL.slate; g.fillRect(px + 10, py + 42, pw - 20, 1)
  // Deux colonnes de dégâts, qui apparaissent une par une.
  const left = [
    ['Fautes sifflees', S.fouls], ['Grosses fautes', S.bigFouls], ["Fautes sur l'arbitre", S.refHits],
    ['Francais defonces', S.koCount + ' / 22'], ['Equipe entiere en', S.teamDoneAt ? S.teamDoneAt.toFixed(1) + ' s' : '-'],
  ]
  const right = [
    ['Cartons jaunes', S.yellows], ['Cartons rouges', S.reds], ['Combo maximum', '×' + S.maxCombo],
    ['Boosts EN FEU', S.fires], ['Furies', S.furies],
  ]
  if (S.busHits) right.push(['Ecrases par le bus', S.busHits])
  const colW = (pw - 40) / 2
  const row = (k, v, x, y, i) => {
    if (T < 0.45 + i * 0.08) return
    const pop = Math.max(0, 1 - (T - (0.45 + i * 0.08)) * 6)
    text(k.toUpperCase(), x, y, { size: 7, color: PAL.grey1 })
    text(String(v), x + colW - 8, y - Math.round(pop * 3), { size: 9, color: pop > 0.5 ? PAL.yellow : PAL.white, align: 'right' })
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y + 11, colW - 8, 1)
  }
  left.forEach(([k, v], i) => row(k, v, px + 16, py + 50 + i * 15, i))
  right.forEach(([k, v], i) => row(k, v, px + 28 + colW, py + 50 + i * 15, i + 5))
  // Score, record, tampon.
  if (T > 1.3) {
    const pop = Math.max(0, 1 - (T - 1.3) * 4)
    g.fillStyle = PAL.ink; g.fillRect(px + 10, py + 132, pw - 20, 30)
    g.fillStyle = PAL.yellow; g.fillRect(px + 10, py + 132, 3, 30)
    text('DEGATS', px + 22, py + 138, { size: 10, color: PAL.yellow })
    text(String(S.final).padStart(7, '0'), W - 64, py + 134 - Math.round(pop * 4), { size: Math.round(16 + pop * 8), color: PAL.yellow, align: 'right' })
    text(S.final >= S.record && S.final > 0 && S.newRecord ? 'NOUVEAU RECORD !' : 'RECORD ' + S.record, px + 22, py + 152, { size: 7, color: S.newRecord ? PAL.orange : PAL.grey2 })
  }
  if (T > 1.7) {
    const k = Math.max(0, 1 - (T - 1.7) * 5)
    const stamp = S.final < 15000 ? 'FAIR-PLAY' : S.final < 40000 ? 'RUGUEUX' : S.final < 80000 ? 'BOUCHER' : S.final < 150000 ? 'CARTON PLEIN' : 'LEGENDE DU GUARANI'
    if (k > 0 && S.stampShake === undefined) { S.stampShake = 1; S.shake = Math.max(S.shake, 8); beep('hit') }
    g.save(); g.translate(W / 2, py + ph - 56); g.rotate(-0.12); g.scale(1 + k * 1.5, 1 + k * 1.5); g.globalAlpha = 1 - k * 0.5
    g.strokeStyle = PAL.red; g.lineWidth = 3; g.strokeRect(-100, -14, 200, 28)
    text(stamp, 0, -8, { size: 14, color: PAL.red, align: 'center', shadow: false })
    g.restore()
  }
  if (T > 2) {
    const b = RESTART_BTN, hot = Math.floor(S.t * 2) % 2 === 0
    g.fillStyle = PAL.ink; g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4)
    g.fillStyle = hot ? PAL.yellow : PAL.amber; g.fillRect(b.x, b.y, b.w, b.h)
    g.fillStyle = PAL.orange; g.fillRect(b.x, b.y + b.h - 3, b.w, 3)
    text('RECOMMENCER', W / 2, b.y + 7, { size: 10, color: PAL.ink, align: 'center', shadow: false })
    text('OU ESPACE', W / 2, b.y + b.h + 4, { size: 6, color: PAL.grey2, align: 'center' })
  }
}

/* ---------- démarrage ---------- */
let last = performance.now()
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  try { update(dt); render() } catch (e) { console.error(e) }
  requestAnimationFrame(frame)
}
function fit() {
  const k = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)))
  canvas.style.width = W * k + 'px'
  canvas.style.height = H * k + 'px'
}
addEventListener('resize', fit)
fit()
Promise.all(['paraguay', 'arbitre', 'gardien', 'france-0', 'banane', 'echarpe', 'supporter', 'poule', 'mascotte', 'crs', 'streaker', 'mamie', 'hotdog', 'marie', 'mariee', 'commentateur', 'pigeon', 'cheval', 'civiere', 'ramasseur', 'president', 'musicien', 'dino'].map(loadAtlas)).then(() => {
  fontReady = true
  // Le n°4 en furie : même atlas, teinté or.
  { const a = ATLAS.paraguay; const c = document.createElement('canvas'); c.width = a.img.width; c.height = a.img.height; const k = c.getContext('2d'); k.drawImage(a.img, 0, 0); k.globalCompositeOperation = 'source-atop'; k.fillStyle = 'rgba(254,231,97,0.55)'; k.fillRect(0, 0, c.width, c.height); ATLAS['paraguay-furie'] = { ...a, img: c } }
  window.__carton = { S, hero, ref, ball, startMatch, foul, beep, audio, music, get french() { return french }, get props() { return props }, get npcs() { return npcs } }
  requestAnimationFrame(frame)
}).catch((e) => { document.body.innerHTML = '<pre style="color:#fff">Sprites introuvables : ' + e + '</pre>' })
