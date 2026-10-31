'use strict';
// ================= GAMBAR MECHA PROSEDURAL (v2) =================
// Koordinat lokal: kaki di y=0, menghadap kanan (+x).
// Bentuk badan/kaki/punggung ditentukan FRAME; kepala, bahu, lambang & warna ditentukan PILOT / tipe musuh.
const BUILDS = {
  wisp:     { legs: 'digi',  thigh: 17, shin: 22, legW: 6,    foot: 15, torso: 'wedge',  tw: 24, th: 22, armW: 6.5,  upper: 12, fore: 13, pad: 0.9,  head: 0.95, scale: 0.94, back: 'fin' },
  kestrel:  { legs: 'digi',  thigh: 18, shin: 23, legW: 6.8,  foot: 16, torso: 'jet',    tw: 27, th: 23, armW: 7,    upper: 13, fore: 14, pad: 1.0,  head: 0.95, scale: 0.98, back: 'wings' },
  vanguard: { legs: 'std',   thigh: 18, shin: 20, legW: 8.5,  foot: 17, torso: 'box',    tw: 30, th: 27, armW: 8.5,  upper: 14, fore: 15, pad: 1.1,  head: 1,    scale: 1,    back: 'pack' },
  bastion:  { legs: 'armor', thigh: 18, shin: 21, legW: 10,   foot: 19, torso: 'broad',  tw: 34, th: 29, armW: 9.5,  upper: 14, fore: 16, pad: 1.25, head: 1,    scale: 1.04, back: 'pack' },
  goliath:  { legs: 'heavy', thigh: 15, shin: 17, legW: 12.5, foot: 22, torso: 'barrel', tw: 40, th: 32, armW: 11.5, upper: 14, fore: 16, pad: 1.3, head: 0.95, scale: 1.08, back: 'reactor' },
  tyrant:   { legs: 'heavy', thigh: 19, shin: 21, legW: 13.5, foot: 24, torso: 'tyrant', tw: 44, th: 36, armW: 13,   upper: 16, fore: 18, pad: 1.35,  head: 1.25, scale: 1.22, back: 'reactor' },
};
// posisi moncong senjata relatif terhadap tangan
const W_MZ = { wasp: [26, -0.5], stinger: [33, -0.5], ravager: [33, -1], carbine: [43, 0], falcon: [67, 0], thunder: [48, -4], hailstorm: [31, -1], salamander: [36, -0.5], rod: [64, 0], blade: [70, 1], hammer: [58, 0], buckler: [10, 0], viper: [36, -0.5], hornet: [41, -0.5], tempest: [42, 0], breaker: [31, -2.2], cyclone: [31, 0], longbow: [57, 0], railspike: [55, 0], knuckle: [31, 0], pile: [48, 0], aegis: [12, 0], bulwark: [12, 0], none: [5, 0] };
// sudut diam senjata jarak dekat (rad, + = ke bawah)
const IDLE_WA = { blade: 0.32, rod: 0.24, hammer: -0.5 };
// titik pegangan tangan kedua pada senjata 2 tangan (jarak dari tangan pemicu)
const GRIP_AT = { falcon: 10, railspike: 11, thunder: 7, hailstorm: 7 };
// sentakan moncong saat menembak (rad per recoil)
const KICK = { SR: 0.22, BZ: 0.16, GL: 0.13, SG: 0.15, RF: 0.1, MG: 0.05, SMG: 0.05, FL: 0.02 };
// kunci animasi ayunan: [k, tanganX, tanganY (pecahan jangkauan lengan, relatif bahu), sudut senjata]
const SWING_KEYS = {
  slash: [[0.4, 0.05, -0.55, -2.3], [0.52, 0.86, 0.12, 0.8], [0.66, 0.8, 0.2, 0.9]],
  smash: [[0.4, -0.08, -0.62, -2.8], [0.52, 0.8, 0.24, 1.2], [0.7, 0.78, 0.28, 1.25]],
  thrust: [[0.4, 0.1, 0.34, 0.05], [0.52, 0.98, 0.02, 0], [0.68, 0.95, 0.04, 0]],
};
const SWING_HIT = 0.52;
const MELEE_LEN = { blade: 70, rod: 64, hammer: 58, knuckle: 31, pile: 48 };
const PAL_FLASH = { base: '#ffffff', light: '#ffffff', dark: '#eeeeee', sec: '#ffffff', metal: '#f0f0f0', metalL: '#ffffff' };
const PAL_DEAD = { base: '#2f3236', light: '#3c4046', dark: '#222427', sec: '#2a2c30', metal: '#1e2023', metalL: '#2c2f33' };
const DEFAULT_DESIGN = { head: 'visor', pad: 'round', mark: 'none' };

function mechGeom(u, A) {
  const B = BUILDS[u.frameId] || BUILDS.vanguard;
  const P = (A && A.parts) || u.parts;
  const bob = (A && A.bob) || 0;
  const hipY = -(B.thigh + B.shin + 6) + bob + (P.legs <= 0 ? 6 : 0);
  const bot = hipY - 4, top = bot - B.th;
  const g = { B, hipY, top, bot, cy: (top + bot) / 2, pod: { x: -B.tw * 0.28, y: top - 3 } };
  g.head = { x: B.tw * 0.1, y: top + (B.torso === 'barrel' ? 5 : B.torso === 'tyrant' ? 2 : 0) };
  const gs = gripSide(u, P);
  const aimOf = (side) => (A && A.aim && A.aim[side] != null ? A.aim[side] : 1);
  // lengan pemegang senjata 2 tangan dihitung lebih dulu agar tangan kedua bisa menempel
  for (const side of gs === 'larm' ? ['larm', 'rarm'] : ['rarm', 'larm']) {
    const back = side === 'larm';
    const sx = back ? -B.tw * 0.2 : B.tw * 0.02, sy = top + B.th * 0.3;
    const rc = (A && A.recoil && A.recoil[side]) || 0;
    const id = side === 'rarm' ? u.r : u.l, w = WEAPONS[id] || WEAPONS.none;
    const sw = A && A.swing && A.swing.side === side && MELEE_KIND[id] ? A.swing : null;
    let ex, ey, hx, hy, wa;
    if (sw) {
      ({ ex, ey, hx, hy, wa } = swingIK(B, id, sx, sy, sw.k));
    } else if (gs === side) {
      const aim = aimOf(side);
      ({ ex, ey, hx, hy } = _ik(sx, sy, sx + 1 + B.fore * 0.8 - rc * 3, sy + B.upper * 0.6 + (1 - aim) * 3, B.upper, B.fore));
      wa = 0.42 * (1 - aim) - rc * (KICK[w.type] || 0);
    } else if (gs) {
      const G = g[gs], go = GRIP_AT[gs === 'rarm' ? u.r : u.l] || 8, co = Math.cos(G.wa), si = Math.sin(G.wa);
      ({ ex, ey, hx, hy } = _ik(sx, sy, G.hx + co * go - si * 1.5, G.hy + si * go + co * 1.5, B.upper, B.fore));
      wa = G.wa;
    } else {
      ex = sx + 1 - rc * 2; ey = sy + B.upper;
      const gun = !['NONE', 'SHIELD', 'MELEE'].includes(w.type);
      const low = gun ? 0.42 * (1 - aimOf(side)) : 0, ext = B.fore - rc * (rc < 0 ? 8 : 3);
      wa = gun ? low - rc * (KICK[w.type] || 0) : IDLE_WA[id] || 0;
      if (low) { hx = ex + Math.cos(low) * ext + Math.sin(low); hy = ey + Math.sin(low) * ext - Math.cos(low); } else { hx = ex + ext; hy = ey - 1; }
    }
    const m = W_MZ[id] || W_MZ.none, co = Math.cos(wa), si = Math.sin(wa);
    g[side] = { sx, sy, ex, ey, hx, hy, wa, mx: hx + m[0] * co - m[1] * si, my: hy + m[0] * si + m[1] * co };
  }
  return g;
}
// lengan mana yang memegang senjata 2 tangan dengan tangan lain kosong (atau null)
function gripSide(u, P) {
  for (const side of ['rarm', 'larm']) {
    const o = side === 'rarm' ? 'larm' : 'rarm', id = side === 'rarm' ? u.r : u.l, oid = side === 'rarm' ? u.l : u.r;
    const w = WEAPONS[id];
    if (w && TWO_HAND.includes(w.type) && oid === 'none' && P[side] > 0 && P[o] > 0) return side;
  }
  return null;
}
// IK dua ruas: bahu -> siku -> tangan (siku menekuk ke bawah/depan)
function _ik(sx, sy, tx, ty, a, b) {
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 0.001;
  const mx = a + b - 0.05;
  if (d > mx) { tx = sx + (dx / d) * mx; ty = sy + (dy / d) * mx; d = mx; }
  d = Math.max(d, Math.abs(a - b) + 0.05);
  const base = Math.atan2(ty - sy, tx - sx), off = Math.acos(U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return { ex: sx + Math.cos(base + off) * a, ey: sy + Math.sin(base + off) * a, hx: tx, hy: ty };
}
// pose tangan & senjata saat mengayun pada fase k (0..1)
function swingIK(B, id, sx, sy, k) {
  const L = B.upper + B.fore, rest = [1 + B.fore, B.upper - 1, IDLE_WA[id] || 0];
  const keys = [[0, ...rest], ...SWING_KEYS[MELEE_KIND[id]].map(([kk, x, y, w]) => [kk, x * L, y * L, w]), [1, ...rest]];
  let i = 0;
  while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], t = U.clamp((k - a[0]) / (b[0] - a[0] || 1), 0, 1), e = t * t * (3 - 2 * t);
  const r = _ik(sx, sy, sx + U.lerp(a[1], b[1], e), sy + U.lerp(a[2], b[2], e), B.upper, B.fore);
  r.wa = U.lerp(a[3], b[3], e);
  return r;
}

function mechPoint(u, x, y, s, face, which, A) {
  const g = mechGeom(u, A || {}), S = s * g.B.scale;
  let lx = 0, ly = g.cy;
  switch (which) {
    case 'body': lx = g.B.tw * 0.05; ly = g.cy; break;
    case 'larm': lx = g.larm.ex - 2; ly = g.larm.sy + 4; break;
    case 'rarm': lx = g.rarm.ex + 3; ly = g.rarm.ey - 2; break;
    case 'legs': lx = 4; ly = g.hipY * 0.45; break;
    case 'mz_rarm': lx = g.rarm.mx; ly = g.rarm.my; break;
    case 'mz_larm': lx = g.larm.mx; ly = g.larm.my; break;
    case 'h_rarm': lx = g.rarm.hx + 4; ly = g.rarm.hy - 3; break;
    case 'h_larm': lx = g.larm.hx + 4; ly = g.larm.hy - 3; break;
    case 'pod':
      if (u.sh === 'quake') { lx = g.pod.x + 10; ly = g.pod.y - 16; }
      else { lx = g.pod.x + (u.sh === 'harpoon' ? 16 : 12); ly = g.pod.y - 4; }
      break;
    case 'head': lx = g.head.x + 3; ly = g.head.y - 6 * g.B.head; break;
  }
  return { x: x + lx * S * face, y: y + ly * S };
}
// tinggi visual mecha (piksel per skala 1) — untuk bar HP & picking
function mechTop(u) { const g = mechGeom(u, {}); return -(g.top - 12 * g.B.head) * g.B.scale; }

// ---------- primitif ----------
function MP(R, pts, col, grad) {
  const c = R.c;
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (R.det && grad !== false) {
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
    const g = c.createLinearGradient(0, y0, 0, y1 + 0.01);
    g.addColorStop(0, U.shade(col, 0.16)); g.addColorStop(1, U.shade(col, -0.18));
    c.fillStyle = g;
  } else c.fillStyle = col;
  c.fill(); c.stroke();
}
function MF(R, pts, col) { // isi tanpa garis tepi
  const c = R.c;
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fillStyle = col; c.fill();
}
function ML(R, x1, y1, w1, x2, y2, w2, col) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  MP(R, [x1 + nx * w1 / 2, y1 + ny * w1 / 2, x2 + nx * w2 / 2, y2 + ny * w2 / 2, x2 - nx * w2 / 2, y2 - ny * w2 / 2, x1 - nx * w1 / 2, y1 - ny * w1 / 2], col);
}
function MC(R, x, y, r, col, stroke = true) { const c = R.c; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = col; c.fill(); if (stroke) c.stroke(); }
function MR(R, x, y, w, h, col) { MP(R, [x, y, x + w, y, x + w, y + h, x, y + h], col); }
function MLine(R, pts, col, w) {
  const c = R.c, lw = c.lineWidth;
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke(); c.lineWidth = lw; c.strokeStyle = R.ink;
}
function MGlow(R, x, y, r, col) {
  if (!R.det || R.away) return;
  const c = R.c;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, U.rgba(col, 0.5)); g.addColorStop(0.35, U.rgba(col, 0.18)); g.addColorStop(1, U.rgba(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  c.restore();
}
function _pal(R, part, back) {
  if (R.F[part] > 0) return PAL_FLASH;
  if (part === 'legs' && R.P.legs <= 0) return PAL_DEAD;
  const C = R.C;
  return back
    ? { base: C.dark, light: C.base, dark: C.darker, sec: C.secD, metal: C.metalD, metalL: C.metal }
    : { base: C.base, light: C.light, dark: C.dark, sec: C.sec, metal: C.metal, metalL: C.metalL };
}
function _eye(R) { return R.away ? '#1b1f24' : R.C.visor; }

// ---------- kaki ----------
function _legStd(R, hx, hy, sw, back) {
  const B = R.B, p = _pal(R, 'legs', back), heavy = B.legs === 'heavy', armor = B.legs === 'armor';
  const lift = Math.max(0, sw) * 5, w = B.legW;
  const ax = hx + sw * 7 - 1, ay = -7 - lift;
  const kx = hx + 6 + sw * 4, ky = hy + B.thigh - lift * 0.4;
  ML(R, hx, hy, w * 1.05, kx, ky, w * 0.85, p.metal);
  ML(R, kx, ky, w * 0.85, ax, ay, w * 0.75, p.metal);
  if (heavy) MLine(R, [kx - w * 0.75, ky + 3, ax - w * 0.85, ay - 4], p.metalL, w * 0.28);
  MP(R, [hx - w * 0.62, hy - 3, hx + w * 0.72, hy - 4, kx + w * 0.55, ky - 5, kx - w * 0.6, ky - 3], p.base);
  const sk = heavy ? 1.3 : armor ? 1.18 : 1;
  MP(R, [kx - w * 0.5 * sk, ky + 1, kx + w * 0.78 * sk, ky + 1, ax + w * 0.7 * sk, ay - 3, ax - w * 0.5 * sk, ay - 6], p.sec);
  MF(R, [kx + w * 0.38 * sk, ky + 2, kx + w * 0.74 * sk, ky + 2, ax + w * 0.66 * sk, ay - 3, ax + w * 0.32 * sk, ay - 4], p.light);
  if (armor || heavy) MP(R, [kx - w * 0.6 * sk, ay - 10, ax + w * 0.75 * sk, ay - 8, ax + w * 0.7 * sk, ay - 2, kx - w * 0.6 * sk, ay - 3], p.base);
  const kk = armor || heavy ? 1.3 : 1;
  MP(R, [kx - w * 0.55, ky - 6, kx + w * 0.5, ky - 7 * kk, kx + w * 0.95 * kk, ky + 1, kx + w * 0.3, ky + 6 * kk, kx - w * 0.45, ky + 3], p.light);
  if (R.det) MC(R, kx + w * 0.2, ky, w * 0.16, p.metal, false);
  MC(R, ax, ay, w * 0.38, p.metal);
  const f = B.foot;
  MP(R, [ax - f * 0.48, -lift, ax - f * 0.34, ay + 1, ax + f * 0.2, ay, ax + f * 0.64, -lift - 2.5, ax + f * 0.62, -lift], p.dark);
  MF(R, [ax + f * 0.22, ay + 0.5, ax + f * 0.6, -lift - 2.5, ax + f * 0.58, -lift - 0.5, ax + f * 0.3, -lift - 0.5], p.base);
}
function _legDigi(R, hx, hy, sw, back) {
  const B = R.B, p = _pal(R, 'legs', back), w = B.legW;
  const lift = Math.max(0, sw) * 5;
  const kx = hx + 9 + sw * 3, ky = hy + B.thigh * 0.8 - lift * 0.3;
  const jx = hx - 5 + sw * 5, jy = -B.shin * 0.55 - lift;
  const ax = hx + 1 + sw * 7, ay = -5 - lift;
  ML(R, hx, hy, w * 1.1, kx, ky, w * 0.9, p.metal);
  MP(R, [hx - w * 0.6, hy - 3, hx + w * 0.8, hy - 3, kx + w * 0.6, ky - 2, kx - w * 0.4, ky + 2], p.base);
  ML(R, kx, ky, w * 0.85, jx, jy, w * 0.7, p.metal);
  MP(R, [kx - w * 0.1, ky - 2, kx + w * 0.65, ky + 1, jx + w * 0.35, jy + 2, jx - w * 0.6, jy - 1], p.sec);
  ML(R, jx, jy, w * 0.65, ax, ay, w * 0.6, p.metal);
  MC(R, jx, jy, w * 0.42, p.dark);
  MP(R, [kx - w * 0.3, ky - 4, kx + w * 1.0, ky - 1, kx + w * 0.1, ky + 4], p.light);
  const f = B.foot;
  MP(R, [ax - 2, ay - 1, ax + f * 0.62, -lift - 1.5, ax + f * 0.58, -lift, ax - 1, -lift], p.dark);
  MP(R, [ax - 1, ay, ax - f * 0.42, -lift, ax - f * 0.22, -lift - 2.2], p.dark);
}
function _leg(R, hx, hy, sw, back) { if (R.B.legs === 'digi') _legDigi(R, hx, hy, sw, back); else _legStd(R, hx, hy, sw, back); }

// ---------- panggul ----------
function _pelvis(R) {
  const B = R.B, tw = B.tw, y = R.g.hipY, p = _pal(R, 'body', false);
  MP(R, [-tw * 0.34, y - 7, tw * 0.3, y - 7, tw * 0.24, y + 4, -tw * 0.28, y + 4], p.metal);
  MP(R, [-tw * 0.08, y - 5, tw * 0.12, y - 5, tw * 0.06, y + 4, -tw * 0.04, y + 4], p.dark);
}
function _skirt(R) {
  const B = R.B, tw = B.tw, y = R.g.hipY, p = _pal(R, 'body', false);
  if (B.legs === 'digi') return;
  const d = B.legs === 'std' ? 5 : 10;
  MP(R, [tw * 0.04, y - 5, tw * 0.42, y - 6, tw * 0.36, y + d, tw * 0.08, y + d - 1], p.sec);
  if (B.legs !== 'std') MP(R, [-tw * 0.44, y - 5, -tw * 0.12, y - 5, -tw * 0.16, y + d - 2, -tw * 0.42, y + d - 3], p.dark);
}

// ---------- punggung ----------
function _back(R) {
  const B = R.B, tw = B.tw, t = R.g.top, b = R.g.bot, h = b - t, p = _pal(R, 'body', true), u = R.u;
  switch (B.back) {
    case 'fin':
      MP(R, [-tw * 0.38, t + h * 0.25, -tw * 0.98, t - h * 0.3, -tw * 0.5, t + h * 0.5], p.sec);
      break;
    case 'wings':
      MP(R, [-tw * 0.3, t + h * 0.3, -tw * 1.2, t - h * 0.25, -tw * 1.1, t + h * 0.02, -tw * 0.42, t + h * 0.62], p.base);
      MF(R, [-tw * 0.45, t + h * 0.25, -tw * 1.12, t - h * 0.18, -tw * 1.08, t - h * 0.06, -tw * 0.5, t + h * 0.38], p.light);
      MP(R, [-tw * 0.62, b - h * 0.42, -tw * 0.42, b - h * 0.48, -tw * 0.42, b - h * 0.15, -tw * 0.66, b - h * 0.2], p.metal);
      break;
    case 'pack':
      MP(R, [-tw * 0.86, t + h * 0.12, -tw * 0.38, t + h * 0.02, -tw * 0.38, b - h * 0.08, -tw * 0.82, b - h * 0.2], p.sec);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [-tw * 0.78, t + h * (0.3 + i * 0.14), -tw * 0.5, t + h * (0.28 + i * 0.14)], p.dark, 1.2);
      break;
    case 'reactor':
      MP(R, [-tw * 0.98, t + h * 0.08, -tw * 0.4, t, -tw * 0.4, b - h * 0.05, -tw * 0.95, b - h * 0.15], p.sec);
      MR(R, -tw * 0.86, t - h * 0.32, tw * 0.13, h * 0.42, p.metal);
      MR(R, -tw * 0.66, t - h * 0.22, tw * 0.11, h * 0.32, p.metal);
      if (!(R.F.body > 0)) {
        R.c.fillStyle = R.u.boss ? '#ff5a2a' : '#ffb86a';
        R.c.fillRect(-tw * 0.84, t - h * 0.3, tw * 0.09, 2); R.c.fillRect(-tw * 0.645, t - h * 0.2, tw * 0.08, 2);
        MGlow(R, -tw * 0.79, t - h * 0.32, tw * 0.25, R.u.boss ? '#ff5a2a' : '#ffb86a');
      }
      break;
  }
  const bp = BACKPACKS[u.bp] || BACKPACKS.none;
  if (bp.kind === 'booster') {
    for (let i = 0; i < 2; i++) {
      const y = b - h * (0.5 - i * 0.28);
      MP(R, [-tw * 0.55, y - 3.5, -tw * 0.95, y - 4.5, -tw * 1.0, y + 4.5, -tw * 0.55, y + 3.5], p.metal);
      MGlow(R, -tw * 1.04, y, tw * 0.22, '#7fd6ff');
    }
  } else if (bp.kind === 'sensor') {
    const x = -tw * 0.62, y = t + h * 0.1;
    MLine(R, [x, y, x - tw * 0.12, y - h * 0.75], p.metalL, 1.8);
    R.c.save(); R.c.translate(x - tw * 0.12, y - h * 0.75); R.c.rotate(-0.5);
    MP(R, [-6, -1, 6, -1, 4, 3, -4, 3], p.light);
    R.c.restore();
    MC(R, x - tw * 0.12, y - h * 0.75, 1.4, R.F.body > 0 ? '#fff' : '#ff5a4d', false);
  } else if (bp.kind === 'ammo') {
    const x = -tw * 0.86, y = b - h * 0.45, s = tw * 0.3;
    MP(R, [x, y - s * 0.45, x + s, y - s * 0.5, x + s, y + s * 0.5, x, y + s * 0.55], '#5a5a3a');
    R.c.fillStyle = '#ffd24a'; R.c.fillRect(x + s * 0.15, y - s * 0.12, s * 0.7, s * 0.22);
  } else if (bp.kind === 'repair') {
    const x = -tw * 0.8, y = b - h * 0.3, s = tw * 0.22;
    MP(R, [x, y - s * 0.5, x + s, y - s * 0.55, x + s, y + s * 0.5, x, y + s * 0.55], p.dark);
    R.c.fillStyle = R.F.body > 0 ? '#fff' : '#5fe08a';
    R.c.fillRect(x + s * 0.38, y - s * 0.32, s * 0.24, s * 0.64); R.c.fillRect(x + s * 0.18, y - s * 0.12, s * 0.64, s * 0.24);
  }
}

// ---------- peluncur bahu ----------
function _launcher(R) {
  const u = R.u;
  if (!u.sh || u.sh === 'none' || R.P.body <= 0) return;
  const px = R.g.pod.x, py = R.g.pod.y, p = _pal(R, 'body', false), tw = R.B.tw;
  MLine(R, [px - 2, py + 5, -tw * 0.2, R.g.top + 5], p.metal, 2.5);
  if (u.sh === 'quake') {
    MP(R, [px - 12, py + 2, px + 6, py + 1, px + 7, py + 8, px - 12, py + 9], p.dark);
    R.c.save(); R.c.translate(px - 2, py + 2); R.c.rotate(-0.95);
    MP(R, [0, -5.5, 22, -6, 22, 6, 0, 5.5], p.sec);
    MR(R, 20, -7.5, 4, 15, p.metal);
    if (R.det) { R.c.fillStyle = '#ffd24a'; R.c.fillRect(6, -5.5, 3, 11); R.c.fillRect(13, -5.5, 3, 11); }
    R.c.restore();
    return;
  }
  if (u.sh === 'hydra') {
    MP(R, [px - 13, py - 12, px + 9, py - 13, px + 11, py + 7, px - 13, py + 8], p.sec);
    MP(R, [px + 9, py - 13, px + 12, py - 12, px + 13, py + 6, px + 11, py + 7], p.dark);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) MC(R, px + 10.5 + j * 1.6, py - 8 + i * 9, 2.6, '#d94a3a', false);
    MLine(R, [px - 13, py - 2.5, px + 9, py - 3], p.dark, 1.2);
    return;
  }
  if (u.sh === 'harpoon') {
    MP(R, [px - 17, py - 9, px + 12, py - 12, px + 15, py + 5, px - 17, py + 7], p.sec);
    MP(R, [px - 17, py - 9, px - 22, py - 15, px - 12, py - 10], p.dark);
    MP(R, [px + 12, py - 12, px + 16, py - 11, px + 18, py + 4, px + 15, py + 5], p.dark);
    for (let i = 0; i < 3; i++) MC(R, px + 16, py - 8 + i * 5.2, 1.9, '#e8e8e8', false);
    for (let i = 0; i < 3; i++) MC(R, px + 16.6, py - 8 + i * 5.2, 1.1, '#d94a3a', false);
    if (R.det) { MLine(R, [px - 4, py - 11, px - 4, py - 17], p.metal, 1.2); MP(R, [px - 9, py - 19, px + 1, py - 19, px - 4, py - 15], p.light); }
  } else {
    MP(R, [px - 12, py - 8, px + 8, py - 10, px + 10, py + 4, px - 12, py + 5], p.sec);
    MP(R, [px + 8, py - 10, px + 11, py - 9, px + 12, py + 3, px + 10, py + 4], p.dark);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) MC(R, px + 9.6 + j * 1.6, py - 5.5 + i * 6, 1.9, '#d94a3a', false);
    if (R.det) { R.c.fillStyle = '#ffd24a'; for (let k = 0; k < 3; k++) R.c.fillRect(px - 9 + k * 5, py - 2, 2.2, 5); }
  }
}

// ---------- badan ----------
function _mark(R, where, x, y, s) {
  const D = R.D, c = R.c, A = R.C.accent;
  if (R.F.body > 0) return;
  switch (D.mark) {
    case 'star': if (where !== 'pad') return;
      c.fillStyle = A; c.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.4 : s, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      c.closePath(); c.fill(); break;
    case 'wing': if (where !== 'pad') return;
      MF(R, [x - s * 1.2, y - s * 0.6, x, y + s * 0.4, x + s * 1.2, y - s * 0.6, x, y - s * 0.05], A); break;
    case 'chevron': if (where !== 'chest') return;
      MLine(R, [x - s, y - s * 0.6, x, y + s * 0.3, x + s, y - s * 0.6], A, s * 0.45); break;
    case 'number': if (where !== 'pad' || !R.det) return;
      c.fillStyle = A; c.font = `700 ${s * 1.7}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save(); c.translate(x, y); if (R.face < 0) c.scale(-1, 1); c.fillText(String(D.num || 1), 0, 0); c.restore(); break;
    case 'skull': if (where !== 'pad') return;
      MC(R, x, y - s * 0.15, s * 0.8, '#e8e2d4', false); c.fillStyle = '#1a1a1a';
      c.fillRect(x - s * 0.45, y - s * 0.3, s * 0.3, s * 0.3); c.fillRect(x + s * 0.15, y - s * 0.3, s * 0.3, s * 0.3);
      c.fillStyle = '#e8e2d4'; c.fillRect(x - s * 0.4, y + s * 0.45, s * 0.8, s * 0.3); break;
    case 'hazard': if (where !== 'pad') return;
      for (let i = 0; i < 3; i++) MF(R, [x - s + i * s * 0.8, y + s * 0.4, x - s * 0.6 + i * s * 0.8, y + s * 0.4, x - s * 0.2 + i * s * 0.8, y - s * 0.4, x - s * 0.6 + i * s * 0.8, y - s * 0.4], '#ffd24a');
      break;
  }
}
function _camo(R, pts) {
  if (R.D.mark !== 'camo' || R.F.body > 0) return;
  const c = R.c; c.save(); c.globalAlpha = 0.4; c.fillStyle = R.C.darker;
  for (const [x, y, r] of pts) { c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0.4, 0, 6.2832); c.fill(); }
  c.restore();
}
function _torso(R) {
  const B = R.B, tw = B.tw, t = R.g.top, b = R.g.bot, h = b - t, p = _pal(R, 'body', false), fl = R.F.body > 0;
  const lens = (pts) => { if (!fl) { MF(R, pts, _eye(R)); MGlow(R, pts[0], pts[1], tw * 0.18, R.C.visor); } };
  switch (B.torso) {
    case 'wedge':
      MP(R, [-tw * 0.62, t + h * 0.3, -tw * 0.42, t + h * 0.15, -tw * 0.42, b - h * 0.2, -tw * 0.58, b - h * 0.3], p.dark);
      MP(R, [-tw * 0.48, t + h * 0.22, -tw * 0.22, t, tw * 0.22, t, tw * 0.7, t + h * 0.45, tw * 0.4, b, -tw * 0.42, b], p.base);
      MP(R, [-tw * 0.1, t + 2, tw * 0.2, t + 2, tw * 0.56, t + h * 0.42, tw * 0.04, t + h * 0.46], p.light);
      MP(R, [-tw * 0.42, b - h * 0.3, tw * 0.5, b - h * 0.3, tw * 0.4, b, -tw * 0.42, b], p.sec);
      lens([tw * 0.5, t + h * 0.47, tw * 0.64, t + h * 0.47, tw * 0.56, t + h * 0.58, tw * 0.46, t + h * 0.56]);
      break;
    case 'jet':
      MP(R, [-tw * 0.5, t + h * 0.2, -tw * 0.2, t + h * 0.02, tw * 0.3, t, tw * 0.74, t + h * 0.42, tw * 0.45, b, -tw * 0.4, b], p.base);
      if (!fl) {
        MP(R, [tw * 0.06, t + 1, tw * 0.32, t + 1, tw * 0.64, t + h * 0.38, tw * 0.18, t + h * 0.4], U.shade(R.C.visor, -0.35), false);
        if (!R.away) MF(R, [tw * 0.16, t + 2.5, tw * 0.24, t + 2.5, tw * 0.42, t + h * 0.32, tw * 0.33, t + h * 0.33], 'rgba(255,255,255,0.55)');
      }
      MP(R, [-tw * 0.4, b - h * 0.32, tw * 0.55, b - h * 0.32, tw * 0.45, b, -tw * 0.4, b], p.sec);
      MP(R, [-tw * 0.5, t + h * 0.2, -tw * 0.2, t + h * 0.02, -tw * 0.05, t + h * 0.5, -tw * 0.45, t + h * 0.6], p.light);
      break;
    case 'box':
      MP(R, [-tw * 0.6, t + h * 0.2, -tw * 0.4, t + h * 0.1, -tw * 0.4, b - h * 0.12, -tw * 0.58, b - h * 0.22], p.dark);
      MP(R, [-tw * 0.45, t + h * 0.1, -tw * 0.3, t, tw * 0.32, t, tw * 0.52, t + h * 0.15, tw * 0.56, t + h * 0.55, tw * 0.44, b, -tw * 0.42, b], p.base);
      MP(R, [-tw * 0.05, t + 3, tw * 0.3, t + 3, tw * 0.48, t + h * 0.18, tw * 0.5, t + h * 0.5, tw * 0.05, t + h * 0.52], p.light);
      MP(R, [-tw * 0.42, b - h * 0.28, tw * 0.47, b - h * 0.28, tw * 0.44, b, -tw * 0.42, b], p.sec);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [-tw * 0.32, t + h * (0.25 + i * 0.1), -tw * 0.12, t + h * (0.25 + i * 0.1)], p.dark, 1.1);
      lens([tw * 0.46, t + h * 0.56, tw * 0.56, t + h * 0.56, tw * 0.54, t + h * 0.64, tw * 0.44, t + h * 0.64]);
      break;
    case 'broad':
      MP(R, [-tw * 0.32, t - 7, tw * 0.08, t - 9, tw * 0.14, t + 3, -tw * 0.36, t + 4], p.dark);
      MP(R, [-tw * 0.52, t + h * 0.08, -tw * 0.36, t, tw * 0.38, t, tw * 0.6, t + h * 0.2, tw * 0.6, t + h * 0.62, tw * 0.46, b, -tw * 0.46, b], p.base);
      MP(R, [-tw * 0.02, t + 3, tw * 0.36, t + 3, tw * 0.55, t + h * 0.22, tw * 0.55, t + h * 0.42, tw * 0.02, t + h * 0.42], p.light);
      MP(R, [tw * 0.02, t + h * 0.46, tw * 0.55, t + h * 0.46, tw * 0.55, t + h * 0.64, tw * 0.06, t + h * 0.66], p.sec);
      MP(R, [-tw * 0.46, b - h * 0.24, tw * 0.48, b - h * 0.24, tw * 0.46, b, -tw * 0.46, b], p.dark);
      MP(R, [-tw * 0.52, t + h * 0.1, -tw * 0.3, t + h * 0.12, -tw * 0.28, t + h * 0.7, -tw * 0.5, t + h * 0.66], p.sec);
      break;
    case 'barrel': {
      const c = R.c, cx = tw * 0.02, cy = (t + b) / 2;
      c.beginPath(); c.ellipse(cx, cy, tw * 0.56, h * 0.56, 0, 0, 6.2832);
      if (R.det) { const g = c.createLinearGradient(0, t, 0, b); g.addColorStop(0, U.shade(p.base, 0.16)); g.addColorStop(1, U.shade(p.base, -0.2)); c.fillStyle = g; } else c.fillStyle = p.base;
      c.fill(); c.stroke();
      MP(R, [tw * 0.1, t + h * 0.12, tw * 0.48, t + h * 0.22, tw * 0.58, t + h * 0.55, tw * 0.42, t + h * 0.85, tw * 0.12, t + h * 0.8], p.light);
      MP(R, [-tw * 0.5, t + h * 0.3, -tw * 0.2, t + h * 0.25, -tw * 0.2, t + h * 0.75, -tw * 0.48, t + h * 0.7], p.sec);
      if (R.det) for (let i = 0; i < 4; i++) MLine(R, [-tw * 0.45, t + h * (0.38 + i * 0.09), -tw * 0.26, t + h * (0.36 + i * 0.09)], p.dark, 1.3);
      lens([tw * 0.44, t + h * 0.45, tw * 0.54, t + h * 0.47, tw * 0.52, t + h * 0.58, tw * 0.42, t + h * 0.56]);
      break;
    }
    case 'tyrant': {
      MP(R, [-tw * 0.4, t - 4, -tw * 0.5, t - 14, -tw * 0.28, t - 3], p.light);
      MP(R, [-tw * 0.2, t - 4, -tw * 0.22, t - 17, -tw * 0.04, t - 4], p.light);
      MP(R, [-tw * 0.56, t + h * 0.1, -tw * 0.4, t - 2, tw * 0.4, t - 2, tw * 0.64, t + h * 0.2, tw * 0.62, t + h * 0.62, tw * 0.48, b, -tw * 0.5, b], p.base);
      MP(R, [-tw * 0.04, t + 3, tw * 0.38, t + 3, tw * 0.58, t + h * 0.22, tw * 0.54, t + h * 0.48, -tw * 0.02, t + h * 0.48], p.light);
      MP(R, [-tw * 0.5, b - h * 0.26, tw * 0.5, b - h * 0.26, tw * 0.48, b, -tw * 0.5, b], p.sec);
      if (!fl) {
        const ox = tw * 0.32, oy = t + h * 0.62, pulse = 0.7 + 0.3 * Math.sin(R.t * 4);
        MC(R, ox, oy, tw * 0.12, '#3a0c0c');
        MC(R, ox, oy, tw * 0.08 * pulse, '#ff5a2a', false);
        MGlow(R, ox, oy, tw * 0.35, '#ff5a2a');
        if (!R.det) { R.c.fillStyle = '#ff5a2a'; R.c.beginPath(); R.c.arc(ox, oy, tw * 0.06, 0, 6.28); R.c.fill(); }
      }
      MLine(R, [-tw * 0.45, t + h * 0.36, tw * 0.1, t + h * 0.36], R.C.accent, 2);
      break;
    }
  }
  if (!fl && B.torso !== 'tyrant' && R.D.mark !== 'camo') {
    R.c.fillStyle = R.C.accent;
    R.c.fillRect(-tw * 0.36, t + h * 0.56, tw * 0.5, h * 0.07);
  }
  if (R.D.mark === 'stripe' && !fl) { MF(R, [-tw * 0.3, t + h * 0.15, -tw * 0.18, t + h * 0.15, -tw * 0.32, t + h * 0.6, -tw * 0.44, t + h * 0.6], R.C.accent); MF(R, [-tw * 0.12, t + h * 0.15, -tw * 0.02, t + h * 0.15, -tw * 0.16, t + h * 0.6, -tw * 0.26, t + h * 0.6], R.C.accent); }
  _mark(R, 'chest', tw * 0.22, t + h * 0.3, tw * 0.13);
  _camo(R, [[-tw * 0.2, t + h * 0.3, tw * 0.14], [tw * 0.2, t + h * 0.65, tw * 0.12], [-tw * 0.3, b - h * 0.2, tw * 0.1]]);
  if (R.P.body / R.u.max.body < 0.5 && !fl) {
    const c = R.c; c.fillStyle = 'rgba(18,12,8,0.55)';
    c.beginPath(); c.arc(tw * 0.12, t + h * 0.62, h * 0.15, 0, 7); c.fill();
    if (R.P.body / R.u.max.body < 0.25) { c.beginPath(); c.arc(-tw * 0.22, t + h * 0.3, h * 0.12, 0, 7); c.fill(); }
  }
}

// ---------- kepala ----------
function _head(R) {
  const c = R.c, k = R.B.head, p = _pal(R, 'body', false), E = _eye(R), V = R.C.visor;
  c.save(); c.translate(R.g.head.x, R.g.head.y); c.scale(k, k);
  switch (R.D.head) {
    case 'crest':
    case 'visor':
      if (R.D.head === 'crest') { MP(R, [1, -9, 14, -22, 5, -9], R.C.accent); MP(R, [-1, -9, -10, -19, 1, -8], R.C.accent); }
      MP(R, [-7, 2, -7, -6, -2, -10, 6, -10, 11, -6, 12, 0, 9, 3], p.base);
      MP(R, [4, -5, 12, -3, 12, 1, 6, 2], p.dark);
      MF(R, [3, -6.5, 11.5, -4.5, 11, -2.8, 2.5, -4.5], E);
      MC(R, -2, -3, 2.5, p.sec);
      MGlow(R, 9, -4, 4.8, V);
      break;
    case 'twin':
      MP(R, [-6, 2, -7, -5, -3, -10, 6, -10, 11, -5, 11, 1, 7, 3], p.base);
      MP(R, [3, -2, 11, -1, 10, 2, 4, 3], p.dark);
      MC(R, 6, -5.5, 1.9, E, false); MC(R, 9.6, -4.3, 1.6, E, false);
      MGlow(R, 8, -5, 4.8, V);
      if (R.det) MLine(R, [-3, -9, -6, -15], p.metalL, 1);
      break;
    case 'mono':
      MP(R, [-6, 3, -7, -3, -4, -9, 3, -11, 9, -8, 11, -2, 9, 3], p.base);
      MP(R, [-3, -6, 11, -5.5, 11, -1.5, -3, -1.5], p.dark);
      MC(R, 8, -3.5, 2.4, E, false);
      MGlow(R, 8, -3.5, 6, V);
      MP(R, [-4, -9, 3, -11, 4, -13, -3, -11], p.light);
      break;
    case 'sniper':
      MP(R, [-6, 2, -6, -8, 7, -9, 9, -3, 7, 2], p.base);
      MP(R, [6, -8.5, 19, -8, 19, -4, 6, -4], p.dark);
      MC(R, 19, -6, 2, E);
      MGlow(R, 19, -6, 5.4, V);
      MLine(R, [-4, -8, -8, -18], p.metalL, 1.2);
      MF(R, [3, -2.5, 8, -2.2, 7.5, -0.8, 3, -1], E);
      break;
    case 'dome':
      MP(R, [-8, 2, -8, -4, -3, -8, 6, -8, 11, -4, 12, 2], p.base);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [-4 + i * 3, -6, -4 + i * 3, 0], p.dark, 0.9);
      MF(R, [6, -4.5, 11.5, -3, 11.5, -1.5, 6, -2.5], E);
      MGlow(R, 9, -3, 4.8, V);
      break;
    case 'horn':
      MP(R, [4, -9, 16, -15, 9, -7], p.light);
      MP(R, [-1, -9, 2, -18, 3, -8], p.light);
      MP(R, [-6, 2, -5, -7, 4, -10, 12, -5, 10, 2], p.base);
      MF(R, [4, -5, 11.5, -3.5, 11, -2, 4, -3.2], E);
      MGlow(R, 9, -4, 4.8, V);
      break;
    case 'tyrant':
      MP(R, [6, -12, 18, -26, 11, -11], R.C.accent);
      MP(R, [-3, -12, -14, -24, 0, -13], R.C.accent);
      MP(R, [-9, 3, -9, -8, -2, -13, 8, -13, 14, -7, 15, 1, 11, 4], p.base);
      MP(R, [6, -3, 15, -1, 14, 3, 7, 4], p.dark);
      for (const [x, y] of [[8, -7], [11, -5.5], [13.5, -4]]) MC(R, x, y, 1.6, E, false);
      MGlow(R, 11, -6, 7.2, V);
      break;
  }
  c.restore();
}

// ---------- bahu ----------
function _pad(R, a, back) {
  const B = R.B, pw = B.armW * 1.7 * B.pad, ph = B.armW * 1.3 * B.pad, sx = a.sx, sy = a.sy;
  const p = _pal(R, back ? 'larm' : 'rarm', back), c = R.c;
  switch (R.D.pad) {
    case 'round':
      c.beginPath(); c.moveTo(sx - pw * 0.55, sy + ph * 0.42); c.lineTo(sx - pw * 0.6, sy - ph * 0.1);
      c.quadraticCurveTo(sx - pw * 0.52, sy - ph * 0.82, sx, sy - ph * 0.78);
      c.quadraticCurveTo(sx + pw * 0.62, sy - ph * 0.72, sx + pw * 0.62, sy);
      c.lineTo(sx + pw * 0.5, sy + ph * 0.46); c.closePath();
      c.fillStyle = p.light; c.fill(); c.stroke();
      break;
    case 'spike':
      MP(R, [sx - pw * 0.3, sy - ph * 0.55, sx - pw * 0.2, sy - ph * 1.25, sx, sy - ph * 0.62], p.metalL);
      MP(R, [sx + pw * 0.1, sy - ph * 0.65, sx + pw * 0.3, sy - ph * 1.35, sx + pw * 0.4, sy - ph * 0.6], p.metalL);
      MP(R, [sx - pw * 0.6, sy + ph * 0.35, sx - pw * 0.5, sy - ph * 0.55, sx + pw * 0.4, sy - ph * 0.75, sx + pw * 0.7, sy - ph * 0.05, sx + pw * 0.5, sy + ph * 0.45], p.light);
      break;
    case 'layered':
      MP(R, [sx - pw * 0.62, sy - ph * 0.1, sx - pw * 0.5, sy - ph * 0.7, sx + pw * 0.45, sy - ph * 0.82, sx + pw * 0.72, sy - ph * 0.2, sx + pw * 0.6, sy + ph * 0.1], p.light);
      MP(R, [sx - pw * 0.58, sy + ph * 0.5, sx - pw * 0.62, sy - ph * 0.05, sx + pw * 0.66, sy - ph * 0.1, sx + pw * 0.58, sy + ph * 0.55], p.base);
      break;
    case 'slim':
      MP(R, [sx - pw * 0.4, sy + ph * 0.25, sx - pw * 0.42, sy - ph * 0.45, sx + pw * 0.3, sy - ph * 0.58, sx + pw * 0.48, sy - ph * 0.05, sx + pw * 0.35, sy + ph * 0.3], p.light);
      break;
    default: // angular
      MP(R, [sx - pw * 0.6, sy + ph * 0.35, sx - pw * 0.5, sy - ph * 0.55, sx + pw * 0.4, sy - ph * 0.75, sx + pw * 0.7, sy - ph * 0.05, sx + pw * 0.5, sy + ph * 0.45], p.light);
  }
  if (!back && !(R.F.rarm > 0)) {
    if (R.D.pad !== 'slim') { c.fillStyle = R.C.accent; c.fillRect(sx - pw * 0.42, sy + ph * 0.08, pw * 0.82, ph * 0.14); }
    _mark(R, 'pad', sx + pw * 0.05, sy - ph * 0.28, ph * 0.22);
  }
}

// ---------- senjata ----------
function _weapon(R, w, x, y, back, wa) {
  const c = R.c;
  c.save(); c.translate(x, y); if (wa) c.rotate(wa);
  const swing = R.A.swing && R.A.swing.side === (back ? 'larm' : 'rarm') ? R.A.swing.k : -1;
  const G = back ? { b: '#2a2f36', d: '#1b1e22', l: '#3d444d', s: '#7d8690' } : { b: '#3d444d', d: '#262b31', l: '#5c6670', s: '#aab3bc' };
  const rc = R.A.recoil ? Math.abs((R.A.recoil[back ? 'larm' : 'rarm']) || 0) : 0;
  switch (w.id) {
    case 'wasp':
      MLine(R, [-5, -2, -11, -2, -11, 2.5], G.l, 1.6);
      MP(R, [-5, -4.5, 12, -4.5, 14, -1.5, 14, 3.5, -5, 3.5], G.b);
      MR(R, 14, -2, 9, 3, G.d);
      MR(R, 22, -2.6, 4, 4.2, G.b);
      MP(R, [2, 3.5, 6, 3.5, 6.5, 15, 2.5, 15], G.d);
      MR(R, 3, -7, 5, 2.5, G.l);
      break;
    case 'stinger':
      MP(R, [-8, 0, -6, -5, 13, -5, 14, 3, -6, 3], G.b);
      MR(R, 14, -3.2, 19, 5.4, G.d);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [18 + i * 5, -3.2, 18 + i * 5, 2.2], G.l, 0.8);
      MP(R, [1, 3, 6, 3, 8, 12, 3, 13], G.d);
      MR(R, 10, 3, 3, 7, G.l);
      MR(R, 2, -8.5, 6, 3.5, G.d);
      MF(R, [7, -8, 8, -8, 8, -5.5, 7, -5.5], back ? '#3a2020' : '#ff5a4d');
      break;
    case 'ravager':
      MP(R, [-8, -7, 14, -7, 16, -3, 16, 7, -8, 7], G.b);
      MR(R, 16, -5.5, 16, 4.4, G.d);
      MR(R, 16, -0.6, 16, 4.4, G.d);
      MR(R, 29, -6.8, 4, 11.6, G.b);
      MC(R, 3, 11, 6, G.d); MC(R, 3, 11, 2.4, G.l, false);
      if (R.det) for (let i = 0; i < 4; i++) MC(R, -4 + i * 4.5, -3.5, 1.2, '#c94a2a', false);
      break;
    case 'carbine':
      MP(R, [-13, -3, -6, -4, -6, 3, -13, 4], G.b);
      MR(R, -6, -4.5, 20, 8, G.b);
      MR(R, 14, -3.5, 14, 6, G.l);
      MR(R, 28, -1.3, 12, 2.6, G.d);
      MR(R, 40, -2, 3.5, 4, G.d);
      MP(R, [2, 3.5, 7, 3.5, 10, 12, 5, 13], G.d);
      MR(R, 0, -9, 10, 3.5, G.d);
      MF(R, [10, -8.5, 11, -8.5, 11, -6, 10, -6], back ? '#24343c' : '#7fe6ff');
      break;
    case 'falcon':
      MP(R, [-18, -3, -6, -5, -6, 3, -12, 3, -18, 5], G.b);
      MR(R, -6, -4, 20, 7, G.b);
      MR(R, 14, -1.4, 48, 2.8, G.d);
      MR(R, 60, -3, 7, 6, G.b);
      if (R.det) { MLine(R, [62, -3, 62, 3], '#0c0e10', 0.8); MLine(R, [64.5, -3, 64.5, 3], '#0c0e10', 0.8); }
      MR(R, -2, -12, 20, 5.5, G.d);
      MP(R, [18, -13.2, 22, -14.2, 22, -5, 18, -6.2], G.d);
      MF(R, [20, -12.8, 21.5, -13.4, 21.5, -6, 20, -6.6], back ? '#24343c' : '#7fe6ff');
      MLine(R, [3, -6.5, 3, -4], G.l, 1.2); MLine(R, [13, -6.5, 13, -4], G.l, 1.2);
      MLine(R, [42, 1.4, 36, 9], G.l, 1.1); MLine(R, [42, 1.4, 46, 9], G.l, 1.1);
      break;
    case 'thunder':
      MP(R, [-18, -10, -25, -12.5, -25, 4, -18, 1.5], G.d);
      MR(R, -18, -9, 60, 10, back ? '#3a4228' : '#5a6a3a');
      MR(R, 38, -10.5, 4, 13, G.l);
      MP(R, [42, -8.5, 49, -4, 42, 0.5], '#c94a2a');
      MR(R, 0, 1, 4, 7, G.d);
      MR(R, 10, -14, 6, 5, G.l);
      if (R.det) { R.c.fillStyle = '#ffd24a'; R.c.fillRect(-12, -9, 3, 10); R.c.fillRect(28, -9, 3, 10); }
      break;
    case 'hailstorm':
      MLine(R, [-8, -1, -15, 1, -15, 5], G.l, 1.8);
      MP(R, [-8, -5, 6, -5, 6, 4, -8, 4], G.b);
      MR(R, 6, -8.5, 14, 14, G.d);
      if (R.det) for (const [cx, cy] of [[10, -4.5], [16, -4.5], [13, 2]]) MC(R, cx, cy, 2, '#3a4a2a', false);
      MR(R, 20, -4.5, 9, 7, G.b);
      MR(R, 28, -5.5, 3, 9, G.l);
      MR(R, 10, 5.5, 3, 6, G.l);
      break;
    case 'salamander':
      MR(R, -6, -4, 16, 7, G.b);
      MC(R, 4, 8.5, 5.5, back ? '#5a2018' : '#a33a2a');
      if (R.det && !back) MF(R, [1, 5, 4, 4, 5, 6, 2, 7], 'rgba(255,255,255,0.35)');
      MR(R, 10, -2.5, 20, 4, G.d);
      MP(R, [30, -4, 35, -5.5, 35, 4.5, 30, 3], G.l);
      MLine(R, [12, 1.5, 22, 5, 30, 2], '#8a6a2a', 1.4);
      if (!back) { MC(R, 36.5, -0.5, 1.7, '#ffb43c', false); MGlow(R, 36.5, -0.5, 6, '#ff8a3a'); }
      break;
    case 'rod': { // tongkat kejut listrik
      MR(R, -13, -2.6, 7, 5.2, G.l);
      MR(R, -6, -3.6, 11, 7.2, G.d);
      if (R.det) for (let i = 0; i < 4; i++) MLine(R, [-4 + i * 2.6, -3.6, -5 + i * 2.6, 3.6], G.l, 0.8);
      MP(R, [5, -6, 9, -5, 9, 5, 5, 6], G.l);
      MR(R, 9, -2.6, 45, 5.2, G.s);
      if (R.det) MLine(R, [10, -1.4, 52, -1.4], 'rgba(255,255,255,0.45)', 0.8);
      for (let i = 0; i < 4; i++) MR(R, 16 + i * 9, -3.4, 2.4, 6.8, G.l);
      MP(R, [54, -5, 60, -4.2, 64, 0, 60, 4.2, 54, 5], G.b);
      MR(R, 55, -5.6, 2, 11.2, G.l);
      if (!back) {
        const fl = 0.6 + 0.4 * Math.sin((R.t || 0) * 23);
        MC(R, 63, 0, 2.4, `rgba(170,235,255,${fl})`, false);
        MGlow(R, 62, 0, swing > 0 ? 16 : 9, '#7fd6ff');
        if (R.det) {
          const j = Math.floor((R.t || 0) * 18) % 3;
          MLine(R, [56, -5, 59, -8 - j, 62, -5.5, 65, -7 + j], 'rgba(170,235,255,0.85)', 0.8);
          MLine(R, [56, 5, 59.5, 7.5 + j, 63, 5, 66, 6.5 - j], 'rgba(170,235,255,0.7)', 0.8);
        }
      }
      break;
    }
    case 'blade': { // pedang panas besar
      MR(R, -11, -2.2, 6, 4.4, G.l);
      MC(R, -11, 0, 2.6, G.l);
      MR(R, -5, -3.2, 10, 6.4, G.d);
      if (R.det) for (let i = 0; i < 4; i++) MLine(R, [-3.5 + i * 2.4, -3.2, -4.5 + i * 2.4, 3.2], G.l, 0.8);
      MP(R, [5, -10, 10, -8.5, 10, 8.5, 5, 10], G.l);
      if (!back && !(R.F.rarm > 0)) MF(R, [6.5, -2, 8.5, -2, 8.5, 2, 6.5, 2], R.C.accent);
      MP(R, [10, -5, 58, -4.4, 70, 1, 58, 5.2, 10, 5], back ? '#8c959c' : '#d7dee4');
      MF(R, [12, -1.3, 52, -1.1, 52, 0.5, 12, 0.7], back ? '#6c757c' : '#97a3ad');
      if (R.det) MLine(R, [12, -4, 57, -3.5, 68, 0.6], 'rgba(255,255,255,0.65)', 0.8);
      if (!back) {
        const hot = swing > 0.3 && swing < 0.8 ? 1 : 0.65 + 0.2 * Math.sin((R.t || 0) * 5);
        const gr = c.createLinearGradient(10, 0, 70, 0);
        gr.addColorStop(0, `rgba(255,90,30,${0.55 * hot})`); gr.addColorStop(0.7, `rgba(255,170,60,${hot})`); gr.addColorStop(1, `rgba(255,240,180,${hot})`);
        MF(R, [10, 2.2, 58, 2.6, 70, 1, 58, 5.2, 10, 5], gr);
        for (const gx of [24, 44, 62]) MGlow(R, gx, 3, 9 * hot, '#ff8a3a');
      }
      break;
    }
    case 'hammer': { // palu godam berpendorong roket
      MR(R, -9, -2.6, 48, 5.2, G.d);
      if (R.det) for (let i = 0; i < 4; i++) MLine(R, [-6 + i * 3, -2.6, -7 + i * 3, 2.6], G.l, 0.9);
      MR(R, 8, -3.4, 3, 6.8, G.l);
      MR(R, 34, -4.4, 6, 8.8, G.l);
      MP(R, [32, -9, 40, -12, 40, 13, 32, 10], G.d);
      const boost = swing > 0.38 && swing < 0.56;
      if (!back && boost) { MGlow(R, 30, 0.5, 20, '#ff9a3a'); MF(R, [32, -5, 22, 0.5, 32, 6], '#ffd27a'); }
      MP(R, [40, -15, 56, -15, 59, -11, 59, 13, 56, 16, 40, 16], G.b);
      MR(R, 57, -12, 5, 25, G.l);
      if (R.det) MLine(R, [42, -13, 55, -13], 'rgba(255,255,255,0.35)', 1);
      if (R.det) { c.fillStyle = back ? '#6a5a20' : '#ffd24a'; for (let i = 0; i < 3; i++) MF(R, [42 + i * 5, 15, 45 + i * 5, 15, 48 + i * 5, -14, 45 + i * 5, -14], c.fillStyle); }
      MC(R, 48, 0.5, 3.2, G.d);
      break;
    }
    case 'buckler': {
      const sc = back ? R.C.darker : R.C.dark;
      MC(R, 9, -2, 11, sc);
      MC(R, 9, -2, 7.5, back ? R.C.dark : R.C.sec, false);
      MC(R, 9, -2, 2.6, R.F.larm > 0 ? '#fff' : R.C.accent);
      break;
    }
    case 'viper':
      MP(R, [-7, -5, 16, -5, 18, -2, 18, 4, -5, 4, -7, 1], G.b);
      MR(R, -3, -7.5, 14, 2.5, G.l);
      MR(R, 18, -3.2, 12, 5, G.d);
      if (R.det) for (let i = 0; i < 3; i++) MC(R, 21 + i * 3.4, -0.7, 0.8, '#0c0e10', false);
      MR(R, 30, -1.8, 6, 2.6, G.d);
      MP(R, [3, 4, 9, 4, 10.5, 12, 4.5, 12], G.d);
      break;
    case 'hornet':
      MP(R, [-8, -6, 20, -6, 22, -2, 22, 5, -6, 5, -8, 1], G.b);
      MLine(R, [2, -6, 3, -10, 13, -10, 14, -6], G.l, 1.8);
      MC(R, 6, 9.5, 6, G.d); MC(R, 6, 9.5, 2.6, G.l, false);
      MR(R, 22, -2.5, 13, 4, G.d);
      MP(R, [34, -4.5, 41, -4, 41, 3, 34, 3.5], G.b);
      if (R.det) { MLine(R, [36, -4, 36, 3], '#0c0e10', 0.8); MLine(R, [38.5, -4, 38.5, 3], '#0c0e10', 0.8); }
      break;
    case 'tempest': {
      const spin = (R.t || 0) * (rc > 0.05 ? 40 : 2);
      const bars = [0, 1, 2].map((i) => ({ o: Math.sin(spin + i * 2.094) * 3.6, z: Math.cos(spin + i * 2.094) })).sort((a, b) => a.z - b.z);
      if (R.det) MLine(R, [-4, 6, -10, 10, -16, 6], '#8a6a2a', 2.6);
      MP(R, [-8, -7, 12, -7, 14, -4, 14, 6, -8, 6], G.b);
      MR(R, -2, -9, 10, 2.5, G.l);
      for (const bb of bars) MR(R, 14, bb.o - 1.3, 27, 2.6, bb.z > 0 ? G.s : G.d);
      MR(R, 19, -5, 3, 10, G.l); MR(R, 36, -5, 3, 10, G.l);
      break;
    }
    case 'breaker':
      MP(R, [-7, -5, 12, -5, 12, 4, -4, 4, -7, 8, -10, 7], G.b);
      MR(R, 12, -4, 19, 3.6, G.d);
      MR(R, 12, 0.3, 14, 3, G.b);
      MR(R, 15.5 + (rc > 0.05 ? -2 : 0), -0.8, 7, 5, G.l);
      break;
    case 'cyclone':
      MP(R, [-7, -6, 16, -6, 18, -3, 18, 6, -7, 6], G.b);
      MC(R, 4, 9.5, 5.5, G.d); MC(R, 4, 9.5, 2.2, G.l, false);
      MP(R, [18, -4.8, 31, -5.5, 31, 5.5, 18, 4.8], G.d);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [21 + i * 3.4, -4, 21 + i * 3.4, 4], '#0c0e10', 0.9);
      MR(R, 2, -8.5, 10, 2.5, G.l);
      break;
    case 'longbow':
      MP(R, [-15, -3, -6, -4.5, -6, 3, -15, 5], G.b);
      MR(R, -6, -4, 22, 7, G.b);
      MR(R, 16, -1.5, 35, 3, G.d);
      MP(R, [50, -2.8, 57, -2.4, 57, 2.4, 50, 2.8], G.b);
      MR(R, 0, -10.5, 16, 4.5, G.d);
      MLine(R, [3, -6, 3, -4], G.l, 1.2); MLine(R, [13, -6, 13, -4], G.l, 1.2);
      MF(R, [16, -10, 17.5, -10, 17.5, -6.5, 16, -6.5], back ? '#24343c' : '#7fe6ff');
      if (R.det) MLine(R, [30, 1.5, 22, 6], G.l, 1);
      break;
    case 'railspike': {
      MP(R, [-9, -6, 16, -7, 18, 6, -9, 6], G.b);
      MR(R, 16, -5.5, 39, 2.6, G.s);
      MR(R, 16, 2.9, 39, 2.6, G.s);
      const pulse = 0.55 + 0.45 * Math.sin((R.t || 0) * 6);
      c.fillStyle = back ? '#2a5560' : `rgba(110,230,255,${pulse})`;
      for (let i = 0; i < 5; i++) c.fillRect(19 + i * 7, -2.9, 3, 5.8);
      MR(R, -4, -9, 12, 3, G.l);
      if (R.det && !back) { c.fillStyle = '#5fd4ff'; c.fillRect(-6, -2, 2, 2); c.fillRect(-2, -2, 2, 2); }
      break;
    }
    case 'knuckle': { // sarung tinju baja besar berpendorong hidrolik
      MP(R, [-7, -8, 5, -9.5, 5, 9.5, -7, 8], G.d);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [-5 + i * 3.5, -8, -5 + i * 3.5, 8], G.l, 0.9);
      MP(R, [3, -11, 16, -12.5, 21, -8, 21, 9, 16, 12.5, 3, 11], G.l);
      MP(R, [5, 5, 15, 4, 18, 10, 6, 11.5], G.b);
      for (let i = 0; i < 4; i++) MP(R, [21, -8.5 + i * 4.4, 26, -7.8 + i * 4.4, 26, -4.6 + i * 4.4, 21, -4.4 + i * 4.4], G.s);
      for (let i = 0; i < 4; i++) MP(R, [26, -7.6 + i * 4.4, 31, -6.2 + i * 4.4, 26, -4.8 + i * 4.4], back ? '#9aa3aa' : '#eef3f6');
      MR(R, 5, -16, 12, 4, G.d);
      MR(R, 15, -15.2, 3 + (swing > 0.45 && swing < 0.62 ? 4 : 0), 2.4, G.s);
      if (!back) { MF(R, [7, -15, 13, -15, 13, -13, 7, -13], R.F.rarm > 0 ? '#fff' : '#ffb43c'); MGlow(R, 10, -14, swing > 0.45 && swing < 0.62 ? 12 : 6, '#ffb43c'); }
      if (R.det) { MLine(R, [9, -11.5, 9, 11.5], G.d, 1); MLine(R, [15, -12, 15, 12], G.d, 1); }
      break;
    }
    case 'pile': { // penembak pasak hidrolik besar
      let ext = rc > 0.05 && R.A.recoil[back ? 'larm' : 'rarm'] < 0 ? rc * 9 : 0;
      if (swing >= 0.5 && swing < 0.85) ext = 16 * (1 - Math.max(0, swing - 0.62) / 0.23);
      MR(R, -13, -6, 5, 12, G.d);
      if (R.det) for (let i = 0; i < 3; i++) MLine(R, [-12, -4 + i * 4, -9, -4 + i * 4], '#0c0e10', 0.8);
      MR(R, 26, -3.2, 12 + ext, 6.4, G.s);
      MP(R, [38 + ext, -4.6, 48 + ext, 0, 38 + ext, 4.6], back ? '#a8b0b6' : '#eef3f6');
      MP(R, [-8, -9.5, 22, -9.5, 26, -6, 26, 6, 22, 9.5, -8, 9.5], G.b);
      MR(R, 0, -10.5, 3.5, 21, G.l); MR(R, 14, -10.5, 3.5, 21, G.l);
      if (R.det) { c.fillStyle = back ? '#6a5a20' : '#ffd24a'; for (let i = 0; i < 3; i++) MF(R, [4 + i * 3.4, 9.5, 6 + i * 3.4, 9.5, 8 + i * 3.4, -9.5, 6 + i * 3.4, -9.5], c.fillStyle); }
      MC(R, 21, -11.5, 2.2, G.d);
      if (!back && ext > 4) MGlow(R, 26, 0, 14, '#ffd9a0');
      break;
    }
    case 'aegis': {
      const sc = back ? R.C.darker : R.C.dark;
      MP(R, [1, -27, 13, -23, 16, 4, 8, 23, 0, 4], sc);
      MF(R, [3, -24, 12, -21, 14, 3, 8, 19, 2, 3], back ? R.C.dark : R.C.base);
      if (!back && !(R.F.larm > 0)) MF(R, [8, -10, 11, -4, 8, 2, 5, -4], R.C.accent);
      break;
    }
    case 'bulwark': {
      const sc = back ? R.C.darker : R.C.dark;
      MP(R, [0, -33, 15, -31, 17, 23, 0, 25], sc);
      MF(R, [2, -31, 13, -29, 15, 21, 2, 23], back ? R.C.dark : R.C.sec);
      MF(R, [4, -24, 14, -23, 14, -20, 4, -21], '#0d1014');
      if (R.det) for (const yy of [-12, 0, 12]) { MC(R, 5, yy, 0.9, G.l, false); MC(R, 12, yy + 1, 0.9, G.l, false); }
      c.fillStyle = R.C.accent; c.fillRect(6, -6, 5, 3);
      break;
    }
    default:
      MP(R, [-2, -4, 6, -4.5, 7, 3.5, -2, 4], G.l);
  }
  c.restore();
}

// ---------- lengan ----------
function _arm(R, side) {
  const a = R.g[side], B = R.B, back = side === 'larm', p = _pal(R, side, back);
  if (R.P[side] <= 0) {
    MC(R, a.sx, a.sy + 2, B.armW * 0.55, '#1a1c1f');
    if (R.det) { MLine(R, [a.sx, a.sy + 2, a.sx + 5, a.sy + 9], '#ffb43c', 0.8); MLine(R, [a.sx, a.sy + 3, a.sx - 2, a.sy + 10], '#5fd4ff', 0.8); }
    return;
  }
  const w = WEAPONS[side === 'rarm' ? R.u.r : R.u.l] || WEAPONS.none;
  const aw = B.armW, fw = B.armW;
  // lengan atas: arah u (bahu->siku), normal m
  let ux = a.ex - a.sx, uy = a.ey - a.sy, ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const mx = -uy, my = ux;
  // lengan bawah: arah d (siku->tangan), normal n
  let dx = a.hx - a.ex, dy = a.hy - a.ey, dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  const nx = -dy, ny = dx;
  const P = (x, y, along, side_) => [x + dx * along + nx * side_, y + dy * along + ny * side_];
  ML(R, a.sx, a.sy, aw * 0.85, a.ex, a.ey, aw * 0.75, p.metal);
  MP(R, [a.sx + ux * 2 + mx * aw * 0.55, a.sy + uy * 2 + my * aw * 0.55, a.sx + ux * 2 - mx * aw * 0.55, a.sy + uy * 2 - my * aw * 0.55,
    a.ex - ux * 3 - mx * aw * 0.5, a.ey - uy * 3 - my * aw * 0.5, a.ex - ux * 3 + mx * aw * 0.5, a.ey - uy * 3 + my * aw * 0.5], p.base);
  MP(R, [...P(a.ex, a.ey, -2, -fw * 0.6), ...P(a.hx, a.hy, -2, -fw * 0.62), ...P(a.hx, a.hy, 0, fw * 0.55), ...P(a.ex, a.ey, -1, fw * 0.55)], p.sec);
  MF(R, [...P(a.ex, a.ey, 0, -fw * 0.55), ...P(a.hx, a.hy, -3, -fw * 0.58), ...P(a.hx, a.hy, -3, -fw * 0.28), ...P(a.ex, a.ey, 0, -fw * 0.25)], p.light);
  MC(R, a.ex, a.ey, fw * 0.42, p.metal);
  _weapon(R, w, a.hx, a.hy, back, a.wa);
  _pad(R, a, back);
}

// ---------- jejak ayunan & garis kecepatan ----------
function _swingFX(R) {
  const sw = R.A.swing;
  if (!sw || R.away) return;
  const side = sw.side, id = side === 'rarm' ? R.u.r : R.u.l, kind = MELEE_KIND[id];
  if (!kind || R.P[side] <= 0) return;
  const a = R.g[side], c = R.c, len = MELEE_LEN[id] || 40;
  const col = { blade: '255,150,70', rod: '140,220,255', hammer: '255,236,200', knuckle: '255,220,160', pile: '220,235,255' }[id];
  c.save(); c.globalCompositeOperation = 'lighter';
  if (kind === 'thrust') {
    if (sw.k > 0.42 && sw.k < 0.66) {
      const al = 1 - Math.abs(sw.k - 0.52) / 0.14;
      for (let i = 0; i < 4; i++) {
        const yy = a.hy - 8 + i * 5.3, x0 = a.hx - 6 - i % 2 * 6;
        MLine(R, [x0, yy, x0 - 26 - (i % 2) * 10, yy], `rgba(${col},${(0.55 * al).toFixed(3)})`, 1.6);
      }
    }
  } else if (sw.k > 0.42 && sw.k < 0.8) {
    const sx = a.sx, sy = a.sy, k1 = sw.k, k0 = Math.max(0.4, k1 - 0.13), N = 10;
    const out = [], inn = [];
    for (let i = 0; i <= N; i++) {
      const p = swingIK(R.B, id, sx, sy, U.lerp(k0, k1, i / N)), co = Math.cos(p.wa), si = Math.sin(p.wa);
      out.push(p.hx + co * len, p.hy + si * len);
      inn.push(p.hx + co * len * 0.6, p.hy + si * len * 0.6);
    }
    const fade = sw.k < 0.55 ? 1 : Math.max(0, 1 - (sw.k - 0.55) / 0.25);
    for (let i = 0; i < N; i++) {
      c.fillStyle = `rgba(${col},${(((i + 1) / N) ** 1.5 * 0.45 * fade).toFixed(3)})`;
      c.beginPath();
      c.moveTo(out[i * 2], out[i * 2 + 1]); c.lineTo(out[i * 2 + 2], out[i * 2 + 3]);
      c.lineTo(inn[i * 2 + 2], inn[i * 2 + 3]); c.lineTo(inn[i * 2], inn[i * 2 + 1]);
      c.closePath(); c.fill();
    }
    c.strokeStyle = `rgba(255,255,255,${(0.7 * fade).toFixed(3)})`; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(out[0], out[1]); for (let i = 1; i <= N; i++) c.lineTo(out[i * 2], out[i * 2 + 1]); c.stroke();
  }
  c.restore();
  c.strokeStyle = R.ink;
}

// ---------- utama ----------
function drawMech(c, u, x, y, s, face, A = {}) {
  const g = mechGeom(u, A), B = g.B, S = s * B.scale;
  const R = {
    c, u, g, B, A, face, C: u.colors, D: u.design || DEFAULT_DESIGN, P: A.parts || u.parts, F: A.flash || {},
    det: S >= 0.75, away: !!A.away, t: A.t || 0, ink: '#0a0d11',
  };
  const walk = A.walk || 0;
  c.save();
  c.translate(x, y);
  c.scale(S * face, S);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.lineWidth = (S < 1 ? 1.1 : 2) / S;
  c.strokeStyle = R.ink;
  const swS = A.swing && MELEE_KIND[A.swing.side === 'rarm' ? u.r : u.l] ? A.swing.side : null;
  if (swS !== 'larm') _arm(R, 'larm');
  _leg(R, -B.tw * 0.16, g.hipY, -walk, true);
  _back(R);
  _launcher(R);
  _pelvis(R);
  _leg(R, B.tw * 0.14, g.hipY, walk, false);
  _skirt(R);
  _torso(R);
  // lengan yang sedang mengayun digambar di depan agar gerakannya jelas
  if (swS) { _head(R); _arm(R, 'rarm'); if (swS === 'larm') _arm(R, 'larm'); } else { _arm(R, 'rarm'); _head(R); }
  _swingFX(R);
  c.restore();
}
