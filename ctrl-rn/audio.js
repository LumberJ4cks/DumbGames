/*
 * CTRL + RN audio: a cheerful corporate "MIDI" loop whose tempo rises and whose notes start
 * slipping as the desktop fills up, plus a handful of generic 90s-OS sound effects.
 * Everything is synthesised with Web Audio, nothing is sampled.
 */
export function createAudio() {
  let ac = null
  let master = null
  let musicGain = null
  let loopTimer = null
  let step = 0
  let tempo = 100
  let chaos = 0
  let playing = false

  function init() {
    if (ac) return
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = 0.35
    master.connect(ac.destination)
    musicGain = ac.createGain()
    musicGain.gain.value = 0.5
    musicGain.connect(master)
  }

  function tone(freq, t, dur, type, vol, dest, slide) {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest || master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  function noise(t, dur, vol, lowpass) {
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ac.createBufferSource()
    src.buffer = buffer
    const g = ac.createGain()
    g.gain.value = vol
    let node = src
    if (lowpass) {
      const f = ac.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = lowpass
      src.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(master)
    src.start(t)
  }

  /* ---------- music: I–V–vi–IV in C, bouncy bass and a chirpy lead ---------- */
  const CHORDS = [
    [261.63, 329.63, 392.0],
    [392.0, 493.88, 587.33],
    [440.0, 523.25, 659.25],
    [349.23, 440.0, 523.25],
  ]
  const BASS = [130.81, 196.0, 220.0, 174.61]
  const LEAD = [0, 2, 1, 2, 0, 1, 2, 1]

  function scheduleStep() {
    if (!playing) return
    const t = ac.currentTime + 0.05
    const beat = 60 / tempo
    const chord = CHORDS[Math.floor(step / 8) % 4]
    const bass = BASS[Math.floor(step / 8) % 4]
    const slip = () => (chaos > 0 && Math.random() < chaos ? 1 + (Math.random() - 0.5) * chaos * 0.6 : 1)
    const drop = chaos > 0.3 && Math.random() < chaos * 0.4
    if (step % 2 === 0 && !drop) tone(bass * slip(), t, beat * 0.9, 'triangle', 0.35, musicGain)
    if (step % 4 === 0) for (const f of chord) tone(f * slip(), t, beat * 1.6, 'square', 0.05, musicGain)
    const lead = chord[LEAD[step % 8]] * 2
    if (!drop) tone(lead * slip(), t + (chaos > 0.5 ? Math.random() * 0.08 : 0), beat * 0.5, 'square', 0.08, musicGain)
    if (step % 2 === 1) noise(t, 0.04, 0.08, 6000)
    step++
    loopTimer = setTimeout(scheduleStep, beat * 500)
  }

  return {
    init,
    resume() {
      init()
      return ac.resume()
    },
    startMusic() {
      init()
      if (playing) return
      playing = true
      step = 0
      tempo = 100
      chaos = 0
      scheduleStep()
    },
    stopMusic() {
      playing = false
      if (loopTimer) clearTimeout(loopTimer)
      loopTimer = null
    },
    /** 0 = calm, 1 = full panic: faster and sloppier. */
    setIntensity(level) {
      tempo = 100 + level * 80
      chaos = Math.max(0, (level - 0.4) / 0.6)
    },
    click() {
      if (!ac) return
      noise(ac.currentTime, 0.03, 0.25, 3000)
    },
    key() {
      if (!ac) return
      tone(1800 + Math.random() * 600, ac.currentTime, 0.03, 'square', 0.04)
    },
    ding() {
      if (!ac) return
      const t = ac.currentTime
      tone(880, t, 0.25, 'sine', 0.3)
      tone(1318.5, t + 0.12, 0.4, 'sine', 0.3)
    },
    chime() {
      // The happy "everything went fine" jingle, used at the worst moments.
      if (!ac) return
      const t = ac.currentTime
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.35, 'triangle', 0.25))
    },
    error() {
      if (!ac) return
      const t = ac.currentTime
      tone(180, t, 0.18, 'sawtooth', 0.3, null, 120)
      tone(120, t + 0.18, 0.25, 'sawtooth', 0.3, null, 80)
    },
    paper() {
      if (!ac) return
      noise(ac.currentTime, 0.12, 0.2, 1500)
    },
    tac() {
      if (!ac) return
      noise(ac.currentTime, 0.05, 0.4, 900)
      tone(90, ac.currentTime, 0.08, 'square', 0.15)
    },
    boot() {
      if (!ac) return
      const t = ac.currentTime
      noise(t, 0.3, 0.15, 800)
      ;[392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + 0.3 + i * 0.15, 0.5, 'sine', 0.25))
    },
    modem() {
      if (!ac) return
      const t = ac.currentTime
      for (let i = 0; i < 6; i++) tone(900 + (i % 2) * 700, t + i * 0.12, 0.1, 'square', 0.08)
      noise(t + 0.75, 0.5, 0.12, 2500)
    },
    smokeHiss() {
      if (!ac) return
      noise(ac.currentTime, 0.6, 0.05, 1200)
    },
  }
}
