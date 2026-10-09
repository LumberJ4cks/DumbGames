/*
 * BARRICASSE — « Tout fait barricade. Même le poisson. »
 *
 * A defensive, upside-down brick-breaker in landscape. A police line on the left of the
 * street sends big arcade balls towards the demonstrators on the right, and in between the player
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
  const K = SP.C
  // Arcade ball: a shaded orange sphere with an ivory glint, ringed in ink.
  const ballArt = SP.art(11, 11, (p) => {
    p.ell(5.5, 5.5, 5, 5, [K.rust, K.orange, K.amber, K.yellow, K.white])
    p.px(3, 3, K.white)
  })
  const trailArt = SP.art(5, 5, (p) => p.disc(2.5, 2.5, 2.2, 2.2, K.amber), false)
  const shadowArt = SP.art(32, 12, (p) => p.disc(16, 6, 15.5, 5.5, K.ink), false)
  const glowArt = SP.art(40, 24, (p) => {
    p.disc(20, 12, 19.5, 11.5, K.amber)
    p.disc(20, 12, 13, 7.5, K.yellow)
  }, false)
  /** Solid ink silhouette of a sprite, for cast shadows and impact flashes. */
  const silCache = new Map()
  function silhouette(img, colour) {
    const key = colour
    let m = silCache.get(img)
    if (!m) silCache.set(img, (m = {}))
    if (m[key]) return m[key]
    const c = SP.makeCanvas(img.width, img.height)
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = colour
    g.fillRect(0, 0, c.width, c.height)
    return (m[key] = c)
  }
  /** Late-afternoon light: a warm wash from the top left and a dithered vignette, prerendered. */
  const warmLayer = (() => {
    const c = SP.makeCanvas(W, H)
    const g = c.getContext('2d')
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
    const warm = ['#fff1dc', '#ffe6c8', '#f6d8c8', '#e8cad0', '#d8c0d8']
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        const v = (x / W) * 0.6 + (y / H) * 0.4
        const f = v * (warm.length - 1)
        const i = Math.min(warm.length - 1, Math.floor(f + B[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] / 16))
        g.fillStyle = warm[i]
        g.fillRect(x, y, 2, 2)
      }
    return c
  })()
  const vignette = (() => {
    const c = SP.makeCanvas(W, H)
    const g = c.getContext('2d')
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
    g.fillStyle = K.ink
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = (x - W / 2) / (W / 2)
        const dy = (y - H / 2) / (H / 2)
        const d = Math.max(0, Math.sqrt(dx * dx * 0.85 + dy * dy) - 0.88) * 1.6
        if (d > B[(y & 3) * 4 + (x & 3)] / 16 + 0.02) g.fillRect(x, y, 1, 1)
      }
    return c
  })()
  const TIER = [K.grey1, K.green, K.cyan, K.amber, K.red]
  const tierColour = (m) => TIER[Math.max(0, Math.min(TIER.length - 1, m - 1))]
  // Material of each object, for the shards it throws when hit.
  const MATERIAL = {
    wood: ['palette', 'armoire', 'piano', 'cheval', 'tableau', 'planche'],
    metal: ['voiture', 'frigo', 'distributeur', 'caddie', 'reverbere', 'barbecue', 'photocopieuse', 'trophee', 'glaciere'],
    fabric: ['canape', 'parasol'],
    ceramic: ['toilettes', 'baignoire', 'carton', 'nain'],
    food: ['gateau', 'fromage', 'merguez', 'poisson'],
    plastic: ['chaise', 'ballon', 'plante'],
  }
  const materialOf = (item) => Object.keys(MATERIAL).find((k) => MATERIAL[k].includes(item)) || 'plastic'
  const iconCache = {}
  const iconOf = (item) => iconCache[item] || (iconCache[item] = SP.icon(S.items[item], 28))
  const UI = { bar: K.slateD, barLine: K.slate, ink: K.ink, text: K.white, dim: K.grey2, accent: K.amber, good: K.green, bad: K.red, panel: K.slateD }

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
    transAt: -9,
    snapshot: null,
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
      shownScore: 0,
      comboPulse: -9,
      tierShow: null,
      comboLost: null,
      flinch: {},
      cheerUntil: -9,
      dog: { x: 600, y: 306, tx: 570, wait: 0 },
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
    app.transAt = app.real
    audio.init()
    audio.play('start')
    audio.setLayers(0)
    audio.setTruce(false)
    audio.startMusic()
  }
  function endGame() {
    // A souvenir photo of the street at the final whistle, for the results screen.
    app.snapshot = SP.makeCanvas(W, H)
    app.snapshot.getContext('2d').drawImage(canvas, 0, 0)
    app.transAt = app.real
    app.result = Sim.summary(app.sim)
    fx.shownScore = app.result.score
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
      b.push({ x: 190, y: 250, w: 260, h: 32, label: 'TENIR 90 SECONDES', big: true, act: () => startGame() })
      b.push({ x: 190, y: 288, w: 126, h: 18, label: app.muted ? 'SON : NON' : 'SON : OUI', act: toggleMute })
      b.push({ x: 324, y: 288, w: 126, h: 18, label: app.reduced ? 'ANIM. : -' : 'ANIM. : +', act: toggleReduced })
    }
    if (app.mode === 'PAUSED') {
      b.push({ x: 220, y: 156, w: 200, h: 34, label: 'REPRENDRE', big: true, act: () => setPaused(false) })
      b.push({ x: 220, y: 198, w: 200, h: 24, label: app.reduced ? 'ANIMATIONS RÉDUITES' : 'ANIMATIONS NORMALES', act: toggleReduced })
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
      b.push({ x: 130, y: 262, w: 182, h: 30, label: 'REJOUER (R)', big: true, act: () => startGame() })
      b.push({ x: 328, y: 262, w: 182, h: 30, label: 'MÊME PARTIE', big: true, act: () => startGame(app.result.seed) })
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
      popup('ÇA CHARGE', s.stock.x, s.stock.side === 'main' ? C.STREET_B - 12 : C.STREET_T + 18, K.yellow, 0.6, 1)
      audio.play('refuse')
    }
  }

  /* ---------- art placement helpers: sprite drawn so its opaque bounds fill the box ---------- */
  function artOrigin(item, box) {
    const b = Sim.BOUNDS[item]
    return { x: box.x - b[0], y: box.y - b[1], k: 1 }
  }
  /** A named point of the drawing (sprites.js ANCHORS), in screen pixels. Drawing coordinates sit 1 px in (outline border). */
  function anchor(item, name, box) {
    const o = artOrigin(item, box)
    const [ax, ay] = S.anchors[item][name]
    return { x: o.x + ax + 1, y: o.y + ay + 1 }
  }
  function drawArt(sprite, item, box, dx = 0, dy = 0) {
    const o = artOrigin(item, box)
    ctx.drawImage(sprite, Math.round(o.x + dx), Math.round(o.y + dy))
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
          if (e.near || Math.random() < 0.06) popup('LIVRÉ', q.cx, q.y - 12, K.green, 0.8, 1)
          landingGag(e.obj, t)
          break
        }
        case 'toolate':
          audio.play('toolate')
          popup('TROP TARD', e.x, e.y - 20, K.red, 0.9, 1)
          debris(e.item, e.x, e.y, 8)
          break
        case 'hit': {
          audio.play('hit', e.item)
          const v = fx.visual[e.obj.id] || (fx.visual[e.obj.id] = { landAt: -9 })
          v.hitAt = t
          debris(e.item, e.x, e.y, app.reduced ? 2 : 4)
          shards(e.item, e.x, e.y, app.reduced ? 3 : 7)
          impactStar(e.x, e.y)
          shake(1, 0.05)
          break
        }
        case 'score':
          if (e.reason === 'evac') {
            popup(`+${e.amount}`, Math.max(34, e.x + 18), e.y - 6, tierColour(e.mult), 0.9, e.mult >= 3 ? 2 : 1)
            audio.play('score', e.mult)
            fx.comboPulse = t
          } else if (e.reason === 'just') popup(`+${e.amount} JUSTE À TEMPS`, e.x, e.y - 22, K.yellow, 1.0, 1)
          break
        case 'combo-tier':
          fx.tierShow = { mult: e.mult, at: t }
          fx.cheerUntil = t + 0.9
          audio.play('tier', e.mult)
          break
        case 'combo-end':
          if (e.combo >= 3) {
            fx.comboLost = { combo: e.combo, at: t }
            audio.play('comboEnd')
          }
          break
        case 'destroy': {
          audio.play('destroy', e.item)
          const q = e.obj.box
          debris(e.item, q.cx, q.cy, app.reduced ? 5 : 10)
          shards(e.item, e.x, e.y, app.reduced ? 5 : 14)
          impactStar(e.x, e.y)
          // One white frame of the object as it breaks.
          fx.remnants.push({ frame: silhouette(spriteFor(e.item, 'placed'), K.white), item: e.item, box: q, born: t, life: 0.07 })
          breakGag(e.obj, t)
          delete fx.visual[e.obj.id]
          shake(e.item === 'palette' ? 3 : 1.5, 0.08)
          break
        }
        case 'kicked': {
          audio.play('kicked')
          const sp = Math.hypot(e.vx, e.vy) || 1
          particle({ x: e.obj.box.cx, y: e.obj.box.cy, vx: (e.vx / sp) * 160, vy: (e.vy / sp) * 160 + rnd(-30, 30), z: 6, vz: 120, sprite: S.items.ballon, scale: 1, life: 1.2, vr: -14, drag: 0.6, bounce: true })
          popup('INUTILE', e.obj.box.cx, e.obj.box.y - 10, K.pink, 0.9, 1)
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
            particle({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: rnd(0, 6), vz: rnd(10, 50), color: pick([look.shirt, look.skin, K.white, K.grey1]), size: 2, life: rnd(0.4, 0.8), drag: 2 })
          }
          for (let k = 0; k < 4; k++) particle({ x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 4), vx: rnd(-8, 8), vy: rnd(-14, -4), sprite: S.props.fumee, g: 0, scale: 1, life: 0.6 })
          fx.flashes.push({ kind: 'danger', x: e.x, y: e.y, born: t, life: 0.5 })
          fx.lostBlink = t
          shake(2, 0.12)
          break
        }
        case 'passed':
          particle({ x: C.CROWD_ABSORB_X, y: e.y, vx: 6, vy: 0, g: 0, sprite: S.props.fumee, scale: 1, life: 0.4 })
          audio.play('top')
          break
        case 'evacuated':
          fx.evacBlink = t
          for (let k = 0; k < 4; k++) particle({ x: C.EXIT_X, y: e.y + rnd(-4, 4), vx: rnd(-10, 0), vy: rnd(-10, 10), g: 0, sprite: S.props.fumee, scale: 1, life: 0.35 })
          audio.play('evacuated')
          break
        case 'announce':
          audio.play('announce')
          break
        case 'fire':
          audio.play('fire')
          for (let k = 0; k < 3; k++) particle({ x: C.SPAWN_X + 4, y: e.ball.y + rnd(-3, 3), vx: rnd(-4, 6), vy: rnd(-12, 12), g: 0, sprite: S.props.fumee, scale: 1, life: 0.3 })
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
        fx.transient = { text: 'BON, ON REPREND', sub: '', until: t + 1.6, color: K.amber }
      }
    }
    if (e.id === 'fournisseur') {
      if (e.phase === 'active' || e.phase === 'done') {
        poof(C.STOCK_MAIN.x, C.STOCK_MAIN.y)
        poof(C.STOCK_ALT.x, C.STOCK_ALT.y)
      }
      if (e.phase === 'warn') fx.transient = { text: 'RETOUR EN BAS', sub: 'DANS 1 S', until: t + 1.0, color: K.amber }
      if (e.phase === 'done') fx.transient = { text: 'LE STOCK EST REVENU', sub: 'EN BAS', until: t + 1.2, color: K.green }
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
    p.scale = p.scale ?? 1
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
      particle({ x: x + dir * rnd(width * 0.2, width * 0.5), y: y + rnd(-2, 1), vx: dir * rnd(20, 45), vy: rnd(-6, 6), vz: rnd(4, 14), g: 40, color: pick([K.grey1, K.grey2, K.cream]), size: 2, life: rnd(0.25, 0.45), drag: 4 })
    }
  }
  function spark(x, y) {
    for (let k = 0; k < 3; k++) particle({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), g: 0, color: K.yellow, size: 1, life: 0.15 })
  }
  function poof(x, y) {
    for (let k = 0; k < 8; k++) particle({ x: x + rnd(-16, 16), y: y + rnd(-14, 14), vx: rnd(-20, 20), vy: rnd(-20, 5), g: 0, sprite: S.props.fumee, scale: 2, life: rnd(0.3, 0.6) })
  }
  function debris(item, x, y, n) {
    const cols = S.palette[item] || ['#888']
    for (let k = 0; k < n; k++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(30, 90)
      particle({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, z: rnd(4, 14), vz: rnd(40, 110), color: pick(cols), size: pick([2, 2, 3, 4]), life: rnd(0.5, 0.9), drag: 1.5, bounce: true })
    }
  }
  /** Pieces that depend on what the object is made of. */
  function shards(item, x, y, n) {
    const m = materialOf(item)
    for (let k = 0; k < n; k++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(40, 120)
      const base = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, z: rnd(4, 12), vz: rnd(40, 120), life: rnd(0.4, 0.9), drag: 1.5, bounce: true }
      if (m === 'wood') particle(Object.assign(base, { color: pick([K.brownL, K.sand, K.brown]), size: 2, w: 4, h: 1 }))
      else if (m === 'metal') particle(Object.assign(base, { color: pick([K.yellow, K.white, K.amber]), size: 1, life: rnd(0.15, 0.35), g: 60, vx: base.vx * 1.6, vy: base.vy * 1.6 }))
      else if (m === 'fabric') particle(Object.assign(base, { color: pick([K.white, K.skinL, K.pink]), size: 2, g: 18, drag: 3, vz: rnd(20, 50), life: rnd(1, 1.6) }))
      else if (m === 'ceramic') particle(Object.assign(base, { color: pick([K.white, K.grey1, K.cyan]), size: pick([1, 2]) }))
      else if (m === 'food') particle(Object.assign(base, { color: pick(S.palette[item] || [K.amber]), size: 2 }))
      else particle(Object.assign(base, { color: pick(S.palette[item] || [K.grey1]), size: 1 }))
    }
  }
  function impactStar(x, y) {
    particle({ x, y, vx: 0, vy: 0, g: 0, sprite: S.props.etincelle, scale: 2, life: 0.12 })
    fx.flashes.push({ kind: 'ring', x, y, born: app.sim.t, life: 0.18 })
  }
  function prop(name, x, y, opts = {}) {
    particle(Object.assign({ x, y, vx: rnd(-50, 50), vy: rnd(-40, 20), z: 10, vz: rnd(80, 140), sprite: S.props[name], scale: 1, life: 1.3, vr: rnd(-8, 8), drag: 1, bounce: true }, opts))
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
    if (o.item === 'carton') for (let k = 0; k < 4; k++) particle({ x: q.cx + rnd(-10, 10), y: q.cy, vx: rnd(-30, 30), vy: rnd(-10, 10), z: 8, vz: rnd(30, 60), color: K.cyan, size: 1, life: 0.5 })
  }
  /** The comic part of a destruction. */
  function breakGag(o, t) {
    const q = o.box
    const x = q.cx
    const y = q.cy
    switch (o.item) {
      case 'chaise':
        remnant(S.frames.chaise.folded, o, 0.9)
        break
      case 'palette':
        for (let n = 0; n < 3; n++) prop('planche_bois', x, y - 8 + n * 7, { vz: rnd(120, 180), vr: rnd(-12, 12), life: 1.4 })
        break
      case 'voiture':
        prop('roue', x, y)
        break
      case 'planche':
        prop('fer', x + 8, y - 10)
        break
      case 'frigo':
        remnant(S.frames.frigo.open, o, 0.7)
        prop('yaourt', x, y, { vz: 160 })
        break
      case 'canape':
        prop('telecommande', x, y)
        for (const p of app.sim.people) if (SIGN_OF[p.index] === 'canape') fx.signDown[p.index] = t + 2.5
        break
      case 'reverbere':
        for (let n = 0; n < 5; n++) particle({ x: x + 8, y: y - 12, vx: rnd(-40, 40), vy: rnd(-30, 10), z: 10, vz: rnd(30, 80), color: K.yellow, size: 1, life: 0.4 })
        break
      case 'poisson':
        for (let n = 0; n < 4; n++) prop('goutte', x, y, { scale: 1, life: 0.6 })
        break
      case 'armoire':
        remnant(S.frames.armoire.open, o, 0.8)
        for (let n = 0; n < 3; n++) prop('cintre', x + (n - 1) * 10, y - 6)
        break
      case 'baignoire':
        prop('canard', x + 8, y - 8, { vz: 170, life: 1.5 })
        for (let n = 0; n < 5; n++) prop('goutte', x, y - 4, { scale: 1, life: 0.6 })
        break
      case 'photocopieuse':
        prop('feuille_non', x, y - 6, { vz: 60, g: 50, vr: rnd(-2, 2), life: 1.6, drag: 1.5 })
        break
      case 'nain':
        remnant(S.props.bonnet, o, 1.2, { at: anchor('nain', 'hat', q), scale: 1 })
        break
      case 'caddie':
        remnant(S.frames.caddie.nowheel, o, 0.3)
        remnant(null, o, 1.6, { wheel: anchor('caddie', 'wheel', q) })
        break
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
        for (let n = 0; n < 6; n++) particle({ x, y, vx: rnd(-50, 50), vy: rnd(-40, 20), z: 8, vz: rnd(40, 90), color: K.cyan, size: 1, life: 0.6 })
        break
      case 'trophee':
        for (let n = 0; n < 6; n++) particle({ x, y: y - 6, vx: rnd(-30, 30), vy: rnd(-30, 10), z: 10, vz: rnd(30, 60), color: K.yellow, size: 1, life: 0.6 })
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

  /** Purely visual life: demonstrators flinch when a ball whistles past, the dog wanders. */
  function updateLife(s, dt) {
    const front = C.CROWD_LINES[C.CROWD_LINES.length - 1]
    for (const b of s.balls) {
      if (!b.alive || b.x < front - 70) continue
      for (const p of s.people) if (p.alive && Math.abs(p.x - b.x) < 30 && Math.abs(p.y - b.y) < 26) fx.flinch[p.id] = s.t + 0.45
    }
    const d = fx.dog
    if (d.wait > 0) d.wait -= dt
    else {
      const step = 22 * dt
      if (Math.abs(d.tx - d.x) <= step) {
        d.wait = rnd(0.6, 2.2)
        d.tx = rnd(470, 628)
      } else d.x += Math.sign(d.tx - d.x) * step
    }
    // The score counter rolls up to the real score.
    fx.shownScore += Math.ceil((s.score - fx.shownScore) * Math.min(1, dt * 10))
    if (Math.abs(s.score - fx.shownScore) < 3) fx.shownScore = s.score
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
      updateLife(s, s.t - before)
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
      ambience()
      ctx.restore()
      drawMenu()
      drawButtons()
      drawTransition()
      return
    }
    const s = app.sim
    drawHover(s)
    drawShadows(s)
    drawRemnants(s)
    drawReserved(s)
    drawObjects(s)
    drawStreetLife(s)
    drawCrowd(s)
    drawPolice(s)
    drawParticles(false)
    drawFlights(s)
    drawParticles(true)
    drawBalls(s)
    drawFlashes(s)
    ambience()
    drawPopups(s)
    drawStock(s)
    ctx.restore()
    drawHud(s)
    drawCombo(s)
    drawBanner(s)
    drawTierFlash(s)
    if (app.debug) drawDebug(s)
    if (app.mode === 'PAUSED') drawPause()
    if (app.mode === 'RESULTS') drawResults()
    drawButtons()
    drawTransition()
  }

  function ambience() {
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(warmLayer, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 0.4
    ctx.drawImage(vignette, 0, 0)
    ctx.globalAlpha = 1
  }
  /** Long late-afternoon shadows: each object's silhouette laid down towards the bottom right. */
  function castShadow(img, x, y, foot) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.translate(0, foot)
    ctx.transform(1, 0, -0.6, -0.32, 0, 0)
    ctx.drawImage(silhouette(img, K.ink), Math.round(x), Math.round(y - foot))
    ctx.restore()
  }
  function drawShadows(s) {
    for (const o of s.objects) {
      if (!o.alive) continue
      const sp = spriteFor(o.item, 'placed')
      const or = artOrigin(o.item, o.box)
      castShadow(sp, or.x, or.y, o.box.y + o.box.h)
    }
    ctx.globalAlpha = 0.3
    for (const p of s.people) if (p.alive) ctx.drawImage(shadowArt, Math.round(p.x) - 5, Math.round(p.y) + 7, 16, 4)
    ctx.globalAlpha = 1
  }
  /** The dog that came along, and a pram parked by the crowd. */
  function drawStreetLife(s) {
    const t = vt()
    ctx.drawImage(S.pram, 612, 62)
    const d = fx.dog
    const moving = d.wait <= 0
    const img = S.dog[moving ? Math.floor(t * 8) % 2 : Math.floor(t * 3) % 2]
    ctx.save()
    if (d.tx > d.x && moving) {
      ctx.translate(Math.round(d.x) + 8, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(img, -8, Math.round(d.y) - 10)
    } else ctx.drawImage(img, Math.round(d.x) - 8, Math.round(d.y) - 10)
    ctx.restore()
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
    corners(q.x - 2, q.y - 2, q.w + 4, q.h + 4, ready ? K.white : K.grey3)
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
    if (item === 'reverbere') {
      const lp = anchor(item, 'light', q)
      ctx.globalAlpha = 0.14 + 0.03 * Math.sin(t * 9)
      ctx.drawImage(glowArt, Math.round(lp.x - 20), Math.round(lp.y + 26))
      ctx.globalAlpha = 1
    }
    const sp = spriteFor(item, 'placed')
    const age = t - v.landAt
    const hitAge = t - (v.hitAt ?? -9)
    const jolt = hitAge < 0.15 && !app.reduced ? (Math.floor(hitAge * 60) % 2 ? 1 : -1) : 0
    const landing = age < 0.16
    const struck = hitAge < 0.12
    if ((landing || struck) && !app.reduced) {
      // Squash on landing, wobble on impact, anchored on the object's foot.
      const n = landing ? 1 - age / 0.16 : 1 - hitAge / 0.12
      const sx = landing ? 1 + 0.2 * n : 1 + 0.08 * n
      const sy = landing ? 1 - 0.26 * n : 1 - 0.1 * n
      const o0 = artOrigin(item, q)
      ctx.save()
      ctx.translate(q.cx, q.y + q.h)
      ctx.scale(sx, sy)
      ctx.drawImage(sp, o0.x - q.cx, o0.y - (q.y + q.h))
      ctx.restore()
    } else if (item === 'cheval' && !app.reduced) {
      const o0 = artOrigin(item, q)
      ctx.save()
      ctx.translate(q.cx, q.y + q.h)
      ctx.rotate(Math.sin(t * 2.6 + o.id) * 0.06)
      ctx.drawImage(sp, o0.x - q.cx, o0.y - (q.y + q.h))
      ctx.restore()
    } else drawArt(sp, item, q, jolt, 0)
    if (o.maxHp > 1 && o.hp < o.maxHp) drawCracks(o, jolt)
    if (hitAge < 0.06) drawArt(silhouette(sp, K.white), item, q, jolt, 0)
    if (item === 'planche' && v.ironAt !== undefined && t >= v.ironAt - 0.25) {
      const n = Math.min(1, (t - v.ironAt + 0.25) / 0.25)
      const pt = anchor(item, 'iron', q)
      ctx.drawImage(S.props.fer, Math.round(pt.x), Math.round(pt.y - (1 - n) * 40))
    }
    if (item === 'trophee' && (t * 0.8 + o.id * 0.37) % 1 < 0.12) {
      const sx2 = q.x + 4 + ((o.id * 7) % Math.max(1, q.w - 8))
      ctx.drawImage(S.props.etincelle, sx2 - 2, q.y + 4)
    }
    if (item === 'barbecue' && !app.reduced && (t * 3 + o.id) % 1 < 0.04) particle({ x: q.cx + rnd(-8, 8), y: q.y + 4, vx: rnd(-3, 3), vy: -12, g: 0, sprite: S.props.fumee, scale: 1, life: 0.8 })
    if (item === 'carton' && age < 0.5) F.drawTextOC(ctx, 'CLING', q.cx, q.y - 10, K.cyan)
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
        rect(x, y, 2, 2, K.ink)
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
        const cx = Math.round(r.wheel.x)
        const cy = Math.round(r.wheel.y)
        rect(cx - 3, cy - 3, 7, 7, K.ink)
        rect(cx - 2, cy - 2, 5, 5, K.slateD)
        const a = age * 14
        rect(Math.round(cx + Math.cos(a) * 2), Math.round(cy + Math.sin(a) * 2), 1, 1, K.grey1)
        rect(Math.round(cx - Math.cos(a) * 2), Math.round(cy - Math.sin(a) * 2), 1, 1, K.grey1)
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
          rect(x0 + a, y0, bw - a, 1, K.yellow)
          rect(x0 + w - bw, y0 + h - 1, bw - a, 1, K.yellow)
        }
        const bh = Math.min(h, k + off + 4)
        if (bh > a) {
          rect(x0, y0 + h - bh, 1, bh - a, K.yellow)
          rect(x0 + w - 1, y0 + a, 1, bh - a, K.yellow)
        }
      }
      const bw = Math.max(10, Math.min(36, q.w - 4))
      rect(Math.round(q.cx - bw / 2), q.y + q.h + 2, bw, 2, K.ink)
      rect(Math.round(q.cx - bw / 2), q.y + q.h + 2, Math.round(bw * p), 2, K.yellow)
    }
  }
  function drawFlights(s) {
    const t = s.t
    for (const d of s.deliveries) {
      const p = Math.min(1, Math.max(0, (t - d.sentAt) / d.duration))
      const gx = d.from.x + (d.to.x - d.from.x) * p
      const gy = d.from.y + (d.to.y - d.from.y) * p
      const hgt = Math.sin(Math.PI * p) * d.arc
      const sw = Math.max(10, d.box.w * 0.7) * (1 - (hgt / C.ARC_MAX) * 0.35)
      ctx.globalAlpha = 0.35
      ctx.drawImage(shadowArt, Math.round(gx - sw / 2), Math.round(gy + d.box.h / 2 - 5), Math.round(sw), 7)
      ctx.globalAlpha = 1
      let rot = Math.sin(p * Math.PI * 2) * 0.22
      let state = 'flying'
      if (d.item === 'fromage') rot = p * Math.PI * 4
      if (d.item === 'voiture') rot = p * Math.PI * 2
      if (d.item === 'planche') state = p < 0.6 ? 'folded' : 'open'
      if (d.item === 'parasol') state = 'folded'
      if (app.reduced) rot *= 0.3
      const img = spriteFor(d.item, state)
      ctx.save()
      ctx.globalAlpha = 0.78
      ctx.translate(Math.round(gx), Math.round(gy - hgt))
      ctx.rotate(rot)
      ctx.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2))
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
        ctx.drawImage(trailArt, Math.round(tr[k][0]) - 2, Math.round(tr[k][1]) - 2)
      }
      ctx.globalAlpha = 1
      ctx.drawImage(ballArt, Math.round(b.x) - 6, Math.round(b.y) - 6)
      if (Math.floor(b.born * 10 + vt() * 12) % 6 === 0) rect(Math.round(b.x) - 2, Math.round(b.y) - 3, 1, 1, K.white)
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
      } else rect(Math.round(p.x), Math.round(p.y - p.z), p.w || p.size, p.h || p.size, p.color)
    }
    ctx.globalAlpha = 1
  }
  function drawFlashes(s) {
    const t = s.t
    fx.flashes = fx.flashes.filter((f) => t - f.born < f.life)
    for (const f of fx.flashes) {
      const age = t - f.born
      if (f.kind === 'ring') {
        const r = Math.round(3 + age * 50)
        ctx.strokeStyle = K.white
        ctx.lineWidth = 1
        ctx.globalAlpha = 1 - age / f.life
        ctx.strokeRect(Math.round(f.x) - r + 0.5, Math.round(f.y) - r + 0.5, r * 2, r * 2)
        ctx.globalAlpha = 1
      }
      // Brief local blink where someone was lost.
      if (f.kind === 'danger' && Math.floor(age * 16) % 2 === 0) {
        ctx.strokeStyle = K.red
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
      F.drawTextLOC(ctx, p.text, Math.round(p.x), Math.round(p.y - age * 18), p.color, p.scale)
    }
  }

  /* ---------- crowd: three lines on the right, facing the police ---------- */
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
    const flinch = fx.flinch[p.id] > t
    const cheer = !flinch && fx.cheerUntil > t && (p.index * 5) % 3 !== 0
    let pose
    if (flinch) pose = 'flinch'
    else if (cheer) pose = 'cheer'
    else if (p.moving) pose = 'walk' + (Math.floor(t * 8 + p.index) % 4)
    else pose = app.reduced ? 'idle0' : 'idle' + (Math.floor(t * 1.6 + p.index * 0.37) % 2)
    const holdSign = raised && !flinch && !cheer
    const set = holdSign ? S.people[p.index].raised : S.people[p.index].pose
    const x = Math.round(p.x)
    const jump = cheer && !app.reduced ? Math.round(Math.abs(Math.sin((t + p.index * 0.13) * 14)) * 3) : 0
    const y = Math.round(p.y) - jump
    ctx.drawImage(set[pose], x - 8, y - 12)
    if (sign) {
      const bob = pose === 'idle1' || pose === 'walk1' || pose === 'walk3' ? 1 : 0
      if (raised && !flinch) {
        rect(x - 4, y - 11 + bob, 1, 4, K.brown)
        ctx.drawImage(S.signs[sign], x - 17, y - 25 + bob)
      } else {
        // Sign lowered after the sofa went.
        ctx.save()
        ctx.translate(x - 6, y + 2)
        ctx.rotate(-1.1)
        ctx.drawImage(S.signs[sign], -13, -7)
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
    const x = C.CROWD_LINES[1] - 16
    rect(x - 1, y0, 9, y1 - y0, K.ink)
    rect(x, y0 + 1, 7, y1 - y0 - 2, K.cream)
    rect(x + 6, y0 + 1, 1, y1 - y0 - 2, K.sand)
    rect(x - 2, y0 - 3, 11, 2, K.brown)
    rect(x - 2, y1 + 1, 11, 2, K.brown)
    const text = 'ON RESTE GROUPÉS'
    const step = Math.max(8, Math.floor((y1 - y0 - 6) / text.length))
    const start = Math.round((y0 + y1) / 2 - (text.length * step) / 2)
    for (let i = 0; i < text.length; i++) F.drawText(ctx, text[i], x + 2, start + i * step, K.red)
  }

  /* ---------- police, on the left, facing right ---------- */
  function drawPolice(s) {
    const t = vt()
    const truce = s.activeEvent === 'treve'
    const f = app.reduced ? 0 : Math.floor(t * 2) % 2
    const frameFor = (k) => S.crs[truce ? 2 + ((f + k) % 2) : f]
    for (let k = 0; k < 7; k++) ctx.drawImage(frameFor(k + 1), 38 - 11, 92 + k * 32 - 13)
    for (let k = 0; k < 8; k++) ctx.drawImage(frameFor(k), 64 - 11 - (truce ? 0 : f), 76 + k * 32 - 13)
    s.launchers.forEach((L, li) => {
      if (!L.active) return
      const y = Math.round(L.y)
      const a = s.announces.find((q) => q.launcher === li)
      if (a) L.lastAngle = a.angle
      const ang = a ? a.angle : L.lastAngle ?? 0
      const reloading = !truce && s.t - L.firedAt < 0.45
      ctx.globalAlpha = 0.3
      ctx.drawImage(shadowArt, C.LAUNCHER_X - 22, y + 8, 40, 5)
      ctx.globalAlpha = 1
      ctx.drawImage(reloading ? S.crsReload[Math.floor(t * 10) % 2] : S.crs[truce ? 2 + f : L.walking ? f : 0], C.LAUNCHER_X - 30, y - 15)
      // The cannon tilts towards where the next ball goes.
      const recoil = s.t - L.firedAt < 0.12 ? -2 : 0
      ctx.save()
      ctx.translate(C.LAUNCHER_X + 2 + recoil, y)
      ctx.rotate(((app.reduced ? 0 : ang) * Math.PI) / 180 / 2)
      ctx.drawImage(S.launcher, -14, -14)
      ctx.restore()
      if (a) drawAnnounce(a, s.t)
    })
  }
  function drawAnnounce(a, t) {
    const k = Math.min(1, Math.max(0, (t - a.announcedAt) / (a.fireAt - a.announcedAt)))
    const rad = (a.angle * Math.PI) / 180
    const dx = Math.cos(rad)
    const dy = Math.sin(rad)
    const len = 60
    const x0 = C.SPAWN_X + 6
    const y0 = a.y
    for (let d = 0; d < len; d += 6) {
      const x = Math.round(x0 + dx * d)
      const y = Math.round(y0 + dy * d)
      rect(x - 2, y - 2, 4, 4, K.ink)
      rect(x - 1, y - 1, 2, 2, d / len <= k ? K.red : K.yellow)
    }
    const hx = x0 + dx * len
    const hy = y0 + dy * len
    for (let w = 0; w < 6; w++) {
      const bx = hx - dx * w * 1.5
      const by = hy - dy * w * 1.5
      for (const sgn of [1, -1]) {
        const px = Math.round(bx - dy * w * sgn)
        const py = Math.round(by + dx * w * sgn)
        rect(px - 1, py - 1, 3, 3, K.ink)
        rect(px, py, 1, 1, K.yellow)
      }
    }
  }

  /* ---------- UI pieces ---------- */
  /** Bevelled panel: ink border, light top-left edge, dark bottom-right edge. */
  function panel(x, y, w, h, fill = K.slateD, light = K.slate, dark = K.ink) {
    rect(x, y, w, h, K.ink)
    rect(x + 1, y + 1, w - 2, h - 2, fill)
    rect(x + 1, y + 1, w - 2, 1, light)
    rect(x + 1, y + 1, 1, h - 2, light)
    rect(x + 1, y + h - 2, w - 2, 1, dark)
    rect(x + w - 2, y + 1, 1, h - 2, dark)
  }
  /** The title, in big pixel letters with a warm vertical ramp and a heavy drop. */
  function drawLogo(cx, y, scale) {
    const text = 'BARRICASSE'
    const x = Math.round(cx - F.textWidthL(text, scale) / 2)
    const ramp = [K.yellow, K.yellow, K.amber, K.amber, K.orange, K.orange, K.rust]
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) F.drawTextL(ctx, text, x + dx * 2, y + dy * 2, K.ink, scale)
    for (let k = 3; k <= 5; k++) F.drawTextL(ctx, text, x + k, y + k, k === 5 ? K.ink : K.redD, scale)
    F.drawTextL(ctx, text, x, y, (r) => ramp[r], scale)
    F.drawTextL(ctx, text, x, y - 1, (r) => (r === 0 ? K.white : ramp[r]), scale)
  }

  /* ---------- stock: an inventory slot on the sidewalk ---------- */
  function drawStock(s) {
    const t = s.t
    const cx = s.stock.x
    const cy = s.stock.y
    const x = cx - 19
    const y = cy - 18
    const k = Math.min(1, Math.max(0, (s.stock.readyAt - t) / C.RELOAD))
    const item = s.stock.next
    F.drawTextLO(ctx, 'STOCK', x - 38, cy - 6, K.white)
    panel(x, y, 38, 36, t - fx.readyFlash < 0.18 ? K.white : K.slateD, K.grey3, K.ink)
    rect(x + 3, y + 3, 32, 30, K.slateD)
    const ic = iconOf(item)
    ctx.drawImage(ic, Math.round(cx - ic.width / 2), Math.round(cy - ic.height / 2))
    if (k > 0) {
      const hh = Math.ceil(30 * k)
      ctx.globalAlpha = 0.7
      rect(x + 3, y + 3, 32, hh, K.ink)
      ctx.globalAlpha = 1
      rect(x + 3, y + 3 + hh - 1, 32, 1, K.amber)
    }
    // What is coming: its name, how sturdy it is, and the reload.
    const info = Sim.ITEMS[item]
    const tx = x + 44
    F.drawTextLO(ctx, info.name.toUpperCase(), tx, y - 2, K.white)
    if (info.hp === 0) F.drawTextLO(ctx, 'NE SERT À RIEN', tx, y + 10, K.pink)
    else for (let n = 0; n < 3; n++) ctx.drawImage(n < info.hp ? S.ui.heart : S.ui.heartOff, tx + n * 11, y + 12)
    // Reload: the delivery van drives along its road.
    rect(tx, y + 30, 70, 4, K.ink)
    rect(tx + 1, y + 31, 68, 2, K.slateD)
    rect(tx + 1, y + 31, Math.round(68 * (1 - k)), 2, k > 0 ? K.amber : K.green)
    ctx.drawImage(S.ui.truck, Math.round(tx + (1 - k) * 54), y + 20)
    if (app.firstRun && t < 9 && fx.sends < 4) F.drawTextLO(ctx, '← RECHARGE APRÈS CHAQUE ENVOI', tx + 72, y + 22, K.yellow)
  }

  /* ---------- HUD: survivors, time, score ---------- */
  function drawHud(s) {
    const t = s.t
    rect(0, 0, W, 24, UI.bar)
    rect(0, 0, W, 1, K.slate)
    rect(0, 23, W, 1, K.ink)
    const alive = Sim.survivors(s)
    const blink = t - fx.lostBlink < 0.6 && Math.floor((t - fx.lostBlink) * 10) % 2 === 0
    ctx.drawImage(S.ui.person, 7, 7)
    F.drawTextLO(ctx, `${alive}/${s.people.length}`, 20, -1, blink ? K.red : K.white, 2)
    const remain = Math.max(0, Math.ceil(C.RUN_DURATION - t - 1e-9))
    const urgent = remain <= 10 && Math.floor(t * 4) % 2 === 0
    ctx.drawImage(S.ui.clock, 128, 7)
    F.drawTextLO(ctx, String(remain).padStart(2, '0'), 142, -1, urgent ? K.amber : K.white, 2)
    const pulse = t - fx.comboPulse < 0.12
    ctx.drawImage(S.ui.star, 236, 7)
    F.drawTextLO(ctx, String(fx.shownScore).padStart(6, '0'), 250, -1, pulse ? K.white : K.yellow, 2)
    const best = app.record?.score
    if (best) F.drawText(ctx, `RECORD ${best}`, 336, 9, best < s.score ? K.green : UI.dim)
    F.drawText(ctx, `RENVOYÉES ${s.stats.evacuated}`, 430, 9, t - fx.evacBlink < 0.3 ? K.green : UI.dim)
  }
  /** Combo meter on the top-left sidewalk: multiplier, streak, and the time left to keep it. */
  function drawCombo(s) {
    const t = s.t
    if (s.combo > 0) {
      const m = s.mult
      const col = tierColour(m)
      const left = Math.max(0, (s.comboUntil - t) / C.COMBO_WINDOW)
      const pop = t - fx.comboPulse < 0.12 ? 1 : 0
      panel(6, 26, 150, 31, K.slateD, K.slate, K.ink)
      if (m >= 4) ctx.drawImage(S.ui.fire, 11, 33 - (Math.floor(t * 10) % 2))
      F.drawTextLO(ctx, `×${m}`, m >= 4 ? 22 : 12, 26 - pop, pop ? K.white : col, 2)
      F.drawTextL(ctx, `COMBO ${s.combo}`, 58, 27, K.white)
      const next = C.COMBO_TIERS[m]
      F.drawText(ctx, next !== undefined ? `×${m + 1} À ${next}` : m >= 5 ? 'EN FEU !' : '', 58, 37, m >= 5 && Math.floor(t * 6) % 2 ? K.red : K.grey2)
      rect(58, 48, 92, 5, K.ink)
      rect(59, 49, Math.round(90 * left), 3, left < 0.3 && Math.floor(t * 8) % 2 ? K.white : col)
    } else if (fx.comboLost && t - fx.comboLost.at < 1.2) {
      ctx.globalAlpha = Math.min(1, (1.2 - (t - fx.comboLost.at)) / 0.4)
      panel(6, 26, 150, 31, K.slateD, K.slate, K.ink)
      F.drawTextLO(ctx, 'COMBO PERDU', 14, 29, K.pink)
      F.drawText(ctx, `SÉRIE DE ${fx.comboLost.combo}`, 14, 42, K.grey2)
      ctx.globalAlpha = 1
    }
  }
  /** Big centre call-out when the multiplier climbs. */
  const TIER_NAMES = ['', 'ÇA CHAUFFE', 'BIEN LIVRÉ', 'LOGISTIQUE DE GÉNIE', 'EN FEU !']
  function drawTierFlash(s) {
    const f = fx.tierShow
    if (!f) return
    const e = s.t - f.at
    if (e > 1.1) return
    const scale = e < 0.12 && !app.reduced ? 5 : 4
    ctx.globalAlpha = Math.min(1, (1.1 - e) / 0.3)
    F.drawTextLOC(ctx, `COMBO ×${f.mult} !`, 320, 104 - (scale - 4) * 4, tierColour(f.mult), scale)
    F.drawTextLOC(ctx, TIER_NAMES[f.mult - 1] || '', 320, 152, K.white, 2)
    ctx.globalAlpha = 1
  }
  /** Screen changes: ink bands wipe away, staggered top to bottom. */
  function drawTransition() {
    const e = app.real - app.transAt
    if (e > 0.5 || app.reduced) return
    for (let i = 0; i < 18; i++) {
      const k = Math.max(0, Math.min(1, 1 - (e - i * 0.012) / 0.28))
      if (k > 0) rect(0, i * 20, Math.ceil(W * k), 20, i % 2 ? K.ink : K.slateD)
    }
  }
  function drawButtons() {
    for (const b of buttons()) {
      const hot = app.pointer.x >= b.x && app.pointer.x < b.x + b.w && app.pointer.y >= b.y && app.pointer.y < b.y + b.h
      if (b.icon) {
        panel(b.x, b.y, b.w, b.h, hot ? K.slate : K.slateD, K.grey3, K.ink)
        const cx = b.x + 12
        const cy = b.y + 11
        const c = K.cream
        if (b.icon === 'pause') {
          if (app.mode === 'PAUSED') for (let k = 0; k < 7; k++) rect(cx - 3 + k, cy - 6 + k * 0.85, 1, 12 - k * 1.7, c)
          else {
            rect(cx - 5, cy - 6, 3, 12, c)
            rect(cx + 2, cy - 6, 3, 12, c)
          }
        } else {
          rect(cx - 7, cy - 2, 3, 5, c)
          for (let k = 0; k < 4; k++) rect(cx - 4 + k, cy - 2 - k, 1, 5 + 2 * k, c)
          if (app.muted)
            for (let k = 0; k < 6; k++) {
              rect(cx + 2 + k, cy - 3 + k, 1, 1, K.red)
              rect(cx + 2 + k, cy + 2 - k, 1, 1, K.red)
            }
          else {
            rect(cx + 2, cy - 1, 1, 3, c)
            rect(cx + 5, cy - 4, 1, 9, c)
          }
        }
        continue
      }
      if (b.big) {
        const press = hot ? 1 : 0
        rect(b.x, b.y, b.w, b.h, K.ink)
        rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, K.redD)
        rect(b.x + 1, b.y + 1 + press, b.w - 2, b.h - 5, hot ? K.orange : K.red)
        rect(b.x + 1, b.y + 1 + press, b.w - 2, 1, hot ? K.amber : K.pink)
        F.drawTextLOC(ctx, b.label, b.x + b.w / 2, b.y + Math.round((b.h - 3 - 20) / 2) - 1 + press, K.white, 2, K.brownD)
      } else {
        panel(b.x, b.y, b.w, b.h, hot ? K.slate : K.slateD, K.grey3, K.ink)
        F.drawTextLC(ctx, b.label, b.x + b.w / 2, b.y + Math.round((b.h - 11) / 2) - 1, K.cream)
      }
    }
  }
  /** Event banner, on the sidewalk the stock is not using. */
  function drawBanner(s) {
    const t = s.t
    let text = null
    let sub = ''
    let color = K.amber
    if (t < C.FIRST_SHOT - C.ANNOUNCE) {
      text = 'CONSTRUIS !'
      sub = `PREMIERS TIRS DANS ${Math.ceil(C.FIRST_SHOT - C.ANNOUNCE - t)} S · CLIQUE OÙ TU VEUX DANS LA RUE`
      color = K.green
    }
    for (const ev of C.EVENTS) {
      const st = s.events[ev.id]
      if (st === 'announce') {
        text = EVENT_TEXT[ev.id][0]
        sub = 'ÇA ARRIVE…'
        color = Math.floor(t * 6) % 2 ? K.amber : K.white
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
      color = K.green
    }
    if (!text) return
    const top = s.stock.side === 'main'
    const y = top ? 25 : 318
    const w = Math.max(F.textWidthL(text, 2), F.textWidthL(sub)) + 24
    panel(Math.round(320 - w / 2), y, Math.round(w), sub ? 33 : 23, K.slateD, K.slate, K.ink)
    F.drawTextLOC(ctx, text, 320, y + 1, color, 2)
    if (sub) F.drawTextLC(ctx, sub, 320, y + 20, K.cream)
  }

  /* ---------- overlays ---------- */
  function veil() {
    ctx.globalAlpha = 0.82
    rect(0, 24, W, H - 24, K.ink)
    ctx.globalAlpha = 1
  }
  function drawPause() {
    veil()
    F.drawTextLOC(ctx, 'PAUSE', 320, 64, K.white, 5)
    F.drawTextLC(ctx, 'LE TEMPS EST SUSPENDU. LES CRS AUSSI.', 320, 126, K.grey1)
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
    veil()
    const e = app.real - app.resultsAt
    const oy = Math.round(Math.max(0, 1 - e / 0.35) * 30)
    F.drawTextLOC(ctx, resultTitle(r), 320, 28 + oy, K.amber, 2)
    if (r.reason === 'wiped') F.drawTextLC(ctx, `PLUS PERSONNE APRÈS ${r.time.toFixed(1).replace('.', ',')} S`, 320, 50 + oy, K.pink)
    // Left: the score, rolling up, and what made it.
    panel(24, 64 + oy, 280, 186, K.slateD, K.slate, K.ink)
    F.drawTextLC(ctx, 'SCORE', 164, 70 + oy, K.grey2)
    const rolled = Math.round((r.score || 0) * Math.min(1, e / 1.2))
    F.drawTextLOC(ctx, String(rolled).padStart(6, '0'), 164, 82 + oy, K.yellow, 4)
    const rows = [
      [S.ui.person, `${r.survivors}/${r.total} SURVIVANTS`, r.survivors ? K.white : K.red],
      [S.ui.fire, `MEILLEUR COMBO ${r.bestCombo || 0}`, K.amber],
      [S.ui.star, `BONUS SURVIE +${r.survivors * C.SCORE_SURVIVOR}`, K.green],
      [S.ui.clock, `TEMPS TENU ${Math.floor(r.time)} S`, K.white],
    ]
    rows.forEach(([ic, text, col], i) => {
      const y = 136 + i * 24 + oy
      ctx.drawImage(ic, 44, y + 2)
      F.drawTextL(ctx, text, 60, y, col)
    })
    if (app.newRecord) F.drawTextLOC(ctx, 'NOUVEAU RECORD !', 164, 232 + oy, Math.floor(app.real * 4) % 2 ? K.green : K.white)
    else if (app.record) F.drawTextC(ctx, `RECORD ${app.record.score ?? 0}`, 164, 236 + oy, K.grey2)
    // Right: a souvenir photo of the street at the whistle, and the details.
    panel(320, 64 + oy, 296, 186, K.slateD, K.slate, K.ink)
    const px = 340
    const py = 72 + oy
    rect(px - 4, py - 4, 264, 168, K.white)
    rect(px - 4, py + 150, 264, 14, K.cream)
    if (app.snapshot) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(app.snapshot, 0, 24, W, H - 24, px, py, 256, 150)
    }
    F.drawText(ctx, 'PHOTO SOUVENIR · MANIF DU JOUR', px + 2, py + 151, K.brownD)
    F.drawTextC(ctx, `${r.evacuated} RENVOYÉES · ${r.delivered} LIVRÉS${r.tooLate ? ` (+${r.tooLate} TROP TARD)` : ''} · PLUS UTILISÉ : ${r.mostUsed ? Sim.ITEMS[r.mostUsed].name.toUpperCase() : 'AUCUN'}`, 468, 238 + oy, K.grey1)
    F.drawTextC(ctx, `PARTIE ${String(r.seed).toUpperCase()}`, 320, 300, K.grey3)
  }

  /* ---------- menu ---------- */
  let menuScene = null
  function drawMenuScene() {
    if (!menuScene) {
      menuScene = Sim.create('menu', { NO_SHOTS: true })
      for (const [item, x, y] of [['armoire', 200, 110], ['canape', 300, 270], ['poisson', 430, 110], ['voiture', 440, 272], ['piano', 175, 262], ['ballon', 360, 190], ['reverbere', 495, 190]]) Sim.placeNow(menuScene, item, x, y)
    }
    const s = menuScene
    s.t = app.real
    drawObjects(s)
    drawCrowd(s)
    drawPolice(s)
  }
  function drawMenu() {
    const t = app.real
    ctx.globalAlpha = 0.86
    rect(118, 30, 404, 304, K.ink)
    ctx.globalAlpha = 1
    panel(118, 30, 404, 304, 'rgba(0,0,0,0)', K.slate, K.ink)
    const bounce = app.reduced ? 0 : Math.round(Math.sin(t * 3) * 2)
    drawLogo(320, 38 + bounce, 5)
    F.drawTextLC(ctx, '« TOUT FAIT BARRICADE. MÊME LE POISSON. »', 320, 104, K.white)
    F.drawTextLC(ctx, SLOGANS[Math.floor(t / 2.2) % SLOGANS.length], 320, 120, K.pink)
    const tuto = ['CLIQUE DANS LA RUE POUR LIVRER UNE BARRICADE.', 'ELLE DOIT ARRIVER AVANT LA BALLE.', 'SAUVE LE PLUS DE MANIFESTANTS POSSIBLE.']
    tuto.forEach((l, i) => F.drawTextLC(ctx, l, 320, 146 + i * 16, K.cream))
    F.drawTextC(ctx, 'RENVOIE LES BALLES À LA SUITE POUR LES COMBOS. UN CANAPÉ ENCAISSE, UN BALLON NON.', 320, 202, K.grey2)
    // A few pieces of the catalogue, as a teaser.
    const show = ['frigo', 'poisson', 'nain', 'baignoire', 'trophee', 'caddie']
    let x = 160
    for (const id of show) {
      const ic = SP.icon(S.items[id], 26)
      ctx.drawImage(ic, x, 214 + (26 - ic.height))
      x += 56
    }
    const rec = app.record
    if (rec) F.drawTextLC(ctx, `RECORD : ${rec.score ?? 0} PTS · ${rec.survivors}/${rec.total} SURVIVANTS`, 320, 312, K.white)
    F.drawTextLOC(ctx, 'ÉCHAP : PAUSE · M : SON', 320, 342, K.grey1)
  }

  /* ---------- debug ---------- */
  function drawDebug(s) {
    ctx.save()
    ctx.globalAlpha = 0.85
    frameRect(C.ZONE_L, C.STREET_T, C.ZONE_R - C.ZONE_L, C.STREET_B - C.STREET_T, 'rgba(255,255,255,0.3)')
    for (const o of s.objects) frameRect(o.box.x, o.box.y, o.box.w, o.box.h, '#40ff60')
    for (const d of s.deliveries) frameRect(d.box.x, d.box.y, d.box.w, d.box.h, K.yellow)
    for (const p of s.people) if (p.alive) frameRect(p.x - 7, Math.round(p.y - 9), 14, 18, '#40e0ff')
    ctx.strokeStyle = '#ff40ff'
    for (const b of s.balls) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, C.BALL_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
    }
    rect(0, C.STREET_T, W, 1, '#ff40ff')
    rect(0, C.STREET_B, W, 1, '#ff40ff')
    rect(C.CROWD_ABSORB_X, 24, 1, H - 24, '#ff40ff')
    rect(C.EXIT_X, 24, 1, H - 24, '#ff40ff')
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
