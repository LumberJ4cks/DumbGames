/*
 * CONS DE MIME ! — v1, pixel art.
 *
 * Vue de dessus, la Croisette défile de gauche à droite. Serge court après un tueur qu'il ne
 * rattrape jamais ; le joueur gagne des points en frôlant les Cannois sans les toucher, et pète
 * dessus pour les envoyer exploser sur la plage. 90 secondes, un saut en longueur final.
 *
 * La simulation (en haut) ne connaît que des rectangles ; le dessin (en bas) pose les sprites de
 * sprites.js dessus. Aucune dépendance.
 *   ?seed=42   rejoue la même partie       ?debug=1   hitboxes et chiffres
 */
import { Pix, PAL as P, toCanvas } from './pixel.js'
import { mirror, buildSprites, TILE_W, PALAIS_W } from './sprites.js'
import { drawText5, drawText5C, textWidth5, logoLine } from './font5.js'
import { drawText, drawTextC, textWidth } from './font.js'
import { createAudio } from './audio.js'

export const GW = 480
export const GH = 270

/* ---------- réglages (tout ce qu'on va vouloir toucher en test) ---------- */
export const CFG = {
  duration: 90,            // s
  baseSpeed: 110,          // px/s, vitesse de la caméra (Serge est accroché dedans)
  boostSpeed: 2.3,         // × pendant le prout
  boostTime: 0.6,          // s
  tripSpeed: 0.25,         // × pendant un trébuchement
  tripTime: 0.8,           // s
  laneSpeed: 150,          // px/s vertical
  slideSpeed: 160,         // px/s pour avancer/reculer dans le cadre
  sergeMinX: 70, sergeMaxX: 200, sergeHomeX: 120,
  sidewalkTop: 78, sidewalkBottom: 196,   // zone jouable (y des pieds)
  roadTop: 16, roadBottom: 70, beachTop: 204, seaTop: 246, GH,
  fartRecharge: 0.10,      // jauge/s
  fartNearMiss: 0.18,      // jauge par esquive
  fartCost: 1,
  fartMin: 0.15,           // jauge minimale pour péter
  fartCone: { back: 100, front: 40, half: 58 },
  nearMissDist: 24,        // px vertical pour compter une esquive
  score: { nearMiss: 50, knock: 100, explode: 300, look: 500, mamie: 1000, meter: 100, blast: 75 },
  rollerAt: 20, mamieAt: 40, mimesFrom: 50, acteurAt: 30, odileAt: 62,
  lookInvert: 1.5,         // s de contrôles inversés après avoir regardé
}

/* ---------- aléatoire reproductible ---------- */
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/* ---------- population ---------- */
// kind: label, taille (w,h aux pieds), vitesse, couleur, poids (fréquence), options
const PEOPLE = [
  { k: 'vieux', w: 10, h: 16, spd: 12, col: '#9a9a9a', wt: 4 },
  { k: 'vieux+chien', w: 10, h: 16, spd: 10, col: '#9a9a9a', wt: 2, dog: true },
  { k: 'jeune', w: 10, h: 18, spd: 28, col: '#c8c8c8', wt: 3, group: true },
  { k: 'touriste', w: 12, h: 16, spd: 18, col: '#b0b0b0', wt: 3 },
  { k: 'smoking', w: 10, h: 18, spd: 20, col: '#707070', wt: 1 },
  { k: 'CRS', w: 12, h: 18, spd: 8, col: '#5a5a7a', wt: 1 },
  { k: 'livreur', w: 10, h: 16, spd: 55, col: '#a0a0a0', wt: 1 },
]
const FURNITURE = [
  { k: 'poubelle', w: 10, h: 10, wt: 4 },
  { k: 'reverbere', w: 6, h: 6, wt: 3, edge: true },
  { k: 'banc', w: 26, h: 8, wt: 3, edge: true },
  { k: 'kiosque', w: 30, h: 22, wt: 1, edge: true },
  { k: 'chaise bleue', w: 8, h: 8, wt: 2, edge: 'beach' },
]
const pick = (r, list) => {
  const total = list.reduce((a, b) => a + b.wt, 0)
  let x = r() * total
  for (const it of list) { x -= it.wt; if (x <= 0) return it }
  return list[list.length - 1]
}

/* ---------- la partie ---------- */
export function create(canvas) {
  const ctx = canvas.getContext('2d')
  canvas.width = GW; canvas.height = GH
  const q = new URLSearchParams(location.search)
  const debug = q.get('debug') === '1'
  const seedParam = q.get('seed')
  let best = 0
  try { best = +(localStorage.getItem('consDeMime:best') || 0) } catch {}

  const held = { up: false, down: false, left: false, right: false }
  let laneTarget = null
  let pointerTouch = false
  let S
  const audio = createAudio()
  try { audio.setMuted(localStorage.getItem('consDeMime:muted') === '1') } catch {}
  function toggleMute() {
    audio.setMuted(!audio.muted)
    try { localStorage.setItem('consDeMime:muted', audio.muted ? '1' : '0') } catch {}
  }

  function reset() {
    audio.music(false, 0.4)
    const seed = seedParam ? +seedParam : (Math.random() * 1e9) | 0
    const r = rng(seed)
    S = {
      seed, r, mode: 'intro', t: 0, introT: 0, clock: 0,
      intro: { line: -1, lineT: 0, started: false },
      camX: 0, speedMul: 1, boostT: 0, tripT: 0,
      serge: { x: CFG.sergeHomeX, y: 150, w: 12, h: 18, face: 1 },
      killer: { x: -80, y: 112, taunt: 5, tauntT: 0 },
      martine: null,
      fart: 1, farts: [], gas: [],
      combo: 0, bestCombo: 0, score: 0, scoreShown: 0, scoreBump: 0, scoreGain: 0, scoreGainT: 0, comboBump: 0, comboShown: 0,
      ents: [], pops: [], spawnX: 300, nextMimeX: 0,
      roller: null, lookWindow: 0, invertT: 0, looked: false,
      mamie: null, truck: null, mamieDone: false, acteur: null, odile: false,
      shake: 0, flash: 0,
      jump: null, result: null,
    }
    // décor bord de trottoir : palmiers/réverbères réguliers (visuel seulement)
    // premier peuplement
    while (S.spawnX < GW + 200) spawnChunk()
    // Martine, plantée devant le Palais, face à Serge.
    S.martine = { type: 'martine', x: CFG.sergeHomeX + 42, y: 150, w: 10, h: 18, solid: false, bubbleT: 0, bubble: '' }
    S.ents.push(S.martine)
  }

  function mult() {
    const c = S.combo
    return c >= 20 ? 5 : c >= 15 ? 4 : c >= 10 ? 3 : c >= 5 ? 2 : 1
  }

  function density() {
    // nombre d'entités par tranche de 100 px, de 1,2 à ~4 sur 90 s
    const p = Math.min(1, S.t / CFG.duration)
    return 1.2 + 2.8 * p
  }

  function spawnChunk() {
    const r = S.r
    const x0 = S.spawnX
    const n = Math.round(density() + (r() - 0.5))
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * 100
      if (r() < 0.3) {
        const f = pick(r, FURNITURE)
        let y
        if (f.edge === 'beach') y = CFG.sidewalkBottom + 2 + r() * 4
        else if (f.edge) y = r() < 0.5 ? CFG.sidewalkTop + 4 : CFG.sidewalkBottom - 2
        else y = CFG.sidewalkTop + 10 + r() * (CFG.sidewalkBottom - CFG.sidewalkTop - 20)
        S.ents.push({ type: 'furn', k: f.k, x, y, w: f.w, h: f.h, solid: true })
      } else {
        const p = pick(r, PEOPLE)
        const y = CFG.sidewalkTop + 6 + r() * (CFG.sidewalkBottom - CFG.sidewalkTop - 12)
        const dir = r() < 0.6 ? -1 : 1
        const e = { type: 'ped', k: p.k, x, y, w: p.w, h: p.h, col: p.col, vx: dir * p.spd * (0.6 + r() * 0.8), vy: (r() - 0.5) * 12, state: 'walk', solid: true, dog: p.dog, variant: (r() * 3) | 0, phase: r() * 2 }
        S.ents.push(e)
        if (p.dog) S.ents.push({ type: 'ped', k: 'chien', x: x + 14, y: y + 2, w: 7, h: 5, col: '#d0c090', vx: e.vx, vy: e.vy, state: 'walk', solid: true, leash: e, phase: r() * 2 })
        if (p.group) for (let g = 0; g < 2; g++) S.ents.push({ type: 'ped', k: 'jeune', x: x + 12 + g * 12, y: y + (r() - 0.5) * 16, w: p.w, h: p.h, col: p.col, vx: e.vx, vy: e.vy, state: 'walk', solid: true, variant: (r() * 3) | 0, phase: r() * 2 })
      }
    }
    // mimes : à partir de 50 s, un mur mimé toutes les ~150 px puis de plus en plus
    if (S.t >= CFG.mimesFrom && x0 >= S.nextMimeX) {
      const y = CFG.sidewalkTop + 14 + r() * (CFG.sidewalkBottom - CFG.sidewalkTop - 28)
      S.ents.push({ type: 'mime', k: 'CON DE MIME', x: x0 + 50, y, w: 10, h: 18, solid: true, wallH: 44, state: 'mime', pose: 0 })
      S.nextMimeX = x0 + 180 - Math.min(100, (S.t - CFG.mimesFrom) * 2.2)
    }
    S.spawnX += 100
  }

  function pop(x, y, text, col = '#ffffff', big = false) {
    S.pops.push({ x, y, text, col, big, t: 0 })
  }

  function addScore(n, x, y, label) {
    const v = n * mult()
    S.score += v
    S.scoreBump = 1
    S.scoreGain += v
    S.scoreGainT = 1.4
    pop(x, y - 20, (label ? label + ' ' : '') + '+' + v, '#ffe060', v >= 500)
  }

  function trip(e) {
    if (S.tripT > 0) return
    S.tripT = CFG.tripTime
    S.boostT = 0
    audio.trip(e && e.type === 'mime' ? 'mime' : 'ped')
    if (S.combo >= 5) audio.comboLost()
    if (S.combo >= 5) pop(S.serge.x, S.serge.y - 30, 'COMBO PERDU', '#ff5050', true)
    S.combo = 0
    S.shake = 0.3
    if (e && e.type === 'ped') { e.state = 'down'; e.vx = e.vy = 0; e.solid = false; e.downT = 0 }
  }

  function doFart() {
    if (S.mode !== 'run' || S.fart < CFG.fartMin || S.tripT > 0) return
    // Le prout prend toute la jauge : plus elle est pleine, plus il dure et plus il porte loin.
    const power = S.fart
    S.fart = 0
    audio.fart()
    S.boostT = CFG.boostTime * (0.45 + 0.9 * power)
    S.shake = 0.1 + 0.1 * power
    const reach = 0.55 + 0.45 * power
    const sx = S.serge.x, sy = S.serge.y
    S.gas.push({ x: sx - 10, y: sy, t: 0 })
    let hit = 0
    for (const e of S.ents) {
      if (e.type === 'furn' || e.state !== 'walk' && e.state !== 'mime') continue
      const dx = e.x - sx, dy = e.y - sy
      if (dx < -CFG.fartCone.back * reach || dx > CFG.fartCone.front * reach || Math.abs(dy) > CFG.fartCone.half * reach) continue
      if (e.type === 'mime') { pop(e.x, e.y - 24, 'IMMUNISÉ', '#ffffff'); audio.immune(); continue }
      hit++
      e.state = 'fly'; e.solid = false
      e.farted = true
      // Chaque personne soufflée rapporte, et part dans un petit éclat.
      addScore(CFG.score.blast, e.x, e.y - 10, 'PROUT')
      S.ents.push({ type: 'boom', x: e.x, y: e.y - 8, t: 0.1, small: true })
      e.z = 0
      e.vz = 120 + S.r() * 40
      e.vx = -60 + dx * 0.8 + S.r() * 40
      e.vy = (dy >= 0 ? 1 : -1) * (90 + Math.abs(dy) * 1.2) // vers la plage si en bas, vers la route si en haut
      e.spin = (S.r() - 0.5) * 20
    }
    if (hit >= 2) pop(sx, sy - 34, 'PROUT ×' + hit, '#80ff80', true)
    if (hit >= 3) audio.combo(Math.min(4, hit))
  }

  /* ---------- l'intro : Serge et Martine devant le Palais ---------- */
  const DIALOG = [
    { who: 'serge', text: 'MARTINE !' },
    { who: 'martine', text: 'AH ! S.E.C.U ! COMMENT ÇA VA ?' },
    { who: 'serge', text: 'BIEN !' },
    { who: 'serge', text: "ALORS, QU'EST-CE QUE TU DEVIENS ?" },
    { who: 'martine', text: "OH BEN... J'SUIS SÉROPOSITIVE." },
  ]
  function nextLine() {
    const it = S.intro
    if (it.lineT < 0.25 || it.line >= DIALOG.length - 1) return
    it.line++
    it.lineT = 0
    audio.click()
    audio.talk(DIALOG[it.line].who, DIALOG[it.line].text)
  }
  function startRun() {
    S.mode = 'run'
    S.t = 0
    S.intro.started = true
    audio.alarm()
    audio.music(true)
    audio.duck(1)
    S.lastTick = -1
    S.martine.bubble = "MAIS NON, C'ÉTAIT POUR DÉCONNER."
    S.martine.bubbleT = 4
    setTimeout(() => audio.talk('martine', S.martine.bubble), 500)
  }

  function press(a) {
    if (a === 'mute') { toggleMute(); return }
    audio.resume()
    if (a in held) held[a] = true
    if (S.mode === 'intro' && (a === 'start' || a === 'fart' || a === 'look')) { nextLine(); return }
    if (S.mode === 'over' && a === 'start') { reset(); return }
    if (S.mode === 'over' && (a === 'fart' || a === 'look') && S.overT > 1.5) { reset(); return }
    if (a === 'fart') doFart()
    if (a === 'look') doLook()
  }
  /** Tactile : un doigt posé. Côté droit = prout, les écrans d'intro et de fin réagissent aux deux. */
  function tap(side) {
    pointerTouch = true
    audio.resume()
    if (S.mode === 'intro') { nextLine(); return }
    if (S.mode === 'over') { if (S.overT > 1.5) reset(); return }
    if (side === 'R') doFart()
  }
  function release(a) { if (a in held) held[a] = false }
  function touchLane(y) { laneTarget = y }

  function doLook() {
    if (S.mode !== 'run' || S.lookWindow <= 0 || S.looked) return
    S.looked = true
    S.invertT = CFG.lookInvert
    audio.whistle()
    setTimeout(() => audio.wobble(), 450)
    S.serge.face = -1
    addScore(CFG.score.look, S.serge.x, S.serge.y, 'LA FILLE EN JAUNE')
  }

  /* ---------- scripts ---------- */
  function updateScripts(dt) {
    // La fille en roller en jaune : arrive de derrière à 20 s, double Serge.
    if (!S.roller && S.t >= CFG.rollerAt) {
      S.roller = { x: S.serge.x - 60, y: S.serge.y + 18, w: 10, h: 18, vx: CFG.baseSpeed + 55, phase: 0 }
    }
    if (S.roller) {
      const ro = S.roller
      ro.x += ro.vx * dt
      ro.y += (S.serge.y + 18 - ro.y) * 0.5 * dt
      const ahead = ro.x - S.serge.x
      S.lookWindow = ahead > 0 && ahead < 110 && !S.looked ? 1 : 0
      if (ahead > 0 && ahead < 110 && !S.looked && !ro.shown) { ro.shown = true; pop(ro.x, ro.y - 28, 'R : REGARDER ?', '#ffe060') }
      if (ro.x - S.camX > GW + 40 || ro.x - S.camX < -60) { S.roller = { gone: true, x: 1e9, y: 0 }; S.lookWindow = 0 }
    }
    // L'acteur non accompagné : une seule fois, planté en haut du trottoir avec son ballon.
    if (!S.acteur && S.t >= CFG.acteurAt) {
      S.acteur = { type: 'acteur', k: 'ACTEUR', x: S.camX + GW + 30, y: CFG.sidewalkTop + 6, w: 10, h: 18, solid: true, state: 'walk', vx: 0, vy: 0, phase: 0, bubbleT: 0, bubble: '', hailed: false }
      S.ents.push(S.acteur)
      // La femme au chapeau de paille, à côté de lui.
      S.ents.push({ type: 'femme', k: 'FEMME', x: S.acteur.x - 18, y: S.acteur.y + 2, w: 10, h: 18, solid: true, state: 'walk', vx: 0, vy: 0, phase: 0 })
    }
    if (S.acteur && !S.acteur.hailed && S.acteur.x - S.serge.x < 70) {
      S.acteur.hailed = true
      S.acteur.bubble = 'HOUHOU ! KARA !'
      S.acteur.bubbleT = 2.5
    }
    if (S.acteur) S.acteur.bubbleT = Math.max(0, S.acteur.bubbleT - dt)
    // O D I L E, peint sur les dalles.
    if (!S.odile && S.t >= CFG.odileAt) {
      S.odile = true
      S.ents.push({ type: 'odile', x: S.camX + GW + 120, y: 150 })
    }
    // La mamie et son caddie : à 40 s, zigzague en haut du trottoir ; le camion l'écrase après.
    if (!S.mamie && S.t >= CFG.mamieAt) {
      S.mamie = { type: 'ped', k: 'MAMIE + CADDIE', x: S.camX + GW + 20, y: CFG.sidewalkTop + 12, w: 26, h: 16, phase: 0, col: '#e0e0e0', vx: -12, vy: 40, state: 'walk', solid: true, mamie: true }
      S.ents.push(S.mamie)
    }
    if (S.mamie && S.mamie.state === 'walk') {
      const m = S.mamie
      m.vy += (S.serge.y - m.y) * 0.9 * dt
      m.vy = Math.max(-45, Math.min(45, m.vy))
      // Camion : part quand Serge l'a dépassée ou qu'elle est trop à gauche
      if (!S.truck && m.x < S.serge.x + 90) {
        S.truck = { x: m.x + 10, y: CFG.roadTop - 30, w: 54, h: 26, vy: 170, t: 0, target: m }
        pop(m.x, CFG.roadBottom, 'TUUUT', '#ffffff', true)
        audio.horn()
      }
    }
    if (S.truck) {
      const tr = S.truck
      tr.t += dt
      tr.x += -5 * dt
      if (!tr.done && tr.y < tr.target.y - 10) tr.y += tr.vy * dt
      else if (!tr.done) {
        tr.done = true
        const m = tr.target
        if (m.state === 'walk') {
          m.state = 'splat'; m.solid = false; m.downT = 0
          S.shake = 0.5
          addScore(CFG.score.mamie, m.x, m.y, 'MAMIE !')
          audio.splat()
          audio.explode()
          S.ents.push({ type: 'boom', x: m.x, y: m.y, t: 0, big: true })
        } else pop(m.x, m.y - 20, 'TROP TARD POUR LE CAMION', '#aaaaaa')
        S.mamieDone = true
      } else {
        tr.y -= 90 * dt // repart en marche arrière vers la route
        if (tr.y < -60) S.truck = null
      }
    }
  }

  function updateIntro(dt) {
    S.introT += dt
    const it = S.intro
    it.lineT += dt
    // Les passants continuent de passer pendant la discussion.
    for (const e of S.ents) {
      if (e.type !== 'ped' || e.state !== 'walk' || e.leash) continue
      e.x += e.vx * dt
      if (e.x < -40) e.x += GW + 80
    }
    // À « séropositive », le tueur traverse derrière eux ; Serge le voit et détale.
    if (it.line === DIALOG.length - 1) {
      if (it.lineT > 0.5) S.killer.x += 230 * dt
      if (S.killer.x > S.serge.x + 50) startRun()
    }
  }

  /* ---------- mise à jour ---------- */
  function update(dt) {
    S.clock += dt
    if (S.mode === 'intro') { updateIntro(dt); return }
    if (S.mode === 'over') { const was = S.overT; S.overT += dt; if (was < 1.8 && S.overT >= 1.8) audio.stamp(); return }
    if (S.martine) { S.martine.bubbleT = Math.max(0, S.martine.bubbleT - dt) }
    const sg = S.serge

    if (S.mode === 'jump') { updateJump(dt); return }

    S.t += dt
    if (S.t >= CFG.duration) { beginJump(); return }
    const left = Math.ceil(CFG.duration - S.t)
    if (left <= 10 && left !== S.lastTick) { S.lastTick = left; audio.tick(left <= 3) }

    // vitesse caméra
    S.boostT = Math.max(0, S.boostT - dt)
    S.tripT = Math.max(0, S.tripT - dt)
    S.invertT = Math.max(0, S.invertT - dt)
    if (S.invertT <= 0) sg.face = 1
    const targetMul = S.tripT > 0 ? CFG.tripSpeed : S.boostT > 0 ? CFG.boostSpeed : 1
    S.speedMul += (targetMul - S.speedMul) * Math.min(1, dt * 10)
    const camV = CFG.baseSpeed * S.speedMul
    S.camX += camV * dt
    S.serge.x += camV * dt

    // contrôles
    let dy = (held.down ? 1 : 0) - (held.up ? 1 : 0)
    let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0)
    if (laneTarget != null) { const d = laneTarget - sg.y; dy = Math.abs(d) < 3 ? 0 : Math.sign(d) }
    if (S.invertT > 0) { dy = -dy; dx = -dx }
    if (S.tripT > 0) { dy *= 0.3; dx = 0 }
    sg.y = Math.max(CFG.sidewalkTop, Math.min(CFG.sidewalkBottom, sg.y + dy * CFG.laneSpeed * dt))
    // avancer/reculer : décale Serge dans le cadre, et il revient doucement chez lui
    let rel = sg.x - S.camX
    if (dx !== 0) rel += dx * CFG.slideSpeed * dt
    else rel += (CFG.sergeHomeX - rel) * Math.min(1, dt * 2)
    rel = Math.max(CFG.sergeMinX, Math.min(CFG.sergeMaxX, rel))
    sg.x = S.camX + rel

    // jauge
    S.fart = Math.min(1, S.fart + CFG.fartRecharge * dt)

    // tueur
    S.killer.x += (S.camX + 440 - S.killer.x) * Math.min(1, dt * 2.5) + camV * dt * 0.2
    S.killer.x = Math.min(S.killer.x, S.camX + 440)
    S.killer.y += (sg.y + Math.sin(S.t * 0.7) * 30 - S.killer.y) * dt * 0.8
    S.killer.y = Math.max(CFG.sidewalkTop, Math.min(CFG.sidewalkBottom, S.killer.y))
    S.killer.taunt -= dt
    S.killer.tauntT = Math.max(0, S.killer.tauntT - dt)
    if (S.killer.taunt <= 0) { S.killer.taunt = 6 + S.r() * 6; S.killer.tauntT = 1.1; audio.taunt(); pop(S.killer.x, S.killer.y - 28, ['HÉ HÉ', 'TROP LENT', 'ALLEZ SERGE', 'À PLUS'][(S.r() * 4) | 0], '#ff8080') }

    updateScripts(dt)

    // spawn devant
    while (S.spawnX < S.camX + GW + 200) spawnChunk()

    // entités
    for (let i = S.ents.length - 1; i >= 0; i--) {
      const e = S.ents[i]
      if (e.type === 'boom') { e.t += dt; if (e.t > 0.6) S.ents.splice(i, 1); continue }
      if (e.x < S.camX - 120) { S.ents.splice(i, 1); continue }
      if (e.type === 'scorch' || e.type === 'odile') continue
      if (e.type === 'debris') {
        e.t += dt
        if (e.z > 0 || e.vz > 0) { e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 320 * dt; e.z = Math.max(0, e.z + e.vz * dt); if (e.z === 0) e.vz = 0 }
        continue
      }
      if (e.type === 'ped' && e.state === 'walk') {
        if (e.leash) { e.x += (e.leash.x + 14 - e.x) * 3 * dt; e.y += (e.leash.y + 3 - e.y) * 3 * dt; if (e.leash.state !== 'walk') e.leash = null }
        else {
          e.x += e.vx * dt; e.y += e.vy * dt
          if (e.y < CFG.sidewalkTop + 2 || e.y > CFG.sidewalkBottom - 2) e.vy = -e.vy
          e.y = Math.max(CFG.sidewalkTop + 2, Math.min(CFG.sidewalkBottom - 2, e.y))
          // évitement mou du tueur et de Serge : les gens se retournent un peu
          if (S.r() < dt * 0.3) e.vy = (S.r() - 0.5) * 16
        }
      } else if (e.state === 'fly') {
        e.x += e.vx * dt; e.y += e.vy * dt
        e.vz -= 320 * dt; e.z += e.vz * dt
        if (e.z <= 0) {
          e.z = 0
          if (e.y >= CFG.beachTop) {
            e.state = 'gone'; S.ents.splice(i, 1)
            S.ents.push({ type: 'boom', x: e.x, y: e.y, t: 0 })
            S.ents.push({ type: 'scorch', x: e.x, y: e.y })
            for (let d = 0; d < 4; d++) S.ents.push({ type: 'debris', kind: (S.r() * 5) | 0, x: e.x, y: e.y, z: 2, vx: (S.r() - 0.5) * 120, vy: (S.r() - 0.5) * 60, vz: 60 + S.r() * 90, t: 0 })
            addScore(CFG.score.explode, e.x, e.y, 'PLAGE')
            audio.explode()
            S.shake = Math.max(S.shake, 0.2)
          } else {
            e.state = e.y <= CFG.roadBottom ? 'road' : 'down'; e.downT = 0
            addScore(CFG.score.knock, e.x, e.y, e.state === 'road' ? 'ROUTE' : 'À PLAT')
            S.ents.push({ type: 'boom', x: e.x, y: e.y - 4, t: 0, small: true })
            S.shake = Math.max(S.shake, 0.1)
            audio.knock()
            audio.explode()
          }
        }
      } else if (e.state === 'down' || e.state === 'splat' || e.state === 'road') {
        e.downT += dt
      }
      if (e.type === 'mime') e.pose += dt

      // collision avec Serge
      if (e.solid && S.tripT <= 0) {
        const hw = e.type === 'mime' ? 4 : e.w / 2
        const hh = e.type === 'mime' ? e.wallH / 2 : Math.max(5, e.h * 0.35)
        if (Math.abs(e.x - sg.x) < hw + sg.w / 2 - 1 && Math.abs(e.y - sg.y) < hh + 5) {
          trip(e)
          pop(sg.x, sg.y - 30, e.type === 'mime' ? 'CON DE MIME !' : e.type === 'furn' ? e.k.toUpperCase() + ' !' : 'PARDON !', '#ff5050', e.type === 'mime')
        }
      }
      // esquive : l'entité passe derrière Serge sans l'avoir touché
      if (!e.passed && e.x < sg.x - 2 && e.type !== 'boom') {
        e.passed = true
        if (e.solid && (e.state === 'walk' || e.type === 'furn' || e.type === 'mime') && S.tripT <= 0) {
          const d = Math.abs(e.y - sg.y)
          const near = e.type === 'mime' ? e.wallH / 2 + 14 : CFG.nearMissDist
          if (d < near) {
            S.combo++
            S.comboBump = 1
            audio.nearMiss(S.combo)
            S.bestCombo = Math.max(S.bestCombo, S.combo)
            S.fart = Math.min(1, S.fart + CFG.fartNearMiss)
            addScore(CFG.score.nearMiss, sg.x, sg.y, e.type === 'mime' ? 'MUR ÉVITÉ' : null)
            if (S.combo % 5 === 0) audio.combo(mult())
            if (S.combo % 5 === 0) pop(sg.x, sg.y - 40, 'COMBO ' + S.combo + '  ×' + mult(), '#80e0ff', true)
          }
        }
      }
    }

    // effets
    for (let i = S.gas.length - 1; i >= 0; i--) { S.gas[i].t += dt; if (S.gas[i].t > 0.7) S.gas.splice(i, 1) }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.t += dt; p.y -= (p.big ? 14 : 22) * dt; if (p.t > (p.big ? 1.6 : 1.2)) S.pops.splice(i, 1) }
    // Le score affiché rattrape le vrai, et pulse à chaque gain.
    S.scoreShown += (S.score - S.scoreShown) * Math.min(1, dt * 8)
    if (S.score - S.scoreShown < 1) S.scoreShown = S.score
    S.scoreBump = Math.max(0, S.scoreBump - dt * 3)
    S.comboBump = Math.max(0, S.comboBump - dt * 3)
    S.scoreGainT = Math.max(0, S.scoreGainT - dt)
    if (S.scoreGainT === 0) S.scoreGain = 0
    S.shake = Math.max(0, S.shake - dt)
  }

  /* ---------- le saut final ---------- */
  /*
   * Le chrono tombe : devant Serge, le kiosque des cascades, et derrière lui une manifestation
   * de mimes avec banderole. Serge grimpe sur le kiosque, hurle « Barrez-vous, cons de mime ! »,
   * et saute par-dessus. Plus le score est haut, plus il va loin.
   */
  const KIOSK_W = 62
  const KIOSK_H = 44
  function jumpMeters() {
    const m = 2 + S.score / 1500 + S.bestCombo * 0.08 + S.fart * 0.5
    return Math.round(Math.min(18, m) * 100) / 100
  }
  function beginJump() {
    S.mode = 'jump'
    const sg = S.serge
    S.boostT = 0; S.tripT = 0; S.invertT = 0; sg.face = 1
    const kx = S.camX + GW + 60 // hors champ : il arrive en défilant, comme le reste
    const ky = 150
    // Rien ne disparaît à l'écran ; seul ce qui est déjà au-delà du kiosque est retiré.
    S.ents = S.ents.filter((e) => e.x < kx - 40 || e.type === 'scorch' || e.type === 'odile')
    S.ents.push({ type: 'cascades', x: kx, y: ky - 0.5 })
    const r = S.r
    for (let i = 0; i < 16; i++) {
      const x = kx + KIOSK_W + 18 + i * 7 + r() * 6
      const y = CFG.sidewalkTop + 8 + r() * (CFG.sidewalkBottom - CFG.sidewalkTop - 12)
      S.ents.push({ type: 'mime', k: 'CON DE MIME', x, y, w: 10, h: 18, solid: false, wallH: 0, state: 'crowd', pose: r() * 2, shocked: false })
    }
    S.ents.push({ type: 'banderole', x: kx + KIOSK_W + 75, y: CFG.sidewalkTop + 4 })
    // La tapette géante, juste après le point d'atterrissage : le tueur s'est fait attraper.
    const meters = jumpMeters()
    const landing = kx + KIOSK_W - 8 + 16 + meters * 16
    S.ents.push({ type: 'tapette', x: Math.max(landing + 75, kx + 250), y: ky + 6 })
    S.roller = { gone: true, x: 1e9, y: 0 }
    S.lookWindow = 0
    S.jump = { t: 0, meters, phase: 'run', kx, ky, z: 0 }
  }
  function updateJump(dt) {
    const j = S.jump
    j.t += dt
    const sg = S.serge
    const follow = (target, k) => { S.camX += (target - S.camX) * Math.min(1, dt * k) }
    if (j.phase === 'run') {
      // Il fonce vers le kiosque, et se recale sur sa ligne.
      sg.x += 170 * dt
      sg.y += (j.ky - sg.y) * Math.min(1, dt * 4)
      follow(sg.x - CFG.sergeHomeX, 8)
      if (sg.x >= j.kx) { j.phase = 'climb'; j.t = 0; sg.y = j.ky; audio.climb() }
    } else if (j.phase === 'climb') {
      const p = Math.min(1, j.t / 0.55)
      sg.x = j.kx + p * (KIOSK_W - 8)
      j.z = p * KIOSK_H
      follow(sg.x - 160, 8)
      if (p >= 1) { j.phase = 'shout'; j.t = 0; S.shake = 0.15; audio.duck(0.35); audio.shout() }
    } else if (j.phase === 'shout') {
      follow(sg.x - 160, 8)
      if (j.t > 0.3) for (const e of S.ents) if (e.type === 'mime' && e.state === 'crowd' && !e.shocked && S.r() < dt * 6) { e.shocked = true; if (S.r() < 0.4) audio.gasp() }
      if (j.t > 1.6) { j.phase = 'air'; j.t = 0; j.xStart = sg.x; j.dist = 16 + j.meters * 16; audio.duck(1); audio.jump() }
    } else if (j.phase === 'air') {
      const dur = 0.9 + j.meters * 0.07
      const p = Math.min(1, j.t / dur)
      sg.x = j.xStart + p * j.dist
      j.z = KIOSK_H * (1 - p) + Math.sin(p * Math.PI) * (24 + j.meters * 2.5)
      follow(sg.x - 200, 6)
      for (const e of S.ents) if (e.type === 'mime' && e.state === 'crowd' && !e.shocked && e.x < sg.x + 10) e.shocked = true
      if (p >= 1) { j.phase = 'land'; j.t = 0; j.z = 0; S.shake = 0.3; S.gas.push({ x: sg.x, y: sg.y, t: 0.2, dust: true }); audio.land(); setTimeout(() => audio.fanfare(), 400) }
    } else if (j.phase === 'land') {
      follow(sg.x - 200, 6)
      if (j.t > 1.8) {
        const bonus = Math.round(j.meters * CFG.score.meter)
        S.score += bonus
        S.jump.bonus = bonus
        S.mode = 'over'; S.overT = 0
        audio.duck(0.4)
        if (S.score > best) { best = S.score; try { localStorage.setItem('consDeMime:best', String(best)) } catch {} }
      }
    }
    for (const e of S.ents) if (e.type === 'mime') e.pose += dt
    for (const e of S.ents) if (e.type === 'ped' && e.state === 'walk' && !e.leash) { e.x += e.vx * dt; e.y += e.vy * dt }
    for (let i = S.gas.length - 1; i >= 0; i--) { S.gas[i].t += dt; if (S.gas[i].t > 0.7) S.gas.splice(i, 1) }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.t += dt; p.y -= 10 * dt; if (p.t > 2) S.pops.splice(i, 1) }
    S.shake = Math.max(0, S.shake - dt)
  }

  /* ---------- dessin ---------- */
  const SPR = cacheSprites(buildSprites(CFG))
  const LOGO = toCanvas(logoLine('CONS DE MIME !'))
  const LOGO2 = toCanvas(logoLine('J\'AI DU PAPIER', [P.redD, P.red, P.red, P.pink, P.white]))

  /** Pix → canvas, récursivement ; chaque canvas garde son miroir dans .m. */
  function cacheSprites(node) {
    if (node instanceof Pix) {
      const c = toCanvas(node)
      c.m = toCanvas(mirror(node))
      return c
    }
    if (Array.isArray(node)) return node.map(cacheSprites)
    const out = {}
    for (const k of Object.keys(node)) out[k] = cacheSprites(node[k])
    return out
  }
  function blit(c, x, y, flip = false) {
    const img = flip ? c.m : c
    ctx.drawImage(img, Math.round(x) - img.ax, Math.round(y) - img.ay)
  }
  function blitRot(c, x, y, angle) {
    ctx.save()
    ctx.translate(Math.round(x), Math.round(y))
    ctx.rotate(angle)
    ctx.drawImage(c, -c.ax, -c.ay)
    ctx.restore()
  }
  const text5 = (t, x, y, col = P.white, style = { shadow: P.ink }) => drawText5(ctx, t, x, y, col, style)
  const text5C = (t, cx, y, col = P.white, style = { shadow: P.ink }) => drawText5C(ctx, t, cx, y, col, style)
  const text3 = (t, x, y, col = P.white) => drawText(ctx, t, x, y, col)
  const text3C = (t, cx, y, col = P.white) => drawTextC(ctx, t, cx, y, col)
  /** Police 5×7 agrandie (entier ou non) autour de (cx, y haut), nette grâce au nearest. */
  function text5Scaled(t, cx, y, col, scale, style = { outline: P.ink }) {
    ctx.save()
    ctx.translate(Math.round(cx), Math.round(y))
    ctx.scale(scale, scale)
    drawText5C(ctx, t, 0, 0, col, style)
    ctx.restore()
  }
  const mod = (a, n) => ((a % n) + n) % n
  const lookKey = (k) => (k === 'vieux+chien' ? 'vieux' : k)
  const walkFrame = (e) => mod(Math.floor(S.clock * 6 + (e.phase || 0)), 2)

  function drawGround(cam) {
    // La tuile de sol, répétée.
    const off = -(((cam % TILE_W) + TILE_W) % TILE_W)
    for (let x = off - TILE_W; x < GW + TILE_W; x += TILE_W) ctx.drawImage(SPR.tile, Math.round(x), 0)
    // Les façades au-dessus de la route : un bâtiment tous les 160 px, le Palais au départ.
    // Le Palais lui-même au départ, à la place de la route ; les façades au-delà.
    if (cam < PALAIS_W + 40) ctx.drawImage(SPR.palais, Math.round(-cam), 0)
    const k0 = Math.max(3, Math.floor(cam / 160) - 1)
    for (let k = k0; k <= k0 + 4; k++) {
      const x = k * 160 - cam
      let c
      if (mod(k, 10) === 9) c = SPR.facade.carlton
      else if (mod(k, 3) === 2) c = SPR.facade.boutique
      else c = SPR.facade.hotel[mod(k, 3)]
      blit(c, x, CFG.roadTop)
    }
    // Serviettes et parasols sur la plage, un bateau au large.
    const o60 = Math.floor(cam / 60) - 1
    for (let k = o60; k <= o60 + 9; k++) {
      const x = k * 60 - cam + 28
      blit(SPR.serviette[mod(k * 7, 4)], x + mod(k * 13, 20) - 10, CFG.beachTop + 36 + mod(k * 5, 6))
      blit(SPR.parasol[mod(k * 3, 4)], x, CFG.beachTop + 22 + mod(k * 11, 5))
    }
    const bx = ((S.t * 6 + 300) % 1200) - 100
    blit(SPR.bateau, bx, CFG.seaTop + 16)
  }
  function drawPalmsBack(cam) {
    // Rangée de palmiers derrière la haie (dessinés avant le monde, ils sont derrière).
    const k0 = Math.floor(cam / 80) - 1
    for (let k = k0; k <= k0 + 7; k++) blit(SPR.palm[mod(k, 2)], k * 80 - cam + 20, CFG.roadBottom + 8)
  }
  function drawPalmsFront(cam) {
    // Palmiers du muret côté plage : au-dessus du trottoir, ils cachent un peu les pieds.
    const k0 = Math.floor(cam / 80) - 1
    for (let k = k0; k <= k0 + 7; k++) blit(SPR.palm[mod(k + 1, 2)], k * 80 - cam + 60, CFG.beachTop + 2)
  }

  function drawWorld() {
    const cam = S.camX
    const shx = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 14 : 0
    const shy = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 14 : 0
    ctx.save()
    ctx.translate(Math.round(shx), Math.round(shy))
    drawGround(cam)
    drawPalmsBack(cam)

    // Marques au sol d'abord.
    for (const e of S.ents) if (e.type === 'scorch') blit(SPR.scorch, e.x - cam, e.y)
    for (const e of S.ents) if (e.type === 'odile') blit(SPR.odile, e.x - cam, e.y)

    // Tout ce qui a des pieds, trié par profondeur (y), Serge et le tueur compris.
    const list = S.ents.filter((e) => e.type !== 'scorch' && e.type !== 'odile').map((e) => ({ y: e.y, e }))
    list.push({ y: S.serge.y, serge: true })
    if (S.mode !== 'jump' && S.killer.x > cam - 40) list.push({ y: S.killer.y, killer: true })
    if (S.roller && !S.roller.gone) list.push({ y: S.roller.y, roller: true })
    if (S.truck) list.push({ y: S.truck.y, truck: true })
    list.sort((a, b) => a.y - b.y)
    for (const it of list) {
      if (it.serge) drawSerge(cam)
      else if (it.killer) drawKiller(cam)
      else if (it.roller) {
        const ro = S.roller
        blit(SPR.shadow.m, ro.x - cam, ro.y)
        blit(SPR.roller[Math.floor(S.t * 8) % 2], ro.x - cam, ro.y)
      } else if (it.truck) blit(SPR.truck, S.truck.x - cam, S.truck.y)
      else drawEntity(it.e, cam)
    }

    // Gaz par-dessus.
    for (const g of S.gas) {
      const f = Math.min(3, Math.floor((g.t / 0.7) * 4))
      if (g.dust) { ctx.globalAlpha = 0.5; for (let k = -1; k <= 1; k++) blit(SPR.shadow.l, g.x - cam + k * 10 * (1 + g.t), g.y - 2 - g.t * 6); ctx.globalAlpha = 1; continue }
      for (let k = 0; k < 3; k++) blit(SPR.gas[f], g.x - cam - g.t * 50 - k * 9, g.y - 8 + Math.sin(k + g.t * 9) * 3)
    }
    drawPalmsFront(cam)

    if (debug) {
      const sg = S.serge
      const sx = sg.x - cam
      ctx.strokeStyle = '#0f0'
      ctx.strokeRect(sx - sg.w / 2 + 0.5, sg.y - 5 + 0.5, sg.w - 1, 10)
      for (const e of S.ents) {
        if (!e.solid) continue
        const x = e.x - cam
        const hw = e.type === 'mime' ? 4 : e.w / 2
        const hh = e.type === 'mime' ? e.wallH / 2 : Math.max(5, e.h * 0.35)
        ctx.strokeStyle = '#f0f'
        ctx.strokeRect(x - hw + 0.5, e.y - hh + 0.5, hw * 2, hh * 2)
      }
      ctx.strokeStyle = '#0ff'
      ctx.strokeRect(sx - CFG.fartCone.back + 0.5, sg.y - CFG.fartCone.half + 0.5, CFG.fartCone.back + CFG.fartCone.front, CFG.fartCone.half * 2)
    }

    // Popups.
    for (const p of S.pops) {
      const a = Math.min(1, (1.2 - p.t) * 3)
      ctx.globalAlpha = Math.max(0, a)
      if (p.big) {
        const sc = 1 + Math.max(0, 0.3 - p.t) // il tape en apparaissant
        text5Scaled(p.text, p.x - cam, p.y - 10, p.col, 2 * sc, { outline: P.ink })
      } else text5C(p.text, p.x - cam, p.y - 6, p.col, { outline: P.ink })
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  function drawSerge(cam) {
    const sg = S.serge
    const sx = sg.x - cam
    const jz = S.mode === 'jump' && S.jump.z ? S.jump.z : 0
    blit(SPR.shadow.m, sx, sg.y)
    if (S.tripT > 0) {
      blit(SPR.sergeTrip, sx, sg.y)
      if (Math.floor(S.t * 8) % 2) text3C('AÏE', sx, sg.y - 18, P.yellow)
      return
    }
    if (S.mode === 'jump' && (S.jump.phase === 'air' || S.jump.phase === 'land')) {
      if (S.jump.phase === 'air') blit(SPR.sergeJump, sx, sg.y - jz)
      else blit(SPR.serge[1], sx, sg.y)
      return
    }
    if (S.mode === 'jump' && S.jump.phase === 'shout') {
      blit(SPR.sergeBoost[Math.floor(S.jump.t * 10) % 2 ? 1 : 3], sx, sg.y - jz)
      return
    }
    if (S.mode === 'intro') {
      // Debout face à Martine ; il se retourne vers le tueur quand il passe.
      const turned = S.intro.line === DIALOG.length - 1 && S.intro.lineT > 0.7
      blit(SPR.serge[1], sx, sg.y, turned)
      return
    }
    const f = Math.floor((S.mode === 'jump' ? S.jump.t * 14 : S.t * 12 * Math.max(0.5, S.speedMul))) % 4
    const set = S.boostT > 0 ? SPR.sergeBoost : sg.face < 0 ? SPR.sergeLook : SPR.serge
    blit(set[f], sx, sg.y - jz)
  }
  function drawKiller(cam) {
    const kx = S.killer.x - cam
    const ky = S.killer.y
    blit(SPR.shadow.m, kx, ky)
    if (S.killer.tauntT > 0) blit(SPR.killerTaunt, kx, ky)
    else blit(SPR.killer[Math.floor(S.clock * 12) % 4], kx, ky)
  }
  function drawEntity(e, cam) {
    const x = e.x - cam
    if (x < -60 || x > GW + 60) return
    if (e.type === 'boom') {
      const f = Math.min(3, Math.floor((e.t / 0.6) * 4))
      if (e.small) { blit(SPR.boomSmall[f], x, e.y - 6); return }
      blit(e.big ? SPR.boomBig[f] : SPR.boom[f], x, e.y - 6)
      return
    }
    if (e.type === 'debris') {
      blit(SPR.debris[e.kind], x, e.y - e.z)
      return
    }
    if (e.type === 'furn') {
      blit(SPR.furn[e.k], x, e.y)
      return
    }
    if (e.type === 'femme') {
      if (e.state === 'walk') {
        blit(SPR.shadow.m, x, e.y)
        blit(SPR.femme[0], x, e.y)
      } else if (e.state === 'fly') blitRot(SPR.femme[0], x, e.y - e.z, e.spin * e.z * 0.02)
      else blit(SPR.pedLying.vieux[2], x, e.y)
      return
    }
    if (e.type === 'acteur') {
      if (e.state === 'walk') {
        blit(SPR.shadow.m, x, e.y)
        blit(SPR.acteur[Math.floor(S.clock * 2) % 2], x, e.y)
        if (e.bubbleT > 0) bubble(e.bubble, x, e.y - 40)
      } else if (e.state === 'fly') blitRot(SPR.acteur[0], x, e.y - e.z, e.spin * e.z * 0.02)
      else blit(SPR.pedLying.touriste[0], x, e.y)
      return
    }
    if (e.type === 'martine') {
      blit(SPR.shadow.s, x, e.y)
      const talking = S.mode === 'intro' && DIALOG[S.intro.line] && DIALOG[S.intro.line].who === 'martine' && Math.floor(S.clock * 8) % 2
      blit(SPR.martine[talking ? 1 : 0], x, e.y, true)
      if (e.bubbleT > 0) bubble(e.bubble, x, e.y - 30)
      return
    }
    if (e.type === 'cascades') {
      blit(SPR.cascades, x, e.y)
      return
    }
    if (e.type === 'tapette') {
      blit(SPR.tapette, x, e.y)
      if (S.mode === 'jump' && S.jump.phase === 'land' && Math.floor(S.jump.t * 3) % 2) text3C('ATTRAPÉ !', x, e.y - 48, P.yellow)
      return
    }
    if (e.type === 'banderole') {
      blit(SPR.mime[0], x - 30, e.y + 20)
      blit(SPR.mime[1], x + 30, e.y + 20)
      blit(SPR.banderole, x, e.y + 2)
      return
    }
    if (e.type === 'mime' && e.state === 'crowd') {
      blit(SPR.shadow.m, x, e.y)
      blit(e.shocked ? SPR.mimeShocked : SPR.mime[Math.floor(e.pose * 3) % 2], x, e.y - (e.shocked ? Math.abs(Math.sin(e.pose * 10)) * 2 : 0))
      if (e.shocked && Math.floor(e.pose * 4) % 3 === 0) text3C('!', x, e.y - 26, P.white)
      return
    }
    if (e.type === 'mime') {
      // Le mur mimé : une vitre à peine visible, bien réelle.
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(Math.round(x) - 4, Math.round(e.y - e.wallH / 2), 9, e.wallH)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      for (let yy = -e.wallH / 2; yy < e.wallH / 2; yy += 4) {
        ctx.fillRect(Math.round(x) - 4, Math.round(e.y + yy), 1, 2)
        ctx.fillRect(Math.round(x) + 4, Math.round(e.y + yy + 2), 1, 2)
      }
      blit(SPR.shadow.m, x, e.y)
      blit(SPR.mime[Math.floor(e.pose * 3) % 2], x, e.y)
      return
    }
    // Piétons.
    if (e.k === 'chien') {
      if (e.state === 'walk') {
        if (e.leash && e.leash.state === 'walk') {
          ctx.strokeStyle = P.plum
          ctx.beginPath()
          ctx.moveTo(Math.round(e.leash.x - cam) + 0.5, Math.round(e.leash.y) - 8.5)
          ctx.lineTo(Math.round(x) + 0.5, Math.round(e.y) - 6.5)
          ctx.stroke()
        }
        blit(SPR.chien[walkFrame(e)], x, e.y, e.vx < 0)
      } else if (e.state === 'fly') blitRot(SPR.chien[0], x, e.y - e.z, e.spin * e.z * 0.02)
      else blit(SPR.chienLying, x, e.y)
      return
    }
    if (e.mamie) {
      if (e.state === 'walk') blit(SPR.mamie[walkFrame(e)], x, e.y, true)
      else if (e.state === 'splat') blit(SPR.mamieSplat, x, e.y)
      else if (e.state === 'fly') blitRot(SPR.mamie[0], x, e.y - e.z, e.spin * e.z * 0.02)
      else blit(SPR.mamieLying, x, e.y)
      return
    }
    const set = SPR.ped[lookKey(e.k)]
    const v = (e.variant || 0) % set.length
    if (e.state === 'walk') {
      blit(SPR.shadow.s, x, e.y)
      blit(set[v][walkFrame(e)], x, e.y, e.vx < 0)
    } else if (e.state === 'fly') {
      blit(SPR.shadow.s, x, e.y)
      blitRot(set[v][1], x, e.y - e.z, e.spin * e.z * 0.02)
    } else blit(SPR.pedLying[lookKey(e.k)][v], x, e.y)
  }

  function drawGauge(x, y, w, v, ready) {
    ctx.fillStyle = P.ink
    ctx.fillRect(x - 1, y - 1, w + 2, 8)
    ctx.fillStyle = P.slateD
    ctx.fillRect(x, y, w, 6)
    const fill = Math.round(w * v)
    ctx.fillStyle = ready ? P.green : P.greenM
    ctx.fillRect(x, y, fill, 6)
    ctx.fillStyle = ready ? P.yellow : P.green
    ctx.fillRect(x, y, fill, 1)
    if (ready && Math.floor(S.t * 6) % 2) {
      ctx.fillStyle = P.white
      ctx.fillRect(x, y, w, 1)
    }
  }
  function drawHud() {
    const left = Math.max(0, CFG.duration - S.t)
    // Bandeau sombre en haut pour la lisibilité, par-dessus les façades.
    ctx.fillStyle = 'rgba(24,20,37,0.6)'
    ctx.fillRect(0, 0, GW, 24)
    // Le score, en gros, qui pulse à chaque gain ; le gain en cours flotte à côté.
    const sc = 2 + S.scoreBump * 0.5
    const shown = String(Math.round(S.scoreShown)).padStart(6, '0')
    text5('SCORE', 4, 2, P.grey1, {})
    text5Scaled(shown, 4 + textWidth5(shown) + 2 + (sc - 2) * 12, 11 - (sc - 2) * 6, S.scoreBump > 0.5 ? P.white : P.yellow, sc, { shadow: P.ink })
    if (S.scoreGain > 0) text5('+' + S.scoreGain, 4 + textWidth5(shown) * 2 + 10, 12, P.green, { outline: P.ink })
    const clock = left.toFixed(1).replace('.', ',')
    text5Scaled(clock, GW / 2, 2, left < 10 && Math.floor(S.t * 4) % 2 ? P.red : P.white, 2, { shadow: P.ink })
    // Le combo : le multiplicateur en géant à droite, la série dessous, le tout qui pulse.
    const m = mult()
    if (S.combo > 0) {
      const cs = 2.2 + S.comboBump * 0.8
      const col = m >= 5 ? P.hot : m >= 4 ? P.orange : m >= 3 ? P.cyan : m >= 2 ? P.yellow : P.white
      text5Scaled('×' + m, GW - 24, 1 - (cs - 2.2) * 5, col, cs, { outline: P.ink })
      text5('COMBO ' + S.combo, GW - 44 - textWidth5('COMBO ' + S.combo), 7, S.comboBump > 0.5 ? P.white : P.grey1, {})
      // Les crans jusqu'au prochain palier.
      const next = S.combo >= 20 ? 20 : Math.ceil((S.combo + 1) / 5) * 5
      const from = next - 5
      for (let i = 0; i < 5; i++) { ctx.fillStyle = S.combo - from > i ? col : P.slateD; ctx.fillRect(GW - 44 - 30 + i * 6, 18, 4, 3) }
    } else text5('RECORD ' + String(best).padStart(6, '0'), GW - 4 - textWidth5('RECORD ' + String(best).padStart(6, '0')), 2, P.grey1, {})
    // Jauge de prout en bas à gauche, sur la mer.
    drawGauge(4, GH - 10, 80, S.fart, S.fart >= CFG.fartMin)
    text3(S.fart >= 1 ? (pointerTouch ? 'PROUT MAX  TAP À DROITE' : 'PROUT MAX  ESPACE') : S.fart >= CFG.fartMin ? 'PROUT ' + Math.round(S.fart * 100) + '%  (PETIT)' : 'PROUT ' + Math.round(S.fart * 100) + '%', 4, GH - 20, S.fart >= 1 ? P.yellow : S.fart >= CFG.fartMin ? P.green : P.grey1)
    if (S.mode === 'run') text3('TUEUR : 320 M  (TOUJOURS)', GW - 4 - textWidth('TUEUR : 320 M  (TOUJOURS)'), GH - 12, P.pink)
    if (S.invertT > 0) text5C('CONTRÔLES INVERSÉS', GW / 2, 28, P.yellow, { outline: P.ink })
    if (S.lookWindow > 0) text5C(pointerTouch ? 'TAP À GAUCHE : LA REGARDER ?' : 'R : LA REGARDER ?', GW / 2, 28, P.yellow, { outline: P.ink })
    if (debug) text3(`SEED ${S.seed} · ENTS ${S.ents.length} · DENS ${density().toFixed(1)} · CAM ${S.camX | 0}`, 4, GH - 30, P.green)
  }

  /** Une bulle de dialogue en pixel, la pointe vers le bas, centrée en (cx, y bas). */
  function bubble(text, cx, y) {
    const w = textWidth(text) + 8
    const h = 13
    let x = Math.round(cx - w / 2)
    x = Math.max(2, Math.min(GW - w - 2, x))
    const top = Math.round(y - h)
    ctx.fillStyle = P.ink
    ctx.fillRect(x - 1, top - 1, w + 2, h + 2)
    ctx.fillStyle = P.white
    ctx.fillRect(x, top, w, h)
    ctx.fillStyle = P.ink
    ctx.fillRect(Math.round(cx) - 2, top + h, 5, 1)
    ctx.fillRect(Math.round(cx) - 1, top + h + 1, 3, 1)
    ctx.fillRect(Math.round(cx), top + h + 2, 1, 1)
    ctx.fillStyle = P.white
    ctx.fillRect(Math.round(cx) - 1, top + h, 3, 1)
    ctx.fillRect(Math.round(cx), top + h + 1, 1, 1)
    text3(text, x + 4, top + 3, P.ink)
  }

  function drawIntro() {
    const it = S.intro
    drawWorld()
    if (it.line < 0) {
      // L'écran titre, par-dessus la scène figée.
      ctx.fillStyle = 'rgba(24,20,37,0.45)'
      ctx.fillRect(0, 0, GW, GH)
      ctx.drawImage(LOGO, Math.round(GW / 2 - LOGO.width / 2), 24)
      text3C('VOUS ÊTES À CANNES. LUI AUSSI.', GW / 2, 56, P.grey1)
      if (S.introT > 0.5 && Math.floor(S.introT * 2) % 2 === 0) text5C(pointerTouch ? 'TAPOTE POUR COMMENCER' : 'ESPACE POUR COMMENCER', GW / 2, 186, P.yellow, { outline: P.ink })
      text3C(pointerTouch ? 'GLISSE À GAUCHE : COULOIR · TAP À DROITE : PROUT · TAP À GAUCHE : REGARDER' : '↑↓ COULOIR · ←→ RECULER / AVANCER · ESPACE : PROUT · R : REGARDER', GW / 2, 220, P.grey1)
      text3C('FRÔLE LES CANNOIS POUR LE COMBO. PÈTE DESSUS POUR LES ENVOYER SUR LA PLAGE. 90 SECONDES.', GW / 2, 232, P.grey2)
      if (best) text3C('RECORD ' + best, GW / 2, 246, P.yellow)
      text3('V1', GW - 12, GH - 10, P.grey3)
      text3(audio.muted ? 'M : SON COUPÉ' : 'M : COUPER LE SON', 4, GH - 10, P.grey2)
      return
    }
    // Le dialogue : une bulle au-dessus de celui qui parle.
    const line = DIALOG[it.line]
    const speaker = line.who === 'serge' ? S.serge : S.martine
    if (it.lineT > 0.1) bubble(line.text, speaker.x - S.camX, speaker.y - 30)
    if (it.line < DIALOG.length - 1 && it.lineT > 0.6 && Math.floor(S.introT * 2) % 2 === 0) text3C(pointerTouch ? 'TAP ▶' : 'ESPACE ▶', GW / 2, GH - 20, P.grey1)
  }

  function drawOver() {
    const t = S.overT
    ctx.fillStyle = 'rgba(24,20,37,' + Math.min(0.75, t * 2) + ')'
    ctx.fillRect(0, 0, GW, GH)
    if (t < 0.3) return
    const j = S.jump
    const px = 84
    const py = 34
    const pw = 312
    const ph = 204
    ctx.fillStyle = P.ink
    ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4)
    ctx.fillStyle = P.slateD
    ctx.fillRect(px, py, pw, ph)
    ctx.fillStyle = P.slate
    ctx.fillRect(px, py, pw, 1)
    ctx.fillRect(px, py, 1, ph)
    text5C('RÉSULTATS', GW / 2, py + 6, P.white, { shadow: P.ink })
    const rows = [
      ['SAUT EN LONGUEUR', j.meters.toFixed(2).replace('.', ',') + ' M', '+' + j.bonus],
      ['MEILLEUR COMBO', '×' + (S.bestCombo >= 20 ? 5 : S.bestCombo >= 15 ? 4 : S.bestCombo >= 10 ? 3 : S.bestCombo >= 5 ? 2 : 1), S.bestCombo + ' ESQUIVES'],
      ['LA FILLE EN JAUNE', S.looked ? 'REGARDÉE' : 'RATÉE', ''],
      ['LA MAMIE', S.mamieDone && S.mamie.state === 'splat' ? 'ÉCRASÉE' : 'ÉPARGNÉE', ''],
      ['LE TUEUR', 'DANS LA TAPETTE', ''],
    ]
    rows.forEach((r, i) => {
      const y = py + 26 + i * 14
      if (t > 0.4 + i * 0.15) {
        text5(r[0], px + 12, y, P.grey1, {})
        text5(r[1], px + 212 - textWidth5(r[1]), y, P.white, {})
        text5(r[2], px + pw - 12 - textWidth5(r[2]), y, P.yellow, {})
      }
    })
    if (t > 1.3) {
      text5C('SCORE ' + S.score, GW / 2, py + 104, P.yellow, { outline: P.ink })
      if (S.score >= best && S.score > 0) text5C('RECORD !', GW / 2, py + 118, P.green, {})
    }
    if (t > 1.8) {
      // Le tampon : il tombe, rebondit, reste de travers.
      const s = Math.max(1, 1.8 - (t - 1.8) * 5)
      ctx.save()
      ctx.translate(GW / 2, py + 152)
      ctx.rotate(-0.06)
      ctx.scale(s, s)
      ctx.globalAlpha = Math.min(1, (t - 1.8) * 6)
      ctx.strokeStyle = P.red
      ctx.lineWidth = 2
      ctx.strokeRect(-LOGO2.width / 2 - 8, -22, LOGO2.width + 16, 44)
      text5C("C'EST BON,", 0, -16, P.red, {})
      ctx.drawImage(LOGO2, Math.round(-LOGO2.width / 2), -6)
      ctx.restore()
    }
    if (t > 2.5 && Math.floor(t * 2) % 2 === 0) text3C(pointerTouch ? 'TAPOTE POUR REJOUER' : 'ENTRÉE POUR REJOUER', GW / 2, py + ph - 10, P.grey1)
    text3('SEED ' + S.seed, 4, GH - 10, P.grey3)
  }

  function draw() {
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = P.ink
    ctx.fillRect(0, 0, GW, GH)
    if (S.mode === 'intro') { drawIntro(); return }
    drawWorld()
    if (S.mode === 'run' || S.mode === 'jump') drawHud()
    if (S.mode === 'jump') {
      const j = S.jump
      if (j.phase === 'shout' || (j.phase === 'air' && j.t < 0.6)) {
        const on = j.phase === 'air' || Math.floor(j.t * 6) % 4 !== 3
        if (on) {
          ctx.fillStyle = 'rgba(24,20,37,0.6)'
          ctx.fillRect(0, 40, GW, 52)
          text5Scaled('BARREZ-VOUS,', GW / 2, 42, P.yellow, 2, { outline: P.ink })
          text5Scaled('CONS DE MIME !', GW / 2, 66, P.yellow, 2, { outline: P.ink })
        }
      }
      if (j.phase === 'air' || j.phase === 'land') text5C('SAUT EN LONGUEUR', GW / 2, 30, P.white, { outline: P.ink })
      if (j.phase === 'land') text5Scaled(j.meters.toFixed(2).replace('.', ',') + ' M', GW / 2, 42, P.yellow, 2, { outline: P.ink })
      if (j.phase === 'land' && j.t > 0.8) text3C('PLUS LE SCORE EST HAUT, PLUS IL VA LOIN', GW / 2, 52, P.grey1)
    }
    if (S.mode === 'over') drawOver()
  }
  /* ---------- boucle ---------- */
  let last = performance.now()
  function frame(now) {
    let dt = (now - last) / 1000
    last = now
    // Le premier timestamp de requestAnimationFrame peut précéder le performance.now() de départ.
    if (dt > 0.1) dt = 0.1
    if (dt < 0) dt = 0
    update(dt)
    draw()
    requestAnimationFrame(frame)
  }
  reset()
  requestAnimationFrame(frame)

  return { press, release, tap, touchLane, get state() { return S }, reset, audio }
}
