/*
 * CARTON PLEIN — dessin « au trait » : des aplats de couleur par région, puis un trait d'encre
 * d'un pixel qui ferme la silhouette et sépare deux régions qui se touchent, et un rehaut d'un
 * ton plus clair le long du bord haut-gauche intérieur de chaque région. C'est la construction
 * des sprites NES de Nintendo World Cup : contour, aplat, un rehaut.
 *
 * On peint des régions (rectangles et bandes diagonales) dans l'ordre ; chaque région a une
 * matière (lettre résolue par le kit et le look) et un identifiant. Le trait est calculé.
 */
import { Pix, PAL } from '../../cons-de-mime/pixel.js'

const P = PAL

export class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.mat = Array.from({ length: h }, () => new Array(w).fill(null))
    this.id = Array.from({ length: h }, () => new Array(w).fill(0))
    this.next = 1
  }
  /** Rectangle plein d'une matière, nouvelle région. */
  rect(x0, y0, w, h, m) {
    const id = this.next++
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x0 + i, y0 + j, m, id)
    return id
  }
  /** Bande diagonale : `steps` rectangles de w × h décalés de (dx, dy) à chaque pas, une seule région. */
  band(x0, y0, w, h, dx, dy, steps, m) {
    const id = this.next++
    for (let s = 0; s < steps; s++) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x0 + s * dx + i, y0 + s * dy + j, m, id)
    return id
  }
  /** Ajoute des pixels à une région existante. */
  add(id, x0, y0, w, h, m) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x0 + i, y0 + j, m, id)
  }
  /** Efface des pixels (coins arrondis). */
  clear(x0, y0, w = 1, h = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.mat[y0 + j]) { this.mat[y0 + j][x0 + i] = null; this.id[y0 + j][x0 + i] = 0 }
  }
  set(x, y, m, id) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.mat[y][x] = m
    this.id[y][x] = id
  }
  /**
   * Rendu : `mats` associe une lettre à une rampe (4 tons) ou à une couleur fixe (chaîne).
   * Trait d'encre : tout pixel plein dont le voisin de droite ou du dessous est vide ou d'une
   * autre région, et tout pixel plein dont le voisin de gauche ou du dessus est vide.
   * Rehaut : le pixel plein qui touche le trait par le haut ou par la gauche prend le ton 3.
   */
  render(mats, { ink = P.ink, pad = 1 } = {}) {
    const W = this.w + 2 * pad
    const H = this.h + 2 * pad
    const p = new Pix(W, H)
    const id = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.id[y][x])
    const line = Array.from({ length: this.h }, () => new Array(this.w).fill(false))
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const me = id(x, y)
        if (!me) continue
        if (id(x + 1, y) !== me || id(x, y + 1) !== me || id(x - 1, y) === 0 || id(x, y - 1) === 0) line[y][x] = true
      }
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const me = id(x, y)
        if (!me) continue
        if (line[y][x]) {
          p.px(x + pad, y + pad, ink)
          continue
        }
        const m = mats[this.mat[y][x]]
        if (!m) continue
        if (typeof m === 'string') {
          p.px(x + pad, y + pad, m)
          continue
        }
        const lit = (line[y - 1] && line[y - 1][x]) || (line[y][x - 1] !== undefined && line[y][x - 1])
        const shade = (line[y + 1] && line[y + 1][x] && id(x, y + 1) === me) || (line[y][x + 1] && id(x + 1, y) === me)
        p.px(x + pad, y + pad, lit ? m[2] : shade ? m[1] : m[1])
      }
    return p
  }
}
