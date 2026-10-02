import { createAudio } from './audio.js'
import { drawText, drawTextC, LINE_H, textWidth } from './font.js'

/*
 * GRAND THEFT FIFA — « Vous êtes presque arrivé. »
 *
 * Top-down arcade driving in a caricature of Paris. The mission is to return a FIFA car;
 * the destination keeps moving for administrative reasons. Follows the games-site module
 * contract: `manifest`, `create(options)`, `validate(result)`, `grade(result)`.
 * Internal resolution 320 × 180, pixel art drawn in code.
 */

export const manifest = {
  slug: 'grand-theft-fifa',
  title: 'GRAND THEFT FIFA',
  tagline: 'Vous êtes presque arrivé.',
  releasedAt: '2026-10-13',
  status: 'draft',
  orientation: 'landscape',
  size: { width: 320, height: 180 },
  controls: [
    { action: 'key', label: 'Flèches ou WASD / ZQSD : conduire' },
    { action: 'key', key: 'Space', label: 'Espace : frein à main' },
    { action: 'key', key: 'KeyE', label: 'E : interagir, valider' },
    { action: 'key', key: 'Enter', label: 'Entrée : changer de station radio' },
  ],
  settings: { durationMinutes: 10 },
}

/* ---------- world ---------- */
const W = 320
const H = 180
const TILE = 16
const MW = 48
const MH = 32
const WORLD_W = MW * TILE
const WORLD_H = MH * TILE
/** One pixel is two metres: the GPS lies, but it lies consistently. */
const METRES_PER_PX = 2
/** GPS distances are padded, like every GPS. 400 px to the FIFA reads as 1,2 km. */
const GPS_FUDGE = 1.5

const P = {
  road: '#8a8a8a',
  roadLine: '#d8d8c8',
  sidewalk: '#d9c9a8',
  grass: '#6f8f4f',
  building: '#5a4a6a',
  building2: '#6a5a50',
  building3: '#4a5a70',
  roof: '#3a3040',
  black: '#101010',
  white: '#f4f4f4',
  yellow: '#f3c40c',
  red: '#d12c2c',
  blue: '#2a62d6',
  green: '#22a62f',
  grey: '#c0c0c0',
  dark: '#404040',
  taxi: '#f0d020',
  skin: '#f0c8a0',
  ui: '#101828',
}

/* Tiles: R road, S sidewalk, G grass, B building, T tree (grass with a tree). */
const map = []
const roadDir = [] // per road tile: one-way direction 'E','W','N','S' or null
const blocks = []
function buildMap() {
  for (let y = 0; y < MH; y++) {
    map.push([])
    roadDir.push([])
    for (let x = 0; x < MW; x++) {
      const rx = x % 8 < 2
      const ry = y % 8 < 2
      const outer = x < 2 || x >= MW - 2 || y < 2 || y >= MH - 2
      let t = 'B'
      if (rx || ry || outer) t = 'R'
      else {
        const ix = x % 8
        const iy = y % 8
        if (ix === 2 || ix === 7 || iy === 2 || iy === 7) t = 'S'
      }
      map[y].push(t)
      roadDir[y].push(null)
    }
  }
  // Blocks (6 × 6 inner areas), indexed by block coordinates
  for (let by = 0; by < MH / 8; by++)
    for (let bx = 0; bx < MW / 8; bx++) blocks.push({ bx, by, x: bx * 8 + 2, y: by * 8 + 2, kind: 'building', label: null, colour: [P.building, P.building2, P.building3][(bx + by * 3) % 3] })
  const block = (bx, by) => blocks.find((b) => b.bx === bx && b.by === by)
  // Parks
  for (const [bx, by] of [[1, 2], [4, 0], [2, 3]]) {
    const b = block(bx, by)
    b.kind = 'park'
    for (let y = b.y + 1; y < b.y + 5; y++) for (let x = b.x + 1; x < b.x + 5; x++) map[y][x] = (x + y) % 3 === 0 ? 'T' : 'G'
  }
  // Key buildings
  const KEY = { FIFA: [3, 1], LOGISTIQUE: [0, 0], 'PARC AUTO': [5, 3], FFF: [0, 3], GARAGE: [5, 1], POLICE: [2, 0], 'FOURRIÈRE': [5, 0], 'PRÉFECTURE': [1, 1] }
  for (const [label, [bx, by]] of Object.entries(KEY)) {
    const b = block(bx, by)
    b.label = label
    b.colour = label === 'FIFA' ? '#1b3a8c' : label === 'POLICE' ? '#2a4a90' : label === 'GARAGE' ? '#8a4a2a' : label === 'FFF' ? '#1c5a9c' : label === 'FOURRIÈRE' ? '#5a5a5a' : '#6a4a7a'
  }
  // One-way streets: horizontal roads alternate, except the outer ring (the périphérique).
  for (let y = 2; y < MH - 2; y++)
    for (let x = 2; x < MW - 2; x++) {
      if (map[y][x] !== 'R') continue
      const rx = x % 8 < 2
      const ry = y % 8 < 2
      if (ry && !rx) {
        const band = Math.floor(y / 8)
        roadDir[y][x] = band % 2 ? 'W' : 'E'
      }
    }
}
buildMap()

const tileAt = (px, py) => {
  const x = Math.floor(px / TILE)
  const y = Math.floor(py / TILE)
  if (x < 0 || y < 0 || x >= MW || y >= MH) return 'B'
  return map[y][x]
}
const solid = (px, py) => tileAt(px, py) === 'B'
/** Point on the road in front of a block (its bottom road), where destinations sit. */
function frontOf(label) {
  const b = blocks.find((k) => k.label === label)
  return { x: (b.x + 3) * TILE, y: (b.y + 6) * TILE + 8 }
}

/* ---------- destinations and dialogue ---------- */
const CHAIN = [
  { dest: 'FIFA', name: 'FIFA PARIS', arrive: ['RÉCEPTION DU VÉHICULE IMPOSSIBLE.', 'Merci de vous présenter', 'au service Logistique.'], flash: 'PROCÉDURE !', points: 2500 },
  { dest: 'LOGISTIQUE', name: 'SERVICE LOGISTIQUE FIFA', interphone: true, arrive: ['« Ah non monsieur, ici c’est', 'la logistique événementielle. »', '', 'MAUVAIS SERVICE'], flash: 'MAUVAIS BUREAU !', points: 5000 },
  { dest: 'PARC AUTO', name: 'FIFA - GESTION DU PARC AUTOMOBILE', arrive: ['« Le véhicule n’apparaît pas', 'dans notre système. »'], flash: 'VÉHICULE INTROUVABLE !', points: 5000 },
  { dest: 'FFF', name: 'FFF', arrive: ['« Ce véhicule appartient à la FIFA. »'], flash: 'MAUVAIS BUREAU !', points: 5000 },
  { dest: 'GARAGE', name: 'GARAGE PARTENAIRE FIFA', arrive: ['« Aucun ordre de restitution. »'], flash: 'DOSSIER INCOMPLET !', points: 5000 },
  { dest: 'PRÉFECTURE', name: 'PRÉFECTURE', arrive: ['« Nous ne sommes pas la FIFA. »'], flash: 'MAUVAIS BUREAU !', points: 5000 },
  { dest: 'FIFA', name: 'FIFA PARIS', arrive: ['« Vous êtes déjà venu aujourd’hui ? »'], flash: 'PROCÉDURE !', points: 2500 },
  { dest: 'FIFA', name: 'FIFA - RESTITUTION DES VÉHICULES', final: true },
]
const MISSIONS = [
  { name: 'LIVRAISON URGENTE', brief: ['« Le service Logistique a besoin', 'du dossier du véhicule. »', 'Récupérez l’enveloppe, puis livrez-la.'], steps: ['PARC AUTO', 'LOGISTIQUE'], done: ['DOSSIER OBSOLÈTE.', '+10 000'] },
  { name: 'LE DOUBLE DES CLÉS', brief: ['« Le garage a un double des clés. »', 'Allez le chercher.'], steps: ['GARAGE'], done: ['CLÉS TROUVÉES.', 'Le garage a les clés.', 'Mais pas la voiture.', '+10 000'] },
  { name: 'CONTRÔLE TECHNIQUE', brief: ['« Le véhicule doit passer au garage', 'avant restitution. »', 'Vous avez 45 secondes.'], steps: ['GARAGE'], timer: 45, done: ['CONTRÔLE TECHNIQUE REFUSÉ.', '+10 000'], fail: ['DÉLAI DÉPASSÉ.', 'Le garage a fermé.'] },
]
const RADIO = [
  { name: 'FIFA FM', lines: ['FIFA. FOOTBALL UNITES THE WORLD.', 'MESSAGE INTERNE : QUELQU’UN AURAIT-IL VU UNE BERLINE NOIRE ?', 'FIFA. LE JEU, LA PASSION, LA LOGISTIQUE.'] },
  { name: 'INFO 24', lines: ['FLASH CIRCULATION : D’IMPORTANTES PERTURBATIONS DANS LE CENTRE DE PARIS APRÈS LE PASSAGE D’UNE BERLINE NOIRE.', 'LA PRÉFECTURE APPELLE AU CALME.'] },
  { name: 'RADIO FOOT', lines: ['« MAIS LA VRAIE QUESTION, EST-CE VRAIMENT LA VOITURE LE PROBLÈME ? »', '« MOI JE DIS : ON VERRA AU RETOUR. »', '« NON MAIS ATTENDS, ATTENDS, ATTENDS. »'] },
  { name: 'ADMIN FM', lines: ['VOTRE APPEL EST IMPORTANT POUR NOUS. MERCI DE PATIENTER.', 'TEMPS D’ATTENTE ESTIMÉ : CINQ MINUTES.'] },
]

const PROPS = {
  plot: { w: 3, h: 3, colour: P.red, points: 25, label: 'PLOT' },
  poubelle: { w: 4, h: 4, colour: '#3a6a3a', points: 50, label: 'POUBELLE' },
  parasol: { w: 8, h: 8, colour: '#e05a3c', points: 100, label: 'PARASOL' },
  table: { w: 5, h: 5, colour: '#c8b090', points: 150, label: 'MOBILIER URBAIN' },
  barriere: { w: 8, h: 2, colour: P.grey, points: 150, label: 'MOBILIER URBAIN' },
  velib: { w: 3, h: 6, colour: '#6a9ad0', points: 150, label: 'VÉLIB' },
  carton: { w: 4, h: 4, colour: '#b89060', points: 25, label: 'CARTON' },
}

const CAR_TYPES = {
  fifa: { w: 20, h: 10, maxSpeed: 175, accel: 110, turn: 2.4, grip: 6.5, mass: 1.3, colour: '#161616', label: 'BERLINE FIFA' },
  taxi: { w: 16, h: 9, maxSpeed: 140, accel: 100, turn: 3.0, grip: 8, mass: 1, colour: P.taxi, label: 'TAXI' },
  police: { w: 18, h: 9, maxSpeed: 160, accel: 120, turn: 2.8, grip: 8, mass: 1.1, colour: '#e8e8f0', label: 'POLICE' },
  civil: { w: 15, h: 8, maxSpeed: 60, accel: 60, turn: 2.5, grip: 8, mass: 0.9, colour: null, label: 'CIVIL' },
  bus: { w: 30, h: 10, maxSpeed: 45, accel: 40, turn: 1.6, grip: 9, mass: 2.5, colour: '#3a8a5a', label: 'BUS' },
  van: { w: 18, h: 10, maxSpeed: 55, accel: 50, turn: 2.2, grip: 8, mass: 1.4, colour: '#e8e8e8', label: 'CAMIONNETTE' },
}
const CIVIL_COLOURS = ['#c04040', '#4060b0', '#d0d0d0', '#808080', '#a0a040', '#e08030']

export function create({ canvas, onState, onEnd }) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const audio = createAudio()

  /* ---------- pre-rendered city ---------- */
  const city = document.createElement('canvas')
  city.width = WORLD_W
  city.height = WORLD_H
  const cc = city.getContext('2d')
  function renderCity() {
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++) {
        const t = map[y][x]
        const px = x * TILE
        const py = y * TILE
        cc.fillStyle = t === 'R' ? P.road : t === 'S' ? P.sidewalk : t === 'G' || t === 'T' ? P.grass : P.building
        cc.fillRect(px, py, TILE, TILE)
        if (t === 'R') {
          const rx = x % 8 < 2
          const ry = y % 8 < 2
          const outer = x < 2 || x >= MW - 2 || y < 2 || y >= MH - 2
          // Centre line between the two lanes
          if (ry && !rx && y % 8 === 1 && !outer) for (let i = 0; i < TILE; i += 6) { cc.fillStyle = P.roadLine; cc.fillRect(px + i, py, 3, 1) }
          if (rx && !ry && x % 8 === 1 && !outer) for (let i = 0; i < TILE; i += 6) { cc.fillStyle = P.roadLine; cc.fillRect(px, py + i, 1, 3) }
          const d = roadDir[y][x]
          if (d && x % 8 === 4) {
            // One-way arrows painted on the road
            cc.fillStyle = P.roadLine
            const cx = px + 8
            const cy = py + 8
            for (let i = -3; i <= 3; i++) cc.fillRect(cx + i, cy, 1, 1)
            const tip = d === 'E' ? 1 : -1
            cc.fillRect(cx + tip * 3, cy - 1, 1, 3)
            cc.fillRect(cx + tip * 2, cy - 2, 1, 5)
          }
          // Pedestrian crossings at intersections
          if (rx && ry) { cc.fillStyle = '#9a9a9a'; cc.fillRect(px, py, TILE, TILE) }
        }
        if (t === 'T') {
          cc.fillStyle = '#3f6a2f'
          cc.fillRect(px + 3, py + 3, 10, 10)
          cc.fillStyle = '#5a8a3a'
          cc.fillRect(px + 5, py + 5, 6, 6)
        }
        if (t === 'S') {
          cc.fillStyle = '#c8b898'
          cc.fillRect(px, py, TILE, 1)
          cc.fillRect(px, py, 1, TILE)
        }
      }
    // Buildings: roofs, windows and the big labels
    for (const b of blocks) {
      if (b.kind !== 'building') continue
      const px = (b.x + 1) * TILE
      const py = (b.y + 1) * TILE
      const size = 4 * TILE
      cc.fillStyle = b.colour
      cc.fillRect(px, py, size, size)
      cc.fillStyle = 'rgba(0,0,0,.25)'
      cc.fillRect(px, py + size - 4, size, 4)
      cc.fillRect(px + size - 4, py, 4, size)
      cc.fillStyle = 'rgba(255,255,255,.12)'
      for (let y = 6; y < size - 8; y += 10) for (let x = 6; x < size - 8; x += 10) cc.fillRect(px + x, py + y, 4, 4)
      if (b.label) {
        const scale = textWidth(b.label) * 2 <= size - 8 ? 2 : 1
        cc.save()
        cc.translate(px + size / 2, py + size / 2 - 4 * scale)
        cc.scale(scale, scale)
        drawTextC(cc, b.label, 0, 0, P.white)
        cc.restore()
        cc.fillStyle = P.yellow
        cc.fillRect(px + size / 2 - 6, py + size - 2, 12, 2)
      }
    }
  }
  renderCity()

  /* ---------- game state ---------- */
  let phase = 'title' // title | playing | dialog | paint | busted | boom | final | over
  let G = null
  let raf = 0
  let destroyed = false
  let lastFrame = performance.now()
  let clock = 0
  let phaseAt = 0
  const keys = {}

  function setPhase(next) {
    phase = next
    phaseAt = clock
    onState?.(next === 'title' ? 'idle' : next === 'over' ? 'over' : 'playing')
  }

  function makeCar(type, x, y, a) {
    const t = CAR_TYPES[type]
    return { type, x, y, a, vx: 0, vy: 0, hp: 100, w: t.w, h: t.h, colour: t.colour ?? CIVIL_COLOURS[Math.floor(Math.random() * CIVIL_COLOURS.length)], stall: 0 }
  }

  function newGame() {
    const fifa = frontOf('FIFA')
    const g = {
      t: 0,
      // Same road as the FIFA entrance, a straight drive away: the first leg is credible.
      player: makeCar('fifa', fifa.x - 400, fifa.y, 0),
      fifaCar: null, // the FIFA car when the player is in another vehicle
      traffic: [],
      police: [],
      peds: [],
      props: [],
      debris: [],
      texts: [],
      flash: null,
      dialog: null,
      step: 0,
      dest: null,
      gpsLine: 'VOUS ÊTES PRESQUE ARRIVÉ.',
      gpsAt: 0,
      score: 0,
      mult: 1,
      wanted: 0,
      bustTimer: 0,
      lastInfraction: -10,
      roadblockAt: 0,
      offroad: 0,
      drift: 0,
      wrongWay: 0,
      phones: [],
      mission: null,
      missionsDone: 0,
      missionTimer: 0,
      radio: 0,
      radioLine: 0,
      radioAt: 0,
      ticker: 0,
      painted: false,
      stats: { distance: 0, vehicles: 1, services: 0, forms: 0, arrests: 0, damage: 0, dialogs: 0 },
      pound: null, // fourrière sub-state
      finalStep: 0,
    }
    // Props on sidewalks and terraces
    for (const b of blocks) {
      const isPark = b.kind === 'park'
      for (let i = 0; i < (b.label ? 10 : 6); i++) {
        const side = Math.floor(Math.random() * 4)
        const u = 1 + Math.random() * 4
        const sx = side === 0 ? b.x + u : side === 1 ? b.x + u : side === 2 ? b.x : b.x + 5
        const sy = side === 0 ? b.y : side === 1 ? b.y + 5 : b.y + u
        const kinds = isPark ? ['poubelle', 'velib', 'carton', 'barriere'] : ['plot', 'poubelle', 'parasol', 'table', 'barriere', 'velib', 'carton']
        const kind = kinds[Math.floor(Math.random() * kinds.length)]
        g.props.push({ kind, x: sx * TILE + 4 + Math.random() * 8, y: sy * TILE + 4 + Math.random() * 8, hit: false })
      }
    }
    // Pedestrians
    for (let i = 0; i < 60; i++) {
      const b = blocks[Math.floor(Math.random() * blocks.length)]
      const side = Math.floor(Math.random() * 4)
      const u = Math.random() * 6
      const x = side < 2 ? b.x + u : side === 2 ? b.x : b.x + 5.9
      const y = side < 2 ? (side === 0 ? b.y : b.y + 5.9) : b.y + u
      g.peds.push({ x: x * TILE + 8, y: y * TILE + 8, vx: 0, vy: 0, flee: 0, dir: Math.random() * 6.28, shirt: CIVIL_COLOURS[i % CIVIL_COLOURS.length], knocked: 0 })
    }
    // Traffic
    for (let i = 0; i < 26; i++) spawnTraffic(g)
    // Phones
    for (const [label, dx] of [['FIFA', -40], ['FFF', 40], ['PARC AUTO', 40]]) {
      const f = frontOf(label)
      g.phones.push({ x: f.x + dx, y: f.y - 20, used: false, ring: 0 })
    }
    return g
  }

  function spawnTraffic(g, near) {
    const candidates = []
    for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) if (map[y][x] === 'R' && !(x % 8 < 2 && y % 8 < 2)) candidates.push([x, y])
    for (let tries = 0; tries < 20; tries++) {
      const [tx, ty] = candidates[Math.floor(Math.random() * candidates.length)]
      const px = tx * TILE + 8
      const py = ty * TILE + 8
      if (near && Math.hypot(px - near.x, py - near.y) < 120) continue
      const horizontal = ty % 8 < 2
      let dir
      if (horizontal) dir = roadDir[ty][tx] === 'W' ? 'W' : roadDir[ty][tx] === 'E' ? 'E' : ty % 8 === 1 ? 'E' : 'W'
      else dir = tx % 8 === 0 ? 'S' : 'N'
      const type = Math.random() < 0.12 ? 'bus' : Math.random() < 0.2 ? 'van' : Math.random() < 0.3 ? 'taxi' : 'civil'
      const car = makeCar(type, px, py, dir === 'E' ? 0 : dir === 'W' ? Math.PI : dir === 'S' ? Math.PI / 2 : -Math.PI / 2)
      car.dir = dir
      car.speed = 0
      car.honk = 0
      g.traffic.push(car)
      return
    }
  }

  /* ---------- helpers ---------- */
  const DIRS = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }
  const dirAngle = { E: 0, W: Math.PI, N: -Math.PI / 2, S: Math.PI / 2 }
  const distTo = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  function say(text, colour = P.yellow) {
    G.flash = { text, colour, until: G.t + 1.4 }
  }
  function gps(text) {
    G.gpsLine = text
    G.gpsAt = G.t
  }
  function popText(x, y, text, colour = P.white) {
    G.texts.push({ x, y, text, colour, until: G.t + 1.1 })
  }
  function addScore(points, label, x, y) {
    const value = Math.round(points * G.mult)
    G.score += value
    if (label) popText(x ?? G.player.x, (y ?? G.player.y) - 12, `${label} +${value}`, P.yellow)
  }
  function infraction(amount) {
    G.wanted = Math.min(100, G.wanted + amount)
    G.lastInfraction = G.t
  }
  const stars = () => (G.wanted >= 95 ? 4 : G.wanted >= 70 ? 3 : G.wanted >= 40 ? 2 : G.wanted >= 12 ? 1 : 0)

  function openDialog(lines, onClose, title) {
    G.dialog = { lines, onClose, title: title ?? null }
    G.stats.dialogs++
    setPhase('dialog')
  }
  function closeDialog() {
    const d = G.dialog
    G.dialog = null
    if (phase === 'dialog') setPhase('playing')
    d.onClose?.()
  }

  function setDestination(label, name) {
    G.dest = { ...frontOf(label), label, name }
    gps('VOUS ÊTES PRESQUE ARRIVÉ.')
    audio.chime()
  }

  function startChain() {
    G.step = 0
    setDestination(CHAIN[0].dest, CHAIN[0].name)
  }

  function nextStep() {
    G.step++
    const s = CHAIN[G.step]
    setDestination(s.dest, s.name)
    G.stats.services++
  }

  /* ---------- arrivals ---------- */
  function onArrive() {
    const s = CHAIN[G.step]
    G.dest = null
    audio.jingle()
    if (s.final) {
      finalSequence()
      return
    }
    say('DESTINATION ATTEINTE', P.green)
    const go = () => {
      if (s.interphone) {
        openDialog(['Portail fermé. Interphone.', '', '[E] Sonner'], () => {
          audio.error()
          openDialog(s.arrive, afterArrive, s.name)
        }, s.name)
      } else {
        audio.error()
        openDialog(s.arrive, afterArrive, s.name)
      }
    }
    const afterArrive = () => {
      say(s.flash, P.red)
      addScore(s.points, s.points >= 5000 ? 'MAUVAIS SERVICE' : 'PROCÉDURE ADMINISTRATIVE')
      G.stats.forms++
      nextStep()
      gps('DESTINATION MODIFIÉE.')
      setTimeout(() => G && gps('VOUS ÊTES PRESQUE ARRIVÉ.'), 1800)
    }
    setTimeout(go, 700)
  }

  function finalSequence() {
    G.finalStep = 1
    audio.radio(null)
    say('VÉHICULE RESTITUÉ.', P.green)
    setTimeout(() => {
      openDialog(['MISE À JOUR DE L’INVENTAIRE FIFA...', '', '...', '...'], () => {
        audio.error()
        openDialog(['ERREUR', '', 'AUCUN VÉHICULE MANQUANT', 'N’EST ENREGISTRÉ.', '', 'Souhaitez-vous récupérer', 'votre véhicule ?', '', '[E] OUI'], () => {
          addScore(10000, 'VOITURE TOUJOURS NON RENDUE')
          G.dest = { ...frontOf('GARAGE'), label: 'GARAGE', name: 'GARAGE FIFA' }
          gps('NOUVELLE DESTINATION. VOUS ÊTES PRESQUE ARRIVÉ.')
          audio.chime()
          setTimeout(() => endGame(), 2600)
        }, 'FIFA')
      }, 'FIFA')
    }, 1200)
  }

  function endGame() {
    audio.stop()
    setPhase('over')
    onEnd?.({
      score: G.score,
      details: {
        score: G.score,
        multiplier: G.mult,
        distance: Math.round(G.stats.distance * METRES_PER_PX),
        vehicles: G.stats.vehicles,
        services: G.stats.services,
        forms: G.stats.forms,
        arrests: G.stats.arrests,
        damage: Math.round(G.stats.damage),
        missions: G.missionsDone,
      },
      durationMs: Math.round(G.t * 1000),
    })
  }

  /* ---------- missions and phones ---------- */
  function startMission(index) {
    const m = MISSIONS[index]
    G.mission = { ...m, stepIndex: 0, timeLeft: m.timer ?? 0, target: frontOf(m.steps[0]) }
    openDialog([m.name, '', ...m.brief], () => {
      gps(m.name + ' : ' + m.steps[0])
    }, 'TÉLÉPHONE')
  }
  function missionArrive() {
    const m = G.mission
    m.stepIndex++
    if (m.stepIndex < m.steps.length) {
      m.target = frontOf(m.steps[m.stepIndex])
      audio.chime()
      gps(m.name + ' : ' + m.steps[m.stepIndex])
      return
    }
    G.mission = null
    G.missionsDone++
    G.mult = Math.min(5, G.mult + 1)
    audio.jingle()
    openDialog(m.done, () => {
      addScore(10000, 'MISSION')
      say('BELLE CONDUITE !', P.green)
      gps('VOUS ÊTES PRESQUE ARRIVÉ.')
    }, m.name)
  }
  function missionFail() {
    const m = G.mission
    G.mission = null
    audio.error()
    openDialog(m.fail, () => gps('VOUS ÊTES PRESQUE ARRIVÉ.'), m.name)
  }

  /* ---------- police ---------- */
  function spawnPolice() {
    const p = frontOf('POLICE')
    const car = makeCar('police', p.x + (Math.random() - 0.5) * 40, p.y, 0)
    car.ram = 0
    G.police.push(car)
  }
  function spawnRoadblock() {
    const pl = G.player
    const speed = Math.hypot(pl.vx, pl.vy)
    if (speed < 20) return
    const ux = pl.vx / speed
    const uy = pl.vy / speed
    for (let d = 140; d <= 220; d += 16) {
      const x = pl.x + ux * d
      const y = pl.y + uy * d
      if (tileAt(x, y) === 'R') {
        const perpX = -uy
        const perpY = ux
        for (const o of [-9, 9]) {
          const car = makeCar('police', x + perpX * o, y + perpY * o, Math.atan2(uy, ux) + Math.PI / 2)
          car.block = true
          G.police.push(car)
        }
        say('BARRAGE !', P.red)
        return
      }
    }
  }
  function busted() {
    setPhase('busted')
    audio.siren(false)
    audio.screech(false)
    G.stats.arrests++
    const fine = 1500 + Math.floor(Math.random() * 3000)
    G.stats.damage += fine
    G.mult = Math.max(1, Math.floor(G.mult / 2))
    G.wanted = 0
    G.police = []
    const wasFifa = G.player.type === 'fifa'
    setTimeout(() => {
      openDialog([`AMENDES : ${fine.toLocaleString('fr-FR')} €`, 'MULTIPLICATEUR : ÷2', wasFifa ? 'VÉHICULE FIFA : CONFISQUÉ' : 'VÉHICULE : CONFISQUÉ'], () => {
        openDialog(['BONNE NOUVELLE', '', 'La voiture se trouve désormais', 'à la fourrière.', '', 'VEUILLEZ LA RÉCUPÉRER', 'AVANT RESTITUTION.'], () => {
          // The FIFA car is parked at the pound; the player gets a taxi.
          const pound = frontOf('FOURRIÈRE')
          if (wasFifa || !G.fifaCar) {
            G.fifaCar = makeCar('fifa', pound.x + 30, pound.y - 30, Math.PI / 2)
            G.fifaCar.hp = G.player.type === 'fifa' ? G.player.hp : G.fifaCar.hp
          }
          const here = { x: G.player.x, y: G.player.y }
          G.player = makeCar('taxi', here.x, here.y, G.player.a)
          G.stats.vehicles++
          G.pound = { stage: 'fetch' }
          G.dest = { ...pound, label: 'FOURRIÈRE', name: 'FOURRIÈRE' }
          gps('VOUS ÊTES PRESQUE ARRIVÉ.')
          audio.chime()
          setPhase('playing')
        }, 'IMMOBILISÉ')
      }, 'IMMOBILISÉ !')
    }, 1500)
  }
  function poundArrive() {
    G.dest = null
    if (G.pound.stage === 'fetch') {
      openDialog(['« Vous êtes le propriétaire ? »', '', '[E] FIFA'], () => {
        openDialog(['« Vous représentez la FIFA ? »', '', '[E] NON'], () => {
          audio.error()
          openDialog(['« Dans ce cas nous ne pouvons pas', 'vous rendre le véhicule. »', '', 'MISSION :', 'OBTENIR UNE PROCURATION FIFA.'], () => {
            G.pound.stage = 'proxy'
            G.dest = { ...frontOf('FIFA'), label: 'FIFA', name: 'FIFA - PROCURATIONS' }
            addScore(2500, 'PROCÉDURE ADMINISTRATIVE')
            gps('VOUS ÊTES PRESQUE ARRIVÉ.')
            audio.chime()
          }, 'FOURRIÈRE')
        }, 'FOURRIÈRE')
      }, 'FOURRIÈRE')
    } else if (G.pound.stage === 'proxy') {
      openDialog(['PROCURATION DÉLIVRÉE.', 'CERFA 12B, version 2019.', '', 'Retournez à la fourrière.'], () => {
        G.pound.stage = 'return'
        G.stats.forms++
        addScore(2500, 'PROCÉDURE ADMINISTRATIVE')
        G.dest = { ...frontOf('FOURRIÈRE'), label: 'FOURRIÈRE', name: 'FOURRIÈRE' }
        gps('VOUS ÊTES PRESQUE ARRIVÉ.')
        audio.chime()
      }, 'FIFA')
    } else {
      openDialog(['« Mauvaise version du CERFA. »', '« Mais bon, prenez-la, elle gêne. »', '', 'VÉHICULE FIFA RÉCUPÉRÉ.'], () => {
        const car = G.fifaCar
        G.player = { ...car, vx: 0, vy: 0 }
        G.player.x = G.dest ? G.dest.x : car.x
        G.fifaCar = null
        G.pound = null
        G.stats.vehicles++
        const s = CHAIN[G.step]
        setDestination(s.dest, s.name)
      }, 'FOURRIÈRE')
    }
  }

  /* ---------- car physics ---------- */
  function moveCar(car, dt, throttle, brake, steer, handbrake) {
    const t = CAR_TYPES[car.type]
    const fx = Math.cos(car.a)
    const fy = Math.sin(car.a)
    const forward = car.vx * fx + car.vy * fy
    const speed = Math.hypot(car.vx, car.vy)
    if (throttle) {
      const k = Math.max(0, 1 - forward / t.maxSpeed)
      car.vx += fx * t.accel * k * dt
      car.vy += fy * t.accel * k * dt
    }
    if (brake) {
      if (forward > 5) {
        car.vx -= fx * 220 * dt
        car.vy -= fy * 220 * dt
      } else {
        car.vx -= fx * 50 * dt
        car.vy -= fy * 50 * dt
      }
    }
    const grip = handbrake ? 1.4 : t.grip
    const lx = -fy
    const ly = fx
    const lateral = car.vx * lx + car.vy * ly
    const damp = Math.min(1, grip * dt)
    car.vx -= lx * lateral * damp
    car.vy -= ly * lateral * damp
    if (steer && speed > 4) {
      const factor = Math.min(1, speed / 70) * (handbrake ? 1.5 : 1) * Math.sign(forward || 1)
      car.a += steer * t.turn * factor * dt
    }
    const drag = handbrake ? 2.5 : throttle ? 0.4 : 1.3
    car.vx -= car.vx * Math.min(1, drag * dt)
    car.vy -= car.vy * Math.min(1, drag * dt)
    if (Math.abs(forward) > -40 && forward < -40) {
      car.vx = fx * -40
      car.vy = fy * -40
    }
    // Move with tile collisions, axis by axis
    const corners = (x, y, a) => {
      const cx = Math.cos(a)
      const cy = Math.sin(a)
      const hw = car.w / 2
      const hh = car.h / 2
      return [
        [x + cx * hw - cy * hh, y + cy * hw + cx * hh],
        [x + cx * hw + cy * hh, y + cy * hw - cx * hh],
        [x - cx * hw - cy * hh, y - cy * hw + cx * hh],
        [x - cx * hw + cy * hh, y - cy * hw - cx * hh],
      ]
    }
    const blocked = (x, y) => corners(x, y, car.a).some(([px, py]) => solid(px, py))
    let crashed = 0
    const nx = car.x + car.vx * dt
    if (!blocked(nx, car.y)) car.x = nx
    else {
      crashed = Math.abs(car.vx)
      car.vx *= -0.3
    }
    const ny = car.y + car.vy * dt
    if (!blocked(car.x, ny)) car.y = ny
    else {
      crashed = Math.max(crashed, Math.abs(car.vy))
      car.vy *= -0.3
    }
    car.x = Math.max(4, Math.min(WORLD_W - 4, car.x))
    car.y = Math.max(4, Math.min(WORLD_H - 4, car.y))
    return { crashed, lateral, speed }
  }

  function damage(car, amount) {
    car.hp = Math.max(0, car.hp - amount)
    if (car === G.player) G.stats.damage += amount * 120
  }

  function carsCollide(a, b, dt) {
    const d = distTo(a, b)
    const min = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2 - 2
    if (d >= min || d === 0) return 0
    const nx = (b.x - a.x) / d
    const ny = (b.y - a.y) / d
    const overlap = min - d
    const ma = CAR_TYPES[a.type].mass
    const mb = CAR_TYPES[b.type].mass
    a.x -= nx * overlap * (mb / (ma + mb))
    a.y -= ny * overlap * (mb / (ma + mb))
    b.x += nx * overlap * (ma / (ma + mb))
    b.y += ny * overlap * (ma / (ma + mb))
    const rvx = a.vx - b.vx
    const rvy = a.vy - b.vy
    const impact = rvx * nx + rvy * ny
    if (impact <= 0) return 0
    const j = impact / (1 / ma + 1 / mb)
    a.vx -= (j / ma) * nx * 1.2
    a.vy -= (j / ma) * ny * 1.2
    b.vx += (j / mb) * nx * 1.2
    b.vy += (j / mb) * ny * 1.2
    a.a += (Math.random() - 0.5) * impact * 0.004
    b.a += (Math.random() - 0.5) * impact * 0.004
    return impact
  }

  /* ---------- update ---------- */
  function update(dt) {
    clock += dt
    if (phase === 'title' || phase === 'over' || phase === 'dialog' || phase === 'busted' || phase === 'paint' || phase === 'boom') {
      if (phase === 'paint' && clock - phaseAt > 2.4) finishPaint()
      if (phase === 'boom' && clock - phaseAt > 1.6) finishBoom()
      return
    }
    G.t += dt
    const pl = G.player
    const up = keys.ArrowUp || keys.KeyW
    const down = keys.ArrowDown || keys.KeyS
    const left = keys.ArrowLeft || keys.KeyA
    const right = keys.ArrowRight || keys.KeyD
    const hb = keys.Space
    const before = { x: pl.x, y: pl.y }
    const r = moveCar(pl, dt, up, down, (right ? 1 : 0) - (left ? 1 : 0), hb)
    G.stats.distance += Math.hypot(pl.x - before.x, pl.y - before.y)
    const speedRatio = Math.min(1, r.speed / CAR_TYPES[pl.type].maxSpeed)
    audio.engine(speedRatio, up)
    const drifting = Math.abs(r.lateral) > 45 && r.speed > 70
    audio.screech(drifting || (hb && r.speed > 60))
    if (drifting) {
      G.drift += dt
      if (G.drift > 0.7) {
        G.drift = 0
        addScore(250, 'DRIFT')
      }
    } else G.drift = 0
    if (r.crashed > 50) {
      audio.crash(r.crashed / 200)
      damage(pl, r.crashed * 0.12)
      if (r.crashed > 120) say('GROS DÉGÂTS !', P.red)
      infraction(6)
    }
    // Off-road: sidewalks and parks are shortcuts, and infractions
    const tile = tileAt(pl.x, pl.y)
    if ((tile === 'S' || tile === 'G' || tile === 'T') && r.speed > 30) {
      G.offroad += dt
      infraction(dt * 9)
      if (G.offroad > 1.2) {
        G.offroad = 0
        addScore(500, 'RACCOURCI')
      }
    } else G.offroad = 0
    // Wrong way
    const d = tile === 'R' ? roadDir[Math.floor(pl.y / TILE)][Math.floor(pl.x / TILE)] : null
    if (d && r.speed > 30) {
      const forward = pl.vx * DIRS[d][0] + pl.vy * DIRS[d][1]
      if (forward < -20) {
        G.wrongWay += dt
        if (G.wrongWay > 1) {
          G.wrongWay = 0
          infraction(15)
          say('SENS INTERDIT !', P.red)
        }
      }
    }
    if (r.speed > 150) infraction(dt * 4)
    if (G.t - G.lastInfraction > 4) G.wanted = Math.max(0, G.wanted - dt * 4)

    // Props
    for (const p of G.props) {
      if (p.hit) continue
      const spec = PROPS[p.kind]
      if (Math.abs(p.x - pl.x) < pl.w / 2 + spec.w && Math.abs(p.y - pl.y) < pl.w / 2 + spec.h && r.speed > 25) {
        p.hit = true
        G.debris.push({ x: p.x, y: p.y, vx: pl.vx * 0.8 + (Math.random() - 0.5) * 60, vy: pl.vy * 0.8 + (Math.random() - 0.5) * 60, spin: Math.random() * 10, kind: p.kind, born: G.t })
        addScore(spec.points, spec.label, p.x, p.y)
        audio.clink()
        infraction(3)
        damage(pl, 1)
      }
    }
    for (const dbr of G.debris) {
      dbr.x += dbr.vx * dt
      dbr.y += dbr.vy * dt
      dbr.vx *= 1 - 3 * dt
      dbr.vy *= 1 - 3 * dt
    }
    G.debris = G.debris.filter((dbr) => G.t - dbr.born < 2.5)

    // Pedestrians
    for (const ped of G.peds) {
      const dist = distTo(ped, pl)
      if (ped.knocked > 0) {
        ped.knocked -= dt
        ped.x += ped.vx * dt
        ped.y += ped.vy * dt
        ped.vx *= 1 - 4 * dt
        ped.vy *= 1 - 4 * dt
        continue
      }
      if (dist < 40 && r.speed > 20) {
        ped.flee = 0.8
        const ax = (ped.x - pl.x) / dist
        const ay = (ped.y - pl.y) / dist
        ped.vx = ax * 55
        ped.vy = ay * 55
        if (Math.random() < dt * 2) audio.shout()
      } else if (ped.flee > 0) ped.flee -= dt
      else {
        if (Math.random() < dt * 0.5) ped.dir = Math.random() * 6.28
        ped.vx = Math.cos(ped.dir) * 10
        ped.vy = Math.sin(ped.dir) * 10
      }
      const nx = ped.x + ped.vx * dt
      const ny = ped.y + ped.vy * dt
      const okTile = (x, y) => { const t2 = tileAt(x, y); return t2 === 'S' || t2 === 'G' || t2 === 'T' || (ped.flee > 0 && t2 === 'R') }
      if (okTile(nx, ped.y)) ped.x = nx
      if (okTile(ped.x, ny)) ped.y = ny
      if (dist < pl.w / 2 + 3 && r.speed > 15) {
        ped.knocked = 1.2
        ped.vx = pl.vx * 0.9
        ped.vy = pl.vy * 0.9
        popText(ped.x, ped.y - 10, 'AÏE !', P.red)
        audio.shout()
        infraction(20)
      }
    }

    // Traffic
    for (const car of G.traffic) {
      if (car.stall > 0) {
        car.stall -= dt
        car.vx *= 1 - 3 * dt
        car.vy *= 1 - 3 * dt
        car.x += car.vx * dt
        car.y += car.vy * dt
        if (car.honk > 0) car.honk -= dt
        continue
      }
      const [dx, dy] = DIRS[car.dir]
      // Something ahead? brake.
      const aheadX = car.x + dx * 24
      const aheadY = car.y + dy * 24
      let blockedAhead = Math.hypot(aheadX - pl.x, aheadY - pl.y) < 16
      for (const other of G.traffic) if (other !== car && Math.hypot(aheadX - other.x, aheadY - other.y) < 14) blockedAhead = true
      for (const other of G.police) if (Math.hypot(aheadX - other.x, aheadY - other.y) < 14) blockedAhead = true
      const target = blockedAhead ? 0 : CAR_TYPES[car.type].maxSpeed
      car.speed += (target - car.speed) * Math.min(1, 3 * dt)
      if (blockedAhead && Math.hypot(aheadX - pl.x, aheadY - pl.y) < 16 && car.honk <= 0) {
        car.honk = 2
        audio.horn()
      }
      if (car.honk > 0) car.honk -= dt
      // Advance along the lane; at tile centres choose where to go.
      car.x += dx * car.speed * dt
      car.y += dy * car.speed * dt
      const cx = Math.floor(car.x / TILE)
      const cy = Math.floor(car.y / TILE)
      const centreX = cx * TILE + 8
      const centreY = cy * TILE + 8
      const passed = dx ? (dx > 0 ? car.x >= centreX : car.x <= centreX) : dy > 0 ? car.y >= centreY : car.y <= centreY
      if (passed && !car.decidedAt?.[0] === cx && car.decidedAt?.[1] === cy) { /* noop */ }
      if (passed && (!car.decided || car.decided[0] !== cx || car.decided[1] !== cy)) {
        car.decided = [cx, cy]
        const ahead = map[cy + dy * 2]?.[cx + dx * 2]
        const options = []
        for (const nd of ['E', 'W', 'N', 'S']) {
          if (nd === car.dir) continue
          const [ox, oy] = DIRS[nd]
          if ((ox === -dx && oy === -dy)) continue
          const t2 = map[cy + oy * 2]?.[cx + ox * 2]
          const t1 = map[cy + oy]?.[cx + ox]
          const lane = roadDir[cy + oy]?.[cx + ox]
          if (t1 === 'R' && t2 === 'R' && (!lane || lane === nd)) options.push(nd)
        }
        const currentLane = roadDir[cy]?.[cx]
        const mustTurn = ahead !== 'R' || (currentLane && currentLane !== car.dir)
        if (options.length && (mustTurn || Math.random() < 0.18)) {
          car.dir = options[Math.floor(Math.random() * options.length)]
          car.a = dirAngle[car.dir]
          car.x = centreX
          car.y = centreY
        } else if (mustTurn) {
          car.dir = { E: 'W', W: 'E', N: 'S', S: 'N' }[car.dir]
          car.a = dirAngle[car.dir]
        }
        // Keep to the right-hand lane of the two-tile road
        const [ndx, ndy] = DIRS[car.dir]
        if (ndx) car.y = (cy - (cy % 8)) * TILE + (ndx > 0 ? 24 : 8)
        else car.x = (cx - (cx % 8)) * TILE + (ndy > 0 ? 8 : 24)
        if (car.y % 8 === 0) car.y += 0
      }
      car.vx = dx * car.speed
      car.vy = dy * car.speed
      if (car.x < 8 || car.x > WORLD_W - 8 || car.y < 8 || car.y > WORLD_H - 8) {
        car.dir = { E: 'W', W: 'E', N: 'S', S: 'N' }[car.dir]
        car.a = dirAngle[car.dir]
      }
      // Player collision
      const impact = carsCollide(pl, car, dt)
      if (impact > 30) {
        car.stall = 3 + Math.random() * 3
        car.honk = 1
        audio.crash(impact / 200)
        audio.horn()
        damage(pl, impact * 0.08)
        infraction(12)
        addScore(0)
        if (impact > 90) say('GROS DÉGÂTS !', P.red)
      }
    }
    if (G.traffic.length < 26 && Math.random() < dt * 0.5) spawnTraffic(G, pl)

    // Police
    const level = stars()
    const wanted = level > 0
    audio.siren(wanted)
    const want = [0, 1, 2, 3, 5][level]
    const chasers = G.police.filter((c) => !c.block)
    if (chasers.length < want && Math.random() < dt * 1.5) spawnPolice()
    if (level === 0 && G.police.length) G.police = []
    if (level === 4 && G.t - G.roadblockAt > 8) {
      G.roadblockAt = G.t
      spawnRoadblock()
    }
    let near = false
    for (const cop of G.police) {
      if (cop.block) {
        cop.vx = 0
        cop.vy = 0
      } else {
        const lead = level >= 3 ? 0.5 : 0
        const tx = pl.x + pl.vx * lead
        const ty = pl.y + pl.vy * lead
        const want2 = Math.atan2(ty - cop.y, tx - cop.x)
        let diff = want2 - cop.a
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        const steer = Math.max(-1, Math.min(1, diff * 2))
        const dist = distTo(cop, pl)
        const throttle = dist > 18 || level >= 3
        const res = moveCar(cop, dt, throttle, false, steer, false)
        // Police are slightly slower than the FIFA car below three stars, faster above.
        const cap = CAR_TYPES.fifa.maxSpeed * (level >= 3 ? 1.02 : 0.9)
        if (res.speed > cap) {
          cop.vx *= cap / res.speed
          cop.vy *= cap / res.speed
        }
      }
      const impact = carsCollide(pl, cop, dt)
      if (impact > 30) {
        audio.crash(impact / 200)
        damage(pl, impact * 0.06)
      }
      if (distTo(cop, pl) < 26) near = true
    }
    for (let i = 0; i < G.police.length; i++) for (let j = i + 1; j < G.police.length; j++) carsCollide(G.police[i], G.police[j], dt)
    for (const cop of G.police) for (const car of G.traffic) { const imp = carsCollide(cop, car, dt); if (imp > 30) car.stall = 3 }
    if (near && r.speed < 18 && wanted) {
      G.bustTimer += dt
      if (G.bustTimer > 1.6) {
        G.bustTimer = 0
        say('IMMOBILISÉ !', P.red)
        busted()
        return
      }
    } else G.bustTimer = Math.max(0, G.bustTimer - dt)

    // Destinations, missions, phones, garage, pound
    if (G.dest && distTo(pl, G.dest) < 20 && r.speed < 40) {
      if (G.pound) poundArrive()
      else onArrive()
      return
    }
    if (G.mission) {
      if (G.mission.timer) {
        G.mission.timeLeft -= dt
        if (G.mission.timeLeft <= 0) {
          missionFail()
          return
        }
      }
      if (distTo(pl, G.mission.target) < 20 && r.speed < 40) {
        missionArrive()
        return
      }
    }
    for (const phone of G.phones) {
      const dist = distTo(pl, phone)
      phone.ring = !phone.used && !G.mission && dist < 90 ? (phone.ring + dt) % 1 : 0
      if (phone.ring > 0 && phone.ring < dt * 1.5) audio.ring()
      if (!phone.used && !G.mission && dist < 22 && r.speed < 20 && keys.KeyE && !keys.eUsed) {
        keys.eUsed = true
        phone.used = true
        startMission(G.phones.indexOf(phone))
        return
      }
    }
    const garage = frontOf('GARAGE')
    if (pl.type === 'fifa' && distTo(pl, garage) < 22 && r.speed < 20 && level > 0 && !G.painted && keys.KeyE && !keys.eUsed) {
      keys.eUsed = true
      setPhase('paint')
      audio.spray()
      return
    }
    if (!keys.KeyE) keys.eUsed = false

    // Damage, smoke, destruction
    if (pl.hp <= 0) {
      setPhase('boom')
      audio.boom()
      audio.screech(false)
      return
    }
    // Radio ticker
    if (G.t - G.radioAt > 7) {
      G.radioAt = G.t
      G.radioLine = (G.radioLine + 1) % RADIO[G.radio].lines.length
      G.ticker = 0
    }
    G.ticker += dt * 40
    G.texts = G.texts.filter((tx) => G.t < tx.until)
    if (G.flash && G.t > G.flash.until) G.flash = null
    if (G.gpsLine !== 'VOUS ÊTES PRESQUE ARRIVÉ.' && G.t - G.gpsAt > 4) G.gpsLine = 'VOUS ÊTES PRESQUE ARRIVÉ.'
    if (G.t > manifest.settings.durationMinutes * 60 && !G.finalStep) {
      // Time's up: skip to the final destination.
      G.step = CHAIN.length - 1
      setDestination('FIFA', CHAIN[G.step].name)
      G.finalStep = -1
    }
  }

  function finishPaint() {
    G.player.colour = '#3a3a3a'
    G.painted = true
    G.wanted = 0
    G.police = []
    G.score = Math.max(0, G.score - 5000)
    say('VÉHICULE NON IDENTIFIÉ', P.green)
    setPhase('playing')
    setTimeout(() => {
      if (!G) return
      G.painted = false
      openDialog(['NOUVEAU VÉHICULE MANQUANT DÉTECTÉ.', '', 'Merci de le ramener.'], () => gps('VOUS ÊTES PRESQUE ARRIVÉ.'), 'FIFA')
    }, 6000)
  }
  function finishBoom() {
    openDialog(['VÉHICULE DÉTRUIT', '', 'FRAIS DE RESTITUTION :', 'À LA CHARGE DU SERVICE CONCERNÉ.'], () => {
      const was = G.player
      G.player = makeCar(was.type === 'fifa' ? 'fifa' : was.type, was.x, was.y, was.a)
      G.stats.vehicles++
      G.police = []
      G.wanted = 0
      gps('VOUS ÊTES PRESQUE ARRIVÉ.')
    }, 'FIFA')
  }

  /* ---------- drawing ---------- */
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  function drawCar(car) {
    ctx.save()
    ctx.translate(Math.round(car.x), Math.round(car.y))
    ctx.rotate(car.a)
    const { w, h } = car
    rect(-w / 2 + 1, -h / 2 + 1, w, h, 'rgba(0,0,0,.3)')
    rect(-w / 2, -h / 2, w, h, car.colour)
    rect(-w / 2 + 3, -h / 2 + 1, w - 10, h - 2, car.type === 'police' ? '#2a4a90' : '#8fb4d8')
    rect(w / 2 - 2, -h / 2, 2, 2, P.yellow)
    rect(w / 2 - 2, h / 2 - 2, 2, 2, P.yellow)
    rect(-w / 2, -h / 2, 1, 2, P.red)
    rect(-w / 2, h / 2 - 2, 1, 2, P.red)
    if (car.type === 'police') rect(-2, -2, 4, 4, Math.floor(clock * 6) % 2 ? P.red : P.blue)
    if (car.type === 'taxi') rect(-2, -2, 4, 3, P.white)
    if (car.type === 'fifa') { rect(-3, -2, 6, 4, car.colour === '#3a3a3a' ? '#3a3a3a' : P.white); if (car.colour !== '#3a3a3a') drawText(ctx, 'F', -1, -5, '#1b3a8c') }
    if (car.hp < 40 && car === G.player) rect(w / 2 - 6, -1, 4, 2, P.dark)
    ctx.restore()
  }
  function drawPed(ped) {
    const x = Math.round(ped.x)
    const y = Math.round(ped.y)
    rect(x - 1, y - 3, 3, 3, ped.shirt)
    rect(x, y - 4, 1, 1, P.skin)
    rect(x - 1, y, 1, 2, P.dark)
    rect(x + 1, y, 1, 2, P.dark)
    if (ped.flee > 0) drawText(ctx, '!', x - 1, y - 14, P.red)
  }
  function drawProp(p) {
    const s = PROPS[p.kind]
    rect(Math.round(p.x - s.w / 2), Math.round(p.y - s.h / 2), s.w, s.h, s.colour)
    if (p.kind === 'parasol') rect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2, P.white)
  }

  function drawWorld() {
    const pl = G.player
    const speed = Math.hypot(pl.vx, pl.vy)
    const zoom = 1.25 - 0.4 * Math.min(1, speed / 160)
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(-Math.round(pl.x), -Math.round(pl.y))
    ctx.drawImage(city, 0, 0)
    for (const p of G.props) if (!p.hit) drawProp(p)
    for (const dbr of G.debris) {
      ctx.save()
      ctx.translate(dbr.x, dbr.y)
      ctx.rotate(dbr.spin * (G.t - dbr.born))
      const s = PROPS[dbr.kind]
      rect(-s.w / 2, -s.h / 2, s.w, s.h, s.colour)
      ctx.restore()
    }
    // Destination zone
    const marker = G.mission ? G.mission.target : G.dest
    if (marker) {
      const pulse = 8 + Math.sin(G.t * 6) * 2
      ctx.strokeStyle = G.mission ? P.green : P.yellow
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const phone of G.phones) {
      rect(phone.x - 2, phone.y - 3, 4, 6, phone.used ? P.dark : '#2a7fff')
      if (phone.ring > 0 && Math.floor(G.t * 8) % 2) drawText(ctx, 'RIIING', phone.x - 10, phone.y - 14, P.yellow)
    }
    for (const ped of G.peds) drawPed(ped)
    for (const car of G.traffic) drawCar(car)
    for (const cop of G.police) drawCar(cop)
    if (G.fifaCar) {
      drawCar(G.fifaCar)
      if (Math.floor(G.t * 2) % 2) drawTextC(ctx, 'VÉHICULE À RENDRE', G.fifaCar.x, G.fifaCar.y - 20, P.yellow)
      rect(G.fifaCar.x - 1, G.fifaCar.y - 12, 2, 4, P.yellow)
    }
    drawCar(pl)
    if (pl.hp < 40) {
      for (let i = 0; i < 3; i++) {
        const age = ((G.t * 2 + i / 3) % 1)
        ctx.globalAlpha = 0.5 - age * 0.5
        rect(pl.x - 2 + Math.sin(G.t * 5 + i) * 3, pl.y - age * 16 - 4, 3 + age * 4, 3 + age * 4, P.grey)
      }
      ctx.globalAlpha = 1
    }
    for (const car of G.traffic) if (car.honk > 0 && Math.floor(G.t * 10) % 2) drawText(ctx, 'TUUUT', car.x - 8, car.y - 14, P.white)
    for (const tx of G.texts) drawTextC(ctx, tx.text, tx.x, tx.y - (1 - (tx.until - G.t) / 1.1) * 10, tx.colour)
    // GPS arrow in the world, above the car
    if (marker) {
      const ang = Math.atan2(marker.y - pl.y, marker.x - pl.x)
      ctx.save()
      ctx.translate(pl.x, pl.y - 16)
      ctx.rotate(ang)
      ctx.fillStyle = G.mission ? P.green : P.yellow
      ctx.beginPath()
      ctx.moveTo(8, 0)
      ctx.lineTo(-4, -5)
      ctx.lineTo(-2, 0)
      ctx.lineTo(-4, 5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  function drawHud() {
    const pl = G.player
    // GPS bar
    rect(0, 0, W, 22, P.ui)
    rect(0, 22, W, 1, P.yellow)
    const marker = G.mission ? G.mission.target : G.dest
    const name = G.mission ? G.mission.name : G.dest ? G.dest.name : 'DESTINATION INCONNUE'
    const dist = marker ? Math.round((distTo(pl, marker) * METRES_PER_PX * GPS_FUDGE) / 10) * 10 : 0
    const distText = dist >= 1000 ? (dist / 1000).toFixed(1).replace('.', ',') + ' KM' : dist + ' M'
    // Big arrow
    if (marker) {
      const ang = Math.atan2(marker.y - pl.y, marker.x - pl.x)
      ctx.save()
      ctx.translate(12, 11)
      ctx.rotate(ang)
      ctx.fillStyle = P.yellow
      ctx.beginPath()
      ctx.moveTo(8, 0)
      ctx.lineTo(-5, -6)
      ctx.lineTo(-2, 0)
      ctx.lineTo(-5, 6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    drawText(ctx, name.slice(0, 30), 26, 2, P.white)
    drawText(ctx, distText, 26, 12, P.yellow)
    drawText(ctx, G.gpsLine, 26 + textWidth(distText) + 8, 12, G.gpsLine.startsWith('VOUS') ? P.green : P.grey)
    // Score and multiplier
    const score = G.score.toLocaleString('fr-FR').replace(/ /g, ' ')
    drawText(ctx, score, W - 4 - textWidth(score), 2, P.white)
    drawText(ctx, 'x' + G.mult, W - 4 - textWidth('x' + G.mult), 12, P.yellow)
    // Wanted stars
    const level = stars()
    for (let i = 0; i < 4; i++) {
      const sx = 200 + i * 7
      const c = i < level ? P.yellow : P.dark
      rect(sx + 2, 3, 1, 5, c)
      rect(sx, 5, 5, 1, c)
      rect(sx + 1, 4, 3, 3, c)
    }
    // Car state
    rect(200, 14, 40, 5, P.dark)
    rect(200, 14, (40 * pl.hp) / 100, 5, pl.hp > 50 ? P.green : pl.hp > 25 ? P.yellow : P.red)
    drawText(ctx, CAR_TYPES[pl.type].label, 244, 12, P.grey)
    if (G.mission?.timer) drawTextC(ctx, Math.ceil(G.mission.timeLeft) + ' S', 160, 26, G.mission.timeLeft < 10 ? P.red : P.white)
    // Flash message
    if (G.flash) {
      ctx.save()
      ctx.translate(W / 2, 60)
      ctx.scale(2, 2)
      drawTextC(ctx, G.flash.text, 1, 1, P.black)
      drawTextC(ctx, G.flash.text, 0, 0, G.flash.colour)
      ctx.restore()
    }
    // Radio ticker
    rect(0, H - 11, W, 11, P.ui)
    const st = RADIO[G.radio]
    drawText(ctx, st.name, 3, H - 10, P.yellow)
    const line = st.lines[G.radioLine]
    ctx.save()
    ctx.beginPath()
    ctx.rect(60, H - 11, W - 60, 11)
    ctx.clip()
    drawText(ctx, line, Math.round(W - G.ticker), H - 10, P.grey)
    ctx.restore()
    // Prompts
    const garage = frontOf('GARAGE')
    if (pl.type === 'fifa' && distTo(pl, garage) < 30 && level > 0) drawTextC(ctx, '[E] REPEINDRE (-5 000)', 160, 150, P.yellow)
    for (const phone of G.phones) if (!phone.used && !G.mission && distTo(pl, phone) < 30) drawTextC(ctx, '[E] RÉPONDRE', 160, 150, P.yellow)
  }

  function drawDialog() {
    const d = G.dialog
    const w = 260
    const h = 20 + d.lines.length * LINE_H + 16
    const x = (W - w) / 2
    const y = (H - h) / 2
    rect(x + 3, y + 3, w, h, 'rgba(0,0,0,.5)')
    rect(x, y, w, h, P.ui)
    rect(x, y, w, 1, P.yellow)
    rect(x, y + h - 1, w, 1, P.yellow)
    rect(x, y, 1, h, P.yellow)
    rect(x + w - 1, y, 1, h, P.yellow)
    if (d.title) drawText(ctx, d.title, x + 8, y + 4, P.yellow)
    d.lines.forEach((line, i) => drawTextC(ctx, line, W / 2, y + 16 + i * LINE_H, P.white))
    if (Math.floor(clock * 2) % 2) drawText(ctx, '[E] OK', x + w - 34, y + h - 11, P.grey)
  }

  function drawTitle() {
    rect(0, 0, W, H, P.black)
    const since = clock - phaseAt
    rect(0, 100, W, 80, P.road)
    rect(0, 70, W, 30, P.sidewalk)
    for (let i = 0; i < W; i += 24) rect(i, 138, 12, 2, P.roadLine)
    const car = { x: 60 + Math.min(since * 90, 200), y: 150, a: 0, w: 20, h: 10, colour: '#161616', type: 'fifa', hp: 100 }
    drawCar(car)
    ctx.save()
    ctx.translate(160, 30)
    ctx.scale(3, 3)
    drawTextC(ctx, 'GRAND THEFT FIFA', 0, 0, P.yellow)
    ctx.restore()
    drawTextC(ctx, 'VOUS ÊTES PRESQUE ARRIVÉ.', 160, 58, P.white)
    drawTextC(ctx, 'FLÈCHES / WASD CONDUIRE   ESPACE FREIN À MAIN', 160, 76, P.dark)
    drawTextC(ctx, 'E INTERAGIR   ENTRÉE RADIO', 160, 86, P.dark)
    if (since > 1 && Math.floor(clock * 1.5) % 2) drawTextC(ctx, 'APPUYEZ SUR E POUR COMMENCER', 160, 115, P.yellow)
    drawTextC(ctx, 'FIFA. FOOTBALL UNITES THE WORLD.', 160, 168, P.dark)
  }

  function drawOver() {
    rect(0, 0, W, H, P.black)
    const s = G.stats
    const since = clock - phaseAt
    const lines = [
      ['GRAND THEFT FIFA', P.yellow],
      ['MISSION ACCOMPLIE*', P.white],
      ['*ADMINISTRATIVEMENT NON CONFIRMÉE', P.dark],
      ['', P.white],
      [`DISTANCE PARCOURUE : ${(s.distance * METRES_PER_PX / 1000).toFixed(1).replace('.', ',')} KM`, P.grey],
      ['DISTANCE INITIALE : 1,2 KM', P.grey],
      [`VÉHICULES UTILISÉS : ${s.vehicles}`, P.grey],
      [`SERVICES CONTACTÉS : ${s.services + s.dialogs}`, P.grey],
      [`FORMULAIRES : ${s.forms}`, P.grey],
      [`ARRESTATIONS : ${s.arrests}`, P.grey],
      [`DÉGÂTS : ${Math.round(s.damage).toLocaleString('fr-FR').replace(/ /g, ' ')} €`, P.grey],
      ['VOITURE RENDUE : PEUT-ÊTRE', P.grey],
      ['', P.white],
      [`SCORE : ${G.score.toLocaleString('fr-FR').replace(/ /g, ' ')}`, P.yellow],
    ]
    lines.forEach(([text, colour], i) => {
      if (since > 0.4 + i * 0.2) drawTextC(ctx, text, 160, 8 + i * 10, colour)
    })
    if (since > 4 && Math.floor(clock * 1.5) % 2) drawTextC(ctx, '[E] RECOMMENCER', 160, 160, P.white)
  }

  function draw() {
    if (phase === 'title') return drawTitle()
    if (phase === 'over') return drawOver()
    drawWorld()
    drawHud()
    if (phase === 'paint') {
      const since = clock - phaseAt
      rect(0, 0, W, H, P.black)
      if (since > 0.5) drawTextC(ctx, 'PSSSHHHHHT', 160, 80, P.grey)
      if (since > 1.5) drawTextC(ctx, 'PSSSHHHT', 160, 95, P.grey)
    }
    if (phase === 'boom') {
      const since = clock - phaseAt
      if (since < 0.3) rect(0, 0, W, H, P.white)
      else rect(0, 0, W, H, P.black)
      if (since > 0.6) {
        ctx.save()
        ctx.translate(160, 80)
        ctx.scale(2, 2)
        drawTextC(ctx, 'BOUM.', 0, 0, P.red)
        ctx.restore()
      }
    }
    if (phase === 'busted' && !G.dialog) {
      rect(0, 0, W, H, 'rgba(0,0,0,.4)')
      ctx.save()
      ctx.translate(160, 80)
      ctx.scale(3, 3)
      drawTextC(ctx, 'IMMOBILISÉ !', 1, 1, P.black)
      drawTextC(ctx, 'IMMOBILISÉ !', 0, 0, P.red)
      ctx.restore()
    }
    if (G.dialog) drawDialog()
  }

  function frame(now) {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - lastFrame) / 1000)
    lastFrame = now
    update(dt)
    draw()
  }

  /* ---------- input ---------- */
  function input(action, payload) {
    if (destroyed) return
    if (action !== 'key') return
    const { code, down } = payload
    keys[code] = down
    if (!down) return
    if (code === 'KeyE') {
      if (phase === 'title' && clock - phaseAt > 0.5) {
        audio.resume()
        G = newGame()
        startChain()
        audio.radio(RADIO[0].name)
        setPhase('playing')
        say('OBJECTIF : RENDRE LE VÉHICULE.', P.white)
      } else if (phase === 'dialog' && clock - phaseAt > 0.25) {
        closeDialog()
      } else if (phase === 'over' && clock - phaseAt > 4) {
        G = null
        setPhase('title')
      }
    }
    if (code === 'Enter' && G && (phase === 'playing' || phase === 'dialog')) {
      G.radio = (G.radio + 1) % RADIO.length
      G.radioLine = 0
      G.ticker = 0
      audio.radio(RADIO[G.radio].name)
    }
  }

  let pausedPhase = null
  function pause() {
    if (pausedPhase || phase === 'title' || phase === 'over') return
    pausedPhase = phase
    cancelAnimationFrame(raf)
    audio.stop()
    rect(0, 0, W, H, 'rgba(0,0,0,.5)')
    drawTextC(ctx, 'PAUSE', 160, 84, P.white)
  }
  function resume() {
    if (!pausedPhase) return
    pausedPhase = null
    if (G) audio.radio(RADIO[G.radio].name)
    lastFrame = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function onVisibility() {
    if (document.hidden) pause()
  }
  document.addEventListener('visibilitychange', onVisibility)

  async function start() {
    await audio.resume()
  }
  function stop() {
    audio.stop()
    G = null
    setPhase('title')
  }
  function destroy() {
    destroyed = true
    cancelAnimationFrame(raf)
    audio.stop()
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
    unlock: () => audio.resume(),
    get state() {
      return pausedPhase ? 'paused' : phase === 'title' ? 'idle' : phase === 'over' ? 'over' : 'playing'
    },
  }
}

/** Server side: a result is plausible when its counters fit in a ten-minute game. */
export function validate(result) {
  if (!result || typeof result !== 'object') return false
  const d = result.details
  const values = [result.score, d?.distance, d?.vehicles, d?.services, d?.forms, d?.arrests, d?.missions]
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false
  if (d.missions > 3 || d.vehicles > 20 || d.multiplier > 5 || d.multiplier < 1) return false
  if (result.durationMs > 16 * 60 * 1000) return false
  // Points come from a bounded set of events; this is the ceiling of an absurd run.
  return result.score <= 2_000_000
}

export function grade(result) {
  const s = result.score
  return s >= 400_000 ? 'S' : s >= 200_000 ? 'A' : s >= 100_000 ? 'B' : s >= 40_000 ? 'C' : 'D'
}
