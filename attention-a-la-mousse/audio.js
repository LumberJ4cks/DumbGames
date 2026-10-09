/*
 * Attention à la mousse ! — sound: a fête-communale arcade loop that gains tempo and layers
 * with the crowd, boings for jumps, a ding for PARFAIT, roulé-boulé crashes, administrative
 * stamps for notifications, a whistle, and the announcer: the real « Attention à la mousse ! »
 * meme, cut into short clips in mousse.mp3 (the only recorded sound; the rest is synthesised).
 */
/**
 * The soundtrack: the meme's own recording (mousse.mp3, 1:27, looped) plays as the music of a
 * run. Clips of it can also be used as the announcer (SHOUT_CLIPS: [start, duration] in
 * seconds); the list is empty while the whole file is the soundtrack.
 */
export const TRACK_FILE = new URL('./mousse.mp3', import.meta.url).href
export const SHOUT_CLIPS = []
// The synthesised arcade loop under the track. Off: the recording carries the music.
export const SYNTH_MUSIC = false
// Level of the recording under the master gain (effects sit around 0.05–0.3 each).
export const TRACK_VOLUME = 1.6

export function createAudio() {
  let ac = null
  let master = null
  let muted = false
  let pumpTimer = null
  let heliTimer = null
  let nextStep = 0
  let step = 0
  let intensity = 0
  let lastFall = 0
  let lastJump = 0
  // The announcer: the real meme, cut into short clips (see SHOUTS), played from one buffer.
  let shoutBuffer = null
  let shoutLoading = null
  let shoutSrc = null
  let shoutGain = null
  let musicDuck = null

  function init() {
    if (ac) return
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = muted ? 0 : 0.4
    master.connect(ac.destination)
    // Music goes through a duck gain so the announcer stays intelligible above it.
    musicDuck = ac.createGain()
    musicDuck.connect(master)
    shoutGain = ac.createGain()
    shoutGain.gain.value = 1.6
    shoutGain.connect(master)
    loadShouts()
  }
  /** `at` is an absolute AudioContext time; null means now. */
  function tone(freq, dur, type, vol, slide, at = null, dest = null) {
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
    g.connect(dest || master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  function noise(dur, vol, cutoff, at = null, type = 'lowpass', dest = null) {
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
    g.connect(dest || master)
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
    const M = musicDuck
    if (i % 4 === 0) tone(110, 0.12, 'sine', 0.22, 40, t, M)
    if (intensity >= 2 && (i === 4 || i === 12)) noise(0.09, 0.16, 2500, t, 'highpass', M)
    // Hats: offbeats, then every sixteenth for the peloton.
    if (i % 4 === 2 || (intensity >= 4 && i % 2 === 1)) noise(0.025, 0.06 + intensity * 0.01, 7000, t, 'highpass', M)
    // Oom-pah bass.
    if (i % 4 === 0) tone(ROOTS[bar] * 2, 0.16, 'triangle', 0.16, null, t, M)
    if (i % 4 === 2) tone(ROOTS[bar] * 3, 0.1, 'triangle', 0.08, null, t, M)
    // Arpeggio from the duos.
    if (intensity >= 1 && i % 2 === 0) tone(chord[(i / 2) % 3] * 2, 0.08, 'square', 0.025 + intensity * 0.004, null, t, M)
    // Lead from the crowd onwards.
    if (intensity >= 3 && i % 2 === 0) {
      const n = LEAD[(bar % 2) * 8 + i / 2]
      if (n) tone(intensity >= 4 ? n * 2 : n, 0.14, 'square', 0.04, null, t, M)
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

  // Clips inside mousse.mp3: [start, duration] in seconds. `calm` ones open the run, the
  // others come with the crowd.
  const SHOUTS = SHOUT_CLIPS
  let trackSrc = null
  let trackGain = null
  let trackWanted = false
  function loadShouts() {
    if (shoutLoading || !ac) return
    shoutLoading = fetch(TRACK_FILE)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((buf) => ac.decodeAudioData(buf))
      .then((decoded) => {
        shoutBuffer = decoded
        if (trackWanted) startTrack()
      })
      .catch(() => {
        shoutBuffer = null
      })
  }

  function startTrack() {
    if (!ac || !shoutBuffer || trackSrc) return
    const src = ac.createBufferSource()
    src.buffer = shoutBuffer
    src.loop = true
    trackGain = ac.createGain()
    trackGain.gain.value = TRACK_VOLUME
    src.connect(trackGain)
    trackGain.connect(musicDuck)
    src.start(ac.currentTime + 0.02)
    trackSrc = src
  }
  function stopTrack() {
    if (!trackSrc) return
    try { trackSrc.stop() } catch {}
    trackSrc = null
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
    setIntensity(level) {
      intensity = level
    },
    /** Music of a run: the recording, looped (started as soon as it is decoded), plus the synth loop when enabled. */
    music(on) {
      if (!ac) return
      trackWanted = on
      if (on) startTrack()
      else stopTrack()
      if (!SYNTH_MUSIC) return
      if (on && pumpTimer === null) {
        step = 0
        nextStep = ac.currentTime + 0.05
        pumpTimer = setInterval(pump, 25)
      } else if (!on && pumpTimer !== null) {
        clearInterval(pumpTimer)
        pumpTimer = null
      }
    },
    /** Pause and resume keep the track's position (the whole context is suspended). */
    suspend() {
      if (ac && ac.state === 'running') ac.suspend().catch(() => {})
    },
    get playingTrack() {
      return !!trackSrc
    },
    /**
     * The announcer: one clip of the meme. Never queues: while a clip plays, the call is
     * skipped (returns false). `excitement` in [0, 1] picks calmer clips early, wilder ones
     * with the crowd. The music ducks under the voice.
     */
    say(excitement = 0) {
      if (!ac || !shoutBuffer || shoutSrc) return false
      const pool = SHOUTS.filter((c) => (excitement < 0.4 ? c.calm !== false : true))
      const list = pool.length ? pool : SHOUTS
      const clip = list[Math.floor(Math.random() * list.length)]
      if (!clip) return false
      const src = ac.createBufferSource()
      src.buffer = shoutBuffer
      src.connect(shoutGain)
      const t = ac.currentTime
      src.start(t, clip.at, clip.dur)
      shoutSrc = src
      src.onended = () => {
        if (shoutSrc === src) shoutSrc = null
      }
      const g = musicDuck.gain
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0.35, t + 0.05)
      g.setValueAtTime(0.35, t + clip.dur - 0.1)
      g.linearRampToValueAtTime(1, t + clip.dur + 0.3)
      return true
    },
    /** True once the meme clips are decoded (debug and tests). */
    get ready() {
      return !!shoutBuffer
    },
    hush() {
      if (shoutSrc) {
        try { shoutSrc.stop() } catch {}
        shoutSrc = null
      }
      if (musicDuck) musicDuck.gain.value = 1
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
    /** SCANDALE: crowd gasp and a sour brass chord. */
    scandal() {
      noise(0.5, 0.18, 900, null, 'bandpass')
      ;[233, 220, 208].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.06, null, later(i * 0.15)))
    },
    ola() {
      ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.07, null, later(i * 0.08)))
      noise(1.4, 0.16, 1800, later(0.1), 'bandpass')
    },
    coo() {
      tone(420, 0.18, 'sine', 0.05, 360)
      tone(400, 0.22, 'sine', 0.05, 330, later(0.25))
    },
    flap() {
      for (let i = 0; i < 6; i++) noise(0.03, 0.1, 2500, later(i * 0.05))
    },
    shutter() {
      noise(0.04, 0.3, 6000, null, 'highpass')
      tone(3000, 0.25, 'sine', 0.05, 5000, later(0.02))
    },
    /** PIN-PON, French fire engine two-tone. */
    siren() {
      for (let i = 0; i < 4; i++) {
        tone(435, 0.22, 'square', 0.06, null, later(i * 0.5))
        tone(488, 0.22, 'square', 0.06, null, later(i * 0.5 + 0.25))
      }
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
    /** Helicopter: a low rotor chop while it is on screen. */
    heli(on) {
      if (!ac) return
      if (on && !heliTimer) {
        const chop = () => {
          noise(0.05, 0.14, 500)
          tone(70, 0.08, 'sawtooth', 0.05, 60)
          heliTimer = setTimeout(chop, 95)
        }
        chop()
      } else if (!on && heliTimer) {
        clearTimeout(heliTimer)
        heliTimer = null
      }
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
