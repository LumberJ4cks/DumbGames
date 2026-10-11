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
const FIELD = { x: 64, y: 56, w: 1160, h: 620 } // monde, en pixels
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
}
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
  const an = a.anims[anim] || a.anims.idle
  const list = an[dir] || an.s
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
  combo: 0, comboT: 0, fuego: 0, fire: 0, refDown: 0,
  popups: [], banners: [], particles: [], log: [],
  cam: { x: 0, y: 0 }, shake: 0, freeze: 0,
  phaseT: 0,
}
const hero = { x: 0, y: 0, vx: 0, vy: 0, dir: 's', anim: 'stance', frame: 0, ft: 0, act: null, actT: 0, chain: 0, chainT: 0, stun: 0, speed: 115, atlas: 'paraguay', team: 'par', isHero: true, r: 10 }
const ball = { x: 0, y: 0, vx: 0, vy: 0, owner: null, r: 4 }
const ref = { x: 0, y: 0, vx: 0, vy: 0, dir: 's', anim: 'idle', frame: 0, ft: 0, patience: 100, calm: 0, down: 0, flee: 0, hits: 0, atlas: 'arbitre', team: 'ref', r: 10, stun: 0, hp: 3, card: 0 }
let french = []
let subsUsed = 0
let nextLook = 0
const FORMATION = [[-0.42, 0], [-0.26, -0.28], [-0.26, -0.1], [-0.26, 0.1], [-0.26, 0.28], [-0.08, -0.3], [-0.08, -0.1], [-0.08, 0.1], [-0.08, 0.3], [0.12, -0.12], [0.12, 0.12]]

function makeFrench(i, look) {
  const gk = i === 0
  return { x: 0, y: 0, vx: 0, vy: 0, dir: 'e', anim: 'idle', frame: 0, ft: 0, team: 'fra', gk, slot: i, atlas: gk ? 'gardien' : 'france-' + (look % 11), number: gk ? 1 : 2 + i, hp: 3, stun: 0, down: 0, state: 'play', card: 0, r: 10, speed: 92 + rnd() * 10, cardBob: rnd() * 6, sub: false, fly: null }
}
function resetTeam() {
  french = []
  for (let i = 0; i < 11; i++) french.push(makeFrench(i, nextLook++))
}
function slotPos(f, ballX) {
  const [fx, fy] = FORMATION[f.slot]
  const cx = FIELD.x + FIELD.w * 0.5 + clamp(ballX - (FIELD.x + FIELD.w * 0.5), -FIELD.w * 0.25, FIELD.w * 0.25) * 0.6
  return { x: f.gk ? FIELD.x + 30 : cx + fx * FIELD.w, y: FIELD.y + FIELD.h * 0.5 + fy * FIELD.h }
}
function kickoff() {
  S.phase = 'kickoff'
  S.phaseT = 1.4
  ball.x = FIELD.x + FIELD.w / 2
  ball.y = FIELD.y + FIELD.h / 2
  ball.vx = ball.vy = 0
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
  S.maxCombo = Math.max(S.maxCombo, m)
  pts = Math.round(pts * m)
  S.score += pts
  S.fouls++
  if (def.big) S.bigFouls++
  if (m >= 3) S.fuego = Math.min(100, S.fuego + (def.big ? 14 : 8))
  if (S.fuego >= 100 && S.fire <= 0) startFire()
  const vx = victim ? victim.x : hero.x, vy = victim ? victim.y : hero.y
  popup(vx, vy - 54, name + (mods.length ? ' ' + mods.join(' ') : ''), def.big ? PAL.orange : PAL.white, def.big)
  popup(vx, vy - 42, '+' + pts, PAL.yellow)
  S.log.push({ t: S.clock, name, pts })
  // Arbitre : patience et cartons.
  if (S.refDown <= 0 && name !== "FAUTE SUR L'ARBITRE") {
    ref.patience = Math.max(0, ref.patience - (def.big ? 18 : 8) * (ref.strict || 1))
    ref.calm = 5
    if (ref.patience <= 0 && def.big && victim && victim.team === 'fra') giveCard(victim)
  }
  beep('whistle')
  S.freeze = Math.max(S.freeze, def.big ? 0.08 : 0.04)
  S.shake = Math.max(S.shake, def.big ? 4 : 2)
  freeKick(vx, vy, victim)
}
function giveCard(victim) {
  if (victim.card === 0) {
    victim.card = 1
    S.yellows++
    S.score += 1000
    banner('CARTON JAUNE POUR LA FRANCE', PAL.yellow)
    popup(victim.x, victim.y - 66, 'SIMULATION !', PAL.yellow, true)
  } else {
    victim.card = 2
    S.reds++
    S.score += 3000 + (victim.gk ? 2000 : 0)
    banner('CARTON ROUGE POUR LA FRANCE', PAL.red)
    victim.state = 'leaving'
    victim.leaveT = 0
  }
  ref.patience = 60
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
  if (S.phase !== 'play') return
  S.phase = 'freekick'
  S.phaseT = 1.2
  ball.vx = ball.vy = 0
  ball.owner = null
  ball.x = clamp(x + rr(-6, 6), FIELD.x + 20, FIELD.x + FIELD.w - 20)
  ball.y = clamp(y + rr(-6, 6), FIELD.y + 20, FIELD.y + FIELD.h - 20)
}

/* ---------- héros ---------- */
function nearestFrench(from, maxD, pred = () => true) {
  let best = null, bd = maxD
  for (const f of french) { if (f.state !== 'play' || !pred(f)) continue; const d = dist(from, f); if (d < bd) { bd = d; best = f } }
  return best
}
function hitFrench(f, name, { throwIt = false, knock = 0 } = {}) {
  if (f.hp <= 0) { foul('ACHARNEMENT', f); return }
  if (f.gk && name !== "FAUTE SUR L'ARBITRE") name = 'FAUTE SUR LE GARDIEN'
  f.hp -= 1
  f.stun = 0.45
  f.anim = 'hit'; f.frame = 0; f.ft = 0
  if (ball.owner === f) { ball.owner = null; ball.vx = (f.x - hero.x) * 2; ball.vy = (f.y - hero.y) * 2 }
  const dx = f.x - hero.x, dy = f.y - hero.y
  const d = Math.hypot(dx, dy) || 1
  f.vx = (dx / d) * (throwIt ? 260 : 120); f.vy = (dy / d) * (throwIt ? 260 : 120)
  foul(name, f, { penalty: inBox(f) })
  if (f.hp <= 0 || throwIt) knockDown(f, throwIt ? 0.45 : 0.35)
  for (let i = 0; i < 6; i++) S.particles.push({ x: f.x, y: f.y - 30, vx: rr(-60, 60), vy: rr(-80, -20), t: 0, life: 0.5, c: i % 2 ? PAL.yellow : PAL.white })
  beep('hit')
}
function knockDown(f, flight) {
  f.state = 'fall'
  f.fly = flight
  f.hp = 0
  f.anim = 'fall'; f.frame = 0; f.ft = 0
  f.down = 2.6
  if (ball.owner === f) ball.owner = null
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
  if (f) {
    const chain = ['punch', 'knee', 'kick', 'throw']
    const step = hero.chainT > 0 ? Math.min(hero.chain, 3) : 0
    hero.act = chain[step]
    hero.actT = step === 3 ? 0.5 : 0.3
    hero.chain = step + 1
    hero.chainT = 0.9
    hero.dir = dirOf(f.x - hero.x, f.y - hero.y) || hero.dir
    hero.hitTarget = f
    hero.hitDone = false
  } else {
    hero.act = 'tackle'
    hero.actT = 0.45
    hero.tackled = new Set()
    const v = inputVector()
    const dx = v.dx || (hero.dir.includes('e') ? 1 : hero.dir.includes('w') ? -1 : 0)
    const dy = v.dy || (hero.dir.includes('s') ? 1 : hero.dir.includes('n') ? -1 : 0)
    const d = Math.hypot(dx, dy) || 1
    hero.tvx = (dx / d) * (S.fire > 0 ? 440 : 245); hero.tvy = (dy / d) * (S.fire > 0 ? 440 : 245)
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
    for (const f of french) {
      if (f.state !== 'play' || hero.tackled.has(f)) continue
      if (dist(hero, f) < 26) {
        hero.tackled.add(f)
        const behind = (f.dir.includes('e') && hero.x < f.x) || (f.dir.includes('w') && hero.x > f.x)
        const late = hero.actT < 0.22
        hitFrench(f, late ? 'SEMELLE' : behind ? 'PAR DERRIERE' : 'TACLE')
        if (hero.tackled.size === 2) { S.score += 300 * comboMult(); popup(hero.x, hero.y - 70, 'CISEAUX +300', PAL.orange, true) }
      }
    }
    if (S.refDown <= 0 && !hero.tackled.has(ref) && dist(hero, ref) < 22) { hero.tackled.add(ref); hitRef() }
    hero.actT -= dt
    if (hero.actT <= 0) {
      hero.act = null
      if (hero.tackled.size === 0) { hero.stun = 0.8; S.combo = 0; popup(hero.x, hero.y - 50, 'GLISSADE', PAL.grey1) }
    }
  } else if (hero.act) {
    hero.vx = hero.vy = 0
    hero.actT -= dt
    const dur = hero.act === 'throw' ? 0.5 : 0.3
    if (!hero.hitDone && hero.actT < dur - 0.1) {
      hero.hitDone = true
      const t = hero.hitTarget
      if (t === ref) hitRef()
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
  }
  hero.chainT -= dt
  if (hero.chainT <= 0) hero.chain = 0
  hero.x = clamp(hero.x, FIELD.x - 20, FIELD.x + FIELD.w + 20)
  hero.y = clamp(hero.y, FIELD.y - 10, FIELD.y + FIELD.h + 10)
  // Animation.
  const moving = Math.hypot(hero.vx, hero.vy) > 5
  const anim = hero.act === 'tackle' ? 'tackle' : hero.act ? hero.act : moving ? 'run' : 'stance'
  if (anim !== hero.anim) { hero.anim = anim; hero.frame = 0; hero.ft = 0 }
  hero.ft += dt
  const fps = anim === 'run' ? 12 : anim === 'throw' ? 14 : 8
  hero.frame = Math.floor(hero.ft * fps)
}
function hitRef() {
  S.refHits++
  ref.hits++
  S.refDown = 2
  ref.down = 2
  ref.patience = 0
  ref.anim = 'fall'; ref.frame = 0; ref.ft = 0
  foul("FAUTE SUR L'ARBITRE", null)
  if (ref.hits >= 3 && !ref.strict) { ref.strict = 1.25; banner('LE 4E ARBITRE PREND LE SIFFLET', PAL.grey1); S.evac++ }
}

/* ---------- Français (IA de foot) ---------- */
function updateFrench(dt) {
  const goal = { x: FIELD.x + FIELD.w + 6, y: FIELD.y + FIELD.h / 2 }
  const regroup = S.phase === 'freekick' || S.phase === 'kickoff'
  for (const f of french) {
    f.ft += dt
    if (f.state === 'leaving') {
      f.leaveT += dt
      f.anim = 'run'
      const ty = f.y < FIELD.y + FIELD.h / 2 ? FIELD.y - 60 : FIELD.y + FIELD.h + 60
      f.dir = ty < f.y ? 'n' : 's'
      f.y += (ty < f.y ? -1 : 1) * 90 * dt
      f.frame = Math.floor(f.ft * 12)
      if (Math.abs(f.y - ty) < 4) substitute(f)
      continue
    }
    if (f.state === 'fall') {
      f.fly -= dt
      f.x += f.vx * dt; f.y += f.vy * dt
      f.vx *= 0.92; f.vy *= 0.92
      f.frame = Math.floor(f.ft * 14)
      if (f.fly <= 0) { f.state = 'ko'; f.anim = 'ko'; f.frame = 0; f.koDir = f.dir }
      continue
    }
    if (f.state === 'ko') {
      f.down -= dt
      if (f.down <= 0) { f.state = 'play'; f.hp = 3; f.anim = 'idle'; f.stun = 0.3; f.evac = (f.evac || 0) + 1; if (f.evac >= 2) { f.evac = 0; S.evac++; substitute(f, true) } }
      continue
    }
    if (f.stun > 0) {
      f.stun -= dt
      f.x += f.vx * dt; f.y += f.vy * dt
      f.vx *= 0.85; f.vy *= 0.85
      f.frame = Math.floor(f.ft * 14)
      continue
    }
    // Cible de déplacement.
    let target
    const carrier = ball.owner === f
    if (regroup) {
      const near = french.filter((g) => g.state === 'play' && !g.gk).sort((a, b) => dist(a, ball) - dist(b, ball)).slice(0, 4)
      target = near.includes(f) ? { x: ball.x + (f.slot % 2 ? -1 : 1) * (16 + (f.slot % 3) * 14), y: ball.y + ((f.slot % 4) - 1.5) * 16 } : slotPos(f, ball.x)
    } else if (carrier) {
      target = { x: goal.x, y: goal.y + (f.slot % 2 ? -30 : 30) }
      // Passe quand le n°4 approche, tir dans la surface.
      const threat = dist(hero, f)
      if (f.x > FIELD.x + FIELD.w - 170 && Math.abs(f.y - goal.y) < 180 && rnd() < 0.05) shoot(f, goal)
      else if (threat < 85 && rnd() < 0.2) {
        const mate = french.filter((g) => g !== f && g.state === 'play' && !g.gk && dist(g, hero) > 90).sort((a, b) => dist(a, f) - dist(b, f))[0]
        if (mate) pass(f, mate)
      }
    } else if (!ball.owner && !f.gk) {
      const chaser = french.filter((g) => g.state === 'play' && !g.gk).sort((a, b) => dist(a, ball) - dist(b, ball))[0]
      target = chaser === f ? { x: ball.x, y: ball.y } : slotPos(f, ball.x)
    } else target = slotPos(f, ball.x)
    if (f.gk) target = { x: FIELD.x + 30, y: clamp(ball.y, FIELD.y + FIELD.h / 2 - 50, FIELD.y + FIELD.h / 2 + 50) }
    // Évitement léger du n°4 pour les non-porteurs.
    const dh = dist(f, hero)
    if (!carrier && dh < 40 && !regroup) { target = { x: f.x + (f.x - hero.x) * 2, y: f.y + (f.y - hero.y) * 2 } }
    const dx = target.x - f.x, dy = target.y - f.y
    const d = Math.hypot(dx, dy)
    const sp = f.speed * (carrier ? 0.95 : 1) * (regroup ? 1.3 : 1)
    if (d > 6) { f.vx = (dx / d) * sp; f.vy = (dy / d) * sp } else { f.vx = f.vy = 0 }
    // Séparation entre Français.
    for (const g of french) if (g !== f && g.state === 'play') { const dd = dist(f, g); if (dd < 22 && dd > 0) { f.vx += ((f.x - g.x) / dd) * 60; f.vy += ((f.y - g.y) / dd) * 60 } }
    f.x += f.vx * dt; f.y += f.vy * dt
    f.x = clamp(f.x, FIELD.x + 8, FIELD.x + FIELD.w - 8)
    f.y = clamp(f.y, FIELD.y + 8, FIELD.y + FIELD.h - 8)
    const moving = Math.hypot(f.vx, f.vy) > 15
    const nd = dirOf(f.vx, f.vy)
    if (moving && nd) f.dir = nd
    const anim = moving ? 'run' : 'idle'
    if (anim !== f.anim) { f.anim = anim; f.ft = 0 }
    f.frame = Math.floor(f.ft * (moving ? 12 : 6))
    // Prise de balle.
    if (!regroup && !ball.owner && dist(f, ball) < 14 && !f.gk) { ball.owner = f }
    if (carrier) { const nx = f.x + (f.vx || 60) * 0.12, ny = f.y + f.vy * 0.12 + 6; ball.x = nx; ball.y = ny; ball.vx = ball.vy = 0 }
  }
}
function pass(from, to) {
  ball.owner = null
  const dx = to.x - from.x, dy = to.y - from.y
  const d = Math.hypot(dx, dy) || 1
  const v = Math.min(360, 160 + d * 1.2)
  ball.vx = (dx / d) * v; ball.vy = (dy / d) * v
  ball.x = from.x + (dx / d) * 10; ball.y = from.y + (dy / d) * 10
  from.stun = 0.15
}
function shoot(from, goal) {
  ball.owner = null
  const ty = goal.y + rr(-GOAL_H / 2 + 12, GOAL_H / 2 - 12)
  const dx = goal.x + 30 - from.x, dy = ty - from.y
  const d = Math.hypot(dx, dy) || 1
  ball.vx = (dx / d) * 520; ball.vy = (dy / d) * 520
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

/* ---------- ballon et buts ---------- */
function updateBall(dt) {
  if (ball.owner) return
  ball.x += ball.vx * dt; ball.y += ball.vy * dt
  ball.vx *= Math.pow(0.4, dt); ball.vy *= Math.pow(0.4, dt)
  const gy = FIELD.y + FIELD.h / 2
  if (ball.x > FIELD.x + FIELD.w + 4 && Math.abs(ball.y - gy) < GOAL_H / 2) { goalScored(); return }
  if (ball.x < FIELD.x + 4) { ball.x = FIELD.x + 4; ball.vx = Math.abs(ball.vx) * 0.5 }
  if (ball.x > FIELD.x + FIELD.w - 4) { ball.x = FIELD.x + FIELD.w - 4; ball.vx = -Math.abs(ball.vx) * 0.5 }
  if (ball.y < FIELD.y + 4) { ball.y = FIELD.y + 4; ball.vy = Math.abs(ball.vy) * 0.5 }
  if (ball.y > FIELD.y + FIELD.h - 4) { ball.y = FIELD.y + FIELD.h - 4; ball.vy = -Math.abs(ball.vy) * 0.5 }
}
function goalScored() {
  S.goals++
  S.phase = 'goal'
  S.phaseT = 1.6
  banner('BUT POUR LA FRANCE (SANS IMPORTANCE)', PAL.grey1)
  beep('goal')
}

/* ---------- arbitre ---------- */
function updateRef(dt) {
  ref.ft += dt
  if (ref.down > 0) { ref.down -= dt; S.refDown = ref.down; ref.frame = Math.floor(ref.ft * 10); if (ref.down <= 0) { ref.flee = 5; ref.anim = 'run'; ref.ft = 0 } return }
  S.refDown = 0
  ref.calm -= dt
  if (ref.calm <= 0) ref.patience = Math.min(100, ref.patience + 4 * dt)
  let target
  if (ref.flee > 0) { ref.flee -= dt; const dx = ref.x - hero.x, dy = ref.y - hero.y; const d = Math.hypot(dx, dy) || 1; target = { x: ref.x + (dx / d) * 100, y: ref.y + (dy / d) * 100 } }
  else target = { x: ball.x - 60, y: ball.y - 90 }
  const dx = target.x - ref.x, dy = target.y - ref.y
  const d = Math.hypot(dx, dy)
  const sp = ref.flee > 0 ? 170 : d > 120 ? 150 : 85
  if (d > 10) { ref.vx = (dx / d) * sp; ref.vy = (dy / d) * sp } else ref.vx = ref.vy = 0
  ref.x = clamp(ref.x + ref.vx * dt, FIELD.x + 10, FIELD.x + FIELD.w - 10)
  ref.y = clamp(ref.y + ref.vy * dt, FIELD.y + 10, FIELD.y + FIELD.h - 10)
  const moving = Math.hypot(ref.vx, ref.vy) > 15
  const nd = dirOf(ref.vx, ref.vy)
  if (moving && nd) ref.dir = nd
  const anim = moving ? (sp > 100 ? 'run' : 'walk') : 'idle'
  if (anim !== ref.anim) { ref.anim = anim; ref.ft = 0 }
  ref.frame = Math.floor(ref.ft * (moving ? 10 : 6))
}

/* ---------- boucle ---------- */
function startMatch() {
  Object.assign(S, { phase: 'kickoff', t: 0, clock: 0, added: 0, addedShown: false, score: 0, fouls: 0, bigFouls: 0, goals: 0, yellows: 0, reds: 0, refHits: 0, maxCombo: 1, fires: 0, evac: 0, combo: 0, comboT: 0, fuego: 0, fire: 0, refDown: 0, popups: [], banners: [], particles: [], log: [], shake: 0, freeze: 0 })
  Object.assign(ref, { patience: 100, calm: 0, down: 0, flee: 0, hits: 0, strict: 0, anim: 'idle' })
  Object.assign(hero, { act: null, chain: 0, stun: 0, anim: 'stance' })
  subsUsed = 0
  nextLook = 0
  resetTeam()
  kickoff()
  beep('whistle')
}
function update(dt) {
  if (S.phase === 'title' || S.phase === 'end') { if (attackPressed) { attackPressed = false; startMatch() } return }
  if (S.paused) { attackPressed = false; return }
  if (S.freeze > 0) { S.freeze -= dt; attackPressed = false; return }
  S.t += dt
  const total = RUN + S.added
  if (S.phase === 'play' || S.phase === 'freekick') S.clock += dt
  if (S.clock >= total) { endMatch(); return }
  if (!S.addedShown && S.clock >= RUN * 0.94) { S.addedShown = true; S.added = Math.min(15, Math.floor(S.fouls / 6)); banner('TEMPS ADDITIONNEL : +' + S.added + ' (' + S.fouls + ' FAUTES)', PAL.grey1) }
  if (S.phase === 'kickoff' || S.phase === 'goal') { S.phaseT -= dt; if (S.phaseT <= 0) { if (S.phase === 'goal') kickoff(); else { S.phase = 'play'; ball.owner = french[9] } } }
  if (S.phase === 'freekick') { S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = 'play'; const taker = nearestFrench(ball, 80, (f) => !f.gk); if (taker) ball.owner = taker } }
  if (attackPressed) { attackPressed = false; heroAttack() }
  updateHero(dt)
  updateFrench(dt)
  updateBall(dt)
  updateRef(dt)
  // Combo, feu.
  if (S.comboT > 0 && S.fire <= 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0 }
  if (S.fire > 0) { S.fire -= dt; if (S.fire <= 0) { banner('FIN DU FEU', PAL.grey1) } }
  else S.fuego = Math.max(0, S.fuego - 2 * dt)
  // Effets.
  for (const p of S.popups) p.t += dt
  S.popups = S.popups.filter((p) => p.t < 1.1)
  for (const b of S.banners) b.t += dt
  S.banners = S.banners.filter((b) => b.t < 2.2)
  for (const p of S.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt }
  S.particles = S.particles.filter((p) => p.t < p.life)
  S.shake *= Math.pow(0.02, dt)
  // Caméra : suit le ballon, tirée vers le héros.
  const tx = ball.x * 0.6 + hero.x * 0.4 - W / 2, ty = ball.y * 0.6 + hero.y * 0.4 - H / 2
  S.cam.x += (clamp(tx, 0, FIELD.x * 2 + FIELD.w - W) - S.cam.x) * Math.min(1, dt * 4)
  S.cam.y += (clamp(ty, 0, FIELD.y * 2 + FIELD.h - H) - S.cam.y) * Math.min(1, dt * 4)
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
  // Cages : poteaux et filet.
  for (const side of [0, 1]) {
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
  // Tri par profondeur.
  const ents = [...french, ref, hero]
  ents.sort((a, b) => a.y - b.y)
  // Ombres et marquage.
  for (const e of ents) if (e.state !== 'ko') drawShadow(e.x + cx, e.y + cy + 1, e.state === 'fall' ? 14 : 12)
  if (!ball.owner || true) drawShadow(ball.x + cx, ball.y + cy + 2, 4)
  if (S.fire > 0) drawFlame(hero.x + cx, hero.y + cy, S.t)
  for (const e of ents) {
    if (e.state === 'ko') { drawSprite(g, e.atlas, 'ko', e.koDir || e.dir, 0, e.x + cx, e.y + cy - 22); drawStars(e.x + cx, e.y + cy - 30, S.t); continue }
    if (e.state === 'fall') { drawSprite(g, e.atlas, 'fall', e.dir, e.frame, e.x + cx, e.y + cy); continue }
    let anim = e.anim
    if (e === hero && hero.act && hero.act !== 'tackle' && hero.act !== 'throw') anim = hero.act
    drawSprite(g, e.atlas, anim, e.dir, e.frame, e.x + cx, e.y + cy)
    if (e.card === 1) drawCard(e.x + cx, e.y + cy - 58 + Math.round(Math.sin(S.t * 6 + e.cardBob)), dist(e, hero) < 60 && Math.floor(S.t * 6) % 2 === 0)
    if (e.stun > 0 && e.team === 'fra') drawStars(e.x + cx, e.y + cy - 52, S.t, 2)
  }
  // Ballon.
  g.fillStyle = PAL.white; g.beginPath(); g.arc(ball.x + cx, ball.y + cy - 3, 4, 0, Math.PI * 2); g.fill()
  g.fillStyle = PAL.ink; g.fillRect(ball.x + cx - 1, ball.y + cy - 4, 2, 2)
  // Particules et popups.
  for (const p of S.particles) { g.fillStyle = p.c; g.fillRect(Math.round(p.x + cx), Math.round(p.y + cy), 2, 2) }
  for (const p of S.popups) text(p.text, Math.round(p.x + cx), Math.round(p.y + cy - p.t * 18), { size: p.big ? 10 : 8, color: p.color, align: 'center' })
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
    text(`×${m}`, W / 2, 10, { size: 16, color: m >= 5 ? PAL.orange : PAL.yellow, align: 'center' })
    const next = COMBO_STEPS[Math.min(m, COMBO_STEPS.length - 1)]
    g.fillStyle = PAL.ink; g.fillRect(W / 2 - 31, 30, 62, 5)
    g.fillStyle = PAL.yellow; g.fillRect(W / 2 - 30, 31, Math.round(60 * (S.comboT / 3)), 3)
    if (m < 5) text(`${S.combo}/${next}`, W / 2, 37, { size: 7, color: PAL.grey1, align: 'center' })
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
    const a = b.t < 0.2 ? b.t / 0.2 : b.t > 1.8 ? (2.2 - b.t) / 0.4 : 1
    g.globalAlpha = clamp(a, 0, 1)
    g.fillStyle = 'rgba(24,20,37,0.9)'
    g.fillRect(0, 60 + i * 22, W, 18)
    text(b.text, W / 2, 65 + i * 22, { size: 9, color: b.color, align: 'center' })
    g.globalAlpha = 1
  })
  // Tactile : joystick et bouton.
  if (touch.joy) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(touch.joy.x, touch.joy.y, 24, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(touch.joy.x + touch.jx * 24, touch.joy.y + touch.jy * 24, 8, 0, Math.PI * 2); g.fill() }
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
  update(dt)
  render()
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
  window.__carton = { S, hero, french, ref, ball, startMatch, foul }
  requestAnimationFrame(frame)
}).catch((e) => { document.body.innerHTML = '<pre style="color:#fff">Sprites introuvables : ' + e + '</pre>' })
