'use strict';
// ================= KONTROLER PERTEMPURAN =================
class Battle {
  constructor(mi, auto = false) {
    this.mi = mi; this.mis = MISSIONS[mi]; this.auto = auto;
    this.map = genMap(this.mis);
    this.units = []; this.turn = 1; this.phase = 'P'; this.mode = 'idle';
    this.sel = null; this.hl = new Map(); this.hoverU = null; this.busy = true; this.over = false;
    this.linkOn = true; this.kills = 0; this.lost = 0; this.targets = []; this.repairTargets = [];
    const pilots = Game.save.pilots.filter((p) => p.join <= mi).slice(0, 5);
    pilots.forEach((p, i) => {
      const sp = this.map.pSp[i]; if (!sp) return;
      const u = makeUnit({ team: 'P', pilot: p, load: Game.save.load[p.id], lv: Game.save.lv[p.id], ...pilotLook(p.id), name: p.call });
      this.place(u, sp.x, sp.y);
      this.faceCenter(u);
      this.units.push(u);
    });
    const names = U.shuffle(ENEMY_NAMES.slice());
    this.mis.enemies.forEach((tid, i) => {
      const sp = this.map.eSp[i]; if (!sp) return;
      const T = ENEMY_T[tid], lvl = this.mis.lvl + (T.boss ? 2 : 0);
      const pilot = { name: T.pilot || names[i % names.length], skill: T.skill || U.pick([null, 'GUARD', 'DOUBLE', 'ZOOM', null]), lvl, acc: 2 + lvl * 2, eva: lvl * 1.2 };
      const u = makeUnit({ team: 'E', pilot, load: T, ...enemyLook(T), name: T.boss ? 'TYRANT' : `${T.name.toUpperCase()}-${i + 1}`, ai: T.ai, boss: T.boss, hpMul: 1 + (lvl - 1) * 0.04 });
      this.place(u, sp.x, sp.y);
      this.faceCenter(u);
      this.units.push(u);
    });
  }
  place(u, x, y) { u.x = u.rx = x; u.y = u.ry = y; u.rh = this.map.T[y][x].h; u.mv = null; }
  faceCenter(u) {
    const dx = (this.map.W - 1) / 2 - u.x, dy = (this.map.H - 1) / 2 - u.y;
    if (Math.abs(dx) >= Math.abs(dy)) { u.lx = Math.sign(dx) || 1; u.ly = 0; } else { u.lx = 0; u.ly = Math.sign(dy); }
  }
  unitAt(x, y) { return this.units.find((u) => !u.dead && u.x === x && u.y === y); }
  alive(team) { return this.units.filter((u) => !u.dead && u.team === team); }
  targetsFor(u, ws) { return this.units.filter((o) => !o.dead && o.team !== u.team && Combat.inRange(ws, u, o)); }
  clearHL() { this.hl.clear(); }

  async start() {
    Game.iso.setMap(this.map);
    if (!this.auto && Game.iso.W < 600) {
      // HP tegak: peta utuh terlalu kecil -> perbesar & arahkan ke pasukan sendiri
      const ps = this.alive('P'), cam = Game.iso.cam;
      cam.z = cam.tz = Math.max(cam.tz, 1.05);
      Game.iso.focus(ps.reduce((a, u) => a + u.x, 0) / ps.length, ps.reduce((a, u) => a + u.y, 0) / ps.length);
      cam.mx = cam.tmx; cam.my = cam.tmy;
    }
    if (!this.auto) HUD.show(this);
    await this.beginPhase('P');
    if (this.auto) return this.autoLoop();
    this.busy = false; this.refresh();
  }
  async autoLoop() {
    while (!this.over && this.turn <= 40) {
      await this.runAI('P');
      if (this.over) break;
      await this.enemyPhase();
    }
    if (!this.over) this.finish(false);
    return this.result;
  }
  async beginPhase(team) {
    this.phase = team; this.mode = 'idle'; this.sel = null; this.clearHL();
    for (const u of this.units) if (!u.dead && u.team === team) { u.ap = Math.min(u.apMax, u.ap + 6); u.moved = false; u.acted = false; u.guarding = false; }
    if (!this.auto) {
      HUD.turn(this); HUD.showUnit(null); HUD.showUnit(null, this, 'targetPanel'); HUD.hideActions(); HUD.hidePreview(); HUD.hint(''); HUD.cancelBtn(false);
    }
    const f = this.alive(team)[0];
    if (f) Game.iso.focus(f.x, f.y, f.rh);
    await HUD.banner(team === 'P' ? 'FASE PEMAIN' : 'FASE MUSUH', `GILIRAN ${this.turn}`, team);
  }
  async enemyPhase() {
    await this.beginPhase('E');
    await this.runAI('E');
    if (this.over) return;
    this.turn++;
    await this.beginPhase('P');
  }
  async endPlayerTurn() {
    if (this.busy || this.phase !== 'P' || this.over) return;
    SFX.play('confirm');
    this.busy = true; this.deselect(); HUD.turn(this);
    await this.enemyPhase();
    if (!this.over) { this.busy = false; this.refresh(); }
  }
  nearestFoe(u) { let m = 99; for (const f of this.units) if (!f.dead && f.team !== u.team) m = Math.min(m, U.dist(u, f)); return m; }
  async runAI(team) {
    const list = this.alive(team).sort((a, b) => this.nearestFoe(a) - this.nearestFoe(b));
    for (const u of list) {
      if (this.over) return;
      if (u.dead) continue;
      await this.aiAct(u);
    }
  }
  async aiAct(u) {
    const plan = AI.plan(this, u);
    Game.iso.focus(u.x, u.y, u.rh);
    this.sel = u;
    if (!this.auto) HUD.showUnit(u, this, u.team === 'P' ? 'unitPanel' : 'targetPanel');
    await sleep(300);
    if (this.over) return;
    if (plan.moveKey != null && plan.moveKey !== U.key(u.x, u.y)) {
      const R = reachable(this, u);
      if (R.cost.has(plan.moveKey)) await this.animMove(u, buildPath(R.prev, U.key(u.x, u.y), plan.moveKey));
    }
    if (plan.repair) await this.doRepair(u, plan.repair);
    else if (plan.attack && !plan.attack.target.dead) {
      const { target, ws } = plan.attack;
      if (Combat.inRange(ws, u, target) && Combat.canUse(u, ws)) {
        if (!this.auto) HUD.showUnit(target, this, target.team === 'P' ? 'unitPanel' : 'targetPanel');
        await sleep(250);
        await this.engage(u, target, ws, true);
      }
    } else if (plan.guard) u.guarding = true;
    u.acted = true; u.moved = true;
    this.sel = null;
    if (!this.auto) { HUD.showUnit(null); HUD.showUnit(null, this, 'targetPanel'); }
    this.checkEnd();
    await sleep(150);
  }

  async animMove(u, path) {
    const T = this.map.T;
    for (let i = 1; i < path.length; i++) {
      const a = { x: U.kx(path[i - 1]), y: U.ky(path[i - 1]) }, b = { x: U.kx(path[i]), y: U.ky(path[i]) };
      const ha = T[a.y][a.x].h, hb = T[b.y][b.x].h;
      u.lx = b.x - a.x; u.ly = b.y - a.y;
      u.mv = { ax: a.x, ay: a.y, bx: b.x, by: b.y };
      const climb = hb !== ha;
      await Anim.tween(0.17 + Math.abs(hb - ha) * 0.05, (t) => {
        u.rx = U.lerp(a.x, b.x, t); u.ry = U.lerp(a.y, b.y, t); u.rh = U.lerp(ha, hb, t);
        u.hop = Math.sin(t * Math.PI) * (climb ? 12 : 2);
        u.walk = Math.sin(t * Math.PI * 2) * 0.9;
      });
      if (!this.auto) SFX.play('step');
      Game.iso.focus(b.x, b.y, hb);
    }
    const e = { x: U.kx(path[path.length - 1]), y: U.ky(path[path.length - 1]) };
    this.place(u, e.x, e.y);
    u.hop = 0; u.walk = 0;
  }

  async engage(a, d, ws, links) {
    lookAt(a, d); lookAt(d, a);
    const events = Combat.engage(this, a, d, ws, links);
    if (Game.settings.cine && !this.auto) await Game.cine.play(events, this);
    else await this.quickFX(events);
    for (const ev of events) {
      if (ev.att !== a && !ev.att.dead) lookAt(ev.att, ev.def);
      if (ev.killed && !ev.def.deathShown) await this.killFX(ev.def);
    }
    this.refresh();
  }
  async quickFX(events) {
    const fx = Game.iso.fx;
    for (const ev of events) {
      const a = ev.att, d = ev.def;
      lookAt(a, d);
      const af = screenFace(a);
      const pa = isoP(a.x, a.y, a.rh), pd = isoP(d.x, d.y, d.rh);
      if (ev.label) fx.text(pa.x, pa.y - 66, ev.label === 'LINK' ? 'LINK!' : 'BALAS!', ev.label === 'LINK' ? '#ffb43c' : '#ff5a4d', 13);
      for (const s of ev.skills) fx.text(pa.x, pa.y - 80, s, '#5fd4ff', 12);
      const type = ev.w.type;
      const gap = { SMG: 55, MG: 70, SG: 25, RF: 260, SR: 300, BZ: 320, GL: 300, FL: 110, MSL: 300, MELEE: 260 }[type] || 200;
      const tcol = { RF: '#bff3ff', SR: '#d6ecff', MSL: '#ffb070', BZ: '#ffb070', GL: '#d8e0a0', FL: '#ff8a3a', SMG: '#f4ff9a' }[type] || '#ffe08a';
      for (const hits of ev.volleys) {
        for (const h of hits) {
          const from = ev.slot === 'sh' ? { x: pa.x - af * 6, y: pa.y - 42 } : { x: pa.x + af * 16, y: pa.y - 24 };
          const to = { x: pd.x + U.rf(-8, 8), y: pd.y - U.rf(12, 34) };
          if (!h.part) { to.x += (to.x - from.x) * 0.3; to.y -= 14; }
          if (type === 'MELEE') {
            // ayunan senjata jarak dekat di peta
            const sw = { side: ev.slot, k: 0 };
            a.swing = sw;
            await Anim.tween(0.2, (t) => { sw.k = 0.4 * t; });
            if (!this.auto) SFX.play('swing');
            await Anim.tween(0.07, (t) => { sw.k = 0.4 + (SWING_HIT - 0.4) * t; });
            Anim.tween(0.28, (t) => { sw.k = SWING_HIT + (1 - SWING_HIT) * t; }).then(() => { if (a.swing === sw) a.swing = null; });
            if (h.part) { fx.flash(to.x, to.y, 18); fx.spark(to.x, to.y, 14, 0.45); fx.ring(to.x, to.y, 22, 0.4); }
          }
          else {
            if (ev.slot !== 'sh') a.recoil[ev.slot] = 1;
            fx.flash(from.x, from.y, 12);
            if (type === 'FL') { for (let q = 0; q < 5; q++) fx.fire(U.lerp(from.x, to.x, q / 4), U.lerp(from.y, to.y, q / 4), 1, 0.3); }
            else fx.tracer(from.x, from.y, to.x, to.y, tcol, type === 'RF' || type === 'SR' ? 2.2 : 1.3, ['MSL', 'BZ', 'GL'].includes(type) ? 0.3 : 0.12);
          }
          if (!this.auto) SFX.play(type);
          if (h.part === 'blast') {
            for (const pt in h.dmgs) d.flash[pt] = 0.12;
            fx.explode(to.x, to.y, 0.4, 1.1);
            fx.text(to.x, to.y - 8, `${h.dmg} 💥`, '#ffd27f', 14);
            for (const pt of h.broken) if (pt !== 'body') fx.text(pd.x, pd.y - 62, `${PART_NAME[pt]} HANCUR`, '#ffb43c', 12, 1.5);
            Game.iso.shake = Math.max(Game.iso.shake, 6);
          } else if (h.part) {
            d.flash[h.part] = 0.09;
            fx.spark(to.x, to.y, 5, 0.35);
            if (type === 'MSL') fx.explode(to.x, to.y, 0.35, 0.8);
            fx.text(to.x + U.rf(-6, 6), to.y - 8, h.dmg, h.blocked ? '#8fc3ff' : '#fff', type === 'MG' || type === 'SG' ? 11 : 15);
            if (h.broke && h.part !== 'body') { fx.explode(to.x, to.y, 0.35, 1); fx.text(pd.x, pd.y - 62, `${PART_NAME[h.part]} HANCUR`, '#ffb43c', 12, 1.5); }
            Game.iso.shake = Math.max(Game.iso.shake, type === 'MSL' || type === 'RF' || type === 'MELEE' ? 5 : 2);
          } else fx.text(pd.x, pd.y - 50, 'MISS', '#a9bccb', 11, 0.7);
          await sleep(gap);
        }
      }
      await sleep(320);
    }
  }
  async killFX(u) {
    u.deathShown = true; u.dying = 1;
    const p = isoP(u.x, u.y, u.rh);
    Game.iso.fx.explode(p.x, p.y - 20, 0.5, 1.6);
    Game.iso.shake = 10;
    if (!this.auto) SFX.play('boom');
    if (u.team === 'E') this.kills++; else this.lost++;
    Game.iso.fx.text(p.x, p.y - 60, u.team === 'E' ? 'HANCUR!' : 'UNIT HILANG', '#ff5a4d', 16, 1.6);
    await sleep(650);
  }
  finish(win) {
    if (this.over) return;
    this.over = true; this.win = win; this.busy = true;
    this.result = { mission: this.mi, win, turns: this.turn, kills: this.kills, lost: this.lost };
    if (!this.auto) {
      HUD.cancelBtn(false);
      setTimeout(() => { SFX.play(win ? 'win' : 'lose'); UI.result(this); }, 1300);
    }
  }
  checkEnd() {
    if (this.over) return true;
    const bossDown = this.mis.boss && this.units.some((u) => u.boss && u.dead);
    if (!this.alive('E').length || bossDown) { this.finish(true); return true; }
    if (!this.alive('P').length) { this.finish(false); return true; }
    return false;
  }

  // ---------- input pemain ----------
  click(tile, unit) {
    if (this.busy || this.over || this.phase !== 'P') return;
    const u = unit || (tile && this.unitAt(tile.x, tile.y));
    switch (this.mode) {
      case 'idle':
        if (u && u.team === 'P' && !u.acted) this.select(u);
        else if (u) { HUD.showUnit(u, this, u.team === 'P' ? 'unitPanel' : 'targetPanel'); SFX.play('ui'); }
        break;
      case 'move':
        if (u === this.sel) { SFX.play('ui'); this.openActions(); return; }
        if (u && u.team === 'P' && !u.acted) { this.select(u); return; }
        if (tile && this.reach.cost.has(U.key(tile.x, tile.y))) this.doMove(this.sel, tile.x, tile.y);
        else if (u && u.team === 'E') HUD.showUnit(u, this, 'targetPanel');
        else this.deselect();
        break;
      case 'target':
      case 'confirm':
        if (u && u.team === 'E' && this.targets.includes(u)) {
          if (this.mode === 'confirm' && this.tgt === u) this.confirmAttack(); else this.previewAttack(u);
        } else if (!u) this.cancel();
        break;
      case 'repair':
        if (u && this.repairTargets.includes(u)) this.doRepairPlayer(u);
        else if (!u) this.cancel();
        break;
    }
  }
  hover(tile, unit) {
    if (!this.auto) HUD.tileInfo(tile);
    if (this.busy || this.over || this.phase !== 'P') return;
    if (this.mode === 'move') {
      for (const [k, v] of this.hl) if (v === 'path') this.hl.set(k, 'move');
      if (tile) {
        const k = U.key(tile.x, tile.y);
        if (this.reach.cost.has(k)) for (const q of buildPath(this.reach.prev, U.key(this.sel.x, this.sel.y), k)) if (this.reach.cost.has(q)) this.hl.set(q, 'path');
      }
    } else if (this.mode === 'idle') {
      const u = unit || (tile && this.unitAt(tile.x, tile.y));
      if (u !== this.hoverU) {
        this.hoverU = u; this.clearHL();
        if (u && u.team === 'E') { for (const k of reachable(this, u).cost.keys()) this.hl.set(k, 'emove'); HUD.showUnit(u, this, 'targetPanel'); }
        else if (u) { HUD.showUnit(u, this, 'unitPanel'); HUD.showUnit(null, this, 'targetPanel'); }
        else { HUD.showUnit(null, this); HUD.showUnit(null, this, 'targetPanel'); }
      }
    }
  }
  cancel() {
    if (this.busy || this.over || this.phase !== 'P') return;
    switch (this.mode) {
      case 'move': this.deselect(); break;
      case 'action': if (this.sel.moved && this.undo) this.undoMove(); else this.deselect(); break;
      case 'target': case 'repair': HUD.showUnit(null, this, 'targetPanel'); this.openActions(); break;
      case 'confirm': HUD.hidePreview(); HUD.showUnit(null, this, 'targetPanel'); this.mode = 'target'; this.showTargets(); this.hintUpdate(); break;
      default: return;
    }
    SFX.play('ui');
  }
  cycleUnit() {
    if (this.busy || this.phase !== 'P' || (this.mode !== 'idle' && this.mode !== 'move')) return;
    const list = this.alive('P').filter((u) => !u.acted);
    if (!list.length) return;
    const i = list.indexOf(this.sel);
    this.select(list[(i + 1) % list.length]);
  }
  deselect() {
    this.sel = null; this.mode = 'idle'; this.hoverU = null; this.clearHL();
    if (this.auto) return;
    HUD.showUnit(null, this); HUD.showUnit(null, this, 'targetPanel'); HUD.hideActions(); HUD.hidePreview();
    this.hintUpdate();
  }
  select(u) {
    SFX.play('select');
    this.sel = u; this.hoverU = null;
    HUD.showUnit(u, this); HUD.showUnit(null, this, 'targetPanel'); HUD.hidePreview();
    Game.iso.focus(u.x, u.y, u.rh);
    if (!u.moved) {
      this.mode = 'move'; this.undo = null;
      this.reach = reachable(this, u);
      this.clearHL();
      for (const k of this.reach.cost.keys()) this.hl.set(k, 'move');
      HUD.hideActions();
    } else this.openActions();
    this.hintUpdate();
  }
  async doMove(u, x, y) {
    const path = buildPath(this.reach.prev, U.key(u.x, u.y), U.key(x, y));
    this.undo = { x: u.x, y: u.y, lx: u.lx, ly: u.ly };
    this.busy = true; this.clearHL(); SFX.play('confirm'); HUD.hint('');
    await this.animMove(u, path);
    this.busy = false; u.moved = true;
    HUD.showUnit(u, this);
    this.openActions();
  }
  undoMove() {
    const u = this.sel, o = this.undo;
    this.place(u, o.x, o.y); u.lx = o.lx; u.ly = o.ly; u.moved = false; this.undo = null;
    HUD.hideActions();
    this.select(u);
  }
  openActions() {
    this.mode = 'action'; this.clearHL();
    HUD.actions(this, this.sel); HUD.hidePreview();
    this.hintUpdate();
  }
  menuAction(a) {
    const u = this.sel;
    if (!u || this.busy) return;
    if (a[0] === 'w') {
      const ws = Combat.weaponsOf(u)[+a.slice(1)];
      if (!ws || !Combat.canUse(u, ws)) return;
      this.ws = ws; this.mode = 'target';
      HUD.hideActions(); this.showTargets(); this.hintUpdate();
      if (this.targets.length === 1) this.previewAttack(this.targets[0]);
    } else if (a === 'repair') {
      this.repairTargets = this.alive('P').filter((o) => U.dist(o, u) <= 1 && PARTS.some((p) => o.parts[p] > 0 && o.parts[p] < o.max[p]));
      if (!this.repairTargets.length) { UI.toast('Tidak ada unit yang perlu diperbaiki', 'err'); SFX.play('error'); return; }
      this.mode = 'repair'; HUD.hideActions(); this.clearHL();
      for (const o of this.repairTargets) this.hl.set(U.key(o.x, o.y), 'repair');
      this.hintUpdate();
    } else if (a === 'guard') { u.guarding = true; this.endUnit(u); }
    else if (a === 'wait') this.endUnit(u);
    else if (a === 'undo') this.undoMove();
  }
  rangeHL(u, ws) {
    this.clearHL();
    const m = this.map;
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const d = Math.abs(x - u.x) + Math.abs(y - u.y);
      if (d >= ws.w.rmin && d <= ws.w.rmax) this.hl.set(U.key(x, y), 'atk');
    }
    for (const t of this.targetsFor(u, ws)) this.hl.set(U.key(t.x, t.y), 'target');
  }
  showTargets() { this.rangeHL(this.sel, this.ws); this.targets = this.targetsFor(this.sel, this.ws); }
  previewRange(i) {
    if (this.mode !== 'action' || !this.sel) return;
    if (i < 0) { this.clearHL(); return; }
    const ws = Combat.weaponsOf(this.sel)[i];
    if (ws) this.rangeHL(this.sel, ws);
  }
  previewAttack(d) {
    this.mode = 'confirm'; this.tgt = d;
    lookAt(this.sel, d);
    HUD.showUnit(d, this, 'targetPanel');
    HUD.preview(this, this.sel, d, this.ws);
    SFX.play('select');
    this.hintUpdate();
  }
  async confirmAttack() {
    if (this.mode !== 'confirm' || this.busy) return;
    const a = this.sel, d = this.tgt, ws = this.ws;
    HUD.hidePreview(); HUD.hint(''); HUD.cancelBtn(false); this.clearHL();
    this.busy = true; HUD.turn(this); SFX.play('confirm');
    await this.engage(a, d, ws, this.linkOn);
    this.busy = false;
    if (this.over) return;
    this.endUnit(a);
  }
  endUnit(u) { u.acted = true; u.moved = true; this.afterUnit(); }
  afterUnit() {
    this.sel = null; this.mode = 'idle'; this.hoverU = null; this.clearHL();
    HUD.hideActions(); HUD.hidePreview(); HUD.showUnit(null, this); HUD.showUnit(null, this, 'targetPanel');
    this.refresh();
    if (this.checkEnd()) return;
    if (this.alive('P').every((u) => u.acted)) {
      this.busy = true; HUD.hint('Semua unit sudah beraksi — fase musuh dimulai…');
      setTimeout(() => { this.busy = false; this.endPlayerTurn(); }, 700);
    }
  }
  async doRepairPlayer(o) {
    const u = this.sel;
    this.busy = true; this.clearHL();
    await this.doRepair(u, o);
    this.busy = false;
    this.endUnit(u);
  }
  async doRepair(u, o) {
    const healed = Combat.repair(u, o);
    if (!this.auto) SFX.play('repair');
    const p = isoP(o.x, o.y, o.rh);
    let i = 0;
    for (const k of PARTS) if (healed[k] > 0) { Game.iso.fx.text(p.x, p.y - 50 - i * 13, `${PART_NAME[k]} +${healed[k]}`, '#5fe08a', 11, 1.4); i++; }
    Game.iso.fx.heal(p.x, p.y - 20, 0.6);
    await sleep(800);
    this.refresh();
  }
  hintUpdate() {
    if (this.auto) return;
    const m = TOUCH ? {
      idle: 'Tap unit GARUDA (lingkaran biru) · tap musuh untuk melihat jangkauannya · UNIT ▸ ganti unit · cubit 2 jari = zoom',
      move: 'Tap petak biru untuk bergerak · tap unit itu lagi untuk tetap di tempat · ✕ batal',
      action: 'Pilih perintah.',
      target: 'Tap musuh bertanda merah untuk diserang · ✕ kembali',
      confirm: 'Periksa prediksi lalu tekan SERANG (atau tap target sekali lagi)',
      repair: 'Tap unit bertanda hijau untuk diperbaiki',
    } : {
      idle: 'Pilih unit GARUDA (lingkaran biru). Arahkan ke musuh untuk melihat jangkauan geraknya. [Q/E] putar kamera · [TAB] ganti unit · [T] akhiri giliran',
      move: 'Klik petak biru untuk bergerak · klik unit itu lagi untuk tetap di tempat · klik kanan / ESC batal',
      action: 'Pilih perintah. Arahkan ke senjata untuk melihat jangkauannya.',
      target: 'Klik musuh bertanda merah untuk diserang · klik kanan / ESC kembali',
      confirm: 'Periksa prediksi lalu tekan SERANG (atau klik target sekali lagi)',
      repair: 'Klik unit bertanda hijau untuk diperbaiki',
    };
    HUD.hint(this.phase === 'P' && !this.busy ? m[this.mode] || '' : '');
    HUD.cancelBtn(this.phase === 'P' && !this.busy && this.mode !== 'idle');
  }
  refresh() {
    if (this.auto) return;
    HUD.turn(this);
    if (this.sel && this.phase === 'P') HUD.showUnit(this.sel, this);
    this.hintUpdate();
  }
}
