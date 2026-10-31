'use strict';
// Efek suara prosedural (WebAudio) — tanpa file audio.
const SFX = {
  ctx: null, master: null, noise: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch (e) { this.ctx = null; }
  },
  nz(dur, freq, q, gain, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },
  tn(freq, dur, type = 'square', gain = 0.08, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },
  play(n) {
    if (!this.ctx || !this.on) return;
    try {
      switch (n) {
        case 'SMG': this.nz(0.05, 2800, 0.9, 0.35); this.tn(220, 0.04, 'square', 0.03, -100); break;
        case 'SR': this.nz(0.5, 500, 0.4, 1.1); this.tn(180, 0.45, 'sawtooth', 0.09, -150); this.nz(0.6, 3000, 0.5, 0.15, 'bandpass', 0.05); break;
        case 'BZ': this.nz(0.5, 300, 0.5, 0.9, 'lowpass'); this.nz(0.6, 900, 0.3, 0.4); break;
        case 'GL': this.tn(160, 0.12, 'triangle', 0.25, -60); this.nz(0.12, 600, 0.8, 0.5); break;
        case 'FL': this.nz(0.7, 900, 0.3, 0.6); this.nz(0.7, 250, 0.4, 0.5, 'lowpass'); break;
        case 'MG': this.nz(0.07, 2200, 0.8, 0.45); this.tn(140, 0.05, 'square', 0.04, -80); break;
        case 'SG': this.nz(0.22, 1100, 0.6, 0.9); this.nz(0.3, 300, 0.7, 0.5, 'lowpass'); break;
        case 'RF': this.nz(0.35, 700, 0.5, 1); this.tn(300, 0.3, 'sawtooth', 0.07, -250); break;
        case 'MSL': this.nz(0.7, 500, 0.3, 0.45); this.tn(180, 0.5, 'sawtooth', 0.03, 260); break;
        case 'MELEE': this.nz(0.15, 400, 1, 1, 'lowpass'); this.tn(80, 0.2, 'triangle', 0.35, -40); break;
        case 'swing': this.nz(0.24, 900, 0.6, 0.4); this.nz(0.18, 2400, 0.8, 0.18, 'bandpass', 0.05); break;
        case 'aim': this.tn(420, 0.05, 'square', 0.025, -120); this.tn(260, 0.06, 'square', 0.02, 0, 0.06); break;
        case 'smash': this.nz(0.6, 140, 0.6, 1.3, 'lowpass'); this.tn(60, 0.5, 'sine', 0.45, -25); this.nz(0.2, 2600, 1.5, 0.3); break;
        case 'hit': this.nz(0.06, 3000, 2, 0.28); this.tn(900, 0.04, 'square', 0.025, -400); break;
        case 'block': this.tn(1500, 0.08, 'triangle', 0.08, -600); this.nz(0.05, 4000, 3, 0.2); break;
        case 'boom': this.nz(1.1, 180, 0.4, 1.4, 'lowpass'); this.tn(55, 0.8, 'sine', 0.5, -30); break;
        case 'smallboom': this.nz(0.45, 260, 0.5, 0.9, 'lowpass'); break;
        case 'step': this.nz(0.1, 120, 1, 0.45, 'lowpass'); break;
        case 'ui': this.tn(1200, 0.04, 'square', 0.03); break;
        case 'select': this.tn(700, 0.05, 'square', 0.035); this.tn(1050, 0.07, 'square', 0.035, 0, 0.05); break;
        case 'confirm': this.tn(520, 0.06, 'square', 0.04); this.tn(780, 0.06, 'square', 0.04, 0, 0.06); this.tn(1040, 0.1, 'square', 0.04, 0, 0.12); break;
        case 'error': this.tn(150, 0.18, 'square', 0.06); break;
        case 'miss': this.tn(1800, 0.08, 'sine', 0.03, -1200); break;
        case 'phase': this.tn(330, 0.15, 'sawtooth', 0.05); this.tn(495, 0.28, 'sawtooth', 0.05, 0, 0.15); break;
        case 'skill': this.tn(600, 0.08, 'square', 0.045); this.tn(900, 0.08, 'square', 0.045, 0, 0.08); this.tn(1350, 0.16, 'square', 0.045, 0, 0.16); break;
        case 'repair': this.tn(500, 0.2, 'sine', 0.06, 400); this.tn(800, 0.25, 'sine', 0.05, 400, 0.15); break;
        case 'buy': this.tn(988, 0.08, 'square', 0.04); this.tn(1319, 0.18, 'square', 0.04, 0, 0.08); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tn(f, 0.3, 'square', 0.05, 0, i * 0.14)); break;
        case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tn(f, 0.4, 'sawtooth', 0.05, 0, i * 0.2)); break;
      }
    } catch (e) { /* abaikan */ }
  },
};
