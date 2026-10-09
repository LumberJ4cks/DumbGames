/*
 * CONS DE MIME ! — prototype gris v0.
 *
 * Vue de dessus, la Croisette défile de gauche à droite. Serge court après un tueur qu'il ne
 * rattrape jamais ; le joueur gagne des points en frôlant les Cannois sans les toucher, et pète
 * dessus pour les envoyer exploser sur la plage. 90 secondes, un saut en longueur final.
 *
 * Tout est en rectangles étiquetés : on teste le gameplay, pas l'art. Aucune dépendance.
 *   ?seed=42   rejoue la même partie       ?debug=1   hitboxes et chiffres
 */

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
  roadTop: 0, roadBottom: 70, beachTop: 204,
  fartRecharge: 0.10,      // jauge/s
  fartNearMiss: 0.18,      // jauge par esquive
  fartCost: 1,
  fartCone: { back: 100, front: 40, half: 58 },
  nearMissDist: 24,        // px vertical pour compter une esquive
  score: { nearMiss: 50, knock: 100, explode: 300, look: 500, mamie: 1000, meter: 100 },
  rollerAt: 20, mamieAt: 40, mimesFrom: 50,
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
  let best = +(localStorage.getItem('cdm_best') || 0)

  const held = { up: false, down: false, left: false, right: false }
  let laneTarget = null
  let S

  function reset() {
    const seed = seedParam ? +seedParam : (Math.random() * 1e9) | 0
    const r = rng(seed)
    S = {
      seed, r, mode: 'intro', t: 0, introT: 0,
      camX: 0, speedMul: 1, boostT: 0, tripT: 0,
      serge: { x: CFG.sergeHomeX, y: 137, w: 12, h: 18, face: 1 },
      killer: { y: 137, taunt: 0 },
      fart: 1, farts: [], gas: [],
      combo: 0, bestCombo: 0, score: 0,
      ents: [], pops: [], spawnX: 300, nextMimeX: 0,
      roller: null, lookWindow: 0, invertT: 0, looked: false,
      mamie: null, truck: null, mamieDone: false,
      shake: 0, flash: 0,
      jump: null, result: null,
    }
    // décor bord de trottoir : palmiers/réverbères réguliers (visuel seulement)
    // premier peuplement
    while (S.spawnX < GW + 200) spawnChunk()
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
        const e = { type: 'ped', k: p.k, x, y, w: p.w, h: p.h, col: p.col, vx: dir * p.spd * (0.6 + r() * 0.8), vy: (r() - 0.5) * 12, state: 'walk', solid: true, dog: p.dog }
        S.ents.push(e)
        if (p.dog) S.ents.push({ type: 'ped', k: 'chien', x: x + 14, y: y + 2, w: 7, h: 5, col: '#d0c090', vx: e.vx, vy: e.vy, state: 'walk', solid: true, leash: e })
        if (p.group) for (let g = 0; g < 2; g++) S.ents.push({ type: 'ped', k: 'jeune', x: x + 12 + g * 12, y: y + (r() - 0.5) * 16, w: p.w, h: p.h, col: p.col, vx: e.vx, vy: e.vy, state: 'walk', solid: true })
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
    pop(x, y - 20, (label ? label + ' ' : '') + '+' + v, '#ffe060', v >= 500)
  }

  function trip(e) {
    if (S.tripT > 0) return
    S.tripT = CFG.tripTime
    S.boostT = 0
    if (S.combo >= 5) pop(S.serge.x, S.serge.y - 30, 'COMBO PERDU', '#ff5050', true)
    S.combo = 0
    S.shake = 0.3
    if (e && e.type === 'ped') { e.state = 'down'; e.vx = e.vy = 0; e.solid = false; e.downT = 0 }
  }

  function doFart() {
    if (S.mode !== 'run' || S.fart < CFG.fartCost || S.tripT > 0) return
    S.fart -= CFG.fartCost
    S.boostT = CFG.boostTime
    S.shake = 0.15
    const sx = S.serge.x, sy = S.serge.y
    S.gas.push({ x: sx - 10, y: sy, t: 0 })
    let hit = 0
    for (const e of S.ents) {
      if (e.type === 'furn' || e.state !== 'walk' && e.state !== 'mime') continue
      const dx = e.x - sx, dy = e.y - sy
      if (dx < -CFG.fartCone.back || dx > CFG.fartCone.front || Math.abs(dy) > CFG.fartCone.half) continue
      if (e.type === 'mime') { pop(e.x, e.y - 24, 'IMMUNISÉ', '#ffffff'); continue }
      hit++
      e.state = 'fly'; e.solid = false
      e.z = 0
      e.vz = 120 + S.r() * 40
      e.vx = -60 + dx * 0.8 + S.r() * 40
      e.vy = (dy >= 0 ? 1 : -1) * (90 + Math.abs(dy) * 1.2) // vers la plage si en bas, vers la route si en haut
      e.spin = (S.r() - 0.5) * 20
    }
    if (hit >= 3) pop(sx, sy - 34, 'PROUT ×' + hit, '#80ff80', true)
  }

  function startRun() { S.mode = 'run'; S.t = 0 }

  function press(a) {
    if (a in held) held[a] = true
    if (S.mode === 'intro' && (a === 'start' || a === 'fart' || a === 'look')) { if (S.introT > 0.8) startRun(); return }
    if (S.mode === 'over' && a === 'start') { reset(); return }
    if (S.mode === 'over' && (a === 'fart' || a === 'look') && S.overT > 1.5) { reset(); return }
    if (a === 'fart') doFart()
    if (a === 'look') doLook()
  }
  /** Tactile : un doigt posé. Côté droit = prout, les écrans d'intro et de fin réagissent aux deux. */
  function tap(side) {
    if (S.mode === 'intro') { if (S.introT > 0.8) startRun(); return }
    if (S.mode === 'over') { if (S.overT > 1.5) reset(); return }
    if (side === 'R') doFart()
  }
  function release(a) { if (a in held) held[a] = false }
  function touchLane(y) { laneTarget = y }

  function doLook() {
    if (S.mode !== 'run' || S.lookWindow <= 0 || S.looked) return
    S.looked = true
    S.invertT = CFG.lookInvert
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
    // La mamie et son caddie : à 40 s, zigzague en haut du trottoir ; le camion l'écrase après.
    if (!S.mamie && S.t >= CFG.mamieAt) {
      S.mamie = { type: 'ped', k: 'MAMIE + CADDIE', x: S.camX + GW + 20, y: CFG.sidewalkTop + 12, w: 22, h: 16, col: '#e0e0e0', vx: -12, vy: 40, state: 'walk', solid: true, mamie: true }
      S.ents.push(S.mamie)
    }
    if (S.mamie && S.mamie.state === 'walk') {
      const m = S.mamie
      m.vy += (S.serge.y - m.y) * 0.9 * dt
      m.vy = Math.max(-45, Math.min(45, m.vy))
      // Camion : part quand Serge l'a dépassée ou qu'elle est trop à gauche
      if (!S.truck && m.x < S.serge.x - 10) {
        S.truck = { x: m.x + 10, y: CFG.roadTop - 30, w: 54, h: 26, vy: 170, t: 0, target: m }
        pop(m.x, CFG.roadBottom, 'TUUUT', '#ffffff', true)
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
          S.ents.push({ type: 'boom', x: m.x, y: m.y, t: 0, big: true })
        } else pop(m.x, m.y - 20, 'TROP TARD POUR LE CAMION', '#aaaaaa')
        S.mamieDone = true
      } else {
        tr.y -= 90 * dt // repart en marche arrière vers la route
        if (tr.y < -60) S.truck = null
      }
    }
  }

  /* ---------- mise à jour ---------- */
  function update(dt) {
    if (S.mode === 'intro') { S.introT += dt; return }
    if (S.mode === 'over') { S.overT += dt; return }
    const sg = S.serge

    if (S.mode === 'jump') { updateJump(dt); return }

    S.t += dt
    if (S.t >= CFG.duration) { beginJump(); return }

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
    S.killer.y += (sg.y + Math.sin(S.t * 0.7) * 30 - S.killer.y) * dt * 0.8
    S.killer.y = Math.max(CFG.sidewalkTop, Math.min(CFG.sidewalkBottom, S.killer.y))
    S.killer.taunt -= dt
    if (S.killer.taunt <= 0) { S.killer.taunt = 6 + S.r() * 6; pop(S.camX + 440, S.killer.y - 28, ['HÉ HÉ', 'TROP LENT', 'ALLEZ SERGE', 'À PLUS'][(S.r() * 4) | 0], '#ff8080') }

    updateScripts(dt)

    // spawn devant
    while (S.spawnX < S.camX + GW + 200) spawnChunk()

    // entités
    for (let i = S.ents.length - 1; i >= 0; i--) {
      const e = S.ents[i]
      if (e.type === 'boom') { e.t += dt; if (e.t > 0.6) S.ents.splice(i, 1); continue }
      if (e.x < S.camX - 120) { S.ents.splice(i, 1); continue }
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
            addScore(CFG.score.explode, e.x, e.y, 'PLAGE')
            S.shake = Math.max(S.shake, 0.2)
          } else {
            e.state = e.y <= CFG.roadBottom ? 'road' : 'down'; e.downT = 0
            addScore(CFG.score.knock, e.x, e.y, e.state === 'road' ? 'ROUTE' : 'À PLAT')
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
            S.bestCombo = Math.max(S.bestCombo, S.combo)
            S.fart = Math.min(1, S.fart + CFG.fartNearMiss)
            addScore(CFG.score.nearMiss, sg.x, sg.y, e.type === 'mime' ? 'MUR ÉVITÉ' : null)
            if (S.combo % 5 === 0) pop(sg.x, sg.y - 40, 'COMBO ' + S.combo + '  ×' + mult(), '#80e0ff', true)
          }
        }
      }
    }

    // effets
    for (let i = S.gas.length - 1; i >= 0; i--) { S.gas[i].t += dt; if (S.gas[i].t > 0.7) S.gas.splice(i, 1) }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.t += dt; p.y -= 18 * dt; if (p.t > 1.2) S.pops.splice(i, 1) }
    S.shake = Math.max(0, S.shake - dt)
  }

  /* ---------- le saut final ---------- */
  function beginJump() {
    S.mode = 'jump'
    const meters = 2 + S.combo * 0.35 + S.fart * 3 + S.speedMul * 0.5
    S.jump = { t: 0, meters: Math.round(meters * 100) / 100, x0: S.serge.x, phase: 'run' }
    pop(S.serge.x, S.serge.y - 40, 'ÉLAN !', '#ffffff', true)
  }
  function updateJump(dt) {
    const j = S.jump
    j.t += dt
    const sg = S.serge
    if (j.phase === 'run') {
      S.camX += 180 * dt; sg.x += 180 * dt
      if (j.t > 1.0) { j.phase = 'air'; j.t = 0; j.xStart = sg.x }
    } else if (j.phase === 'air') {
      const dur = 0.6 + j.meters * 0.12
      const p = Math.min(1, j.t / dur)
      S.camX += 180 * dt; sg.x += 180 * dt
      j.z = Math.sin(p * Math.PI) * (20 + j.meters * 4)
      if (p >= 1) { j.phase = 'land'; j.t = 0; j.z = 0; S.shake = 0.3; pop(sg.x, sg.y - 40, j.meters.toFixed(2) + ' m', '#ffe060', true) }
    } else if (j.phase === 'land') {
      if (j.t > 1.4) {
        const bonus = Math.round(j.meters * CFG.score.meter)
        S.score += bonus
        S.jump.bonus = bonus
        S.mode = 'over'; S.overT = 0
        if (S.score > best) { best = S.score; localStorage.setItem('cdm_best', String(best)) }
      }
    }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.t += dt; p.y -= 10 * dt; if (p.t > 2) S.pops.splice(i, 1) }
    S.shake = Math.max(0, S.shake - dt)
  }

  /* ---------- dessin ---------- */
  const F = (px) => `${px}px ui-monospace, Menlo, monospace`
  function text(t, x, y, col = '#fff', size = 8, align = 'left', bold = false) {
    ctx.font = (bold ? 'bold ' : '') + F(size)
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#000'
    ctx.fillText(t, Math.round(x) + 1, Math.round(y) + 1)
    ctx.fillStyle = col
    ctx.fillText(t, Math.round(x), Math.round(y))
  }
  function box(x, y, w, h, col, label, lcol = '#fff') {
    ctx.fillStyle = col
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w - 1, h - 1)
    if (label) text(label, x + w / 2, y - 2, lcol, 6, 'center')
  }

  function drawWorld() {
    const cam = S.camX
    const shx = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 14 : 0
    const shy = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 14 : 0
    ctx.save()
    ctx.translate(Math.round(shx), Math.round(shy))

    // bandes : route, trottoir, plage, mer
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-10, -10, GW + 20, CFG.roadBottom + 10)
    ctx.fillStyle = '#6a6a6a'; ctx.fillRect(-10, CFG.roadBottom, GW + 20, CFG.beachTop - CFG.roadBottom)
    ctx.fillStyle = '#8a8070'; ctx.fillRect(-10, CFG.beachTop, GW + 20, 42)
    ctx.fillStyle = '#4a5a6a'; ctx.fillRect(-10, CFG.beachTop + 42, GW + 20, 40)
    // repères défilants : pointillés de la route, dalles du trottoir, parasols
    const off = -(cam % 40)
    ctx.fillStyle = '#c0c0c0'
    for (let x = off - 40; x < GW + 40; x += 40) ctx.fillRect(x, 34, 20, 2)
    ctx.fillStyle = '#5e5e5e'
    for (let x = off - 40; x < GW + 40; x += 40) { ctx.fillRect(x, CFG.roadBottom, 1, CFG.beachTop - CFG.roadBottom) }
    ctx.fillStyle = '#404040'
    for (let x = off - 40; x < GW + 40; x += 40) ctx.fillRect(x + 20, CFG.beachTop - 8, 2, 8) // pied de palmier
    const off2 = -(cam % 60)
    for (let x = off2 - 60; x < GW + 60; x += 60) { ctx.fillStyle = '#b0b0b0'; ctx.fillRect(x + 10, CFG.beachTop + 12, 14, 3); ctx.fillStyle = '#404040'; ctx.fillRect(x + 16, CFG.beachTop + 15, 2, 8) }
    // bordure végétation
    ctx.fillStyle = '#4e5e4e'; ctx.fillRect(-10, CFG.roadBottom, GW + 20, 6); ctx.fillRect(-10, CFG.beachTop - 6, GW + 20, 6)
    text('ROUTE', 4, 10, '#999', 7)
    text('CROISETTE', 4, CFG.roadBottom + 16, '#bbb', 7)
    text('PLAGE', 4, CFG.beachTop + 12, '#ddd', 7)
    // distance : repères "Palais" / "Carlton" tous les 1000 px
    const km = Math.floor(cam / 1000)
    for (let k = km; k <= km + 1; k++) {
      const x = k * 1000 - cam + 200
      if (x > -60 && x < GW + 60) { box(x, 8, 50, 22, '#2a2a2a', null); text(k === 0 ? 'PALAIS' : k >= 9 ? 'CARLTON' : 'HÔTEL ' + k, x + 25, 22, '#ddd', 7, 'center') }
    }

    // entités triées par y (profondeur)
    const list = S.ents.slice().sort((a, b) => a.y - b.y)
    for (const e of list) {
      const x = e.x - cam
      if (x < -60 || x > GW + 60) continue
      if (e.type === 'boom') {
        const r = 6 + e.t * (e.big ? 60 : 36)
        ctx.fillStyle = e.t < 0.3 ? '#ffffff' : '#ff8030'
        ctx.beginPath(); ctx.arc(x, e.y, r, 0, Math.PI * 2); ctx.fill()
        text(e.big ? 'BOUM !!!' : 'BOUM', x, e.y - r - 2, '#fff', 7, 'center', true)
        continue
      }
      if (e.type === 'furn') {
        box(x - e.w / 2, e.y - e.h, e.w, e.h, '#505050', e.k)
        continue
      }
      if (e.type === 'mime') {
        // le mur mimé : un contour pointillé bien réel
        ctx.strokeStyle = '#ffffff'; ctx.setLineDash([2, 2])
        ctx.strokeRect(x - 4.5, e.y - e.wallH / 2 + 0.5, 9, e.wallH)
        ctx.setLineDash([])
        const hand = Math.sin(e.pose * 4) * 3
        box(x - e.w / 2, e.y - e.h, e.w, e.h, '#f0f0f0')
        ctx.fillStyle = '#000'; ctx.fillRect(x - e.w / 2, e.y - e.h + 6, e.w, 2); ctx.fillRect(x - e.w / 2, e.y - e.h + 11, e.w, 2)
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x - 8, e.y - 12 + hand, 3, 3); ctx.fillRect(x + 5, e.y - 12 - hand, 3, 3)
        text('CON DE MIME', x, e.y - e.h - 2, '#fff', 6, 'center')
        continue
      }
      // piéton
      const z = e.z || 0
      if (e.state === 'down' || e.state === 'splat' || e.state === 'road') {
        box(x - e.h / 2, e.y - e.w, e.h, e.w, e.state === 'splat' ? '#703030' : e.col, null)
        if (e.state === 'splat') text('x_x', x, e.y - e.w - 2, '#fff', 6, 'center')
      } else {
        if (z > 0) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 4, e.y - 2, 8, 3) }
        ctx.save()
        if (z > 0) { ctx.translate(x, e.y - z); ctx.rotate(e.spin * e.z * 0.02); ctx.translate(-x, -(e.y - z)) }
        box(x - e.w / 2, e.y - e.h - z, e.w, e.h, e.k === 'chien' ? e.col : e.col, z > 0 ? null : e.k)
        if (e.mamie) { box(x - e.w / 2 - 10, e.y - 12, 10, 10, '#a0a0c0', 'caddie') }
        ctx.restore()
      }
    }

    // la fille en roller en jaune
    if (S.roller && !S.roller.gone) {
      const ro = S.roller, x = ro.x - cam
      box(x - 5, ro.y - 18, 10, 18, '#ffe000', 'ROLLER', '#ffe000')
      ctx.fillStyle = '#000'; ctx.fillRect(x - 5, ro.y - 1, 3, 2); ctx.fillRect(x + 2, ro.y - 1, 3, 2)
    }

    // gaz
    for (const g of S.gas) {
      const x = g.x - cam - g.t * 60
      ctx.fillStyle = `rgba(140,220,120,${0.6 - g.t * 0.8})`
      for (let k = 0; k < 4; k++) { const r = 5 + g.t * 30 + k * 3; ctx.beginPath(); ctx.arc(x - k * 10, g.y - 8 + Math.sin(k + g.t * 9) * 4, r, 0, Math.PI * 2); ctx.fill() }
    }

    // camion
    if (S.truck) {
      const tr = S.truck
      box(tr.x - cam - tr.w / 2, tr.y - tr.h, tr.w, tr.h, '#8a2a2a', 'CAMION')
    }

    // le tueur, toujours en bord droit
    const kx = 440
    const ky = S.killer.y
    box(kx - 6, ky - 20, 12, 20, '#101010', 'LE TUEUR', '#ff8080')
    ctx.fillStyle = '#e0e0e0'; ctx.fillRect(kx + 6, ky - 14, 2, 8) // le couteau
    ctx.fillStyle = '#ff0000'; ctx.fillRect(kx - 3, ky - 16, 2, 2); ctx.fillRect(kx + 1, ky - 16, 2, 2)

    // Serge
    const sg = S.serge
    const sx = sg.x - cam
    const jz = S.mode === 'jump' && S.jump.z ? S.jump.z : 0
    const bob = S.mode === 'run' && S.tripT <= 0 ? Math.abs(Math.sin(S.t * 14 * S.speedMul)) * 2 : 0
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx - 6, sg.y - 2, 12, 3)
    if (S.tripT > 0) {
      box(sx - 10, sg.y - 10, 20, 10, '#c05030', 'SERGE (aïe)')
    } else {
      box(sx - sg.w / 2, sg.y - sg.h - bob - jz, sg.w, sg.h, S.boostT > 0 ? '#ff9050' : '#b05030', 'SERGE')
      // cheveux longs + moustache, pour la ressemblance de prototype
      ctx.fillStyle = '#3a2010'; ctx.fillRect(sx - 7, sg.y - sg.h - bob - jz - 1, 14, 5)
      ctx.fillStyle = '#3a2010'; ctx.fillRect(sx - 3 + (sg.face < 0 ? -2 : 0), sg.y - sg.h - bob - jz + 8, 6, 1)
      if (sg.face < 0) text('?!', sx + 8, sg.y - sg.h - 4, '#ffe060', 7)
    }

    if (debug) {
      ctx.strokeStyle = '#0f0'; ctx.strokeRect(sx - sg.w / 2 + 0.5, sg.y - 5 + 0.5, sg.w - 1, 10)
      for (const e of S.ents) {
        if (!e.solid) continue
        const x = e.x - cam
        const hw = e.type === 'mime' ? 4 : e.w / 2, hh = e.type === 'mime' ? e.wallH / 2 : Math.max(5, e.h * 0.35)
        ctx.strokeStyle = '#f0f'; ctx.strokeRect(x - hw + 0.5, e.y - hh + 0.5, hw * 2, hh * 2)
      }
      ctx.strokeStyle = '#0ff'; ctx.strokeRect(sx - CFG.fartCone.back + 0.5, sg.y - CFG.fartCone.half + 0.5, CFG.fartCone.back + CFG.fartCone.front, CFG.fartCone.half * 2)
    }

    // popups
    for (const p of S.pops) {
      const a = Math.min(1, (1.2 - p.t) * 3)
      ctx.globalAlpha = Math.max(0, a)
      text(p.text, p.x - cam, p.y, p.col, p.big ? 10 : 7, 'center', p.big)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  function drawHud() {
    // chrono
    const left = Math.max(0, CFG.duration - S.t)
    text(left.toFixed(1).replace('.', ',') + ' s', GW / 2, 14, left < 10 ? '#ff6060' : '#fff', 12, 'center', true)
    // score
    text(String(S.score).padStart(6, '0'), GW - 6, 14, '#ffe060', 12, 'right', true)
    // combo
    const m = mult()
    if (S.combo > 0) text('COMBO ' + S.combo + '  ×' + m, GW - 6, 26, m >= 3 ? '#80e0ff' : '#ccc', 8, 'right', m >= 3)
    // jauge de prout
    const gw = 90
    box(6, GH - 14, gw, 8, '#202020', null)
    ctx.fillStyle = S.fart >= 1 ? '#80ff80' : '#4a8a4a'
    ctx.fillRect(7, GH - 13, Math.round((gw - 2) * S.fart), 6)
    text(S.fart >= 1 ? 'PROUT PRÊT  [ESPACE]' : 'PROUT ' + Math.round(S.fart * 100) + '%', 6, GH - 17, '#ccc', 7)
    // distance au tueur (immuable, c'est le gag)
    text('TUEUR : 320 m  (toujours)', GW - 6, GH - 6, '#ff8080', 7, 'right')
    if (S.invertT > 0) text('CONTRÔLES INVERSÉS', GW / 2, 30, '#ffe060', 8, 'center', true)
    if (debug) text(`seed ${S.seed} · ents ${S.ents.length} · densité ${density().toFixed(1)} · cam ${S.camX | 0}`, 6, GH - 24, '#0f0', 6)
  }

  function drawIntro() {
    ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, GW, GH)
    text('CONS DE MIME !', GW / 2, 50, '#fff', 26, 'center', true)
    text('Prototype gris v0 — Vous êtes à Cannes. Lui aussi.', GW / 2, 68, '#888', 8, 'center')
    // la scène d'intro : la fille, Serge, le tueur qui passe
    box(190, 150, 12, 20, '#e0a0d0', 'LA FILLE')
    box(240, 150, 12, 20, '#b05030', 'SERGE')
    ctx.fillStyle = '#3a2010'; ctx.fillRect(239, 149, 14, 5)
    const t = S.introT
    if (t > 0.6) text('« Je suis séropositive. »', 196, 126, '#e0a0d0', 8, 'center')
    if (t > 1.8) text('« ... »', 262, 116, '#fff', 8, 'center')
    if (t > 2.6) { const kx = 300 + ((t - 2.6) * 120) % 220; box(kx, 150, 12, 20, '#101010', 'LE TUEUR', '#ff8080') }
    if (t > 3.2) text('« Au revoir ! »', 262, 106, '#fff', 8, 'center', true)
    if (t > 0.8 && Math.floor(t * 2) % 2 === 0) text('ESPACE / toucher : COURIR', GW / 2, 220, '#ffe060', 10, 'center', true)
    text('↑↓ couloir · ← → reculer / avancer · ESPACE prout (boost + dégommage) · R regarder', GW / 2, 246, '#aaa', 7, 'center')
    text('Esquive de près pour le combo, pète sur les gens pour les envoyer exploser sur la plage. 90 s.', GW / 2, 258, '#777', 7, 'center')
    if (best) text('Record : ' + best, GW / 2, 90, '#ffe060', 8, 'center')
  }

  function drawOver() {
    const t = S.overT
    ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.8, t * 2) + ')'; ctx.fillRect(0, 0, GW, GH)
    if (t < 0.3) return
    const j = S.jump
    box(80, 40, 320, 190, '#1a1a1a', null)
    text('RÉSULTATS', GW / 2, 62, '#fff', 14, 'center', true)
    const rows = [
      ['Saut en longueur', j.meters.toFixed(2) + ' m', '+' + j.bonus],
      ['Meilleur combo', '×' + (S.bestCombo >= 20 ? 5 : S.bestCombo >= 15 ? 4 : S.bestCombo >= 10 ? 3 : S.bestCombo >= 5 ? 2 : 1), S.bestCombo + ' esquives'],
      ['La fille en jaune', S.looked ? 'regardée' : 'ratée', ''],
      ['La mamie', S.mamieDone && S.mamie.state === 'splat' ? 'écrasée' : 'épargnée', ''],
      ['Le tueur', 'toujours à 320 m', ''],
    ]
    rows.forEach((r, i) => {
      const y = 86 + i * 16
      if (t > 0.4 + i * 0.15) { text(r[0], 96, y, '#bbb', 8); text(r[1], 300, y, '#fff', 8, 'right'); text(r[2], 384, y, '#ffe060', 8, 'right') }
    })
    if (t > 1.3) {
      text('SCORE  ' + S.score, GW / 2, 182, '#ffe060', 16, 'center', true)
      if (S.score >= best && S.score > 0) text('RECORD !', GW / 2, 196, '#80ff80', 8, 'center', true)
    }
    if (t > 1.8) {
      // le tampon
      ctx.save()
      ctx.translate(GW / 2, 212)
      ctx.rotate(-0.08)
      const s = Math.max(1, 1.6 - (t - 1.8) * 4)
      ctx.scale(s, s)
      ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.strokeRect(-120, -10, 240, 18)
      text('C\'EST BON, J\'AI DU PAPIER', 0, 4, '#ff4040', 11, 'center', true)
      ctx.restore()
    }
    if (t > 2.5 && Math.floor(t * 2) % 2 === 0) text('ENTRÉE / toucher : rejouer', GW / 2, 246, '#aaa', 8, 'center')
    text('seed ' + S.seed, 8, GH - 6, '#555', 6)
  }

  function draw() {
    ctx.imageSmoothingEnabled = false
    if (S.mode === 'intro') { drawIntro(); return }
    drawWorld()
    if (S.mode === 'run' || S.mode === 'jump') drawHud()
    if (S.mode === 'jump') {
      text('SAUT EN LONGUEUR', GW / 2, 40, '#fff', 14, 'center', true)
      if (S.jump.phase === 'land') text(S.jump.meters.toFixed(2) + ' m', GW / 2, 60, '#ffe060', 20, 'center', true)
    }
    if (S.mode === 'over') drawOver()
  }

  /* ---------- boucle ---------- */
  let last = performance.now()
  function frame(now) {
    let dt = (now - last) / 1000
    last = now
    if (dt > 0.1) dt = 0.1
    update(dt)
    draw()
    requestAnimationFrame(frame)
  }
  reset()
  requestAnimationFrame(frame)

  return { press, release, tap, touchLane, get state() { return S }, reset }
}
