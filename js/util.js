'use strict';
// ---------- helper umum ----------
// layar sentuh (HP/tablet) -> teks petunjuk pakai 'tap'
const TOUCH = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
const FONT = "Bahnschrift, 'DIN Alternate', 'Segoe UI', Arial, sans-serif";

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  ri: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  rf: (a, b) => a + Math.random() * (b - a),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  roll: (p) => Math.random() * 100 < p,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeIn: (t) => t * t * t,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  dist: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
  key: (x, y) => y * 128 + x,
  kx: (k) => k % 128,
  ky: (k) => (k / 128) | 0,
  seeded(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(x, y, z = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
  hex(r, g, b) {
    const c = (v) => U.clamp(Math.round(v), 0, 255);
    return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1);
  },
  _shc: new Map(),
  shade(hex, f) {
    const k = hex + f, hit = U._shc.get(k);
    if (hit) return hit;
    let [r, g, b] = U.rgb(hex);
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    const out = U.hex(r, g, b);
    if (U._shc.size < 4000) U._shc.set(k, out);
    return out;
  },
  mix(a, b, t) { const A = U.rgb(a), B = U.rgb(b); return U.hex(U.lerp(A[0], B[0], t), U.lerp(A[1], B[1], t), U.lerp(A[2], B[2], t)); },
  rgba(hex, a) { const [r, g, b] = U.rgb(hex); return `rgba(${r},${g},${b},${a})`; },
  shuffle(arr, R = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  },
  fmt: (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
};

function hpCol(r) { return r > 0.6 ? '#5fe08a' : r > 0.3 ? '#ffd24a' : '#ff5a4d'; }

// ---------- waktu & animasi ----------
const Time = { speed: 1 };
function sleep(ms) { return new Promise((r) => setTimeout(r, ms / Time.speed)); }

const Anim = {
  list: [],
  tween(dur, fn, ease) {
    return new Promise((res) => {
      if (dur <= 0 || Time.speed >= 20) { fn(1); res(); return; }
      this.list.push({ t: 0, dur, fn, ease, res });
    });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(a.ease ? a.ease(k) : k);
      if (k >= 1) { this.list.splice(i, 1); a.res(); }
    }
  },
};
