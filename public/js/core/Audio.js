/**
 * Fully procedural audio — no files. Wind, town ambience, a honky-tonk piano
 * that gets louder as you approach the Mariposa, birds, footsteps per surface
 * and the occasional distant gunshot.
 */
export class Audio {
  constructor() {
    this.ready = false;
    this.volume = 0.7;
    this.ctx = null;
    this.birdTimer = 0;
    this.shotTimer = 12 + Math.random() * 20;
    this.pianoTime = 0;
    this.pianoStep = 0;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 3.5;
    comp.attack.value = 0.006; comp.release.value = 0.28;
    this.master.connect(comp).connect(ctx.destination);

    /* ---------------------------------------------------------- wind */
    const noise = this._noise(4);
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noise; windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 380; windFilter.Q.value = 0.55;
    const windGain = ctx.createGain(); windGain.gain.value = 0.075;
    windSrc.connect(windFilter).connect(windGain).connect(this.master);
    windSrc.start();
    // slow gusts
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.055;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.021;
    const lfo2g = ctx.createGain(); lfo2g.gain.value = 0.045;
    lfo2.connect(lfo2g).connect(windGain.gain);
    lfo2.start();
    this.windGain = windGain;

    /* ------------------------------------------------- distant desert hum */
    const humSrc = ctx.createBufferSource();
    humSrc.buffer = noise; humSrc.loop = true;
    const humF = ctx.createBiquadFilter();
    humF.type = 'lowpass'; humF.frequency.value = 240;
    const humG = ctx.createGain(); humG.gain.value = 0.05;
    humSrc.connect(humF).connect(humG).connect(this.master);
    humSrc.start();
    this.humGain = humG;

    /* ------------------------------------------------------- saloon piano */
    this.pianoGain = ctx.createGain();
    this.pianoGain.gain.value = 0;
    const pF = ctx.createBiquadFilter();
    pF.type = 'lowpass'; pF.frequency.value = 2200;
    this.pianoGain.connect(pF).connect(this.master);

    /* ------------------------------------------------------- reverb-ish IR */
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(1.6, 2.4);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain).connect(this.master);

    this.ready = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  _noise(seconds = 2) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    return buf;
  }

  _impulse(seconds = 1.5, decay = 2.5) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /** Short filtered noise burst — footsteps, landings, doors. */
  _burst(o) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.25);
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq || 900;
    f.Q.value = o.q || 1.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.14));
    src.connect(f).connect(g).connect(this.master);
    if (o.verb) g.connect(this.verb);
    src.start(t); src.stop(t + 0.3);
  }

  step(surface = 'dirt', running = false) {
    const cfg = {
      dirt: { freq: 620, q: 0.8, gain: 0.11, dur: 0.10, verb: 0 },
      wood: { freq: 1450, q: 2.2, gain: 0.15, dur: 0.13, verb: 0.25 },
      stone: { freq: 2100, q: 3.0, gain: 0.11, dur: 0.09, verb: 0.1 },
      metal: { freq: 2900, q: 5.0, gain: 0.13, dur: 0.16, verb: 0.4 },
    }[surface] || { freq: 700, q: 1, gain: 0.11, dur: 0.11 };
    this._burst({ ...cfg, gain: cfg.gain * (running ? 1.45 : 1) * (0.85 + Math.random() * 0.3) });
  }

  land(impact = 0.5) {
    this._burst({ type: 'lowpass', freq: 420, gain: 0.10 + impact * 0.22, dur: 0.20 + impact * 0.2, verb: 0.3 });
  }
  jump() { this._burst({ type: 'highpass', freq: 900, gain: 0.05, dur: 0.08 }); }
  click() { this._burst({ type: 'bandpass', freq: 1800, q: 4, gain: 0.09, dur: 0.05 }); }
  coin() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [2400, 3200, 4100]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.master); g.connect(this.verb);
      o.start(t); o.stop(t + 0.4);
    }
  }

  /** Distant gunshot with a canyon echo. */
  gunshot() {
    if (!this.ready) return;
    this._burst({ type: 'lowpass', freq: 1800, gain: 0.34, dur: 0.16, verb: 0.9, attack: 0.002 });
    setTimeout(() => this._burst({ type: 'bandpass', freq: 700, q: 0.6, gain: 0.10, dur: 0.5, verb: 0.8 }), 190);
    setTimeout(() => this._burst({ type: 'bandpass', freq: 480, q: 0.5, gain: 0.05, dur: 0.7, verb: 0.8 }), 420);
  }

  /** Two-note bird call. */
  bird() {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const notes = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.07);
      const o = ctx.createOscillator(); o.type = 'sine';
      const base = 2100 + Math.random() * 1500;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.5), t + 0.04);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(this.master); g.connect(this.verb);
      o.start(t); o.stop(t + 0.16);
    }
  }

  /** Honky-tonk piano: a looped ragtime-ish vamp, one chord per beat. */
  _pianoChord(freqs, time, dur, gain) {
    const ctx = this.ctx;
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i];
      for (const det of [0, 1.006]) {                    // slight honky-tonk detune
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = f * det;
        const o2 = ctx.createOscillator();
        o2.type = 'square'; o2.frequency.value = f * det * 2.005;
        const of = ctx.createBiquadFilter();
        of.type = 'lowpass'; of.frequency.value = 1900;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, time);
        og.gain.exponentialRampToValueAtTime(gain * (i === 0 ? 1.0 : 0.5), time + 0.012);
        og.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        const o2g = ctx.createGain(); o2g.gain.value = 0.14;
        o.connect(of); o2.connect(o2g).connect(of);
        of.connect(og).connect(this.pianoGain);
        og.connect(this.verb);
        o.start(time); o.stop(time + dur + 0.05);
        o2.start(time); o2.stop(time + dur + 0.05);
      }
    }
  }

  update(dt, t, listener, saloonPos) {
    if (!this.ready) return;

    // ---- piano volume follows distance to the Mariposa
    if (saloonPos && listener) {
      const d = Math.hypot(listener.x - saloonPos.x, listener.z - saloonPos.z);
      const want = THREE_clamp(1 - (d - 6) / 34, 0, 1) * 0.20;
      this.pianoGain.gain.value += (want - this.pianoGain.gain.value) * Math.min(1, dt * 2);
    }

    // ---- piano sequencer (roughly 132 bpm ragtime)
    this.pianoTime -= dt;
    if (this.pianoTime <= 0 && this.pianoGain.gain.value > 0.004) {
      const beat = 0.34;
      this.pianoTime = beat;
      const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
      // I - VI7 - II7 - V7 in C, with a walking bass
      const prog = [
        { bass: 36, chord: [48, 52, 55] },
        { bass: 33, chord: [45, 49, 52] },
        { bass: 38, chord: [50, 54, 57] },
        { bass: 31, chord: [43, 47, 50] },
        { bass: 36, chord: [48, 52, 55] },
        { bass: 43, chord: [55, 59, 62] },
        { bass: 38, chord: [50, 54, 57] },
        { bass: 43, chord: [55, 59, 62] },
      ];
      const step = this.pianoStep % 8;
      const p = prog[step];
      const now = this.ctx.currentTime;
      // oom-pah: bass on the beat, chord on the off-beat
      this._pianoChord([N(p.bass)], now, beat * 0.55, 0.16);
      this._pianoChord(p.chord.map(N), now + beat * 0.5, beat * 0.42, 0.075);
      if (step % 4 === 3) this._pianoChord([N(p.bass + 7)], now + beat * 0.75, beat * 0.3, 0.10);
      this.pianoStep++;
    }

    // ---- wind rises with altitude & openness
    if (this.windGain) {
      const target = 0.055 + (listener ? THREE_clamp((listener.y - 0.4) / 12, 0, 1) * 0.05 : 0);
      this.windGain.gain.value += (target - this.windGain.gain.value) * Math.min(1, dt * 0.5);
    }

    // ---- birds
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 4 + Math.random() * 14;
      if (!listener || Math.hypot(listener.x, listener.z) < 180) this.bird();
    }

    // ---- distant gunshot
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) {
      this.shotTimer = 45 + Math.random() * 90;
      this.gunshot();
    }
  }
}

function THREE_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
