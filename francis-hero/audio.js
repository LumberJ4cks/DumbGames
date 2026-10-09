/* Francis Hero : effets sonores synthétisés par-dessus le morceau (ping de touche, raté, acclamations, huées, solo). */
export function createAudio() {
  let ac = null
  let master = null
  function init() {
    if (ac) return
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = 0.4
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
  const RIFF = [82.41, 82.41, 98, 110, 82.41, 82.41, 123.47, 110]
  return {
    init,
    resume() {
      init()
      return ac.resume()
    },
    ping(i, perfect) {
      tone(RIFF[i % RIFF.length] * 2, 0.12, 'triangle', perfect ? 0.12 : 0.06)
      if (perfect) tone(RIFF[i % RIFF.length] * 4, 0.08, 'square', 0.03)
    },
    fail() {
      tone(120, 0.3, 'sawtooth', 0.25, 60)
    },
    cheer(n) {
      for (let i = 0; i < n; i++) tone(600 + Math.random() * 900, 0.18, 'triangle', 0.05, null, Math.random() * 0.1)
    },
    boo() {
      for (let i = 0; i < 4; i++) tone(180 + Math.random() * 60, 0.5, 'sawtooth', 0.04, 120, Math.random() * 0.15)
    },
    spark() {
      noise(0.04, 0.12, 4000)
    },
    solo() {
      ;[330, 392, 494, 659, 784].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.08, null, i * 0.07))
    },
    smash() {
      noise(0.5, 0.5, 1200)
      tone(90, 0.4, 'square', 0.2, 30)
      ;[1200, 900, 1500].forEach((f, i) => tone(f, 0.15, 'square', 0.08, 200, 0.1 + i * 0.08))
    },
    lightsOff() {
      tone(240, 0.25, 'square', 0.06, 60)
    },
    stop() {},
  }
}
