/*
 * BARRICASSE — « Tout fait barricade. Même le poisson. »
 *
 * A defensive, upside-down brick-breaker. Demonstrators at the top of the street, a police
 * line at the bottom sending big arcade balls, and in the middle the player orders furniture
 * that flies from a single stock icon to a cell and only protects once it lands. Ninety
 * seconds, keep as many people as possible.
 *
 * This file: screens, input, rendering, particles and the glue to sim.js (rules) and
 * audio.js (sound). The simulation runs at a fixed step; the renderer only reads it.
 */
;(function () {
  'use strict'

  const Sim = window.BarricasseSim
  const F = window.PixelFont
  const SP = window.BarricasseSprites
  const C = Sim.CONFIG
  const W = C.W
  const H = C.H

  const canvas = document.getElementById('c')
  const ctx = canvas.getContext('2d')
  canvas.width = W
  canvas.height = H
  ctx.imageSmoothingEnabled = false

  const params = new URLSearchParams(location.search)
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k)
      } catch {
        return null
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v)
      } catch {}
    },
  }
  function readRecord() {
    try {
      return JSON.parse(store.get('barricasse.record') || 'null')
    } catch {
      return null
    }
  }

  const S = SP.build()
  const streetArt = SP.street(seeded(7))
  const audio = window.BarricasseAudio.createAudio()
  const ballArt = SP.art(13, 13, (P) => (P.e(6, 6, 5, 5, '#1d1726'), P.e(6, 6, 4, 4, '#ff8a2a'), P.e(5, 5, 2, 2, '#fff4d6')), null)
  const trailArt = SP.art(7, 7, (P) => P.e(3, 3, 2, 2, '#ffb25a'), null)
  const shadowArt = SP.art(32, 12, (P) => P.e(16, 6, 15, 5, 'rgba(16,14,26,0.35)'), null)

  /* Signs carried in the crowd (decorative). Index → sign. */
  const SIGN_OF = { 1: 'non', 4: 'frigo', 6: 'truc', 9: 'canape', 12: 'groupe', 14: 'passer', 17: 'bof', 20: 'coeur', 22: 'non' }
  const SLOGANS = ['« NON À CE TRUC »', '« JE DEVAIS JUSTE PASSER »', '« RENDEZ LE CANAPÉ »', '« ON RESTE GROUPÉS »', '« C’EST MON FRIGO »']
  const EVENT_TEXT = {
    rupture: ['RUPTURE DE PALETTES', 'FRIGOS ET CANAPÉS SEULEMENT · LIVRAISON 1 S'],
    groupes: ['ON RESTE GROUPÉS', 'LA BANDEROLE EST TROP LONGUE'],
    treve: ['TRÊVE MERGUEZ', 'PLUS AUCUN TIR'],
    fournisseur: ['CHANGEMENT DE FOURNISSEUR', 'LE STOCK PASSE À DROITE'],
  }

  const app = {
    mode: 'MENU',
    sim: null,
    seed: null,
    acc: 0,
    last: 0,
    real: 0,
    hover: -1,
    pointer: { x: -1, y: -1 },
    muted: store.get('barricasse.muted') === '1',
    reduced: store.get('barricasse.reduced') !== null ? store.get('barricasse.reduced') === '1' : matchMedia('(prefers-reduced-motion: reduce)').matches,
    debug: params.get('debug') === '1',
    fixedSeed: params.has('seed') ? params.get('seed') : null,
    firstRun: !store.get('barricasse.seen'),
    record: readRecord(),
    result: null,
    newRecord: false,
    resultsAt: 0,
  }
  audio.setMuted(app.muted)

  /* ---------- effects state (visual only, never feeds back into the rules) ---------- */
  let fx = null
  function resetFx() {
    fx = {
      particles: [],
      popups: [],
      remnants: [],
      flashes: [],
      visual: {},
      trails: new Map(),
      shake: 0,
      shakeMag: 0,
      lostBlink: -9,
      evacBlink: -9,
      readyFlash: -9,
      wasReady: true,
      chargeMsgAt: -9,
      signDown: {},
      transient: null,
      sends: 0,
      lastPhase: -1,
      fired: {},
    }
  }
  resetFx()

  function seeded(n) {
    let a = n >>> 0
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const rnd = (a, b) => a + Math.random() * (b - a)
  const pick = (arr) => arr[(Math.random() * arr.length) | 0]

  /* ---------- game flow ---------- */
  function newSeed() {
    return (Date.now() % 1e8).toString(36) + Math.floor(Math.random() * 1e4).toString(36)
  }
  function startGame(seed) {
    app.seed = seed ?? app.fixedSeed ?? newSeed()
    app.sim = Sim.create(app.seed)
    app.acc = 0
    app.result = null
    app.newRecord = false
    resetFx()
    app.mode = 'PLAYING'
    audio.init()
    audio.play('start')
    audio.setLayers(0)
    audio.setTruce(false)
    audio.startMusic()
  }
  function endGame() {
    const s = app.sim
    app.result = Sim.summary(s)
    app.newRecord = Sim.better(app.result, app.record)
    if (app.newRecord) {
      app.record = app.result
      store.set('barricasse.record', JSON.stringify(app.result))
    }
    store.set('barricasse.seen', '1')
    app.firstRun = false
    app.mode = 'RESULTS'
    app.resultsAt = app.real
    audio.stopMusic()
    audio.play('end', app.result.survivors >= 12)
  }
  function setPaused(p) {
    if (p && app.mode === 'PLAYING') {
      app.mode = 'PAUSED'
      audio.stopMusic()
    } else if (!p && app.mode === 'PAUSED') {
      app.mode = 'PLAYING'
      app.acc = 0
      audio.startMusic()
    }
  }
  function toggleMute() {
    app.muted = !app.muted
    audio.setMuted(app.muted)
    store.set('barricasse.muted', app.muted ? '1' : '0')
  }
  function toggleReduced() {
    app.reduced = !app.reduced
    store.set('barricasse.reduced', app.reduced ? '1' : '0')
  }

  /* ---------- buttons, one list for drawing and hit-testing ---------- */
  function buttons() {
    const b = []
    if (app.mode === 'PLAYING' || app.mode === 'PAUSED') {
      b.push({ x: 396, y: 8, w: 32, h: 32, icon: 'pause', act: () => setPaused(app.mode === 'PLAYING') })
      b.push({ x: 438, y: 8, w: 32, h: 32, icon: 'sound', act: toggleMute })
    }
    if (app.mode === 'MENU') {
      b.push({ x: 100, y: 446, w: 280, h: 46, label: 'TENIR 90 SECONDES', big: true, act: () => startGame() })
      b.push({ x: 100, y: 560, w: 134, h: 26, label: app.muted ? 'SON : NON' : 'SON : OUI', act: toggleMute })
      b.push({ x: 246, y: 560, w: 134, h: 26, label: app.reduced ? 'MOUVEMENT : -' : 'MOUVEMENT : +', act: toggleReduced })
    }
    if (app.mode === 'PAUSED') {
      b.push({ x: 130, y: 290, w: 220, h: 40, label: 'REPRENDRE', big: true, act: () => setPaused(false) })
      b.push({ x: 130, y: 342, w: 220, h: 28, label: app.reduced ? 'MOUVEMENTS RÉDUITS : OUI' : 'MOUVEMENTS RÉDUITS : NON', act: toggleReduced })
      b.push({
        x: 130,
        y: 380,
        w: 220,
        h: 28,
        label: 'ABANDONNER',
        act: () => {
          audio.stopMusic()
          app.mode = 'MENU'
        },
      })
    }
    if (app.mode === 'RESULTS' && app.real - app.resultsAt > 0.5) {
      b.push({ x: 50, y: 556, w: 184, h: 42, label: 'REJOUER (R)', big: true, act: () => startGame() })
      b.push({ x: 246, y: 556, w: 184, h: 42, label: 'MÊME PARTIE', big: true, act: () => startGame(app.result.seed) })
    }
    return b
  }

  /* ---------- input ---------- */
  function toLogical(e) {
    const r = canvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    audio.init()
    const p = toLogical(e)
    app.pointer = p
    if (e.pointerType === 'mouse' && e.button !== 0) return
    for (const b of buttons()) {
      if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) {
        audio.play('click')
        b.act()
        return
      }
    }
    if (app.mode === 'PLAYING') order(p)
  })
  canvas.addEventListener('pointermove', (e) => {
    const p = toLogical(e)
    app.pointer = p
    app.hover = e.pointerType === 'mouse' && app.sim ? Sim.cellAt(app.sim, p.x, p.y) : -1
  })
  canvas.addEventListener('pointerleave', () => (app.hover = -1))
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  addEventListener('keydown', (e) => {
    if (e.repeat) return
    audio.init()
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (app.mode === 'PLAYING') setPaused(true)
      else if (app.mode === 'PAUSED') setPaused(false)
    } else if (e.code === 'KeyR' && app.mode === 'RESULTS' && app.real - app.resultsAt > 0.5) startGame()
    else if (e.code === 'KeyM') toggleMute()
    else if (e.code === 'Backquote' || (e.code === 'KeyD' && e.shiftKey)) app.debug = !app.debug
    else if ((e.code === 'Enter' || e.code === 'Space') && app.mode === 'MENU') {
      e.preventDefault()
      startGame()
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true)
  })

  function order(p) {
    const s = app.sim
    const i = Sim.cellAt(s, p.x, p.y)
    if (i < 0) return
    const r = Sim.command(s, i)
    if (r.ok) {
      fx.sends++
      return
    }
    if (r.reason === 'reload') {
      // One small message, not one per click.
      if (s.t - fx.chargeMsgAt > 0.45) {
        fx.chargeMsgAt = s.t
        popup('ÇA CHARGE', s.stock.x, s.stock.y + 52, '#ffd23f', 0.6, 1)
        audio.play('refuse')
      }
    } else if (r.reason === 'reserved' || r.reason === 'occupied') {
      const cr = Sim.cellRect(s, i)
      fx.flashes.push({ kind: 'cross', x: cr.cx, y: cr.cy, born: s.t, life: 0.25 })
      audio.play('busy')
    }
  }

  /* ---------- notifications from the rules → sound and pixels ---------- */
  function consume(s) {
    const t = s.t
    for (const e of s.out) {
      switch (e.type) {
        case 'send':
          audio.play('send')
          break
        case 'land': {
          audio.play('land', e.item)
          fx.visual[e.cell] = { item: e.item, landAt: t, objId: e.delivery.id }
          dust(e.x, e.y + 20, 6)
          if (e.near || Math.random() < 0.06) popup('LIVRÉ', e.x, e.y - 30, '#9cf27a', 0.8, 1)
          landingGag(e, t)
          break
        }
        case 'toolate':
          audio.play('toolate')
          popup('TROP TARD', e.x, e.y - 30, '#ff6a5a', 0.9, 1)
          debris(e.item, e.x, e.y, 8)
          break
        case 'destroy': {
          const cr = Sim.cellRect(s, e.cell)
          audio.play('destroy', e.item)
          debris(e.item, cr.cx, cr.cy, app.reduced ? 5 : 10)
          breakGag(e.item, cr, t)
          delete fx.visual[e.cell]
          shake(e.item === 'palette' ? 3 : 1.5, 0.08)
          break
        }
        case 'wall':
          spark(e.x, e.y)
          audio.play('wall')
          break
        case 'lost': {
          audio.play('lost')
          const look = S.people[e.person.index].look
          for (let k = 0; k < (app.reduced ? 8 : 16); k++) {
            const a = rnd(0, Math.PI * 2)
            const v = rnd(20, 60)
            particle({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: rnd(0, 6), vz: rnd(10, 50), color: pick([look.shirt, look.skin, '#f4f1e8', '#d8d8e0']), size: 2, life: rnd(0.4, 0.8), drag: 2 })
          }
          for (let k = 0; k < 4; k++) particle({ x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 4), vx: rnd(-8, 8), vy: rnd(-14, -4), z: 0, vz: 0, g: 0, sprite: S.props.fumee, scale: 2, life: 0.6 })
          fx.flashes.push({ kind: 'danger', x: e.x, y: e.y, born: t, life: 0.5 })
          fx.lostBlink = t
          shake(2, 0.12)
          break
        }
        case 'top':
          particle({ x: e.x, y: C.TOP_ABSORB_Y, vx: 0, vy: -6, z: 0, vz: 0, g: 0, sprite: S.props.fumee, scale: 2, life: 0.4 })
          audio.play('top')
          break
        case 'evacuated':
          fx.evacBlink = t
          for (let k = 0; k < 4; k++) particle({ x: e.x + rnd(-4, 4), y: C.BOTTOM_EXIT_Y, vx: rnd(-10, 10), vy: rnd(0, 10), z: 0, vz: 0, g: 0, sprite: S.props.fumee, scale: 1, life: 0.35 })
          audio.play('evacuated')
          break
        case 'announce':
          audio.play('announce')
          break
        case 'fire':
          audio.play('fire')
          for (let k = 0; k < 3; k++) particle({ x: e.ball.x + rnd(-3, 3), y: C.SPAWN_Y + 4, vx: rnd(-12, 12), vy: rnd(-4, 6), z: 0, vz: 0, g: 0, sprite: S.props.fumee, scale: 2, life: 0.3 })
          break
        case 'event':
          eventFx(e, t)
          break
        case 'end':
          break
      }
    }
    s.out.length = 0
  }
  function eventFx(e, t) {
    if (e.phase === 'announce' || (e.phase === 'active' && e.id !== 'treve')) audio.play('event')
    if (e.id === 'treve') {
      if (e.phase === 'active') {
        audio.setTruce(true)
        audio.play('event')
      }
      if (e.phase === 'done') {
        audio.setTruce(false)
        audio.play('whistle')
        fx.transient = { text: 'BON, ON REPREND', sub: '', until: t + 1.6, color: '#ffd23f' }
      }
    }
    if (e.id === 'fournisseur') {
      if (e.phase === 'active' || e.phase === 'done') {
        const s = app.sim
        poof(e.phase === 'active' ? C.STOCK_LEFT.x : C.STOCK_RIGHT.x, C.STOCK_LEFT.y)
        poof(s.stock.x, s.stock.y)
      }
      if (e.phase === 'warn') fx.transient = { text: 'RETOUR À GAUCHE', sub: 'DANS 1 S', until: t + 1.0, color: '#ffd23f' }
      if (e.phase === 'done') fx.transient = { text: 'LE STOCK EST REVENU', sub: 'À GAUCHE', until: t + 1.2, color: '#9cf27a' }
    }
  }

  function particle(p) {
    if (fx.particles.length > 320) fx.particles.shift()
    p.age = 0
    p.g = p.g ?? 160
    p.z = p.z ?? 0
    p.vz = p.vz ?? 0
    p.rot = p.rot ?? 0
    p.vr = p.vr ?? 0
    p.drag = p.drag ?? 0
    p.scale = p.scale ?? 2
    fx.particles.push(p)
  }
  function popup(text, x, y, color, life, scale = 1) {
    fx.popups.push({ text, x, y, color, life, scale, born: app.sim.t })
  }
  function shake(mag, dur) {
    if (app.reduced) return
    fx.shakeMag = Math.max(fx.shakeMag, mag)
    fx.shake = Math.max(fx.shake, dur)
  }
  function dust(x, y, n) {
    for (let k = 0; k < (app.reduced ? 3 : n); k++) {
      const dir = k % 2 ? 1 : -1
      particle({ x: x + dir * rnd(4, 18), y: y + rnd(-2, 2), vx: dir * rnd(20, 45), vy: rnd(-6, 6), z: 0, vz: rnd(4, 14), g: 40, color: pick(['#d8d0c0', '#bfb6a6', '#e8e0d0']), size: 2, life: rnd(0.25, 0.45), drag: 4 })
    }
  }
  function spark(x, y) {
    for (let k = 0; k < 3; k++) particle({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), z: 0, vz: 0, g: 0, color: '#ffe7b0', size: 1, life: 0.15 })
  }
  function poof(x, y) {
    for (let k = 0; k < 8; k++) particle({ x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: rnd(-20, 20), vy: rnd(-20, 5), z: 0, vz: 0, g: 0, sprite: S.props.fumee, scale: 3, life: rnd(0.3, 0.6) })
  }
  function debris(item, x, y, n) {
    const cols = S.palette[item] || ['#888']
    for (let k = 0; k < n; k++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(30, 90)
      particle({ x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, z: rnd(4, 14), vz: rnd(40, 110), color: pick(cols), size: pick([2, 2, 3, 4]), life: rnd(0.5, 0.9), drag: 1.5, bounce: true })
    }
  }
  function prop(name, x, y, opts = {}) {
    particle(Object.assign({ x, y, vx: rnd(-50, 50), vy: rnd(-40, 20), z: 10, vz: rnd(80, 140), sprite: S.props[name], scale: 2, life: 1.3, vr: rnd(-8, 8), drag: 1, bounce: true }, opts))
  }
  function remnant(frame, cr, life, extra) {
    fx.remnants.push(Object.assign({ frame, x: cr.x, y: cr.y, born: app.sim.t, life }, extra || {}))
  }

  /** The comic part of a landing. */
  function landingGag(e, t) {
    const v = fx.visual[e.cell]
    if (e.item === 'planche') v.ironAt = t + 0.35
    if (e.item === 'poisson') for (let k = 0; k < 6; k++) prop('goutte', e.x + rnd(-14, 14), e.y + 10, { life: 0.6, vz: rnd(40, 80), scale: 1 })
    if (e.item === 'carton') for (let k = 0; k < 4; k++) particle({ x: e.x + rnd(-10, 10), y: e.y, vx: rnd(-30, 30), vy: rnd(-10, 10), z: 8, vz: rnd(30, 60), color: '#d8f0ff', size: 1, life: 0.5 })
    if (e.item === 'reverbere') v.flicker = t
  }
  /** The comic part of a destruction. */
  function breakGag(item, cr, t) {
    const x = cr.cx
    const y = cr.cy
    switch (item) {
      case 'chaise':
        remnant(S.frames.chaise.folded, cr, 0.9)
        break
      case 'palette':
        for (let k = 0; k < 3; k++) prop('planche_bois', x, y - 8 + k * 7, { vz: rnd(120, 180), vr: rnd(-12, 12), life: 1.4 })
        break
      case 'voiture':
        prop('roue', x, y, { scale: 2 })
        break
      case 'planche':
        prop('fer', x + 8, y - 10, { scale: 2 })
        break
      case 'frigo':
        remnant(S.frames.frigo.open, cr, 0.7)
        prop('yaourt', x, y, { scale: 2, vz: 160 })
        break
      case 'canape':
        prop('telecommande', x, y, { scale: 2 })
        for (const p of app.sim.people) if (SIGN_OF[p.index] === 'canape') fx.signDown[p.index] = t + 2.5
        break
      case 'reverbere':
        for (let k = 0; k < 5; k++) particle({ x: x + 8, y: y - 12, vx: rnd(-40, 40), vy: rnd(-30, 10), z: 10, vz: rnd(30, 80), color: '#fff2a8', size: 1, life: 0.4 })
        break
      case 'poisson':
        for (let k = 0; k < 4; k++) prop('goutte', x, y, { scale: 1, life: 0.6 })
        break
      case 'armoire':
        remnant(S.frames.armoire.open, cr, 0.8)
        for (let k = 0; k < 3; k++) prop('cintre', x + (k - 1) * 8, y - 6, { scale: 2 })
        break
      case 'ballon':
        break
      case 'baignoire':
        prop('canard', x + 8, y - 8, { scale: 2, vz: 170, life: 1.5 })
        for (let k = 0; k < 5; k++) prop('goutte', x, y - 4, { scale: 1, life: 0.6 })
        break
      case 'photocopieuse':
        prop('feuille_non', x, y - 6, { scale: 2, vz: 60, g: 50, vr: rnd(-2, 2), life: 1.6, drag: 1.5 })
        break
      case 'nain':
        remnant(S.props.bonnet, cr, 1.2, { small: true, ox: 15, oy: 26 })
        break
      case 'caddie':
        remnant(S.frames.caddie.nowheel, cr, 0.3)
        remnant(null, cr, 1.6, { wheel: true })
        break
      case 'plante':
        for (let k = 0; k < 10; k++) prop('feuille', x, y - 6, { scale: 2, g: 90, life: 1.2, drag: 2 })
        break
      case 'toilettes':
        for (let k = 0; k < 10; k++) prop('goutte', x, y - 4, { scale: 2, life: 0.8 })
        break
      case 'distributeur':
        prop('canette', x, y + 6, { scale: 2, vz: 60, vy: 40 })
        break
      case 'gateau':
        for (let k = 0; k < 8; k++) prop('creme', x, y, { scale: 2, life: 0.9 })
        break
      case 'tableau':
        remnant(S.frames.tableau.empty, cr, 1.2)
        break
      case 'glaciere':
        for (let k = 0; k < 6; k++) prop('glacon', x, y, { scale: 2, life: 1 })
        break
      case 'barbecue':
        for (let k = 0; k < 2; k++) prop('saucisse', x, y, { scale: 2 })
        break
      case 'merguez':
        prop('saucisse', x, y, { scale: 2 })
        break
      case 'carton':
        for (let k = 0; k < 6; k++) particle({ x, y, vx: rnd(-50, 50), vy: rnd(-40, 20), z: 8, vz: rnd(40, 90), color: '#d8f0ff', size: 1, life: 0.6 })
        break
      case 'trophee':
        for (let k = 0; k < 6; k++) particle({ x, y: y - 8, vx: rnd(-30, 30), vy: rnd(-30, 10), z: 10, vz: rnd(30, 60), color: '#fff0a0', size: 1, life: 0.6 })
        break
    }
  }

  function updateFx(dt) {
    for (const p of fx.particles) {
      p.age += dt
      const k = Math.max(0, 1 - p.drag * dt)
      p.vx *= k
      p.vy *= k
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      if (p.g) {
        p.vz -= p.g * dt
        p.z += p.vz * dt
        if (p.z < 0) {
          p.z = 0
          if (p.bounce && Math.abs(p.vz) > 30) {
            p.vz = -p.vz * 0.35
            p.vr *= 0.5
          } else {
            p.vz = 0
            p.vx *= 0.6
            p.vy *= 0.6
            p.vr = 0
          }
        }
      }
    }
    fx.particles = fx.particles.filter((p) => p.age < p.life)
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt)
    else fx.shakeMag = 0
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    const dt = Math.min(0.1, (now - (app.last || now)) / 1000)
    app.last = now
    app.real += dt
    if (app.mode === 'PLAYING') {
      const s = app.sim
      const before = s.t
      app.acc += dt
      let n = 0
      while (app.acc >= C.DT && n < 24 && !s.over) {
        Sim.step(s)
        app.acc -= C.DT
        n++
      }
      if (n >= 24) app.acc = 0
      consume(s)
      updateFx(s.t - before)
      musicFollow(s)
      readyCheck(s)
      if (s.over) endGame()
    } else if (app.mode === 'RESULTS') updateFx(dt)
    render()
    requestAnimationFrame(frame)
  }
  function musicFollow(s) {
    const ph = Sim.phaseAt(s)
    if (ph !== fx.lastPhase) {
      fx.lastPhase = ph
      audio.setLayers(Math.min(4, ph))
    }
    if (s.activeEvent === 'treve' && Math.random() < 0.02) audio.play('sizzle')
  }
  function readyCheck(s) {
    const ready = s.t >= s.stock.readyAt
    if (ready && !fx.wasReady) {
      fx.readyFlash = s.t
      audio.play('ready')
    }
    fx.wasReady = ready
  }

  /* ---------- rendering ---------- */
  function vt() {
    return app.sim && app.mode !== 'MENU' ? app.sim.t : app.real
  }
  function rect(x, y, w, h, col) {
    ctx.fillStyle = col
    ctx.fillRect(x, y, w, h)
  }
  function frameRect(x, y, w, h, col, t = 1) {
    rect(x, y, w, t, col)
    rect(x, y + h - t, w, t, col)
    rect(x, y, t, h, col)
    rect(x + w - t, y, t, h, col)
  }
  function spriteFor(item, state) {
    const fr = S.frames[item] || {}
    if (item === 'reverbere' && state === 'placed') return fr.lit
    if (item === 'planche' && state === 'folded') return fr.folded
    if (item === 'parasol' && state === 'folded') return fr.closed
    return S.items[item]
  }

  function render() {
    ctx.save()
    if (fx.shake > 0 && !app.reduced) ctx.translate(Math.round(rnd(-1, 1) * fx.shakeMag), Math.round(rnd(-1, 1) * fx.shakeMag))
    ctx.drawImage(streetArt, 0, 0)
    if (app.mode === 'MENU') {
      drawMenuScene()
      ctx.restore()
      drawMenu()
      drawButtons()
      return
    }
    const s = app.sim
    drawGrid(s)
    drawRemnants(s)
    drawBarricades(s)
    drawReserved(s)
    drawCrowd(s)
    drawPolice(s)
    drawParticles(false)
    drawFlights(s)
    drawParticles(true)
    drawBalls(s)
    drawFlashes(s)
    drawPopups(s)
    drawStock(s)
    ctx.restore()
    drawHud(s)
    drawBanner(s)
    if (app.debug) drawDebug(s)
    if (app.mode === 'PAUSED') drawPause()
    if (app.mode === 'RESULTS') drawResults()
    drawButtons()
  }

  function drawGrid(s) {
    // Discreet: small crosses at the intersections.
    for (let r = 0; r <= C.ROWS; r++)
      for (let c = 0; c <= C.COLS; c++) {
        const x = C.GRID_X + c * C.CELL
        const y = C.GRID_Y + r * C.CELL
        rect(x - 2, y, 5, 1, '#666e82')
        rect(x, y - 2, 1, 5, '#666e82')
      }
    const i = app.hover
    if (i >= 0 && app.mode === 'PLAYING') {
      const cr = Sim.cellRect(s, i)
      const cell = s.cells[i]
      const ready = s.t >= s.stock.readyAt
      if (cell.state === 'EMPTY') {
        const col = ready ? '#ffffff' : '#9aa2b4'
        rect(cr.x + 1, cr.y + 1, 46, 46, ready ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)')
        corners(cr.x, cr.y, 48, col)
        if (ready) {
          ctx.globalAlpha = 0.35
          ctx.drawImage(S.items[s.stock.next], cr.x, cr.y, 48, 48)
          ctx.globalAlpha = 1
        }
      }
    }
  }
  function corners(x, y, size, col) {
    const L = 9
    for (const [left, top] of [[true, true], [false, true], [true, false], [false, false]]) {
      const hx = left ? x : x + size - L
      const vx = left ? x : x + size - 2
      const hy = top ? y : y + size - 2
      const vy = top ? y : y + size - L
      rect(hx, hy, L, 2, col)
      rect(vx, vy, 2, L, col)
    }
  }
  function drawBase(x, y) {
    // Common square base: the physical footprint, identical for every object.
    rect(x + 2, y + 2, 44, 44, 'rgba(16,14,26,0.28)')
    frameRect(x + 2, y + 2, 44, 44, 'rgba(16,14,26,0.45)')
  }
  function drawBarricades(s) {
    const t = s.t
    for (let i = 0; i < s.cells.length; i++) {
      const cell = s.cells[i]
      if (cell.state !== 'OCCUPIED') continue
      const cr = Sim.cellRect(s, i)
      const v = fx.visual[i] || { item: cell.item, landAt: -9 }
      drawBase(cr.x, cr.y)
      const item = cell.item
      if (item === 'reverbere') {
        ctx.globalAlpha = 0.16
        rect(cr.x + 18, cr.y + 22, 30, 20, '#fff2a8')
        ctx.globalAlpha = 1
      }
      const age = t - v.landAt
      let sx = 1
      let sy = 1
      if (age < 0.16 && !app.reduced) {
        const k = 1 - age / 0.16
        sx = 1 + 0.22 * k
        sy = 1 - 0.28 * k
      }
      const sp = spriteFor(item, 'placed')
      const w = 48 * sx
      const h = 48 * sy
      if (item === 'cheval' && !app.reduced) {
        ctx.save()
        ctx.translate(cr.cx, cr.y + 44)
        ctx.rotate(Math.sin(t * 2.6 + i) * 0.1)
        ctx.drawImage(sp, -w / 2, -h + 4, w, h)
        ctx.restore()
      } else ctx.drawImage(sp, Math.round(cr.cx - w / 2), Math.round(cr.y + 48 - h), Math.round(w), Math.round(h))
      if (item === 'planche' && v.ironAt !== undefined) {
        const k = Math.min(1, Math.max(0, (t - v.ironAt + 0.25) / 0.25))
        if (t >= v.ironAt - 0.25) ctx.drawImage(S.props.fer, cr.x + 26, cr.y + 4 - (1 - k) * 40, 16, 12)
      }
      if (item === 'trophee' && (t * 0.8 + i * 0.37) % 1 < 0.12) {
        const sx2 = cr.x + 16 + ((i * 7) % 16)
        rect(sx2, cr.y + 12, 1, 5, '#ffffff')
        rect(sx2 - 2, cr.y + 14, 5, 1, '#ffffff')
      }
      if (item === 'barbecue' && !app.reduced && (t * 3 + i) % 1 < 0.04) particle({ x: cr.cx + rnd(-8, 8), y: cr.y + 10, vx: rnd(-3, 3), vy: -12, z: 0, vz: 0, g: 0, sprite: S.props.fumee, scale: 2, life: 0.8 })
      if (item === 'carton' && age < 0.5) {
        F.drawTextOC(ctx, 'CLING', cr.cx, cr.y - 6, '#d8f0ff')
      }
    }
  }
  function drawRemnants(s) {
    const t = s.t
    fx.remnants = fx.remnants.filter((r) => t - r.born < r.life)
    for (const r of fx.remnants) {
      const age = t - r.born
      ctx.globalAlpha = Math.min(1, (r.life - age) / 0.3)
      if (r.wheel) {
        // The one wheel that keeps spinning.
        const cx = r.x + 37
        const cy = r.y + 41
        rect(cx - 4, cy - 4, 9, 9, '#1d1726')
        rect(cx - 3, cy - 3, 7, 7, '#4a4756')
        const a = age * 14
        rect(Math.round(cx + Math.cos(a) * 2), Math.round(cy + Math.sin(a) * 2), 1, 1, '#c9c6bc')
        rect(Math.round(cx - Math.cos(a) * 2), Math.round(cy - Math.sin(a) * 2), 1, 1, '#c9c6bc')
      } else if (r.small) ctx.drawImage(r.frame, r.x + r.ox, r.y + r.oy, r.frame.width * 2, r.frame.height * 2)
      else ctx.drawImage(r.frame, r.x, r.y, 48, 48)
      ctx.globalAlpha = 1
    }
  }
  function drawReserved(s) {
    const t = s.t
    for (const d of s.deliveries) {
      const cr = Sim.cellRect(s, d.cell)
      const p = Math.min(1, (t - d.sentAt) / d.duration)
      ctx.globalAlpha = 0.28
      ctx.drawImage(spriteFor(d.item, 'placed'), cr.x, cr.y, 48, 48)
      ctx.globalAlpha = 1
      // Marching-ants outline, and how long until it lands.
      const off = Math.floor(t * 24) % 8
      for (let k = -8; k < 48; k += 8) {
        const a = Math.max(0, k + off)
        const b = Math.min(48, k + off + 4)
        if (b <= a) continue
        rect(cr.x + a, cr.y, b - a, 2, '#ffe066')
        rect(cr.x + 48 - b, cr.y + 46, b - a, 2, '#ffe066')
        rect(cr.x, cr.y + 48 - b, 2, b - a, '#ffe066')
        rect(cr.x + 46, cr.y + a, 2, b - a, '#ffe066')
      }
      rect(cr.x + 6, cr.y + 41, 36, 3, 'rgba(16,14,26,0.6)')
      rect(cr.x + 6, cr.y + 41, Math.round(36 * p), 3, '#ffe066')
    }
  }
  function drawFlights(s) {
    const t = s.t
    for (const d of s.deliveries) {
      const p = Math.min(1, Math.max(0, (t - d.sentAt) / d.duration))
      const gx = d.from.x + (d.to.x - d.from.x) * p
      const gy = d.from.y + (d.to.y - d.from.y) * p
      const hgt = Math.sin(Math.PI * p) * d.arc
      const sw = 30 - (hgt / C.ARC_MAX) * 10
      ctx.drawImage(shadowArt, Math.round(gx - sw / 2), Math.round(gy + 14), Math.round(sw), 10)
      let rot = Math.sin(p * Math.PI * 2) * 0.22
      let state = 'flying'
      if (d.item === 'fromage') rot = p * Math.PI * 4
      if (d.item === 'voiture') rot = p * Math.PI * 2
      if (d.item === 'planche') state = p < 0.6 ? 'folded' : 'open'
      if (d.item === 'parasol') state = 'folded'
      if (app.reduced) rot *= 0.3
      const size = 44
      ctx.save()
      ctx.globalAlpha = 0.72
      ctx.translate(Math.round(gx), Math.round(gy - hgt))
      ctx.rotate(rot)
      ctx.drawImage(spriteFor(d.item, state), -size / 2, -size / 2, size, size)
      ctx.restore()
    }
  }
  function drawBalls(s) {
    const alive = new Set()
    for (const b of s.balls) {
      if (!b.alive) continue
      alive.add(b.id)
      let tr = fx.trails.get(b.id)
      if (!tr) fx.trails.set(b.id, (tr = []))
      if (app.mode === 'PLAYING') {
        tr.push([b.x, b.y])
        if (tr.length > 6) tr.shift()
      }
      for (let k = 0; k < tr.length - 1; k += 1) {
        ctx.globalAlpha = 0.12 + (0.4 * k) / tr.length
        ctx.drawImage(trailArt, Math.round(tr[k][0]) - 3, Math.round(tr[k][1]) - 3)
      }
      ctx.globalAlpha = 1
      ctx.drawImage(ballArt, Math.round(b.x) - 6, Math.round(b.y) - 6)
    }
    for (const id of fx.trails.keys()) if (!alive.has(id)) fx.trails.delete(id)
  }
  function drawParticles(top) {
    for (const p of fx.particles) {
      const isTop = p.z > 2 || !p.sprite
      if (isTop !== top) continue
      const a = Math.min(1, (p.life - p.age) / 0.25)
      ctx.globalAlpha = a
      if (p.sprite) {
        const w = p.sprite.width * p.scale
        const h = p.sprite.height * p.scale
        if (p.z > 1) {
          ctx.globalAlpha = a * 0.3
          rect(Math.round(p.x - w / 3), Math.round(p.y + 2), Math.round((w * 2) / 3), 2, '#10101a')
          ctx.globalAlpha = a
        }
        if (p.rot) {
          ctx.save()
          ctx.translate(Math.round(p.x), Math.round(p.y - p.z))
          ctx.rotate(p.rot)
          ctx.drawImage(p.sprite, -w / 2, -h / 2, w, h)
          ctx.restore()
        } else ctx.drawImage(p.sprite, Math.round(p.x - w / 2), Math.round(p.y - p.z - h / 2), w, h)
      } else rect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size, p.color)
    }
    ctx.globalAlpha = 1
  }
  function drawFlashes(s) {
    const t = s.t
    fx.flashes = fx.flashes.filter((f) => t - f.born < f.life)
    for (const f of fx.flashes) {
      const age = t - f.born
      if (f.kind === 'cross') {
        const c = '#ff5a4a'
        for (let k = -6; k <= 6; k++) {
          rect(f.x + k, f.y + k, 2, 2, c)
          rect(f.x + k, f.y - k, 2, 2, c)
        }
      } else if (f.kind === 'danger') {
        // Brief local blink where someone was lost.
        if (Math.floor(age * 16) % 2 === 0) {
          const r = 10 + age * 30
          ctx.strokeStyle = '#ff3a2a'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(f.x, f.y, r, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }
  }
  function drawPopups(s) {
    const t = s.t
    fx.popups = fx.popups.filter((p) => t - p.born < p.life)
    for (const p of fx.popups) {
      const age = t - p.born
      const y = Math.round(p.y - age * 18)
      F.drawTextOC(ctx, p.text, Math.round(p.x), y, p.color, p.scale)
    }
  }

  /* ---------- crowd ---------- */
  function drawCrowd(s) {
    const t = vt()
    for (let row = 0; row < C.CROWD_ROWS.length; row++) {
      if (row === 2 && s.activeEvent === 'groupes') drawBanderole(s)
      for (const p of s.people) {
        if (!p.alive || p.row !== row) continue
        drawPerson(p, t)
      }
    }
  }
  function drawPerson(p, t) {
    const sign = SIGN_OF[p.index]
    const down = sign && fx.signDown[p.index] > t
    const raised = sign && !down
    let f
    if (p.moving) f = 2 + (Math.floor(t * 6 + p.index) % 2)
    else f = app.reduced ? 0 : Math.floor(t * 1.6 + p.index * 0.37) % 2
    const set = raised ? S.people[p.index].raised : S.people[p.index].frames
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    ctx.drawImage(set[f], x - 8, y - 10)
    if (sign) {
      const bob = f === 1 ? 1 : 0
      if (raised) {
        rect(x + 7, y - 14 + bob, 1, 8, '#7a5a3a')
        ctx.drawImage(S.signs[sign], x - 4, y - 24 + bob)
      } else {
        // Sign lowered after the sofa went.
        ctx.save()
        ctx.translate(x + 8, y + 2)
        ctx.rotate(0.9)
        ctx.drawImage(S.signs[sign], -4, -6)
        ctx.restore()
      }
    }
  }
  function drawBanderole(s) {
    const front = s.people.filter((p) => p.alive && p.row === 1)
    if (front.length < 2) return
    const x0 = Math.round(Math.min(...front.map((p) => p.x))) - 6
    const x1 = Math.round(Math.max(...front.map((p) => p.x))) + 6
    const y = 113
    rect(x0, y, x1 - x0, 9, '#1d1726')
    rect(x0 + 1, y + 1, x1 - x0 - 2, 7, '#f4ead2')
    rect(x0 - 1, y - 6, 2, 16, '#7a5a3a')
    rect(x1 - 1, y - 6, 2, 16, '#7a5a3a')
    F.drawTextC(ctx, 'ON RESTE GROUPÉS', (x0 + x1) / 2, y, '#d6402f')
  }

  /* ---------- police ---------- */
  function drawPolice(s) {
    const t = vt()
    const truce = s.activeEvent === 'treve'
    const f = app.reduced ? 0 : Math.floor(t * 2) % 2
    for (let k = 0; k < 9; k++) {
      const x = 96 + k * 36
      ctx.drawImage(S.crs[(truce ? 2 : 0) + ((f + (truce ? k : 0)) % 2)], x - 9, 560 - 9 + (truce ? 0 : f))
    }
    for (let k = 0; k < 8; k++) ctx.drawImage(S.crs[(truce ? 2 : 0) + ((f + k) % 2) * (truce ? 1 : 0) + (truce ? 0 : f)], 114 + k * 36 - 9, 582 - 9)
    s.launchers.forEach((L, li) => {
      if (!L.active) return
      const x = Math.round(L.x)
      const a = s.announces.find((q) => q.launcher === li)
      const ang = a ? a.angle : L.lastAngle ?? 0
      if (a) L.lastAngle = a.angle
      ctx.drawImage(S.crs[truce ? 2 + f : L.walking ? f : 0], x - 9, C.LAUNCHER_Y + 6)
      // The tube points where the next ball goes.
      const rad = (ang * Math.PI) / 180
      const tx = Math.sin(rad)
      const ty = -Math.cos(rad)
      for (let k = 0; k < 12; k++) rect(Math.round(x + tx * k) - 2, Math.round(C.LAUNCHER_Y - 2 + ty * k) - 2, 5, 5, k > 9 ? '#ff8a2a' : '#1d1726')
      for (let k = 0; k < 10; k++) rect(Math.round(x + tx * k) - 1, Math.round(C.LAUNCHER_Y - 2 + ty * k) - 1, 3, 3, '#3a4a7a')
      ctx.drawImage(S.launcher, x - 11, C.LAUNCHER_Y - 9)
      if (a) drawAnnounce(a, s.t)
    })
  }
  function drawAnnounce(a, t) {
    const k = Math.min(1, Math.max(0, (t - a.announcedAt) / (a.fireAt - a.announcedAt)))
    const rad = (a.angle * Math.PI) / 180
    const dx = Math.sin(rad)
    const dy = -Math.cos(rad)
    const len = 64
    const x0 = a.x
    const y0 = C.SPAWN_Y - 6
    for (let d = 0; d < len; d += 6) {
      const filled = d / len <= k
      const x = Math.round(x0 + dx * d)
      const y = Math.round(y0 + dy * d)
      rect(x - 2, y - 2, 4, 4, '#1d1726')
      rect(x - 1, y - 1, 2, 2, filled ? '#ff6a3a' : '#ffd23f')
    }
    // Arrow head.
    const hx = x0 + dx * len
    const hy = y0 + dy * len
    for (let w = 0; w < 6; w++) {
      const bx = hx - dx * w * 1.5
      const by = hy - dy * w * 1.5
      const px = -dy
      const py = dx
      rect(Math.round(bx + px * w) - 1, Math.round(by + py * w) - 1, 3, 3, '#1d1726')
      rect(Math.round(bx - px * w) - 1, Math.round(by - py * w) - 1, 3, 3, '#1d1726')
      rect(Math.round(bx + px * w), Math.round(by + py * w), 1, 1, '#ffd23f')
      rect(Math.round(bx - px * w), Math.round(by - py * w), 1, 1, '#ffd23f')
    }
  }

  /* ---------- stock ---------- */
  function drawStock(s) {
    const t = s.t
    const x = s.stock.x - 28
    const y = s.stock.y - 28
    const k = Math.min(1, Math.max(0, (s.stock.readyAt - t) / C.RELOAD))
    F.drawTextOC(ctx, 'STOCK', s.stock.x, y - 13, '#f4ead2')
    rect(x - 2, y - 2, 60, 60, '#10131c')
    const flash = t - fx.readyFlash < 0.18
    rect(x, y, 56, 56, flash ? '#ffffff' : '#f4ead2')
    rect(x + 3, y + 3, 50, 50, '#2a3046')
    rect(x + 3, y + 3, 50, 2, '#3a4260')
    ctx.drawImage(S.items[s.stock.next], x + 4, y + 4, 48, 48)
    if (k > 0) {
      const hh = Math.ceil(50 * k)
      rect(x + 3, y + 3, 50, hh, 'rgba(10,12,22,0.66)')
      rect(x + 3, y + 3 + hh - 1, 50, 1, '#ffd23f')
    }
    rect(x, y + 60, 56, 6, '#10131c')
    rect(x + 1, y + 61, Math.round(54 * (1 - k)), 4, k > 0 ? '#ffd23f' : '#9cf27a')
    if (app.firstRun && t < 9 && fx.sends < 4) {
      const lines = ['LE STOCK', 'RECHARGE', 'APRÈS', 'CHAQUE', 'ENVOI']
      const bx = s.stock.x
      const by = y - 72
      rect(bx - 31, by - 3, 62, lines.length * 9 + 5, 'rgba(16,19,28,0.85)')
      lines.forEach((l, i) => F.drawTextC(ctx, l, bx, by + i * 9, '#ffd23f'))
    }
  }

  /* ---------- HUD ---------- */
  function drawHud(s) {
    const t = s.t
    rect(0, 0, W, 48, '#151a28')
    rect(0, 47, W, 1, '#2c3346')
    const alive = Sim.survivors(s)
    const blink = t - fx.lostBlink < 0.6 && Math.floor((t - fx.lostBlink) * 10) % 2 === 0
    F.drawText(ctx, 'SURVIVANTS', 12, 6, '#a8b0c4')
    F.drawText(ctx, `${alive}/${s.people.length}`, 12, 15, blink ? '#ff5a4a' : '#ffffff', 3)
    const remain = Math.max(0, Math.ceil(C.RUN_DURATION - t - 1e-9))
    const urgent = remain <= 10 && Math.floor(t * 4) % 2 === 0
    F.drawTextC(ctx, String(remain), 240, -2, urgent ? '#ffd23f' : '#ffffff', 5)
    F.drawTextC(ctx, 'SECONDES', 240, 38, '#a8b0c4')
    const eb = t - fx.evacBlink < 0.3
    F.drawText(ctx, 'RENVOYÉES', 300, 6, '#a8b0c4')
    F.drawText(ctx, String(s.stats.evacuated), 300, 16, eb ? '#9cf27a' : '#c8d0e0', 2)
  }
  function drawButtons() {
    for (const b of buttons()) {
      const hot = app.pointer.x >= b.x && app.pointer.x < b.x + b.w && app.pointer.y >= b.y && app.pointer.y < b.y + b.h
      if (b.icon) {
        rect(b.x, b.y, b.w, b.h, '#10131c')
        rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, hot ? '#3a4260' : '#262c40')
        const cx = b.x + 16
        const cy = b.y + 16
        if (b.icon === 'pause') {
          if (app.mode === 'PAUSED') for (let k = 0; k < 10; k++) rect(cx - 4 + k / 2, cy - 7 + k * 0.7, 2, 14 - k * 1.4, '#f4ead2')
          else {
            rect(cx - 6, cy - 7, 4, 14, '#f4ead2')
            rect(cx + 2, cy - 7, 4, 14, '#f4ead2')
          }
        } else {
          rect(cx - 8, cy - 3, 4, 6, '#f4ead2')
          for (let k = 0; k < 5; k++) rect(cx - 4 + k, cy - 3 - k, 1, 6 + 2 * k, '#f4ead2')
          if (app.muted) {
            for (let k = 0; k < 8; k++) {
              rect(cx + 3 + k, cy - 4 + k, 1, 1, '#ff5a4a')
              rect(cx + 3 + k, cy + 3 - k, 1, 1, '#ff5a4a')
            }
          } else {
            rect(cx + 4, cy - 2, 1, 4, '#f4ead2')
            rect(cx + 7, cy - 5, 1, 10, '#f4ead2')
          }
        }
        continue
      }
      rect(b.x, b.y, b.w, b.h, '#10131c')
      rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, b.big ? (hot ? '#ff7a4a' : '#e8573f') : hot ? '#3a4260' : '#262c40')
      if (b.big) rect(b.x + 2, b.y + b.h - 6, b.w - 4, 4, hot ? '#e8573f' : '#b8402c')
      const sc = b.big ? 2 : 1
      F.drawTextC(ctx, b.label, b.x + b.w / 2, b.y + Math.round((b.h - 9 * sc) / 2) - (b.big ? 1 : 0), '#ffffff', sc)
    }
  }
  function drawBanner(s) {
    const t = s.t
    let text = null
    let sub = ''
    let color = '#ffd23f'
    if (t < C.FIRST_SHOT - C.ANNOUNCE) {
      text = 'CONSTRUIS !'
      sub = `PREMIERS TIRS DANS ${Math.ceil(C.FIRST_SHOT - C.ANNOUNCE - t)} S`
      color = '#9cf27a'
    }
    for (const ev of C.EVENTS) {
      const st = s.events[ev.id]
      if (st === 'announce') {
        text = EVENT_TEXT[ev.id][0]
        sub = 'ÇA ARRIVE…'
        color = Math.floor(t * 6) % 2 ? '#ffd23f' : '#ffffff'
      } else if (st === 'active') {
        text = EVENT_TEXT[ev.id][0]
        sub = EVENT_TEXT[ev.id][1]
        if (ev.id === 'treve') sub = `PLUS AUCUN TIR · ${Math.ceil(ev.start + ev.duration - t)}`
      }
    }
    if (fx.transient && fx.transient.until > t) ({ text, sub, color } = fx.transient)
    if (t >= C.LAST_SHOT_BEFORE && !s.over) {
      text = 'DERNIERS SAUVETAGES'
      sub = 'PLUS DE TIRS'
      color = '#9cf27a'
    }
    if (!text) return
    F.drawTextOC(ctx, text, 240, 604, color, 2)
    if (sub) F.drawTextC(ctx, sub, 240, 626, '#c8d0e0')
  }

  /* ---------- overlays ---------- */
  function drawPause() {
    rect(0, 48, W, H - 48, 'rgba(12,14,22,0.78)')
    F.drawTextOC(ctx, 'PAUSE', 240, 200, '#ffffff', 6)
    F.drawTextC(ctx, 'LE TEMPS EST SUSPENDU. LES CRS AUSSI.', 240, 258, '#a8b0c4')
  }
  function resultTitle(r) {
    if (r.survivors === 0) return 'CORTÈGE DISPERSÉ. LE FRIGO VA BIEN.'
    if (r.mostUsed === 'poisson' && r.survivors < 24) return 'LE POISSON A FAIT CE QU’IL A PU'
    if (r.survivors === r.total) return 'PERSONNE N’A BOUGÉ. SAUF LES MEUBLES.'
    if (r.survivors >= 18) return 'LE CANAPÉ A TENU'
    if (r.survivors >= 10) return 'MOBILIER SACRIFIÉ, CORTÈGE SAUVÉ'
    return 'LIVRAISON RÉUSSIE. MANIFESTATION MOINS.'
  }
  function drawResults() {
    const r = app.result
    rect(0, 48, W, H - 48, 'rgba(12,14,22,0.86)')
    F.drawTextOC(ctx, resultTitle(r), 240, 84, '#ffd23f', 2)
    if (r.reason === 'wiped') F.drawTextC(ctx, `PLUS PERSONNE APRÈS ${r.time.toFixed(1).replace('.', ',')} S`, 240, 110, '#ff8a7a')
    F.drawTextOC(ctx, `${r.survivors}/${r.total}`, 240, 128, r.survivors ? '#ffffff' : '#ff6a5a', 11)
    F.drawTextC(ctx, 'SURVIVANTS', 240, 232, '#a8b0c4', 2)
    const lines = [
      ['TEMPS TENU', `${Math.floor(r.time)} S`],
      ['BALLES RENVOYÉES', String(r.evacuated)],
      ['OBJETS LIVRÉS', r.tooLate ? `${r.delivered} (+${r.tooLate} TROP TARD)` : String(r.delivered)],
      ['OBJET LE PLUS UTILISÉ', r.mostUsed ? Sim.ITEMS[r.mostUsed].toUpperCase() : 'AUCUN'],
    ]
    lines.forEach(([k, v], i) => {
      const y = 274 + i * 30
      F.drawText(ctx, k, 64, y, '#a8b0c4', 2)
      F.drawText(ctx, v, 416 - F.textWidth(v, 2), y, '#ffffff', 2)
      rect(64, y + 22, 352, 1, '#2c3346')
    })
    if (r.mostUsed) ctx.drawImage(S.items[r.mostUsed], 216, 392, 48, 48)
    const rec = app.record
    if (app.newRecord) F.drawTextOC(ctx, 'NOUVEAU RECORD !', 240, 456, Math.floor(app.real * 4) % 2 ? '#9cf27a' : '#ffffff', 2)
    else if (rec) F.drawTextC(ctx, `RECORD : ${rec.survivors}/${rec.total} · ${Math.floor(rec.time)} S · ${rec.evacuated} RENVOYÉES`, 240, 460, '#a8b0c4')
    F.drawTextC(ctx, `PARTIE ${String(r.seed).toUpperCase()}`, 240, 530, '#5d6578')
  }

  /* ---------- menu ---------- */
  let menuScene = null
  function drawMenuScene() {
    if (!menuScene) {
      menuScene = Sim.create('menu', { NO_SHOTS: true })
      const deco = [['canape', 1, 4], ['frigo', 2, 4], ['poisson', 3, 4], ['voiture', 4, 4], ['armoire', 5, 4], ['palette', 0, 5], ['chaise', 6, 5]]
      for (const [item, c, r] of deco) {
        const i = Sim.cellIndex(menuScene, c, r)
        menuScene.cells[i].state = 'OCCUPIED'
        menuScene.cells[i].item = item
      }
    }
    const s = menuScene
    s.t = app.real
    drawBarricades(s)
    drawCrowd(s)
    drawPolice(s)
  }
  function drawMenu() {
    const t = app.real
    rect(0, 150, W, 270, 'rgba(12,14,22,0.72)')
    const bounce = app.reduced ? 0 : Math.round(Math.sin(t * 3) * 2)
    F.drawTextOC(ctx, 'BARRICASSE', 240, 164 + bounce, '#ffd23f', 7, '#1d1726')
    F.drawTextC(ctx, '« TOUT FAIT BARRICADE. MÊME LE POISSON. »', 240, 238, '#ffffff', 2)
    F.drawTextC(ctx, SLOGANS[Math.floor(t / 2.2) % SLOGANS.length], 240, 262, '#ff9a7a')
    const tuto = ['CLIQUE POUR LIVRER UNE BARRICADE.', 'ELLE DOIT ARRIVER AVANT LA BALLE.', 'SAUVE LE PLUS DE MANIFESTANTS POSSIBLE.']
    tuto.forEach((l, i) => F.drawTextC(ctx, l, 240, 300 + i * 22, '#e8ecf4', 2))
    F.drawTextC(ctx, 'LE STOCK RECHARGE APRÈS CHAQUE ENVOI.', 240, 374, '#a8b0c4')
    const rec = app.record
    if (rec) F.drawTextOC(ctx, `RECORD : ${rec.survivors}/${rec.total} SURVIVANTS · ${Math.floor(rec.time)} S`, 240, 508, '#ffffff')
    F.drawTextOC(ctx, 'ÉCHAP : PAUSE · M : SON', 240, 600, '#a8b0c4')
  }

  /* ---------- debug ---------- */
  function drawDebug(s) {
    ctx.save()
    ctx.globalAlpha = 0.8
    for (let i = 0; i < s.cells.length; i++) {
      const cr = Sim.cellRect(s, i)
      const st = s.cells[i].state
      frameRect(cr.x, cr.y, 48, 48, st === 'OCCUPIED' ? '#40ff60' : st === 'RESERVED' ? '#ffe066' : 'rgba(255,255,255,0.25)')
    }
    for (const p of s.people) if (p.alive) frameRect(Math.round(p.x - 7), p.y - 9, 14, 18, '#40e0ff')
    ctx.strokeStyle = '#ff40ff'
    for (const b of s.balls) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, C.BALL_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
    }
    rect(C.STREET_L, 48, 1, 548, '#ff40ff')
    rect(C.STREET_R, 48, 1, 548, '#ff40ff')
    rect(0, C.TOP_ABSORB_Y, W, 1, '#ff40ff')
    rect(0, C.BOTTOM_EXIT_Y, W, 1, '#ff40ff')
    ctx.restore()
    const lines = [
      `T ${s.t.toFixed(2)}  PHASE ${Sim.phaseAt(s)}`,
      `BALLES ${s.balls.length}/${C.BALL_CAP}  TIRS ${s.stats.shots}  SAUTÉS ${s.stats.capSkipped}`,
      `GRAINE ${s.seed}`,
      `ÉVÉNEMENT ${s.activeEvent || '-'}`,
      `STOCK ${s.t >= s.stock.readyAt ? 'PRÊT' : (s.stock.readyAt - s.t).toFixed(2)}  VOLS ${s.deliveries.length}`,
    ]
    if (app.hover >= 0) lines.push(`LIVRAISON ICI ${Sim.deliveryTime(s, s.stock, app.hover).toFixed(2)} S`)
    rect(76, 50, 230, lines.length * 9 + 4, 'rgba(0,0,0,0.7)')
    lines.forEach((l, i) => F.drawText(ctx, l, 80, 52 + i * 9, '#40ff60'))
  }

  /* ---------- fit the logical 480 × 640 frame to the window ---------- */
  function fit() {
    const sw = window.innerWidth
    const sh = window.innerHeight
    let scale = Math.min(sw / W, sh / H)
    if (!matchMedia('(pointer: coarse)').matches && scale >= 1) scale = scale >= 2 ? Math.floor(scale) : Math.max(1, Math.floor(scale * 4) / 4)
    canvas.style.width = Math.floor(W * scale) + 'px'
    canvas.style.height = Math.floor(H * scale) + 'px'
  }
  addEventListener('resize', fit)
  fit()

  // Debug hook for tests and the console.
  if (app.debug || params.has('test')) window.barricasse = { app, Sim, startGame, order, setPaused }

  requestAnimationFrame(frame)
})()
