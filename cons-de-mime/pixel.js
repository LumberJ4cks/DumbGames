/*
 * Cons de mime ! — pixel toolkit (repris d'Attention à la mousse). One palette for the whole game (Endesga 32), one
 * ramp of 3–5 tones per material, one light from the top left. Sprites are drawn into a small
 * pixel buffer (colours as palette strings, null = transparent) at their real on-screen size,
 * then outlined selectively and turned into canvases once, at start-up.
 *
 * Nothing in here touches the DOM except toCanvas(), so the art can be checked in Node.
 */

/* ---------- palette: Endesga 32 ---------- */
export const PAL = {
  rust: '#be4a2f',
  tan: '#d77643',
  cream: '#ead4aa',
  sand: '#e4a672',
  clay: '#b86f50',
  brown: '#733e39',
  plum: '#3e2731',
  redD: '#a22633',
  red: '#e43b44',
  orange: '#f77622',
  amber: '#feae34',
  yellow: '#fee761',
  green: '#63c74d',
  greenM: '#3e8948',
  greenD: '#265c42',
  teal: '#193c3e',
  blueD: '#124e89',
  blue: '#0099db',
  cyan: '#2ce8f5',
  white: '#ffffff',
  grey1: '#c0cbdc',
  grey2: '#8b9bb4',
  grey3: '#5a6988',
  slate: '#3a4466',
  slateD: '#262b44',
  ink: '#181425',
  hot: '#ff0044',
  purple: '#68386c',
  magenta: '#b55088',
  pink: '#f6757a',
  skinL: '#e8b796',
  skin: '#c28569',
}
export const PALETTE = Object.values(PAL)
const P = PAL

/* ---------- ramps, dark → light, per material ---------- */
export const RAMPS = {
  // Skin.
  skinPale: [P.clay, P.skin, P.skinL, P.cream],
  skinTan: [P.brown, P.clay, P.skin, P.skinL],
  skinDark: [P.plum, P.brown, P.clay, P.skin],
  // Fabric and plastics (helmets, jerseys, prams).
  red: [P.plum, P.redD, P.red, P.pink],
  orange: [P.brown, P.rust, P.orange, P.amber],
  yellow: [P.rust, P.orange, P.amber, P.yellow],
  green: [P.teal, P.greenD, P.greenM, P.green],
  blue: [P.slateD, P.blueD, P.blue, P.cyan],
  purple: [P.plum, P.purple, P.magenta, P.pink],
  pink: [P.purple, P.magenta, P.pink, P.skinL],
  white: [P.grey3, P.grey2, P.grey1, P.white],
  black: [P.ink, P.slateD, P.slate, P.grey3],
  navy: [P.ink, P.slateD, P.slate, P.grey3],
  teal: [P.ink, P.teal, P.greenD, P.greenM],
  // Hair.
  hairBrown: [P.plum, P.brown, P.clay, P.tan],
  hairBlond: [P.clay, P.tan, P.amber, P.yellow],
  hairBlack: [P.ink, P.slateD, P.slate, P.grey3],
  hairGrey: [P.grey3, P.grey2, P.grey1, P.white],
  hairRed: [P.brown, P.rust, P.tan, P.amber],
  // Materials.
  wood: [P.plum, P.brown, P.clay, P.sand, P.cream],
  metal: [P.ink, P.slateD, P.slate, P.grey3, P.grey2, P.grey1, P.white],
  rubber: [P.ink, P.slateD, P.slate],
  wheel: [P.grey3, P.grey2, P.grey1],
  paper: [P.grey2, P.grey1, P.cream, P.white],
  foam: [P.slateD, P.blueD, P.blue, P.cyan],
  foamYellow: [P.rust, P.orange, P.amber, P.yellow],
  vest: [P.greenM, P.green, P.yellow],
  fire: [P.plum, P.redD, P.red, P.pink],
  glass: [P.slateD, P.blueD, P.blue, P.cyan, P.white],
  dog: [P.plum, P.brown, P.clay, P.tan],
  // Scenery (kept softer than the playfield).
  sky: [P.blue, P.cyan, P.grey1],
  cloud: [P.grey2, P.grey1, P.white],
  wall: [P.clay, P.sand, P.cream],
  roof: [P.brown, P.rust, P.tan],
  grass: [P.teal, P.greenD, P.greenM, P.green],
  asphalt: [P.slateD, P.slate, P.grey3, P.grey2],
  window: [P.slateD, P.blueD, P.blue, P.grey1],
}

/** One step darker inside the palette (selective outlines, shading). */
export const DARKER = {
  [P.cream]: P.sand, [P.sand]: P.clay, [P.clay]: P.brown, [P.brown]: P.plum, [P.plum]: P.ink,
  [P.tan]: P.rust, [P.rust]: P.brown, [P.redD]: P.plum, [P.red]: P.redD, [P.pink]: P.magenta,
  [P.orange]: P.rust, [P.amber]: P.orange, [P.yellow]: P.amber, [P.green]: P.greenM, [P.greenM]: P.greenD,
  [P.greenD]: P.teal, [P.teal]: P.ink, [P.cyan]: P.blue, [P.blue]: P.blueD, [P.blueD]: P.slateD,
  [P.white]: P.grey1, [P.grey1]: P.grey2, [P.grey2]: P.grey3, [P.grey3]: P.slate, [P.slate]: P.slateD,
  [P.slateD]: P.ink, [P.ink]: P.ink, [P.hot]: P.redD, [P.purple]: P.plum, [P.magenta]: P.purple,
  [P.skinL]: P.skin, [P.skin]: P.clay,
}
export const darker = (c, n = 1) => {
  for (let i = 0; i < n; i++) c = DARKER[c] || c
  return c
}

/* ---------- light and dithering ---------- */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)]
// Light from the top left, slightly in front.
export const LIGHT = (() => {
  const v = [-0.55, -0.65, 0.52]
  const n = Math.hypot(...v)
  return v.map((k) => k / n)
})()

/**
 * Tone from a ramp for a brightness v in [0, 1]. Ordered dithering only in a narrow band
 * (BAND) around the middle between two tones, never as a full pattern.
 */
const BAND = 0.18
export function shade(ramp, v, x, y) {
  const f = Math.max(0, Math.min(1, v)) * (ramp.length - 1)
  let i = Math.floor(f)
  const t = f - i
  if (t > 0.5 + BAND) i++
  else if (t > 0.5 - BAND && bayer(x, y) < (t - (0.5 - BAND)) / (2 * BAND)) i++
  return ramp[Math.min(ramp.length - 1, i)]
}

/* ---------- the pixel buffer ---------- */
export class Pix {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = new Array(w * h).fill(null)
    // Anchor (e.g. the feet) in buffer coordinates; set by whoever draws the sprite.
    this.ax = 0
    this.ay = 0
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  get(x, y) {
    return this.in(x, y) ? this.data[y * this.w + x] : null
  }
  px(x, y, c) {
    x = Math.round(x)
    y = Math.round(y)
    if (c && this.in(x, y)) this.data[y * this.w + x] = c
    return this
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
    return this
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
    return this
  }
  /** Flat filled circle / ellipse. */
  disc(cx, cy, rx, ry, c) {
    ry = ry ?? rx
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        if (nx * nx + ny * ny <= 1) this.px(x, y, c)
      }
    return this
  }
  /** Ellipsoid shaded from its normals; `lift` brightens it (ambient). */
  ell(cx, cy, rx, ry, ramp, lift = 0) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        const d = nx * nx + ny * ny
        if (d > 1) continue
        const nz = Math.sqrt(1 - d)
        const l = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])
        this.px(x, y, shade(ramp, 0.08 + 0.92 * l + lift, x, y))
      }
    return this
  }
  /** Vertical cylinder (w × h), shaded across its width; optional lit top cap. */
  cyl(x, y, w, h, ramp, cap = 0) {
    for (let i = 0; i < w; i++) {
      const nx = ((i + 0.5) / w) * 2 - 1
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx))
      const l = Math.max(0, nx * LIGHT[0] + nz * LIGHT[2] * 0.95 + 0.1)
      for (let j = cap; j < h; j++) this.px(x + i, y + j, shade(ramp, 0.05 + 0.9 * l - (j / h) * 0.12, x + i, y + j))
      for (let j = 0; j < cap; j++) this.px(x + i, y + j, ramp[ramp.length - 1])
    }
    return this
  }
  /**
   * Cuboid seen in 3/4 from above: top face (d rows, lightest), front face (h rows) and a
   * darker right edge. Top-left edges catch the light.
   */
  box(x, y, w, h, d, ramp) {
    const n = ramp.length
    this.rect(x, y, w, d, ramp[n - 1])
    for (let j = 0; j < h; j++) {
      const v = 0.62 - (j / Math.max(1, h)) * 0.22
      for (let i = 0; i < w; i++) this.px(x + i, y + d + j, shade(ramp, v, x + i, y + d + j))
    }
    this.rect(x + w - 1, y + d, 1, h, ramp[Math.max(0, n - 4)] || ramp[0])
    this.rect(x, y + d + h - 1, w, 1, ramp[Math.max(0, n - 4)] || ramp[0])
    this.rect(x, y, w - 1, 1, ramp[n - 1])
    this.rect(x, y + d, 1, h - 1, ramp[n - 2])
    if (d > 0) this.rect(x, y + d, w, 1, ramp[n - 2])
    return this
  }
  /** Two-tone ordered dither over a rectangle: `level` in [0, 1] is the share of c2. */
  dither(x, y, w, h, c1, c2, level) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.px(x + i, y + j, bayer(x + i, y + j) < level ? c2 : c1)
    return this
  }
  /**
   * Character map: rows of characters, `legend` maps a character to a colour ('.' and
   * missing characters are transparent). (x, y) is the top-left corner.
   */
  map(rows, legend, x = 0, y = 0, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]
      for (let i = 0; i < row.length; i++) {
        const c = legend[row[i]]
        if (c) this.px(flip ? x + row.length - 1 - i : x + i, y + j, c)
      }
    }
    return this
  }
  blit(src, x, y) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) this.px(x + i, y + j, src.data[j * src.w + i])
    return this
  }
  clone() {
    const p = new Pix(this.w, this.h)
    p.data = this.data.slice()
    p.ax = this.ax
    p.ay = this.ay
    return p
  }
  /** Quarter turns clockwise around the buffer centre (square-safe: keeps w × h swapped). */
  rotate(k) {
    k = ((k % 4) + 4) % 4
    let src = this
    for (let n = 0; n < k; n++) {
      const p = new Pix(src.h, src.w)
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) p.data[x * p.w + (src.h - 1 - y)] = src.data[y * src.w + x]
      p.ax = src.h - 1 - src.ay
      p.ay = src.ax
      src = p
    }
    return src === this ? this.clone() : src
  }
  bounds() {
    let x0 = this.w
    let y0 = this.h
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.data[y * this.w + x]) {
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
  }
  /**
   * Selective outline, drawn into the transparent pixels around the shape: dark ink on the
   * bottom and right sides, a darker tone of the touching material on the top and left.
   * `soft` (scenery) uses two steps darker instead of ink, so the background stays calm.
   */
  outline(soft = false) {
    const out = this.clone()
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue
        const l = this.get(x - 1, y)
        const u = this.get(x, y - 1)
        const r = this.get(x + 1, y)
        const d = this.get(x, y + 1)
        if (l || u) out.data[y * this.w + x] = soft ? darker(l || u, 2) : P.ink
        else if (r || d) out.data[y * this.w + x] = darker(r || d)
      }
    return out
  }
  /** True when the outer 1 px frame is empty, i.e. an outline drawn later is never cut. */
  hasMargin() {
    for (let x = 0; x < this.w; x++) if (this.get(x, 0) || this.get(x, this.h - 1)) return false
    for (let y = 0; y < this.h; y++) if (this.get(0, y) || this.get(this.w - 1, y)) return false
    return true
  }
}

/* ---------- to the screen ---------- */
const RGB = new Map()
function rgb(c) {
  let v = RGB.get(c)
  if (!v) {
    v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    RGB.set(c, v)
  }
  return v
}
/** A canvas holding the buffer, with its anchor kept as `ax`/`ay`. */
export function toCanvas(pix) {
  const c = document.createElement('canvas')
  c.width = pix.w
  c.height = pix.h
  const g = c.getContext('2d')
  const img = g.createImageData(pix.w, pix.h)
  for (let i = 0; i < pix.data.length; i++) {
    const col = pix.data[i]
    if (!col) continue
    const [r, gg, b] = rgb(col)
    img.data[i * 4] = r
    img.data[i * 4 + 1] = gg
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  c.ax = pix.ax
  c.ay = pix.ay
  return c
}
