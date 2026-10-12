// Encodeur GIF animé minimal (palette globale ≤ 256 couleurs, LZW), sans dépendance.
// pixToGif(frames: Pix[], { scale, delay (centièmes de s), bg }) → Buffer
export function pixToGif(frames, { scale = 1, delay = 12, bg = '#3e8948' } = {}) {
  const colors = new Map()
  const idx = (c) => {
    if (!colors.has(c)) colors.set(c, colors.size)
    return colors.get(c)
  }
  idx(bg)
  const W = frames[0].w * scale
  const H = frames[0].h * scale
  const indexed = frames.map((p) => {
    const out = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = idx(p.data[Math.floor(y / scale) * p.w + Math.floor(x / scale)] || bg)
    return out
  })
  if (colors.size > 256) throw new Error('plus de 256 couleurs')
  let bits = 1
  while (1 << bits < colors.size) bits++
  bits = Math.max(2, bits)
  const palSize = 1 << bits
  const parts = []
  const u16 = (v) => Buffer.from([v & 255, (v >> 8) & 255])
  parts.push(Buffer.from('GIF89a', 'ascii'), u16(W), u16(H), Buffer.from([0x80 | (bits - 1), 0, 0]))
  const pal = Buffer.alloc(palSize * 3)
  for (const [c, i] of colors) {
    pal[i * 3] = parseInt(c.slice(1, 3), 16)
    pal[i * 3 + 1] = parseInt(c.slice(3, 5), 16)
    pal[i * 3 + 2] = parseInt(c.slice(5, 7), 16)
  }
  parts.push(pal)
  // Boucle infinie (Netscape).
  parts.push(Buffer.from([0x21, 0xff, 0x0b]), Buffer.from('NETSCAPE2.0', 'ascii'), Buffer.from([3, 1, 0, 0, 0]))
  for (const px of indexed) {
    parts.push(Buffer.from([0x21, 0xf9, 4, 0]), u16(delay), Buffer.from([0, 0]))
    parts.push(Buffer.from([0x2c]), u16(0), u16(0), u16(W), u16(H), Buffer.from([0]))
    parts.push(Buffer.from([bits]), lzw(px, bits))
    parts.push(Buffer.from([0]))
  }
  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}

function lzw(pixels, minBits) {
  const clear = 1 << minBits
  const eoi = clear + 1
  const out = []
  let cur = 0
  let curBits = 0
  const emit = (code, size) => {
    cur |= code << curBits
    curBits += size
    while (curBits >= 8) {
      out.push(cur & 255)
      cur >>>= 8
      curBits -= 8
    }
  }
  let size = minBits + 1
  let dict = new Map()
  let next = eoi + 1
  const reset = () => {
    dict = new Map()
    next = eoi + 1
    size = minBits + 1
  }
  emit(clear, size)
  let prefix = pixels[0]
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i]
    const key = prefix * 4096 + k
    if (dict.has(key)) prefix = dict.get(key)
    else {
      emit(prefix, size)
      if (next < 4096) {
        if (next > (1 << size) - 1 && size < 12) size++
        dict.set(key, next++)
      } else {
        emit(clear, size)
        reset()
      }
      prefix = k
    }
  }
  emit(prefix, size)
  emit(eoi, size)
  if (curBits > 0) out.push(cur & 255)
  // Sous-blocs de 255 octets.
  const blocks = []
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255)
    blocks.push(Buffer.from([chunk.length]), Buffer.from(chunk))
  }
  return Buffer.concat(blocks)
}
