'use strict';
// ================= RESOLUSI PERTEMPURAN =================
const Combat = {
  skillChance(u) { const s = SKILLS[u.pilot.skill]; return s ? s.chance + (u.pilot.lvl - 1) * 2 : 0; },
  weaponsOf(u) {
    const out = [];
    if (u.dead) return out;
    for (const side of ['rarm', 'larm']) {
      const w = u.W[side];
      if (u.parts[side] > 0 && w.type !== 'NONE' && w.type !== 'SHIELD') out.push({ slot: side, w });
    }
    if (u.sh !== 'none') out.push({ slot: 'sh', w: u.W.sh });
    return out;
  },
  canUse(u, ws) { return u.ap >= ws.w.ap && (ws.slot !== 'sh' || u.ammo > 0); },
  inRange(ws, a, b, ax = a.x, ay = a.y) {
    const d = Math.abs(ax - b.x) + Math.abs(ay - b.y);
    return d >= ws.w.rmin && d <= ws.w.rmax;
  },
  hitChance(B, a, d, w, ax = a.x, ay = a.y) {
    const tA = B.map.T[ay][ax], tD = B.map.T[d.y][d.x];
    const dist = Math.abs(ax - d.x) + Math.abs(ay - d.y);
    let c = w.acc + a.pilot.acc + ((BACKPACKS[a.bp] && BACKPACKS[a.bp].acc) || 0) - (d.frame.eva + d.pilot.eva + (TERRAIN[tD.t].eva || 0) + (d.guarding ? 15 : 0));
    c += this.grip(a, w);
    if (d.parts.legs <= 0) c += 20;
    if (w.type === 'MG') c -= (dist - 1) * 4;
    if (w.type === 'SG' || w.type === 'FL') c -= (dist - 1) * 10;
    if (w.type === 'SMG') c -= (dist - 1) * 6;
    c += U.clamp(tA.h - tD.h, -3, 3) * 4;
    return U.clamp(Math.round(c), 8, 98);
  },
  // pegangan dua tangan untuk Sniper / Bazoka / Granat
  grip(a, w) {
    const side = a.W.rarm === w ? 'rarm' : a.W.larm === w ? 'larm' : null;
    if (!side) return 0;
    const o = side === 'rarm' ? 'larm' : 'rarm';
    return gripMod(w.id, o === 'rarm' ? a.r : a.l, a.parts[o] > 0);
  },
  expDamage(B, a, d, w, ax, ay) { return (this.hitChance(B, a, d, w, ax, ay) / 100) * w.dmg * w.hits * (w.blast ? 3 : 1); },
  shieldOf(d) {
    for (const side of ['larm', 'rarm']) {
      const w = d.W[side];
      if (w.type === 'SHIELD' && d.parts[side] > 0) return w;
    }
    return null;
  },
  pickPart(d) {
    const opts = [['body', 34]];
    if (d.parts.larm > 0) opts.push(['larm', 20]);
    if (d.parts.rarm > 0) opts.push(['rarm', 20]);
    if (d.parts.legs > 0) opts.push(['legs', 26]);
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const o of opts) { r -= o[1]; if (r < 0) return o[0]; }
    return 'body';
  },
  attack(B, a, d, ws, label) {
    const w = ws.w;
    const ev = { att: a, def: d, slot: ws.slot, w, label, skills: [], volleys: [], attHp0: { ...a.parts }, defHp0: { ...d.parts }, killed: false };
    ev.chance = this.hitChance(B, a, d, w);
    a.ap -= w.ap;
    if (ws.slot === 'sh') a.ammo--;
    let volleys = 1, focus = null, mult = 1;
    const sc = this.skillChance(a);
    if (a.pilot.skill === 'DOUBLE' && w.type !== 'MELEE' && U.roll(sc)) { volleys = 2; ev.skills.push('DOUBLE'); }
    if (a.pilot.skill === 'ZOOM' && w.type !== 'MELEE' && !w.blast && U.roll(sc)) { focus = 'body'; ev.skills.push('ZOOM'); }
    if (a.pilot.skill === 'DUEL' && w.type === 'MELEE' && U.roll(sc + 10)) { focus = 'body'; mult = 1.6; ev.skills.push('DUEL'); }
    const guard = d.pilot.skill === 'GUARD' && U.roll(this.skillChance(d));
    if (guard) ev.defSkill = 'GUARD';
    const shield = this.shieldOf(d);
    let landed = 0, broke = 0;
    for (let v = 0; v < volleys && !ev.killed; v++) {
      const hits = [];
      for (let i = 0; i < w.hits && !ev.killed; i++) {
        if (!U.roll(ev.chance)) { hits.push({ part: null }); continue; }
        if (w.blast) {
          // LEDAKAN: semua bagian yang masih utuh terkena
          const dmgs = {}, broken = [];
          let total = 0;
          for (const pt of PARTS) {
            if (pt !== 'body' && d.parts[pt] <= 0) continue;
            let dmg = w.dmg * mult * U.rf(0.9, 1.1) * (pt === 'body' ? 1 : 0.85);
            if (guard) dmg *= 0.5;
            dmg = Math.max(1, Math.round(dmg));
            const before = d.parts[pt];
            d.parts[pt] = Math.max(0, before - dmg);
            dmgs[pt] = dmg; total += dmg;
            if (before > 0 && d.parts[pt] === 0) { broken.push(pt); broke++; }
          }
          landed++;
          const h = { part: 'blast', dmg: total, dmgs, broken, hp: { ...d.parts } };
          if (broken.includes('body')) { ev.killed = true; h.killed = true; d.dead = true; }
          hits.push(h);
          continue;
        }
        let part = focus || this.pickPart(d);
        if (part !== 'body' && d.parts[part] <= 0) part = 'body';
        let dmg = w.dmg * mult * U.rf(0.9, 1.1);
        let blocked = false;
        if (guard) dmg *= 0.5;
        if (shield && part !== 'legs' && w.type !== 'FL' && U.roll(shield.chance)) { dmg *= 1 - shield.block; blocked = true; }
        dmg = Math.max(1, Math.round(dmg));
        const before = d.parts[part];
        d.parts[part] = Math.max(0, before - dmg);
        const h = { part, dmg, blocked, hp: { ...d.parts } };
        landed++;
        if (before > 0 && d.parts[part] === 0) {
          h.broke = true; broke++;
          if (part === 'body') { ev.killed = true; h.killed = true; d.dead = true; }
        }
        hits.push(h);
      }
      ev.volleys.push(hits);
    }
    a.xp += landed + broke * 4 + (ev.killed ? 30 : 0);
    return ev;
  },
  counterWeapon(B, d, a) {
    let best = null, bs = 0;
    for (const ws of this.weaponsOf(d)) {
      if (ws.slot === 'sh' || !this.canUse(d, ws) || !this.inRange(ws, d, a)) continue;
      const s = this.expDamage(B, d, a, ws.w);
      if (s > bs) { bs = s; best = ws; }
    }
    return best;
  },
  linkers(B, a, d, max = 2) {
    const out = [];
    const allies = B.units.filter((u) => !u.dead && u.team === a.team && u !== a).sort((p, q) => U.dist(p, d) - U.dist(q, d));
    for (const u of allies) {
      if (out.length >= max) break;
      let best = null, bs = 0;
      for (const ws of this.weaponsOf(u)) {
        if (!this.canUse(u, ws) || !this.inRange(ws, u, d)) continue;
        const s = this.expDamage(B, u, d, ws.w);
        if (s > bs) { bs = s; best = ws; }
      }
      if (best) out.push({ u, ws: best });
    }
    return out;
  },
  // Urutan: serangan utama -> balasan musuh -> serangan link rekan
  engage(B, a, d, ws, useLinks = true) {
    const linkers = useLinks ? this.linkers(B, a, d) : [];
    const events = [this.attack(B, a, d, ws, null)];
    if (!d.dead && !a.dead) {
      const cw = this.counterWeapon(B, d, a);
      if (cw) events.push(this.attack(B, d, a, cw, 'COUNTER'));
    }
    for (const L of linkers) {
      if (d.dead) break;
      if (L.u.dead || !this.canUse(L.u, L.ws)) continue;
      events.push(this.attack(B, L.u, d, L.ws, 'LINK'));
    }
    return events;
  },
  repair(u, target) {
    const bp = BACKPACKS[u.bp];
    u.repairs--; u.ap -= 3;
    const healed = {};
    for (const p of PARTS) {
      if (target.parts[p] <= 0) { healed[p] = 0; continue; }
      const amt = p === 'body' ? bp.heal : Math.round(bp.heal * 0.6);
      const nv = Math.min(target.max[p], target.parts[p] + amt);
      healed[p] = nv - target.parts[p];
      target.parts[p] = nv;
    }
    return healed;
  },
};
