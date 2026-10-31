'use strict';
// ================= GAME LOOP, INPUT, BOOT =================
const Game = {
  save: null, battle: null, scene: null,
  settings: { cine: true, sound: true, fast: false },
  keys: new Set(),
  init() {
    this.cv = document.getElementById('game');
    this.iso = new IsoRenderer(this.cv);
    this.cine = new Cine(document.getElementById('cine'));
    this.loadSettings(); this.loadSave();
    HUD.init();
    this.bindInput();
    window.addEventListener('resize', () => { this.iso.resize(); this.cine.resize(); });
    this.scene = new TitleScene();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    const hash = location.hash;
    if (hash === '#autotest') { runAutoTest(); return; }
  if (hash.startsWith('#bal')) { runBalance(hash.slice(4)); return; }
    if (hash.startsWith('#dev=')) { devHook(hash.slice(5)); return; }
    UI.title();
  },
  loadSettings() {
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { /* abaikan */ }
    this.applySettings(true);
  },
  applySettings(noSave) {
    SFX.on = this.settings.sound;
    Time.speed = this.settings.fast ? 1.8 : 1;
    if (!noSave) try { localStorage.setItem(SET_KEY, JSON.stringify(this.settings)); } catch (e) { /* abaikan */ }
  },
  loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && (s.v === 1 || s.v === 2) && Array.isArray(s.pilots)) {
        migrateSave(s);
        const fresh = newSave();
        for (const p of fresh.pilots) if (!s.pilots.find((q) => q.id === p.id)) { s.pilots.push(p); s.load[p.id] = fresh.load[p.id]; }
        this.save = s;
      } else this.save = newSave(), (this.save.started = false);
    } catch (e) { this.save = newSave(); this.save.started = false; }
  },
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* abaikan */ } },
  startBattle(mi) {
    this.stopBattle();
    UI.clear();
    ensureJoined(mi);
    this.battle = new Battle(mi);
    this.battle.start();
  },
  stopBattle() {
    if (this.battle) { this.battle.abandoned = true; this.battle.over = true; }
    this.battle = null;
    HUD.hide();
    this.iso.fx.clear();
  },
  frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    const sdt = dt * Time.speed;
    Anim.update(sdt);
    if (this.battle) {
      if (!UI.modalOpen() && this.keys.size) {
        const pan = 560 * dt;
        let dx = 0, dy = 0;
        if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= pan;
        if (this.keys.has('d') || this.keys.has('arrowright')) dx += pan;
        if (this.keys.has('w') || this.keys.has('arrowup')) dy -= pan;
        if (this.keys.has('s') || this.keys.has('arrowdown')) dy += pan;
        if (dx || dy) this.iso.panScreen(dx, dy);
      }
      this.iso.update(sdt, this.battle);
      this.iso.render(this.battle);
    } else if (this.scene) this.scene.render(dt);
    this.cine.update(sdt);
    this.cine.render();
    if (UI.hangarView) UI.hangarView.render(dt);
    if (UI.mapPrev && UI.mapPrev.cv.isConnected) drawMapPreview(UI.mapPrev.cv, UI.mapPrev.map, ts / 1000);
    requestAnimationFrame((t) => this.frame(t));
  },
  bindInput() {
    const cv = this.cv;
    let down = null, pinch = null;
    const pick = (x, y) => (this.battle ? this.iso.pick(x, y, this.battle) : null);
    // di HP browser memalsukan mousedown/mouseup setelah tap -> abaikan supaya 1 tap = 1 klik
    let lastTouch = -1e9;
    const fromTouch = () => performance.now() - lastTouch < 900;
    cv.addEventListener('mousedown', (e) => {
      if (fromTouch()) return;
      SFX.init();
      down = { x: e.clientX, y: e.clientY, b: e.button, drag: false, lx: e.clientX, ly: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.battle || fromTouch()) return;
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.drag && Math.hypot(dx, dy) > 6) down.drag = true;
        if (down.drag) { this.iso.panScreen(down.lx - e.clientX, down.ly - e.clientY, true); down.lx = e.clientX; down.ly = e.clientY; }
      } else if (e.target === cv) {
        const pk = pick(e.clientX, e.clientY);
        this.iso.hover = pk ? pk.tile : null;
        this.battle.hover(pk ? pk.tile : null, pk ? pk.unit : null);
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (!down) return;
      const d = down; down = null;
      if (!this.battle || d.drag || e.target !== cv) return;
      if (d.b === 2) { this.battle.cancel(); return; }
      if (d.b === 0) { const pk = pick(e.clientX, e.clientY); this.battle.click(pk ? pk.tile : null, pk ? pk.unit : null); }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const cam = this.iso.cam;
      cam.tz = U.clamp(cam.tz * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.5, 2.4);
    }, { passive: false });
    // sentuh
    cv.addEventListener('touchstart', (e) => {
      SFX.init(); lastTouch = performance.now();
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: this.iso.cam.tz };
        down = null; return;
      }
      const t = e.touches[0];
      down = { x: t.clientX, y: t.clientY, b: 0, drag: false, touch: true, lx: t.clientX, ly: t.clientY, px: t.clientX, py: t.clientY };
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (pinch && e.touches.length === 2) {
        const [a, b] = e.touches;
        this.iso.cam.tz = U.clamp(pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d, 0.5, 2.4);
        return;
      }
      if (!down) return;
      const t = e.touches[0], dx = t.clientX - down.x, dy = t.clientY - down.y;
      down.lx = t.clientX; down.ly = t.clientY;
      if (!down.drag && Math.hypot(dx, dy) > 10) down.drag = true;
      if (down.drag) { this.iso.panScreen(down.px - t.clientX, down.py - t.clientY, true); }
      down.px = t.clientX; down.py = t.clientY;
    }, { passive: false });
    cv.addEventListener('touchend', (e) => {
      lastTouch = performance.now();
      if (e.cancelable) e.preventDefault();
      if (pinch) { if (!e.touches.length) pinch = null; down = null; return; }
      if (!down) return;
      const d = down; down = null;
      if (!this.battle || d.drag) return;
      const pk = pick(d.lx, d.ly);
      this.iso.hover = pk ? pk.tile : null;
      this.battle.hover(pk ? pk.tile : null, pk ? pk.unit : null);
      this.battle.click(pk ? pk.tile : null, pk ? pk.unit : null);
    });
    cv.addEventListener('touchcancel', () => { down = null; pinch = null; });
    const cineCv = document.getElementById('cine');
    cineCv.addEventListener('mousedown', () => { if (!fromTouch()) this.cine.fast = true; });
    cineCv.addEventListener('dblclick', () => { if (!fromTouch()) this.cine.doSkip(); });
    cineCv.addEventListener('touchstart', (e) => {
      lastTouch = performance.now();
      if (e.cancelable) e.preventDefault();
      if (this.cine.fast) this.cine.doSkip(); else this.cine.fast = true;
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  },
  rotate(dir) {
    if (!this.battle) return;
    this.iso.rotate(dir);
    SFX.play('ui');
  },
  key(e) {
    SFX.init();
    const k = e.key.toLowerCase();
    if (this.cine.active) {
      if (k === ' ' || k === 'escape' || k === 'enter') { this.cine.doSkip(); e.preventDefault(); }
      return;
    }
    if (UI.modalOpen()) { if (k === 'escape') UI.closeModal(); return; }
    const B = this.battle;
    if (!B) return;
    if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) { this.keys.add(k); e.preventDefault(); return; }
    if (k === 'escape') { if (B.mode !== 'idle') B.cancel(); else UI.battleMenu(); }
    else if (k === 'q') this.rotate(-1);
    else if (k === 'e') this.rotate(1);
    else if (k === 't') B.endPlayerTurn();
    else if (k === 'tab') { e.preventDefault(); B.cycleUnit(); }
    else if (k === 'enter' && B.mode === 'confirm') B.confirmAttack();
  },
};

// ---------- uji otomatis (buka index.html#autotest) ----------
async function runAutoTest() {
  const errs = [], out = [];
  window.addEventListener('error', (e) => errs.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errs.push('rej: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason)));
  SFX.on = false;
  Game.settings.cine = false;
  try {
    UI.title(); UI.briefing(0); UI.hangar(0); UI.hangarView.render(0.016); UI.help(); UI.closeModal(); UI.settings(); UI.closeModal();
    drawMapPreview(UI.mapPrev ? UI.mapPrev.cv : document.createElement('canvas'), genMap(MISSIONS[0]));
  } catch (e) { errs.push('ui: ' + e.stack); }
  Time.speed = 1000;
  Game.save = newSave();
  for (let mi = 0; mi < MISSIONS.length; mi++) {
    try {
      ensureJoined(mi);
      const B = new Battle(mi, true);
      Game.battle = B;
      const r = await B.start();
      out.push(r);
      Game.iso.render(B);
    } catch (e) { errs.push('m' + mi + ': ' + e.stack); }
  }
  // uji sinematik dengan menggerakkan update secara manual
  try {
    ensureJoined(4);
    const B = new Battle(4, true);
    Game.battle = B;
    Game.iso.setMap(B.map);
    const a = B.alive('P')[0], d = B.alive('E')[0];
    d.x = a.x - 1; d.y = a.y; a.ap = 12; d.ap = 12;
    const ws = Combat.weaponsOf(a)[0];
    const evs = Combat.engage(B, a, d, ws, true);
    let done = false;
    Game.cine.play(evs, B).then(() => { done = true; });
    for (let i = 0; i < 4000 && !done; i++) { Game.cine.update(0.02); Game.cine.render(); await new Promise((r) => setTimeout(r, 0)); }
    out.push({ cine: done, events: evs.length });
    HUD.showUnit(a, B); HUD.preview(B, a, d, ws); HUD.actions(B, a);
    // sinematik jarak dekat & sniper (senjata 2 tangan) + animasi ayunan di peta
    for (const wid of ['hammer', 'blade', 'knuckle', 'pile', 'rod', 'falcon', 'thunder']) {
      const b = B.alive('E').find((u) => u !== d) || d;
      a.r = wid; a.l = 'none'; a.W = { rarm: upWeapon(wid, 2), larm: upWeapon('none'), sh: a.W.sh };
      a.parts = { ...a.max }; a.dead = false; b.parts = { ...b.max }; b.dead = false; a.ap = 12; b.ap = 12;
      const mel = WEAPONS[wid].type === 'MELEE';
      b.x = mel ? (a.x + 1 < B.map.W ? a.x + 1 : a.x - 1) : a.x;
      b.y = mel ? a.y : a.y + 4 < B.map.H ? a.y + 4 : a.y - 4;
      const ws2 = Combat.weaponsOf(a)[0];
      if (Combat.grip(a, ws2.w) !== (TWO_HAND.includes(ws2.w.type) ? GRIP_BONUS : 0)) errs.push('grip ' + wid);
      HUD.preview(B, a, b, ws2);
      const ev2 = [Combat.attack(B, a, b, ws2, null)];
      let ok = false;
      Game.cine.play(ev2, B).then(() => { ok = true; });
      for (let i = 0; i < 4000 && !ok; i++) { Game.cine.update(0.02); Game.cine.render(); await new Promise((r) => setTimeout(r, 0)); }
      out.push({ cine: wid, done: ok });
      await B.quickFX([Combat.attack(B, a, b, ws2, null)]);
      Game.iso.render(B);
    }
    // grip: sniper + perisai harus -15
    a.r = 'falcon'; a.l = 'aegis'; a.W = { rarm: upWeapon('falcon'), larm: upWeapon('aegis'), sh: a.W.sh };
    if (Combat.grip(a, a.W.rarm) !== -GRIP_PEN) errs.push('grip penalty');
  } catch (e) { errs.push('cine: ' + e.stack); }
  // uji upgrade per barang: level ikut barang saat dilepas / dipasang ke robot lain
  try {
    Game.save = newSave(); ensureJoined(0);
    const s = Game.save;
    s.lv.raka = { r: 2 };
    equipItem('raka', 'r', 'none', 0);
    if (JSON.stringify(spareLevels('viper')) !== '{"2":1}') errs.push('spare ' + JSON.stringify(spareLevels('viper')));
    equipItem('laras', 'l', 'viper', 2);
    if (slotLv('laras', 'l') !== 2 || (s.spareLv.viper || []).length) errs.push('equip lv');
    if (JSON.stringify(spareLevels('viper')) !== '{"0":1}') errs.push('spare2 ' + JSON.stringify(spareLevels('viper')));
    const u = makeUnit({ team: 'P', pilot: s.pilots[3], load: s.load.laras, lv: s.lv.laras, ...pilotLook('laras'), name: 'x' });
    if (u.W.larm.dmg !== upWeapon('viper', 2).dmg || u.W.rarm.lv !== 0) errs.push('unit lv');
    const m = { v: 2, up: { viper: 1 }, inv: { viper: 3 }, joined: ['raka'], load: { raka: { frame: 'vanguard', r: 'viper', l: 'viper', sh: 'none', bp: 'none' } } };
    migrateSave(m);
    if (m.lv.raka.r !== 1 || m.lv.raka.l !== 1 || m.spareLv.viper.join() !== '1') errs.push('migrate ' + JSON.stringify(m));
  } catch (e) { errs.push('upg: ' + e.stack); }
  // sentuh: 1 tap pada unit = pilih (mode move), klik mouse palsu dari browser sesudahnya diabaikan
  try {
    const B = new Battle(0);
    Game.battle = B; Game.iso.setMap(B.map); HUD.show(B);
    B.phase = 'P'; B.busy = false; B.mode = 'idle';
    const u = B.alive('P')[0], iso = Game.iso, c = iso.center(), p = isoP(u.x, u.y, u.rh);
    let pt = null;
    for (let dy = -40; dy <= 10 && !pt; dy += 2) {
      const sx = (p.x - c.x) * iso.cam.z + iso.W / 2, sy = (p.y + dy - c.y) * iso.cam.z + iso.H / 2, pk = iso.pick(sx, sy, B);
      if (pk && (pk.unit === u || (pk.tile && pk.tile.x === u.x && pk.tile.y === u.y))) pt = { x: sx, y: sy };
    }
    if (!pt) errs.push('touch: titik unit tidak ketemu');
    else {
      const cv = Game.cv, T = () => [new Touch({ identifier: 1, target: cv, clientX: pt.x, clientY: pt.y })];
      cv.dispatchEvent(new TouchEvent('touchstart', { touches: T(), changedTouches: T(), bubbles: true, cancelable: true }));
      cv.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: T(), bubbles: true, cancelable: true }));
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: pt.x, clientY: pt.y, button: 0, bubbles: true }));
      cv.dispatchEvent(new MouseEvent('mouseup', { clientX: pt.x, clientY: pt.y, button: 0, bubbles: true }));
      out.push({ touch: B.mode, sel: B.sel === u });
      if (B.mode !== 'move' || B.sel !== u) errs.push('touch: 1 tap harus memilih unit, mode=' + B.mode);
    }
    B.over = true; HUD.hide();
  } catch (e) { errs.push('touch: ' + e.stack); }
  Game.battle = null;
  const pre = document.createElement('pre');
  pre.id = 'testout';
  pre.textContent = JSON.stringify({ out, errs });
  document.body.appendChild(pre);
}

// ---------- uji keseimbangan: #bal (opsi: old = loadout musuh lama, up = upgrade +n sesuai stage) ----------
async function runBalance(opt) {
  SFX.on = false; Game.settings.cine = false; Time.speed = 1000;
  if (opt.includes('old')) { ENEMY_T.sniper.l = 'viper'; ENEMY_T.sniper.bp = 'none'; ENEMY_T.grenadier.l = 'aegis'; TWO_HAND.length = 0; }
  const res = {};
  for (let mi = 0; mi < MISSIONS.length; mi++) {
    let w = 0;
    for (let n = 0; n < 10; n++) {
      Game.save = newSave();
      for (let i = 0; i <= mi; i++) ensureJoined(i);
      if (opt.includes('up')) for (const pid of Game.save.joined) Game.save.lv[pid] = { frame: mi, r: mi, l: mi, sh: mi };
      const B = new Battle(mi, true); Game.battle = B;
      const r = await B.start(); if (r.win) w++;
    }
    res['m' + mi] = w + '/10';
  }
  const pre = document.createElement('pre'); pre.id = 'testout'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
}

// ---------- hook dev untuk screenshot ----------
function devHook(what) {
  Game.save = newSave();
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.appendChild(st);
  if (what === 'battle') { Game.startBattle(+(location.search.slice(1) || 0)); }
  else if (what === 'hangar') UI.hangar(0);
  else if (what === 'shop') { Game.save.cat.push(...MISSIONS[0].unlock); Game.save.fresh = MISSIONS[0].unlock.slice(); UI.hangar(0); document.querySelector('[data-t=shop]').click(); }
  else if (what === 'equip') { UI.hangar(0); document.querySelector('[data-slot=l]').click(); }
  else if (what === 'rot90') { Game.startBattle(0); Game.iso.rotate(1); setView(Game.iso.rotT); }
  else if (what === 'rot') { Game.startBattle(2); setTimeout(() => Game.rotate(1), 1500); setTimeout(() => Game.iso.focus(6, 6, 0), 1500); }
  else if (what === 'arms') {
    const pl = { name: '', lvl: 1 };
    const ids = Object.keys(WEAPONS).filter((k) => k !== 'none');
    const list = ids.map((id, i) => {
      const w = WEAPONS[id];
      const L = { frame: 'vanguard', r: w.type === 'MSL' ? 'viper' : id, l: 'none', sh: w.type === 'MSL' ? id : 'none', bp: ['sensor', 'ammo', 'booster', 'repair'][i % 4] };
      return makeUnit({ team: 'P', pilot: pl, load: L, ...pilotLook('raka'), name: w.name });
    });
    Game.scene = { t: 0, render(dt) {
      const iso = Game.iso, c = iso.ctx; this.t += dt;
      c.setTransform(iso.dpr, 0, 0, iso.dpr, 0, 0);
      c.fillStyle = '#0d1520'; c.fillRect(0, 0, iso.W, iso.H);
      const cols = 7, cw = iso.W / cols, rh = iso.H / 4;
      list.forEach((u, i) => {
        const x = cw * (i % cols) + cw * 0.3, y = rh * (Math.floor(i / cols) + 1) - 18;
        drawMech(c, u, x, y, Math.min(cw / 110, rh / 100), 1, { t: this.t });
        c.fillStyle = '#cfd8e0'; c.font = `600 11px ${FONT}`; c.textAlign = 'center'; c.fillText(u.name, cw * (i % cols) + cw / 2, y + 13);
      });
    } };
  }
  else if (what === 'upg') {
    const s = Game.save; s.cleared = [0, 1]; s.credits = 20000; s.lv = { laras: { frame: 1, r: 2 }, raka: { frame: 2 } }; s.spareLv = { vanguard: [1] };
    ensureJoined(0); addItem('vanguard'); addItem('falcon'); addItem('blade'); s.load.laras.l = 'none'; s.load.laras.r = 'falcon'; s.load.raka.r = 'blade';
    UI.hangar(0);
    if (location.search === '?eq') document.querySelector('[data-slot=frame]').click();
    else { document.querySelectorAll('.hg-pc')[3].click(); document.querySelector('[data-t=upg]').click(); }
  }
  else if (what === 'swing') {
    // pose: ayunan senjata jarak dekat di berbagai fase + pegangan 2 tangan
    const pl = { name: '', lvl: 1 };
    const rows = [];
    for (const id of ['blade', 'hammer', 'rod', 'knuckle', 'pile']) for (const k of [0, 0.4, 0.5, 0.56, 0.75]) rows.push({ L: { frame: 'vanguard', r: id, l: 'none', sh: 'none', bp: 'none' }, sw: { side: 'rarm', k }, nm: `${id} k=${k}` });
    for (const id of ['falcon', 'railspike', 'thunder', 'hailstorm']) rows.push({ L: { frame: 'kestrel', r: id, l: 'none', sh: 'none', bp: 'none' }, nm: id + ' 2T' });
    rows.push({ L: { frame: 'vanguard', r: 'falcon', l: 'aegis', sh: 'none', bp: 'none' }, nm: 'falcon+aegis' });
    rows.push({ L: { frame: 'goliath', r: 'none', l: 'thunder', sh: 'none', bp: 'none' }, nm: 'L thunder 2T' });
    rows.push({ L: { frame: 'wisp', r: 'blade', l: 'none', sh: 'none', bp: 'none' }, nm: 'wisp blade', sw: { side: 'rarm', k: 0.42 } });
    rows.push({ L: { frame: 'kestrel', r: 'cyclone', l: 'blade', sh: 'none', bp: 'none' }, nm: 'L blade', sw: { side: 'larm', k: 0.5 } });
    rows.push({ L: { frame: 'vanguard', r: 'falcon', l: 'none', sh: 'none', bp: 'none' }, nm: 'falcon low', aim: { rarm: 0, larm: 0 } });
    const list = rows.map((r) => ({ ...r, u: makeUnit({ team: 'P', pilot: pl, load: r.L, ...pilotLook('raka'), name: r.nm }) }));
    Game.scene = { t: 0, render(dt) {
      const iso = Game.iso, c = iso.ctx; this.t += dt;
      c.setTransform(iso.dpr, 0, 0, iso.dpr, 0, 0);
      c.fillStyle = '#0d1520'; c.fillRect(0, 0, iso.W, iso.H);
      const cols = 6, cw = iso.W / cols, rh = iso.H / 6;
      list.forEach((r, i) => {
        const x = cw * (i % cols) + cw * 0.3, y = rh * (Math.floor(i / cols) + 1) - 16;
        drawMech(c, r.u, x, y, Math.min(cw / 130, rh / 105), 1, { t: this.t, swing: r.sw, aim: r.aim });
        c.fillStyle = '#cfd8e0'; c.font = `600 11px ${FONT}`; c.textAlign = 'center'; c.fillText(r.nm, cw * (i % cols) + cw / 2, y + 12);
      });
    } };
  }
  else if (what === 'cinef') {
    // bekukan sinematik pada langkah ke-N (langkah 20 ms): ?senjata,N#dev=cinef
    const [wid, nStr] = location.search.slice(1).split(',');
    const B = new Battle(1, true);
    Game.battle = B; Game.iso.setMap(B.map);
    const a = B.alive('P')[0], d = B.alive('E')[0], mel = WEAPONS[wid].type === 'MELEE';
    a.r = wid; a.l = 'none'; a.W = { rarm: upWeapon(wid, 2), larm: upWeapon('none'), sh: a.W.sh };
    d.x = a.x; d.y = a.y + (mel ? 1 : 4) < B.map.H ? a.y + (mel ? 1 : 4) : a.y - (mel ? 1 : 4); a.ap = 12; d.ap = 0;
    const ws = Combat.weaponsOf(a)[0];
    let ev; for (let i = 0; i < 30; i++) { const bk = { ...d.parts }; ev = Combat.attack(B, a, d, ws, null); if (ev.volleys[0][0].part) break; d.parts = bk; d.dead = false; }
    const cine = Game.cine, upd = cine.update.bind(cine);
    cine.update = () => {};
    cine.play([ev], B);
    (async () => { for (let i = 0; i < +nStr; i++) { upd(0.02); await new Promise((r) => setTimeout(r, 0)); } })();
  }
  else if (what === 'cinemelee' || what === 'cinesnipe') {
    const B = new Battle(1, true);
    Game.battle = B; Game.iso.setMap(B.map);
    const a = B.alive('P')[0], d = B.alive('E')[0];
    a.r = what === 'cinemelee' ? (location.search.slice(1) || 'hammer') : 'falcon'; a.l = 'none'; a.W = { rarm: upWeapon(a.r, 2), larm: upWeapon('none'), sh: upWeapon(a.sh) };
    d.x = a.x - (what === 'cinemelee' ? 1 : 4); d.y = a.y; a.ap = 12; d.ap = 0;
    const evs = Combat.engage(B, a, d, Combat.weaponsOf(a)[0], false);
    Game.cine.play(evs, B);
  }
  else if (what === 'gallery') {
    const pl = { name: '', lvl: 1 };
    const list = PILOTS.map((p) => makeUnit({ team: 'P', pilot: pl, load: p.load, ...pilotLook(p.id), name: p.call }))
      .concat(Object.keys(ENEMY_T).map((k) => makeUnit({ team: 'E', pilot: pl, load: ENEMY_T[k], ...enemyLook(ENEMY_T[k]), name: ENEMY_T[k].name })));
    list[1].recoil = { rarm: 0 };
    Game.scene = { t: 0, render(dt) {
      const iso = Game.iso, c = iso.ctx; this.t += dt;
      c.setTransform(iso.dpr, 0, 0, iso.dpr, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, iso.H); g.addColorStop(0, '#1a2a3a'); g.addColorStop(1, '#06090d');
      c.fillStyle = g; c.fillRect(0, 0, iso.W, iso.H);
      const cols = 7, cw = iso.W / cols, rh = iso.H / 2;
      list.forEach((u, i) => {
        const x = cw * (i % cols) + cw * 0.38, y = rh * (Math.floor(i / cols) + 1) - 30;
        drawMech(c, u, x, y, Math.min(cw / 95, rh / 120), u.team === 'P' ? 1 : -1, { t: this.t });
        c.fillStyle = '#cfd8e0'; c.font = `600 12px ${FONT}`; c.textAlign = 'center'; c.fillText(u.name + ' · ' + u.frame.name, cw * (i % cols) + cw / 2, y + 22);
      });
    } };
  }
  else if (what === 'bsel' || what === 'bact' || what === 'bprev') {
    // posisi HUD di HP: unit terpilih / menu aksi / preview serangan
    Game.startBattle(0);
    setTimeout(() => {
      const B = Game.battle, u = B.alive('P')[0], d = B.alive('E')[0];
      B.phase = 'P'; B.busy = false;
      if (what === 'bprev') {
        const ws = Combat.weaponsOf(u)[0];
        for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1]]) {
          const x = u.x + dx, y = u.y + dy;
          if (!B.map.T[y] || !B.map.T[y][x] || TERRAIN[B.map.T[y][x].t].block || B.unitAt(x, y)) continue;
          B.place(d, x, y); B.sel = u; B.ws = ws; B.showTargets();
          if (B.targets.includes(d)) break;
        }
        B.sel = u; HUD.showUnit(u, B); B.mode = 'target'; B.previewAttack(d);
      } else {
        B.select(u);
        if (what === 'bact') B.openActions();
      }
    }, 2500);
  }
  else if (what === 'brief') UI.briefing(1);
  else if (what === 'cine') {
    const B = new Battle(3, true);
    Game.battle = B; Game.iso.setMap(B.map);
    const a = B.alive('P')[0], d = B.alive('E')[0];
    d.x = a.x - 2; d.y = a.y; a.ap = 12; d.ap = 12;
    const evs = Combat.engage(B, a, d, Combat.weaponsOf(a)[0], true);
    Game.cine.play(evs, B);
  } else UI.title();
}

window.addEventListener('load', () => Game.init());
