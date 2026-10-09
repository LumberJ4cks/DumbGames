/*
 * BARRICASSE — « Tout fait barricade. Même le poisson. »
 *
 * A defensive, upside-down brick-breaker in landscape. Demonstrators on the left of the
 * street, a police line on the right sending big arcade balls, and in between the player
 * drops furniture anywhere (overlaps allowed): it flies from a single stock icon and only
 * protects once it lands. Big sturdy objects take several hits; the football takes none.
 * Ninety seconds, keep as many people as possible.
 *
 * This file: screens, input, rendering, particles and the glue to sim.js (rules) and
 * audio.js (sound). The simulation runs at a fixed step; the renderer only reads it.
 * Portrait phones get the whole 640 × 360 frame rotated, never cropped.
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
    fournisseur: ['CHANGEMENT DE FOURNISSEUR', 'LE STOCK CHANGE DE TROTTOIR'],
  }

  const app = {
    mode: 'MENU',
    sim: null,
    seed: null,
    acc: 0,
    last: 0,
    real: 0,
    hover: null,
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
    rotated: false,
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
    app.result = Sim.summary(app.sim)
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
      b.push({ x: 588, y: 1, w: 24, h: 22, icon: 'pause', act: () => setPaused(app.mode === 'PLAYING') })
      b.push({ x: 614, y: 1, w: 24, h: 22, icon: 'sound', act: toggleMute })
    }
    if (app.mode === 'MENU') {
      b.push({ x: 210, y: 240, w: 220, h: 36, label: 'TENIR 90 SECONDES', big: true, act: () => startGame() })
      b.push({ x: 210, y: 284, w: 106, h: 22, label: app.muted ? 'SON : NON' : 'SON : OUI', act: toggleMute })
      b.push({ x: 324, y: 284, w: 106, h: 22, label: app.reduced ? 'MOUVEMENT : -' : 'MOUVEMENT : +', act: toggleReduced })
    }
    if (app.mode === 'PAUSED') {
      b.push({ x: 220, y: 156, w: 200, h: 34, label: 'REPRENDRE', big: true, act: () => setPaused(false) })
      b.push({ x: 220, y: 198, w: 200, h: 24, label: app.reduced ? 'MOUVEMENTS RÉDUITS : OUI' : 'MOUVEMENTS RÉDUITS : NON', act: toggleReduced })
      b.push({
        x: 220,
        y: 230,
        w: 200,
        h: 24,
        label: 'ABANDONNER',
        act: () => {
          audio.stopMusic()
          app.mode = 'MENU'
        },
      })
    }
    if (app.mode === 'RESULTS' && app.real - app.resultsAt > 0.5) {
      b.push({ x: 140, y: 312, w: 172, h: 36, label: 'REJOUER (R)', big: true, act: () => startGame() })
      b.push({ x: 328, y: 312, w: 172, h: 36, label: 'MÊME PARTIE', big: true, act: () => startGame(app.result.seed) })
    }
    return b
  }

  /* ---------- input ---------- */
  function toLogical(e) {
    const r = canvas.getBoundingClientRect()
    // Rotated frame (portrait phone): the canvas is turned a quarter clockwise.
    if (app.rotated) return { x: ((e.clientY - r.top) / r.height) * W, y: ((r.right - e.clientX) / r.width) * H }
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  let firstTouch = true
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    audio.init()
    if (firstTouch && e.pointerType !== 'mouse') {
      // Phones: full screen in landscape when the browser allows it.
      firstTouch = false
      try {
        const fs = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
        if (fs && fs.then)
          fs.then(() => screen.orientation?.lock?.('landscape'))
            .catch(() => {})
            .finally(() => setTimeout(fit, 300))
      } catch {}
    }
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
    app.hover = e.pointerType === 'mouse' ? p : null
  })
  canvas.addEventListener('pointerleave', () => (app.hover = null))
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
    if (!Sim.inZone(s, p.x, p.y)) return
    const r = Sim.command(s, p.x, p.y)
    if (r.ok) {
      fx.sends++
      return
    }
    if (r.reason === 'reload' && s.t - fx.chargeMsgAt > 0.45) {
      // One small message, not one per click.
      fx.chargeMsgAt = s.t
      popup('ÇA CHARGE', s.stock.x, s.stock.side === 'main' ? C.STREET_B - 12 : C.STREET_T + 18, '#ffd23f', 0.6, 1)
      audio.play('refuse')
    }
  }

  /* ---------- art placement helpers: sprite drawn so its opaque bounds fill the box ---------- */
  function artOrigin(item, box) {
    const b = Sim.BOUNDS[item]
    const k = Sim.ITEMS[item].scale
    return { x: box.x - b[0] * k, y: box.y - b[1] * k, k }
  }
  function artPoint(item, box, ax, ay) {
    const o = artOrigin(item, box)
    return { x: o.x + ax * o.k, y: o.y + ay * o.k, k: o.k }
  }
  function drawArt(sprite, item, box, dx = 0, dy = 0) {
    const o = artOrigin(item, box)
    ctx.drawImage(sprite, Math.round(o.x + dx), Math.round(o.y + dy), 24 * o.k, 24 * o.k)
  }
  function spriteFor(item, state) {
    const fr = S.frames[item] || {}
    if (item === 'reverbere' && state === 'placed') return fr.lit
    if (item === 'planche' && state === 'folded') return fr.folded
    if (item === 'parasol' && state === 'folded') return fr.closed
    return S.items[item]
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
          fx.visual[e.obj.id] = { landAt: t, hitAt: -9 }
          const q = e.obj.box
          dust(q.cx, q.y + q.h, q.w)
          if (e.near || Math.random() < 0.06) popup('LIVRÉ', q.cx, q.y - 12, '#9cf27a', 0.8, 1)
          landingGag(e.obj, t)
          break
        }
        case 'toolate':
          audio.play('toolate')
          popup('TROP TARD', e.x, e.y - 20, '#ff6a5a', 0.9, 1)
          debris(e.item, e.x, e.y, 8)
          break
        case 'hit': {
          audio.play('hit', e.item)
          const v = fx.visual[e.obj.id] || (fx.visual[e.obj.id] = { landAt: -9 })
          v.hitAt = t
          debris(e.item, e.x, e.y, app.reduced ? 2 : 4)
          break
        }
        case 'destroy': {
          audio.play('destroy', e.item)
          const q = e.obj.box
          debris(e.item, q.cx, q.cy, app.reduced ? 5 : 10)
          breakGag(e.obj, t)
          delete fx.visual[e.obj.id]
          shake(e.item === 'palette' ? 3 : 1.5, 0.08)
          break
        }
        case 'kicked': {
          audio.play('kicked')
          const sp = Math.hypot(e.vx, e.vy) || 1
          particle({ x: e.obj.box.cx, y: e.obj.box.cy, vx: (e.vx / sp) * 160, vy: (e.vy / sp) * 160 + rnd(-30, 30), z: 6, vz: 120, sprite: S.items.ballon, scale: 1, life: 1.2, vr: -14, drag: 0.6, bounce: true })
          popup('INUTILE', e.obj.box.cx, e.obj.box.y - 10, '#ff9a7a', 0.9, 1)
          delete fx.visual[e.obj.id]
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
          for (let k = 0; k < 4; k++) particle({ x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 4), vx: rnd(-8, 8), vy: rnd(-14, -4), sprite: S.props.fumee, g: 0, scale: 2, life: 0.6 })
          fx.flashes.push({ kind: 'danger', x: e.x, y: e.y, born: t, life: 0.5 })
          fx.lostBlink = t
          shake(2, 0.12)
          break
        }
        case 'passed':
          particle({ x: C.LEFT_ABSORB_X, y: e.y, vx: -6, vy: 0, g: 0, sprite: S.props.fumee, scale: 2, life: 0.4 })
          audio.play('top')
          break
        case 'evacuated':
          fx.evacBlink = t
          for (let k = 0; k < 4; k++) particle({ x: C.RIGHT_EXIT_X, y: e.y + rnd(-4, 4), vx: rnd(0, 10), vy: rnd(-10, 10), g: 0, sprite: S.props.fumee, scale: 1, life: 0.35 })
          audio.play('evacuated')
          break
        case 'announce':
          audio.play('announce')
          break
        case 'fire':
          audio.play('fire')
          for (let k = 0; k < 3; k++) particle({ x: C.SPAWN_X - 4, y: e.ball.y + rnd(-3, 3), vx: rnd(-6, 4), vy: rnd(-12, 12), g: 0, sprite: S.props.fumee, scale: 2, life: 0.3 })
          break
        case 'event':
          eventFx(e, t)
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
        poof(C.STOCK_MAIN.x, C.STOCK_MAIN.y)
        poof(C.STOCK_ALT.x, C.STOCK_ALT.y)
      }
      if (e.phase === 'warn') fx.transient = { text: 'RETOUR EN BAS', sub: 'DANS 1 S', until: t + 1.0, color: '#ffd23f' }
      if (e.phase === 'done') fx.transient = { text: 'LE STOCK EST REVENU', sub: 'EN BAS', until: t + 1.2, color: '#9cf27a' }
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
  function dust(x, y, width) {
    const n = app.reduced ? 3 : 6
    for (let k = 0; k < n; k++) {
      const dir = k % 2 ? 1 : -1
      particle({ x: x + dir * rnd(width * 0.2, width * 0.5), y: y + rnd(-2, 1), vx: dir * rnd(20, 45), vy: rnd(-6, 6), vz: rnd(4, 14), g: 40, color: pick(['#d8d0c0', '#bfb6a6', '#e8e0d0']), size: 2, life: rnd(0.25, 0.45), drag: 4 })
    }
  }
  function spark(x, y) {
    for (let k = 0; k < 3; k++) particle({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), g: 0, color: '#ffe7b0', size: 1, life: 0.15 })
  }
  function poof(x, y) {
    for (let k = 0; k < 8; k++) particle({ x: x + rnd(-16, 16), y: y + rnd(-14, 14), vx: rnd(-20, 20), vy: rnd(-20, 5), g: 0, sprite: S.props.fumee, scale: 3, life: rnd(0.3, 0.6) })
  }
  function debris(item, x, y, n) {
    const cols = S.palette[item] || ['#888']
    for (let k = 0; k < n; k++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(30, 90)
      particle({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, z: rnd(4, 14), vz: rnd(40, 110), color: pick(cols), size: pick([2, 2, 3, 4]), life: rnd(0.5, 0.9), drag: 1.5, bounce: true })
    }
  }
  function prop(name, x, y, opts = {}) {
    particle(Object.assign({ x, y, vx: rnd(-50, 50), vy: rnd(-40, 20), z: 10, vz: rnd(80, 140), sprite: S.props[name], scale: 2, life: 1.3, vr: rnd(-8, 8), drag: 1, bounce: true }, opts))
  }
  function remnant(frame, o, life, extra) {
    fx.remnants.push(Object.assign({ frame, item: o.item, box: o.box, born: app.sim.t, life }, extra || {}))
  }

  /** The comic part of a landing. */
  function landingGag(o, t) {
    const v = fx.visual[o.id]
    const q = o.box
    if (o.item === 'planche') v.ironAt = t + 0.35
    if (o.item === 'poisson') for (let k = 0; k < 6; k++) prop('goutte', q.cx + rnd(-q.w / 3, q.w / 3), q.cy + 6, { life: 0.6, vz: rnd(40, 80), scale: 1 })
    if (o.item === 'carton') for (let k = 0; k < 4; k++) particle({ x: q.cx + rnd(-10, 10), y: q.cy, vx: rnd(-30, 30), vy: rnd(-10, 10), z: 8, vz: rnd(30, 60), color: '#d8f0ff', size: 1, life: 0.5 })
  }
  /** The comic part of a destruction. */
  function breakGag(o, t) {
    const q = o.box
    const x = q.cx
    const y = q.cy
    const k = Sim.ITEMS[o.item].scale
    const ps = Math.max(1, k - 1)
    switch (o.item) {
      case 'chaise':
        remnant(S.frames.chaise.folded, o, 0.9)
        break
      case 'palette':
        for (let n = 0; n < 3; n++) prop('planche_bois', x, y - 8 + n * 7, { vz: rnd(120, 180), vr: rnd(-12, 12), life: 1.4 })
        break
      case 'voiture':
        prop('roue', x, y, { scale: k })
        break
      case 'planche':
        prop('fer', x + 8, y - 10)
        break
      case 'frigo':
        remnant(S.frames.frigo.open, o, 0.7)
        prop('yaourt', x, y, { vz: 160 })
        break
      case 'canape':
        prop('telecommande', x, y, { scale: ps + 1 })
        for (const p of app.sim.people) if (SIGN_OF[p.index] === 'canape') fx.signDown[p.index] = t + 2.5
        break
      case 'reverbere':
        for (let n = 0; n < 5; n++) particle({ x: x + 8, y: y - 12, vx: rnd(-40, 40), vy: rnd(-30, 10), z: 10, vz: rnd(30, 80), color: '#fff2a8', size: 1, life: 0.4 })
        break
      case 'poisson':
        for (let n = 0; n < 4; n++) prop('goutte', x, y, { scale: 1, life: 0.6 })
        break
      case 'armoire':
        remnant(S.frames.armoire.open, o, 0.8)
        for (let n = 0; n < 3; n++) prop('cintre', x + (n - 1) * 10, y - 6, { scale: ps + 1 })
        break
      case 'baignoire':
        prop('canard', x + 8, y - 8, { vz: 170, life: 1.5 })
        for (let n = 0; n < 5; n++) prop('goutte', x, y - 4, { scale: 1, life: 0.6 })
        break
      case 'photocopieuse':
        prop('feuille_non', x, y - 6, { vz: 60, g: 50, vr: rnd(-2, 2), life: 1.6, drag: 1.5 })
        break
      case 'nain': {
        const pt = artPoint('nain', q, 7, 0)
        remnant(S.props.bonnet, o, 1.2, { at: pt, scale: k })
        break
      }
      case 'caddie': {
        remnant(S.frames.caddie.nowheel, o, 0.3)
        remnant(null, o, 1.6, { wheel: artPoint('caddie', q, 18.5, 20.5) })
        break
      }
      case 'plante':
        for (let n = 0; n < 10; n++) prop('feuille', x, y - 6, { scale: 1, g: 90, life: 1.2, drag: 2 })
        break
      case 'toilettes':
        for (let n = 0; n < 10; n++) prop('goutte', x, y - 4, { life: 0.8 })
        break
      case 'distributeur':
        prop('canette', x, y + 6, { vz: 60, vy: 40 })
        break
      case 'gateau':
        for (let n = 0; n < 8; n++) prop('creme', x, y, { life: 0.9 })
        break
      case 'tableau':
        remnant(S.frames.tableau.empty, o, 1.2)
        break
      case 'glaciere':
        for (let n = 0; n < 6; n++) prop('glacon', x, y, { life: 1 })
        break
      case 'barbecue':
        for (let n = 0; n < 2; n++) prop('saucisse', x, y)
        break
      case 'merguez':
        prop('saucisse', x, y)
        break
      case 'carton':
        for (let n = 0; n < 6; n++) particle({ x, y, vx: rnd(-50, 50), vy: rnd(-40, 20), z: 8, vz: rnd(40, 90), color: '#d8f0ff', size: 1, life: 0.6 })
        break
      case 'trophee':
        for (let n = 0; n < 6; n++) particle({ x, y: y - 6, vx: rnd(-30, 30), vy: rnd(-30, 10), z: 10, vz: rnd(30, 60), color: '#fff0a0', size: 1, life: 0.6 })
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
    drawHover(s)
    drawRemnants(s)
    drawReserved(s)
    drawObjects(s)
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

  function corners(x, y, w, h, col) {
    const L = 7
    for (const [left, top] of [[true, true], [false, true], [true, false], [false, false]]) {
      const hx = left ? x : x + w - L
      const vx = left ? x : x + w - 2
      const hy = top ? y : y + h - 2
      const vy = top ? y : y + h - L
      rect(hx, hy, L, 2, col)
      rect(vx, vy, 2, L, col)
    }
  }
  function drawHover(s) {
    const p = app.hover
    if (!p || app.mode !== 'PLAYING' || !Sim.inZone(s, p.x, p.y)) return
    const ready = s.t >= s.stock.readyAt
    const item = s.stock.next
    const q = Sim.boxAt(s, item, p.x, p.y)
    if (ready) {
      ctx.globalAlpha = 0.4
      drawArt(spriteFor(item, 'placed'), item, q)
      ctx.globalAlpha = 1
    }
    corners(q.x - 2, q.y - 2, q.w + 4, q.h + 4, ready ? '#ffffff' : '#8a92a4')
  }
  /** Objects sorted by their foot so the overlaps read in depth. */
  function drawObjects(s) {
    const t = s.t
    const list = s.objects.filter((o) => o.alive).sort((a, b) => a.box.y + a.box.h - (b.box.y + b.box.h) || a.id - b.id)
    for (const o of list) drawObject(o, t, fx.visual[o.id] || { landAt: -9, hitAt: -9 })
  }
  function drawObject(o, t, v) {
    const q = o.box
    const item = o.item
    const k = Sim.ITEMS[item].scale
    if (item === 'reverbere') {
      const lp = artPoint(item, q, 14, 9)
      ctx.globalAlpha = 0.16
      rect(Math.round(lp.x), Math.round(lp.y), 8 * k, 12 * k, '#fff2a8')
      ctx.globalAlpha = 1
    }
    const sp = spriteFor(item, 'placed')
    const age = t - v.landAt
    const hitAge = t - (v.hitAt ?? -9)
    const jolt = hitAge < 0.15 && !app.reduced ? (Math.floor(hitAge * 60) % 2 ? 1 : -1) : 0
    if (age < 0.16 && !app.reduced) {
      // Squash on landing, anchored on the object's foot.
      const n = 1 - age / 0.16
      const sx = 1 + 0.2 * n
      const sy = 1 - 0.26 * n
      const o0 = artOrigin(item, q)
      ctx.save()
      ctx.translate(q.cx, q.y + q.h)
      ctx.scale(sx, sy)
      ctx.drawImage(sp, o0.x - q.cx, o0.y - (q.y + q.h), 24 * k, 24 * k)
      ctx.restore()
    } else if (item === 'cheval' && !app.reduced) {
      const o0 = artOrigin(item, q)
      ctx.save()
      ctx.translate(q.cx, q.y + q.h)
      ctx.rotate(Math.sin(t * 2.6 + o.id) * 0.08)
      ctx.drawImage(sp, o0.x - q.cx, o0.y - (q.y + q.h), 24 * k, 24 * k)
      ctx.restore()
    } else drawArt(sp, item, q, jolt, 0)
    if (o.maxHp > 1 && o.hp < o.maxHp) drawCracks(o, jolt)
    if (item === 'planche' && v.ironAt !== undefined && t >= v.ironAt - 0.25) {
      const n = Math.min(1, (t - v.ironAt + 0.25) / 0.25)
      const pt = artPoint(item, q, 13, 2)
      ctx.drawImage(S.props.fer, Math.round(pt.x), Math.round(pt.y - (1 - n) * 40), 8 * k, 6 * k)
    }
    if (item === 'trophee' && (t * 0.8 + o.id * 0.37) % 1 < 0.12) {
      const sx2 = q.x + 4 + ((o.id * 7) % Math.max(1, q.w - 8))
      rect(sx2, q.y + 6, 1, 5, '#ffffff')
      rect(sx2 - 2, q.y + 8, 5, 1, '#ffffff')
    }
    if (item === 'barbecue' && !app.reduced && (t * 3 + o.id) % 1 < 0.04) particle({ x: q.cx + rnd(-8, 8), y: q.y + 4, vx: rnd(-3, 3), vy: -12, g: 0, sprite: S.props.fumee, scale: 2, life: 0.8 })
    if (item === 'carton' && age < 0.5) F.drawTextOC(ctx, 'CLING', q.cx, q.y - 10, '#d8f0ff')
  }
  /** Damage shows on the object itself: dark cracks, more of them after each hit. */
  function drawCracks(o, dx) {
    const q = o.box
    const lost = o.maxHp - o.hp
    const r = seeded(o.id * 97 + 13)
    for (let n = 0; n < lost * 2; n++) {
      let x = Math.round(q.x + q.w * (0.2 + 0.6 * r())) + dx
      let y = Math.round(q.y + q.h * (0.15 + 0.5 * r()))
      const len = 4 + Math.floor(r() * (q.h / 4))
      for (let i = 0; i < len; i++) {
        rect(x, y, 2, 2, '#1d1726')
        y += 1
        x += r() < 0.5 ? -1 : 1
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
        const k = Sim.ITEMS.caddie.scale
        const cx = Math.round(r.wheel.x)
        const cy = Math.round(r.wheel.y)
        const R0 = 2 * k
        rect(cx - R0 - 1, cy - R0 - 1, 2 * R0 + 2, 2 * R0 + 2, '#1d1726')
        rect(cx - R0, cy - R0, 2 * R0, 2 * R0, '#4a4756')
        const a = age * 14
        rect(Math.round(cx + Math.cos(a) * (R0 - 1)), Math.round(cy + Math.sin(a) * (R0 - 1)), k, k, '#c9c6bc')
        rect(Math.round(cx - Math.cos(a) * (R0 - 1)), Math.round(cy - Math.sin(a) * (R0 - 1)), k, k, '#c9c6bc')
      } else if (r.at) ctx.drawImage(r.frame, Math.round(r.at.x), Math.round(r.at.y), r.frame.width * r.scale, r.frame.height * r.scale)
      else drawArt(r.frame, r.item, r.box)
      ctx.globalAlpha = 1
    }
  }
  function drawReserved(s) {
    const t = s.t
    for (const d of s.deliveries) {
      const q = d.box
      const p = Math.min(1, (t - d.sentAt) / d.duration)
      ctx.globalAlpha = 0.28
      drawArt(spriteFor(d.item, 'placed'), d.item, q)
      ctx.globalAlpha = 1
      // Marching-ants outline of the exact footprint, and how long until it lands.
      const off = Math.floor(t * 24) % 8
      const x0 = q.x - 1
      const y0 = q.y - 1
      const w = q.w + 2
      const h = q.h + 2
      for (let k = -8; k < Math.max(w, h); k += 8) {
        const a = Math.max(0, k + off)
        const bw = Math.min(w, k + off + 4)
        if (bw > a) {
          rect(x0 + a, y0, bw - a, 1, '#ffe066')
          rect(x0 + w - bw, y0 + h - 1, bw - a, 1, '#ffe066')
        }
        const bh = Math.min(h, k + off + 4)
        if (bh > a) {
          rect(x0, y0 + h - bh, 1, bh - a, '#ffe066')
          rect(x0 + w - 1, y0 + a, 1, bh - a, '#ffe066')
        }
      }
      const bw = Math.max(10, Math.min(36, q.w - 4))
      rect(Math.round(q.cx - bw / 2), q.y + q.h + 2, bw, 2, '#1d1726')
      rect(Math.round(q.cx - bw / 2), q.y + q.h + 2, Math.round(bw * p), 2, '#ffe066')
    }
  }
  function drawFlights(s) {
    const t = s.t
    for (const d of s.deliveries) {
      const p = Math.min(1, Math.max(0, (t - d.sentAt) / d.duration))
      const gx = d.from.x + (d.to.x - d.from.x) * p
      const gy = d.from.y + (d.to.y - d.from.y) * p
      const hgt = Math.sin(Math.PI * p) * d.arc
      const k = Sim.ITEMS[d.item].scale
      const sw = (14 + 8 * k) * (1 - (hgt / C.ARC_MAX) * 0.35)
      ctx.drawImage(shadowArt, Math.round(gx - sw / 2), Math.round(gy + d.box.h / 2 - 6), Math.round(sw), 8)
      let rot = Math.sin(p * Math.PI * 2) * 0.22
      let state = 'flying'
      if (d.item === 'fromage') rot = p * Math.PI * 4
      if (d.item === 'voiture') rot = p * Math.PI * 2
      if (d.item === 'planche') state = p < 0.6 ? 'folded' : 'open'
      if (d.item === 'parasol') state = 'folded'
      if (app.reduced) rot *= 0.3
      const size = 24 * k
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
      for (let k = 0; k < tr.length - 1; k++) {
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
      // Brief local blink where someone was lost.
      if (f.kind === 'danger' && Math.floor(age * 16) % 2 === 0) {
        ctx.strokeStyle = '#ff3a2a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(f.x, f.y, 10 + age * 30, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
  function drawPopups(s) {
    const t = s.t
    fx.popups = fx.popups.filter((p) => t - p.born < p.life)
    for (const p of fx.popups) {
      const age = t - p.born
      F.drawTextOC(ctx, p.text, Math.round(p.x), Math.round(p.y - age * 18), p.color, p.scale)
    }
  }

  /* ---------- crowd: three lines facing right ---------- */
  function drawCrowd(s) {
    const t = vt()
    const people = s.people.filter((p) => p.alive).sort((a, b) => a.y - b.y || a.line - b.line)
    for (const p of people) drawPerson(p, t)
    if (s.activeEvent === 'groupes') drawBanderole(s)
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
    // The banner is too long: it runs along the middle line, letters stacked.
    const mid = s.people.filter((p) => p.alive && p.line === 1)
    if (mid.length < 2) return
    const y0 = Math.round(Math.min(...mid.map((p) => p.y))) - 4
    const y1 = Math.round(Math.max(...mid.map((p) => p.y))) + 4
    const x = C.CROWD_LINES[1] + 12
    rect(x - 1, y0, 9, y1 - y0, '#1d1726')
    rect(x, y0 + 1, 7, y1 - y0 - 2, '#f4ead2')
    rect(x - 2, y0 - 3, 11, 2, '#7a5a3a')
    rect(x - 2, y1 + 1, 11, 2, '#7a5a3a')
    const text = 'ON RESTE GROUPÉS'
    const step = Math.max(8, Math.floor((y1 - y0 - 6) / text.length))
    const start = Math.round((y0 + y1) / 2 - (text.length * step) / 2)
    for (let i = 0; i < text.length; i++) F.drawText(ctx, text[i], x + 2, start + i * step, '#d6402f')
  }

  /* ---------- police, on the right, facing left ---------- */
  function drawPolice(s) {
    const t = vt()
    const truce = s.activeEvent === 'treve'
    const f = app.reduced ? 0 : Math.floor(t * 2) % 2
    const frameFor = (k) => S.crs[truce ? 2 + ((f + k) % 2) : f]
    for (let k = 0; k < 8; k++) ctx.drawImage(frameFor(k), 574 - 9 + (truce ? 0 : f), 76 + k * 32 - 9)
    for (let k = 0; k < 7; k++) ctx.drawImage(frameFor(k + 1), 602 - 9, 92 + k * 32 - 9)
    s.launchers.forEach((L, li) => {
      if (!L.active) return
      const y = Math.round(L.y)
      const a = s.announces.find((q) => q.launcher === li)
      if (a) L.lastAngle = a.angle
      const ang = a ? a.angle : L.lastAngle ?? 0
      ctx.drawImage(S.crs[truce ? 2 + f : L.walking ? f : 0], C.LAUNCHER_X + 6, y - 9)
      // The tube points where the next ball goes.
      const rad = (ang * Math.PI) / 180
      const tx = -Math.cos(rad)
      const ty = Math.sin(rad)
      const x0 = C.LAUNCHER_X - 2
      for (let k = 0; k < 12; k++) rect(Math.round(x0 + tx * k) - 2, Math.round(y + ty * k) - 2, 5, 5, k > 9 ? '#ff8a2a' : '#1d1726')
      for (let k = 0; k < 10; k++) rect(Math.round(x0 + tx * k) - 1, Math.round(y + ty * k) - 1, 3, 3, '#3a4a7a')
      ctx.drawImage(S.launcher, C.LAUNCHER_X - 9, y - 11)
      if (a) drawAnnounce(a, s.t)
    })
  }
  function drawAnnounce(a, t) {
    const k = Math.min(1, Math.max(0, (t - a.announcedAt) / (a.fireAt - a.announcedAt)))
    const rad = (a.angle * Math.PI) / 180
    const dx = -Math.cos(rad)
    const dy = Math.sin(rad)
    const len = 60
    const x0 = C.SPAWN_X - 6
    const y0 = a.y
    for (let d = 0; d < len; d += 6) {
      const x = Math.round(x0 + dx * d)
      const y = Math.round(y0 + dy * d)
      rect(x - 2, y - 2, 4, 4, '#1d1726')
      rect(x - 1, y - 1, 2, 2, d / len <= k ? '#ff6a3a' : '#ffd23f')
    }
    const hx = x0 + dx * len
    const hy = y0 + dy * len
    for (let w = 0; w < 6; w++) {
      const bx = hx - dx * w * 1.5
      const by = hy - dy * w * 1.5
      for (const sgn of [1, -1]) {
        const px = Math.round(bx - dy * w * sgn)
        const py = Math.round(by + dx * w * sgn)
        rect(px - 1, py - 1, 3, 3, '#1d1726')
        rect(px, py, 1, 1, '#ffd23f')
      }
    }
  }

  /* ---------- stock ---------- */
  function drawStock(s) {
    const t = s.t
    const cx = s.stock.x
    const cy = s.stock.y
    const x = cx - 17
    const y = cy - 17
    const k = Math.min(1, Math.max(0, (s.stock.readyAt - t) / C.RELOAD))
    const item = s.stock.next
    F.drawTextO(ctx, 'STOCK', x - 26, cy - 4, '#f4ead2')
    rect(x - 2, y - 2, 38, 38, '#10131c')
    rect(x, y, 34, 34, t - fx.readyFlash < 0.18 ? '#ffffff' : '#f4ead2')
    rect(x + 2, y + 2, 30, 30, '#2a3046')
    ctx.drawImage(S.items[item], x + 5, y + 5)
    if (k > 0) {
      const hh = Math.ceil(30 * k)
      rect(x + 2, y + 2, 30, hh, 'rgba(10,12,22,0.66)')
      rect(x + 2, y + 2 + hh - 1, 30, 1, '#ffd23f')
    }
    // What is coming: its name, how sturdy it is, and the reload.
    const info = Sim.ITEMS[item]
    const tx = x + 42
    F.drawTextO(ctx, info.name.toUpperCase(), tx, y, '#ffffff')
    if (info.hp === 0) F.drawTextO(ctx, 'NE SERT À RIEN', tx, y + 11, '#ff9a7a')
    else {
      F.drawTextO(ctx, 'SOLIDE', tx, y + 11, '#a8b0c4')
      for (let n = 0; n < 3; n++) {
        rect(tx + 26 + n * 8, y + 12, 6, 6, '#10131c')
        rect(tx + 27 + n * 8, y + 13, 4, 4, n < info.hp ? '#9cf27a' : '#3a4260')
      }
    }
    rect(tx, y + 24, 60, 6, '#10131c')
    rect(tx + 1, y + 25, Math.round(58 * (1 - k)), 4, k > 0 ? '#ffd23f' : '#9cf27a')
    if (app.firstRun && t < 9 && fx.sends < 4) F.drawTextO(ctx, '← LE STOCK RECHARGE APRÈS CHAQUE ENVOI', tx + 72, y + 24, '#ffd23f')
  }

  /* ---------- HUD ---------- */
  function drawHud(s) {
    const t = s.t
    rect(0, 0, W, 24, '#151a28')
    rect(0, 23, W, 1, '#2c3346')
    const alive = Sim.survivors(s)
    const blink = t - fx.lostBlink < 0.6 && Math.floor((t - fx.lostBlink) * 10) % 2 === 0
    F.drawText(ctx, 'SURVIVANTS', 8, 8, '#a8b0c4')
    F.drawText(ctx, `${alive}/${s.people.length}`, 52, 3, blink ? '#ff5a4a' : '#ffffff', 2)
    const remain = Math.max(0, Math.ceil(C.RUN_DURATION - t - 1e-9))
    const urgent = remain <= 10 && Math.floor(t * 4) % 2 === 0
    F.drawTextC(ctx, String(remain), 320, -3, urgent ? '#ffd23f' : '#ffffff', 3)
    F.drawText(ctx, 'S', 342, 13, '#a8b0c4')
    const eb = t - fx.evacBlink < 0.3
    F.drawText(ctx, 'RENVOYÉES', 430, 8, '#a8b0c4')
    F.drawText(ctx, String(s.stats.evacuated), 470, 3, eb ? '#9cf27a' : '#c8d0e0', 2)
  }
  function drawButtons() {
    for (const b of buttons()) {
      const hot = app.pointer.x >= b.x && app.pointer.x < b.x + b.w && app.pointer.y >= b.y && app.pointer.y < b.y + b.h
      if (b.icon) {
        rect(b.x, b.y, b.w, b.h, '#10131c')
        rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, hot ? '#3a4260' : '#262c40')
        const cx = b.x + 12
        const cy = b.y + 11
        if (b.icon === 'pause') {
          if (app.mode === 'PAUSED') for (let k = 0; k < 7; k++) rect(cx - 3 + k, cy - 6 + k * 0.85, 1, 12 - k * 1.7, '#f4ead2')
          else {
            rect(cx - 5, cy - 6, 3, 12, '#f4ead2')
            rect(cx + 2, cy - 6, 3, 12, '#f4ead2')
          }
        } else {
          rect(cx - 7, cy - 2, 3, 5, '#f4ead2')
          for (let k = 0; k < 4; k++) rect(cx - 4 + k, cy - 2 - k, 1, 5 + 2 * k, '#f4ead2')
          if (app.muted) {
            for (let k = 0; k < 6; k++) {
              rect(cx + 2 + k, cy - 3 + k, 1, 1, '#ff5a4a')
              rect(cx + 2 + k, cy + 2 - k, 1, 1, '#ff5a4a')
            }
          } else {
            rect(cx + 2, cy - 1, 1, 3, '#f4ead2')
            rect(cx + 5, cy - 4, 1, 9, '#f4ead2')
          }
        }
        continue
      }
      rect(b.x, b.y, b.w, b.h, '#10131c')
      rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, b.big ? (hot ? '#ff7a4a' : '#e8573f') : hot ? '#3a4260' : '#262c40')
      if (b.big) rect(b.x + 2, b.y + b.h - 5, b.w - 4, 3, hot ? '#e8573f' : '#b8402c')
      const sc = b.big ? 2 : 1
      F.drawTextC(ctx, b.label, b.x + b.w / 2, b.y + Math.round((b.h - 9 * sc) / 2) - (b.big ? 1 : 0), '#ffffff', sc)
    }
  }
  /** Event banner, on the sidewalk the stock is not using. */
  function drawBanner(s) {
    const t = s.t
    let text = null
    let sub = ''
    let color = '#ffd23f'
    if (t < C.FIRST_SHOT - C.ANNOUNCE) {
      text = 'CONSTRUIS !'
      sub = `PREMIERS TIRS DANS ${Math.ceil(C.FIRST_SHOT - C.ANNOUNCE - t)} S · CLIQUE N’IMPORTE OÙ DANS LA RUE`
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
    const top = s.stock.side === 'main'
    const y = top ? 28 : 322
    F.drawTextOC(ctx, text, 320, y, color, 2)
    if (sub) F.drawTextOC(ctx, sub, 320, y + 18, '#e8ecf4')
  }

  /* ---------- overlays ---------- */
  function drawPause() {
    rect(0, 24, W, H - 24, 'rgba(12,14,22,0.78)')
    F.drawTextOC(ctx, 'PAUSE', 320, 70, '#ffffff', 5)
    F.drawTextC(ctx, 'LE TEMPS EST SUSPENDU. LES CRS AUSSI.', 320, 124, '#a8b0c4')
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
    rect(0, 24, W, H - 24, 'rgba(12,14,22,0.88)')
    F.drawTextOC(ctx, resultTitle(r), 320, 34, '#ffd23f', 2)
    if (r.reason === 'wiped') F.drawTextC(ctx, `PLUS PERSONNE APRÈS ${r.time.toFixed(1).replace('.', ',')} S`, 320, 56, '#ff8a7a')
    // Left: the big number. Right: the details.
    F.drawTextOC(ctx, `${r.survivors}/${r.total}`, 168, 82, r.survivors ? '#ffffff' : '#ff6a5a', 8)
    F.drawTextC(ctx, 'SURVIVANTS', 168, 160, '#a8b0c4', 2)
    const lines = [
      ['TEMPS TENU', `${Math.floor(r.time)} S`],
      ['BALLES RENVOYÉES', String(r.evacuated)],
      ['OBJETS LIVRÉS', r.tooLate ? `${r.delivered} (+${r.tooLate} TROP TARD)` : String(r.delivered)],
      ['LE PLUS UTILISÉ', r.mostUsed ? Sim.ITEMS[r.mostUsed].name.toUpperCase() : 'AUCUN'],
    ]
    lines.forEach(([k, v], i) => {
      const y = 82 + i * 24
      F.drawText(ctx, k, 330, y, '#a8b0c4')
      F.drawText(ctx, v, 612 - F.textWidth(v), y + 9, '#ffffff')
      rect(330, y + 20, 282, 1, '#2c3346')
    })
    if (r.mostUsed) ctx.drawImage(S.items[r.mostUsed], 330, 182, 48, 48)
    const rec = app.record
    if (app.newRecord) F.drawTextOC(ctx, 'NOUVEAU RECORD !', 320, 250, Math.floor(app.real * 4) % 2 ? '#9cf27a' : '#ffffff', 2)
    else if (rec) F.drawTextC(ctx, `RECORD : ${rec.survivors}/${rec.total} · ${Math.floor(rec.time)} S · ${rec.evacuated} RENVOYÉES`, 320, 254, '#a8b0c4')
    F.drawTextC(ctx, `PARTIE ${String(r.seed).toUpperCase()}`, 320, 290, '#5d6578')
  }

  /* ---------- menu ---------- */
  let menuScene = null
  function drawMenuScene() {
    if (!menuScene) {
      menuScene = Sim.create('menu', { NO_SHOTS: true })
      for (const [item, x, y] of [['canape', 200, 110], ['frigo', 300, 270], ['poisson', 420, 120], ['voiture', 440, 270], ['armoire', 160, 260], ['ballon', 360, 190]]) Sim.placeNow(menuScene, item, x, y)
    }
    const s = menuScene
    s.t = app.real
    drawObjects(s)
    drawCrowd(s)
    drawPolice(s)
  }
  function drawMenu() {
    const t = app.real
    rect(110, 34, 420, 296, 'rgba(12,14,22,0.8)')
    const bounce = app.reduced ? 0 : Math.round(Math.sin(t * 3) * 2)
    F.drawTextOC(ctx, 'BARRICASSE', 320, 44 + bounce, '#ffd23f', 6, '#1d1726')
    F.drawTextC(ctx, '« TOUT FAIT BARRICADE. MÊME LE POISSON. »', 320, 104, '#ffffff', 2)
    F.drawTextC(ctx, SLOGANS[Math.floor(t / 2.2) % SLOGANS.length], 320, 124, '#ff9a7a')
    const tuto = ['CLIQUE DANS LA RUE POUR LIVRER UNE BARRICADE.', 'ELLE DOIT ARRIVER AVANT LA BALLE.', 'SAUVE LE PLUS DE MANIFESTANTS POSSIBLE.']
    tuto.forEach((l, i) => F.drawTextC(ctx, l, 320, 146 + i * 20, '#e8ecf4', 2))
    F.drawTextC(ctx, 'LE STOCK RECHARGE APRÈS CHAQUE ENVOI. UN CANAPÉ ENCAISSE, UN BALLON NON.', 320, 212, '#a8b0c4')
    const rec = app.record
    if (rec) F.drawTextC(ctx, `RECORD : ${rec.survivors}/${rec.total} SURVIVANTS · ${Math.floor(rec.time)} S`, 320, 312, '#ffffff')
    F.drawTextOC(ctx, 'ÉCHAP : PAUSE · M : SON', 320, 340, '#a8b0c4')
  }

  /* ---------- debug ---------- */
  function drawDebug(s) {
    ctx.save()
    ctx.globalAlpha = 0.85
    frameRect(C.ZONE_L, C.STREET_T, C.ZONE_R - C.ZONE_L, C.STREET_B - C.STREET_T, 'rgba(255,255,255,0.3)')
    for (const o of s.objects) frameRect(o.box.x, o.box.y, o.box.w, o.box.h, '#40ff60')
    for (const d of s.deliveries) frameRect(d.box.x, d.box.y, d.box.w, d.box.h, '#ffe066')
    for (const p of s.people) if (p.alive) frameRect(p.x - 7, Math.round(p.y - 9), 14, 18, '#40e0ff')
    ctx.strokeStyle = '#ff40ff'
    for (const b of s.balls) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, C.BALL_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
    }
    rect(0, C.STREET_T, W, 1, '#ff40ff')
    rect(0, C.STREET_B, W, 1, '#ff40ff')
    rect(C.LEFT_ABSORB_X, 24, 1, H - 24, '#ff40ff')
    rect(C.RIGHT_EXIT_X, 24, 1, H - 24, '#ff40ff')
    ctx.restore()
    const lines = [
      `T ${s.t.toFixed(2)}  PHASE ${Sim.phaseAt(s)}  GRAINE ${s.seed}`,
      `BALLES ${s.balls.length}/${C.BALL_CAP}  TIRS ${s.stats.shots}  SAUTÉS ${s.stats.capSkipped}`,
      `ÉVÉNEMENT ${s.activeEvent || '-'}  OBJETS ${s.objects.length}`,
      `STOCK ${s.t >= s.stock.readyAt ? 'PRÊT' : (s.stock.readyAt - s.t).toFixed(2)}  VOLS ${s.deliveries.length}`,
    ]
    if (app.hover && Sim.inZone(s, app.hover.x, app.hover.y)) {
      const q = Sim.boxAt(s, s.stock.next, app.hover.x, app.hover.y)
      lines.push(`LIVRAISON ICI ${Sim.deliveryTime(s, s.stock, q.cx, q.cy).toFixed(2)} S`)
    }
    rect(124, 26, 220, lines.length * 9 + 4, 'rgba(0,0,0,0.7)')
    lines.forEach((l, i) => F.drawText(ctx, l, 128, 28 + i * 9, '#40ff60'))
  }

  /* ---------- fit the logical 640 × 360 frame; portrait phones get it rotated ---------- */
  function fit() {
    const sw = window.innerWidth
    const sh = window.innerHeight
    app.rotated = sh > sw && sw < 760
    const availW = app.rotated ? sh : sw
    const availH = app.rotated ? sw : sh
    let scale = Math.min(availW / W, availH / H)
    // Desktop: whole pixels when there is room; phones fill the screen.
    if (!matchMedia('(pointer: coarse)').matches && scale >= 2) scale = Math.floor(scale)
    canvas.style.width = Math.floor(W * scale) + 'px'
    canvas.style.height = Math.floor(H * scale) + 'px'
    canvas.style.transform = app.rotated ? 'rotate(90deg)' : ''
  }
  addEventListener('resize', fit)
  if (screen.orientation) screen.orientation.addEventListener('change', fit)
  fit()

  // Debug hook for tests and the console.
  if (app.debug || params.has('test')) window.barricasse = { app, Sim, startGame, order, setPaused }

  requestAnimationFrame(frame)
})()
