import { createAudio } from './audio.js'
import { drawText, drawTextC, LINE_H, textWidth } from './font.js'

/*
 * CTRL + RN — « Impossible de vider l'historique. »
 *
 * A one-minute clicker: hammer SUPPRIMER to empty the history, close the popups that keep
 * restoring it, lose anyway. Follows the game module contract of the games site:
 * `manifest`, `create(options)`, `validate(result, settings)`, `grade(result, settings)`.
 * Internal resolution 320 × 180, every pixel drawn in code.
 */

export const manifest = {
  slug: 'ctrl-rn',
  title: 'CTRL + RN',
  tagline: "Impossible de vider l'historique.",
  releasedAt: '2026-10-06',
  status: 'draft',
  orientation: 'landscape',
  size: { width: 320, height: 180 },
  controls: [
    { action: 'pointer', label: 'Souris ou doigt : viser et cliquer' },
    { action: 'confirm', key: 'Space', label: 'Espace ou Entrée : valider les écrans' },
  ],
  settings: {
    durationSeconds: 60,
    firstPopupAt: 10,
    metaAt: 30,
    huissierAt: 40,
    panicAt: 45,
    hopeAt: 52,
  },
}

/* ---------- palette (16 colours) ---------- */
const P = {
  black: '#101010',
  white: '#f4f4f4',
  grey: '#c0c0c0',
  dark: '#6e6e6e',
  navy: '#1c3fa8',
  blue: '#2a7fff',
  wall: '#3b4a6b',
  wallLight: '#55658a',
  wood: '#8b5a2b',
  woodDark: '#5c3a18',
  red: '#d12c2c',
  yellow: '#f3c40c',
  green: '#22a62f',
  skin: '#f0c8a0',
  suit: '#1a1f3a',
  paper: '#f4f1e6',
}

/* ---------- pixel helpers ---------- */
function sprite(rows, map) {
  return { rows, map, w: rows[0].length, h: rows.length }
}
function blit(ctx, spr, x, y, flip) {
  for (let j = 0; j < spr.h; j++)
    for (let i = 0; i < spr.w; i++) {
      const col = spr.map[spr.rows[j][i]]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(x + (flip ? spr.w - 1 - i : i), y + j, 1, 1)
    }
}

/* ---------- icons (10 × 10) ---------- */
const I = {
  doc: sprite(['.wwwwwww..', '.w.....ww.', '.w.....www', '.w.bbbb..w', '.w.......w', '.w.bbbb..w', '.w.......w', '.w.bbb...w', '.w.......w', '.wwwwwwwww'], { w: P.white, b: P.navy }),
  pdf: sprite(['.wwwwwww..', '.w.....ww.', '.w.....www', '.w.......w', '.wrrrrrrrw', '.wrrrrrrrw', '.wrrrrrrrw', '.w.......w', '.w.......w', '.wwwwwwwww'], { w: P.white, r: P.red }),
  folder: sprite(['..........', 'yyyy......', 'yyyyyyyyy.', 'yyyyyyyyy.', 'yyyyyyyyy.', 'yyyyyyyyy.', 'yyyyyyyyy.', 'yyyyyyyyy.', 'yyyyyyyyy.', '..........'], { y: P.yellow }),
  trash: sprite(['...gggg...', '.gggggggg.', '..g.g.g...', '..g.g.g...', '..g.g.g...', '..g.g.g...', '..g.g.g...', '..g.g.g...', '..gggggg..', '..........'], { g: P.dark }),
  cloud: sprite(['..........', '...wwww...', '..wwwwww..', '.wwwwwwww.', 'wwwwwwwwww', 'wwwwwwwwww', '.wwwwwwww.', '..........', '..........', '..........'], { w: P.white }),
  warn: sprite(['....yy....', '....yy....', '...yyyy...', '...ykky...', '..yykkyy..', '..yykkyy..', '.yyyyyyyy.', '.yyykkyyy.', 'yyyyyyyyyy', 'yyyyyyyyyy'], { y: P.yellow, k: P.black }),
  bubble: sprite(['...bbbb...', '..bbbbbb..', '.bbbwwbbb.', '.bbwwwbbb.', '.bbbwwbbb.', '.bbbbwwbb.', '..bbbbbb..', '...bbbb...', '..b.......', '..........'], { b: P.blue, w: P.white }),
  meta: sprite(['..........', '..........', '.bbb..bbb.', 'b...bb...b', 'b...bb...b', 'b...bb...b', '.bbb..bbb.', '..........', '..........', '..........'], { b: P.blue }),
  pc: sprite(['.gggggggg.', '.gbbbbbbg.', '.gbbbbbbg.', '.gbbbbbbg.', '.gggggggg.', '....gg....', '..gggggg..', '..........', '..........', '..........'], { g: P.grey, b: P.blue }),
  mail: sprite(['..........', 'wwwwwwwwww', 'wb......bw', 'w.b....b.w', 'w..b..b..w', 'w...bb...w', 'w........w', 'wwwwwwwwww', '..........', '..........'], { w: P.white, b: P.navy }),
}

/* ---------- characters ---------- */
const BOSS = sprite(
  [
    '......kkkkkk......',
    '.....kkkkkkkk.....',
    '.....kkssssskk....',
    '.....ssssssss.....',
    '.....skssssks.....',
    '.....ssssssss.....',
    '.....sssrrsss.....',
    '......ssssss......',
    '....uuuusssuuuu...',
    '...uuuuuubuuuuuu..',
    '..uuuuuuubuuuuuuu.',
    '..uuuuuuubuuuuuuu.',
    '..uuuuuuubuuuuuuu.',
    '..uuuu.uuuuu.uuuu.',
    '..uuuu.uuuuu.uuuu.',
    '..ssss.......ssss.',
  ],
  { k: P.black, s: P.skin, r: P.red, u: P.suit, b: P.blue },
)
const HUISSIER = [
  sprite(
    ['....kkkk....', '...kkkkkk...', '...kkkkkk...', '...ssssss...', '...kkkkkk...', '...ssssss...', '....ssss....', '...uuuuuu...', '..uuuuuuuu..', '..uuuuuuuu..', '..uuuuuuuu..', '...uu..uu...', '...uu..uu...', '...uu..uu...', '..kkk..kkk..', '............'],
    { k: P.black, s: P.skin, u: P.suit },
  ),
  sprite(
    ['....kkkk....', '...kkkkkk...', '...kkkkkk...', '...ssssss...', '...kkkkkk...', '...ssssss...', '....ssss....', '...uuuuuu...', '..uuuuuuuu..', '..uuuuuuuu..', '..uuuuuuuu..', '..uu....uu..', '.uu......uu.', 'uu........uu', 'kk........kk', '............'],
    { k: P.black, s: P.skin, u: P.suit },
  ),
]
const CURSOR = sprite(
  ['k..........', 'kk.........', 'kwk........', 'kwwk.......', 'kwwwk......', 'kwwwwk.....', 'kwwwwwk....', 'kwwwwwwk...', 'kwwwwwwwk..', 'kwwwwwkkkk.', 'kwwkwwk....', 'kwk.kwwk...', 'kk..kwwk...', '.....kk....'],
  { k: P.black, w: P.white },
)

/* ---------- popup catalogue ---------- */
const POPUPS = [
  { title: 'Attention', icon: 'warn', text: "Une capture d'écran a été retrouvée.", button: 'FAUX GROSSIER' },
  { title: 'Messenger', icon: 'bubble', text: 'Nouveau message détecté (2013).', button: 'JE CONTESTE' },
  { title: 'Archive trouvée', icon: 'folder', text: 'Une archive a été restaurée.', button: 'FAUX' },
  { title: 'Document', icon: 'pdf', text: 'Nouveau document détecté dans la sauvegarde.', button: 'FAUX GROSSIER' },
  { title: 'Meta Cloud', icon: 'meta', text: 'Données synchronisées.', button: 'OK' },
  { title: 'Sauvegarde cloud', icon: 'cloud', text: 'Sauvegarde cloud disponible.', button: 'SUPPRIMER' },
  { title: 'Extraction', icon: 'doc', text: 'Extraction terminée. 12 fichiers.', button: 'FERMER' },
  { title: 'Copie', icon: 'doc', text: 'Copie de sauvegarde retrouvée.', button: 'SUPPRIMER QUAND MÊME' },
  { title: 'Erreur', icon: 'warn', text: 'Impossible de supprimer ce fichier.', button: 'FERMER' },
  { title: 'Attention', icon: 'warn', text: 'Ce fichier est utilisé par un autre programme.', button: 'FERMER' },
  { title: 'Corbeille', icon: 'trash', text: 'La corbeille est pleine (246 éléments).', button: 'VIDER QUAND MÊME', dodge: true },
  { title: 'Confirmation', icon: 'warn', text: 'Êtes-vous vraiment sûr ?', button: 'OUI', sure: true },
  { title: 'Mediapart.exe', icon: 'doc', text: "Nouvelle capture d'écran retrouvée.", button: 'FAUX GROSSIER' },
  { title: 'Messages', icon: 'mail', text: 'Nouvelle conversation détectée.', button: 'JE CONTESTE' },
]
const HUISSIER_POPUP = { title: 'Huissier.exe', icon: 'doc', text: 'Nouvelle série de documents transmise.', button: 'OK' }
const META_POPUP = { title: 'Meta Cloud', icon: 'meta', text: 'Synchronisation terminée avec succès. 124 fichiers restaurés.', button: 'OK', big: true, penalty: 49 }
const FINAL_POPUP = { title: 'Sauvegarde retrouvée', icon: 'cloud', text: '124 fichiers restaurés.', button: 'OK', fullscreen: true }

const W = 320
const H = 180
const DESK_TOP = 13
const DESK_BOTTOM = 167
const TITLE_H = 9

function wrap(text, maxChars) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) lines.push(line)
  return lines
}

export function create({ canvas, settings = manifest.settings, onState, onEnd }) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const audio = createAudio()
  const S = { ...manifest.settings, ...settings }

  /* ---------- state ---------- */
  let phase = 'title' // title | playing | hope | freeze | over | plainte
  let G = null
  let raf = 0
  let destroyed = false
  let lastFrame = performance.now()
  let clock = 0 // real time since module creation, for blinking
  let phaseAt = 0 // clock when the phase started
  const pointer = { x: 160, y: 90, cx: 160, cy: 90, inside: false }
  let titleTyped = 0

  function setPhase(next) {
    phase = next
    phaseAt = clock
    if (onState) onState(next === 'playing' || next === 'hope' ? 'playing' : next === 'over' || next === 'freeze' ? 'over' : 'idle')
  }

  function newGame() {
    return {
      t: 0,
      bar: 0,
      maxBar: 0,
      attempts: 0,
      dementis: 0,
      documents: 0,
      misclicks: 0,
      windows: [],
      nextSpawn: S.firstPopupAt,
      metaDone: false,
      huissier: null,
      huissierDone: false,
      panic: false,
      hopeDone: false,
      hopeStep: 0,
      smoke: [],
      flashes: [],
      lastKeyAt: 0,
      frozenAt: 0,
      over: false,
    }
  }

  /* ---------- windows ---------- */
  function makeWindow(def, opts = {}) {
    const maxChars = def.fullscreen ? 60 : def.big ? 34 : 22
    const lines = wrap(def.text, maxChars)
    const textW = Math.max(textWidth(def.title) + 14, ...lines.map((l) => textWidth(l))) + 4
    let w = def.fullscreen ? 300 : Math.min(def.big ? 180 : 130, 18 + textW + 4)
    let h = def.fullscreen ? 150 : TITLE_H + 4 + Math.max(lines.length * LINE_H, 12) + 16
    const win = { ...def, lines, w, h, born: G.t, buttons: [], kind: def.kind || 'popup' }
    if (def.fullscreen) {
      win.x = 10
      win.y = 15
    } else {
      const area = { x0: 32, x1: W - 2 - w, y0: DESK_TOP + 1, y1: DESK_BOTTOM - h }
      if (opts.overButton && Math.random() < 0.6) {
        // Aim at the SUPPRIMER button of the main window, with some jitter.
        win.x = Math.round(190 - w * 0.6 + (Math.random() - 0.5) * 50)
        win.y = Math.round(92 - h * 0.6 + (Math.random() - 0.5) * 40)
      } else {
        win.x = Math.round(area.x0 + Math.random() * (area.x1 - area.x0))
        win.y = Math.round(area.y0 + Math.random() * (area.y1 - area.y0))
      }
      win.x = Math.max(area.x0, Math.min(area.x1, win.x))
      win.y = Math.max(area.y0, Math.min(area.y1, win.y))
    }
    layoutButtons(win)
    return win
  }

  function layoutButtons(win) {
    const bh = 11
    const by = win.h - bh - 3
    if (win.sure) {
      const bw1 = textWidth('OUI') + 6
      const bw2 = textWidth('NON') + 30
      win.buttons = [
        { label: 'OUI', x: win.w - bw1 - bw2 - 8, y: by, w: bw1, h: bh, action: 'close' },
        { label: 'NON', x: win.w - bw2 - 4, y: by, w: bw2, h: bh, action: 'again' },
      ]
      return
    }
    const bw = textWidth(win.button) + 8
    const x = win.dodge && win.dodged ? 4 : win.w - bw - 4
    win.buttons = [{ label: win.button, x, y: by, w: bw, h: bh, action: win.kind === 'main' ? 'delete' : 'close' }]
  }

  function spawn(def, opts) {
    const win = makeWindow(def, { overButton: true, ...opts })
    G.windows.push(win)
    G.documents++
    if (G.windows.length > 70) {
      // The desk is unreadable anyway: forget the oldest popups.
      const idx = G.windows.findIndex((w) => w.kind === 'popup')
      if (idx >= 0) G.windows.splice(idx, 1)
    }
    if (def.big) audio.chime()
    else if (def.fullscreen) audio.ding()
    else if (Math.random() < 0.5) audio.paper()
    else audio.error()
    return win
  }

  function spawnRandom() {
    const def = POPUPS[Math.floor(Math.random() * POPUPS.length)]
    spawn(def)
  }

  function mainWindow() {
    return G.windows.find((w) => w.kind === 'main')
  }

  function startGame() {
    G = newGame()
    const main = makeWindow(
      { title: "Suppression de l'historique...", icon: 'pc', text: 'Suppression en cours... Veuillez patienter.', button: 'SUPPRIMER', kind: 'main' },
    )
    main.x = 92
    main.y = 48
    main.w = 136
    main.h = 60
    main.lines = ['Suppression en cours...', 'Veuillez patienter.']
    layoutButtons(main)
    G.windows.push(main)
    audio.startMusic()
    audio.setIntensity(0)
    setPhase('playing')
  }

  /* ---------- input ---------- */
  function hitButton(win, x, y) {
    for (const b of win.buttons) {
      if (x >= win.x + b.x && x < win.x + b.x + b.w && y >= win.y + b.y && y < win.y + b.y + b.h) return b
    }
    return null
  }

  function click(x, y) {
    if (phase === 'title') {
      if (clock - phaseAt > 0.3) {
        audio.resume()
        audio.boot()
        startGame()
      }
      return
    }
    if (phase === 'over') {
      if (clock - phaseAt > 2.5) {
        setPhase('plainte')
        audio.boot()
      }
      return
    }
    if (phase !== 'playing' && phase !== 'hope') return

    for (let i = G.windows.length - 1; i >= 0; i--) {
      const win = G.windows[i]
      if (x < win.x || x >= win.x + win.w || y < win.y || y >= win.y + win.h) continue
      const b = hitButton(win, x, y)
      if (b) {
        audio.click()
        if (b.action === 'delete') {
          G.attempts++
          if (phase === 'playing') {
            G.bar = Math.min(100, G.bar + 1)
            G.maxBar = Math.max(G.maxBar, G.bar)
          }
          G.flashes.push({ x: win.x + b.x, y: win.y + b.y, w: b.w, h: b.h, until: G.t + 0.08 })
        } else if (b.action === 'close') {
          G.windows.splice(i, 1)
          G.dementis++
          const penalty = win.penalty ?? (win.fullscreen ? 0 : 3 + Math.random() * 9)
          G.bar = Math.max(win.fullscreen ? 1 : 0, G.bar - penalty)
          if (win.fullscreen) G.bar = 1
          // The more you deny, the faster it comes back: a fast player faces more popups,
          // so the score measures speed instead of hitting a fixed ceiling.
          if (phase === 'playing' && !win.fullscreen) {
            const popups = G.windows.length - 1
            if (G.panic && Math.random() < 0.7) spawnRandom()
            else if (popups <= 1) G.nextSpawn = Math.min(G.nextSpawn, G.t + (G.panic ? 0.15 : 0.6))
          }
        } else if (b.action === 'again') {
          audio.error()
          spawnRandom()
          spawnRandom()
        }
      } else if (y < win.y + TITLE_H) {
        // Bring to front: digging through the pile is allowed.
        G.windows.splice(i, 1)
        G.windows.push(win)
        audio.key()
      } else {
        G.misclicks++
      }
      return
    }
    G.misclicks++
    audio.key()
  }

  function move(x, y) {
    // The "vider quand même" button runs away from the cursor.
    for (let i = G?.windows.length - 1; i >= 0; i--) {
      const win = G.windows[i]
      if (!win.dodge) continue
      const b = win.buttons[0]
      const bx = win.x + b.x + b.w / 2
      const by = win.y + b.y + b.h / 2
      if (Math.abs(x - bx) < b.w / 2 + 6 && Math.abs(y - by) < b.h / 2 + 6) {
        win.dodged = !win.dodged
        layoutButtons(win)
        audio.key()
      }
    }
  }

  function input(action, payload) {
    if (destroyed) return
    if (action === 'pointer' && payload) {
      pointer.x = payload.x
      pointer.y = payload.y
      pointer.inside = true
      if (G && (phase === 'playing' || phase === 'hope')) move(Math.round(pointer.cx), Math.round(pointer.cy))
      if (payload.type === 'down') {
        // In panic mode the drawn cursor lags: clicks land where it is drawn, not where you are.
        click(Math.round(pointer.cx), Math.round(pointer.cy))
      }
      return
    }
    if (action === 'confirm') {
      if (phase === 'title' || phase === 'over') click(0, 0)
      else if (G) G.misclicks++
    }
  }

  /* ---------- update ---------- */
  function update(dt) {
    clock += dt
    // Cursor easing: instant normally, sluggish in panic mode.
    const lag = G && G.panic && (phase === 'playing' || phase === 'hope') ? 0.22 : 1
    pointer.cx += (pointer.x - pointer.cx) * lag
    pointer.cy += (pointer.y - pointer.cy) * lag
    if (lag === 1) {
      pointer.cx = pointer.x
      pointer.cy = pointer.y
    }

    if (phase === 'title') {
      titleTyped = Math.min(11, Math.floor((clock - phaseAt - 0.6) * 10))
      return
    }
    if (phase === 'plainte') {
      if (clock - phaseAt > 1.8) startGame()
      return
    }
    if (phase === 'freeze') {
      if (clock - phaseAt > 1.4) {
        setPhase('over')
        audio.stopMusic()
        if (onEnd) {
          onEnd({
            score: G.dementis,
            details: {
              attempts: G.attempts,
              dementis: G.dementis,
              documents: G.documents,
              maxProgress: Math.round(G.maxBar * 10),
              misclicks: G.misclicks,
            },
            durationMs: Math.round(G.t * 1000),
          })
        }
      }
      return
    }
    if (phase !== 'playing' && phase !== 'hope') return

    G.t += dt
    const t = G.t
    const intensity = Math.min(1, Math.max(0, (t - 10) / (S.panicAt - 10)))
    audio.setIntensity(phase === 'hope' ? 0 : intensity)

    // Scripted events
    if (!G.metaDone && t >= S.metaAt) {
      G.metaDone = true
      spawn(META_POPUP, { overButton: true })
    }
    if (!G.huissierDone && t >= S.huissierAt) {
      G.huissierDone = true
      G.huissier = { x: W + 4, nextStep: t, frame: 0 }
      audio.modem()
    }
    if (G.huissier) {
      G.huissier.x -= dt * 36
      G.huissier.frame = Math.floor(t * 6) % 2
      if (t >= G.huissier.nextStep) {
        G.huissier.nextStep = t + 0.75
        audio.tac()
        spawn(HUISSIER_POPUP, { overButton: true })
      }
      if (G.huissier.x < -20) G.huissier = null
    }
    if (!G.panic && t >= S.panicAt) {
      G.panic = true
      audio.smokeHiss()
    }
    if (!G.hopeDone && t >= S.hopeAt && phase === 'playing') {
      G.hopeDone = true
      G.bar = 99
      G.maxBar = Math.max(G.maxBar, 99)
      G.hopeStep = 0
      audio.stopMusic()
      setPhase('hope')
    }
    if (phase === 'hope') {
      const steps = [99.1, 99.4, 99.8, 99.9]
      const since = clock - phaseAt
      const step = Math.min(4, Math.floor(since / 0.9))
      if (step > G.hopeStep) {
        G.hopeStep = step
        if (step <= 4) {
          G.bar = steps[step - 1]
          G.maxBar = Math.max(G.maxBar, G.bar)
          audio.key()
        }
      }
      if (since > 4.2) {
        setPhase('playing')
        G.bar = 1
        spawn(FINAL_POPUP)
        audio.startMusic()
      }
    } else {
      // Popup rain: exponential, then relentless.
      if (t >= G.nextSpawn && t >= S.firstPopupAt) {
        if (G.documents === 0) spawn(POPUPS[0])
        else if (t < 21 && t >= 20) {
          spawnRandom()
          spawnRandom()
        } else spawnRandom()
        const interval = G.panic ? 0.28 : Math.max(0.4, 4.5 * Math.pow(0.9, t - S.firstPopupAt))
        G.nextSpawn = t + interval
      }
    }

    // Smoke
    if (G.panic && Math.random() < 0.5) G.smoke.push({ x: 160 + Math.random() * 8 - 4, y: 128, born: t, drift: Math.random() * 2 - 1 })
    G.smoke = G.smoke.filter((p) => t - p.born < 2)
    G.flashes = G.flashes.filter((f) => t < f.until)

    if (t >= S.durationSeconds) {
      setPhase('freeze')
    }
  }

  /* ---------- drawing ---------- */
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  function bevel(x, y, w, h, raised = true) {
    rect(x, y, w, h, P.grey)
    rect(x, y, w, 1, raised ? P.white : P.dark)
    rect(x, y, 1, h, raised ? P.white : P.dark)
    rect(x, y + h - 1, w, 1, raised ? P.dark : P.white)
    rect(x + w - 1, y, 1, h, raised ? P.dark : P.white)
  }
  function button(x, y, w, h, label, pressed) {
    bevel(x, y, w, h, !pressed)
    drawTextC(ctx, label, x + w / 2, y + 1, P.black)
  }

  function drawDesktop() {
    rect(0, DESK_TOP, W, DESK_BOTTOM - DESK_TOP, P.wall)
    // Window with Paris
    rect(216, 20, 56, 44, P.wallLight)
    rect(218, 22, 52, 40, '#7f9bc9')
    rect(243, 22, 2, 40, P.wallLight)
    rect(218, 41, 52, 2, P.wallLight)
    for (let i = 0; i < 14; i++) rect(230 + i, 60 - i * 2 - (i > 6 ? (i - 6) * 1 : 0), 1, 2, P.dark)
    rect(226, 52, 10, 10, P.dark)
    rect(236, 58, 4, 4, P.dark)
    // Poster
    rect(280, 24, 36, 48, P.paper)
    drawText(ctx, 'LIBERTÉ', 283, 27, P.navy)
    drawText(ctx, 'DE NIER', 283, 36, P.navy)
    drawText(ctx, 'ÉGALITÉ', 283, 45, P.navy)
    drawText(ctx, 'DE SE', 283, 54, P.navy)
    drawText(ctx, 'PLAINDRE', 283, 63, P.navy)
    // Desk
    rect(96, 142, 128, 4, P.wood)
    rect(96, 146, 128, 21, P.woodDark)
    rect(100, 146, 120, 1, P.wood)
    // Boss and monitor
    blit(ctx, BOSS, 151, 120)
    rect(140, 128, 16, 13, P.grey)
    rect(142, 130, 12, 9, P.blue)
    rect(146, 141, 4, 2, P.dark)
    rect(143, 143, 10, 1, P.dark)
    if (G && G.panic) {
      rect(144, 132, 8, 5, P.white)
      if (Math.floor(clock * 8) % 2) rect(174, 126, 1, 2, P.blue)
    }
    // Paper stacks grow with the documents found
    const stacks = G ? Math.min(14, Math.floor(G.documents / 6)) : 0
    for (let i = 0; i < stacks; i++) {
      const sx = i % 2 ? 36 + (i >> 1) * 11 : 232 + (i >> 1) * 11
      const sh = 6 + ((i * 7) % 12)
      rect(sx, 166 - sh, 9, sh, P.paper)
      for (let j = 2; j < sh; j += 3) rect(sx, 166 - sh + j, 9, 1, '#d9d3c0')
    }
    // Desktop icons
    const icons = [
      ['pc', 'MON PC'],
      ['mail', 'MESSAGES'],
      ['trash', 'CORBEILLE'],
      ['meta', 'META'],
      ['folder', 'ARCHIVES'],
    ]
    icons.forEach(([icon, label], i) => {
      const y = 18 + i * 28
      blit(ctx, I[icon], 10, y)
      drawTextC(ctx, label, 15, y + 11, P.white)
    })
  }

  function drawWindow(win) {
    const { x, y, w, h } = win
    rect(x + 2, y + 2, w, h, 'rgba(0,0,0,.35)')
    bevel(x, y, w, h)
    rect(x + 2, y + 2, w - 4, TITLE_H - 1, win.kind === 'main' || win.big || win.fullscreen ? P.navy : P.navy)
    drawText(ctx, win.title, x + 4, y + 2, P.white)
    // Close box
    bevel(x + w - 11, y + 2, 9, 7)
    rect(x + w - 9, y + 4, 1, 1, P.black)
    rect(x + w - 8, y + 5, 1, 1, P.black)
    rect(x + w - 7, y + 6, 1, 1, P.black)
    rect(x + w - 7, y + 4, 1, 1, P.black)
    rect(x + w - 9, y + 6, 1, 1, P.black)
    const iconX = x + 4
    const textX = x + 18
    const textY = y + TITLE_H + 3
    if (win.fullscreen) {
      drawTextC(ctx, win.title.toUpperCase(), x + w / 2, y + 40, P.black)
      ctx.save()
      ctx.translate(x + w / 2, y + 60)
      ctx.scale(2, 2)
      drawTextC(ctx, win.lines[0], 0, 0, P.navy)
      ctx.restore()
      blit(ctx, I[win.icon], x + w / 2 - 5, y + 90)
    } else if (win.kind === 'main') {
      drawProgress(win)
    } else {
      blit(ctx, I[win.icon], iconX, textY)
      win.lines.forEach((line, i) => drawText(ctx, line, textX, textY + i * LINE_H, P.black))
    }
    for (const b of win.buttons) {
      const pressed = G.flashes.some((f) => f.x === x + b.x && f.y === y + b.y)
      button(x + b.x, y + b.y, b.w, b.h, b.label, pressed)
    }
  }

  function drawProgress(win) {
    const bx = win.x + 6
    const by = win.y + 14
    const bw = 90
    bevel(bx, by, bw, 10, false)
    const segments = Math.floor((G.bar / 100) * 14)
    for (let i = 0; i < segments; i++) rect(bx + 2 + i * 6, by + 2, 5, 6, P.green)
    const pct = G.bar >= 99 && G.bar < 100 ? G.bar.toFixed(1) : String(Math.floor(G.bar))
    drawText(ctx, pct + ' %', bx + bw + 4, by + 1, P.black)
    win.lines.forEach((line, i) => drawText(ctx, line, win.x + 6, win.y + 27 + i * LINE_H, P.black))
    blit(ctx, I.pc, win.x + win.w - 16, win.y + 28)
  }

  function drawHud() {
    rect(0, 0, W, DESK_TOP, P.black)
    drawText(ctx, 'CTRL + RN', 3, 2, P.white)
    if (G && G.panic) drawText(ctx, 'HISTORIQUE : ' + (G.documents - G.dementis) + ' ÉLÉMENTS', 48, 2, P.red)
    else drawText(ctx, "IMPOSSIBLE DE VIDER L'HISTORIQUE.", 48, 2, P.grey)
    const d = String(G ? G.dementis : 0).padStart(3, '0')
    drawText(ctx, 'DÉMENTIS : ' + d, 190, 2, P.yellow)
    const s = G ? Math.floor(G.t) : 0
    drawText(ctx, 'TEMPS : ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'), 262, 2, P.white)
    // Taskbar
    bevel(0, DESK_BOTTOM, W, H - DESK_BOTTOM)
    button(2, DESK_BOTTOM + 2, 44, 9, 'DÉMARRER', false)
    rect(4, DESK_BOTTOM + 4, 2, 2, P.red)
    rect(6, DESK_BOTTOM + 4, 2, 2, P.green)
    rect(4, DESK_BOTTOM + 6, 2, 2, P.blue)
    rect(6, DESK_BOTTOM + 6, 2, 2, P.yellow)
    const tasks = G ? G.windows.slice(-4) : []
    tasks.forEach((win, i) => {
      const tx = 50 + i * 56
      bevel(tx, DESK_BOTTOM + 2, 52, 9, false)
      drawText(ctx, win.title.slice(0, 11), tx + 3, DESK_BOTTOM + 3, P.black)
    })
    bevel(286, DESK_BOTTOM + 2, 32, 9, false)
    drawText(ctx, '10:42', 292, DESK_BOTTOM + 3, P.black)
  }

  function drawCursor() {
    if (!pointer.inside) return
    blit(ctx, CURSOR, Math.round(pointer.cx), Math.round(pointer.cy))
  }

  function drawTitle() {
    rect(0, 0, W, H, P.black)
    const since = clock - phaseAt
    const typed = 'CTRL+RN.EXE'.slice(0, Math.max(0, titleTyped))
    drawText(ctx, 'C:> ' + typed + (Math.floor(clock * 2) % 2 ? '_' : ' '), 20, 20, P.grey)
    if (since > 2.4) {
      ctx.save()
      ctx.translate(160, 60)
      ctx.scale(3, 3)
      drawTextC(ctx, 'CTRL + RN', 0, 0, P.white)
      ctx.restore()
      drawTextC(ctx, "IMPOSSIBLE DE VIDER L'HISTORIQUE", 160, 92, P.grey)
    }
    if (since > 3.2 && Math.floor(clock * 1.5) % 2) drawTextC(ctx, 'CLIQUEZ POUR COMMENCER', 160, 118, P.yellow)
    if (since > 3.2) drawTextC(ctx, 'TOUTE RESSEMBLANCE AVEC UN LOGICIEL POLITIQUE EXISTANT', 160, 160, P.dark)
    if (since > 3.2) drawTextC(ctx, 'SERAIT PUREMENT CATASTROPHIQUE.', 160, 169, P.dark)
  }

  function drawOver() {
    rect(0, 0, W, H, P.black)
    const since = clock - phaseAt
    const lines = [
      ["IMPOSSIBLE DE VIDER L'HISTORIQUE", P.white],
      ['', P.white],
      ['TENTATIVES DE SUPPRESSION : ' + G.attempts, P.grey],
      ['POPUPS FERMÉES : ' + G.dementis, P.grey],
      ['DOCUMENTS RETROUVÉS : ' + G.documents, P.grey],
      ['PROGRESSION MAXIMALE : ' + (G.maxBar >= 99 ? G.maxBar.toFixed(1) : Math.floor(G.maxBar)) + ' %', P.grey],
      ['', P.white],
      ['DÉMENTIS : ' + G.dementis, P.yellow],
    ]
    lines.forEach(([text, colour], i) => {
      if (since > 0.6 + i * 0.25) drawTextC(ctx, text, 160, 30 + i * 11, colour)
    })
    if (since > 2.5) {
      drawTextC(ctx, 'QUE SOUHAITEZ-VOUS FAIRE ?', 160, 128, P.white)
      if (Math.floor(clock * 1.5) % 2) drawTextC(ctx, '[ CLIC ] PORTER PLAINTE', 160, 142, P.yellow)
    }
  }

  function draw() {
    if (phase === 'title') {
      drawTitle()
      drawCursor()
      return
    }
    if (phase === 'over') {
      drawOver()
      drawCursor()
      return
    }
    if (phase === 'plainte') {
      rect(0, 0, W, H, P.black)
      if (clock - phaseAt > 1.2) drawText(ctx, 'C:> REDÉMARRAGE' + (Math.floor(clock * 4) % 2 ? '_' : ''), 20, 20, P.grey)
      return
    }
    drawDesktop()
    for (const win of G.windows) if (!win.fullscreen) drawWindow(win)
    if (G.huissier) {
      blit(ctx, HUISSIER[G.huissier.frame], Math.round(G.huissier.x), 122)
      rect(Math.round(G.huissier.x) - 4, 118, 14, 8, P.paper)
      rect(Math.round(G.huissier.x) - 4, 120, 14, 1, '#d9d3c0')
      rect(Math.round(G.huissier.x) - 4, 123, 14, 1, '#d9d3c0')
      drawTextC(ctx, 'HUISSIER.EXE', Math.round(G.huissier.x) + 6, 139, P.white)
    }
    for (const p of G.smoke) {
      const age = G.t - p.born
      ctx.globalAlpha = Math.max(0, 0.6 - age * 0.3)
      rect(Math.round(p.x + p.drift * age * 6), Math.round(p.y - age * 14), 2 + Math.floor(age * 2), 2 + Math.floor(age * 2), P.grey)
    }
    ctx.globalAlpha = 1
    for (const win of G.windows) if (win.fullscreen) drawWindow(win)
    drawHud()
    if (phase === 'freeze') {
      const since = clock - phaseAt
      if (since > 0.8) rect(0, 0, W, H, P.black)
    }
    drawCursor()
  }

  function frame(now) {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (now - lastFrame) / 1000)
    lastFrame = now
    if (phase === 'freeze' && clock - phaseAt < 0.8) {
      clock += dt
      return // the screen freezes
    }
    update(dt)
    draw()
  }

  function onVisibility() {
    if (document.hidden) pause()
  }
  document.addEventListener('visibilitychange', onVisibility)

  let pausedPhase = null
  function pause() {
    if (pausedPhase || !(phase === 'playing' || phase === 'hope')) return
    pausedPhase = phase
    audio.stopMusic()
    cancelAnimationFrame(raf)
    rect(0, 0, W, H, 'rgba(0,0,0,.5)')
    drawTextC(ctx, 'PAUSE', 160, 84, P.white)
  }
  function resume() {
    if (!pausedPhase) return
    pausedPhase = null
    if (phase === 'playing') audio.startMusic()
    lastFrame = performance.now()
    raf = requestAnimationFrame(frame)
  }

  async function start() {
    await audio.resume()
    setPhase('title')
    titleTyped = 0
  }

  function stop() {
    audio.stopMusic()
    setPhase('title')
  }

  function destroy() {
    destroyed = true
    cancelAnimationFrame(raf)
    audio.stopMusic()
    document.removeEventListener('visibilitychange', onVisibility)
  }

  setPhase('title')
  raf = requestAnimationFrame(frame)
  return {
    start,
    input,
    pause,
    resume,
    stop,
    destroy,
    get state() {
      return phase === 'playing' || phase === 'hope' ? 'playing' : pausedPhase ? 'paused' : phase === 'over' ? 'over' : 'idle'
    },
  }
}

/** Server side: is this result reachable in a sixty-second game? */
export function validate(result, settings = manifest.settings) {
  if (!result || typeof result !== 'object') return false
  const { score, details, durationMs } = result
  const values = [score, details?.attempts, details?.dementis, details?.documents, details?.maxProgress, details?.misclicks]
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false
  if (score !== details.dementis) return false
  if (details.dementis > details.documents) return false
  const seconds = settings.durationSeconds ?? 60
  if (details.documents > seconds * 6) return false
  if (details.attempts > seconds * 25) return false
  if (details.maxProgress > 999) return false
  return durationMs >= seconds * 1000 - 500 && durationMs <= seconds * 1000 + 5000
}

export function grade(result) {
  const d = result.details.dementis
  return d >= 150 ? 'S' : d >= 100 ? 'A' : d >= 60 ? 'B' : d >= 30 ? 'C' : 'D'
}
