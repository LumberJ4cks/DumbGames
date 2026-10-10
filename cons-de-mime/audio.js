/*
 * Cons de mime ! — le son. La musique est l'enregistrement barrez-vous.mp3 (1:34, en boucle),
 * lancé au moment où Serge se met à courir. Tout le reste est synthétisé : la langue inaudible
 * du dialogue, le prout, les esquives, les combos, les gamelles, les explosions, le klaxon, le
 * tueur qui ricane, le sifflement pour la fille en jaune, le cri, le saut et le tampon.
 */
export const TRACK_FILE = new URL('./barrez-vous.mp3', import.meta.url).href
export const TRACK_VOLUME = 1.1
export const SFX_VOLUME = 2.8

export function createAudio() {
  let ac = null
  let master = null
  let sfxBus = null
  let musicBus = null
  let muted = false
  let trackBuffer = null
  let trackLoading = null
  let trackSrc = null
  let trackGain = null
  let trackWanted = false

  function init() {
    if (ac) return
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {}
    ac = new AudioContext()
    master = ac.createGain()
    master.gain.value = muted ? 0 : 0.4
    master.connect(ac.destination)
    sfxBus = ac.createGain()
    sfxBus.gain.value = SFX_VOLUME
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.12
    sfxBus.connect(comp)
    comp.connect(master)
    musicBus = ac.createGain()
    musicBus.connect(master)
    loadTrack()
  }
  function loadTrack() {
    if (trackLoading || !ac) return
    trackLoading = fetch(TRACK_FILE)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((buf) => ac.decodeAudioData(buf))
      .then((decoded) => {
        trackBuffer = decoded
        if (trackWanted) startTrack()
      })
      .catch(() => {
        trackBuffer = null
      })
  }
  function startTrack() {
    if (!ac || !trackBuffer || trackSrc) return
    const src = ac.createBufferSource()
    src.buffer = trackBuffer
    src.loop = true
    trackGain = ac.createGain()
    trackGain.gain.value = TRACK_VOLUME
    src.connect(trackGain)
    trackGain.connect(musicBus)
    src.start(ac.currentTime + 0.02)
    trackSrc = src
  }
  function stopTrack(fade = 0) {
    if (!trackSrc) return
    const src = trackSrc
    trackSrc = null
    try {
      if (fade > 0 && trackGain) {
        trackGain.gain.setValueAtTime(trackGain.gain.value, ac.currentTime)
        trackGain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + fade)
        src.stop(ac.currentTime + fade + 0.05)
      } else src.stop()
    } catch {}
  }

  /* ---------- briques ---------- */
  /** `at` : temps absolu de l'AudioContext ; null = maintenant. */
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
    g.connect(dest || sfxBus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  function noise(dur, vol, cutoff, at = null, type = 'lowpass', slideTo = null) {
    if (!ac) return
    const t = at ?? ac.currentTime
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ac.createBufferSource()
    src.buffer = buffer
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(cutoff, t)
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = ac.createGain()
    g.gain.value = vol
    src.connect(f)
    f.connect(g)
    g.connect(sfxBus)
    src.start(t)
  }
  const now = () => (ac ? ac.currentTime : 0)

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
    /** La musique : lancée quand Serge court, coupée (en fondu) au retour au titre. */
    music(on, fade = 0) {
      trackWanted = on
      if (on) startTrack()
      else stopTrack(fade)
    },
    duck(level) {
      if (musicBus) musicBus.gain.setTargetAtTime(level, now(), 0.08)
    },

    /* ---------- le dialogue : une langue inaudible, un bleep par syllabe ---------- */
    talk(who, text) {
      if (!ac) return
      const syll = Math.max(2, Math.min(14, Math.round(text.replace(/[^A-ZÀ-Ü]/gi, '').length / 2.2)))
      const base = who === 'martine' ? 520 : 240
      let t = now() + 0.05
      for (let i = 0; i < syll; i++) {
        const f = base * (0.85 + Math.random() * 0.5)
        const dur = 0.05 + Math.random() * 0.05
        tone(f, dur, who === 'martine' ? 'triangle' : 'square', who === 'martine' ? 0.09 : 0.11, f * (Math.random() < 0.5 ? 1.25 : 0.8), t)
        t += dur + 0.03 + Math.random() * 0.04
      }
      // La ponctuation : point d'interrogation qui monte, exclamation qui tape.
      if (/\?/.test(text)) tone(base * 1.6, 0.14, 'triangle', 0.1, base * 2.4, t)
      else if (/!/.test(text)) tone(base * 0.9, 0.1, 'square', 0.13, base * 0.6, t)
    },
    click() {
      tone(900, 0.04, 'square', 0.06, 700)
    },
    /** Le départ : Serge voit le tueur. Une alerte courte, puis la musique prend. */
    alarm() {
      tone(880, 0.08, 'square', 0.12, 1320)
      tone(1320, 0.12, 'square', 0.12, 1760, now() + 0.09)
    },

    /* ---------- la course ---------- */
    fart() {
      const t = now()
      tone(95, 0.42, 'sawtooth', 0.22, 38, t)
      tone(140, 0.3, 'square', 0.08, 55, t + 0.02)
      noise(0.45, 0.25, 380, t, 'lowpass', 120)
      // Le boost : un souffle qui monte.
      noise(0.5, 0.12, 900, t + 0.1, 'bandpass', 2400)
    },
    nearMiss(combo) {
      const f = 660 * Math.pow(1.06, Math.min(24, combo))
      tone(f, 0.06, 'square', 0.07, f * 1.3)
    },
    combo(level) {
      const t = now()
      const notes = [523, 659, 784, 1047, 1319].slice(0, Math.min(5, level + 2))
      notes.forEach((f, i) => tone(f, 0.12, 'square', 0.1, null, t + i * 0.07))
    },
    comboLost() {
      const t = now()
      tone(420, 0.18, 'sawtooth', 0.1, 150, t)
      tone(300, 0.25, 'square', 0.08, 90, t + 0.12)
    },
    trip(kind) {
      const t = now()
      noise(0.12, 0.3, 800, t, 'lowpass', 200) // le choc
      tone(180, 0.1, 'square', 0.12, 60, t)
      // L'« aïe » : une petite voix qui descend.
      tone(kind === 'mime' ? 520 : 380, 0.22, 'triangle', 0.1, kind === 'mime' ? 180 : 140, t + 0.1)
      if (kind === 'mime') tone(330, 0.12, 'square', 0.08, 220, t + 0.3) // bonk sur le mur
    },
    knock() {
      const t = now()
      noise(0.14, 0.22, 500, t, 'lowpass', 150)
      tone(120, 0.12, 'triangle', 0.12, 50, t)
    },
    explode() {
      const t = now()
      noise(0.55, 0.45, 2500, t, 'lowpass', 100)
      tone(110, 0.4, 'sawtooth', 0.2, 30, t)
      tone(60, 0.5, 'sine', 0.3, 25, t + 0.03)
    },
    horn() {
      const t = now()
      for (const [d, f] of [[0, 330], [0.18, 262]]) {
        tone(f, 0.28, 'sawtooth', 0.14, null, t + d)
        tone(f * 1.5, 0.28, 'square', 0.06, null, t + d)
      }
    },
    splat() {
      const t = now()
      noise(0.25, 0.4, 1200, t, 'lowpass', 150)
      tone(90, 0.3, 'triangle', 0.25, 30, t)
      noise(0.5, 0.15, 300, t + 0.1, 'bandpass', 120) // ça gicle
    },
    taunt() {
      const t = now()
      ;[0, 0.11, 0.22].forEach((d, i) => tone(300 - i * 40, 0.09, 'square', 0.09, 220 - i * 40, t + d))
    },
    whistle() {
      const t = now()
      tone(900, 0.22, 'sine', 0.14, 1800, t)
      tone(1700, 0.3, 'sine', 0.14, 800, t + 0.25)
    },
    wobble() {
      const t = now()
      for (let i = 0; i < 5; i++) tone(i % 2 ? 500 : 380, 0.08, 'triangle', 0.07, null, t + i * 0.07)
    },
    immune() {
      tone(240, 0.1, 'square', 0.08, 240)
    },
    tick(last) {
      tone(last ? 1200 : 900, 0.03, 'square', last ? 0.1 : 0.06, null)
    },

    /* ---------- la fin ---------- */
    climb() {
      const t = now()
      for (let i = 0; i < 6; i++) noise(0.05, 0.15, 600, t + i * 0.08, 'lowpass', 300)
    },
    shout() {
      const t = now()
      // Un cuivre qui monte sur deux temps, puis la foule qui hoquète.
      tone(220, 0.35, 'sawtooth', 0.16, 330, t)
      tone(330, 0.5, 'sawtooth', 0.18, 440, t + 0.3)
      tone(440, 0.6, 'square', 0.1, 660, t + 0.3)
      noise(0.8, 0.12, 1500, t + 0.9, 'bandpass', 600) // le hoquet des mimes
    },
    gasp() {
      noise(0.18, 0.1, 1800, null, 'bandpass', 900)
    },
    jump() {
      const t = now()
      tone(300, 0.5, 'sine', 0.12, 900, t)
      noise(0.7, 0.15, 400, t, 'bandpass', 2000)
    },
    land() {
      const t = now()
      noise(0.2, 0.35, 700, t, 'lowpass', 120)
      tone(100, 0.2, 'triangle', 0.2, 40, t)
    },
    stamp() {
      const t = now()
      noise(0.08, 0.4, 2000, t, 'lowpass', 300)
      tone(150, 0.15, 'square', 0.18, 60, t)
      tone(80, 0.25, 'sine', 0.25, 40, t + 0.02)
    },
    fanfare() {
      const t = now()
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.14, 'square', 0.1, null, t + i * 0.12))
    },
  }
}
