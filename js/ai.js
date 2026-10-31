'use strict';
// ================= KECERDASAN BUATAN MUSUH =================
const AI = {
  plan(B, u) {
    const foes = B.units.filter((o) => !o.dead && o.team !== u.team);
    if (!foes.length) return {};
    if (u.repairs > 0 && u.ap >= 3 && u.parts.body < u.max.body * 0.4) return { repair: u };
    const R = reachable(B, u);
    const tiles = [...R.cost.keys()];
    const weps = Combat.weaponsOf(u).filter((ws) => Combat.canUse(u, ws));
    let best = null;
    for (const k of tiles) {
      const x = U.kx(k), y = U.ky(k);
      const terr = TERRAIN[B.map.T[y][x].t].eva || 0;
      for (const ws of weps) for (const f of foes) {
        const d = Math.abs(x - f.x) + Math.abs(y - f.y);
        if (d < ws.w.rmin || d > ws.w.rmax) continue;
        const exp = Combat.expDamage(B, u, f, ws.w, x, y);
        let sc = exp;
        if (exp >= f.parts.body * 0.8) sc += 60;
        sc += (1 - f.parts.body / f.max.body) * 30;
        sc -= this.counterAt(B, f, x, y) * 0.45;
        sc += terr * 0.6;
        sc -= R.cost.get(k) * 0.5;
        if (ws.slot === 'sh') sc -= 6;
        if (!best || sc > best.sc) best = { sc, k, ws, f };
      }
    }
    if (best) return { moveKey: best.k, attack: { target: best.f, ws: best.ws } };
    const df = distField(B.map, foes, jumpOf(u));
    const pref = this.prefRange(u);
    let bk = null, bs = Infinity;
    for (const k of tiles) {
      const dv = df.get(k);
      if (dv === undefined) continue;
      const terr = TERRAIN[B.map.T[U.ky(k)][U.kx(k)].t].eva || 0;
      const s = Math.abs(dv - pref) * 10 - terr * 0.3 + R.cost.get(k) * 0.1;
      if (s < bs) { bs = s; bk = k; }
    }
    return { moveKey: bk, guard: true };
  },
  prefRange(u) {
    let r = 1;
    for (const ws of Combat.weaponsOf(u)) if (['RF', 'SR', 'BZ', 'GL'].includes(ws.w.type) || (ws.w.type === 'MSL' && u.ammo > 0)) r = Math.max(r, ws.w.rmin + 1);
    return r;
  },
  counterAt(B, f, x, y) {
    let best = 0;
    for (const ws of Combat.weaponsOf(f)) {
      if (ws.slot === 'sh' || !Combat.canUse(f, ws)) continue;
      const d = Math.abs(x - f.x) + Math.abs(y - f.y);
      if (d < ws.w.rmin || d > ws.w.rmax) continue;
      best = Math.max(best, ws.w.dmg * ws.w.hits * 0.6);
    }
    return best;
  },
};
