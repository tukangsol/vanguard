'use strict';
// ================= PARTIKEL & LATAR =================
class FXSys {
  constructor() { this.p = []; this.tx = []; }
  clear() { this.p.length = 0; this.tx.length = 0; }
  add(o) { if (this.p.length < 700) { o.max = o.life; this.p.push(o); } }
  spark(x, y, n, k = 1, col = '#ffd27a') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = U.rf(80, 300) * k;
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * k, g: 500 * k, life: U.rf(0.15, 0.4), col, w: 1.5 * Math.max(0.7, k) });
    }
  }
  fire(x, y, n, k = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = U.rf(20, 140) * k;
      this.add({ type: 'fire', x: x + U.rf(-6, 6) * k, y: y + U.rf(-6, 6) * k, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30 * k, drag: 3, r: U.rf(5, 12) * k, life: U.rf(0.25, 0.6) });
    }
  }
  smoke(x, y, n, k = 1, col = '#3a3a3c', a = 0.45) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'smoke', x: x + U.rf(-8, 8) * k, y: y + U.rf(-6, 6) * k, vx: U.rf(-15, 15) * k, vy: U.rf(-40, -15) * k, r: U.rf(5, 10) * k, grow: 16 * k, life: U.rf(0.8, 1.6), col, a });
    }
  }
  debris(x, y, n, k = 1) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'debris', x, y, vx: U.rf(-150, 150) * k, vy: U.rf(-260, -80) * k, g: 600 * k, r: U.rf(1.5, 3.5) * k, rot: 0, spin: U.rf(-12, 12), life: U.rf(0.5, 1), col: U.pick(['#222', '#444', '#5a3a2a']) });
    }
  }
  shell(x, y, k = 1, dir = 1, col = '#d9a441') { // selongsong peluru terlempar
    this.add({ type: 'debris', x, y, vx: -dir * U.rf(40, 130) * k, vy: -U.rf(130, 230) * k, g: 750 * k, r: 1.7 * k, rot: 0, spin: U.rf(-24, 24), life: U.rf(0.45, 0.75), col });
  }
  flash(x, y, r) { this.add({ type: 'flash', x, y, r, life: 0.09 }); }
  ring(x, y, r, k = 1) { this.add({ type: 'ring', x, y, r0: 4 * k, r, w: 3 * k, life: 0.4, flat: 0.55 }); }
  tracer(x1, y1, x2, y2, col, w, life = 0.12) { this.add({ type: 'tracer', x: x1, y: y1, x2, y2, col, w, life }); }
  heal(x, y, k = 1) {
    for (let i = 0; i < 8; i++) this.add({ type: 'heal', x: x + U.rf(-14, 14) * k, y: y + U.rf(-10, 10) * k, vy: -30 * k, r: 3 * k, life: U.rf(0.6, 1.1) });
  }
  explode(x, y, k = 1, big = 1) {
    const kk = k * big;
    this.flash(x, y, 40 * kk);
    this.fire(x, y, Math.round(10 * big), kk);
    this.smoke(x, y, Math.round(7 * big), kk);
    this.spark(x, y, Math.round(12 * big), k);
    this.debris(x, y, Math.round(6 * big), k);
    this.ring(x, y, 50 * kk, kk);
  }
  text(x, y, s, col = '#fff', size = 14, life = 1.1) { this.tx.push({ x, y, s: String(s), col, size, life, max: life, vy: -38 * (size / 14) }); }
  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.life -= dt;
      if (p.life <= 0) { this.p.splice(i, 1); continue; }
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.g) p.vy += p.g * dt;
      if (p.drag) { p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt); }
      if (p.grow) p.r += p.grow * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
    for (let i = this.tx.length - 1; i >= 0; i--) {
      const t = this.tx[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= 1 - Math.min(1, 2.5 * dt);
      if (t.life <= 0) this.tx.splice(i, 1);
    }
  }
  draw(c) {
    for (const p of this.p) {
      if (p.type === 'smoke') {
        c.globalAlpha = (p.life / p.max) * p.a; c.fillStyle = p.col;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill();
      } else if (p.type === 'debris') {
        c.globalAlpha = Math.min(1, p.life * 3); c.fillStyle = p.col;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); c.restore();
      }
    }
    c.globalAlpha = 1;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of this.p) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'fire':
          c.globalAlpha = k; c.fillStyle = k > 0.7 ? '#fff0b0' : k > 0.4 ? '#ffa438' : '#c4421a';
          c.beginPath(); c.arc(p.x, p.y, p.r * (0.6 + (1 - k) * 0.8), 0, 6.283); c.fill(); break;
        case 'spark':
          c.globalAlpha = k; c.strokeStyle = p.col; c.lineWidth = p.w;
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke(); break;
        case 'flash': {
          c.globalAlpha = k;
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.4, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,120,40,0)');
          c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); break;
        }
        case 'ring': {
          const r = p.r0 + (p.r - p.r0) * (1 - k);
          c.globalAlpha = k * 0.8; c.strokeStyle = '#ffd9a0'; c.lineWidth = Math.max(0.5, p.w * k);
          c.beginPath(); c.ellipse(p.x, p.y, r, r * p.flat, 0, 0, 6.283); c.stroke(); break;
        }
        case 'tracer':
          c.globalAlpha = k; c.strokeStyle = p.col; c.lineWidth = p.w;
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x2, p.y2); c.stroke(); break;
        case 'heal':
          c.globalAlpha = k; c.fillStyle = '#5fe08a';
          c.fillRect(p.x - p.r, p.y - p.r * 0.3, p.r * 2, p.r * 0.6); c.fillRect(p.x - p.r * 0.3, p.y - p.r, p.r * 0.6, p.r * 2); break;
      }
    }
    c.restore();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of this.tx) {
      const age = t.max - t.life, sc = age < 0.12 ? 1 + (0.12 - age) * 5 : 1;
      c.globalAlpha = Math.min(1, t.life * 2.5);
      c.font = `700 ${t.size * sc}px ${FONT}`;
      c.lineWidth = Math.max(2, t.size * 0.22); c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText(t.s, t.x, t.y);
      c.fillStyle = t.col; c.fillText(t.s, t.x, t.y);
    }
    c.globalAlpha = 1;
  }
}

// Partikel cuaca (koordinat ternormalisasi 0..1)
class Ambient {
  constructor(kind, n = 70) { this.kind = kind; this.p = []; for (let i = 0; i < n; i++) this.p.push({ x: Math.random(), y: Math.random(), z: U.rf(0.4, 1), ph: Math.random() * 6.28 }); }
  update(dt) {
    for (const p of this.p) {
      switch (this.kind) {
        case 'snow': p.y += dt * 0.05 * p.z; p.x += Math.sin((p.ph += dt)) * 0.0006; break;
        case 'rain': p.y += dt * 1.3 * p.z; p.x -= dt * 0.18 * p.z; break;
        case 'ember': p.y -= dt * 0.05 * p.z; p.x += Math.sin((p.ph += dt * 2)) * 0.0008; break;
        case 'leaf': p.y += dt * 0.04 * p.z; p.x += dt * 0.05 * p.z + Math.sin((p.ph += dt * 2)) * 0.001; break;
        default: p.x += dt * 0.04 * p.z; p.y += Math.sin((p.ph += dt)) * 0.0003;
      }
      if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
      if (p.y < -0.06) { p.y = 1.05; p.x = Math.random(); }
      if (p.x > 1.05) p.x = -0.05;
      if (p.x < -0.06) p.x = 1.05;
    }
  }
  draw(c, W, H) {
    c.save();
    for (const p of this.p) {
      const x = p.x * W, y = p.y * H;
      switch (this.kind) {
        case 'snow': c.globalAlpha = 0.5 + p.z * 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 1 + p.z * 2, 0, 6.28); c.fill(); break;
        case 'rain': c.globalAlpha = 0.25 * p.z; c.strokeStyle = '#9fb8d8'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6 * p.z, y - 22 * p.z); c.stroke(); break;
        case 'ember': c.globalAlpha = 0.5 + 0.5 * Math.sin(p.ph * 3); c.fillStyle = '#ff8a3a'; c.fillRect(x, y, 1.5 + p.z * 1.5, 1.5 + p.z * 1.5); break;
        case 'leaf': c.globalAlpha = 0.7; c.fillStyle = p.z > 0.7 ? '#9bbd4a' : '#d9b04a'; c.beginPath(); c.ellipse(x, y, 3 * p.z + 1, 1.5, p.ph, 0, 6.28); c.fill(); break;
        default: c.globalAlpha = 0.25 * p.z; c.fillStyle = '#f0c890'; c.fillRect(x, y, 2 * p.z, 2 * p.z);
      }
    }
    c.restore();
  }
}

function _ridge(c, W, H, base, amp, freq, col, R, jag) {
  const ph = R() * 100, f = freq * (1400 / Math.max(400, W));
  c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W + 14; x += jag ? 14 : 6) {
    let y = base - amp * (0.55 + 0.3 * Math.sin(x * f + ph) + 0.15 * Math.sin(x * f * 3.1 + ph * 1.7));
    if (jag) y -= R() * amp * 0.14;
    c.lineTo(x, y);
  }
  c.lineTo(W + 14, H); c.closePath(); c.fill();
}

// Latar sinematik per tema (digambar sekali ke kanvas offscreen)
function paintBackdrop(c, W, H, themeId) {
  const th = THEMES[themeId], cb = th.cine, hz = H * 0.6;
  const R = U.seeded(themeId.length * 1337 + 11);
  let g = c.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, hz + 4);
  if (th.night) {
    c.fillStyle = '#fff';
    for (let i = 0; i < 180; i++) { c.globalAlpha = R() * 0.8; const s = R() < 0.1 ? 1.8 : 1; c.fillRect(R() * W, R() * hz * 0.8, s, s); }
    c.globalAlpha = 1;
  }
  const sx = W * cb.sunX, sy = hz * cb.sunY, sr = H * 0.055;
  g = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 7);
  g.addColorStop(0, U.rgba(cb.sun, 0.55)); g.addColorStop(1, U.rgba(cb.sun, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, hz);
  c.fillStyle = cb.sun; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
  const far = U.mix(th.sky[1], cb.farCol, 0.6), far2 = U.mix(th.sky[1], cb.farCol, 0.85), mid = cb.midCol;
  switch (cb.far) {
    case 'hills':
      _ridge(c, W, H, hz - H * 0.03, H * 0.14, 0.004, far, R, false);
      _ridge(c, W, H, hz + H * 0.01, H * 0.08, 0.007, far2, R, false);
      c.fillStyle = mid;
      for (let x = 0; x < W; x += 9) { const hh = 8 + R() * 18; c.beginPath(); c.moveTo(x - 6, hz + 4); c.lineTo(x, hz - hh); c.lineTo(x + 6, hz + 4); c.fill(); }
      break;
    case 'mount': {
      const peaks = [];
      for (let i = 0; i < 8; i++) peaks.push([(i / 7) * W + (R() - 0.5) * W * 0.08, hz - H * (0.12 + R() * 0.22)]);
      c.fillStyle = far; c.beginPath(); c.moveTo(-20, hz + 5);
      peaks.forEach(([px, py], i) => { if (i) c.lineTo((px + peaks[i - 1][0]) / 2, hz - H * 0.04 - R() * H * 0.05); c.lineTo(px, py); });
      c.lineTo(W + 20, hz + 5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [px, py] of peaks) { const d = H * 0.035; c.beginPath(); c.moveTo(px, py); c.lineTo(px + d * 1.1, py + d * 1.3); c.lineTo(px + d * 0.3, py + d); c.lineTo(px - d * 0.4, py + d * 1.4); c.lineTo(px - d * 1.1, py + d * 1.3); c.closePath(); c.fill(); }
      _ridge(c, W, H, hz + H * 0.01, H * 0.06, 0.008, far2, R, true);
      c.fillStyle = mid;
      for (let x = 0; x < W; x += 11) { const hh = 10 + R() * 22; c.beginPath(); c.moveTo(x - 6, hz + 5); c.lineTo(x, hz - hh); c.lineTo(x + 6, hz + 5); c.fill(); }
      break;
    }
    case 'dunes':
      _ridge(c, W, H, hz - H * 0.01, H * 0.08, 0.003, far, R, false);
      c.fillStyle = mid;
      for (let i = 0; i < 9; i++) {
        const x = W * (0.45 + R() * 0.5), w = 8 + R() * 14, h = H * (0.08 + R() * 0.16);
        c.fillRect(x, hz - h, w, h);
        if (R() < 0.5) { c.save(); c.globalCompositeOperation = 'lighter'; const fg = c.createRadialGradient(x + w / 2, hz - h - 8, 0, x + w / 2, hz - h - 8, 22); fg.addColorStop(0, 'rgba(255,200,90,0.9)'); fg.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = fg; c.fillRect(x - 30, hz - h - 40, w + 60, 60); c.restore(); c.fillStyle = mid; }
      }
      for (let i = 0; i < 4; i++) { const x = W * (0.1 + R() * 0.4), r = H * (0.025 + R() * 0.02); c.beginPath(); c.arc(x, hz - r * 0.6, r, Math.PI, 0); c.fill(); c.fillRect(x - r, hz - r * 0.6, r * 2, r * 0.6); }
      _ridge(c, W, H, hz + H * 0.02, H * 0.04, 0.006, far2, R, false);
      break;
    case 'city':
      for (let layer = 0; layer < 2; layer++) {
        let x = -10;
        const col = layer ? mid : far;
        while (x < W) {
          const w = 30 + R() * 60, h = H * (layer ? 0.08 + R() * 0.2 : 0.14 + R() * 0.3);
          c.fillStyle = col; c.fillRect(x, hz - h, w, h + 6);
          for (let wy = hz - h + 6; wy < hz - 4; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) if (R() < (layer ? 0.18 : 0.1)) { c.fillStyle = R() < 0.8 ? 'rgba(255,210,120,0.75)' : 'rgba(150,200,255,0.7)'; c.fillRect(wx, wy, 2.5, 3); }
          if (!layer && R() < 0.2) { c.fillStyle = '#ff3b30'; c.fillRect(x + w / 2, hz - h - 6, 2, 2); }
          x += w + R() * 6;
        }
      }
      break;
    case 'fort': {
      c.fillStyle = far;
      for (let i = 0; i < 6; i++) { const x = W * (i / 5) - 20, w = 14 + R() * 18, h = H * (0.12 + R() * 0.22); c.fillRect(x, hz - h, w, h); const fg = c.createRadialGradient(x + w / 2, hz - h, 0, x + w / 2, hz - h, 40); fg.addColorStop(0, 'rgba(255,90,40,0.6)'); fg.addColorStop(1, 'rgba(255,60,20,0)'); c.save(); c.fillStyle = fg; c.globalCompositeOperation = 'lighter'; c.fillRect(x - 40, hz - h - 40, w + 80, 80); c.restore(); c.fillStyle = far; }
      c.fillStyle = mid;
      const wy = hz - H * 0.09;
      c.fillRect(0, wy, W, H * 0.1);
      for (let x = 0; x < W; x += 26) c.fillRect(x, wy - 10, 14, 10);
      for (let i = 0; i < 4; i++) { const x = W * (0.12 + i * 0.26), w = 40 + R() * 20; c.fillRect(x, wy - H * 0.08, w, H * 0.09); for (let k = 0; k < w; k += 12) c.fillRect(x + k, wy - H * 0.08 - 8, 7, 8); c.fillStyle = 'rgba(255,170,90,0.8)'; c.fillRect(x + w / 2 - 2, wy - H * 0.06, 4, 6); c.fillStyle = mid; }
      break;
    }
  }
  g = c.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, cb.ground[0]); g.addColorStop(1, cb.ground[1]);
  c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
  c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
  for (let i = -14; i <= 14; i++) { c.beginPath(); c.moveTo(W / 2 + i * W * 0.02, hz); c.lineTo(W / 2 + i * W * 0.22, H); c.stroke(); }
  for (let k = 1; k < 10; k++) { const y = hz + (H - hz) * Math.pow(k / 10, 2); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  g = c.createLinearGradient(0, hz - H * 0.06, 0, hz + H * 0.08);
  g.addColorStop(0, U.rgba(th.sky[1], 0)); g.addColorStop(0.5, U.rgba(th.sky[1], 0.35)); g.addColorStop(1, U.rgba(th.sky[1], 0));
  c.fillStyle = g; c.fillRect(0, hz - H * 0.06, W, H * 0.14);
  g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function makeBackdrop(W, H, theme, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintBackdrop(c, W, H, theme);
  return cv;
}
