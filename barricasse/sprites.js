/*
 * BARRICASSE — sprites. Everything is drawn in code at low resolution into small offscreen
 * canvases, outlined automatically, then scaled with nearest-neighbour by the renderer.
 * Objects are 24 × 24 art shown at ×2 (one 48 px cell), with extra frames where an
 * animation needs them; little props (yoghurt, hangers, duck…) are ejected on destruction.
 */
;(function () {
  'use strict'

  const OUT = '#1d1726'
  const W = '#f4f1e8'
  const LG = '#c9c6bc'
  const GREY = '#8d8a96'
  const DG = '#4a4756'
  const RED = '#d6402f'
  const DRED = '#9a2a22'
  const ORANGE = '#e8833a'
  const YEL = '#f6d04d'
  const DYEL = '#c99a2e'
  const GREEN = '#4fa64a'
  const DGREEN = '#2f6e3a'
  const LGREEN = '#86cf6a'
  const LBLUE = '#9fd3ef'
  const NAVY = '#22325e'
  const DNAVY = '#141d3a'
  const BROWN = '#8a5530'
  const LBROWN = '#b07a45'
  const DBROWN = '#5a3420'
  const WOOD = '#c79a5b'
  const PINK = '#d77fa0'
  const DPINK = '#a8506f'
  const SKIN = '#f1c19b'

  function makeCanvas(w, h) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  /** Paints with a tiny API, then rings every shape with a 1 px dark outline. */
  function art(w, h, draw, outline = OUT) {
    const c = makeCanvas(w, h)
    const g = c.getContext('2d')
    const P = {
      g,
      r(x, y, ww, hh, col) {
        g.fillStyle = col
        g.fillRect(x, y, ww, hh)
      },
      p(x, y, col) {
        g.fillStyle = col
        g.fillRect(x, y, 1, 1)
      },
      e(cx, cy, rx, ry, col) {
        g.fillStyle = col
        for (let y = -ry; y <= ry; y++)
          for (let x = -rx; x <= rx; x++) if ((x * x) / ((rx + 0.5) * (rx + 0.5)) + (y * y) / ((ry + 0.5) * (ry + 0.5)) <= 1) g.fillRect(cx + x, cy + y, 1, 1)
      },
      line(x0, y0, x1, y1, col) {
        g.fillStyle = col
        const dx = Math.abs(x1 - x0)
        const dy = -Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx + dy
        for (;;) {
          g.fillRect(x0, y0, 1, 1)
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
      },
      clear(x, y, ww, hh) {
        g.clearRect(x, y, ww, hh)
      },
      text(str, x, y, col) {
        window.PixelFont.drawText(g, str, x, y, col)
      },
    }
    draw(P)
    if (outline) addOutline(g, w, h, outline)
    return c
  }
  function addOutline(g, w, h, colour) {
    const img = g.getImageData(0, 0, w, h)
    const d = img.data
    const solid = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0
    const r = parseInt(colour.slice(1, 3), 16)
    const gg = parseInt(colour.slice(3, 5), 16)
    const b = parseInt(colour.slice(5, 7), 16)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (solid[i]) continue
        if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
          d[i * 4] = r
          d[i * 4 + 1] = gg
          d[i * 4 + 2] = b
          d[i * 4 + 3] = 255
        }
      }
    g.putImageData(img, 0, 0)
  }
  function flower(P, x, y, petal = W, heart = YEL) {
    P.p(x - 1, y, petal)
    P.p(x + 1, y, petal)
    P.p(x, y - 1, petal)
    P.p(x, y + 1, petal)
    P.p(x, y, heart)
  }

  /* ---------- the catalogue (24 × 24 art) ---------- */
  const DRAW = {
    chaise(P) {
      P.r(8, 1, 8, 1, W)
      P.r(7, 2, 10, 10, W)
      for (const x of [9, 12, 15]) P.r(x, 3, 1, 8, LG)
      P.r(4, 9, 3, 2, W)
      P.r(17, 9, 3, 2, W)
      P.r(4, 11, 2, 5, LG)
      P.r(18, 11, 2, 5, LG)
      P.r(5, 12, 14, 4, W)
      P.r(5, 15, 14, 1, LG)
      P.r(9, 16, 1, 4, GREY)
      P.r(14, 16, 1, 4, GREY)
      P.r(6, 16, 2, 6, LG)
      P.r(16, 16, 2, 6, LG)
    },
    chaise_folded(P) {
      P.line(5, 21, 18, 12, LG)
      P.line(6, 21, 19, 12, LG)
      P.r(6, 12, 12, 8, W)
      for (const y of [14, 16, 18]) P.r(7, y, 10, 1, LG)
      P.line(5, 12, 18, 21, GREY)
    },
    palette(P) {
      for (const y of [7, 14]) for (const x of [1, 10, 19]) P.r(x, y, 4, 3, DBROWN)
      P.r(1, 21, 22, 2, DBROWN)
      for (const y of [3, 10, 17]) {
        P.r(1, y, 22, 4, WOOD)
        P.r(3, y + 1, 5, 1, '#a87c43')
        P.r(13, y + 2, 6, 1, '#a87c43')
        P.p(2, y + 1, DG)
        P.p(21, y + 1, DG)
        P.p(11, y + 1, DG)
        P.r(1, y + 3, 22, 1, '#b08447')
      }
    },
    voiture(P) {
      P.r(1, 10, 22, 7, RED)
      P.r(2, 10, 20, 1, '#ee6a55')
      P.r(7, 4, 9, 1, RED)
      P.r(6, 5, 11, 6, RED)
      P.r(7, 6, 4, 4, LBLUE)
      P.r(12, 6, 4, 4, LBLUE)
      P.p(8, 6, W)
      P.p(13, 6, W)
      P.r(11, 11, 1, 5, DRED)
      P.r(13, 12, 2, 1, DRED)
      P.r(21, 11, 2, 2, YEL)
      P.p(1, 11, DRED)
      P.p(1, 12, DRED)
      P.r(1, 16, 22, 1, GREY)
      P.e(6, 17, 3, 3, DG)
      P.e(18, 17, 3, 3, DG)
      P.r(5, 16, 2, 2, LG)
      P.r(17, 16, 2, 2, LG)
    },
    planche(P) {
      P.line(6, 11, 17, 21, GREY)
      P.line(7, 11, 18, 21, GREY)
      P.line(17, 11, 6, 21, GREY)
      P.line(18, 11, 7, 21, GREY)
      P.r(4, 21, 4, 1, DG)
      P.r(16, 21, 4, 1, DG)
      ironingBoard(P)
    },
    planche_folded(P) {
      P.r(4, 11, 16, 1, GREY)
      P.r(4, 12, 16, 1, DG)
      ironingBoard(P)
    },
    frigo(P) {
      P.r(5, 1, 14, 21, W)
      P.r(17, 1, 2, 21, LG)
      P.r(5, 8, 14, 1, GREY)
      P.r(15, 3, 1, 4, GREY)
      P.r(15, 10, 1, 7, GREY)
      P.p(8, 11, RED)
      P.p(10, 13, YEL)
      P.r(7, 4, 2, 2, GREEN)
      P.p(9, 16, LBLUE)
      P.r(6, 22, 2, 1, DG)
      P.r(16, 22, 2, 1, DG)
    },
    frigo_open(P) {
      P.r(5, 1, 14, 21, '#fffbe0')
      for (const y of [7, 12, 17]) P.r(6, y, 12, 1, LG)
      P.r(7, 4, 3, 3, ORANGE)
      P.r(12, 9, 2, 3, GREEN)
      P.r(8, 14, 4, 3, W)
      P.r(15, 14, 2, 3, PINK)
      P.r(1, 1, 4, 21, W)
      P.r(1, 1, 1, 21, LG)
      P.r(6, 22, 2, 1, DG)
      P.r(16, 22, 2, 1, DG)
    },
    canape(P) {
      P.r(4, 4, 16, 1, PINK)
      P.r(3, 5, 18, 8, PINK)
      P.r(1, 7, 4, 2, PINK)
      P.r(19, 7, 4, 2, PINK)
      P.r(1, 9, 4, 10, DPINK)
      P.r(19, 9, 4, 10, DPINK)
      P.r(5, 12, 7, 6, '#e59ab5')
      P.r(12, 12, 7, 6, '#e59ab5')
      P.r(11, 12, 1, 6, DPINK)
      P.r(3, 18, 18, 2, DPINK)
      P.r(3, 20, 2, 2, DBROWN)
      P.r(19, 20, 2, 2, DBROWN)
      for (const [x, y] of [[7, 7], [13, 9], [17, 6], [8, 15], [15, 14], [3, 12], [21, 13]]) flower(P, x, y)
    },
    reverbere(P) {
      lamp(P, false)
    },
    reverbere_lit(P) {
      lamp(P, true)
    },
    poisson(P) {
      P.r(18, 9, 2, 6, '#3f7aa0')
      P.r(20, 7, 2, 10, '#3f7aa0')
      P.r(22, 5, 1, 14, '#3f7aa0')
      P.r(9, 5, 6, 2, '#3f7aa0')
      P.r(10, 17, 3, 2, '#3f7aa0')
      P.e(10, 12, 9, 6, '#5f9fc2')
      P.e(10, 14, 7, 3, '#cfe6ee')
      P.r(5, 7, 10, 1, '#3f7aa0')
      P.r(7, 10, 1, 4, '#3f7aa0')
      P.r(3, 10, 3, 3, W)
      P.p(4, 11, '#111')
      P.p(1, 13, '#a04a5a')
      P.p(2, 13, '#a04a5a')
      for (const [x, y] of [[11, 10], [14, 11], [12, 13], [15, 9], [16, 13], [10, 15]]) P.p(x, y, '#8fc0dc')
    },
    armoire(P) {
      P.r(3, 3, 18, 19, BROWN)
      P.r(2, 1, 20, 3, DBROWN)
      P.r(9, 2, 6, 1, LBROWN)
      P.p(12, 1, LBROWN)
      wardrobeDoor(P, 4)
      wardrobeDoor(P, 13)
      P.r(11, 5, 2, 15, DBROWN)
      P.p(10, 12, YEL)
      P.p(13, 12, YEL)
      P.r(3, 22, 2, 1, DBROWN)
      P.r(19, 22, 2, 1, DBROWN)
    },
    armoire_open(P) {
      P.r(3, 3, 18, 19, BROWN)
      P.r(2, 1, 20, 3, DBROWN)
      P.r(4, 5, 16, 15, '#3a2216')
      P.r(4, 7, 16, 1, GREY)
      P.r(0, 4, 4, 17, LBROWN)
      P.r(20, 4, 4, 17, LBROWN)
      P.r(3, 22, 2, 1, DBROWN)
      P.r(19, 22, 2, 1, DBROWN)
    },
    ballon(P) {
      P.e(12, 12, 9, 9, '#cfcfd6')
      P.e(11, 11, 8, 8, W)
      const K = '#24222c'
      P.r(10, 9, 4, 4, K)
      P.p(11, 8, K)
      P.p(12, 8, K)
      P.r(4, 10, 2, 3, K)
      P.r(18, 10, 2, 3, K)
      P.r(9, 18, 3, 2, K)
      P.r(14, 17, 3, 2, K)
      P.r(8, 4, 3, 2, K)
      P.r(14, 4, 2, 2, K)
      P.line(10, 12, 6, 11, GREY)
      P.line(13, 12, 17, 11, GREY)
      P.line(11, 13, 10, 17, GREY)
      P.line(13, 13, 15, 17, GREY)
    },
    baignoire(P) {
      bathtub(P, true)
    },
    baignoire_empty(P) {
      bathtub(P, false)
    },
    photocopieuse(P) {
      P.r(2, 5, 20, 3, '#a9a69c')
      P.r(4, 6, 10, 1, LBLUE)
      P.r(2, 8, 20, 13, '#d4d1c6')
      P.r(2, 18, 20, 3, '#b5b2a8')
      P.r(15, 9, 6, 4, DG)
      P.p(16, 10, GREEN)
      P.p(18, 10, RED)
      P.r(16, 12, 4, 1, LBLUE)
      P.r(0, 11, 3, 4, W)
      P.r(21, 15, 3, 2, W)
      P.r(3, 14, 12, 1, '#b5b2a8')
      P.r(3, 17, 12, 1, '#a29f95')
      P.r(8, 15, 3, 1, GREY)
      P.p(4, 21, DG)
      P.p(19, 21, DG)
    },
    nain(P) {
      for (let y = 1; y <= 8; y++) P.r(12 - Math.floor((y + 1) / 2), y, y + 1, 1, RED)
      P.r(7, 13, 10, 7, '#3c62b8')
      P.r(6, 14, 2, 4, '#3c62b8')
      P.r(16, 14, 2, 4, '#3c62b8')
      P.p(6, 18, SKIN)
      P.p(17, 18, SKIN)
      P.r(9, 9, 6, 3, SKIN)
      P.p(12, 10, '#e09a7a')
      P.p(10, 10, '#111')
      P.p(14, 10, '#111')
      P.r(8, 12, 8, 4, W)
      P.r(9, 16, 6, 1, W)
      P.r(10, 17, 4, 1, W)
      P.r(7, 18, 2, 1, DBROWN)
      P.r(15, 18, 2, 1, DBROWN)
      P.r(8, 20, 3, 2, '#3b8a3b')
      P.r(13, 20, 3, 2, '#3b8a3b')
      P.r(8, 22, 3, 1, DBROWN)
      P.r(13, 22, 3, 1, DBROWN)
    },
    fromage(P) {
      P.e(12, 17, 10, 3, '#d9a83a')
      P.r(2, 9, 21, 8, '#e8b843')
      P.e(12, 9, 10, 4, '#f7d66a')
      P.r(10, 12, 4, 3, RED)
      P.p(11, 13, W)
      for (const [x, y] of [[5, 13], [17, 14], [7, 16], [20, 12]]) P.p(x, y, '#c9962e')
      P.r(18, 14, 2, 2, '#c9962e')
      P.p(8, 8, '#e0b84a')
      P.r(14, 9, 2, 1, '#e0b84a')
      P.p(17, 7, '#e0b84a')
      P.r(4, 9, 3, 1, '#fbe9a0')
    },
    piano(P) {
      P.r(2, 3, 20, 19, '#3a2418')
      P.r(1, 2, 22, 2, '#2a1810')
      P.r(3, 4, 18, 1, '#5a3a28')
      P.r(5, 6, 14, 4, '#4a2e20')
      P.r(8, 6, 8, 4, W)
      P.r(9, 7, 6, 1, GREY)
      P.r(9, 9, 6, 1, GREY)
      P.r(2, 11, 20, 3, W)
      for (const x of [4, 6, 9, 11, 13, 16, 18, 20]) P.r(x, 11, 1, 2, '#111')
      P.r(2, 14, 20, 1, '#2a1810')
      P.r(5, 15, 14, 6, '#4a2e20')
      P.p(10, 20, YEL)
      P.p(12, 20, YEL)
      P.p(14, 20, YEL)
      P.p(3, 6, YEL)
      P.p(20, 6, YEL)
    },
    caddie(P) {
      P.r(4, 5, 16, 8, '#8f9aa6')
      P.line(3, 4, 21, 4, LG)
      P.line(3, 4, 6, 13, LG)
      P.line(21, 4, 19, 13, LG)
      P.line(6, 13, 19, 13, LG)
      for (const x of [7, 10, 13, 16]) P.r(x, 5, 1, 8, '#d4dbe0')
      P.r(5, 8, 15, 1, '#d4dbe0')
      P.r(5, 11, 14, 1, '#d4dbe0')
      P.r(1, 3, 4, 2, RED)
      P.r(6, 14, 1, 4, GREY)
      P.r(18, 14, 1, 4, GREY)
      P.r(5, 17, 15, 1, GREY)
      P.r(5, 19, 3, 3, DG)
      P.r(17, 19, 3, 3, DG)
      P.p(6, 20, LG)
      P.p(18, 20, LG)
    },
    caddie_nowheel(P) {
      DRAW.caddie(P)
      P.clear(17, 19, 3, 3)
    },
    plante(P) {
      P.r(11, 9, 2, 6, DGREEN)
      P.e(12, 5, 2, 4, LGREEN)
      P.e(7, 9, 4, 2, GREEN)
      P.e(17, 9, 4, 2, GREEN)
      P.e(7, 4, 3, 2, LGREEN)
      P.e(17, 4, 3, 2, GREEN)
      P.e(5, 13, 3, 2, DGREEN)
      P.e(19, 13, 3, 2, DGREEN)
      P.e(12, 11, 3, 2, GREEN)
      for (const [x, y] of [[7, 9], [17, 9], [12, 5], [12, 11]]) P.p(x, y, DGREEN)
      P.r(6, 14, 12, 2, '#d97a4c')
      P.r(7, 16, 10, 6, '#c4643a')
      P.r(14, 16, 3, 6, '#a5502c')
      P.r(8, 22, 8, 1, '#a5502c')
    },
    toilettes(P) {
      P.r(6, 2, 12, 6, W)
      P.r(5, 1, 14, 2, '#e4e4ee')
      P.p(11, 1, LG)
      P.p(12, 1, LG)
      P.r(15, 3, 3, 5, '#dcdce6')
      P.r(11, 8, 2, 1, LG)
      P.r(9, 15, 6, 6, W)
      P.r(13, 15, 2, 6, '#dcdce6')
      P.r(8, 20, 8, 2, W)
      P.e(12, 12, 8, 4, '#dcdce6')
      P.e(12, 11, 8, 3, W)
      P.e(12, 11, 5, 2, LBLUE)
    },
    cheval(P) {
      for (let x = 2; x <= 21; x++) {
        const k = (x - 11.5) / 10
        P.r(x, 18 + Math.round(3 * (1 - k * k)), 1, 2, BROWN)
      }
      const H = '#f0e8d8'
      P.line(6, 14, 5, 19, '#e2d8c4')
      P.line(8, 14, 8, 20, '#e2d8c4')
      P.line(15, 14, 15, 20, '#e2d8c4')
      P.line(17, 14, 18, 19, '#e2d8c4')
      P.r(3, 9, 2, 5, RED)
      P.r(5, 9, 13, 5, H)
      P.p(8, 11, LG)
      P.p(12, 12, LG)
      P.p(15, 10, LG)
      P.r(15, 5, 4, 6, H)
      P.r(17, 3, 5, 4, H)
      P.r(20, 5, 2, 2, '#e0d0c0')
      P.p(18, 4, '#111')
      P.p(17, 2, H)
      P.r(14, 3, 2, 6, RED)
      P.p(16, 2, RED)
      P.r(9, 8, 5, 3, RED)
      P.p(11, 12, YEL)
    },
    distributeur(P) {
      P.r(4, 1, 16, 21, RED)
      P.r(4, 1, 16, 3, DRED)
      P.r(6, 2, 8, 1, W)
      P.r(6, 5, 9, 12, '#1d2a3a')
      const cans = [RED, YEL, GREEN, LBLUE, W, ORANGE]
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) P.r(7 + col * 2, 6 + row * 3, 1, 2, cans[(row * 3 + col) % cans.length])
      P.r(16, 5, 3, 12, DRED)
      P.r(17, 6, 1, 2, '#111')
      P.p(17, 9, W)
      P.p(17, 11, W)
      P.p(17, 13, W)
      P.r(6, 18, 9, 3, '#111')
      P.r(6, 18, 9, 1, GREY)
      P.r(5, 22, 2, 1, DG)
      P.r(17, 22, 2, 1, DG)
    },
    gateau(P) {
      const C = '#fbf2e2'
      const S = '#eadfca'
      P.r(2, 21, 20, 1, LG)
      P.r(3, 22, 18, 1, GREY)
      P.r(3, 15, 18, 6, C)
      P.r(17, 15, 4, 6, S)
      P.r(6, 10, 12, 5, C)
      P.r(15, 10, 3, 5, S)
      P.r(9, 6, 6, 4, C)
      P.r(13, 6, 2, 4, S)
      for (const [y, x0, w] of [[15, 3, 18], [10, 6, 12], [6, 9, 6]]) {
        P.r(x0, y, w, 1, PINK)
        for (let x = x0 + 1; x < x0 + w; x += 3) P.p(x, y + 1, PINK)
      }
      for (const x of [5, 8, 11, 14, 17]) P.p(x, 18, '#f3c0d0')
      P.p(11, 2, SKIN)
      P.p(11, 3, '#111')
      P.p(11, 4, '#111')
      P.p(11, 5, '#111')
      P.p(13, 2, SKIN)
      P.r(13, 3, 1, 1, W)
      P.r(12, 4, 3, 2, W)
    },
    tableau(P) {
      painting(P, false)
    },
    tableau_empty(P) {
      painting(P, true)
    },
    trophee(P) {
      const Au = '#f0c040'
      P.r(6, 19, 12, 3, DBROWN)
      P.r(9, 20, 6, 1, YEL)
      P.r(10, 14, 4, 5, '#e0b030')
      P.r(9, 15, 6, 1, DYEL)
      P.r(3, 7, 3, 1, Au)
      P.r(3, 7, 1, 4, Au)
      P.r(3, 10, 3, 1, Au)
      P.r(18, 7, 3, 1, Au)
      P.r(20, 7, 1, 4, Au)
      P.r(18, 10, 3, 1, Au)
      P.r(6, 6, 12, 7, Au)
      P.r(8, 13, 8, 1, DYEL)
      P.r(8, 7, 1, 4, '#fff0a0')
      P.e(12, 4, 3, 3, '#b8bcc6')
      P.r(9, 4, 7, 1, '#8d929e')
      P.p(11, 2, W)
    },
    carton(P) {
      P.r(2, 4, 20, 3, '#ddb07a')
      P.r(2, 7, 20, 14, '#c9965a')
      P.r(2, 7, 20, 1, '#a87a45')
      P.r(11, 4, 2, 17, '#e8cf9a')
      P.r(4, 11, 6, 7, W)
      P.r(5, 12, 4, 2, RED)
      P.p(6, 14, RED)
      P.p(7, 14, RED)
      P.r(6, 15, 2, 1, RED)
      P.r(5, 16, 4, 1, RED)
      P.r(16, 11, 1, 5, RED)
      P.r(15, 12, 3, 1, RED)
      P.r(19, 11, 1, 5, RED)
      P.r(18, 12, 3, 1, RED)
      P.r(14, 18, 7, 1, RED)
    },
    barbecue(P) {
      P.line(7, 15, 4, 22, DG)
      P.line(17, 15, 20, 22, DG)
      P.r(11, 15, 2, 7, DG)
      P.r(3, 10, 18, 3, '#2a2a2e')
      P.r(4, 13, 16, 2, '#2a2a2e')
      P.r(6, 15, 12, 1, '#2a2a2e')
      P.r(5, 11, 3, 1, '#4a4a52')
      P.r(3, 9, 18, 1, GREY)
      P.r(5, 7, 5, 2, '#b04a2a')
      P.r(12, 7, 5, 2, '#b04a2a')
      P.p(6, 7, '#d0683e')
      P.p(13, 7, '#d0683e')
      P.r(20, 9, 3, 1, DBROWN)
    },
    glaciere(P) {
      P.r(9, 3, 6, 1, LG)
      P.r(9, 3, 1, 3, LG)
      P.r(14, 3, 1, 3, LG)
      P.r(3, 9, 18, 12, '#3a8ad0')
      P.r(17, 10, 4, 11, '#2c6eac')
      P.r(2, 6, 20, 4, W)
      P.r(2, 9, 20, 1, '#d8d8e0')
      P.r(11, 9, 2, 2, LG)
      P.r(6, 14, 7, 4, W)
      P.p(8, 15, LBLUE)
      P.p(10, 16, LBLUE)
      P.p(9, 15, LBLUE)
    },
    parasol(P) {
      parasolArt(P, true)
    },
    parasol_closed(P) {
      parasolArt(P, false)
    },
    merguez(P) {
      const pts = []
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI * (1.08 + (0.84 * k) / 12)
        pts.push([Math.round(12 + 9 * Math.cos(a)), Math.round(18 + 13 * Math.sin(a))])
      }
      for (const [x, y] of pts) P.e(x, y, 3, 3, '#a84428')
      for (const [x, y] of pts.slice(1, -1)) P.e(x - 1, y - 1, 1, 1, '#c85a36')
      for (const [x, y] of pts.slice(2, -2).filter((_, i) => i % 3 === 0)) P.r(x, y, 2, 1, '#6e2a18')
      const [ex, ey] = pts[0]
      const [fx, fy] = pts[pts.length - 1]
      P.p(ex, ey + 3, '#6e2a18')
      P.p(fx, fy + 3, '#6e2a18')
    },
  }
  function ironingBoard(P) {
    const F = '#7fb5e0'
    P.p(1, 8, F)
    P.p(1, 9, F)
    P.r(2, 7, 20, 4, F)
    P.r(2, 10, 20, 1, '#5f95c0')
    for (const [x, y] of [[5, 8], [9, 9], [13, 8], [17, 9], [20, 8]]) P.p(x, y, W)
    for (const [x, y] of [[7, 8], [15, 9], [11, 8]]) P.p(x, y, PINK)
  }
  function lamp(P, lit) {
    const M = '#3b4a5a'
    const D = '#2c3846'
    P.r(10, 6, 3, 15, M)
    P.r(10, 6, 1, 15, '#5a6e82')
    P.r(9, 12, 5, 1, D)
    P.r(8, 19, 7, 2, D)
    P.r(7, 21, 9, 2, D)
    P.r(10, 3, 8, 2, M)
    P.r(10, 4, 2, 3, M)
    P.r(15, 4, 6, 3, D)
    P.r(16, 7, 4, 2, lit ? '#fff2a8' : '#7d8a96')
    if (lit) P.p(17, 7, W)
  }
  function wardrobeDoor(P, x) {
    P.r(x, 5, 7, 15, LBROWN)
    P.r(x + 1, 7, 5, 5, BROWN)
    P.r(x + 1, 13, 5, 5, BROWN)
    P.p(x + 3, 9, '#c89058')
    P.p(x + 3, 15, '#c89058')
  }
  function bathtub(P, duck) {
    P.r(2, 4, 2, 5, LG)
    P.r(2, 4, 4, 1, LG)
    P.p(5, 5, LBLUE)
    P.r(2, 10, 20, 8, W)
    P.r(3, 18, 18, 1, W)
    P.r(5, 19, 14, 1, W)
    P.r(2, 15, 20, 3, '#dfe1ec')
    P.r(1, 9, 22, 2, '#d8dae6')
    P.r(3, 9, 18, 1, LBLUE)
    P.r(4, 19, 2, 3, '#d8b04a')
    P.r(18, 19, 2, 3, '#d8b04a')
    if (duck) {
      P.r(14, 6, 5, 3, YEL)
      P.r(17, 4, 3, 3, YEL)
      P.p(20, 5, ORANGE)
      P.p(18, 5, '#111')
    }
  }
  function painting(P, empty) {
    P.line(5, 22, 8, 17, DBROWN)
    P.line(18, 22, 15, 17, DBROWN)
    P.r(1, 2, 22, 17, '#c79a35')
    P.r(2, 3, 20, 15, '#a87a25')
    P.p(1, 2, YEL)
    P.p(22, 2, YEL)
    P.p(1, 18, YEL)
    P.p(22, 18, YEL)
    if (empty) {
      P.r(3, 4, 18, 13, '#3a2a20')
      P.r(3, 4, 18, 1, '#2a1c14')
      P.line(5, 6, 12, 4, '#7a6a5a')
      P.line(12, 4, 19, 6, '#7a6a5a')
      return
    }
    P.r(3, 4, 18, 13, '#8fc8ef')
    P.r(5, 6, 4, 1, W)
    P.r(13, 5, 3, 1, W)
    P.e(17, 7, 2, 2, YEL)
    P.r(3, 13, 18, 4, '#5aae55')
    P.r(5, 12, 6, 1, '#5aae55')
    P.r(13, 11, 6, 2, '#3f8f45')
    P.r(3, 15, 18, 2, '#3f8f45')
    P.r(8, 10, 1, 3, BROWN)
    P.e(8, 9, 2, 2, DGREEN)
  }
  function parasolArt(P, open) {
    const POLE = '#8a8a96'
    if (open) {
      for (let y = 3; y <= 10; y++) {
        const k = (10 - y) / 8
        const hw = Math.round(11 * Math.sqrt(Math.max(0, 1 - k * k)))
        for (let x = 12 - hw; x <= 11 + hw; x++) P.p(x, y, Math.floor((x - 1) / 4) % 2 ? W : RED)
      }
      for (const x of [1, 5, 9, 13, 17, 21]) P.p(x, 11, Math.floor((x - 1) / 4) % 2 ? W : RED)
      P.p(12, 2, POLE)
      P.r(11, 11, 2, 11, POLE)
    } else {
      P.r(11, 4, 2, 18, POLE)
      P.r(10, 2, 4, 10, RED)
      P.r(10, 4, 4, 1, W)
      P.r(10, 8, 4, 1, W)
      P.p(12, 1, POLE)
    }
    P.r(8, 21, 8, 2, DG)
  }

  /* ---------- small props ejected by the comedy ---------- */
  const PROPS = {
    yaourt: [5, 6, (P) => (P.r(0, 1, 5, 5, W), P.r(0, 0, 5, 1, PINK), P.r(1, 3, 3, 1, PINK))],
    telecommande: [3, 7, (P) => (P.r(0, 0, 3, 7, DG), P.p(1, 1, RED), P.p(1, 3, LG), P.p(1, 5, LG))],
    cintre: [7, 4, (P) => (P.p(3, 0, GREY), P.p(3, 1, GREY), P.line(3, 1, 0, 3, GREY), P.line(3, 1, 6, 3, GREY), P.r(0, 3, 7, 1, GREY))],
    canard: [7, 6, (P) => (P.r(0, 3, 5, 3, YEL), P.r(3, 0, 3, 3, YEL), P.p(6, 1, ORANGE), P.p(4, 1, '#111'))],
    feuille_non: [13, 10, (P) => (P.r(0, 0, 13, 10, W), P.text('NON', 1, 1, RED))],
    bonnet: [9, 8, (P) => {
      for (let y = 0; y < 8; y++) P.r(4 - Math.floor(y / 2), y, 1 + 2 * Math.floor(y / 2), 1, RED)
    }],
    canette: [3, 5, (P) => (P.r(0, 0, 3, 5, RED), P.r(0, 0, 3, 1, LG), P.p(1, 2, W))],
    glacon: [4, 4, (P) => (P.r(0, 0, 4, 4, '#d8f0ff'), P.p(1, 1, W))],
    planche_bois: [12, 3, (P) => (P.r(0, 0, 12, 3, WOOD), P.r(2, 1, 4, 1, '#a87c43'), P.p(1, 1, DG), P.p(10, 1, DG))],
    feuille: [4, 3, (P) => (P.r(0, 1, 4, 1, GREEN), P.r(1, 0, 2, 3, GREEN), P.p(1, 1, DGREEN))],
    creme: [4, 3, (P) => (P.r(0, 1, 4, 2, '#fbf2e2'), P.r(1, 0, 2, 1, '#fbf2e2'), P.p(1, 2, PINK))],
    fer: [8, 6, (P) => (P.r(1, 3, 6, 2, PINK), P.p(0, 4, PINK), P.r(2, 1, 4, 1, DG), P.p(2, 2, DG), P.p(5, 2, DG), P.r(1, 5, 6, 1, LG))],
    roue: [5, 5, (P) => (P.e(2, 2, 2, 2, DG), P.p(2, 2, LG))],
    goutte: [3, 4, (P) => (P.p(1, 0, LBLUE), P.r(0, 1, 3, 3, LBLUE), P.p(1, 1, W))],
    saucisse: [6, 2, (P) => (P.r(0, 0, 6, 2, '#b04a2a'), P.p(1, 0, '#d0683e'))],
    fleur: [3, 3, (P) => flower(P, 1, 1)],
    fumee: [4, 4, (P) => P.e(2, 2, 1, 1, '#d8d8d8')],
  }

  /* ---------- people (14 × 18 body, 1:1 pixels) ---------- */
  const SKINS = ['#f1c19b', '#d9a066', '#a8714a', '#6e4630', '#f6d3b8']
  const HAIRS = ['#2a1d16', '#6b3b1f', '#d9b24a', '#9a3a22', '#bbbbbb', '#1a1a22']
  const SHIRTS = ['#e8573f', '#3d8fd6', '#5bb85a', '#f2c03f', '#a05ad0', '#ef8fb5', '#3cc0b5', '#f4f1e8', '#e98a2c', '#7a8a3a']
  const PANTS = ['#2b3a6b', '#3a3a44', '#5a4a3a', '#2f5a4a', '#6a2f3a']
  function lookFor(index) {
    return {
      skin: SKINS[(index * 7 + 3) % SKINS.length],
      hair: HAIRS[(index * 5 + 1) % HAIRS.length],
      shirt: SHIRTS[(index * 3 + (index >> 3)) % SHIRTS.length],
      pants: PANTS[(index * 11) % PANTS.length],
      style: (index * 13 + 5) % 5,
    }
  }
  /** frame: 0 idle, 1 bob, 2 walk A, 3 walk B. Canvas 16 × 21, body at (1, 1). */
  function person(look, frame, raised) {
    return art(16, 21, (P) => {
      const o = 1
      const bob = frame === 1 ? 1 : 0
      const y0 = o + bob
      const { skin, hair, shirt, pants, style } = look
      // Legs and shoes.
      const lA = frame === 2 ? -1 : 0
      const lB = frame === 3 ? -1 : 0
      P.r(o + 4, o + 13, 8, 3 - bob, pants)
      P.r(o + 4, o + 16 + lA, 3, 2 + Math.min(0, -lA), '#2a2a2e')
      P.r(o + 9, o + 16 + lB, 3, 2 + Math.min(0, -lB), '#2a2a2e')
      // Body and arms.
      P.r(o + 3, y0 + 7, 10, 6, shirt)
      P.r(o + 3, y0 + 12, 10, 1, shade(shirt))
      P.r(o + 1, y0 + 8, 2, 4, shirt)
      P.p(o + 1, y0 + 12, skin)
      if (raised) {
        P.r(o + 13, y0 + 3, 2, 5, shirt)
        P.p(o + 13, y0 + 2, skin)
      } else {
        P.r(o + 13, y0 + 8, 2, 4, shirt)
        P.p(o + 13, y0 + 12, skin)
      }
      // Head.
      P.r(o + 4, y0 + 1, 6, 6, skin)
      P.p(o + 5, y0 + 4, '#1a1414')
      P.p(o + 8, y0 + 4, '#1a1414')
      if (style === 0) {
        P.r(o + 4, y0, 6, 2, hair)
      } else if (style === 1) {
        P.r(o + 3, y0, 8, 2, hair)
        P.r(o + 3, y0 + 2, 1, 5, hair)
        P.r(o + 10, y0 + 2, 1, 5, hair)
      } else if (style === 2) {
        P.r(o + 3, y0, 8, 2, '#e8573f')
        P.r(o + 3, y0 + 2, 9, 1, '#b8402c')
      } else if (style === 3) {
        P.r(o + 4, y0, 6, 1, hair)
        P.r(o + 4, y0 + 3, 6, 1, '#20202a')
        P.p(o + 5, y0 + 3, LBLUE)
        P.p(o + 8, y0 + 3, LBLUE)
      } else {
        P.r(o + 4, y0 - 0, 6, 2, '#3d8fd6')
        P.p(o + 6, y0 - 0, W)
      }
    })
  }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16)
    const f = (v) => Math.max(0, Math.round(v * 0.75))
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')
  }

  /* ---------- signs (decorative, outside every hitbox) ---------- */
  const SIGNS = {
    canape: (P) => {
      P.r(5, 3, 10, 3, PINK)
      P.r(4, 5, 2, 3, DPINK)
      P.r(14, 5, 2, 3, DPINK)
      P.r(6, 6, 8, 2, '#e59ab5')
      P.text('?', 17, 0, RED)
    },
    frigo: (P) => {
      P.r(4, 1, 5, 8, '#e9eef2')
      P.r(4, 3, 5, 1, GREY)
      P.r(11, 3, 2, 2, RED)
      P.r(14, 3, 2, 2, RED)
      P.r(11, 4, 5, 2, RED)
      P.r(12, 6, 3, 1, RED)
      P.p(13, 7, RED)
    },
    non: (P) => P.text('NON', 4, 1, RED),
    truc: (P) => (P.text('?!', 7, 1, '#2b3a6b')),
    groupe: (P) => {
      for (const x of [4, 9, 14]) {
        P.r(x, 2, 3, 3, '#2b3a6b')
        P.r(x - 1, 5, 5, 3, '#2b3a6b')
      }
    },
    passer: (P) => {
      P.r(3, 4, 12, 2, '#2b3a6b')
      P.line(12, 1, 16, 5, '#2b3a6b')
      P.line(12, 8, 16, 4, '#2b3a6b')
    },
    bof: (P) => P.text('BOF', 4, 1, '#2b3a6b'),
    coeur: (P) => {
      P.r(7, 2, 3, 2, RED)
      P.r(11, 2, 3, 2, RED)
      P.r(6, 3, 9, 3, RED)
      P.r(8, 6, 5, 1, RED)
      P.p(10, 7, RED)
    },
  }
  function sign(kind) {
    return art(22, 11, (P) => {
      P.r(0, 0, 22, 11, '#f4ead2')
      P.r(0, 10, 22, 1, '#d6c8a6')
      SIGNS[kind](P)
    })
  }

  /* ---------- police, seen from above ---------- */
  function crs(frame, eating) {
    return art(18, 18, (P) => {
      P.r(2, 1, 14, 3, '#aeb8c4')
      P.r(3, 2, 12, 1, '#d4dce6')
      P.e(9, 11, 7, 3, NAVY)
      P.r(1, 10, 3, 4, NAVY)
      if (eating) {
        P.r(14, 6, 3, 5, NAVY)
        P.r(15, 3 + (frame % 2), 2, 4, '#b04a2a')
      } else P.r(14, 10, 3, 4, NAVY)
      P.e(9, 9, 4, 4, '#2a3c70')
      P.r(6, 5, 7, 2, '#bfe3f5')
      P.p(7, 5, W)
      P.r(8, 12, 3, 1, DNAVY)
      if (frame % 2) P.p(9, 13, '#f2c03f')
    })
  }
  function launcher() {
    return art(22, 18, (P) => {
      P.r(1, 5, 3, 4, '#111')
      P.r(18, 5, 3, 4, '#111')
      P.r(1, 11, 3, 4, '#111')
      P.r(18, 11, 3, 4, '#111')
      P.r(3, 4, 16, 12, NAVY)
      P.r(3, 4, 16, 1, '#3a4a7a')
      for (let x = 3; x < 19; x += 2) P.r(x, 14, 1, 2, YEL)
      for (let x = 4; x < 19; x += 2) P.r(x, 14, 1, 2, '#111')
      P.e(11, 9, 4, 3, '#3a4a7a')
      P.p(10, 8, ORANGE)
      P.p(12, 9, ORANGE)
      P.p(11, 10, '#ffe7b0')
      P.r(15, 6, 2, 2, RED)
    })
  }

  /* ---------- street ---------- */
  function street(rand) {
    const c = makeCanvas(480, 640)
    const g = c.getContext('2d')
    const px = (x, y, w, h, col) => {
      g.fillStyle = col
      g.fillRect(x, y, w, h)
    }
    // Asphalt with a little grain.
    px(0, 0, 480, 640, '#4d5466')
    for (let i = 0; i < 2600; i++) px((rand() * 480) | 0, (rand() * 640) | 0, 1, 1, rand() < 0.5 ? '#474e60' : '#555c6e')
    for (let i = 0; i < 40; i++) px((rand() * 480) | 0, (rand() * 640) | 0, 2, 1, '#3f4556')
    // Sidewalks.
    for (const x0 of [0, 410]) {
      px(x0, 48, 70, 592, '#bfae8e')
      for (let y = 48; y < 640; y += 16) px(x0, y, 70, 1, '#ad9c7d')
      for (let y = 48; y < 640; y += 16) for (let x = x0 + ((y / 16) % 2 ? 0 : 11); x < x0 + 70; x += 22) px(x, y, 1, 16, '#ad9c7d')
      for (let i = 0; i < 300; i++) px(x0 + ((rand() * 70) | 0), 48 + ((rand() * 592) | 0), 1, 1, rand() < 0.5 ? '#b5a484' : '#c8b898')
    }
    // Curbs.
    px(70, 48, 2, 592, '#d9cfb8')
    px(68, 48, 2, 592, '#8e7f64')
    px(408, 48, 2, 592, '#d9cfb8')
    px(410, 48, 2, 592, '#8e7f64')
    // Faded road markings, quieter than the game.
    for (let y = 182; y < 470; y += 36) px(239, y, 2, 18, '#636a7a')
    px(72, 168, 336, 2, '#5d6474')
    px(72, 478, 336, 2, '#5d6474')
    // Crossing at the top, under the crowd.
    for (let x = 84; x < 400; x += 20) px(x, 150, 10, 12, '#5a6172')
    // Manhole and drains.
    g.fillStyle = '#3c4252'
    g.beginPath()
    g.arc(130, 500, 9, 0, Math.PI * 2)
    g.fill()
    for (let k = -6; k <= 6; k += 3) px(124, 500 + k, 13, 1, '#474e60')
    px(74, 470, 10, 4, '#2d3240')
    px(396, 230, 10, 4, '#2d3240')
    // Sidewalk props (decor, low contrast).
    const tree = (x, y) => {
      px(x - 7, y - 7, 14, 14, '#9a8a6c')
      g.fillStyle = '#3e6b45'
      g.beginPath()
      g.arc(x, y - 4, 13, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#4f8155'
      g.beginPath()
      g.arc(x - 3, y - 7, 8, 0, Math.PI * 2)
      g.fill()
    }
    tree(446, 110)
    tree(446, 520)
    tree(34, 520)
    tree(34, 120)
    const bench = (x, y) => {
      px(x, y, 8, 30, '#7a5a3a')
      px(x + 1, y, 1, 30, '#8e6c48')
      px(x + 9, y + 2, 2, 26, '#5a4a3a')
    }
    bench(450, 210)
    bench(22, 220)
    px(452, 440, 10, 12, '#4a6a4a')
    px(452, 438, 10, 2, '#3a5a3a')
    px(24, 430, 10, 12, '#4a6a4a')
    px(24, 428, 10, 2, '#3a5a3a')
    // Bottom: the road keeps going under the police; message strip below the exit line.
    px(0, 600, 480, 40, '#1b2030')
    px(0, 600, 480, 1, '#2c3346')
    return c
  }

  /* ---------- build everything once ---------- */
  function build() {
    const S = { items: {}, frames: {}, props: {}, palette: {}, people: [], signs: {}, crs: [], launcher: null }
    for (const [key, fn] of Object.entries(DRAW)) {
      const c = art(24, 24, fn)
      const [base, variant] = key.split('_')
      if (variant) (S.frames[base] = S.frames[base] || {})[variant] = c
      else S.items[key] = c
    }
    for (const id of Object.keys(S.items)) S.palette[id] = colours(S.items[id])
    for (const [k, [w, h, fn]] of Object.entries(PROPS)) S.props[k] = art(w, h, fn)
    for (let i = 0; i < 24; i++) {
      const look = lookFor(i)
      S.people.push({ look, frames: [0, 1, 2, 3].map((f) => person(look, f, false)), raised: [0, 1, 2, 3].map((f) => person(look, f, true)) })
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

  window.BarricasseSprites = { build, street, makeCanvas, art, OUT }
})()
