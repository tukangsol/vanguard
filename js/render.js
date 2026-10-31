'use strict';
// ================= RENDER ISOMETRIK (bisa diputar) =================
const HLC = {
  move: ['rgba(64,156,255,0.30)', 'rgba(130,200,255,0.85)'],
  path: ['rgba(140,225,255,0.55)', '#d8f6ff'],
  atk: ['rgba(255,80,60,0.16)', 'rgba(255,120,95,0.55)'],
  target: ['rgba(255,60,40,0.5)', '#ffb0a0'],
  emove: ['rgba(255,80,60,0.13)', 'rgba(255,110,90,0.35)'],
  repair: ['rgba(80,230,140,0.35)', '#9dffc4'],
  pspawn: ['rgba(64,156,255,0.55)', '#bfe6ff'],
  espawn: ['rgba(255,70,50,0.55)', '#ffb0a0'],
};

// titik lokal (a,b) di permukaan petak → layar
function _L(cx, cy, a, b) { return [cx + a * VIEW.ex.x + b * VIEW.ey.x, cy + a * VIEW.ex.y + b * VIEW.ey.y]; }
function _quad(c, cx, cy, s) {
  const h = s / 2, p1 = _L(cx, cy, -h, -h), p2 = _L(cx, cy, h, -h), p3 = _L(cx, cy, h, h), p4 = _L(cx, cy, -h, h);
  c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath();
}
// iterasi 4 sisi petak; cb(p1, p2, nx, ny, lit) hanya untuk sisi yang menghadap kamera
function _sides(cx, cy, half, cb) {
  const ex = VIEW.ex, ey = VIEW.ey;
  for (let i = 0; i < 4; i++) {
    const sg = i & 1 ? -1 : 1, axX = i < 2, v = axX ? ex : ey;
    if (v.y * sg <= 0.01) continue;
    const p1 = axX ? _L(cx, cy, half * sg, -half) : _L(cx, cy, -half, half * sg);
    const p2 = axX ? _L(cx, cy, half * sg, half) : _L(cx, cy, half, half * sg);
    cb(p1, p2, axX ? sg : 0, axX ? 0 : sg, v.x * sg < 0);
  }
}
function _isoBox(c, cx, cy, size, hh, col) {
  const lit = U.shade(col, -0.18), dk = U.shade(col, -0.4);
  _sides(cx, cy, size / 2, (p1, p2, nx, ny, l) => {
    c.fillStyle = l ? lit : dk; c.beginPath();
    c.moveTo(p1[0], p1[1] - hh); c.lineTo(p2[0], p2[1] - hh); c.lineTo(p2[0], p2[1]); c.lineTo(p1[0], p1[1]); c.closePath(); c.fill();
  });
  _quad(c, cx, cy - hh, size); c.fillStyle = col; c.fill();
}

function _sideFace(c, t, p1, p2, top, low, lit, fi, map) {
  const d = (top - low) * 16;
  c.fillStyle = lit ? t.cl : t.cr;
  c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p2[0], p2[1] + d); c.lineTo(p1[0], p1[1] + d); c.closePath(); c.fill();
  const P = (f, dy) => [U.lerp(p1[0], p2[0], f), U.lerp(p1[1], p2[1], f) + dy];
  if (t.t === 'building') {
    const night = map.th.night;
    for (let lv = Math.max(0, Math.ceil(low)); lv < top - 0.3; lv++) {
      for (const f of [0.18, 0.58]) {
        const lit2 = U.hash(t.x * 3 + fi, t.y * 5 + lv, Math.round(f * 10)) < (night ? 0.5 : 0.12);
        c.fillStyle = lit2 ? (night ? '#ffd27a' : '#cfe6f2') : (night ? '#161b24' : '#2c3640');
        const y1 = (top - (lv + 0.8)) * 16, y2 = (top - (lv + 0.32)) * 16;
        const a = P(f, y1), b = P(f + 0.24, y1), cc = P(f + 0.24, y2), dd = P(f, y2);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(dd[0], dd[1]); c.closePath(); c.fill();
      }
    }
  } else if (t.t !== 'water') {
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 1; c.beginPath();
    for (let lv = Math.ceil(low) + 1; lv < top; lv++) { const dy = (top - lv) * 16; c.moveTo(p1[0], p1[1] + dy); c.lineTo(p2[0], p2[1] + dy); }
    c.stroke();
  }
}

function _topDetail(c, t, cx, cy, time) {
  const h = (i) => U.hash(t.x, t.y, i);
  switch (t.t) {
    case 'grass': case 'forest':
      c.strokeStyle = 'rgba(20,40,10,0.35)'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < 4; i++) { const [px, py] = _L(cx, cy, (h(i) - 0.5) * 0.8, (h(i + 9) - 0.5) * 0.8); c.moveTo(px, py); c.lineTo(px - 1.5, py - 3); c.moveTo(px, py); c.lineTo(px + 1.5, py - 3); }
      c.stroke(); break;
    case 'sand': case 'dirt': case 'snow': case 'rock':
      c.fillStyle = t.t === 'snow' ? 'rgba(255,255,255,0.7)' : 'rgba(60,40,20,0.22)';
      for (let i = 0; i < 4; i++) { const [px, py] = _L(cx, cy, (h(i) - 0.5) * 0.85, (h(i + 9) - 0.5) * 0.85); c.fillRect(px, py, 2, 1.2); }
      break;
    case 'road': {
      c.strokeStyle = 'rgba(230,200,90,0.4)'; c.lineWidth = 1.5;
      const a = _L(cx, cy, -0.15, 0), b = _L(cx, cy, 0.15, 0), d1 = _L(cx, cy, 0, -0.15), d2 = _L(cx, cy, 0, 0.15);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.moveTo(d1[0], d1[1]); c.lineTo(d2[0], d2[1]); c.stroke();
      break;
    }
    case 'concrete': case 'metal': case 'crate': case 'rubble':
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; _quad(c, cx, cy, 0.62); c.stroke();
      if (t.t === 'metal') { c.fillStyle = 'rgba(255,255,255,0.25)'; for (const [a, b] of [[-0.28, 0], [0.28, 0], [0, -0.28], [0, 0.28]]) { const [px, py] = _L(cx, cy, a, b); c.fillRect(px - 1, py - 0.5, 2, 1.5); } }
      break;
    case 'water': {
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < 2; i++) {
        const o = ((time * 0.35 + t.v + i * 0.5) % 1) - 0.5, b = (i - 0.5) * 0.4;
        const p1 = _L(cx, cy, o * 0.8 - 0.12, b), p2 = _L(cx, cy, o * 0.8 + 0.12, b);
        c.moveTo(p1[0], p1[1]); c.quadraticCurveTo((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 - 2, p2[0], p2[1]);
      }
      c.stroke(); break;
    }
    case 'building':
      c.fillStyle = 'rgba(0,0,0,0.15)'; _quad(c, cx, cy, 0.78); c.fill();
      if (h(3) < 0.5) { const [bx, by] = _L(cx, cy, (h(4) - 0.5) * 0.4, (h(5) - 0.5) * 0.4); _isoBox(c, bx, by, 0.24, 7, U.shade(t.top, -0.1)); }
      break;
  }
}

function _tree(c, x, y, s, th) {
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x + 3 * s, y + 1, 7 * s, 3 * s, 0, 0, 6.28); c.fill();
  c.fillStyle = '#4b3523'; c.fillRect(x - 1.3 * s, y - 7 * s, 2.6 * s, 7 * s);
  const [d, l] = th.tree;
  if (th.treeType === 'round') {
    c.fillStyle = d; c.beginPath(); c.arc(x, y - 13 * s, 8 * s, 0, 6.28); c.fill();
    c.fillStyle = l; c.beginPath(); c.arc(x - 2.5 * s, y - 15.5 * s, 5.5 * s, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,255,220,0.18)'; c.beginPath(); c.arc(x - 4 * s, y - 17.5 * s, 2.5 * s, 0, 6.28); c.fill();
  } else {
    for (let i = 0; i < 3; i++) {
      const w = (8.5 - i * 2.2) * s, yy = y - 5 * s - i * 6 * s;
      c.fillStyle = i % 2 ? l : d; c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x + w, yy); c.lineTo(x, yy - 11 * s); c.closePath(); c.fill();
      if (th.snowCap) { c.fillStyle = 'rgba(245,250,255,0.9)'; c.beginPath(); c.moveTo(x - w * 0.45, yy - 6 * s); c.lineTo(x + w * 0.45, yy - 6 * s); c.lineTo(x, yy - 11 * s); c.closePath(); c.fill(); }
    }
  }
}

function _deco(c, t, cx, cy, map) {
  const th = map.th, h = (i) => U.hash(t.x, t.y, i);
  switch (t.t) {
    case 'forest': {
      const n = 2 + (t.v > 0.5 ? 1 : 0), pts = [];
      for (let i = 0; i < n; i++) pts.push(_L(cx, cy, (h(20 + i) - 0.5) * 0.7, (h(40 + i) - 0.5) * 0.7));
      pts.sort((p, q) => p[1] - q[1]);
      for (const p of pts) _tree(c, p[0], p[1], 0.9 + h(60) * 0.3, th);
      break;
    }
    case 'rock': {
      const pts = [0, 1].map((i) => [..._L(cx, cy, (h(70 + i) - 0.5) * 0.6, (h(80 + i) - 0.5) * 0.6), 5 + h(90 + i) * 4]).sort((p, q) => p[1] - q[1]);
      for (const [px, py, s] of pts) {
        c.fillStyle = th.rockCol; c.beginPath(); c.moveTo(px - s, py); c.lineTo(px - s * 0.7, py - s * 0.9); c.lineTo(px + s * 0.2, py - s * 1.2); c.lineTo(px + s, py - s * 0.4); c.lineTo(px + s * 0.8, py + s * 0.2); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(px - s * 0.7, py - s * 0.9); c.lineTo(px + s * 0.2, py - s * 1.2); c.lineTo(px + s * 0.3, py - s * 0.5); c.lineTo(px - s * 0.4, py - s * 0.4); c.closePath(); c.fill();
      }
      break;
    }
    case 'rubble':
      for (let i = 0; i < 3; i++) {
        const [px, py] = _L(cx, cy, (h(70 + i) - 0.5) * 0.65, (h(80 + i) - 0.5) * 0.65), s = 4 + h(90 + i) * 4;
        c.fillStyle = i % 2 ? '#6d6a66' : '#55524e'; c.beginPath(); c.moveTo(px - s, py); c.lineTo(px - s * 0.3, py - s * 1.1); c.lineTo(px + s, py - s * 0.6); c.lineTo(px + s * 0.5, py + s * 0.3); c.closePath(); c.fill();
      }
      c.strokeStyle = '#8a5a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 4, cy - 2); c.lineTo(cx + 3, cy - 10); c.moveTo(cx + 2, cy); c.lineTo(cx + 8, cy - 7); c.stroke();
      break;
    case 'crate': {
      const [bx, by] = _L(cx, cy, (h(5) - 0.5) * 0.2, (h(6) - 0.5) * 0.2);
      _isoBox(c, bx, by, 0.48, 13, th.crateCol);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; _quad(c, bx, by - 13, 0.34); c.stroke();
      break;
    }
  }
}

function _cursor(c, cx, cy, time) {
  const p = 1 + Math.sin(time * 6) * 0.06, h = 0.5 * p;
  const pts = [_L(cx, cy, -h, -h), _L(cx, cy, h, -h), _L(cx, cy, h, h), _L(cx, cy, -h, h)];
  c.save(); c.strokeStyle = '#ffd27f'; c.lineWidth = 2; c.shadowColor = '#ffb43c'; c.shadowBlur = 8;
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], d = pts[(i + 3) % 4];
    c.moveTo(U.lerp(a[0], d[0], 0.28), U.lerp(a[1], d[1], 0.28)); c.lineTo(a[0], a[1]); c.lineTo(U.lerp(a[0], b[0], 0.28), U.lerp(a[1], b[1], 0.28));
  }
  c.stroke(); c.restore();
}

function drawTile(c, map, t, time, hl, cursor) {
  const top = tileTop(t), P0 = isoP(t.x, t.y, top), cx = P0.x, cy = P0.y;
  let fi = 0;
  _sides(cx, cy, 0.5, (p1, p2, nx, ny, lit) => {
    fi++;
    const ax = t.x + nx, ay = t.y + ny;
    const nt = ax >= 0 && ay >= 0 && ax < map.W && ay < map.H ? map.T[ay][ax] : null;
    const low = nt ? tileTop(nt) : -1.4;
    if (low < top) _sideFace(c, t, p1, p2, top, low, lit, nx * 2 + ny + 3, map);
  });
  _quad(c, cx, cy, 1); c.fillStyle = t.top; c.fill();
  _topDetail(c, t, cx, cy, time);
  c.lineWidth = 1;
  // tepi belakang lebih terang, tepi depan lebih gelap
  const ex = VIEW.ex, ey = VIEW.ey;
  for (let i = 0; i < 4; i++) {
    const sg = i & 1 ? -1 : 1, axX = i < 2, v = axX ? ex : ey;
    const p1 = axX ? _L(cx, cy, 0.5 * sg, -0.5) : _L(cx, cy, -0.5, 0.5 * sg);
    const p2 = axX ? _L(cx, cy, 0.5 * sg, 0.5) : _L(cx, cy, 0.5, 0.5 * sg);
    const front = v.y * sg > 0;
    c.strokeStyle = front ? '#000' : t.edge; c.globalAlpha = front ? 0.2 : 0.55;
    c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke();
  }
  c.globalAlpha = 1;
  if (hl) {
    const H = HLC[hl];
    _quad(c, cx, cy, 0.88);
    c.fillStyle = H[0]; c.fill();
    c.strokeStyle = H[1]; c.lineWidth = hl === 'target' ? 2 : 1.2;
    if (hl === 'target') c.globalAlpha = 0.6 + 0.4 * Math.sin(time * 8);
    c.stroke(); c.globalAlpha = 1;
  }
  _deco(c, t, cx, cy, map);
  if (cursor) _cursor(c, cx, cy, time);
}

class IsoRenderer {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.cam = { mx: 0, my: 0, tmx: 0, tmy: 0, h: 0, th: 0, z: 1, tz: 1 };
    this.rotT = 0; this.order = []; this.sortAng = null;
    this.fx = new FXSys(); this.time = 0; this.shake = 0; this.hover = null;
    this.resize();
  }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.bgKey = null;
  }
  setMap(map) {
    this.map = map;
    this.rotT = 0;
    setView(0, (map.W - 1) / 2, (map.H - 1) / 2);
    this.cam.mx = this.cam.tmx = (map.W - 1) / 2; this.cam.my = this.cam.tmy = (map.H - 1) / 2;
    this.cam.h = this.cam.th = 0;
    const z = Math.min((this.W * 0.9) / ((map.W + map.H) * 32), (this.H * 0.78) / ((map.W + map.H) * 16 + 80));
    this.cam.z = this.cam.tz = U.clamp(z * 1.3, 0.6, 1.8);
    this.tiles = [];
    for (const row of map.T) for (const t of row) this.tiles.push(t);
    this.sortAng = null;
    this.fx.clear();
  }
  rotate(dir) { this.rotT += (dir * Math.PI) / 2; }
  rotIndex() { return ((Math.round(this.rotT / (Math.PI / 2)) % 4) + 4) % 4; }
  focus(x, y, h = 0) { this.cam.tmx = x; this.cam.tmy = y; this.cam.th = h; }
  center() { return isoP(this.cam.mx, this.cam.my, this.cam.h); }
  screenToWorld(sx, sy) { const c = this.center(); return { x: (sx - this.W / 2) / this.cam.z + c.x, y: (sy - this.H / 2) / this.cam.z + c.y }; }
  panScreen(dx, dy, instant) {
    const d = screenToMapDelta(dx / this.cam.z, dy / this.cam.z);
    this.cam.tmx += d.x; this.cam.tmy += d.y;
    if (instant) { this.cam.mx = this.cam.tmx; this.cam.my = this.cam.tmy; }
    this.clampCam();
  }
  clampCam() {
    const m = this.map; if (!m) return;
    for (const k of ['mx', 'tmx']) this.cam[k] = U.clamp(this.cam[k], -1, m.W);
    for (const k of ['my', 'tmy']) this.cam[k] = U.clamp(this.cam[k], -1, m.H);
  }
  unitDepth(u) {
    if (u.mv) return Math.max(depthOf(u.mv.ax, u.mv.ay), depthOf(u.mv.bx, u.mv.by)) + 4;
    return depthOf(u.x, u.y) + 4;
  }
  update(dt, B) {
    this.time += dt;
    if (Math.abs(this.rotT - VIEW.ang) > 1e-4) {
      let a = VIEW.ang + (this.rotT - VIEW.ang) * (1 - Math.exp(-dt * 11));
      if (Math.abs(this.rotT - a) < 0.003) a = this.rotT;
      setView(a);
    }
    const k = 1 - Math.exp(-dt * 6);
    this.cam.mx += (this.cam.tmx - this.cam.mx) * k;
    this.cam.my += (this.cam.tmy - this.cam.my) * k;
    this.cam.h += (this.cam.th - this.cam.h) * k;
    this.cam.z += (this.cam.tz - this.cam.z) * (1 - Math.exp(-dt * 10));
    this.clampCam();
    this.shake = Math.max(0, this.shake - dt * 30);
    this.fx.update(dt);
    if (!B) return;
    for (const u of B.units) {
      for (const s in u.recoil) u.recoil[s] = Math.abs(u.recoil[s]) < 0.02 ? 0 : u.recoil[s] * Math.max(0, 1 - dt * 9);
      for (const s in u.flash) u.flash[s] = Math.max(0, u.flash[s] - dt);
      if (u.dead && u.deathShown && u.dying > 0) {
        u.dying = Math.max(0, u.dying - dt * 0.7);
        if (Math.random() < dt * 14) { const p = isoP(u.rx, u.ry, u.rh); this.fx.smoke(p.x, p.y - 14, 1, 0.5, '#2a2a2a', 0.5); }
      } else if (!u.dead && u.parts.body / u.max.body < 0.35 && Math.random() < dt * 5) {
        const p = isoP(u.rx, u.ry, u.rh); this.fx.smoke(p.x + U.rf(-4, 4), p.y - 34, 1, 0.35, '#333', 0.4);
      }
    }
  }
  sortTiles() {
    if (this.sortAng === VIEW.ang) return;
    this.sortAng = VIEW.ang;
    for (const t of this.tiles) t._d = depthOf(t.x, t.y);
    this.order = this.tiles.slice().sort((a, b) => a._d - b._d);
  }
  pick(sx, sy, B) {
    this.sortTiles();
    const w = this.screenToWorld(sx, sy);
    const us = B.units.filter((u) => !u.dead).sort((a, b) => this.unitDepth(b) - this.unitDepth(a));
    for (const u of us) {
      const p = isoP(u.rx, u.ry, u.rh), top = mechTop(u) * 0.5;
      if (w.x > p.x - 15 && w.x < p.x + 15 && w.y > p.y - top && w.y < p.y + 6) return { unit: u, tile: B.map.T[u.y][u.x] };
    }
    for (let i = this.order.length - 1; i >= 0; i--) {
      const t = this.order[i], p = isoP(t.x, t.y, tileTop(t));
      const d = screenToMapDelta(w.x - p.x, w.y - p.y);
      if (Math.abs(d.x) <= 0.5 && Math.abs(d.y) <= 0.5) return { tile: t, unit: B.unitAt(t.x, t.y) };
    }
    return null;
  }
  drawBG(c, th) {
    const key = this.W + 'x' + this.H + th.bg[0];
    if (this.bgKey !== key) {
      const g = c.createRadialGradient(this.W / 2, this.H * 0.45, 40, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
      g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
      this.bgGrad = g; this.bgKey = key;
    }
    c.fillStyle = this.bgGrad; c.fillRect(0, 0, this.W, this.H);
  }
  drawUnit(c, B, u) {
    const p = isoP(u.rx, u.ry, u.rh), x = p.x, y = p.y;
    let alpha = 1, sink = 0;
    if (u.dead && u.deathShown) { alpha = u.dying; sink = (1 - u.dying) * 8; }
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.ellipse(x, y + 1, 16, 7, 0, 0, 6.283); c.fill();
    const actedDim = u.team === 'P' && u.acted && B.phase === 'P';
    const col = u.team === 'P' ? (actedDim ? '#5b6670' : '#5fd4ff') : '#ff5a4d';
    c.strokeStyle = col; c.lineWidth = 1.6; c.globalAlpha = alpha * 0.9;
    c.beginPath(); c.ellipse(x, y + 1, 17, 8, 0, 0, 6.283); c.stroke();
    if (B.sel === u) {
      const pr = 1 + 0.12 * Math.sin(this.time * 6);
      c.strokeStyle = '#ffd27f'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 1, 21 * pr, 10 * pr, 0, 0, 6.283); c.stroke();
    }
    c.globalAlpha = alpha * (actedDim ? 0.72 : 1);
    const bob = u.dead ? 0 : Math.sin(this.time * 2.2 + u.id * 1.7) * 0.6;
    drawMech(c, u, x, y - (u.hop || 0) + sink, 0.5, screenFace(u), { bob, walk: u.walk, flash: u.flash, recoil: u.recoil, swing: u.swing, away: facingAway(u), t: this.time });
    c.restore();
  }
  drawBars(c, B) {
    for (const u of B.units) {
      if (u.dead) continue;
      const p = isoP(u.rx, u.ry, u.rh), x = p.x, y = p.y - mechTop(u) * 0.5 - 10 - (u.hop || 0), w = 30;
      c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 7.5);
      const r = u.parts.body / u.max.body;
      c.fillStyle = hpCol(r); c.fillRect(x - w / 2, y, w * r, 3.2);
      ['larm', 'rarm', 'legs'].forEach((pt, i) => { const rr = u.parts[pt] / u.max[pt]; c.fillStyle = rr <= 0 ? '#3a3a3a' : hpCol(rr); c.fillRect(x - w / 2 + i * 10.3, y + 4, 9, 1.8); });
      c.fillStyle = u.team === 'P' ? '#5fd4ff' : '#ff5a4d'; c.fillRect(x - w / 2 - 4, y - 1, 2.5, 7.5);
      if (u.boss) { c.fillStyle = '#ffb43c'; c.font = `700 10px ${FONT}`; c.textAlign = 'center'; c.fillText('★ BOSS', x, y - 6); }
      if (u.guarding) { c.fillStyle = '#8fc3ff'; c.font = `700 9px ${FONT}`; c.textAlign = 'left'; c.fillText('⛨', x + w / 2 + 3, y + 5); }
    }
  }
  drawCompass(c) {
    // kompas kecil di pojok: arah utara peta
    const x = this.W - 46, y = this.H - 46;
    if (Game.battle && document.getElementById('targetPanel') && !document.getElementById('targetPanel').classList.contains('hidden')) return;
    const n = { x: -VIEW.ey.x, y: -VIEW.ey.y }, L = Math.hypot(n.x, n.y) || 1;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(4,8,12,0.7)'; c.strokeStyle = 'rgba(120,175,215,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 24, 0, 6.28); c.fill(); c.stroke();
    c.rotate(Math.atan2(n.y / L, n.x / L) + Math.PI / 2);
    c.fillStyle = '#ff5a4d'; c.beginPath(); c.moveTo(0, -17); c.lineTo(5, 0); c.lineTo(-5, 0); c.closePath(); c.fill();
    c.fillStyle = '#9fb0bf'; c.beginPath(); c.moveTo(0, 17); c.lineTo(5, 0); c.lineTo(-5, 0); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#7f909e'; c.font = `600 9px ${FONT}`; c.textAlign = 'center'; c.fillText('Q ⟲  ⟳ E', x, y + 36);
  }
  render(B) {
    const c = this.ctx, map = B.map, z = this.cam.z;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBG(c, map.th);
    this.sortTiles();
    const ctr = this.center();
    const shx = this.shake ? U.rf(-1, 1) * this.shake : 0, shy = this.shake ? U.rf(-1, 1) * this.shake : 0;
    c.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (this.W / 2 - ctr.x * z + shx), this.dpr * (this.H / 2 - ctr.y * z + shy));
    const us = [];
    for (const u of B.units) { if (u.dead && u.deathShown && u.dying <= 0) continue; us.push([this.unitDepth(u), u]); }
    us.sort((a, b) => a[0] - b[0]);
    const hv = this.hover, showCur = B.phase === 'P' && !B.busy;
    let ui = 0;
    for (const t of this.order) {
      while (ui < us.length && us[ui][0] < t._d) this.drawUnit(c, B, us[ui++][1]);
      drawTile(c, map, t, this.time, B.hl.get(U.key(t.x, t.y)), showCur && hv && hv.x === t.x && hv.y === t.y);
    }
    while (ui < us.length) this.drawUnit(c, B, us[ui++][1]);
    this.drawBars(c, B);
    this.fx.draw(c);
    if (B.sel && !B.sel.dead) {
      const p = isoP(B.sel.rx, B.sel.ry, B.sel.rh), y = p.y - mechTop(B.sel) * 0.5 - 24 + Math.sin(this.time * 5) * 3;
      c.fillStyle = '#ffd27f'; c.beginPath(); c.moveTo(p.x - 6, y - 8); c.lineTo(p.x + 6, y - 8); c.lineTo(p.x, y); c.closePath(); c.fill();
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawCompass(c);
  }
}

// Pratinjau peta untuk briefing (selalu sudut standar)
function drawMapPreview(cv, map, time = 0) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(50, Math.round(r.width)), H = Math.max(50, Math.round(r.height));
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const c = cv.getContext('2d');
  const saved = { ang: VIEW.ang, cx: VIEW.cx, cy: VIEW.cy };
  setView(0, (map.W - 1) / 2, (map.H - 1) / 2);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const mw = (map.W + map.H) * 32, mh = (map.W + map.H) * 16 + (map.hmax + 2) * 16;
  const z = Math.min(W / mw, H / mh) * 0.94;
  c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2), dpr * (H / 2 + map.hmax * 8 * z));
  const hl = new Map();
  map.pSp.forEach((t) => hl.set(U.key(t.x, t.y), 'pspawn'));
  map.eSp.forEach((t) => hl.set(U.key(t.x, t.y), 'espawn'));
  for (let d = 0; d <= map.W + map.H - 2; d++)
    for (let x = Math.max(0, d - map.H + 1); x <= Math.min(d, map.W - 1); x++) {
      const y = d - x;
      drawTile(c, map, map.T[y][x], time, hl.get(U.key(x, y)), false);
    }
  setView(saved.ang, saved.cx, saved.cy);
}
