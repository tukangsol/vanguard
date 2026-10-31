'use strict';
// ================= ANIMASI PERTEMPURAN SINEMATIK =================
class Cine {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.active = false; this.time = 0;
    this.waiters = []; this.tweens = []; this.proj = []; this.banners = [];
    this.fx = new FXSys(); this.shake = 0; this.fast = false; this.skip = false;
    this.bg = null; this.bgTheme = null; this.alpha = 0; this.info = '';
    this.resize();
  }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    // HP tegak: layar sempit -> robot dibuat lebih besar supaya tetap kelihatan
    this.scale = this.W < this.H ? Math.min(this.H * 0.0034, this.W * 0.0034) : Math.min(this.H * 0.0034, this.W * 0.0026);
    this.feetY = this.H * 0.8; this.k = this.scale / 2.2;
    this.bg = null;
  }
  wait(ms) {
    if (this.skip) return Promise.resolve();
    return new Promise((r) => this.waiters.push({ t: this.time + ms / 1000, r }));
  }
  tween(ms, fn, ease = U.easeInOut) {
    if (this.skip) { fn(1); return Promise.resolve(); }
    return new Promise((r) => this.tweens.push({ t: 0, d: ms / 1000, fn, ease, r }));
  }
  doSkip() {
    if (!this.active || this.skip) return;
    this.skip = true;
    this.waiters.forEach((w) => w.r()); this.waiters = [];
    this.tweens.forEach((t) => { t.fn(1); t.r(); }); this.tweens = [];
    this.proj = [];
  }
  slot(u, hp, face) { return { u, hp: { ...hp }, hpD: { ...hp }, face, ox: 0, flash: {}, recoil: {}, alpha: 1, sink: 0, dodge: 0, aim: { rarm: 0, larm: 0 }, swing: null, kick: 0 }; }
  baseX(s) { return s.face === 1 ? this.W * 0.3 : this.W * 0.7; }
  point(s, which) {
    return mechPoint(s.u, this.baseX(s) + s.ox, this.feetY + s.sink, this.scale, s.face, which, { parts: s.hp, recoil: s.recoil, aim: s.aim, swing: s.swing });
  }
  banner(text, col) { this.banners.push({ text, col, age: 0, life: 1.15 }); }

  async play(events, B) {
    const theme = B.mis.theme;
    if (!this.bg || this.bgTheme !== theme) {
      this.bg = makeBackdrop(this.W, this.H, theme, this.dpr);
      this.bgTheme = theme;
      this.amb = new Ambient(THEMES[theme].cine.amb, 80);
    }
    this.active = true; this.skip = false; this.fast = false; this.time = 0;
    this.proj = []; this.banners = []; this.fx.clear(); this.waiters = []; this.tweens = [];
    this.leftTeam = events[0].att.team;
    this.L = this.slot(events[0].att, events[0].attHp0, 1);
    this.R = this.slot(events[0].def, events[0].defHp0, -1);
    this.info = '';
    this.cv.classList.remove('hidden');
    this.alpha = 0;
    const off = this.W * 0.55;
    this.L.ox = -off; this.R.ox = off;
    await this.tween(450, (t) => { this.alpha = t; this.L.ox = -off * (1 - t); this.R.ox = off * (1 - t); }, U.easeOut);
    await this.wait(250);
    for (const ev of events) { if (this.skip) break; await this.playEvent(ev); }
    if (!this.skip) await this.wait(450);
    this.skip = false;
    await this.tween(280, (t) => { this.alpha = 1 - t; });
    this.cv.classList.add('hidden');
    this.active = false;
  }

  async ensure(side, u, hp) {
    const s = this[side];
    if (s.u === u) return;
    const dir = side === 'L' ? -1 : 1, off = this.W * 0.55;
    await this.tween(260, (t) => { s.ox = dir * off * t; }, U.easeIn);
    const ns = this.slot(u, hp, side === 'L' ? 1 : -1);
    ns.ox = dir * off;
    this[side] = ns;
    await this.tween(320, (t) => { ns.ox = dir * off * (1 - t); }, U.easeOut);
  }

  async playEvent(ev) {
    const A = ev.att.team === this.leftTeam ? 'L' : 'R', D = A === 'L' ? 'R' : 'L';
    await this.ensure(A, ev.att, ev.attHp0);
    await this.ensure(D, ev.def, ev.defHp0);
    const sa = this[A], sd = this[D];
    this.info = `${ev.att.name} ▸ ${ev.w.name}   ·   AKURASI ${ev.chance}%`;
    if (ev.label === 'LINK') { this.banner('LINK ATTACK', '#ffb43c'); SFX.play('skill'); await this.wait(550); }
    if (ev.label === 'COUNTER') { this.banner('SERANGAN BALASAN', '#ff5a4d'); await this.wait(500); }
    for (const s of ev.skills) { this.banner('SKILL ▸ ' + s, '#5fd4ff'); SFX.play('skill'); await this.wait(600); }
    if (ev.defSkill) { this.banner('SKILL ▸ ' + ev.defSkill, '#8fc3ff'); SFX.play('skill'); await this.wait(500); }
    for (const hits of ev.volleys) {
      if (this.skip) return;
      if (ev.w.type === 'MELEE') await this.melee(sa, sd, ev, hits);
      else await this.shoot(sa, sd, ev, hits);
      await this.wait(200);
    }
    if (ev.killed) await this.death(sd);
    await this.wait(300);
  }

  async shoot(sa, sd, ev, hits) {
    const type = ev.w.type, side = ev.slot;
    const cfg = { SMG: { gap: 50, dur: 130 }, MG: { gap: 70, dur: 160 }, SG: { gap: 0, dur: 170 }, RF: { gap: 450, dur: 110 }, SR: { gap: 0, dur: 90 }, BZ: { gap: 400, dur: 380 }, GL: { gap: 320, dur: 520 }, FL: { gap: 130, dur: 280 }, MSL: { gap: 300, dur: 650 } }[type] || { gap: 200, dur: 200 };
    const blast = !!ev.w.blast;
    // angkat senjata ke posisi bidik
    if (side !== 'sh' && sa.aim[side] < 1) {
      SFX.play('aim');
      const a0 = sa.aim[side];
      await this.tween(220, (t) => { sa.aim[side] = a0 + (1 - a0) * t; }, U.easeOut);
      await this.wait(type === 'SR' ? 260 : 90);
    }
    for (let i = 0; i < hits.length; i++) {
      if (this.skip) return;
      const h = hits[i];
      const from = this.point(sa, side === 'sh' ? 'pod' : 'mz_' + side);
      let to;
      if (h.part === 'blast') to = this.point(sd, 'body');
      else if (h.part) { to = this.point(sd, h.part); to.x += U.rf(-8, 8) * this.k; to.y += U.rf(-10, 10) * this.k; }
      else { const b = this.point(sd, 'body'); to = { x: b.x + Math.sign(b.x - from.x) * U.rf(90, 220) * this.k, y: b.y + U.rf(-110, 40) * this.k }; }
      if (side !== 'sh') sa.recoil[side] = 1;
      if (['SR', 'BZ'].includes(type)) sa.kick = 1; else if (['SG', 'GL', 'RF'].includes(type)) sa.kick = Math.max(sa.kick, 0.5);
      if (side !== 'sh' && ['MG', 'SMG', 'RF', 'SR', 'SG'].includes(type)) { const hp = this.point(sa, 'h_' + side); this.fx.shell(hp.x, hp.y, this.k, sa.face, type === 'SG' ? '#c9452e' : '#d9a441'); }
      if (type !== 'FL') this.fx.flash(from.x, from.y, (['SG', 'RF', 'SR', 'BZ'].includes(type) ? 46 : 28) * this.k);
      if (type === 'MSL' || type === 'BZ') this.fx.smoke(from.x, from.y, 5, this.k, '#888', 0.4);
      if (type === 'SR') this.fx.smoke(from.x, from.y, 3, this.k * 0.7, '#aaa', 0.3);
      if (type !== 'SG' || i === 0) SFX.play(type);
      this.shot(type, from, to, cfg.dur, () => this.impact(sd, h, type, to, blast));
      if (cfg.gap) await this.wait(cfg.gap);
    }
    await this.wait(cfg.dur + 320);
    // turunkan senjata kembali
    if (side !== 'sh') await this.tween(240, (t) => { sa.aim[side] = 1 - t; });
  }

  async melee(sa, sd, ev, hits) {
    const dist = Math.abs(this.baseX(sd) - this.baseX(sa)) - this.scale * 62;
    const side = ev.slot, id = side === 'rarm' ? sa.u.r : sa.u.l, kind = MELEE_KIND[id] || 'thrust';
    SFX.play('step');
    await this.tween(260, (t) => { sa.ox = sa.face * dist * t; }, U.easeIn);
    for (const h of hits) {
      if (this.skip) return;
      const sw = { side, k: 0 };
      sa.swing = sw;
      // ancang-ancang -> hantam -> jeda benturan -> kembali
      await this.tween(kind === 'smash' ? 340 : kind === 'slash' ? 260 : 200, (t) => { sw.k = 0.4 * t; }, U.easeOut);
      SFX.play('swing');
      await this.tween(kind === 'thrust' ? 60 : 85, (t) => { sw.k = 0.4 + (SWING_HIT - 0.4) * t; }, U.easeIn);
      SFX.play(kind === 'smash' ? 'smash' : 'MELEE');
      const at = this.point(sd, h.part || 'body');
      this.impact(sd, h, 'MELEE', at);
      if (h.part) { this.meleeFX(at, kind, id, sa.face); sd.kick = kind === 'smash' ? 1.6 : 1.1; }
      this.shake = kind === 'smash' ? 26 : 16;
      await this.wait(h.part ? 110 : 30);
      await this.tween(380, (t) => { sw.k = SWING_HIT + (1 - SWING_HIT) * t; });
      sa.swing = null;
      await this.wait(120);
    }
    sa.swing = null;
    await this.tween(320, (t) => { sa.ox = sa.face * dist * (1 - t); }, U.easeOut);
  }

  meleeFX(at, kind, id, dir) {
    if (this.skip) return;
    const k = this.k, fx = this.fx;
    const col = { blade: '#ffb46a', rod: '#9fe6ff', hammer: '#fff0c8', knuckle: '#ffd27a', pile: '#e6f2ff' }[id] || '#ffd27a';
    fx.flash(at.x, at.y, (kind === 'smash' ? 90 : 60) * k);
    fx.spark(at.x, at.y, kind === 'smash' ? 26 : 18, k * 1.3, col);
    fx.ring(at.x, at.y, (kind === 'smash' ? 90 : 60) * k, k);
    if (kind === 'slash') {
      fx.tracer(at.x - dir * 46 * k, at.y - 58 * k, at.x + dir * 40 * k, at.y + 44 * k, col, 9 * k, 0.22);
      fx.tracer(at.x - dir * 42 * k, at.y - 52 * k, at.x + dir * 36 * k, at.y + 40 * k, '#ffffff', 3 * k, 0.22);
      if (id === 'blade') fx.fire(at.x, at.y, 6, k);
    } else if (kind === 'smash') {
      fx.debris(at.x, at.y, 12, k * 1.2);
      fx.smoke(at.x, at.y + 10 * k, 6, k, '#8a8070', 0.4);
      fx.text(at.x, at.y - 70 * k, 'CRUSH!', '#ffd27a', 22 * k, 0.9);
    } else {
      fx.tracer(at.x - dir * 50 * k, at.y, at.x + dir * 10 * k, at.y, col, 7 * k, 0.16);
      if (id === 'pile') fx.text(at.x, at.y - 70 * k, 'PIERCE!', '#e6f2ff', 20 * k, 0.9);
    }
  }

  shot(type, from, to, dur, onHit) {
    if (this.skip) return;
    this.proj.push({ type, x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, vx: 0, vy: 0, t: 0, d: dur / 1000, onHit });
  }

  impact(sd, h, type, at, blast) {
    if (this.skip) return;
    const k = this.k;
    if (!h.part && blast) { this.fx.explode(at.x, at.y, k, 0.9); SFX.play('smallboom'); this.shake = Math.max(this.shake, 8); }
    if (h.part === 'blast') {
      sd.hp = { ...h.hp };
      const b = this.point(sd, 'body');
      this.fx.explode(b.x, b.y, k, 1.4);
      this.fx.fire(b.x, b.y, 10, k * 1.4);
      SFX.play('smallboom'); SFX.play('hit');
      for (const pt in h.dmgs) {
        sd.flash[pt] = 0.12;
        const pp = this.point(sd, pt);
        this.fx.text(pp.x + U.rf(-12, 12) * k, pp.y - 8 * k, h.dmgs[pt], '#ffd27f', 22 * k);
      }
      this.fx.text(b.x, b.y - 80 * k, 'LEDAKAN!', '#ff8a3a', 24 * k, 1.2);
      for (const pt of h.broken) if (pt !== 'body') { const pp = this.point(sd, pt); this.fx.explode(pp.x, pp.y, k, 0.9); this.fx.text(pp.x, pp.y - 46 * k, `${PART_NAME[pt]} HANCUR`, '#ffb43c', 22 * k, 1.5); }
      this.shake = Math.max(this.shake, 18);
      return;
    }
    if (!h.part) {
      const b = this.point(sd, 'head');
      this.fx.text(b.x, b.y - 20 * k, 'MISS', '#a9bccb', 20 * k);
      sd.dodge = 1;
      SFX.play('miss');
      return;
    }
    sd.hp = { ...h.hp };
    sd.flash[h.part] = 0.09;
    this.fx.spark(at.x, at.y, type === 'MSL' ? 18 : 7, k);
    if (type === 'MSL') { this.fx.explode(at.x, at.y, k, 0.8); SFX.play('smallboom'); }
    else if (type === 'FL') { this.fx.fire(at.x, at.y, 8, k * 1.2); SFX.play('hit'); }
    else if (type === 'SR') { this.fx.flash(at.x, at.y, 40 * k); this.fx.spark(at.x, at.y, 14, k, '#bfe6ff'); SFX.play('hit'); }
    else SFX.play(h.blocked ? 'block' : 'hit');
    this.fx.text(at.x + U.rf(-14, 14) * k, at.y - 16 * k, h.dmg, h.blocked ? '#8fc3ff' : '#ffffff', (['MG', 'SG', 'SMG', 'FL'].includes(type) ? 20 : 30) * k);
    if (h.blocked) this.fx.text(at.x, at.y + 10 * k, 'BLOK', '#8fc3ff', 13 * k);
    this.shake = Math.max(this.shake, ['MSL', 'RF', 'SR', 'MELEE'].includes(type) ? 12 : 4);
    if (h.broke && h.part !== 'body') {
      this.fx.explode(at.x, at.y, k, 1);
      SFX.play('smallboom');
      this.fx.text(at.x, at.y - 46 * k, `${PART_NAME[h.part]} HANCUR`, '#ffb43c', 24 * k, 1.5);
    }
  }

  async death(sd) {
    for (let i = 0; i < 5; i++) {
      if (this.skip) return;
      const p = this.point(sd, U.pick(PARTS));
      this.fx.explode(p.x + U.rf(-30, 30) * this.k, p.y + U.rf(-30, 30) * this.k, this.k, 1.1);
      SFX.play('smallboom'); this.shake = 16;
      await this.wait(170);
    }
    const b = this.point(sd, 'body');
    this.fx.explode(b.x, b.y, this.k, 2.4);
    this.fx.smoke(b.x, b.y, 14, this.k * 1.6, '#222', 0.6);
    SFX.play('boom'); this.shake = 28;
    this.banner(sd.u.team === 'P' ? 'UNIT HILANG' : 'TARGET HANCUR', '#ff5a4d');
    await this.tween(700, (t) => { sd.alpha = 1 - t; sd.sink = t * 40 * this.k; });
    await this.wait(400);
  }

  update(dt) {
    if (!this.active) return;
    dt *= this.fast ? 3 : 1;
    this.time += dt;
    for (let i = this.waiters.length - 1; i >= 0; i--) if (this.waiters[i].t <= this.time) this.waiters.splice(i, 1)[0].r();
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.d);
      tw.fn(tw.ease(k));
      if (k >= 1) { this.tweens.splice(i, 1); tw.r(); }
    }
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.d);
      const arc = p.type === 'MSL' ? 0.12 : p.type === 'GL' ? 0.08 : 0;
      const nx = U.lerp(p.x0, p.x1, k), ny = U.lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * this.H * arc;
      if (dt > 0) { p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt; }
      p.x = nx; p.y = ny;
      if ((p.type === 'MSL' || p.type === 'BZ') && Math.random() < 0.8) this.fx.smoke(p.x, p.y, 1, this.k * 0.7, '#9a9a9a', 0.35);
      if (p.type === 'FL') this.fx.fire(p.x + U.rf(-6, 6) * this.k, p.y + U.rf(-6, 6) * this.k, 2, this.k * (0.6 + k * 0.8));
      if (k >= 1) { this.proj.splice(i, 1); p.onHit(); }
    }
    this.fx.update(dt);
    for (const b of this.banners) { b.age += dt; b.life -= dt; }
    this.banners = this.banners.filter((b) => b.life > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
    for (const s of [this.L, this.R]) {
      if (!s) continue;
      for (const p of PARTS) s.hpD[p] += (s.hp[p] - s.hpD[p]) * Math.min(1, dt * 8);
      for (const p in s.flash) s.flash[p] = Math.max(0, s.flash[p] - dt);
      for (const p in s.recoil) s.recoil[p] = Math.abs(s.recoil[p]) < 0.02 ? 0 : s.recoil[p] * Math.max(0, 1 - dt * 9);
      s.dodge = Math.max(0, s.dodge - dt * 3.5);
      s.kick = Math.max(0, s.kick - dt * 4.5);
    }
    if (this.amb) this.amb.update(dt);
  }

  drawProj(c) {
    const k = this.k;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const p of this.proj) {
      switch (p.type) {
        case 'MG':
          c.strokeStyle = '#ffe08a'; c.lineWidth = 3 * k;
          c.beginPath(); c.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.lineTo(p.x, p.y); c.stroke(); break;
        case 'SG':
          c.fillStyle = '#fff3c0'; c.beginPath(); c.arc(p.x, p.y, 2.6 * k, 0, 6.283); c.fill(); break;
        case 'SMG':
          c.strokeStyle = '#f4ff9a'; c.lineWidth = 2 * k;
          c.beginPath(); c.moveTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); c.lineTo(p.x, p.y); c.stroke(); break;
        case 'SR': {
          c.strokeStyle = 'rgba(130,190,255,0.35)'; c.lineWidth = 14 * k; c.beginPath(); c.moveTo(p.x0, p.y0); c.lineTo(p.x, p.y); c.stroke();
          c.strokeStyle = '#ffffff'; c.lineWidth = 3.5 * k; c.beginPath(); c.moveTo(p.x0, p.y0); c.lineTo(p.x, p.y); c.stroke(); break;
        }
        case 'GL':
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#3a4a2a'; c.beginPath(); c.arc(p.x, p.y, 4.5 * k, 0, 6.283); c.fill();
          c.fillStyle = '#ffd24a'; c.fillRect(p.x - 4.5 * k, p.y - 1 * k, 9 * k, 2 * k);
          c.globalCompositeOperation = 'lighter'; break;
        case 'BZ': {
          c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
          const g = c.createRadialGradient(-14 * k, 0, 0, -14 * k, 0, 20 * k);
          g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(1, 'rgba(255,120,30,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(-18 * k, 0, 20 * k, 7 * k, 0, 0, 6.283); c.fill();
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#5a6a3a'; c.fillRect(-10 * k, -3.5 * k, 16 * k, 7 * k);
          c.fillStyle = '#c94a2a'; c.beginPath(); c.moveTo(6 * k, -4 * k); c.lineTo(14 * k, 0); c.lineTo(6 * k, 4 * k); c.fill();
          c.restore(); break;
        }
        case 'RF': {
          const tx = U.lerp(p.x0, p.x, 0.4), ty = U.lerp(p.y0, p.y, 0.4);
          c.strokeStyle = 'rgba(120,220,255,0.35)'; c.lineWidth = 9 * k; c.beginPath(); c.moveTo(tx, ty); c.lineTo(p.x, p.y); c.stroke();
          c.strokeStyle = '#ffffff'; c.lineWidth = 2.5 * k; c.beginPath(); c.moveTo(tx, ty); c.lineTo(p.x, p.y); c.stroke(); break;
        }
        case 'MSL': {
          c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
          const g = c.createRadialGradient(-10 * k, 0, 0, -10 * k, 0, 16 * k);
          g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(1, 'rgba(255,120,30,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(-14 * k, 0, 16 * k, 5 * k, 0, 0, 6.283); c.fill();
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#c9ced4'; c.fillRect(-9 * k, -2.6 * k, 16 * k, 5.2 * k);
          c.fillStyle = '#d94a3a'; c.beginPath(); c.moveTo(7 * k, -2.6 * k); c.lineTo(12 * k, 0); c.lineTo(7 * k, 2.6 * k); c.fill();
          c.restore(); break;
        }
      }
    }
    c.restore();
  }

  drawPanel(s, left) {
    if (!s) return;
    const c = this.ctx, u = s.u, W = this.W;
    const nar = W < 600, mg = nar ? 8 : 20;
    const pw = nar ? (W - mg * 3) / 2 : Math.min(330, W * 0.36), ph = 126, x = left ? mg : W - mg - pw, y = this.H * 0.075 + 12;
    const col = u.team === 'P' ? '#5fd4ff' : '#ff5a4d';
    c.fillStyle = 'rgba(6,10,16,0.84)'; c.fillRect(x, y, pw, ph);
    c.strokeStyle = U.rgba(col, 0.45); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
    c.fillStyle = col; c.fillRect(left ? x : x + pw - 4, y, 4, ph);
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = col; c.font = `700 ${nar ? 16 : 19}px ${FONT}`; c.fillText(u.name, x + 14, y + 24, pw - 22);
    c.fillStyle = '#9fb0bf'; c.font = `500 ${nar ? 11 : 12}px ${FONT}`; c.fillText(nar ? u.pilot.name : `${u.pilot.name}  ·  ${u.frame.name}`, x + 14, y + 42, pw - 22);
    PARTS.forEach((p, i) => {
      const by = y + 56 + i * 16, v = s.hpD[p], m = u.max[p], r = U.clamp(v / m, 0, 1);
      c.fillStyle = '#7f909e'; c.font = `600 10px ${FONT}`; c.fillText(PART_NAME[p], x + 14, by + 8);
      const bx = x + (nar ? 56 : 66), bw = pw - (nar ? 100 : 136);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, by, bw, 8);
      c.fillStyle = hpCol(r); c.fillRect(bx, by, bw * r, 8);
      c.textAlign = 'right';
      c.fillStyle = s.hp[p] <= 0 ? '#ff5a4d' : '#dce7ef'; c.font = `600 12px Consolas, monospace`;
      c.fillText(s.hp[p] <= 0 ? (nar ? 'X' : 'HANCUR') : Math.round(s.hp[p]) + (nar ? '' : '/' + m), x + pw - 12, by + 9);
      c.textAlign = 'left';
    });
  }

  render() {
    if (!this.active) return;
    const c = this.ctx, W = this.W, H = this.H, k = this.k;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.globalAlpha = this.alpha;
    const sx = this.shake ? U.rf(-1, 1) * this.shake : 0, sy = this.shake ? U.rf(-1, 1) * this.shake : 0;
    c.save(); c.translate(sx, sy);
    if (!this.bg && this.bgTheme) this.bg = makeBackdrop(W, H, this.bgTheme, this.dpr);
    if (this.bg) c.drawImage(this.bg, -12, -12, W + 24, H + 24);
    if (this.amb) this.amb.draw(c, W, H);
    for (const s of [this.L, this.R]) {
      if (!s) continue;
      const x = this.baseX(s) + s.ox - s.face * (Math.sin(s.dodge * Math.PI) * 26 + Math.sin(Math.min(1, s.kick) * Math.PI * 0.5) * 9) * k;
      c.globalAlpha = this.alpha * s.alpha * 0.45;
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(x, this.feetY + 2, 34 * this.scale, 7 * this.scale, 0, 0, 6.283); c.fill();
      c.globalAlpha = this.alpha * s.alpha;
      drawMech(c, s.u, x, this.feetY + s.sink, this.scale, s.face, { t: this.time, parts: s.hp, flash: s.flash, recoil: s.recoil, aim: s.aim, swing: s.swing, bob: Math.sin(this.time * 2 + (s.face > 0 ? 0 : 1.5)) * 1.2 });
    }
    c.globalAlpha = this.alpha;
    this.drawProj(c);
    this.fx.draw(c);
    c.restore();
    c.globalAlpha = this.alpha;
    const lb = H * 0.075;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, lb); c.fillRect(0, H - lb, W, lb);
    c.fillStyle = 'rgba(255,180,60,0.6)'; c.fillRect(0, lb, W, 1); c.fillRect(0, H - lb - 1, W, 1);
    this.drawPanel(this.L, true); this.drawPanel(this.R, false);
    for (let i = 0; i < this.banners.length; i++) {
      const b = this.banners[i], a = Math.min(1, b.age / 0.15, b.life / 0.25), y = H * 0.36 + i * 66;
      c.globalAlpha = this.alpha * a;
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, U.rgba(b.col, 0)); g.addColorStop(0.2, U.rgba(b.col, 0.28)); g.addColorStop(0.8, U.rgba(b.col, 0.28)); g.addColorStop(1, U.rgba(b.col, 0));
      c.fillStyle = g; c.fillRect(0, y - 28, W, 56);
      c.fillStyle = b.col; c.fillRect(W * 0.15, y - 29, W * 0.7, 2); c.fillRect(W * 0.15, y + 27, W * 0.7, 2);
      c.font = `700 ${Math.round(34 * Math.max(0.7, Math.min(1.3, W / 1300)))}px ${FONT}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = b.col; c.shadowBlur = 18; c.fillStyle = '#fff';
      c.fillText(b.text.split('').join(String.fromCharCode(8202)), W / 2 + (1 - Math.min(1, b.age / 0.2)) * 60, y);
      c.shadowBlur = 0;
    }
    c.globalAlpha = this.alpha;
    c.textBaseline = 'middle'; c.font = `600 14px ${FONT}`;
    const nar = W < 600, iy = nar ? H - lb * 0.66 : H - lb / 2;
    if (nar) c.font = `600 13px ${FONT}`;
    c.fillStyle = '#dce7ef'; c.textAlign = 'left'; c.fillText(this.info, nar ? 12 : 22, iy, W - 24);
    c.fillStyle = '#6d7d8a'; c.textAlign = nar ? 'left' : 'right'; c.font = `500 ${nar ? 11 : 12}px ${FONT}`;
    if (nar) c.translate(12 - (W - 22), lb * 0.42);
    c.fillText(TOUCH ? (this.fast ? '▶▶ CEPAT  ·  TAP: LEWATI' : 'TAP: PERCEPAT') : this.fast ? '▶▶ CEPAT  ·  SPASI / ESC: LEWATI' : 'KLIK: PERCEPAT  ·  SPASI / ESC: LEWATI', W - 22, H - lb / 2);
    if (nar) c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1;
  }
}
