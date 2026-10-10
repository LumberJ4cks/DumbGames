/*
 * SIUUUU SIMULATOR — sound. The soundtrack is siuuuu.mp3 (1:02, looped, sped up during the
 * Fever); the chiptune loop below only plays if the file cannot be loaded. Everything else is
 * synthesised with Web Audio after the first user interaction: a crowd bed (filtered noise
 * that swells with the score),
 * the jump blip, the rising spin tone (held while the key is held), four landing verdicts
 * (a stylised "SIUUU" shout, a modest one, a squeak and a slapstick thud), the Fever sting and
 * the stadium event sting. No recording of anyone is used.
 */
export const TRACK_FILE = new URL('./siuuuu.mp3', import.meta.url).href
export const TRACK_VOLUME = 0.9
// The "SIUUU" shout recorded for the game (1.5 s): played on PERFECT, softer on GOOD.
export const SHOUT_FILE = new URL('./siuuu-cri.mp3', import.meta.url).href
export const SHOUT_VOLUME = 0.7
// The crowd bed is a background texture: keep it low under the music and the shout.
export const CROWD_BASE = 0.1
export const CROWD_SWELL = 0.3

export function createAudio() {
  let ac = null
  let trackBuffer = null
  let shoutBuffer = null
  let trackSrc = null
  let trackWanted = false
  let trackFailed = false
  let master = null
  let music = null
  let crowd = null
  let crowdGain = null
  let spin = null
  let muted = false
  let musicTimer = null
  let step = 0
  let tempo = 1

  function init() {
    if (ac) return
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = muted ? 0 : 0.45
    master.connect(ac.destination)
    music = ac.createGain()
    music.gain.value = 0.5
    music.connect(master)
    startCrowd()
    fetch(TRACK_FILE)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((data) => ac.decodeAudioData(data))
      .then((buffer) => {
        trackBuffer = buffer
        if (trackWanted) startMusic()
      })
      .catch(() => {
        trackFailed = true
        if (trackWanted) startMusic()
      })
    fetch(SHOUT_FILE)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((data) => ac.decodeAudioData(data))
      .then((buffer) => {
        shoutBuffer = buffer
      })
      .catch(() => {})
  }
  /** Plays the recorded shout; falls back to the synthesised one when the file is missing. */
  function playShout(vol, rate, fallback) {
    if (!ac || !shoutBuffer) return fallback()
    const src = ac.createBufferSource()
    src.buffer = shoutBuffer
    src.playbackRate.value = rate
    const g = ac.createGain()
    g.gain.value = vol
    src.connect(g)
    g.connect(master)
    src.start()
  }
  function resume() {
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
  }

  function tone(freq, dur, type, vol, slide, delay = 0, dest = master) {
    if (!ac) return null
    const t = ac.currentTime + delay
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest)
    o.start(t)
    o.stop(t + dur + 0.05)
    return o
  }
  function noise(dur, vol, lowpass, delay = 0, highpass = 0) {
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
    if (highpass) {
      const h = ac.createBiquadFilter()
      h.type = 'highpass'
      h.frequency.value = highpass
      f.connect(h)
      h.connect(g)
    } else f.connect(g)
    g.connect(master)
    src.start(t)
  }

  /* ---------- crowd bed: looping noise through a wandering band-pass ---------- */
  function startCrowd() {
    const len = 4
    const buffer = ac.createBuffer(2, ac.sampleRate * len, ac.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buffer.getChannelData(c)
      let v = 0
      for (let i = 0; i < d.length; i++) {
        v = v * 0.97 + (Math.random() * 2 - 1) * 0.06
        d[i] = v
      }
    }
    crowd = ac.createBufferSource()
    crowd.buffer = buffer
    crowd.loop = true
    const f = ac.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 500
    f.Q.value = 0.6
    const lfo = ac.createOscillator()
    lfo.frequency.value = 0.17
    const lg = ac.createGain()
    lg.gain.value = 180
    lfo.connect(lg)
    lg.connect(f.frequency)
    lfo.start()
    crowdGain = ac.createGain()
    crowdGain.gain.value = CROWD_BASE
    crowd.connect(f)
    f.connect(crowdGain)
    crowdGain.connect(master)
    crowd.start()
  }
  function setCrowd(level) {
    if (!crowdGain) return
    crowdGain.gain.setTargetAtTime(CROWD_BASE + Math.min(1, level) * CROWD_SWELL, ac.currentTime, 0.3)
  }
  function roar(strength = 1, delay = 0) {
    if (!ac) return
    noise(1.2 * strength + 0.4, 0.5 * strength, 1800, delay, 200)
    noise(0.8, 0.3 * strength, 900, delay + 0.15, 150)
  }

  /* ---------- chiptune loop: square lead, triangle bass, hat ---------- */
  const LEAD = [0, 0, 7, 7, 10, 7, 5, 3, 0, 0, 7, 7, 12, 10, 7, 5, 3, 3, 10, 10, 7, 5, 3, 0, 3, 5, 7, 10, 12, 10, 7, 5]
  const BASS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 7, 7, 7, 7]
  const note = (n, base) => base * Math.pow(2, n / 12)
  function startMusic() {
    trackWanted = true
    if (!ac) return
    if (trackBuffer) {
      if (trackSrc) return
      const src = ac.createBufferSource()
      src.buffer = trackBuffer
      src.loop = true
      src.playbackRate.value = tempo
      const g = ac.createGain()
      g.gain.value = TRACK_VOLUME
      src.connect(g)
      g.connect(music)
      src.start()
      trackSrc = src
      return
    }
    if (!trackFailed || musicTimer) return
    const tick = () => {
      const i = step % LEAD.length
      const d = 0.125 / tempo
      if (LEAD[i] >= 0 && !(step % 8 === 6 && step % 16 === 6)) tone(note(LEAD[i], 440), d * 0.9, 'square', 0.07, null, 0, music)
      if (i % 2 === 0) tone(note(BASS[i], 110), d * 1.6, 'triangle', 0.16, null, 0, music)
      if (i % 4 === 2) noise(0.03, 0.08, 9000, 0, 5000)
      if (i % 8 === 0) noise(0.08, 0.2, 300)
      step++
      musicTimer = setTimeout(tick, d * 1000)
    }
    tick()
  }
  function stopMusic() {
    trackWanted = false
    if (trackSrc) {
      try {
        trackSrc.stop()
      } catch {}
      trackSrc = null
    }
    if (musicTimer) clearTimeout(musicTimer)
    musicTimer = null
  }
  function setTempo(t) {
    tempo = t
    if (trackSrc && ac) trackSrc.playbackRate.setTargetAtTime(t, ac.currentTime, 0.2)
  }

  /* ---------- game sounds ---------- */
  function jump() {
    tone(300, 0.14, 'square', 0.18, 700)
    noise(0.08, 0.15, 2500)
  }
  function spinStart() {
    if (!ac) return
    spinStop()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(220, ac.currentTime)
    o.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 1.6)
    g.gain.setValueAtTime(0.0001, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.14, ac.currentTime + 0.05)
    o.connect(g)
    g.connect(master)
    o.start()
    spin = { o, g }
  }
  function spinStop() {
    if (!spin) return
    const { o, g } = spin
    spin = null
    g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03)
    o.stop(ac.currentTime + 0.2)
  }
  // "SIIIUUU": a sawtooth voice sliding from an "ee" to an "oo" through two formant filters.
  function shout(len, vol, pitch) {
    if (!ac) return
    const t = ac.currentTime
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(pitch, t)
    o.frequency.linearRampToValueAtTime(pitch * 1.12, t + len * 0.3)
    o.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + len)
    const vib = ac.createOscillator()
    vib.frequency.value = 6
    const vg = ac.createGain()
    vg.gain.value = pitch * 0.04
    vib.connect(vg)
    vg.connect(o.frequency)
    const f1 = ac.createBiquadFilter()
    f1.type = 'bandpass'
    f1.Q.value = 5
    f1.frequency.setValueAtTime(300, t)
    f1.frequency.linearRampToValueAtTime(350, t + len)
    const f2 = ac.createBiquadFilter()
    f2.type = 'bandpass'
    f2.Q.value = 6
    f2.frequency.setValueAtTime(2300, t)
    f2.frequency.linearRampToValueAtTime(800, t + len * 0.5)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04)
    g.gain.setValueAtTime(vol, t + len * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    o.connect(f1)
    o.connect(f2)
    f1.connect(g)
    f2.connect(g)
    g.connect(master)
    o.start(t)
    vib.start(t)
    o.stop(t + len + 0.1)
    vib.stop(t + len + 0.1)
  }
  function perfect() {
    playShout(SHOUT_VOLUME, 1, () => shout(1.1, 0.9, 330))
    tone(880, 0.1, 'square', 0.12, null, 0)
    tone(1320, 0.12, 'square', 0.12, null, 0.08)
    tone(1760, 0.3, 'square', 0.12, null, 0.16)
    roar(1, 0.05)
  }
  function good() {
    playShout(SHOUT_VOLUME * 0.55, 1.08, () => shout(0.55, 0.6, 290))
    tone(660, 0.1, 'square', 0.1, null, 0)
    tone(990, 0.2, 'square', 0.1, null, 0.08)
    roar(0.45, 0.05)
  }
  function bad() {
    tone(1800, 0.25, 'sine', 0.2, 2600)
    tone(900, 0.2, 'sine', 0.12, 500, 0.2)
    noise(0.2, 0.2, 1200, 0.1)
  }
  function fail() {
    tone(900, 0.5, 'sine', 0.18, 150)
    noise(0.25, 0.6, 400, 0.45)
    tone(80, 0.3, 'sine', 0.5, 40, 0.45)
    noise(0.5, 0.15, 3000, 0.55, 800)
  }
  function fever() {
    const seq = [440, 554, 659, 880, 1109, 1319]
    seq.forEach((f, i) => tone(f, 0.18, 'square', 0.12, null, i * 0.07))
    noise(0.6, 0.3, 4000, 0.4)
  }
  function event() {
    tone(220, 0.4, 'sawtooth', 0.18, 110)
    tone(330, 0.3, 'square', 0.12, null, 0.12)
    tone(440, 0.4, 'square', 0.12, null, 0.24)
    roar(1.2, 0.1)
  }
  function tick(last) {
    tone(last ? 1200 : 800, 0.08, 'square', 0.1)
  }
  function whistle() {
    tone(2400, 0.35, 'square', 0.15, 2500)
    tone(2400, 0.6, 'square', 0.15, 2600, 0.4)
  }
  function setMuted(v) {
    muted = v
    if (master) master.gain.setTargetAtTime(v ? 0 : 0.45, ac.currentTime, 0.02)
  }

  return {
    init, resume, startMusic, stopMusic, setTempo, setCrowd, roar,
    jump, spinStart, spinStop, perfect, good, bad, fail, fever, event, tick, whistle,
    setMuted,
    get muted() { return muted },
  }
}
