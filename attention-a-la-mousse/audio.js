/*
 * Attention à la mousse ! — sound: a fête-communale arcade loop that gains tempo and layers
 * with the crowd, boings for jumps, a ding for PARFAIT, roulé-boulé crashes, administrative
 * stamps for notifications, a whistle, and the announcer's voice through the browser's speech
 * synthesis (French voice when one is installed). Everything is local, nothing is downloaded.
 */
export function createAudio() {
  let ac = null
  let master = null
  let muted = false
  let pumpTimer = null
  let nextStep = 0
  let step = 0
  let intensity = 0
  let lastFall = 0
  let lastJump = 0
  let voiceFr = null

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
  /** `at` is an absolute AudioContext time; null means now. */
  function tone(freq, dur, type, vol, slide, at = null) {
    if (!ac) return
    const t = at ?? ac.currentTime
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  function noise(dur, vol, cutoff, at = null, type = 'lowpass') {
    if (!ac) return
    const t = at ?? ac.currentTime
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ac.createBufferSource()
    src.buffer = buffer
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.value = cutoff
    const g = ac.createGain()
    g.gain.value = vol
    src.connect(f)
    f.connect(g)
    g.connect(master)
    src.start(t)
  }
  const later = (d) => (ac ? ac.currentTime + d : 0)

  /* ---------- music: C – Am – F – G, sixteen steps a bar, four bars ---------- */
  const BPM = [118, 126, 136, 148, 166]
  const ROOTS = [65.41, 55, 43.65, 49]
  const CHORDS = [
    [262, 330, 392],
    [220, 262, 330],
    [175, 220, 262],
    [196, 247, 294],
  ]
  // A brass-band-ish lead, one note per eighth (0 = rest), over the four bars.
  const LEAD = [523, 659, 784, 659, 587, 523, 440, 0, 523, 440, 392, 523, 698, 659, 587, 0]
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 4
    const i = s % 16
    const chord = CHORDS[bar]
    // Kick on the beat, a little snare from the third phase.
    if (i % 4 === 0) tone(110, 0.12, 'sine', 0.22, 40, t)
    if (intensity >= 2 && (i === 4 || i === 12)) noise(0.09, 0.16, 2500, t, 'highpass')
    // Hats: offbeats, then every sixteenth for the peloton.
    if (i % 4 === 2 || (intensity >= 4 && i % 2 === 1)) noise(0.025, 0.06 + intensity * 0.01, 7000, t, 'highpass')
    // Oom-pah bass.
    if (i % 4 === 0) tone(ROOTS[bar] * 2, 0.16, 'triangle', 0.16, null, t)
    if (i % 4 === 2) tone(ROOTS[bar] * 3, 0.1, 'triangle', 0.08, null, t)
    // Arpeggio from the duos.
    if (intensity >= 1 && i % 2 === 0) tone(chord[(i / 2) % 3] * 2, 0.08, 'square', 0.025 + intensity * 0.004, null, t)
    // Lead from the crowd onwards.
    if (intensity >= 3 && i % 2 === 0) {
      const n = LEAD[(bar % 2) * 8 + i / 2]
      if (n) tone(intensity >= 4 ? n * 2 : n, 0.14, 'square', 0.04, null, t)
    }
  }
  function pump() {
    if (!ac) return
    const sixteenth = 60 / BPM[Math.min(BPM.length - 1, intensity)] / 4
    while (nextStep < ac.currentTime + 0.12) {
      playStep(step, nextStep)
      nextStep += sixteenth
      step++
    }
  }

  function pickVoice() {
    try {
      const voices = speechSynthesis.getVoices()
      voiceFr = voices.find((v) => v.lang === 'fr-FR') || voices.find((v) => v.lang && v.lang.startsWith('fr')) || null
    } catch {}
  }
  try {
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
    pickVoice()
  } catch {}

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
      if (muted) try { speechSynthesis.cancel() } catch {}
    },
    setIntensity(level) {
      intensity = level
    },
    music(on) {
      if (!ac) return
      if (on && pumpTimer === null) {
        step = 0
        nextStep = ac.currentTime + 0.05
        pumpTimer = setInterval(pump, 25)
      } else if (!on && pumpTimer !== null) {
        clearInterval(pumpTimer)
        pumpTimer = null
      }
    },
    /** The announcer. Never queues: if the previous line is still being said, this one is skipped. */
    say(text, excitement = 0) {
      if (muted || typeof speechSynthesis === 'undefined') return false
      try {
        if (speechSynthesis.speaking || speechSynthesis.pending) return false
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'fr-FR'
        if (voiceFr) u.voice = voiceFr
        u.rate = 1.05 + excitement * 0.18
        u.pitch = 1 + excitement * 0.2
        u.volume = 1
        speechSynthesis.speak(u)
        return true
      } catch {
        return false
      }
    },
    /** iOS only lets speech start from a user gesture: say nothing once inside the tap. */
    primeVoice() {
      if (muted || typeof speechSynthesis === 'undefined') return
      try {
        const u = new SpeechSynthesisUtterance(' ')
        u.volume = 0
        speechSynthesis.speak(u)
      } catch {}
    },
    hush() {
      try { speechSynthesis.cancel() } catch {}
    },
    /** n patineurs en l'air d'un coup : a stiffer, fuller boing for groups. */
    jump(n, perfect) {
      if (!ac) return
      const now = ac.currentTime
      if (now - lastJump < 0.04) return
      lastJump = now
      tone(220, 0.18, 'square', 0.09, 660)
      if (n > 1) tone(330, 0.18, 'square', 0.06, 990, later(0.01))
      if (n > 4) tone(165, 0.22, 'triangle', 0.1, 495)
      if (perfect) {
        tone(1568, 0.12, 'triangle', 0.12, null, later(0.04))
        tone(2093, 0.18, 'triangle', 0.1, null, later(0.1))
      }
    },
    land() {
      noise(0.04, 0.08, 1500)
    },
    /** FAUX DÉPART: the steward's double whistle, sour. */
    falseStart() {
      tone(1900, 0.09, 'square', 0.06, 1700)
      tone(1900, 0.16, 'square', 0.06, 1500, later(0.12))
      noise(0.06, 0.08, 600)
    },
    whiff() {
      noise(0.06, 0.08, 600)
      tone(180, 0.06, 'sine', 0.05, 120)
    },
    /** Roulé-boulé : scream down, thuds, a ratchet of wheels. Rate limited for the peloton. */
    fall() {
      if (!ac) return
      const now = ac.currentTime
      if (now - lastFall < 0.09) return
      lastFall = now
      const p = 700 + Math.random() * 500
      tone(p, 0.35, 'sawtooth', 0.05, p / 3)
      noise(0.08, 0.35, 500, later(0.12))
      noise(0.07, 0.25, 400, later(0.26))
      noise(0.06, 0.2, 350, later(0.38))
      for (let i = 0; i < 4; i++) tone(1200 + i * 90, 0.02, 'square', 0.03, null, later(0.15 + i * 0.05))
    },
    levelUp(level) {
      ;[523, 659, 784, 1047].slice(0, 2 + level).forEach((f, i) => tone(f, 0.14, 'square', 0.07, null, later(i * 0.06)))
    },
    levelDown() {
      tone(392, 0.15, 'square', 0.06, 330)
      tone(330, 0.2, 'square', 0.06, 262, later(0.12))
    },
    /** Administrative stamp. */
    stamp() {
      noise(0.05, 0.3, 900)
      tone(90, 0.08, 'sine', 0.15, 60)
    },
    cheer(amount = 1) {
      noise(0.6, 0.06 + 0.05 * amount, 1800, null, 'bandpass')
    },
    whistle() {
      tone(2600, 0.25, 'square', 0.05, 2500)
      tone(2650, 0.4, 'sine', 0.08, 2600, later(0.28))
    },
    results() {
      ;[392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, 0.22, 'square', 0.07, null, later(i * 0.12)))
      noise(1.2, 0.1, 1800, later(0.2), 'bandpass')
    },
  }
}
