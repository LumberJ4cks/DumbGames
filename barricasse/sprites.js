/*
 * BARRICASSE v2 — sprites. Everything is drawn in code, at 1:1 (every pixel the same size on
 * screen), from one 32-colour palette (Endesga 32). Each material has a 3–5 tone ramp; volumes
 * are shaded with a single light from the top left, with ordered dithering on curved surfaces
 * and a selective outline: dark ink on the bottom-right edges, a darker tone of the material
 * on the top-left ones. Objects are drawn at their gameplay size, so a sprite's opaque bounds
 * are its hitbox (see test/sprite-bounds.js).
 */
;(function () {
  'use strict'

  /* ---------- palette ---------- */
  const C = {
    rust: '#be4a2f', tan: '#d77643', cream: '#ead4aa', sand: '#e4a672', brownL: '#b86f50', brown: '#733e39', brownD: '#3e2731',
    redD: '#a22633', red: '#e43b44', orange: '#f77622', amber: '#feae34', yellow: '#fee761',
    green: '#63c74d', greenM: '#3e8948', greenD: '#265c42', teal: '#193c3e',
    blueD: '#124e89', blue: '#0099db', cyan: '#2ce8f5',
    white: '#ffffff', grey1: '#c0cbdc', grey2: '#8b9bb4', grey3: '#5a6988', slate: '#3a4466', slateD: '#262b44', ink: '#181425',
    hot: '#ff0044', purple: '#68386c', magenta: '#b55088', pink: '#f6757a', skinL: '#e8b796', skin: '#c28569',
  }
  // Ramps, dark → light.
  const R = {
    wood: [C.brownD, C.brown, C.brownL, C.sand, C.cream],
    woodD: [C.ink, C.brownD, C.brown, C.brownL, C.sand],
    red: [C.brownD, C.redD, C.red, C.pink],
    orange: [C.brown, C.rust, C.orange, C.amber],
    gold: [C.brown, C.rust, C.orange, C.amber, C.yellow],
    yellow: [C.rust, C.orange, C.amber, C.yellow],
    green: [C.teal, C.greenD, C.greenM, C.green],
    blue: [C.slateD, C.blueD, C.blue, C.cyan],
    steel: [C.ink, C.slateD, C.slate, C.grey3, C.grey2, C.grey1, C.white],
    white: [C.grey3, C.grey2, C.grey1, C.white],
    pink: [C.purple, C.magenta, C.pink, C.skinL],
    navy: [C.ink, C.slateD, C.slate, C.grey3],
    card: [C.brown, C.brownL, C.sand, C.cream],
    cheese: [C.rust, C.orange, C.amber, C.yellow],
    rind: [C.brown, C.rust, C.tan, C.sand],
    lampGreen: [C.ink, C.teal, C.greenD, C.greenM],
    sausage: [C.brownD, C.brown, C.rust, C.tan],
    icing: [C.grey2, C.grey1, C.cream, C.white],
    terra: [C.brownD, C.brown, C.rust, C.tan],
    glass: [C.slateD, C.blueD, C.blue, C.cyan, C.white],
  }
  const OUT = C.ink
  // One step darker inside the palette, for selective outlines and shading.
  const DARKER = {
    [C.cream]: C.sand, [C.sand]: C.brownL, [C.brownL]: C.brown, [C.brown]: C.brownD, [C.brownD]: C.ink,
    [C.tan]: C.rust, [C.rust]: C.brown, [C.redD]: C.brownD, [C.red]: C.redD, [C.pink]: C.magenta,
    [C.orange]: C.rust, [C.amber]: C.orange, [C.yellow]: C.amber, [C.green]: C.greenM, [C.greenM]: C.greenD,
    [C.greenD]: C.teal, [C.teal]: C.ink, [C.cyan]: C.blue, [C.blue]: C.blueD, [C.blueD]: C.slateD,
    [C.white]: C.grey1, [C.grey1]: C.grey2, [C.grey2]: C.grey3, [C.grey3]: C.slate, [C.slate]: C.slateD,
    [C.slateD]: C.ink, [C.ink]: C.ink, [C.hot]: C.redD, [C.purple]: C.brownD, [C.magenta]: C.purple,
    [C.skinL]: C.skin, [C.skin]: C.brownL,
  }
  const darker = (c, n = 1) => {
    for (let i = 0; i < n; i++) c = DARKER[c] || c
    return c
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16)
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)]
  const L = (() => {
    const v = [-0.5, -0.65, 0.57]
    const n = Math.hypot(...v)
    return v.map((k) => k / n)
  })()
  /** Tone from a ramp; dithering only in a narrow band between two tones, so surfaces stay clean. */
  const pickRamp = (ramp, v, x, y) => {
    let i = Math.floor(v)
    const f = v - i
    if (f > 0.68 || (f > 0.32 && bayer(x, y) < (f - 0.32) / 0.36)) i++
    return ramp[Math.max(0, Math.min(ramp.length - 1, i))]
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  /* ---------- a small pixel buffer with shading tools ---------- */
  class Pix {
    /** `pad` adds an empty border so the outline never gets clipped; drawing coordinates ignore it. */
    constructor(w, h, pad = 0) {
      this.pad = pad
      this.w = w + 2 * pad
      this.h = h + 2 * pad
      this.d = new Array(this.w * this.h).fill(null)
      const self = this
      // Minimal 2D-context stand-in so the pixel fonts can write into the buffer.
      this.ctx = {
        fillStyle: C.ink,
        fillRect(x, y, w2, h2) {
          self.rect(x, y, w2, h2, this.fillStyle)
        },
      }
    }
    px(x, y, c) {
      x = Math.floor(x) + this.pad
      y = Math.floor(y) + this.pad
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
      this.d[y * this.w + x] = c
    }
    get(x, y) {
      x += this.pad
      y += this.pad
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null
      return this.d[y * this.w + x]
    }
    rect(x, y, w, h, c) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c)
    }
    clear(x, y, w, h) {
      this.rect(x, y, w, h, null)
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0)
      y0 = Math.round(y0)
      x1 = Math.round(x1)
      y1 = Math.round(y1)
      const dx = Math.abs(x1 - x0)
      const dy = -Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx + dy
      for (;;) {
        this.px(x0, y0, c)
        if (x0 === x1 && y0 === y1) break
        const e2 = 2 * err
        if (e2 >= dy) {
          err += dy
          x0 += sx
        }
        if (e2 <= dx) {
          err += dx
          y0 += sy
        }
      }
    }
    /** Cuboid seen in 3/4: lit top face (`top` rows), lit left edge, shaded right edge and foot. */
    box(x, y, w, h, ramp, top = 0, m = ramp.length - 2) {
      const c = (i) => ramp[Math.max(0, Math.min(ramp.length - 1, i))]
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          let col
          if (j < top) col = j === 0 ? c(m + 2) : c(m + 1)
          else if (i === w - 1 || j === h - 1) col = c(m - 1)
          else if (i === 0 || j === top) col = c(m + 1)
          else col = c(m)
          this.px(x + i, y + j, col)
        }
      if (w > 2 && h > 2) this.px(x + w - 1, y + h - 1, c(m - 2))
    }
    /** Shaded ellipsoid (sphere-like light), dithered between tones. */
    ell(cx, cy, rx, ry, ramp, bias = 0, only) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx
          const ny = (y + 0.5 - cy) / ry
          const d = nx * nx + ny * ny
          if (d > 1) continue
          if (only && !only(x, y)) continue
          const nz = Math.sqrt(1 - d)
          const I = nx * L[0] + ny * L[1] + nz * L[2]
          const v = Math.max(0, Math.min(1, (I + 0.2) / 1.15)) * (ramp.length - 1) - 0.5 + bias
          this.px(x, y, pickRamp(ramp, v, x, y))
        }
    }
    /** Flat ellipse. */
    disc(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx
          const ny = (y + 0.5 - cy) / ry
          if (nx * nx + ny * ny <= 1) this.px(x, y, c)
        }
    }
    /** Vertical cylinder side, shaded by column. */
    cyl(x, y, w, h, ramp, bias = 0) {
      for (let i = 0; i < w; i++) {
        const nx = (i + 0.5 - w / 2) / (w / 2)
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx))
        const I = nx * L[0] + nz * 0.85
        const v = Math.max(0, Math.min(1, (I + 0.3) / 1.2)) * (ramp.length - 1) - 0.5 + bias
        for (let j = 0; j < h; j++) this.px(x + i, y + j, pickRamp(ramp, j === h - 1 ? v - 1 : v, x + i, y + j))
      }
    }
    /** Two-colour checker, for transparency and soft transitions. */
    dither(x, y, w, h, c1, c2) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, (i + j) & 1 ? c1 : c2)
    }
    /** Tone everything already drawn inside a region one step darker (cast shade). */
    shade(x, y, w, h, steps = 1, mask) {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) {
          const c = this.get(i, j)
          if (c && (!mask || mask(i, j))) this.px(i, j, darker(c, steps))
        }
    }
    text(str, x, y, col) {
      window.PixelFont.drawText(this.ctx, str, x, y, col)
    }
    /** Writes the buffer to a canvas, with a selective outline. */
    toCanvas(outline = true) {
      const { w, h, d } = this
      const out = d.slice()
      if (outline)
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (d[y * w + x]) continue
            const left = x > 0 ? d[y * w + x - 1] : null
            const up = y > 0 ? d[(y - 1) * w + x] : null
            const right = x < w - 1 ? d[y * w + x + 1] : null
            const down = y < h - 1 ? d[(y + 1) * w + x] : null
            if (left || up) out[y * w + x] = OUT
            else if (right || down) out[y * w + x] = darker(right || down, 3)
          }
      const c = makeCanvas(w, h)
      const g = c.getContext('2d')
      const img = g.getImageData(0, 0, w, h)
      for (let i = 0; i < w * h; i++) {
        const col = out[i]
        if (!col) continue
        img.data[i * 4] = parseInt(col.slice(1, 3), 16)
        img.data[i * 4 + 1] = parseInt(col.slice(3, 5), 16)
        img.data[i * 4 + 2] = parseInt(col.slice(5, 7), 16)
        img.data[i * 4 + 3] = 255
      }
      g.putImageData(img, 0, 0)
      return c
    }
  }
  /** Every sprite gets a 1 px border for its outline: the canvas is (w + 2) × (h + 2). */
  function sprite(w, h, draw, outline = true) {
    const p = new Pix(w, h, outline ? 1 : 0)
    draw(p)
    return p.toCanvas(outline)
  }
  const flower = (p, x, y, petal = C.white, heart = C.yellow) => {
    p.px(x - 1, y, petal)
    p.px(x + 1, y, petal)
    p.px(x, y - 1, petal)
    p.px(x, y + 1, petal)
    p.px(x, y, heart)
  }

  /* ---------- the catalogue: [width, height, draw] at 1:1 ---------- */
  const ITEMS = {}
  const FRAMES = {}
  const ANCHORS = {}

  // Garden chair, white moulded plastic.
  function chair(p) {
    p.box(5, 30, 3, 11, R.white, 0, 2)
    p.box(24, 30, 3, 11, R.white, 0, 2)
    p.rect(10, 30, 2, 8, C.grey3)
    p.rect(20, 30, 2, 8, C.grey3)
    p.box(9, 2, 14, 21, R.white, 0, 2)
    p.clear(9, 2, 2, 1)
    p.clear(21, 2, 2, 1)
    p.px(9, 3, null)
    p.px(22, 3, null)
    for (const x of [12, 15, 18]) {
      p.rect(x, 5, 1, 14, C.grey2)
      p.rect(x + 1, 5, 1, 14, C.white)
    }
    p.box(3, 19, 7, 3, R.white, 1, 2)
    p.box(22, 19, 7, 3, R.white, 1, 2)
    p.rect(4, 22, 2, 7, C.grey2)
    p.rect(26, 22, 2, 7, C.grey2)
    p.box(4, 23, 24, 8, R.white, 4, 2)
    p.rect(5, 30, 22, 1, C.grey3)
  }
  ITEMS.chaise = [32, 42, chair]
  FRAMES.chaise = {
    folded: (p) => {
      p.line(6, 40, 26, 22, C.grey2)
      p.line(7, 40, 27, 22, C.grey1)
      p.box(8, 12, 16, 26, R.white, 0, 2)
      for (const y of [16, 20, 24, 28, 32]) p.rect(10, y, 12, 1, C.grey2)
      p.line(6, 22, 26, 40, C.grey3)
    },
  }

  // Wooden pallet.
  ITEMS.palette = [46, 40, (p) => {
    for (const x of [2, 19, 36]) p.box(x, 25, 8, 9, R.wood, 0, 2)
    p.rect(10, 25, 9, 9, C.brownD)
    p.rect(27, 25, 9, 9, C.brownD)
    p.box(1, 33, 44, 5, R.wood, 0, 2)
    for (let k = 0; k < 5; k++) {
      const y = 2 + k * 4
      p.box(1, y, 44, 4, R.wood, 1, 3)
      p.rect(1, y + 3, 44, 1, C.brown)
      for (const x of [4, 22, 40]) p.px(x, y + 1, C.slate)
      p.rect(8 + ((k * 13) % 20), y + 2, 6, 1, C.brownL)
    }
    p.box(1, 22, 44, 4, R.wood, 0, 2)
    for (const x of [4, 22, 40]) p.px(x, 23, C.slate)
    p.rect(12, 23, 7, 1, C.brownL)
  }]

  // Small red city car, side view.
  ITEMS.voiture = [70, 52, (p) => {
    for (let y = 6; y <= 24; y++) {
      const k = (y - 6) / 18
      const x0 = Math.round(24 - 10 * k)
      const x1 = Math.round(46 + 12 * k)
      for (let x = x0; x <= x1; x++) p.px(x, y, y < 8 ? C.pink : x < x0 + 2 ? C.red : x > x1 - 2 ? C.redD : C.red)
    }
    // Windows with a reflection.
    for (let y = 9; y <= 21; y++) {
      const k = (y - 9) / 12
      const x0 = Math.round(25 - 8 * k)
      const x1 = Math.round(45 + 9 * k)
      for (let x = x0; x <= x1; x++) {
        if (Math.abs(x - 35) < 2) continue
        p.px(x, y, x + y < 40 ? C.cyan : x + y > 62 ? C.blueD : C.blue)
      }
    }
    p.line(22, 21, 30, 9, C.white)
    p.line(40, 21, 46, 11, C.grey1)
    // Body.
    p.box(2, 22, 66, 18, R.red, 3, 2)
    p.rect(3, 31, 64, 1, C.redD)
    p.rect(35, 24, 1, 14, C.redD)
    p.rect(20, 24, 1, 14, C.redD)
    p.rect(37, 28, 4, 1, C.brownD)
    p.rect(23, 28, 4, 1, C.brownD)
    p.box(63, 25, 4, 4, R.yellow, 0, 3)
    p.rect(2, 25, 2, 4, C.redD)
    p.px(2, 26, C.hot)
    p.box(1, 36, 68, 4, R.steel, 1, 4)
    // Wheel arches and wheels.
    for (const cx of [16, 53]) {
      p.disc(cx, 40, 10, 9, C.ink)
      p.ell(cx, 41, 8, 8, [C.ink, C.slateD, C.slate, C.grey3])
      p.ell(cx, 41, 4, 4, R.steel, 1)
      p.px(cx, 41, C.slate)
    }
  }]

  // Ironing board.
  function ironingBoard(p) {
    for (let y = 8; y <= 14; y++) {
      const taper = Math.abs(y - 11)
      for (let x = 2 + taper * 2; x <= 41; x++) p.px(x, y, y === 8 ? C.cyan : y === 14 ? C.blueD : C.blue)
    }
    for (const [x, y] of [[8, 10], [14, 12], [20, 10], [26, 12], [32, 10], [38, 12], [11, 13], [29, 9]]) flower(p, x, y, C.white, C.pink)
    p.rect(4, 15, 38, 1, C.grey3)
  }
  ITEMS.planche = [44, 34, (p) => {
    p.line(10, 16, 32, 31, C.grey2)
    p.line(11, 16, 33, 31, C.grey1)
    p.line(32, 16, 10, 31, C.grey3)
    p.line(33, 16, 11, 31, C.grey2)
    p.rect(7, 31, 6, 2, C.ink)
    p.rect(30, 31, 6, 2, C.ink)
    ironingBoard(p)
  }]
  FRAMES.planche = {
    folded: (p) => {
      p.rect(6, 16, 32, 1, C.grey1)
      p.rect(6, 17, 32, 1, C.grey3)
      ironingBoard(p)
    },
  }
  ANCHORS.planche = { iron: [27, 1] }

  // Fridge.
  function fridgeBody(p) {
    p.box(2, 2, 26, 44, R.white, 3, 2)
    p.rect(3, 17, 24, 1, C.grey3)
    p.rect(3, 18, 24, 1, C.white)
    p.box(22, 7, 2, 7, R.steel, 0, 5)
    p.box(22, 21, 2, 14, R.steel, 0, 5)
    p.rect(6, 6, 6, 1, C.grey2)
    p.rect(1, 46, 4, 1, C.ink)
    p.rect(25, 46, 4, 1, C.ink)
  }
  ITEMS.frigo = [30, 48, (p) => {
    fridgeBody(p)
    p.box(7, 22, 3, 3, R.red, 0, 2)
    p.box(12, 26, 3, 3, R.yellow, 0, 2)
    p.box(8, 30, 3, 3, R.green, 0, 2)
    p.box(14, 9, 4, 4, R.blue, 0, 2)
    p.rect(6, 34, 9, 7, C.white)
    p.rect(6, 34, 9, 1, C.grey2)
    p.line(7, 39, 9, 36, C.red)
    p.line(9, 36, 13, 39, C.blue)
  }]
  FRAMES.frigo = {
    open: (p) => {
      p.box(2, 2, 26, 44, R.white, 3, 2)
      p.rect(5, 6, 20, 37, C.cream)
      p.rect(5, 6, 20, 2, C.white)
      for (const y of [16, 26, 35]) p.rect(5, y, 20, 1, C.grey2)
      p.box(7, 9, 4, 7, R.white, 0, 3)
      p.box(13, 11, 3, 5, R.green, 0, 2)
      p.box(18, 12, 5, 4, R.cheese, 0, 2)
      p.box(8, 20, 5, 6, R.pink, 0, 2)
      p.box(16, 21, 6, 5, R.orange, 0, 2)
      p.box(9, 29, 10, 6, R.red, 0, 2)
      p.box(0, 3, 4, 42, R.white, 0, 2)
      p.rect(1, 14, 2, 1, C.grey3)
      p.rect(1, 28, 2, 1, C.grey3)
      p.rect(1, 46, 4, 1, C.ink)
      p.rect(25, 46, 4, 1, C.ink)
    },
  }

  // Floral sofa.
  ITEMS.canape = [70, 52, (p) => {
    p.box(7, 4, 56, 22, R.pink, 0, 2)
    p.clear(7, 4, 2, 1)
    p.clear(61, 4, 2, 1)
    for (const x of [21, 35, 49]) p.rect(x, 8, 1, 16, C.magenta)
    for (const [x, y] of [[14, 11], [28, 15], [42, 11], [56, 15]]) {
      p.px(x, y, C.magenta)
      p.px(x - 1, y - 1, C.skinL)
    }
    p.box(13, 25, 22, 12, R.pink, 4, 2)
    p.box(35, 25, 22, 12, R.pink, 4, 2)
    p.box(1, 15, 13, 28, R.pink, 5, 1)
    p.box(56, 15, 13, 28, R.pink, 5, 1)
    p.box(4, 36, 62, 9, R.pink, 0, 1)
    p.box(6, 45, 4, 5, R.wood, 0, 2)
    p.box(60, 45, 4, 5, R.wood, 0, 2)
    const fl = [[11, 8], [26, 6], [44, 7], [58, 9], [16, 19], [33, 17], [50, 20], [4, 22], [66, 24], [20, 30], [44, 29], [8, 33], [62, 34], [28, 40], [52, 41]]
    for (const [x, y] of fl) {
      flower(p, x, y)
      p.px(x + 2, y + 1, C.greenM)
      p.px(x + 3, y + 1, C.green)
    }
  }]

  // Paris street lamp (dark green cast iron).
  function lamp(p, lit) {
    p.box(8, 38, 12, 6, R.lampGreen, 1, 2)
    p.box(10, 34, 8, 4, R.lampGreen, 0, 2)
    p.cyl(12, 13, 4, 22, R.lampGreen, 0.4)
    p.box(10, 22, 8, 2, R.lampGreen, 0, 2)
    p.box(11, 12, 6, 2, R.lampGreen, 0, 2)
    // Lantern.
    for (let y = 2; y <= 5; y++) p.rect(14 - (y - 1) * 2, y, (y - 1) * 4 + 1, 1, y === 2 ? C.greenM : C.greenD)
    for (let y = 6; y <= 10; y++) {
      const w2 = 12 - (y - 6)
      for (let x = 14 - Math.floor(w2 / 2); x <= 14 + Math.floor(w2 / 2); x++) {
        const bar = x === 14 || x === 14 - Math.floor(w2 / 2) || x === 14 + Math.floor(w2 / 2)
        p.px(x, y, bar ? C.teal : lit ? (Math.abs(x - 13) < 2 && y < 9 ? C.white : y < 8 ? C.yellow : C.amber) : (x + y) % 3 ? C.slate : C.grey3)
      }
    }
    p.rect(10, 11, 9, 1, C.greenD)
  }
  ITEMS.reverbere = [28, 46, (p) => lamp(p, false)]
  FRAMES.reverbere = { lit: (p) => lamp(p, true) }
  ANCHORS.reverbere = { light: [14, 8] }

  // A big fish (mackerel-ish), facing left: blue back, silver flank, white belly.
  ITEMS.poisson = [48, 30, (p) => {
    // Forked tail.
    for (let y = 4; y <= 25; y++) {
      const d = Math.abs(y - 14.5)
      if (d < 2.5) continue
      for (let x = 38 + Math.max(0, Math.round(6 - d)); x <= 46 - Math.max(0, Math.round(d - 9)); x++) p.px(x, y, y < 14 ? (x > 43 ? C.blueD : C.blue) : x > 43 ? C.slateD : C.blueD)
    }
    // Dorsal and belly fins.
    for (let x = 17; x <= 29; x++) for (let y = 4 - Math.floor((29 - x) / 4); y <= 5; y++) p.px(x, y, (x & 1) ? C.blueD : C.blue)
    for (let x = 22; x <= 28; x++) p.px(x, 25 - ((x - 22) >> 1), C.grey2)
    // Body: tone by height, light from the top left.
    const ramp = [C.slateD, C.blueD, C.blue, C.grey2, C.grey1, C.white]
    for (let y = 5; y <= 25; y++)
      for (let x = 2; x <= 40; x++) {
        const nx = (x + 0.5 - 21) / 19
        const ny = (y + 0.5 - 15) / 10
        if (nx * nx + ny * ny > 1) continue
        let v = ny < -0.2 ? 1.6 - nx * 0.6 : ny < 0.25 ? 3.2 - nx * 0.6 : 4.8 - nx * 0.4
        if (nx > 0.75) v -= 0.8
        p.px(x, y, pickRamp(ramp, v, x, y))
      }
    // Mackerel stripes on the back.
    for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) p.px(14 + k * 4 + Math.round(Math.sin(j)), 7 + j, C.slateD)
    // Gill, eye, mouth.
    for (let y = 10; y <= 20; y++) p.px(11 + Math.round(Math.abs(y - 15) / 3), y, C.grey3)
    p.ell(7, 12, 2.6, 2.6, R.white, 1.2)
    p.rect(6, 12, 2, 1, C.ink)
    p.px(6, 11, C.white)
    p.rect(2, 16, 4, 1, C.redD)
    p.px(3, 15, C.grey3)
    for (const [x, y] of [[18, 14], [24, 13], [30, 15], [21, 17], [27, 18]]) p.px(x, y, C.white)
  }]

  // Normandy wardrobe, dark carved oak.
  function wardrobeShell(p) {
    p.box(1, 0, 54, 9, R.wood, 2, 2)
    for (let x = 4; x < 52; x += 4) {
      p.px(x, 5, C.sand)
      p.px(x + 1, 6, C.brown)
    }
    p.box(4, 9, 48, 54, R.woodD, 0, 3)
    p.box(4, 62, 8, 7, R.woodD, 0, 2)
    p.box(44, 62, 8, 7, R.woodD, 0, 2)
  }
  function wardrobeDoor(p, x) {
    p.box(x, 12, 21, 48, R.wood, 0, 2)
    p.box(x + 3, 26, 15, 30, R.wood, 0, 1)
    p.box(x + 4, 27, 13, 28, R.wood, 0, 2)
    // Carved basket of flowers on top.
    for (let k = 0; k < 9; k++) p.px(x + 6 + k, 18 + Math.round(Math.sin(k / 1.4)), C.sand)
    p.px(x + 10, 15, C.cream)
    p.px(x + 9, 16, C.sand)
    p.px(x + 11, 16, C.sand)
    p.rect(x + 7, 21, 7, 1, C.brown)
  }
  ITEMS.armoire = [56, 70, (p) => {
    wardrobeShell(p)
    wardrobeDoor(p, 6)
    wardrobeDoor(p, 29)
    p.rect(27, 12, 2, 48, C.brownD)
    p.box(24, 34, 2, 4, R.gold, 0, 3)
    p.box(30, 34, 2, 4, R.gold, 0, 3)
  }]
  FRAMES.armoire = {
    open: (p) => {
      wardrobeShell(p)
      p.rect(7, 12, 42, 48, C.brownD)
      p.rect(7, 16, 42, 1, C.grey2)
      for (const [x, ramp] of [[10, R.blue], [18, R.red], [28, R.green], [37, R.cheese]]) p.box(x, 17, 7, 26, ramp, 0, 1)
      p.box(0, 11, 6, 50, R.wood, 0, 2)
      p.box(50, 11, 6, 50, R.wood, 0, 2)
    },
  }

  // Football: the useless one.
  ITEMS.ballon = [20, 20, (p) => {
    p.ell(10, 10, 8.6, 8.6, [C.grey3, C.grey2, C.grey1, C.white, C.white], 0.4)
    const patch = (cells) => {
      for (const [x, y] of cells) {
        const c = p.get(x, y)
        if (c) p.px(x, y, c === C.white ? C.slate : C.ink)
      }
    }
    patch([[9, 8], [10, 8], [8, 9], [9, 9], [10, 9], [11, 9], [8, 10], [9, 10], [10, 10], [11, 10], [9, 11], [10, 11]])
    patch([[2, 8], [3, 8], [2, 9], [2, 10], [3, 9]])
    patch([[16, 9], [17, 9], [17, 10], [16, 10], [17, 11]])
    patch([[9, 16], [10, 16], [11, 16], [10, 17], [9, 17]])
    patch([[8, 2], [9, 2], [10, 2], [11, 2], [9, 3]])
    patch([[14, 14], [15, 14], [15, 15], [14, 15]])
    for (const [x0, y0, x1, y1] of [[8, 9, 4, 9], [11, 9, 15, 9], [9, 11, 9, 15], [10, 8, 9, 4], [11, 11, 14, 14]]) p.line(x0, y0, x1, y1, C.grey2)
    p.rect(5, 5, 2, 1, C.white)
    p.px(5, 6, C.white)
  }]

  // Clawfoot bathtub, with or without its duck.
  function tub(p, duck) {
    p.box(5, 1, 2, 9, R.steel, 0, 5)
    p.rect(5, 1, 5, 2, C.grey1)
    p.px(9, 3, C.cyan)
    const inTub = (x, y) => (y <= 22 ? x >= 3 && x <= 44 : ((x + 0.5 - 24) / 21) ** 2 + ((y + 0.5 - 22) / 10) ** 2 <= 1)
    for (let y = 10; y <= 32; y++)
      for (let x = 2; x <= 45; x++) {
        if (!inTub(x, y)) continue
        const nx = (x + 0.5 - 24) / 22
        const v = (1 - Math.abs(nx + 0.3)) * 3 - (y > 26 ? 1 : 0)
        p.px(x, y, pickRamp(R.white, v, x, y))
      }
    p.box(1, 8, 46, 4, R.white, 1, 2)
    p.disc(24, 10, 20, 2.2, C.blue)
    p.rect(8, 9, 10, 1, C.cyan)
    for (const x of [7, 37]) p.box(x, 30, 5, 6, R.gold, 0, 3)
    if (duck) {
      p.ell(33, 7, 4, 3, R.yellow)
      p.ell(36, 3, 2.5, 2.5, R.yellow)
      p.rect(38, 3, 2, 1, C.orange)
      p.px(36, 2, C.ink)
    }
  }
  ITEMS.baignoire = [48, 38, (p) => tub(p, true)]
  FRAMES.baignoire = { empty: (p) => tub(p, false) }

  // Office photocopier.
  ITEMS.photocopieuse = [46, 40, (p) => {
    p.box(1, 15, 4, 5, R.white, 1, 2)
    p.rect(0, 16, 5, 1, C.white)
    p.box(4, 9, 38, 27, R.white, 0, 1)
    p.box(3, 3, 40, 7, R.white, 2, 1)
    p.rect(6, 6, 22, 2, C.slateD)
    p.rect(7, 6, 6, 1, C.blue)
    p.box(30, 4, 11, 5, R.steel, 1, 2)
    p.rect(31, 6, 5, 2, C.cyan)
    p.px(38, 6, C.green)
    p.px(39, 7, C.red)
    for (const y of [16, 23, 30]) {
      p.rect(5, y, 36, 1, C.grey3)
      p.box(18, y + 2, 10, 2, R.steel, 0, 4)
    }
    p.box(41, 22, 4, 3, R.white, 1, 3)
    p.rect(5, 36, 3, 2, C.ink)
    p.rect(38, 36, 3, 2, C.ink)
    p.text('XR0', 9, 11, C.grey3)
  }]

  // Garden gnome.
  ITEMS.nain = [16, 26, (p) => {
    for (let y = 1; y <= 9; y++) {
      const hw = Math.floor((y + 1) / 2)
      for (let x = 8 - hw; x <= 7 + hw; x++) p.px(x, y, x < 7 ? C.red : x > 8 ? C.redD : y < 4 ? C.pink : C.red)
    }
    p.box(3, 14, 10, 8, R.blue, 0, 2)
    p.box(1, 15, 3, 5, R.blue, 0, 2)
    p.box(12, 15, 3, 5, R.blue, 0, 2)
    p.ell(8, 11, 3.5, 2.5, [C.brownL, C.skin, C.skinL])
    p.ell(8, 12, 1.4, 1.2, R.pink, 1)
    p.px(6, 10, C.ink)
    p.px(10, 10, C.ink)
    for (let y = 13; y <= 18; y++) {
      const hw = Math.max(1, 4 - Math.floor((y - 13) / 2))
      for (let x = 8 - hw; x < 8 + hw; x++) p.px(x, y, (x + y) & 1 ? C.white : C.grey1)
    }
    p.rect(3, 19, 10, 1, C.brownD)
    p.px(8, 19, C.amber)
    p.box(4, 20, 3, 3, R.green, 0, 2)
    p.box(9, 20, 3, 3, R.green, 0, 2)
    p.box(3, 23, 4, 2, R.wood, 0, 1)
    p.box(9, 23, 4, 2, R.wood, 0, 1)
  }]
  ANCHORS.nain = { hat: [3, 0] }

  // Cheese wheel, a wedge cut out.
  ITEMS.fromage = [44, 34, (p) => {
    p.disc(22, 24, 20, 7, C.rust)
    p.cyl(2, 10, 41, 15, R.rind, 0.2)
    p.ell(22, 24, 20, 7, R.rind, -0.6, (x, y) => y > 24)
    p.disc(22, 10, 20, 7, C.yellow)
    p.ell(22, 10, 20, 7, R.cheese, 0.9)
    // Wedge cut: a slice missing at the front right.
    for (let y = 10; y <= 29; y++)
      for (let x = 22; x <= 43; x++) {
        const inWedge = y >= 10 + (x - 22) * 0.35 && x - 22 <= (y - 8) * 1.4 && y <= 26 + (x - 22) * 0.1
        if (inWedge && p.get(x, y)) p.px(x, y, y < 12 + (x - 22) * 0.35 ? C.amber : (x + y) % 5 === 0 ? C.orange : C.yellow)
      }
    for (const [x, y, r] of [[12, 9, 1.5], [24, 7, 1], [17, 12, 1], [31, 18, 1.5], [36, 21, 1]]) p.disc(x, y, r, r * 0.7, C.orange)
    p.box(8, 16, 8, 5, R.green, 0, 2)
    p.text('AOP', 8, 14, C.cream)
  }]

  // Upright piano.
  ITEMS.piano = [66, 60, (p) => {
    p.box(1, 1, 64, 6, R.woodD, 2, 3)
    p.box(3, 7, 60, 46, R.woodD, 0, 2)
    p.box(9, 10, 48, 14, R.woodD, 0, 3)
    for (let x = 12; x < 54; x += 6) p.px(x, 16, C.brownL)
    p.box(20, 4, 26, 9, R.white, 0, 2)
    for (const y of [7, 9, 11]) p.rect(22, y, 22, 1, C.grey2)
    for (const [x, y] of [[25, 8], [30, 10], [35, 7], [40, 9]]) p.rect(x, y, 2, 2, C.ink)
    p.box(1, 25, 64, 3, R.woodD, 1, 3)
    p.rect(3, 28, 60, 7, C.white)
    for (let x = 3; x < 63; x += 4) p.rect(x, 28, 1, 7, C.grey2)
    for (let x = 3, k = 0; x < 62; x += 4, k++) if (k % 7 !== 2 && k % 7 !== 6) p.rect(x + 2, 28, 3, 4, C.ink)
    p.rect(3, 35, 60, 2, C.brownD)
    p.box(9, 38, 48, 13, R.woodD, 0, 3)
    for (const x of [27, 32, 37]) p.box(x, 52, 3, 3, R.gold, 0, 3)
    p.box(2, 53, 6, 6, R.woodD, 0, 2)
    p.box(58, 53, 6, 6, R.woodD, 0, 2)
    for (const x of [5, 59]) {
      p.box(x, 13, 3, 2, R.gold, 0, 3)
      p.rect(x + 1, 9, 1, 4, C.white)
      p.px(x + 1, 8, C.amber)
    }
  }]

  // Shopping trolley (own outline: the wire mesh must stay see-through).
  function trolley(p, wheels = 2) {
    const mesh = C.grey2
    for (let y = 6; y <= 26; y++) {
      const k = (y - 6) / 20
      const x0 = Math.round(4 + 6 * k)
      const x1 = Math.round(41 - 3 * k)
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === 6 || y === 26
        if (edge) p.px(x, y, y === 6 ? C.grey1 : C.grey2)
        else if (x % 4 === 0 || y % 4 === 2) p.px(x, y, (x + y) % 8 < 4 ? mesh : C.grey3)
      }
    }
    p.rect(4, 5, 38, 1, C.ink)
    p.box(1, 3, 6, 3, R.red, 1, 2)
    p.rect(11, 27, 1, 6, C.grey2)
    p.rect(37, 27, 1, 6, C.grey2)
    p.rect(9, 32, 31, 2, C.grey3)
    p.rect(9, 32, 31, 1, C.grey1)
    const wheel = (cx) => {
      p.disc(cx, 36, 3, 3, C.ink)
      p.px(cx, 36, C.grey2)
    }
    wheel(12)
    if (wheels > 1) wheel(36)
  }
  ITEMS.caddie = [44, 40, (p) => trolley(p, 2), false]
  FRAMES.caddie = { nowheel: (p) => trolley(p, 1) }
  ANCHORS.caddie = { wheel: [36, 36] }

  // Potted plant.
  ITEMS.plante = [22, 26, (p) => {
    p.box(5, 16, 12, 9, R.terra, 0, 2)
    p.box(4, 14, 14, 3, R.terra, 1, 3)
    const leaves = [[11, 6, 3, 5], [6, 9, 4, 2.5], [16, 9, 4, 2.5], [5, 4, 3, 2], [17, 4, 3, 2], [11, 12, 3.5, 2.5], [3, 13, 2.5, 1.8], [19, 13, 2.5, 1.8]]
    for (const [x, y, rx, ry] of leaves) p.ell(x, y, rx, ry, R.green)
    for (const [x, y] of [[11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [6, 9], [16, 9], [11, 12]]) p.px(x, y, C.greenD)
    p.rect(10, 13, 2, 2, C.greenD)
  }]

  // Toilet.
  ITEMS.toilettes = [36, 44, (p) => {
    p.box(7, 2, 22, 15, R.white, 3, 2)
    p.box(16, 3, 4, 2, R.steel, 0, 5)
    p.box(13, 32, 10, 9, R.white, 0, 2)
    p.box(10, 40, 16, 3, R.white, 1, 2)
    p.ell(18, 26, 15, 7, R.white)
    p.disc(18, 23, 14, 5, C.white)
    p.ell(18, 23, 14, 5, R.white, 0.6)
    p.disc(18, 23, 9, 3, C.blueD)
    p.disc(17, 22, 7, 2, C.blue)
    p.rect(13, 21, 4, 1, C.cyan)
    p.rect(16, 17, 4, 2, C.grey2)
  }]

  // Rocking horse.
  ITEMS.cheval = [44, 44, (p) => {
    for (let x = 2; x <= 41; x++) {
      const k = (x - 21.5) / 20
      const y = 36 + Math.round(5 * (1 - k * k))
      p.px(x, y - 1, C.brownL)
      p.px(x, y, C.brown)
      p.px(x, y + 1, C.brownD)
    }
    for (const [x0, x1] of [[10, 9], [15, 15], [27, 28], [32, 34]]) {
      p.line(x0, 25, x1, 38, C.grey1)
      p.line(x0 + 1, 25, x1 + 1, 38, C.grey2)
    }
    p.ell(21, 21, 13, 6.5, R.white)
    for (const [x, y] of [[14, 19], [19, 23], [25, 20], [29, 23], [17, 25]]) p.px(x, y, C.grey2)
    for (let y = 8; y <= 20; y++) p.rect(29 + Math.round((20 - y) * 0.4), y, 6, 1, y < 12 ? C.white : C.grey1)
    p.ell(37, 9, 5.5, 4, R.white)
    p.box(39, 8, 4, 5, R.white, 0, 2)
    p.px(41, 10, C.ink)
    p.px(37, 7, C.ink)
    p.rect(35, 3, 2, 3, C.white)
    for (let y = 5; y <= 18; y++) p.rect(29 + Math.round((18 - y) * 0.4) - 2, y, 2, 1, (y & 1) ? C.red : C.redD)
    p.box(2, 16, 5, 9, R.red, 0, 2)
    p.box(16, 13, 10, 6, R.red, 1, 2)
    p.rect(16, 18, 10, 1, C.amber)
    p.px(21, 21, C.amber)
  }]

  // Drinks vending machine.
  ITEMS.distributeur = [34, 50, (p) => {
    p.box(1, 2, 32, 46, R.red, 3, 2)
    p.box(4, 8, 19, 30, R.glass, 0, 1)
    const cans = [R.red, R.yellow, R.green, R.blue, R.white, R.orange]
    for (let row = 0; row < 4; row++) {
      p.rect(5, 15 + row * 7, 17, 1, C.grey3)
      for (let col = 0; col < 4; col++) p.box(6 + col * 4, 10 + row * 7, 3, 5, cans[(row * 3 + col) % cans.length], 0, 2)
    }
    p.line(6, 34, 17, 10, C.cyan)
    p.box(25, 8, 6, 30, R.red, 0, 1)
    p.box(26, 10, 4, 3, R.blue, 0, 3)
    p.rect(27, 15, 1, 3, C.ink)
    for (const y of [20, 24, 28]) p.box(26, y, 4, 2, R.white, 0, 2)
    p.box(5, 40, 18, 5, R.steel, 0, 1)
    p.rect(6, 41, 16, 1, C.grey2)
    p.rect(4, 4, 18, 2, C.white)
    p.text('COLA', 5, 2, C.red)
    p.rect(2, 48, 4, 1, C.ink)
    p.rect(28, 48, 4, 1, C.ink)
  }]

  // Wedding cake.
  ITEMS.gateau = [40, 44, (p) => {
    p.disc(20, 40, 18, 3, C.grey2)
    p.ell(20, 39, 18, 3, R.steel, 1.5)
    for (const [y, w2, h2] of [[26, 34, 13], [15, 24, 11], [6, 14, 9]]) {
      const x0 = 20 - w2 / 2
      p.cyl(x0, y, w2, h2, R.icing, 0.3)
      p.disc(20, y, w2 / 2, 2, C.white)
      for (let x = x0; x < x0 + w2; x += 3) {
        p.px(x + 1, y + 2, C.pink)
        p.px(x + 1, y + 3, C.magenta)
      }
      for (let x = x0 + 1; x < x0 + w2 - 1; x += 2) p.px(x, y + h2 - 2, (x / 2) % 2 ? C.white : C.grey1)
    }
    for (const [x, y] of [[8, 33], [16, 34], [24, 33], [32, 34], [13, 21], [27, 21], [20, 11]]) {
      p.ell(x, y, 1.6, 1.4, R.pink, 1)
    }
    p.rect(18, 1, 1, 5, C.ink)
    p.px(18, 0, C.skin)
    p.rect(21, 2, 2, 4, C.white)
    p.px(21, 1, C.skin)
  }]

  // Landscape painting on an easel.
  function painting(p, empty) {
    p.line(9, 41, 14, 30, C.brown)
    p.line(36, 41, 31, 30, C.brown)
    p.line(23, 41, 23, 33, C.brownD)
    p.box(1, 1, 44, 33, R.gold, 0, 2)
    p.box(4, 4, 38, 27, R.gold, 0, 1)
    for (const [x, y] of [[2, 2], [42, 2], [2, 31], [42, 31]]) p.box(x, y, 3, 3, R.gold, 0, 4)
    if (empty) {
      p.rect(5, 5, 36, 25, C.brownD)
      p.rect(5, 5, 36, 1, C.ink)
      p.line(10, 8, 23, 5, C.brownL)
      p.line(23, 5, 36, 8, C.brownL)
      return
    }
    for (let y = 5; y < 30; y++) for (let x = 5; x < 41; x++) p.px(x, y, pickRamp([C.blue, C.cyan, C.white], 2.2 - (y - 5) / 8, x, y))
    p.ell(33, 10, 3, 3, R.yellow, 1)
    p.rect(9, 9, 7, 2, C.white)
    p.rect(11, 8, 3, 1, C.white)
    for (let x = 5; x < 41; x++) {
      const h1 = 20 + Math.round(Math.sin(x / 5) * 3)
      const h2 = 24 + Math.round(Math.cos(x / 4) * 2)
      for (let y = h1; y < 30; y++) p.px(x, y, y < h2 ? C.green : C.greenM)
    }
    for (let y = 24; y < 30; y++) p.rect(22 - (y - 24), y, 3 + (y - 24), 1, C.blue)
    p.rect(13, 17, 1, 5, C.brown)
    p.ell(13, 16, 3, 3, R.green)
  }
  ITEMS.tableau = [46, 42, (p) => painting(p, false)]
  FRAMES.tableau = { empty: (p) => painting(p, true) }

  // Pétanque trophy.
  ITEMS.trophee = [18, 24, (p) => {
    p.box(3, 19, 12, 4, R.woodD, 1, 3)
    p.rect(6, 20, 6, 1, C.amber)
    p.box(7, 14, 4, 5, R.gold, 0, 3)
    p.rect(1, 8, 2, 4, C.amber)
    p.rect(15, 8, 2, 4, C.orange)
    p.cyl(3, 7, 12, 7, R.gold, 0.5)
    p.rect(5, 14, 8, 1, C.rust)
    p.ell(9, 4, 3.5, 3.5, R.steel, 1)
    p.rect(6, 4, 7, 1, C.grey3)
  }]

  // Cardboard box marked FRAGILE.
  ITEMS.carton = [42, 36, (p) => {
    p.box(2, 10, 38, 24, R.card, 0, 2)
    for (let y = 4; y <= 10; y++) {
      const k = (10 - y) / 6
      p.rect(2 + Math.round(k * 4), y, 18, 1, y === 4 ? C.cream : C.sand)
      p.rect(21, y, 18 - Math.round(k * 4), 1, y === 4 ? C.cream : C.sand)
    }
    p.rect(20, 4, 1, 7, C.brownL)
    p.rect(18, 10, 5, 24, C.cream)
    p.rect(18, 10, 5, 1, C.sand)
    p.text('FRAGILE', 4, 22, C.red)
    p.box(5, 13, 6, 7, R.white, 0, 3)
    p.rect(6, 14, 4, 2, C.red)
    p.px(7, 16, C.red)
    p.px(8, 16, C.red)
    p.rect(7, 17, 2, 1, C.red)
    p.rect(6, 18, 4, 1, C.red)
    for (const x of [28, 33]) {
      p.rect(x, 14, 1, 6, C.red)
      p.rect(x - 1, 15, 3, 1, C.red)
      p.px(x - 2, 16, C.red)
      p.px(x + 2, 16, C.red)
    }
  }]

  // Kettle barbecue with merguez.
  ITEMS.barbecue = [42, 36, (p) => {
    p.line(10, 22, 5, 34, C.grey3)
    p.line(32, 22, 37, 34, C.grey3)
    p.rect(20, 24, 2, 10, C.slate)
    p.disc(37, 34, 2, 2, C.ink)
    p.rect(10, 28, 22, 1, C.grey3)
    p.ell(21, 12, 18, 12, [C.ink, C.slateD, C.slate, C.grey3], 0, (x, y) => y >= 12)
    p.disc(21, 12, 18, 3, C.slateD)
    for (let x = 5; x < 38; x++) if (x % 3) p.px(x, 12 + (x % 2), (x * 7) % 5 ? C.orange : C.amber)
    p.rect(4, 10, 35, 1, C.grey2)
    for (let x = 6; x < 37; x += 4) p.px(x, 9, C.grey1)
    for (const [x, y] of [[8, 7], [19, 6], [28, 7]]) {
      p.box(x, y, 9, 3, R.sausage, 0, 2)
      p.px(x + 3, y + 1, C.brownD)
      p.px(x + 6, y + 1, C.brownD)
    }
    p.rect(38, 13, 3, 2, C.brown)
  }]

  // Cooler box.
  ITEMS.glaciere = [42, 36, (p) => {
    p.rect(12, 2, 18, 2, C.grey1)
    p.rect(12, 2, 2, 6, C.grey2)
    p.rect(28, 2, 2, 6, C.grey3)
    p.box(3, 14, 36, 19, R.blue, 0, 2)
    p.box(2, 6, 38, 9, R.white, 4, 2)
    p.box(19, 13, 4, 3, R.steel, 0, 4)
    p.box(7, 19, 14, 9, R.white, 0, 2)
    for (const [x, y] of [[11, 22], [16, 24], [13, 25]]) {
      p.px(x, y, C.blue)
      p.px(x - 1, y, C.cyan)
      p.px(x + 1, y, C.cyan)
      p.px(x, y - 1, C.cyan)
      p.px(x, y + 1, C.cyan)
    }
  }]

  // Beach parasol.
  function parasolArt(p, open) {
    p.box(15, 40, 16, 5, R.steel, 1, 2)
    if (open) {
      p.rect(22, 14, 2, 27, C.grey2)
      p.rect(23, 14, 1, 27, C.grey3)
      for (let y = 2; y <= 16; y++) {
        const k = (16 - y) / 14
        const hw = Math.round(22 * Math.sqrt(Math.max(0, 1 - k * k)))
        for (let x = 23 - hw; x <= 22 + hw; x++) {
          const seg = Math.floor(((x - 1) / 46) * 6 + (y - 16) * 0.02)
          const base = seg % 2 ? R.white : R.red
          const nx = (x - 23) / 23
          p.px(x, y, pickRamp(base, 2.4 - Math.abs(nx + 0.4) * 2 - (y > 14 ? 1 : 0), x, y))
        }
      }
      for (let x = 1; x < 46; x += 4) p.px(x, 17, Math.floor(((x - 1) / 46) * 6) % 2 ? C.grey1 : C.redD)
      p.px(23, 1, C.grey2)
    } else {
      p.rect(22, 2, 2, 39, C.grey2)
      for (let y = 4; y <= 24; y++) p.rect(20, y, 6, 1, Math.floor(y / 4) % 2 ? C.white : C.red)
      p.rect(25, 4, 1, 21, C.redD)
      p.px(23, 1, C.grey2)
    }
  }
  ITEMS.parasol = [46, 46, (p) => parasolArt(p, true)]
  FRAMES.parasol = { closed: (p) => parasolArt(p, false) }

  // Giant merguez.
  ITEMS.merguez = [46, 30, (p) => {
    const pts = []
    for (let k = 0; k <= 30; k++) {
      const a = Math.PI * (1.1 + (0.8 * k) / 30)
      pts.push([23 + 19 * Math.cos(a), 27 + 22 * Math.sin(a)])
    }
    for (const [x, y] of pts) p.ell(x, y, 4.5, 4.5, R.sausage, 0.3)
    for (const [x, y] of pts.filter((_, i) => i % 5 === 2)) {
      p.px(x - 1, y - 1, C.brownD)
      p.px(x, y, C.brownD)
      p.px(x + 1, y + 1, C.brownD)
    }
    for (const [x, y] of pts.filter((_, i) => i % 3 === 0 && i > 2 && i < 28)) p.px(x - 2, y - 3, C.sand)
  }]

  /* ---------- small props ejected by the comedy ---------- */
  const PROPS = {
    yaourt: [7, 9, (p) => (p.box(1, 2, 5, 6, R.white, 0, 2), p.rect(1, 1, 5, 1, C.pink), p.rect(2, 4, 3, 2, C.pink))],
    telecommande: [5, 10, (p) => (p.box(1, 1, 3, 8, R.navy, 0, 2), p.px(2, 2, C.red), p.px(2, 4, C.grey1), p.px(2, 6, C.grey1))],
    cintre: [11, 7, (p) => (p.px(5, 1, C.grey1), p.px(5, 2, C.grey2), p.line(5, 2, 1, 5, C.grey1), p.line(5, 2, 9, 5, C.grey2), p.rect(1, 5, 9, 1, C.grey2))],
    canard: [10, 9, (p) => (p.ell(4, 5, 3.5, 2.5, R.yellow), p.ell(6, 2.5, 2, 2, R.yellow), p.rect(8, 2, 2, 1, C.orange), p.px(6, 2, C.ink))],
    feuille_non: [15, 11, (p) => (p.rect(1, 1, 13, 9, C.white), p.rect(1, 9, 13, 1, C.grey1), p.text('NON', 2, 1, C.red))],
    bonnet: [11, 11, (p) => {
      for (let y = 1; y <= 9; y++) {
        const hw = Math.floor((y + 1) / 2)
        for (let x = 5 - hw; x <= 4 + hw; x++) p.px(x, y, x < 4 ? C.red : x > 5 ? C.redD : C.pink)
      }
    }],
    canette: [5, 8, (p) => (p.cyl(1, 1, 3, 6, R.red), p.rect(1, 1, 3, 1, C.grey1))],
    glacon: [6, 6, (p) => (p.box(1, 1, 4, 4, [C.blue, C.cyan, C.white, C.white], 1, 1))],
    planche_bois: [16, 5, (p) => (p.box(1, 1, 14, 3, R.wood, 1, 3), p.px(2, 2, C.slate), p.px(13, 2, C.slate))],
    feuille: [7, 5, (p) => p.ell(3, 2, 2.6, 1.6, R.green)],
    creme: [6, 5, (p) => p.ell(3, 2.5, 2.4, 1.8, R.icing, 1)],
    fer: [11, 8, (p) => {
      for (let y = 4; y <= 6; y++) p.rect(1 + (6 - y), y, 9 - (6 - y), 1, y === 6 ? C.grey1 : C.pink)
      p.rect(3, 1, 5, 1, C.slate)
      p.px(3, 2, C.slate)
      p.px(7, 2, C.slate)
      p.px(4, 5, C.white)
    }],
    roue: [9, 9, (p) => (p.ell(4.5, 4.5, 3.8, 3.8, [C.ink, C.slateD, C.slate]), p.ell(4.5, 4.5, 1.8, 1.8, R.steel, 1))],
    goutte: [4, 5, (p) => (p.px(1, 1, C.cyan), p.rect(1, 2, 2, 2, C.blue), p.px(1, 2, C.cyan))],
    saucisse: [10, 4, (p) => (p.box(1, 1, 8, 2, R.sausage, 0, 2), p.px(3, 1, C.tan))],
    fumee: [8, 8, (p) => p.ell(4, 4, 3.4, 3.2, [C.grey3, C.grey2, C.grey1, C.white], 0.4), false],
    etincelle: [5, 5, (p) => (p.px(2, 0, C.yellow), p.px(2, 4, C.yellow), p.px(0, 2, C.yellow), p.px(4, 2, C.yellow), p.px(2, 2, C.white)), false],
  }

  /* ---------- demonstrators: side view facing the police (left), 16 × 22 ---------- */
  const SKINS = [[C.brownL, C.skin, C.skinL], [C.brown, C.brownL, C.skin], [C.brownD, C.brown, C.brownL], [C.skin, C.skinL, C.cream]]
  const SHIRTS = [R.red, R.blue, R.green, R.yellow, [C.brownD, C.purple, C.magenta], R.pink, [C.teal, C.greenD, C.green], R.white, R.orange, [C.slateD, C.slate, C.grey3]]
  const PANTS = [[C.ink, C.blueD], [C.ink, C.slate], [C.brownD, C.brown], [C.teal, C.greenD], [C.brownD, C.redD]]
  const HAIRS = [[C.ink, C.brownD], [C.brownD, C.brown], [C.rust, C.amber], [C.brown, C.brownL], [C.grey3, C.grey1], [C.ink, C.slateD]]
  function lookFor(index) {
    return {
      skin: SKINS[(index * 7 + 3) % SKINS.length],
      shirt: SHIRTS[(index * 3 + (index >> 3)) % SHIRTS.length],
      pants: PANTS[(index * 11) % PANTS.length],
      hair: HAIRS[(index * 5 + 1) % HAIRS.length],
      style: (index * 13 + 5) % 6,
      hat: [R.red, R.blue, R.yellow, R.green][(index * 3) % 4],
    }
  }
  const BODY = [
    '................',
    '................',
    '.....SSSSs......',
    '....SSSSSSs.....',
    '....SSSSSSs.....',
    '...SESSSSss.....',
    '...SSSSSSss.....',
    '....SSSSss......',
    '.....sSss.......',
    '....TTTTttu.....',
    '...TTTTTTttu....',
    '...TTTTTTttu....',
    '...TTTTTTttu....',
    '...TTTTTTttu....',
    '....TTTTttu.....',
  ]
  const LEGS = {
    stand: ['....PPPPpp......', '....PPP.Ppp.....', '....PPP.Ppp.....', '....PP...pp.....', '...BBB..BBB.....', '................', '................'],
    walkA: ['....PPPPpp......', '...PPP..ppp.....', '..PPP....pp.....', '..PP.....ppp....', '.BBB......BBB...', '................', '................'],
    walkB: ['....PPPPpp......', '.....PPpp.......', '.....PPpp.......', '.....PPpp.......', '....BBBBB.......', '................', '................'],
  }
  const HAIR = {
    0: [[1, 5, 9], [2, 4, 10], [3, 7, 10], [4, 8, 10], [5, 9, 10]],
    1: [[1, 5, 9], [2, 4, 10], [3, 7, 11], [4, 8, 11], [5, 8, 11], [6, 8, 11], [7, 9, 11], [8, 9, 10]],
    2: 'cap',
    3: 'beanie',
    4: [[1, 4, 10], [2, 3, 11], [3, 6, 11], [4, 7, 11], [5, 8, 11], [6, 9, 10]],
    5: [[2, 5, 10], [3, 8, 10], [4, 9, 10]],
  }
  /** frame: 0 idle, 1 bob, 2 walk A, 3 walk B. */
  function person(look, frame, raised) {
    const p = new Pix(16, 22)
    const [s0, s1, s2] = look.skin
    const sh = look.shirt
    const T = sh[sh.length - 2]
    const t = sh[Math.max(0, sh.length - 3)]
    const u = sh[Math.max(0, sh.length - 4)] || darker(t)
    const bob = frame === 1 ? 1 : 0
    const map = { S: s2, s: s1, E: C.ink, T, t, u, P: look.pants[1], p: look.pants[0], B: C.ink }
    BODY.forEach((row, y) => {
      for (let x = 0; x < 16; x++) if (row[x] !== '.') p.px(x, y + bob, map[row[x]])
    })
    p.px(3, 6 + bob, s1)
    const legs = frame === 2 ? LEGS.walkA : frame === 3 ? LEGS.walkB : LEGS.stand
    legs.forEach((row, y) => {
      for (let x = 0; x < 16; x++) if (row[x] !== '.') p.px(x, 15 + y, row[x] === 'B' ? (x % 4 === 0 ? C.slateD : C.ink) : map[row[x]])
    })
    // Arm in front: hanging, or raised to hold the sign.
    if (raised) {
      for (let y = 4; y <= 10; y++) p.px(3, y + bob, y < 7 ? T : t)
      p.px(4, 9 + bob, t)
      p.px(3, 3 + bob, s2)
      p.px(2, 3 + bob, s1)
    } else {
      for (let y = 10; y <= 13; y++) p.px(5, y + bob, t)
      p.px(5, 14 + bob, s1)
    }
    // Hair or headgear.
    const [h0, h1] = look.hair
    const style = HAIR[look.style]
    if (style === 'cap') {
      const [c0, , c2, c3] = look.hat
      p.rect(4, 1 + bob, 7, 2, c2)
      p.rect(5, 1 + bob, 4, 1, c3)
      p.rect(1, 3 + bob, 4, 1, c0)
      p.rect(7, 3 + bob, 4, 1, h0)
    } else if (style === 'beanie') {
      const [c0, c1, c2] = look.hat
      p.rect(4, 1 + bob, 7, 2, c2)
      p.rect(4, 3 + bob, 7, 1, c1)
      p.px(7, 0 + bob, c0)
      p.rect(8, 4 + bob, 3, 1, h0)
    } else
      for (const [y, x0, x1] of style) for (let x = x0; x <= x1; x++) p.px(x, y + bob, x === x0 && y < 3 ? h1 : h0)
    return p.toCanvas()
  }

  /* ---------- signs (decorative, outside every hitbox) ---------- */
  const SIGNS = {
    canape: (p) => {
      p.box(6, 4, 12, 4, R.pink, 0, 2)
      p.box(4, 6, 3, 4, R.pink, 0, 1)
      p.box(17, 6, 3, 4, R.pink, 0, 1)
      p.text('?', 20, 1, C.red)
    },
    frigo: (p) => {
      p.box(5, 2, 6, 9, R.white, 0, 2)
      p.rect(6, 5, 4, 1, C.grey3)
      p.rect(13, 4, 2, 2, C.red)
      p.rect(16, 4, 2, 2, C.red)
      p.rect(13, 5, 5, 2, C.red)
      p.rect(14, 7, 3, 1, C.red)
      p.px(15, 8, C.red)
    },
    non: (p) => p.text('NON', 6, 2, C.red),
    truc: (p) => p.text('?!', 9, 2, C.blueD),
    groupe: (p) => {
      for (const x of [5, 11, 17]) {
        p.rect(x, 3, 3, 3, C.blueD)
        p.rect(x - 1, 6, 5, 4, C.blueD)
      }
    },
    passer: (p) => {
      p.rect(5, 6, 13, 2, C.blueD)
      p.line(14, 3, 18, 7, C.blueD)
      p.line(14, 10, 18, 6, C.blueD)
    },
    bof: (p) => p.text('BOF', 6, 2, C.blueD),
    coeur: (p) => {
      p.rect(8, 3, 3, 2, C.red)
      p.rect(13, 3, 3, 2, C.red)
      p.rect(7, 4, 10, 3, C.red)
      p.rect(9, 7, 6, 1, C.red)
      p.rect(11, 8, 2, 1, C.red)
      p.px(9, 4, C.pink)
    },
  }
  function sign(kind) {
    return sprite(25, 13, (p) => {
      p.box(1, 1, 23, 11, R.card, 0, 3)
      p.rect(2, 2, 21, 9, C.cream)
      SIGNS[kind](p)
    })
  }

  /* ---------- police: side view facing right (towards the crowd), 20 × 23 ---------- */
  const CRS_UPPER = [
    '....................',
    '......kkkkk.........',
    '.....khhkkkk........',
    '....kkhkkkkkk.......',
    '....kkkkkkkVVV......',
    '....KkkkkkVSSv......',
    '....KKkkkkVSsv......',
    '.....KKKKKvvvv......',
    '......nSSn..........',
    '....PPNNNNPP........',
    '...PNNNNNNNNP.......',
    '...nNNWWWWNNNN......',
    '...nNNNNNNNNNN......',
    '...nNNNNNNNNn.......',
    '....nNNNNNNn........',
    '....BBBGBBBB........',
  ]
  const CRS_LEGS = ['....LLLLlLLL........', '....LLL..LLL........', '....LPL..LPL........', '....LLL..LLL........', '....LLL..LLL........', '...OOOO..OOOO.......']
  const CRS_COL = {
    K: C.slateD, k: C.slate, h: C.grey2, V: C.cyan, v: C.blue, S: C.skinL, s: C.skin,
    N: C.slate, n: C.slateD, P: C.grey3, W: C.grey1, B: C.ink, G: C.amber, L: C.slateD, l: C.slate, O: C.ink,
  }
  function crs(frame, eating) {
    return sprite(20, 23, (p) => {
      const bob = frame % 2
      CRS_LEGS.forEach((row, y) => {
        for (let x = 0; x < 20; x++) if (row[x] !== '.') p.px(x, 16 + y, CRS_COL[row[x]])
      })
      CRS_UPPER.forEach((row, y) => {
        for (let x = 0; x < 20; x++) if (row[x] !== '.') p.px(x, y + bob, CRS_COL[row[x]])
      })
      if (eating) {
        // Truce: shield down, a merguez up to the visor.
        p.rect(12, 9 + bob, 2, 3, C.slate)
        p.rect(13, 5 + bob, 2, 5, C.rust)
        p.px(13, 5 + bob, C.tan)
        p.px(14, 9 + bob, C.skinL)
        return
      }
      // Transparent riot shield held in front.
      for (let y = 8; y <= 20; y++)
        for (let x = 14; x <= 17; x++) {
          const frameEdge = x === 14 || x === 17 || y === 8 || y === 20
          p.px(x, y, frameEdge ? (x === 17 || y === 20 ? C.grey2 : C.grey1) : (x + y) & 1 ? C.grey2 : C.slate)
        }
      p.rect(15, 10, 1, 5, C.white)
      p.rect(12, 11 + bob, 2, 2, C.slate)
    })
  }
  /** The ball launcher: an arcade cannon on a cart, facing right, 30 × 22. */
  function launcher() {
    return sprite(30, 22, (p) => {
      p.box(3, 11, 20, 7, R.navy, 1, 2)
      for (let x = 4; x < 22; x += 4) {
        p.rect(x, 15, 2, 2, C.amber)
        p.rect(x + 2, 15, 2, 2, C.ink)
      }
      p.ell(13, 6, 6, 4, [C.ink, C.slateD, C.slate, C.grey3])
      for (const [x, y] of [[11, 4], [14, 5], [12, 6], [16, 4]]) {
        p.px(x, y, C.orange)
        p.px(x, y - 1, C.amber)
      }
      p.cyl(18, 7, 10, 6, R.orange)
      p.rect(27, 7, 2, 6, C.yellow)
      p.rect(19, 7, 8, 1, C.amber)
      for (const cx of [7, 19]) {
        p.disc(cx, 19, 2.5, 2.5, C.ink)
        p.px(cx, 19, C.grey2)
      }
      p.rect(1, 12, 3, 1, C.grey2)
    })
  }

  /* ---------- street (landscape 640 × 360: shops on top, sidewalk below) ---------- */
  function street(rand) {
    const c = makeCanvas(640, 360)
    const g = c.getContext('2d')
    const px = (x, y, w, h, col) => {
      g.fillStyle = col
      g.fillRect(x, y, w, h)
    }
    // Asphalt: two tones, grain, patches and cracks.
    px(0, 0, 640, 360, C.slate)
    for (let i = 0; i < 5200; i++) px((rand() * 640) | 0, 60 + ((rand() * 256) | 0), 1, 1, rand() < 0.6 ? C.slateD : C.grey3)
    for (let i = 0; i < 14; i++) {
      let x = 150 + rand() * 360
      let y = 70 + rand() * 230
      for (let k = 0; k < 18; k++) {
        px(x | 0, y | 0, 1, 1, C.slateD)
        x += rand() < 0.5 ? 1 : 0
        y += rand() < 0.6 ? 1 : -1
      }
    }
    // Shops along the top, under the HUD: sign band, striped awning, window and door.
    const shops = [
      { w: 92, wall: [C.sand, C.cream], awn: [C.red, C.white], name: 'BOULANGERIE' },
      { w: 70, wall: [C.grey2, C.grey1], awn: [C.greenD, C.cream], name: 'TABAC' },
      { w: 86, wall: [C.tan, C.sand], awn: [C.blueD, C.white], name: 'PRESSING' },
      { w: 76, wall: [C.cream, C.white], awn: [C.redD, C.amber], name: 'KEBAB' },
      { w: 96, wall: [C.grey1, C.white], awn: [C.purple, C.pink], name: 'FRIPERIE' },
      { w: 74, wall: [C.sand, C.cream], awn: [C.greenM, C.white], name: 'PHARMACIE' },
      { w: 146, wall: [C.brownL, C.sand], awn: [C.rust, C.cream], name: 'MEUBLES DUPONT' },
    ]
    let sx = 0
    for (const s of shops) {
      px(sx, 0, s.w, 48, s.wall[0])
      px(sx, 24, s.w, 1, s.wall[1])
      px(sx + s.w - 2, 0, 2, 48, darker(s.wall[0]))
      window.PixelFont.drawText(g, s.name, sx + 5, 23, C.ink)
      // Window with reflections and a door.
      px(sx + 4, 40, s.w - 28, 8, C.slateD)
      for (let k = 0; k < s.w - 32; k += 7) px(sx + 6 + k, 41, 2, 1, C.grey3)
      px(sx + s.w - 20, 37, 12, 11, C.brownD)
      px(sx + s.w - 19, 38, 10, 10, C.brown)
      px(sx + s.w - 11, 42, 1, 2, C.amber)
      // Striped awning with a scalloped edge.
      for (let x = 0; x < s.w - 2; x++) {
        const stripe = Math.floor(x / 6) % 2 ? s.awn[1] : s.awn[0]
        px(sx + x, 31, 1, 6, stripe)
        px(sx + x, 31, 1, 1, darker(stripe))
        if (x % 6 < 4) px(sx + x, 37, 1, 1, darker(stripe))
      }
      px(sx, 30, s.w - 2, 1, C.ink)
      sx += s.w
    }
    // Sidewalks with paving.
    const pave = (y0, h) => {
      px(0, y0, 640, h, C.grey2)
      for (let y = y0; y < y0 + h; y += 8)
        for (let x = (y / 8) % 2 ? 0 : 8; x < 640; x += 16) {
          px(x, y, 16, 1, C.grey1)
          px(x, y, 1, 8, C.grey1)
          px(x + 15, y + 1, 1, 7, C.grey3)
          px(x + 1, y + 7, 15, 1, C.grey3)
        }
      for (let i = 0; i < 260; i++) px((rand() * 640) | 0, y0 + ((rand() * h) | 0), 1, 1, rand() < 0.5 ? C.grey3 : C.grey1)
    }
    pave(48, 8)
    pave(320, 40)
    // Curbs.
    for (const [y, d] of [[56, 1], [316, -1]]) {
      px(0, y, 640, 4, C.grey1)
      px(0, d > 0 ? y + 3 : y, 640, 1, C.grey3)
      px(0, d > 0 ? y : y + 3, 640, 1, C.white)
      for (let x = 0; x < 640; x += 24) px(x, y, 1, 4, C.grey3)
    }
    // Worn road markings.
    for (let x = 152; x < 516; x += 36) for (let k = 0; k < 18; k++) if (rand() > 0.18) px(x + k, 187, 1, 2, C.grey1)
    for (let y = 66; y < 310; y += 20) {
      px(528, y, 12, 10, C.grey1)
      px(528, y + 9, 12, 1, C.grey2)
      for (let k = 0; k < 10; k++) px(528 + ((rand() * 12) | 0), y + ((rand() * 10) | 0), 1, 1, C.grey2)
    }
    for (let y = 62; y < 316; y += 3) {
      px(138, y, 1, 1, C.grey3)
      px(520, y, 1, 1, C.grey3)
    }
    // Manhole and drains.
    for (let r = 9; r >= 0; r--) {
      g.fillStyle = r === 9 ? C.ink : r % 3 ? C.slateD : C.grey3
      g.beginPath()
      g.arc(100, 290, r, 0, Math.PI * 2)
      g.fill()
    }
    for (const [x, y] of [[160, 60], [400, 312]]) {
      px(x, y, 12, 4, C.ink)
      for (let k = 1; k < 12; k += 2) px(x + k, y, 1, 4, C.slateD)
    }
    // Bottom sidewalk furniture: trees in grates, bollards, bench, bin, scooter.
    const tree = (x, y) => {
      px(x - 9, y - 3, 18, 8, C.slateD)
      for (let k = -8; k < 9; k += 2) px(x + k, y - 3, 1, 8, C.grey3)
      for (let r = 13; r > 0; r -= 1) {
        g.fillStyle = r > 11 ? C.teal : r > 7 ? C.greenD : r > 3 ? C.greenM : C.green
        g.beginPath()
        g.arc(x - (13 - r) * 0.3, y - 12 - (13 - r) * 0.3, r, 0, Math.PI * 2)
        g.fill()
      }
      px(x - 1, y - 2, 3, 4, C.brown)
    }
    tree(40, 352)
    tree(250, 352)
    tree(560, 352)
    for (const x of [96, 150, 470, 520, 610]) {
      px(x, 330, 4, 10, C.slateD)
      px(x, 330, 2, 10, C.grey3)
      px(x - 1, 329, 6, 2, C.ink)
    }
    px(178, 336, 34, 6, C.brown)
    px(178, 336, 34, 2, C.brownL)
    px(180, 342, 2, 6, C.ink)
    px(208, 342, 2, 6, C.ink)
    px(178, 330, 34, 2, C.brownD)
    px(440, 332, 12, 16, C.greenD)
    px(440, 332, 12, 2, C.greenM)
    px(442, 336, 2, 10, C.green)
    px(416, 344, 14, 2, C.ink)
    px(416, 338, 2, 8, C.slate)
    px(428, 336, 2, 10, C.slate)
    px(426, 335, 6, 2, C.red)
    for (const cx of [417, 430]) px(cx - 2, 346, 4, 3, C.ink)
    // Flyers on the ground near the crowd.
    for (let i = 0; i < 9; i++) {
      const x = 480 + rand() * 40
      const y = 64 + rand() * 248
      px(x | 0, y | 0, 4, 3, rand() < 0.5 ? C.white : C.cream)
      px((x | 0) + 1, (y | 0) + 1, 2, 1, rand() < 0.5 ? C.red : C.blueD)
    }
    return c
  }

  /* ---------- build everything once ---------- */
  function makeItem(id, frame) {
    const [w, h, fn, outline] = ITEMS[id]
    const draw = frame ? FRAMES[id][frame] : fn
    return sprite(w, h, draw, outline !== false)
  }
  function build() {
    const S = { items: {}, frames: {}, props: {}, palette: {}, people: [], signs: {}, crs: [], launcher: null, anchors: ANCHORS, C }
    for (const id of Object.keys(ITEMS)) {
      S.items[id] = makeItem(id)
      S.palette[id] = colours(S.items[id])
    }
    for (const [id, frames] of Object.entries(FRAMES)) {
      S.frames[id] = {}
      for (const f of Object.keys(frames)) S.frames[id][f] = makeItem(id, f)
    }
    for (const [k, [w, h, fn, outline]] of Object.entries(PROPS)) S.props[k] = sprite(w, h, fn, outline !== false)
    for (let i = 0; i < 24; i++) {
      const look = lookFor(i)
      S.people.push({ look: { shirt: look.shirt[2] || look.shirt[1], skin: look.skin[2] }, frames: [0, 1, 2, 3].map((f) => person(look, f, false)), raised: [0, 1, 2, 3].map((f) => person(look, f, true)) })
    }
    for (const k of Object.keys(SIGNS)) S.signs[k] = sign(k)
    S.crs = [crs(0, false), crs(1, false), crs(0, true), crs(1, true)]
    S.launcher = launcher()
    return S
  }
  /** A few representative colours of a sprite, for debris. */
  function colours(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    const seen = {}
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue
      const k = '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
      if (k === OUT) continue
      seen[k] = (seen[k] || 0) + 1
    }
    return Object.entries(seen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map((e) => e[0])
  }
  /** Pixel-art icon: integer downscale (nearest) until it fits. */
  function icon(src, max) {
    const f = Math.max(1, Math.ceil(Math.max(src.width, src.height) / max))
    if (f === 1) return src
    const c = makeCanvas(Math.ceil(src.width / f), Math.ceil(src.height / f))
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = false
    g.drawImage(src, 0, 0, c.width, c.height)
    return c
  }
  /** Generic sprite helper kept for the renderer (ball, shadows). */
  function art(w, h, draw, outline = true) {
    return sprite(w, h, draw, outline)
  }

  window.BarricasseSprites = { build, street, makeCanvas, art, makeItem, icon, Pix, R, C, OUT, ITEMS, ANCHORS }
})()
