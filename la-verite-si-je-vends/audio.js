/*
 * La vérité si je vends ! — sound: the rising-offer tick (rate limited), the handshake clap,
 * the cash register, a comic slide for failures, a sting for the deal of the century, and a
 * small warm loop (guitar-ish arpeggio, round bass). Everything is synthesised locally.
 */
export function createAudio() {
  let ac = null
  let master = null
  let muted = false
  let lastTick = 0
  let musicTimer = null
  let musicStep = 0

  function init() {
    if (ac) return
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = muted ? 0 : 0.4
    master.connect(ac.destination)
  }
  function tone(freq, dur, type, vol, slide, delay = 0) {
    if (!ac) return
    const t = ac.currentTime + delay
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  function noise(dur, vol, lowpass, delay = 0) {
    if (!ac) return
    const t = ac.currentTime + delay
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ac.createBufferSource()
    src.buffer = buffer
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lowpass
    const g = ac.createGain()
    g.gain.value = vol
    src.connect(f)
    f.connect(g)
    g.connect(master)
    src.start(t)
  }

  // A warm little loop in A minor: arpeggio on a plucky triangle, round bass, light brush.
  const ARP = [220, 262, 330, 262, 196, 247, 294, 247, 175, 220, 262, 220, 165, 208, 247, 208]
  const BASS = [110, 98, 87, 82]
  function scheduleMusic() {
    if (!musicTimer && musicTimer !== 0) return
    const beat = 60 / 112 / 2
    const t = ac.currentTime + 0.05
    const n = ARP[musicStep % ARP.length]
    tone(n, beat * 0.9, 'triangle', 0.045, null, 0)
    if (musicStep % 4 === 0) tone(BASS[Math.floor(musicStep / 4) % BASS.length], beat * 3.5, 'sine', 0.09)
    if (musicStep % 2 === 1) noise(0.03, 0.03, 5000)
    musicStep++
    musicTimer = setTimeout(scheduleMusic, beat * 1000)
    void t
  }

  return {
    init,
    resume() {
      init()
      return ac.resume()
    },
    get muted() {
      return muted
    },
    setMuted(value) {
      muted = value
      if (master) master.gain.value = muted ? 0 : 0.4
    },
    /** The offer rose: at most four ticks per second, pitch following the progression. */
    tick(p) {
      if (!ac) return
      const now = ac.currentTime
      if (now - lastTick < 0.25) return
      lastTick = now
      tone(500 + p * 900, 0.05, 'square', 0.05)
    },
    enter() {
      noise(0.08, 0.12, 2000)
    },
    handshake(strength) {
      noise(0.05, 0.3 + strength * 0.3, 1200)
      tone(140, 0.08, 'square', 0.12, 80)
      if (strength > 0.5) noise(0.05, 0.3, 1200, 0.09)
    },
    register() {
      tone(1760, 0.08, 'square', 0.12, null, 0.05)
      tone(2217, 0.15, 'square', 0.1, null, 0.14)
      noise(0.12, 0.2, 3000, 0.02)
    },
    bills() {
      for (let i = 0; i < 6; i++) noise(0.04, 0.12, 2500, i * 0.05)
    },
    fail() {
      tone(900, 0.5, 'sine', 0.18, 180)
      noise(0.2, 0.2, 800, 0.45)
    },
    perfect() {
      ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, null, i * 0.07))
      noise(0.3, 0.25, 900, 0.1)
    },
    glasses() {
      tone(2400, 0.05, 'square', 0.06)
      tone(1800, 0.05, 'square', 0.06, null, 0.12)
    },
    plaster() {
      noise(0.25, 0.3, 500, 0.2)
    },
    curtain() {
      noise(0.5, 0.15, 600)
    },
    results() {
      ;[392, 349, 330, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, null, i * 0.18))
    },
    music(on) {
      if (!ac) return
      if (on && musicTimer === null) {
        musicTimer = 0
        musicStep = 0
        scheduleMusic()
      } else if (!on && musicTimer !== null) {
        clearTimeout(musicTimer)
        musicTimer = null
      }
    },
  }
}
