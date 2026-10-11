/*
 * CARTON PLEIN — prototype jouable. France – Paraguay, Coupe du monde 2026. Tu es le dernier
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
const MATCH_SECONDS = 90
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
function beep(kind) {
  if (audio.muted) return
  try {
    if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)()
    const c = audio.ctx
    const t = c.currentTime
    const o = c.createOscillator()
    const gn = c.createGain()
    o.connect(gn)
    gn.connect(c.destination)
    if (kind === 'whistle') { o.type = 'square'; o.frequency.setValueAtTime(2200, t); o.frequency.linearRampToValueAtTime(2600, t + 0.05); gn.gain.setValueAtTime(0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.start(t); o.stop(t + 0.35) }
    else if (kind === 'hit') { o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); gn.gain.setValueAtTime(0.25, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.start(t); o.stop(t + 0.15) }
    else if (kind === 'card') { o.type = 'triangle'; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.1); gn.gain.setValueAtTime(0.15, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.start(t); o.stop(t + 0.4) }
    else if (kind === 'fire') { o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(640, t + 0.5); gn.gain.setValueAtTime(0.2, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.start(t); o.stop(t + 0.7) }
    else if (kind === 'goal') { o.type = 'square'; o.frequency.setValueAtTime(330, t); o.frequency.setValueAtTime(440, t + 0.12); o.frequency.setValueAtTime(550, t + 0.24); gn.gain.setValueAtTime(0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.start(t); o.stop(t + 0.6) }
  } catch (e) { /* pas de son */ }
}

/* ---------- état ---------- */
const S = {
  phase: 'title', // title | play | kickoff | freekick | goal | end
  t: 0, clock: 0, added: 0, addedShown: false,
  score: 0, fouls: 0, bigFouls: 0, goals: 0, yellows: 0, reds: 0, refHits: 0, maxCombo: 1, fires: 0, evac: 0,
  combo: 0, comboT: 0, comboAt: 0, tier: 1, fuego: 0, fire: 0, refDown: 0, wave: 0, waveT: 14, intruders: 0, stopAll: 0,
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
  return { x: 0, y: 0, vx: 0, vy: 0, dir: 'e', anim: 'idle', frame: 0, ft: 0, team: 'fra', gk, slot: i, atlas: gk ? 'gardien' : 'france-' + (look % 11), number: gk ? 1 : 2 + i, hp: 3, stun: 0, down: 0, state: 'play', card: 0, r: 10, speed: 135 + rnd() * 50, z: 0, vz: 0, jx: rr(-36, 36), jy: rr(-28, 28), phase: rnd() * Math.PI * 2, spin: rr(0.5, 1.1) * (rnd() < 0.5 ? -1 : 1), cardBob: rnd() * 6, sub: false, fly: null }
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
  S.phaseT = S.goals ? 0.5 : 0.9
  ball.x = FIELD.x + FIELD.w / 2
  ball.y = FIELD.y + FIELD.h / 2
  ball.vx = ball.vy = 0
  ball.z = ball.vz = 0; ball.air = 0
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
addEventListener('keydown', (e) => {
  if (e.repeat) return
  keys[e.code] = true
  if (e.code === 'Space' || e.code === 'Enter') { attackPressed = true; e.preventDefault() }
  if (e.code === 'KeyP') S.paused = !S.paused
  if (e.code === 'KeyM') { audio.muted = !audio.muted; localStorage.setItem('carton.muted', audio.muted ? '1' : '0') }
})
addEventListener('keyup', (e) => { keys[e.code] = false })
addEventListener('contextmenu', (e) => e.preventDefault())
addEventListener('mousedown', (e) => { if (e.button === 2 || S.phase === 'title' || S.phase === 'end') attackPressed = true })
const canvas = document.getElementById('c')
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return
  const r = canvas.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * W
  const y = ((e.clientY - r.top) / r.height) * H
  if (x < W / 2) touch.joy = { id: e.pointerId, x, y }
  else { touch.btn = true; touch.btnId = e.pointerId; attackPressed = true }
  if (S.phase === 'title' || S.phase === 'end') attackPressed = true
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
  if (S.fire > 0) { pts *= 2; mods.push('FEU') }
  if (S.clock > RUN) { pts *= 2; mods.push('ARRETS DE JEU') }
  if (S.refDown > 0 && name !== "FAUTE SUR L'ARBITRE") { pts *= 0.5; mods.push('PAS VU') }
  if (extra.penalty) { pts += 250; mods.push('PENALTY') }
  S.combo++
  S.comboT = 3
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
  const vx = victim ? victim.x : hero.x, vy = victim ? victim.y : hero.y
  const bam = def.big ? 'BOOM' : rnd() < 0.5 ? 'BAM' : 'BIM'
  popup(vx + rr(-6, 6), vy - 56, bam, def.big ? PAL.orange : m >= 3 ? PAL.yellow : PAL.white, def.big || m >= 4)
  S.log.push({ t: S.clock, name, pts })
  // Arbitre : patience et cartons.
  if (S.refDown <= 0 && name !== "FAUTE SUR L'ARBITRE" && !def.noWhistle) {
    ref.patience = Math.max(0, ref.patience - (def.big ? 18 : 8) * (ref.strict || 1))
    ref.calm = 5
    if (ref.patience <= 0 && def.big && victim && victim.team === 'fra' && !ref.cardTarget) startCard(victim)
  }
  S.freeze = Math.max(S.freeze, def.big ? 0.08 : 0.04)
  S.shake = Math.max(S.shake, def.big ? 6 : 3)
  if (def.noWhistle) { beep('hit'); return }
  beep('whistle')
  if (victim && victim.team === 'fra') freeKick(vx, vy, victim)
}
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
function freeKick(x, y, victim) {
  if (S.phase !== 'play' || ref.cardTarget) return
  S.phase = 'freekick'
  S.phaseT = 0.7
  ball.vx = ball.vy = 0
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
  props.push({ kind: 'bench', x: FIELD.x + FIELD.w / 2 - 150, y: FIELD.y + FIELD.h + 34, w: 130, h: 16, hp: 1 })
  props.push({ kind: 'cooler', x: FIELD.x + FIELD.w / 2 - 20, y: FIELD.y + FIELD.h + 36, w: 12, h: 14, hp: 1 })
  props.push({ kind: 'camera', x: FIELD.x + FIELD.w / 2 + 60, y: FIELD.y - 44, w: 14, h: 22, hp: 1 })
  // Remplaçants assis, sélectionneur, kiné.
  for (let i = 0; i < 3; i++) npcs.push({ ...makeFrench(5, nextLook++), x: FIELD.x + FIELD.w / 2 - 130 + i * 44, y: FIELD.y + FIELD.h + 44, team: 'staff', role: 'sub', dir: 'n', anim: 'idle' })
  npcs.push({ ...makeFrench(5, 10), x: FIELD.x + FIELD.w / 2 + 40, y: FIELD.y + FIELD.h + 46, team: 'staff', role: 'coach', atlas: 'france-10', dir: 'w', anim: 'idle', speed: 70, name: 'LE SELECTIONNEUR' })
  npcs.push({ ...makeFrench(5, 8), x: FIELD.x + FIELD.w / 2 + 120, y: FIELD.y + FIELD.h + 46, team: 'staff', role: 'kine', atlas: 'france-8', dir: 'w', anim: 'idle', speed: 150, name: 'LE KINE' })
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
    if (n.stun > 0) { n.stun -= dt; n.x += n.vx * dt; n.y += n.vy * dt; n.vx *= 0.85; n.vy *= 0.85; n.frame = Math.floor(n.ft * 10); continue }
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
  if (f.team === 'staff') name = f.role === 'sub' ? 'FAUTE SUR LE BANC' : f.role === 'press' ? 'FAUTE SUR UN JOURNALISTE' : f.role === 'fan' ? 'FAUTE SUR UN SUPPORTER' : 'FAUTE SUR LE STAFF'
  else if (f.gk && name !== "FAUTE SUR L'ARBITRE") name = 'FAUTE SUR LE GARDIEN'
  f.hp -= 1
  f.stun = 0.45
  f.anim = 'hit'; f.frame = 0; f.ft = 0
  if (ball.owner === f) { ball.owner = null; ball.vx = (f.x - hero.x) * 2; ball.vy = (f.y - hero.y) * 2 }
  const dx = f.x - hero.x, dy = f.y - hero.y
  const d = Math.hypot(dx, dy) || 1
  const air = knock || (throwIt ? 300 : name === 'COUP DE PIED' ? 240 : name === 'PIED SAUTE' || name === 'COUP DE BOULE' ? 280 : 0)
  const push = air ? 220 + air * 0.4 : 120
  f.vx = (dx / d) * push; f.vy = (dy / d) * push
  foul(name, f, { penalty: inBox(f) })
  if (f.hp <= 0 || throwIt || air) knockDown(f, air ? 0.9 : 0.35, air)
  for (let i = 0; i < 6; i++) S.particles.push({ x: f.x, y: f.y - 30, vx: rr(-60, 60), vy: rr(-80, -20), t: 0, life: 0.5, c: i % 2 ? PAL.yellow : PAL.white })
  beep('hit')
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
function updateFall(f, dt) {
  f.fly -= dt
  f.x += f.vx * dt; f.y += f.vy * dt
  if (f.vz || f.z > 0) {
    f.z += f.vz * dt; f.vz -= 900 * dt
    if (f.z <= 0 && f.vz < 0) { f.z = 0; f.vz = 0; f.vx *= 0.4; f.vy *= 0.4; S.shake = Math.max(S.shake, 4); for (let i = 0; i < 6; i++) S.particles.push({ x: f.x + rr(-8, 8), y: f.y, vx: rr(-50, 50), vy: rr(-40, -5), t: 0, life: 0.4, c: PAL.sand }) }
  } else { f.vx *= 0.92; f.vy *= 0.92 }
  f.frame = Math.floor(f.ft * 10)
  dominoes(f)
  f.x = clamp(f.x, FIELD.x - 30, FIELD.x + FIELD.w + 30)
  f.y = clamp(f.y, FIELD.y - 40, FIELD.y + FIELD.h + 60)
  if (f.fly <= 0 && f.z <= 0) { f.state = 'ko'; f.anim = 'ko'; f.frame = 0; f.koDir = f.dir; f.vx = f.vy = 0 }
}
function inBox(p) { return (p.x < FIELD.x + 165 || p.x > FIELD.x + FIELD.w - 165) && Math.abs(p.y - (FIELD.y + FIELD.h / 2)) < 200 }
function heroAttack() {
  if (hero.act || hero.stun > 0) return
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
    hero.chain = step + 1
    hero.chainT = 0.9
    hero.dir = dirOf(f.x - hero.x, f.y - hero.y) || hero.dir
    hero.hitTarget = f
    hero.hitDone = false
  } else {
    hero.act = 'tackle'
    hero.actT = 0.3
    hero.tackled = new Set()
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
  const speed = hero.speed * (S.fire > 0 ? 1.6 : 1)
  if (hero.stun > 0) { hero.stun -= dt; hero.vx = hero.vy = 0 }
  else if (hero.act === 'tackle') {
    hero.vx = hero.tvx; hero.vy = hero.tvy
    hero.x += hero.vx * dt; hero.y += hero.vy * dt
    for (const f of [...french, ...npcs]) {
      if (f.state !== 'play' || hero.tackled.has(f)) continue
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
      if (hero.tackled.size === 0 && !hero.propHit) { hero.stun = 0.22; S.combo = Math.floor(S.combo / 2); S.tier = comboMult(); popup(hero.x, hero.y - 50, 'GLISSADE', PAL.grey1) }
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
    if (hero.actT <= 0) hero.act = null
  } else {
    hero.vx = v.dx * speed; hero.vy = v.dy * speed
    hero.x += hero.vx * dt; hero.y += hero.vy * dt
    const d = dirOf(v.dx, v.dy)
    if (d) hero.dir = d
    if (S.fire > 0) for (const f of french) if (f.state === 'play' && f.stun <= 0 && dist(hero, f) < 24) { hitFrench(f, 'PERCUTE'); f.vx *= 2.5; f.vy *= 2.5 }
    if (S.fire > 0) hitProps('tackle')
    // Le ballon à portée : on le ramasse et on le balance loin, comme une brute.
    const wants = v.dx || v.dy // c'est le n°4 qui va au ballon, jamais l'inverse
    if ((S.phase === 'play' || S.phase === 'freekick') && wants && (ball.z || 0) < 12 && dist(hero, ball) < 22 && ball.owner !== hero) {
      const o = ball.owner
      if (o && o !== hero) { o.stun = 0.5; o.anim = 'hit'; o.ft = 0; o.vx = (o.x - hero.x) * 4; o.vy = (o.y - hero.y) * 4; foul('VOL DE BALLON', o) }
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
  S.refDown = 2
  ref.down = 2
  ref.patience = 0
  ref.anim = 'fall'; ref.frame = 0; ref.ft = 0
  if (ref.cardTarget) { popup(ref.x, ref.y - 66, 'IL NE DIRA RIEN', PAL.grey1, true); ref.cardTarget = null; if (S.phase === 'card') S.phase = 'play' }
  ref.cardShow = 0
  foul("FAUTE SUR L'ARBITRE", null)
  if (ref.hits >= 3 && !ref.strict) { ref.strict = 1.25; banner('LE 4E ARBITRE PREND LE SIFFLET', PAL.grey1); S.evac++ }
}

/* ---------- Français (IA de foot) ---------- */
function updateFrench(dt) {
  const goal = { x: FIELD.x + FIELD.w + 6, y: FIELD.y + FIELD.h / 2 }
  const regroup = S.phase === 'freekick' || S.phase === 'kickoff'
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
      if (Math.abs(f.y - ty) < 4) substitute(f)
      continue
    }
    if (f.state === 'fall') { updateFall(f, dt); continue }
    if (f.state === 'ko') {
      // Personne ne se relève tant que le n°4 rôde : les corps s'empilent.
      if (dist(f, hero) > 70) f.down -= dt
      if (f.down <= 0) { f.state = 'play'; f.hp = 3; f.anim = 'idle'; f.stun = 0.3; f.evac = (f.evac || 0) + 1; if (f.evac >= 2) { f.evac = 0; S.evac++; substitute(f, true) } }
      continue
    }
    if (f.stun > 0) {
      f.stun -= dt
      f.x += f.vx * dt; f.y += f.vy * dt
      f.vx *= 0.85; f.vy *= 0.85
      f.frame = Math.floor(f.ft * 10)
      continue
    }
    if (frozen) { f.vx = f.vy = 0; f.anim = 'idle'; f.frame = Math.floor(f.ft * 4); if (ref.cardTarget) { const nd = dirOf(ref.x - f.x, ref.y - f.y); if (nd && dist(f, ref) < 160) f.dir = nd } continue }
    // Cible de déplacement.
    let target
    const carrier = ball.owner === f
    if (regroup) {
      const near = french.filter((g) => g.state === 'play' && !g.gk).sort((a, b) => dist(a, ball) - dist(b, ball)).slice(0, 4)
      target = near.includes(f) ? { x: ball.x + (f.slot % 2 ? -1 : 1) * (16 + (f.slot % 3) * 14), y: ball.y + ((f.slot % 4) - 1.5) * 16 } : slotPos(f, ball.x)
    } else if (carrier) {
      target = { x: goal.x, y: goal.y + (f.slot % 2 ? -30 : 30) }
      f.holdT = (f.holdT || 0) + dt
      // Il conduit un peu, puis passe (vite si le n°4 approche), et tire dès qu'il est dans la surface.
      const threat = dist(hero, f)
      const mates = french.filter((g) => g !== f && g.state === 'play' && !g.gk && g.role !== 'fan' && g.role !== 'press' && dist(g, hero) > 70 && g.x > f.x - 80 && dist(g, f) > 50 && dist(g, f) < 320)
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
      const chasers = french.filter((g) => g.state === 'play' && !g.gk && g.role !== 'fan' && g.role !== 'press').sort((a, b) => dist(a, ball) - dist(b, ball)).slice(0, 2)
      target = chasers.includes(f) ? { x: ball.x + ball.vx * 0.25, y: ball.y + ball.vy * 0.25 } : slotPos(f, ball.x)
    } else target = slotPos(f, ball.x)
    if (f.intruder && !carrier && !regroup) {
      if (f.role === 'fan') target = { x: ball.x + Math.cos(S.t * f.spin + f.phase) * 150, y: ball.y + Math.sin(S.t * f.spin + f.phase) * 95 } // ils tournent autour du ballon en chantant
      else if (f.role === 'press') target = { x: hero.x + Math.cos(f.phase + S.t * 0.2) * 120, y: hero.y + Math.sin(f.phase + S.t * 0.2) * 80 } // ils suivent le n°4 à distance
      else if (f.role === 'staff') { const ko = french.find((g) => g.state === 'ko'); if (ko) target = { x: ko.x + 18, y: ko.y + 4 } } // ils vont voir les blessés
    }
    if (!carrier && !regroup) { target = { x: target.x + f.jx, y: target.y + f.jy } }
    if (f.gk) target = { x: FIELD.x + 30, y: clamp(ball.y, FIELD.y + FIELD.h / 2 - 50, FIELD.y + FIELD.h / 2 + 50) }
    // Évitement léger du n°4 pour les non-porteurs.
    const dh = dist(f, hero)
    if (!carrier && dh < 56 && !regroup) { target = { x: f.x + (f.x - hero.x) * 2, y: f.y + (f.y - hero.y) * 2 } }
    const dx = target.x - f.x, dy = target.y - f.y
    const d = Math.hypot(dx, dy)
    const sp = f.speed * (carrier ? 0.95 : 1) * (regroup ? 1.3 : 1)
    if (d > 6) { f.vx = (dx / d) * sp; f.vy = (dy / d) * sp } else { f.vx = f.vy = 0 }
    // Séparation entre Français.
    for (const g of french) if (g !== f && g.state === 'play') { const dd = dist(f, g); if (dd < 26 && dd > 0) { f.vx += ((f.x - g.x) / dd) * 110; f.vy += ((f.y - g.y) / dd) * 110 } }
    f.x += f.vx * dt; f.y += f.vy * dt
    f.x = clamp(f.x, FIELD.x + 8, FIELD.x + FIELD.w - 8)
    f.y = clamp(f.y, FIELD.y + 8, FIELD.y + FIELD.h - 8)
    const moving = Math.hypot(f.vx, f.vy) > 15
    const nd = dirOf(f.vx, f.vy)
    if (moving && nd) f.dir = nd
    const anim = moving ? 'run' : 'idle'
    if (anim !== f.anim) { f.anim = anim; f.ft = 0 }
    f.frame = Math.floor(f.ft * (moving ? 8 : 4))
    // Prise de balle.
    if (!regroup && !ball.owner && dist(f, ball) < 14 && !f.gk && (ball.z || 0) < 10) { ball.owner = f; f.holdT = 0 }
    if (carrier && ball.owner === f) { const nx = clamp(f.x + (f.vx || 60) * 0.12, FIELD.x + 6, FIELD.x + FIELD.w - 6), ny = f.y + f.vy * 0.12 + 6; ball.x = nx; ball.y = ny; ball.vx = ball.vy = 0; ball.z = Math.min(ball.z || 0, 4) }
  }
}
function pass(from, to) {
  ball.owner = null
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
  S.shots = (S.shots || 0) + 1
  const ty = goal.y + rr(-GOAL_H / 2 - 50, GOAL_H / 2 + 50)
  const dx = goal.x + 30 - from.x, dy = ty - from.y
  const d = Math.hypot(dx, dy) || 1
  ball.vx = (dx / d) * 680; ball.vy = (dy / d) * 680
  from.stun = 0.2
}
function substitute(f, stretcher = false) {
  const idx = french.indexOf(f)
  const n = makeFrench(f.slot, nextLook++)
  subsUsed++
  n.sub = subsUsed > 5
  n.x = FIELD.x + FIELD.w / 2 + rr(-100, 100)
  n.y = f.y < FIELD.y + FIELD.h / 2 ? FIELD.y - 40 : FIELD.y + FIELD.h + 40
  n.number = f.number
  french[idx] = n
  if (stretcher) banner('EVACUE SUR CIVIERE, REMPLACANT N°' + (12 + subsUsed), PAL.grey1)
  else banner(n.sub ? 'LA FRANCE FAIT ENTRER N’IMPORTE QUI' : 'REMPLACANT N°' + (12 + subsUsed), PAL.grey1)
}

/* ---------- vagues : le banc, puis la presse, puis la tribune ---------- */
const WAVES = [
  { role: 'sub', n: 2, text: 'LE BANC ENTRE EN JEU' },
  { role: 'staff', n: 2, text: 'LE STAFF ENTRE EN JEU' },
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
  f.role = role
  f.team = role === 'sub' ? 'fra' : 'staff'
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
  S.waveT -= dt
  const alive = french.filter((f) => f.state === 'play').length
  if (S.waveT > 0 || alive > 19) return
  const w = WAVES[Math.min(S.wave, WAVES.length - 1)]
  S.wave++
  S.waveT = Math.max(8, 15 - S.wave)
  banner(w.text, w.role === 'fan' ? PAL.pink : PAL.grey1)
  for (let k = 0; k < w.n; k++) spawnIntruder(w.role, k)
  S.shake = Math.max(S.shake, 5)
}

/* ---------- ballon et buts ---------- */
function updateBall(dt) {
  if (ball.owner || S.phase === 'goal' || S.phase === 'kickoff' || S.phase === 'card') return
  ball.x += ball.vx * dt; ball.y += ball.vy * dt
  if (ball.z > 0 || ball.vz) {
    ball.z += ball.vz * dt; ball.vz -= 900 * dt
    if (ball.z <= 0) { ball.z = 0; if (ball.vz < -120) { ball.vz = -ball.vz * 0.45; for (let i = 0; i < 4; i++) S.particles.push({ x: ball.x, y: ball.y, vx: rr(-40, 40), vy: rr(-30, -5), t: 0, life: 0.3, c: PAL.sand }) } else { ball.vz = 0; ball.air = 0 } }
  }
  if (ball.air > 0) { ball.air -= dt; ball.vx *= Math.pow(0.9, dt); ball.vy *= Math.pow(0.9, dt) } else { ball.vx *= Math.pow(0.5, dt); ball.vy *= Math.pow(0.5, dt) }
  const gy = FIELD.y + FIELD.h / 2
  if (ball.x > FIELD.x + FIELD.w - 4 && Math.abs(ball.y - gy) < GOAL_H / 2 && ball.z < 40 && ball.vx >= 0) { goalScored(); return }
  if (ball.x > FIELD.x + FIELD.w + 20) { ball.x = FIELD.x + FIELD.w + 20; ball.vx = -Math.abs(ball.vx) }
  // Les panneaux renvoient le ballon, fort : ça rebondit dans tous les sens.
  if (ball.x < FIELD.x + 4) { ball.x = FIELD.x + 4; ball.vx = Math.abs(ball.vx) * 0.7; hitBoard(ball) }
  if (ball.x > FIELD.x + FIELD.w - 4 && !(Math.abs(ball.y - gy) < GOAL_H / 2 && ball.z < 40)) { ball.x = FIELD.x + FIELD.w - 4; ball.vx = -Math.abs(ball.vx) * 0.7; hitBoard(ball) }
  if (ball.y < FIELD.y + 4) { ball.y = FIELD.y + 4; ball.vy = Math.abs(ball.vy) * 0.7; hitBoard(ball) }
  if (ball.y > FIELD.y + FIELD.h - 4) { ball.y = FIELD.y + FIELD.h - 4; ball.vy = -Math.abs(ball.vy) * 0.7; hitBoard(ball) }
  // Le ballon fauche un Français qui le prend en pleine tête.
  const sp = Math.hypot(ball.vx, ball.vy)
  if (sp > 500 && ball.z < 30) for (const f of french) if (f.state === 'play' && f.stun <= 0 && dist(f, ball) < 12) { f.stun = 0.5; f.vx = ball.vx * 0.3; f.vy = ball.vy * 0.3; f.anim = 'hit'; f.ft = 0; popup(f.x, f.y - 50, 'PAF', PAL.white, true); ball.vx *= -0.4; ball.vy *= -0.4; beep('hit') }
}
function goalScored() {
  S.goals++
  ball.vx = ball.vy = 0
  ball.x = FIELD.x + FIELD.w + 14
  S.phase = 'goal'
  S.phaseT = 0.6
  banner('BUT POUR LA FRANCE (SANS IMPORTANCE)', PAL.grey1)
  beep('goal')
}

/* ---------- arbitre ---------- */
function updateRef(dt) {
  ref.ft += dt
  if (ref.down > 0) { ref.down -= dt; S.refDown = ref.down; ref.frame = Math.floor(ref.ft * 8); if (ref.down <= 0) { ref.flee = 5; ref.anim = 'run'; ref.ft = 0 } return }
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
      if (ref.cardT > 0.6) { giveCard(ct); S.phase = 'play' }
    }
    return
  }
  if (ref.flee > 0) { ref.flee -= dt; const dx = ref.x - hero.x, dy = ref.y - hero.y; const d = Math.hypot(dx, dy) || 1; target = { x: ref.x + (dx / d) * 100, y: ref.y + (dy / d) * 100 } }
  else target = ref.patience <= 0 ? { x: hero.x - 70, y: hero.y - 40 } : { x: ball.x - 50, y: ball.y - 60 }
  if (ref.cardShow > 0) { ref.vx = ref.vy = 0; ref.frame = Math.floor(ref.ft * 10); return }
  const dx = target.x - ref.x, dy = target.y - ref.y
  const d = Math.hypot(dx, dy)
  const sp = ref.flee > 0 ? 170 : d > 120 ? 190 : 110
  if (d > 10) { ref.vx = (dx / d) * sp; ref.vy = (dy / d) * sp } else ref.vx = ref.vy = 0
  ref.x = clamp(ref.x + ref.vx * dt, FIELD.x + 10, FIELD.x + FIELD.w - 10)
  ref.y = clamp(ref.y + ref.vy * dt, FIELD.y + 10, FIELD.y + FIELD.h - 10)
  const moving = Math.hypot(ref.vx, ref.vy) > 15
  const nd = dirOf(ref.vx, ref.vy)
  if (moving && nd) ref.dir = nd
  const anim = moving ? (sp > 100 ? 'run' : 'walk') : 'idle'
  if (anim !== ref.anim) { ref.anim = anim; ref.ft = 0 }
  ref.frame = Math.floor(ref.ft * (moving ? 8 : 4))
}

/* ---------- boucle ---------- */
function startMatch() {
  Object.assign(S, { phase: 'kickoff', t: 0, clock: 0, added: 0, addedShown: false, score: 0, fouls: 0, bigFouls: 0, goals: 0, yellows: 0, reds: 0, refHits: 0, maxCombo: 1, fires: 0, evac: 0, combo: 0, comboT: 0, comboAt: 0, tier: 1, fuego: 0, fire: 0, refDown: 0, wave: 0, waveT: 14, intruders: 0, stopAll: 0, popups: [], banners: [], particles: [], debris: [], log: [], shake: 0, freeze: 0 })
  Object.assign(ref, { patience: 100, calm: 0, down: 0, flee: 0, hits: 0, strict: 0, anim: 'idle', cardTarget: null, cardT: 0, cardShow: 0 })
  Object.assign(hero, { act: null, chain: 0, stun: 0, anim: 'stance', z: 0, vz: 0 })
  subsUsed = 0
  nextLook = 0
  resetTeam()
  makeProps()
  kickoff()
  beep('whistle')
}
function update(dt) {
  if (S.phase === 'title' || S.phase === 'end') { if (attackPressed) { attackPressed = false; startMatch() } return }
  if (S.paused) { attackPressed = false; return }
  if (S.freeze > 0) { S.freeze -= dt; attackPressed = false; return }
  S.t += dt
  const total = RUN + S.added
  if (S.phase === 'play' || S.phase === 'freekick' || S.phase === 'card') S.clock += dt
  if (S.clock >= total) { endMatch(); return }
  if (!S.addedShown && S.clock >= RUN * 0.94) { S.addedShown = true; S.added = Math.min(15, Math.floor(S.fouls / 6)); banner('TEMPS ADDITIONNEL : +' + S.added + ' (' + S.fouls + ' FAUTES)', PAL.grey1) }
  if (S.phase === 'kickoff' || S.phase === 'goal') { S.phaseT -= dt; if (S.phaseT <= 0) { if (S.phase === 'goal') kickoff(); else { S.phase = 'play'; ball.owner = french[9] } } }
  if (S.phase === 'card') { S.phaseT -= dt; if (S.phaseT <= 0 && !ref.cardTarget) S.phase = 'play' }
  if (S.phase === 'freekick') { S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = 'play'; const taker = nearestFrench(ball, 80, (f) => !f.gk); if (taker) ball.owner = taker } }
  if (attackPressed) { attackPressed = false; heroAttack() }
  updateHero(dt)
  updateBall(dt)
  if (S.stopAll > 0) S.stopAll -= dt
  else { updateFrench(dt); updateRef(dt); updateNpcs(dt); updateWaves(dt) }
  for (const d of S.debris) { if (d.t < 0) continue; d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 300 * dt; if (d.t > 0.6) { d.t = -1; d.vx = d.vy = 0 } }
  // Combo, feu.
  S.comboAt += dt
  if (S.comboT > 0 && S.fire <= 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 0; S.tier = 1 } }
  if (S.fire > 0) { S.fire -= dt; if (S.fire <= 0) { banner('FIN DU FEU', PAL.grey1) } }
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
  S.shake *= Math.pow(0.02, dt)
  // Caméra : suit le ballon, tirée vers le héros.
  const kb = S.stopAll > 0 ? 0.8 : 0.45
  const tx = ball.x * kb + hero.x * (1 - kb) - W / 2, ty = ball.y * kb + hero.y * (1 - kb) - H / 2
  S.cam.x += (clamp(tx, 0, FIELD.x * 2 + FIELD.w - W) - S.cam.x) * Math.min(1, dt * 6)
  S.cam.y += (clamp(ty, 0, FIELD.y * 2 + FIELD.h - H) - S.cam.y) * Math.min(1, dt * 6)
}
function endMatch() {
  S.phase = 'end'
  S.final = S.score + (S.goals * 0) + 100 * S.added
  const best = Number(localStorage.getItem('carton.record') || 0)
  S.record = Math.max(best, S.final)
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
function drawFlame(x, y, t) {
  // Aura en briques derrière le n°4 : goutte, langues, particules.
  const F = [PAL.redD, PAL.red, PAL.orange, PAL.amber, PAL.yellow]
  const fr = Math.floor(t * 12) % 4
  for (let i = -16; i <= 16; i += 2) {
    const h = 26 + 10 * Math.abs(Math.sin(i * 0.4 + fr)) + (Math.abs(i) < 6 ? 14 : 0)
    for (let j = 0; j < h; j += 2) {
      const d = Math.min(Math.abs(i) / 16, 1) * 0.6 + (j / h) * 0.6
      const c = F[clamp(4 - Math.floor(d * 5), 0, 4)]
      g.fillStyle = c
      g.fillRect(Math.round(x + i), Math.round(y - 4 - j), 2, 2)
    }
  }
}
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
  ents.sort((a, b) => a.y - b.y)
  // Ombres et marquage.
  for (const e of ents) if (!e.isProp && e.state !== 'ko') drawShadow(e.x + cx, e.y + cy + 1, Math.max(6, (e.state === 'fall' ? 14 : 12) - (e.z || 0) * 0.15))
  drawShadow(ball.x + cx, ball.y + cy + 2, Math.max(2, 4 - (ball.z || 0) / 40))
  if (S.fire > 0) drawFlame(hero.x + cx, hero.y + cy - (hero.z || 0), S.t)
  for (const e of ents) {
    if (e.isProp) { drawProp(e.p, cx, cy); continue }
    if (e.state === 'ko') { drawSprite(g, e.atlas, 'ko', e.koDir || e.dir, 0, e.x + cx, e.y + cy - 22); drawStars(e.x + cx, e.y + cy - 30, S.t); continue }
    if (e.state === 'fall') { const z = e.z || 0; if (z > 2) { g.save(); g.translate(e.x + cx, e.y + cy - z); g.rotate(Math.sin(e.ft * 9) * 0.5); drawSprite(g, e.atlas, 'knocked', e.dir, e.frame, 0, 0); g.restore() } else drawSprite(g, e.atlas, z > 0 ? 'knocked' : 'fall', e.dir, e.frame, e.x + cx, e.y + cy - z); continue }
    let anim = e.anim
    if (e === hero && hero.act && hero.act !== 'tackle') anim = hero.act === 'ballthrow' ? 'throw' : hero.act
    drawSprite(g, e.atlas, anim, e.dir, e.frame, e.x + cx, e.y + cy - (e.z || 0))
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
function drawHUD() {
  // Tableau d'affichage.
  g.fillStyle = 'rgba(24,20,37,0.85)'
  g.fillRect(6, 6, 150, 20)
  const t = Math.min(S.clock, RUN + S.added)
  const minute = Math.floor((t / RUN) * 90)
  text(`${String(minute).padStart(2, '0')}'${S.clock > RUN ? '+' : ''}`, 12, 12, { color: PAL.yellow })
  text(`FRA ${S.goals}  PAR 0`, 56, 12, { color: PAL.grey1 })
  // Score.
  g.fillStyle = 'rgba(24,20,37,0.85)'
  g.fillRect(W - 126, 6, 120, 20)
  text(String(S.score).padStart(6, '0'), W - 12, 12, { color: PAL.yellow, align: 'right' })
  text('FAUTES ' + S.fouls, W - 118, 12, { color: PAL.grey1 })
  // Combo au centre.
  if (S.combo > 0) {
    const m = comboMult()
    const pop = Math.max(0, 1 - S.comboAt * 5)
    const col = m >= 5 ? PAL.orange : m >= 3 ? PAL.amber : PAL.yellow
    g.fillStyle = 'rgba(24,20,37,0.8)'; g.fillRect(W / 2 - 60, 4, 120, 44)
    text(`×${m}`, W / 2, 6 - Math.round(pop * 4), { size: Math.round(22 + pop * 10), color: col, align: 'center' })
    // Dix crans vers le prochain palier, puis le chrono qui fond.
    const next = COMBO_STEPS[Math.min(m, COMBO_STEPS.length - 1)]
    const prev = COMBO_STEPS[m - 1]
    const frac = m >= 5 ? 1 : (S.combo - prev) / Math.max(1, next - prev)
    for (let i = 0; i < 10; i++) { g.fillStyle = i < Math.round(frac * 10) ? col : PAL.slateD; g.fillRect(W / 2 - 50 + i * 10, 39, 8, 3) }
    g.fillStyle = S.fire > 0 ? PAL.orange : PAL.white; g.fillRect(W / 2 - 50, 44, Math.round(100 * (S.fire > 0 ? 1 : S.comboT / 3)), 2)
  }
  // FUEGO et patience, en bas.
  g.fillStyle = 'rgba(24,20,37,0.85)'
  g.fillRect(6, H - 24, 150, 18)
  text('FUEGO', 10, H - 19, { size: 7, color: PAL.orange })
  g.fillStyle = PAL.slateD; g.fillRect(44, H - 18, 104, 7)
  g.fillStyle = S.fire > 0 ? PAL.yellow : PAL.orange; g.fillRect(45, H - 17, Math.round(102 * (S.fire > 0 ? S.fire / 6 : S.fuego / 100)), 5)
  g.fillStyle = 'rgba(24,20,37,0.85)'
  g.fillRect(W - 156, H - 24, 150, 18)
  text('ARBITRE', W - 152, H - 19, { size: 7, color: ref.patience <= 0 ? PAL.red : PAL.grey1 })
  g.fillStyle = PAL.slateD; g.fillRect(W - 104, H - 18, 94, 7)
  g.fillStyle = ref.patience > 40 ? PAL.green : ref.patience > 0 ? PAL.amber : PAL.red; g.fillRect(W - 103, H - 17, Math.round(92 * (ref.patience / 100)), 5)
  if (ref.patience <= 0) text('IL CRAQUE', W - 60, H - 32, { size: 7, color: PAL.red, align: 'center' })
  // Bandeaux.
  S.banners.forEach((b, i) => {
    const a = b.t < 0.15 ? b.t / 0.15 : b.t > 1.4 ? (1.8 - b.t) / 0.4 : 1
    g.globalAlpha = clamp(a, 0, 1)
    g.fillStyle = 'rgba(24,20,37,0.9)'
    g.fillRect(0, 60 + i * 22, W, 18)
    text(b.text, W / 2, 65 + i * 22, { size: 9, color: b.color, align: 'center' })
    g.globalAlpha = 1
  })
  // Tactile : joystick et bouton.
  if (touch.joy) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(touch.joy.x, touch.joy.y, 24, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(touch.joy.x + touch.jx * 24, touch.joy.y + touch.jy * 24, 8, 0, Math.PI * 2); g.fill() }
  // Repère de l'arbitre quand il est hors champ.
  { const rx = ref.x - S.cam.x, ry = ref.y - S.cam.y - 30
    if (rx < 0 || rx > W || ry < 0 || ry > H) { const px = clamp(rx, 12, W - 12), py = clamp(ry, 36, H - 36); g.fillStyle = 'rgba(24,20,37,0.8)'; g.fillRect(px - 22, py - 6, 44, 12); text('ARBITRE', px, py - 4, { size: 7, color: PAL.amber, align: 'center' }) } }
  if (S.phase === 'card' && ref.cardTarget) text('JEU ARRETE', W / 2, H / 2 - 40, { size: 10, color: PAL.yellow, align: 'center' })
  if (S.paused) text('PAUSE', W / 2, H / 2 - 8, { size: 16, align: 'center' })
}
function drawTitle() {
  g.fillStyle = 'rgba(24,20,37,0.75)'
  g.fillRect(0, 0, W, H)
  text('CARTON PLEIN', W / 2, 60, { size: 32, color: PAL.yellow, align: 'center' })
  text('UN PARAGUAYEN. ONZE FRANCAIS. ZERO INTENTION DE JOUER AU BALLON.', W / 2, 104, { size: 8, color: PAL.grey1, align: 'center' })
  text('FLECHES : BOUGER   ESPACE / CLIC DROIT : FRAPPER', W / 2, 140, { size: 9, align: 'center' })
  text('LOIN = TACLE GLISSE     COLLE = POING, GENOU, PIED, PROJECTION', W / 2, 156, { size: 9, align: 'center' })
  text('FAIS LE PLUS DE FAUTES POSSIBLE EN 90 SECONDES. LES BUTS NE COMPTENT PAS.', W / 2, 180, { size: 8, color: PAL.grey1, align: 'center' })
  text("QUAND L'ARBITRE CRAQUE, UNE GROSSE FAUTE = CARTON POUR LA FRANCE", W / 2, 194, { size: 8, color: PAL.grey1, align: 'center' })
  const blink = Math.floor(performance.now() / 500) % 2 === 0
  if (blink) text('ESPACE POUR COMMENCER', W / 2, 250, { size: 12, color: PAL.yellow, align: 'center' })
  text('RECORD ' + (localStorage.getItem('carton.record') || 0), W / 2, 300, { size: 8, color: PAL.grey2, align: 'center' })
  drawSprite(g, 'paraguay', 'stance', 's', Math.floor(performance.now() / 120), W / 2 - 160, 300)
  drawSprite(g, 'france-0', 'ko', 'e', 0, W / 2 + 160, 290)
}
function drawEnd() {
  g.fillStyle = 'rgba(24,20,37,0.88)'
  g.fillRect(60, 30, W - 120, H - 60)
  text("RAPPORT DE L'ARBITRE", W / 2, 40, { size: 12, color: PAL.yellow, align: 'center' })
  text('France - Paraguay   Joueur concerne : BENITEZ (4)   Sanction : aucune (normal)', W / 2, 58, { size: 7, color: PAL.grey1, align: 'center' })
  const lines = [
    ['Fautes sifflees', S.fouls], ['  dont grosses fautes', S.bigFouls], ["  dont sur l'arbitre", S.refHits],
    ['Cartons jaunes (France)', S.yellows], ['Cartons rouges (France)', S.reds], ['Francais evacues', S.evac],
    ['Boosts EN FEU', S.fires], ['Combo maximum', '×' + S.maxCombo], ['Temps additionnel', '+' + S.added],
    ['Buts encaisses', S.goals + '   (sans importance)'],
  ]
  lines.forEach(([k, v], i) => { text(k, 90, 80 + i * 13, { size: 8, color: PAL.grey1 }); text(String(v), W - 90, 80 + i * 13, { size: 8, align: 'right' }) })
  text('SCORE', 90, 220, { size: 12, color: PAL.yellow }); text(String(S.final), W - 90, 220, { size: 12, color: PAL.yellow, align: 'right' })
  text('RECORD', 90, 238, { size: 8, color: PAL.grey2 }); text(String(S.record), W - 90, 238, { size: 8, color: PAL.grey2, align: 'right' })
  const stamp = S.final < 15000 ? 'FAIR-PLAY' : S.final < 40000 ? 'RUGUEUX' : S.final < 80000 ? 'BOUCHER' : S.final < 150000 ? 'CARTON PLEIN' : 'LEGENDE DU GUARANI'
  g.save(); g.translate(W / 2, 275); g.rotate(-0.12)
  g.strokeStyle = PAL.red; g.lineWidth = 3; g.strokeRect(-90, -14, 180, 28)
  text(stamp, 0, -8, { size: 14, color: PAL.red, align: 'center', shadow: false })
  g.restore()
  text('ESPACE POUR REJOUER', W / 2, 308, { size: 9, color: PAL.grey1, align: 'center' })
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
Promise.all(['paraguay', 'arbitre', 'gardien', ...Array.from({ length: 11 }, (_, i) => 'france-' + i)].map(loadAtlas)).then(() => {
  fontReady = true
  window.__carton = { S, hero, ref, ball, startMatch, foul, get french() { return french }, get props() { return props }, get npcs() { return npcs } }
  requestAnimationFrame(frame)
}).catch((e) => { document.body.innerHTML = '<pre style="color:#fff">Sprites introuvables : ' + e + '</pre>' })
