'use strict';
// ================= PETA, PATHFINDING, UNIT =================
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// ---------- proyeksi isometrik yang bisa diputar ----------
const VIEW = { ang: 0, cx: 0, cy: 0, ex: { x: 32, y: 16 }, ey: { x: -32, y: 16 }, inv: null };
function setView(ang, cx, cy) {
  VIEW.ang = ang;
  if (cx !== undefined) { VIEW.cx = cx; VIEW.cy = cy; }
  const co = Math.cos(ang), si = Math.sin(ang);
  VIEW.ex = { x: (co - si) * 32, y: (co + si) * 16 };
  VIEW.ey = { x: (-si - co) * 32, y: (co - si) * 16 };
  const ex = VIEW.ex, ey = VIEW.ey, det = ex.x * ey.y - ey.x * ex.y;
  VIEW.inv = { a: ey.y / det, b: -ey.x / det, c: -ex.y / det, d: ex.x / det };
}
setView(0, 0, 0);
function isoP(x, y, h) {
  const dx = x - VIEW.cx, dy = y - VIEW.cy;
  return { x: dx * VIEW.ex.x + dy * VIEW.ey.x, y: dx * VIEW.ex.y + dy * VIEW.ey.y - h * 16 };
}
function depthOf(x, y) { return (x - VIEW.cx) * VIEW.ex.y + (y - VIEW.cy) * VIEW.ey.y; }
function screenToMapDelta(wx, wy) { const I = VIEW.inv; return { x: I.a * wx + I.b * wy, y: I.c * wx + I.d * wy }; }
function lookAt(u, b) { const dx = b.x - u.x, dy = b.y - u.y; if (dx || dy) { u.lx = dx; u.ly = dy; } }
function screenFace(u) { return u.lx * VIEW.ex.x + u.ly * VIEW.ey.x >= 0 ? 1 : -1; }
function facingAway(u) { return u.lx * VIEW.ex.y + u.ly * VIEW.ey.y < -0.01; }
function tileTop(t) { return t.t === 'water' ? -0.35 : t.h; }

function makeNoise(W, H, R) {
  return (cell) => {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = [];
    for (let i = 0; i < gw * gh; i++) g.push(R());
    const out = [];
    let mn = 1, mx = 0;
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
        const v = U.lerp(U.lerp(a, b, tx), U.lerp(c, d, tx), ty);
        row.push(v);
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      out.push(row);
    }
    const span = mx - mn || 1;
    for (const row of out) for (let i = 0; i < row.length; i++) row[i] = (row[i] - mn) / span;
    return out;
  };
}

function flood(T, W, H, sx, sy, jump) {
  const seen = new Set([U.key(sx, sy)]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    const h = T[y][x].h;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = T[ny][nx], k = U.key(nx, ny);
      if (seen.has(k) || TERRAIN[t.t].block || Math.abs(t.h - h) > jump) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

function pickSpread(cands, n, minD) {
  const out = [];
  for (const c of cands) { if (out.length >= n) break; if (out.every((o) => U.dist(o, c) >= minD)) out.push(c); }
  for (const c of cands) { if (out.length >= n) break; if (!out.includes(c)) out.push(c); }
  return out;
}

function genMap(mis) {
  const gp = GEN[mis.theme], th = THEMES[mis.theme], W = mis.w, H = mis.h;
  const pZone = (x, y) => x + y >= W + H - 7;
  const eCore = (x, y) => x + y <= 2;
  let best = null;
  for (let att = 0; att < 60; att++) {
    const R = U.seeded(mis.seed * 31 + att * 7919);
    const nz = makeNoise(W, H, R);
    const hn = nz(4.2), an = nz(2.6), dn = nz(3.1);
    const T = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        let h = Math.min(gp.hmax, Math.floor(hn[y][x] * (gp.hmax + 1)));
        let t = gp.base;
        if (an[y][x] > 0.66) t = gp.alt;
        if (dn[y][x] > gp.decoT) t = gp.deco;
        else if (R() < gp.rockP) t = gp.rock;
        if (gp.water && hn[y][x] < gp.water) { t = 'water'; h = 0; }
        row.push({ x, y, h, t, v: R() });
      }
      T.push(row);
    }
    if (gp.roads) {
      const ry = Math.floor(H * 0.42 + R() * 3), rx = Math.floor(W * 0.42 + R() * 3);
      for (let i = 0; i < W; i++) { T[ry][i].t = 'road'; T[ry][i].h = 0; }
      for (let j = 0; j < H; j++) { T[j][rx].t = 'road'; T[j][rx].h = 0; }
    }
    let placed = 0;
    for (let i = 0; i < gp.bld[0] * 6 && placed < gp.bld[0]; i++) {
      const bw = R() < 0.5 ? 2 : 1, bh = R() < 0.45 ? 2 : 1;
      const bx = Math.floor(R() * (W - bw + 1)), by = Math.floor(R() * (H - bh + 1));
      let ok = true, gh = 0;
      for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) {
        const t = T[yy][xx];
        if (pZone(xx, yy) || eCore(xx, yy) || t.t === 'road' || t.t === 'water' || t.t === 'building') ok = false;
        gh = Math.max(gh, t.h);
      }
      if (!ok) continue;
      const hh = gh + 2 + Math.floor(R() * gp.bld[1]);
      placed++;
      for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) { const t = T[yy][xx]; t.t = 'building'; t.h = hh; t.bid = placed; }
    }
    for (const row of T) for (const t of row) {
      if (pZone(t.x, t.y)) {
        if (t.t === 'water' || t.t === 'building' || TERRAIN[t.t].cost > 1) t.t = gp.base;
        t.h = Math.min(t.h, 1);
      }
    }
    const reach = flood(T, W, H, W - 1, H - 1, 1);
    let passable = 0;
    for (const row of T) for (const t of row) if (!TERRAIN[t.t].block && t.t !== 'building') passable++;
    const mid = Math.floor((W + H - 2) * 0.5) - 1;
    const pC = [], eC = [];
    for (const row of T) for (const t of row) {
      if (!reach.has(U.key(t.x, t.y)) || t.t === 'building' || TERRAIN[t.t].block) continue;
      if (pZone(t.x, t.y)) pC.push(t); else if (t.x + t.y <= mid) eC.push(t);
    }
    const score = reach.size / passable;
    const cand = { T, reach, pC, eC, score };
    if (!best || score > best.score) best = cand;
    if (score > 0.85 && eC.length >= 16 && pC.length >= 8) { best = cand; break; }
  }
  const { T, pC, eC } = best;
  const R = U.seeded(mis.seed + 99);
  pC.forEach((t) => { t._s = t.x + t.y + R() * 3; });
  pC.sort((a, b) => b._s - a._s);
  U.shuffle(eC, R);
  const pSp = pickSpread(pC, 5, 2);
  let eSp = pickSpread(eC, mis.enemies.length, 2);
  if (mis.boss) { eSp.sort((a, b) => a.x + a.y - (b.x + b.y)); }

  for (const row of T) for (const t of row) {
    const base = th.tile[t.t] || th.tile[gp.base];
    const j = (t.v - 0.5) * 0.07 + (t.t === 'building' ? 0 : t.h * 0.035);
    t.top = U.shade(base, j);
    t.edge = U.shade(base, 0.28);
    const sb = t.t === 'building' ? base : t.t === 'water' ? th.tile.water : th.side;
    t.cl = U.shade(sb, -0.14 + j * 0.4);
    t.cr = U.shade(sb, -0.4 + j * 0.4);
  }
  let hmax = 0;
  for (const row of T) for (const t of row) hmax = Math.max(hmax, t.h);
  return { W, H, T, theme: mis.theme, th, gp, pSp, eSp, hmax };
}

// ---------- unit ----------
let UID = 1;
function teamColors(base, accent, visor, sec) {
  sec = sec || U.mix(base, '#3a3f46', 0.5);
  return {
    base, light: U.shade(base, 0.3), dark: U.shade(base, -0.3), darker: U.shade(base, -0.55), accent, visor,
    sec, secD: U.shade(sec, -0.32), metal: '#3e444c', metalL: '#59626c', metalD: '#2a2e34',
  };
}
function makeUnit(spec) {
  // spec.lv = level upgrade barang terpasang per slot { frame, r, l, sh }
  const L = spec.load, lv = spec.lv || {}, f = upFrame(L.frame, lv.frame || 0), m = spec.hpMul || 1;
  const max = { body: Math.round(f.body * m), larm: Math.round(f.arm * m), rarm: Math.round(f.arm * m), legs: Math.round(f.legs * m) };
  const bp = BACKPACKS[L.bp || 'none'], sh = L.sh || 'none';
  return {
    id: UID++, team: spec.team, pilot: spec.pilot, frame: f, frameId: L.frame, style: f.style,
    r: L.r, l: L.l, sh, bp: L.bp || 'none',
    W: { rarm: upWeapon(L.r, lv.r || 0), larm: upWeapon(L.l, lv.l || 0), sh: upWeapon(sh, lv.sh || 0) },
    max, parts: { ...max }, ap: 6, apMax: 12,
    ammo: L.sh && L.sh !== 'none' ? WEAPONS[L.sh].ammo + (bp.ammo || 0) : 0,
    repairs: bp.uses || 0, colors: spec.colors, design: spec.design || DEFAULT_DESIGN, name: spec.name, ai: spec.ai || 'aggro', boss: !!spec.boss,
    x: 0, y: 0, rx: 0, ry: 0, rh: 0, mv: null, lx: 1, ly: 0, hop: 0, walk: 0, recoil: {}, flash: {}, swing: null,
    moved: false, acted: false, dead: false, guarding: false, dying: 0, deathShown: false, xp: 0,
  };
}
function moveOf(u) { return u.parts.legs <= 0 ? 1 : u.frame.move + (BACKPACKS[u.bp].move || 0); }
function jumpOf(u) { return u.frame.jump + (BACKPACKS[u.bp].jump || 0); }
function weightOf(L) { return WEAPONS[L.r].wt + WEAPONS[L.l].wt + WEAPONS[L.sh].wt + BACKPACKS[L.bp].wt; }

// ---------- pathfinding ----------
function reachable(B, u) {
  const T = B.map.T, W = B.map.W, H = B.map.H, mv = moveOf(u), jump = jumpOf(u);
  const cost = new Map(), prev = new Map();
  cost.set(U.key(u.x, u.y), 0);
  const open = [[u.x, u.y, 0]];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][2] < open[bi][2]) bi = i;
    const [x, y, c] = open.splice(bi, 1)[0];
    if (c > cost.get(U.key(x, y))) continue;
    const h = T[y][x].h;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = T[ny][nx];
      if (TERRAIN[t.t].block || Math.abs(t.h - h) > jump) continue;
      const o = B.unitAt(nx, ny);
      if (o && o.team !== u.team) continue;
      const nc = c + TERRAIN[t.t].cost;
      if (nc > mv) continue;
      const k = U.key(nx, ny);
      if (!cost.has(k) || nc < cost.get(k)) { cost.set(k, nc); prev.set(k, U.key(x, y)); open.push([nx, ny, nc]); }
    }
  }
  for (const k of [...cost.keys()]) { const o = B.unitAt(U.kx(k), U.ky(k)); if (o && o !== u) cost.delete(k); }
  return { cost, prev };
}
function buildPath(prev, from, to) {
  const p = [to];
  let k = to, guard = 0;
  while (k !== from && guard++ < 200) { k = prev.get(k); if (k === undefined) return [from, to]; p.push(k); }
  return p.reverse();
}
function distField(map, srcs, jump) {
  const T = map.T, d = new Map(), open = [];
  for (const s of srcs) { d.set(U.key(s.x, s.y), 0); open.push([s.x, s.y, 0]); }
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][2] < open[bi][2]) bi = i;
    const [x, y, c] = open.splice(bi, 1)[0];
    if (c > d.get(U.key(x, y))) continue;
    const h = T[y][x].h;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.W || ny >= map.H) continue;
      const t = T[ny][nx];
      if (TERRAIN[t.t].block || Math.abs(t.h - h) > jump) continue;
      const nc = c + TERRAIN[t.t].cost, k = U.key(nx, ny);
      if (!d.has(k) || nc < d.get(k)) { d.set(k, nc); open.push([nx, ny, nc]); }
    }
  }
  return d;
}

function pilotLook(id) {
  const pd = PILOTS.find((q) => q.id === id);
  return { colors: teamColors(pd.color, pd.accent, pd.visor, pd.sec), design: pd.design };
}
function enemyLook(T) {
  return { colors: teamColors(T.color, T.accent || '#d8d2c4', T.visor || '#ff4a3a', T.sec), design: T.design };
}
