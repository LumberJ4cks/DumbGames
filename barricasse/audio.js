/*
 * BARRICASSE — sound. A repetitive, slightly martial and ridiculous chiptune march that gains
 * layers with the phases (never tempo), and synthesised effects for every rule: order, stock
 * ready, landing, bounce, destruction, loss, event. Per-object gags (beep beep, splatch,
 * metallic clang, duck squeak, flush, wrong note…). Everything is generated locally; nothing
 * starts before the first user gesture. Voices are capped so the final bursts never saturate.
 */
;(function () {
  'use strict'

  function createAudio() {
    let ac = null
    let master = null
    let sfx = null
    let music = null
    let muted = false
    let musicOn = false
    let layers = 0
    let truce = false
    let step = 0
    let nextStep = 0
    let timer = null
    let voices = 0
    const lastPlayed = {}
    const MAX_VOICES = 18

    function init() {
      if (ac) {
        if (ac.state === 'suspended') ac.resume().catch(() => {})
        return
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return
        ac = new AC()
      } catch {
        ac = null
        return
      }
      master = ac.createGain()
      master.gain.value = muted ? 0 : 0.5
      master.connect(ac.destination)
      sfx = ac.createGain()
      sfx.gain.value = 0.9
      sfx.connect(master)
      music = ac.createGain()
      music.gain.value = 0.32
      music.connect(master)
    }
    function setMuted(m) {
      muted = m
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.02)
    }
    /** Rate limit per sound and a global voice budget. */
    function allow(key, gap) {
      if (!ac || muted) return false
      const now = ac.currentTime
      if (lastPlayed[key] !== undefined && now - lastPlayed[key] < gap) return false
      if (voices >= MAX_VOICES) return false
      lastPlayed[key] = now
      return true
    }
    function track(node, end) {
      voices++
      node.onended = () => voices--
      node.stop(end)
    }
    function tone(freq, dur, type, vol, slide, at, dest) {
      if (!ac) return
      const t = at ?? ac.currentTime
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t)
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g)
      g.connect(dest || sfx)
      o.start(t)
      track(o, t + dur + 0.03)
    }
    let noiseBuffer = null
    function noise(dur, vol, cutoff, at, type = 'lowpass', sweepTo, dest) {
      if (!ac) return
      const t = at ?? ac.currentTime
      if (!noiseBuffer) {
        noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
        const d = noiseBuffer.getChannelData(0)
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      }
      const src = ac.createBufferSource()
      src.buffer = noiseBuffer
      const f = ac.createBiquadFilter()
      f.type = type
      f.frequency.setValueAtTime(cutoff, t)
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
      const g = ac.createGain()
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      src.connect(f)
      f.connect(g)
      g.connect(dest || sfx)
      src.start(t, Math.random() * 1.5)
      track(src, t + dur + 0.03)
    }
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

    /* ---------- effects ---------- */
    const FX = {
      send() {
        if (!allow('send', 0.05)) return
        noise(0.14, 0.12, 900, null, 'bandpass', 2600)
        tone(320, 0.09, 'square', 0.05, 640)
      },
      ready() {
        if (!allow('ready', 0.2)) return
        tone(988, 0.05, 'square', 0.035)
        tone(1319, 0.08, 'square', 0.03, null, ac.currentTime + 0.05)
      },
      refuse() {
        if (!allow('refuse', 0.25)) return
        tone(196, 0.08, 'square', 0.05, 160)
      },
      busy() {
        if (!allow('busy', 0.2)) return
        tone(150, 0.06, 'triangle', 0.08)
      },
      land(item) {
        if (!allow('land', 0.04)) return
        const t = ac.currentTime
        tone(140, 0.12, 'sine', 0.22, 60)
        noise(0.08, 0.12, 700)
        const extra = LAND[item]
        if (extra) extra(t)
      },
      wall() {
        if (!allow('wall', 0.05)) return
        tone(660, 0.03, 'square', 0.03)
      },
      destroy(item) {
        if (!allow('destroy', 0.03)) return
        const t = ac.currentTime
        noise(0.18, 0.22, 1800, t, 'lowpass', 300)
        tone(220, 0.1, 'square', 0.06, 90)
        const extra = BREAK[item]
        if (extra && allow('gag', 0.12)) extra(t)
      },
      hit() {
        // A sturdy object takes the hit and stays: dull thump, no crash.
        if (!allow('hit', 0.03)) return
        tone(170, 0.09, 'square', 0.08, 100)
        noise(0.07, 0.14, 1200)
      },
      kicked() {
        // The football: a ridiculous squeak and nothing else.
        if (!allow('kicked', 0.08)) return
        const t = ac.currentTime
        tone(900, 0.16, 'sine', 0.11, 2000, t)
        tone(1400, 0.1, 'sine', 0.06, 700, t + 0.15)
      },
      score(mult) {
        // Ball sent back: a short coin, higher with the multiplier.
        if (!allow('score', 0.05)) return
        const base = 660 * Math.pow(1.12, Math.min(8, mult - 1))
        tone(base, 0.05, 'square', 0.05)
        tone(base * 1.5, 0.07, 'square', 0.045, null, ac.currentTime + 0.045)
      },
      tier(mult) {
        // New combo multiplier: a little fanfare that climbs with the tier.
        if (!allow('tier', 0.2)) return
        const t = ac.currentTime
        const root = 64 + Math.min(4, mult) * 2
        ;[0, 4, 7, 12, 16].forEach((d, i) => tone(midi(root + d), 0.12, 'square', 0.07, null, t + i * 0.06))
        noise(0.3, 0.05, 6000, t + 0.25, 'highpass')
      },
      comboEnd() {
        if (!allow('comboEnd', 0.3)) return
        const t = ac.currentTime
        tone(520, 0.3, 'triangle', 0.08, 180, t)
        tone(390, 0.25, 'triangle', 0.05, 140, t + 0.1)
      },
      lost() {
        if (!allow('lost', 0.06)) return
        const t = ac.currentTime
        tone(620, 0.25, 'triangle', 0.16, 140)
        noise(0.2, 0.12, 2400, t, 'bandpass', 500)
      },
      toolate() {
        if (!allow('toolate', 0.1)) return
        tone(330, 0.12, 'sawtooth', 0.06, 300)
        tone(247, 0.2, 'sawtooth', 0.06, 230, ac.currentTime + 0.11)
      },
      announce() {
        if (!allow('announce', 0.08)) return
        tone(1760, 0.025, 'square', 0.02)
      },
      fire() {
        if (!allow('fire', 0.06)) return
        tone(110, 0.1, 'square', 0.1, 70)
        noise(0.06, 0.14, 1200)
      },
      evacuated() {
        if (!allow('evac', 0.1)) return
        tone(523, 0.06, 'triangle', 0.05)
        tone(392, 0.08, 'triangle', 0.04, null, ac.currentTime + 0.05)
      },
      top() {
        if (!allow('top', 0.1)) return
        noise(0.1, 0.05, 3000, null, 'highpass')
      },
      event() {
        if (!allow('event', 0.3)) return
        const t = ac.currentTime
        ;[67, 72, 76, 79].forEach((n, i) => tone(midi(n), 0.14, 'square', 0.07, null, t + i * 0.09))
      },
      whistle() {
        if (!allow('whistle', 0.3)) return
        const t = ac.currentTime
        const o = ac.createOscillator()
        const lfo = ac.createOscillator()
        const lg = ac.createGain()
        const g = ac.createGain()
        o.type = 'sine'
        o.frequency.value = 2400
        lfo.frequency.value = 38
        lg.gain.value = 120
        lfo.connect(lg)
        lg.connect(o.frequency)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
        g.gain.setValueAtTime(0.12, t + 0.38)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
        o.connect(g)
        g.connect(sfx)
        o.start(t)
        lfo.start(t)
        lfo.stop(t + 0.5)
        track(o, t + 0.5)
      },
      sizzle() {
        if (!allow('sizzle', 0.25)) return
        noise(0.35, 0.04, 5000, null, 'highpass')
      },
      start() {
        if (!allow('start', 0.3)) return
        const t = ac.currentTime
        ;[60, 64, 67, 72].forEach((n, i) => tone(midi(n), 0.12, 'square', 0.06, null, t + i * 0.07))
      },
      end(good) {
        if (!allow('end', 0.5)) return
        const t = ac.currentTime
        const seq = good ? [72, 76, 79, 84, 79, 84] : [67, 66, 65, 64, 52]
        seq.forEach((n, i) => tone(midi(n), 0.18, 'square', 0.07, null, t + i * 0.12))
      },
      click() {
        if (!allow('click', 0.05)) return
        tone(880, 0.03, 'square', 0.04)
      },
    }
    const LAND = {
      voiture(t) {
        tone(1175, 0.07, 'square', 0.06, null, t + 0.08)
        tone(1175, 0.07, 'square', 0.06, null, t + 0.2)
      },
      poisson(t) {
        noise(0.16, 0.25, 1400, t, 'bandpass', 300)
      },
      reverbere(t) {
        tone(120, 0.25, 'sawtooth', 0.03, null, t + 0.05)
        tone(1800, 0.03, 'square', 0.04, null, t + 0.05)
      },
      carton(t) {
        noise(0.25, 0.12, 5000, t, 'highpass')
        for (let i = 0; i < 4; i++) tone(2600 + i * 700, 0.08, 'sine', 0.04, null, t + 0.02 + i * 0.035)
      },
      barbecue(t) {
        noise(0.5, 0.06, 5000, t + 0.05, 'highpass')
      },
      parasol(t) {
        noise(0.09, 0.2, 600, t, 'lowpass', 2400)
      },
      piano(t) {
        tone(midi(43), 0.5, 'triangle', 0.1, null, t)
      },
      gateau(t) {
        tone(midi(84), 0.15, 'sine', 0.05, null, t + 0.05)
      },
      cheval(t) {
        tone(300, 0.1, 'triangle', 0.06, 380, t + 0.05)
      },
      trophee(t) {
        tone(midi(96), 0.2, 'sine', 0.04, null, t + 0.05)
      },
      planche(t) {
        tone(200, 0.06, 'square', 0.05, null, t + 0.25)
      },
    }
    const BREAK = {
      palette(t) {
        noise(0.6, 0.35, 2000, t, 'lowpass', 120)
        tone(60, 0.5, 'sine', 0.3, 35, t)
        tone(90, 0.3, 'square', 0.06, 40, t + 0.05)
      },
      poisson(t) {
        for (const f of [523, 1187, 1720, 2391]) tone(f, 0.9, 'sine', 0.07, f * 0.98, t)
      },
      ballon(t) {
        tone(900, 0.18, 'sine', 0.1, 1900, t)
      },
      baignoire(t) {
        tone(1300, 0.08, 'sine', 0.08, 1900, t + 0.05)
        tone(1300, 0.1, 'sine', 0.08, 2000, t + 0.17)
      },
      piano(t) {
        for (const n of [48, 52, 55, 60]) tone(midi(n), 0.7, 'triangle', 0.07, null, t)
        tone(midi(61), 0.5, 'triangle', 0.08, null, t + 0.45)
      },
      toilettes(t) {
        noise(1.1, 0.2, 2500, t, 'lowpass', 200)
      },
      reverbere(t) {
        tone(1500, 0.04, 'square', 0.06, null, t)
        noise(0.1, 0.18, 5000, t, 'highpass')
      },
      frigo(t) {
        tone(180, 0.25, 'sawtooth', 0.04, 240, t)
        tone(500, 0.06, 'sine', 0.08, 200, t + 0.25)
      },
      merguez(t) {
        tone(420, 0.25, 'sine', 0.1, 260, t)
      },
      distributeur(t) {
        tone(300, 0.06, 'square', 0.06, null, t + 0.15)
        tone(240, 0.08, 'square', 0.05, null, t + 0.28)
      },
      chaise(t) {
        tone(900, 0.03, 'square', 0.05, null, t)
        tone(700, 0.03, 'square', 0.05, null, t + 0.06)
      },
      photocopieuse(t) {
        tone(140, 0.4, 'sawtooth', 0.04, 160, t)
      },
      armoire(t) {
        tone(260, 0.3, 'sawtooth', 0.03, 180, t)
      },
      glaciere(t) {
        for (let i = 0; i < 3; i++) tone(2000 + i * 400, 0.05, 'sine', 0.05, null, t + i * 0.05)
      },
      caddie(t) {
        noise(0.4, 0.06, 3000, t, 'bandpass', 2000)
      },
      voiture(t) {
        tone(440, 0.4, 'square', 0.04, null, t)
        tone(415, 0.4, 'square', 0.04, null, t + 0.4)
      },
      nain(t) {
        tone(800, 0.08, 'triangle', 0.06, 600, t)
      },
      gateau(t) {
        noise(0.12, 0.15, 800, t, 'lowpass')
      },
      cheval(t) {
        tone(220, 0.2, 'triangle', 0.06, 150, t)
      },
      carton(t) {
        noise(0.3, 0.12, 6000, t, 'highpass')
      },
      tableau(t) {
        tone(330, 0.15, 'triangle', 0.05, 280, t)
      },
      trophee(t) {
        tone(midi(88), 0.3, 'sine', 0.05, null, t)
      },
      plante(t) {
        noise(0.2, 0.08, 1500, t, 'bandpass')
      },
    }

    /* ---------- music: a two-bar march, layers by phase, never faster ---------- */
    const BPM = 132
    const STEP = 60 / BPM / 4
    const LEAD = [72, -1, 72, 74, 76, -1, 72, -1, 79, -1, 77, 76, 74, -1, -1, -1, 72, -1, 72, 74, 76, -1, 79, -1, 77, 76, 74, 71, 72, -1, -1, -1]
    const COUNTER = [-1, -1, 64, -1, -1, -1, 67, -1, -1, -1, 65, -1, -1, -1, 62, -1, -1, -1, 64, -1, -1, -1, 67, -1, -1, -1, 65, -1, 64, -1, 62, -1]
    const BASS = [48, -1, 55, -1, 48, -1, 55, -1, 53, -1, 60, -1, 55, -1, 43, -1, 48, -1, 55, -1, 48, -1, 55, -1, 53, -1, 55, -1, 48, -1, 43, -1]
    const ARP = [0, 4, 7, 12]
    function pump() {
      if (!ac) return
      while (nextStep < ac.currentTime + 0.15) {
        playStep(step, nextStep)
        step = (step + 1) % 32
        nextStep += STEP
      }
    }
    function playStep(i, t) {
      const vol = truce ? 0.35 : 1
      // Drums: kick and a snare roll that wants to look serious.
      if (i % 8 === 0) tone(90, 0.12, 'sine', 0.35 * vol, 45, t, music)
      if (i % 8 === 4) noise(0.08, 0.16 * vol, 2500, t, 'highpass', null, music)
      if (layers >= 1 && (i === 14 || i === 15 || i === 30 || i === 31)) noise(0.04, 0.1 * vol, 3000, t, 'highpass', null, music)
      if (layers >= 1 && BASS[i] > 0) tone(midi(BASS[i]), STEP * 1.8, 'triangle', 0.22 * vol, null, t, music)
      if (layers >= 2 && LEAD[i] > 0) kazoo(midi(LEAD[i]), STEP * 1.7, 0.06 * vol, t)
      if (layers >= 3 && i % 2 === 1) tone(midi(60 + ARP[(i >> 1) % 4] + (i >= 16 ? 5 : 0)), STEP * 0.8, 'square', 0.025 * vol, null, t, music)
      if (layers >= 4 && COUNTER[i] > 0) tone(midi(COUNTER[i] + 12), STEP * 1.5, 'square', 0.035 * vol, null, t, music)
    }
    function kazoo(f, dur, vol, t) {
      const o = ac.createOscillator()
      const lfo = ac.createOscillator()
      const lg = ac.createGain()
      const g = ac.createGain()
      const flt = ac.createBiquadFilter()
      o.type = 'sawtooth'
      o.frequency.value = f
      lfo.frequency.value = 7
      lg.gain.value = f * 0.012
      lfo.connect(lg)
      lg.connect(o.frequency)
      flt.type = 'bandpass'
      flt.frequency.value = f * 2.5
      flt.Q.value = 2
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(flt)
      flt.connect(g)
      g.connect(music)
      o.start(t)
      lfo.start(t)
      o.stop(t + dur + 0.02)
      lfo.stop(t + dur + 0.02)
    }
    function startMusic() {
      if (!ac || musicOn) return
      musicOn = true
      step = 0
      nextStep = ac.currentTime + 0.05
      timer = setInterval(pump, 50)
    }
    function stopMusic() {
      musicOn = false
      if (timer) clearInterval(timer)
      timer = null
    }

    return {
      init,
      play(name, arg) {
        if (FX[name]) FX[name](arg)
      },
      setMuted,
      get muted() {
        return muted
      },
      startMusic,
      stopMusic,
      setLayers(n) {
        layers = n
      },
      setTruce(on) {
        truce = on
      },
    }
  }

  window.BarricasseAudio = { createAudio }
})()
