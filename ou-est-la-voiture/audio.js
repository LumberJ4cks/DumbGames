/*
 * Où est la voiture ? — sound: cup swishes, lifts, the stamp, the buzzer, the sneaky hand,
 * a slow clap and the pound's siren. Synthesised with Web Audio, nothing sampled.
 */
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

  return {
    init,
    resume() {
      init()
      return ac.resume()
    },
    swish() {
      noise(0.09, 0.18, 2500)
    },
    lift() {
      tone(300, 0.08, 'square', 0.08, 600)
    },
    drop() {
      tone(200, 0.08, 'square', 0.1, 90)
      noise(0.05, 0.15, 1200)
    },
    tap() {
      noise(0.03, 0.2, 3000)
    },
    stamp() {
      noise(0.08, 0.5, 700)
      tone(110, 0.12, 'square', 0.2, 60)
      ;[659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, null, 0.1 + i * 0.07))
    },
    buzz() {
      tone(160, 0.25, 'sawtooth', 0.25, 110)
      tone(110, 0.3, 'sawtooth', 0.2, 70, 0.22)
    },
    hand() {
      for (let i = 0; i < 4; i++) tone(1200 + i * 150, 0.04, 'square', 0.05, null, i * 0.06)
    },
    clap() {
      noise(0.06, 0.4, 1500)
      noise(0.06, 0.4, 1500, 0.55)
      noise(0.06, 0.4, 1500, 1.1)
    },
    siren() {
      for (let i = 0; i < 4; i++) tone(i % 2 ? 760 : 580, 0.18, 'square', 0.08, null, i * 0.18)
    },
    tick() {
      tone(1500, 0.03, 'square', 0.08)
    },
    paper() {
      noise(0.15, 0.2, 1800)
    },
    end() {
      ;[523, 494, 440, 392].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, null, i * 0.2))
    },
    boot() {
      noise(0.2, 0.1, 800)
      ;[392, 523, 659].forEach((f, i) => tone(f, 0.4, 'sine', 0.2, null, 0.2 + i * 0.12))
    },
  }
}
