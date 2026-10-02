/*
 * Grand Theft FIFA audio: engine, tyres, crashes, horns, sirens, the GPS chime, and four radio
 * stations synthesised as short loops. Nothing sampled.
 */
export function createAudio() {
  let ac = null
  let master = null
  let engineOsc = null
  let engineGain = null
  let screechGain = null
  let sirenTimer = null
  let radioTimer = null
  let radioStep = 0
  let radioName = null

  function init() {
    if (ac) return
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = 0.4
    master.connect(ac.destination)
    // Engine: a sawtooth whose pitch follows the speed.
    engineOsc = ac.createOscillator()
    engineOsc.type = 'sawtooth'
    engineOsc.frequency.value = 40
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    engineGain = ac.createGain()
    engineGain.gain.value = 0
    engineOsc.connect(lp)
    lp.connect(engineGain)
    engineGain.connect(master)
    engineOsc.start()
    // Tyre screech: filtered noise, opened while drifting.
    const buffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2200
    bp.Q.value = 6
    screechGain = ac.createGain()
    screechGain.gain.value = 0
    src.connect(bp)
    bp.connect(screechGain)
    screechGain.connect(master)
    src.start()
  }

  function tone(freq, t, dur, type, vol, slide) {
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
  function noise(t, dur, vol, lowpass) {
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ac.createBufferSource()
    src.buffer = buffer
    const g = ac.createGain()
    g.gain.value = vol
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lowpass
    src.connect(f)
    f.connect(g)
    g.connect(master)
    src.start(t)
  }

  /* ---------- radio stations ---------- */
  const STATIONS = {
    'FIFA FM': { tempo: 132, notes: [523, 659, 784, 1047, 784, 659, 523, 392], type: 'square', vol: 0.06, bass: [262, 262, 349, 392] },
    'INFO 24': { tempo: 110, notes: [880, 0, 880, 0, 1175, 0, 0, 0], type: 'triangle', vol: 0.05, bass: [220, 0, 220, 0] },
    'RADIO FOOT': { tempo: 96, notes: [196, 220, 196, 175, 0, 196, 0, 220], type: 'sawtooth', vol: 0.04, bass: [98, 110, 98, 87] },
    'ADMIN FM': { tempo: 72, notes: [392, 494, 587, 494, 440, 523, 659, 523], type: 'sine', vol: 0.06, bass: [196, 0, 0, 220] },
  }
  function scheduleRadio() {
    if (!radioName) return
    const st = STATIONS[radioName]
    const t = ac.currentTime + 0.05
    const beat = 60 / st.tempo
    const n = st.notes[radioStep % st.notes.length]
    if (n) tone(n, t, beat * 0.5, st.type, st.vol)
    const b = st.bass[Math.floor(radioStep / 2) % st.bass.length]
    if (b && radioStep % 2 === 0) tone(b, t, beat * 0.8, 'triangle', st.vol * 1.5)
    radioStep++
    radioTimer = setTimeout(scheduleRadio, beat * 500)
  }

  return {
    init,
    resume() {
      init()
      return ac.resume()
    },
    /** speed 0..1, throttle boolean */
    engine(speed, throttle) {
      if (!ac) return
      engineOsc.frequency.setTargetAtTime(40 + speed * 140, ac.currentTime, 0.05)
      engineGain.gain.setTargetAtTime(throttle ? 0.07 : 0.025 + speed * 0.02, ac.currentTime, 0.1)
    },
    screech(on) {
      if (!ac) return
      screechGain.gain.setTargetAtTime(on ? 0.12 : 0, ac.currentTime, 0.05)
    },
    crash(force) {
      if (!ac) return
      noise(ac.currentTime, 0.25, Math.min(0.6, 0.15 + force * 0.4), 900)
      tone(80, ac.currentTime, 0.2, 'square', 0.15, 40)
    },
    clink() {
      if (!ac) return
      tone(1400 + Math.random() * 800, ac.currentTime, 0.08, 'square', 0.08, 600)
      noise(ac.currentTime, 0.08, 0.15, 3000)
    },
    horn() {
      if (!ac) return
      const t = ac.currentTime
      tone(440, t, 0.35, 'square', 0.08)
      tone(554, t, 0.35, 'square', 0.08)
    },
    shout() {
      if (!ac) return
      tone(600, ac.currentTime, 0.15, 'sawtooth', 0.05, 900)
    },
    siren(on) {
      if (!ac) return
      if (on && !sirenTimer) {
        let hi = false
        const beep = () => {
          tone(hi ? 760 : 580, ac.currentTime, 0.4, 'square', 0.03)
          hi = !hi
          sirenTimer = setTimeout(beep, 400)
        }
        beep()
      } else if (!on && sirenTimer) {
        clearTimeout(sirenTimer)
        sirenTimer = null
      }
    },
    chime() {
      if (!ac) return
      const t = ac.currentTime
      tone(880, t, 0.12, 'sine', 0.25)
      tone(1175, t + 0.13, 0.25, 'sine', 0.25)
    },
    jingle() {
      if (!ac) return
      const t = ac.currentTime
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.4, 'triangle', 0.25))
    },
    error() {
      if (!ac) return
      tone(180, ac.currentTime, 0.2, 'sawtooth', 0.25, 120)
      tone(120, ac.currentTime + 0.2, 0.3, 'sawtooth', 0.25, 70)
    },
    ring() {
      if (!ac) return
      const t = ac.currentTime
      for (let i = 0; i < 6; i++) tone(i % 2 ? 1320 : 1100, t + i * 0.06, 0.05, 'square', 0.06)
    },
    spray() {
      if (!ac) return
      noise(ac.currentTime, 1.2, 0.2, 4000)
      noise(ac.currentTime + 1.4, 0.8, 0.2, 4000)
    },
    boom() {
      if (!ac) return
      noise(ac.currentTime, 0.9, 0.7, 500)
      tone(60, ac.currentTime, 0.8, 'sine', 0.4, 20)
    },
    radio(name) {
      if (!ac) return
      if (radioTimer) clearTimeout(radioTimer)
      radioTimer = null
      radioName = name
      radioStep = 0
      if (name) scheduleRadio()
    },
    stop() {
      this.radio(null)
      this.siren(false)
      if (engineGain) engineGain.gain.value = 0
      if (screechGain) screechGain.gain.value = 0
    },
  }
}
