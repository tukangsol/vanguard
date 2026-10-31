'use strict';
// ================= LAYAR MENU, BRIEFING, HANGAR, HASIL =================
const SAVE_KEY = 'steelvanguard_save_v1';
const SET_KEY = 'steelvanguard_settings_v1';

const SLOT_KEYS = ['frame', 'r', 'l', 'sh', 'bp'];
const START_CAT = ['wisp', 'vanguard', 'wasp', 'viper', 'hornet', 'breaker', 'longbow', 'knuckle', 'buckler', 'aegis', 'sparrow', 'repair', 'booster'];
function newSave() {
  return {
    v: 2, mission: 0, credits: 3000, started: true, done: false, cleared: [], fresh: [],
    cat: START_CAT.slice(), inv: {}, joined: [], lv: {}, spareLv: {},
    pilots: PILOTS.map((p) => ({ id: p.id, name: p.name, call: p.call, skill: p.skill, join: p.join, lvl: 1, xp: 0, acc: p.acc, eva: p.eva })),
    load: Object.fromEntries(PILOTS.map((p) => [p.id, { ...p.load }])),
  };
}
// ---------- inventaris berjumlah ----------
function addItem(id, n = 1) { if (id && id !== 'none') Game.save.inv[id] = (Game.save.inv[id] || 0) + n; }
function invCount(id) { return id === 'none' ? Infinity : Game.save.inv[id] || 0; }
function usedCount(id, exPilot, exSlot) {
  const s = Game.save;
  let n = 0;
  for (const pid of s.joined) { const L = s.load[pid]; for (const k of SLOT_KEYS) if (L[k] === id && !(pid === exPilot && k === exSlot)) n++; }
  return n;
}
function freeCount(id, exPilot, exSlot) { return invCount(id) - usedCount(id, exPilot, exSlot); }
function ensureJoined(mi) {
  const s = Game.save;
  for (const p of s.pilots) if (p.join <= mi && !s.joined.includes(p.id)) {
    s.joined.push(p.id);
    const L = s.load[p.id];
    for (const k of SLOT_KEYS) addItem(L[k]);
  }
}
function migrateSave(s) {
  if (!s.lv) s.lv = {};
  if (!s.spareLv) s.spareLv = {};
  if (s.up) { // upgrade lama per jenis -> dipindah ke tiap barang
    for (const id in s.up) {
      const lv = s.up[id];
      if (!lv) continue;
      let used = 0;
      for (const pid of s.joined || []) for (const k of SLOT_KEYS) if (s.load[pid][k] === id) { (s.lv[pid] = s.lv[pid] || {})[k] = lv; used++; }
      for (let i = used; i < (s.inv[id] || 0); i++) (s.spareLv[id] = s.spareLv[id] || []).push(lv);
    }
    delete s.up;
  }
  if (s.v === 2) return s;
  const old = s.owned || [];
  s.v = 2; s.inv = {}; s.joined = []; s.fresh = [];
  s.cleared = []; for (let i = 0; i < s.mission; i++) s.cleared.push(i);
  s.cat = Array.from(new Set([...(s.cat || []), ...START_CAT, ...old.filter((id) => id !== 'none')]));
  const prev = Game.save; Game.save = s;
  ensureJoined(s.mission);
  for (const id of old) if (id !== 'none' && !s.inv[id]) s.inv[id] = 1;
  Game.save = prev;
  delete s.owned;
  return s;
}
const SHOP_CATS = [
  ['FRAME', (id) => !!FRAMES[id]],
  ['SMG & SENAPAN MESIN', (id) => ['SMG', 'MG'].includes(wType(id))],
  ['SHOTGUN & PELONTAR API', (id) => ['SG', 'FL'].includes(wType(id))],
  ['RIFLE & SNIPER', (id) => ['RF', 'SR'].includes(wType(id))],
  ['SENJATA LEDAKAN', (id) => ['BZ', 'GL'].includes(wType(id))],
  ['JARAK DEKAT', (id) => wType(id) === 'MELEE'],
  ['PERISAI', (id) => wType(id) === 'SHIELD'],
  ['SENJATA BAHU', (id) => wType(id) === 'MSL'],
  ['RANSEL', (id) => itemKind(id) === 'bp'],
];
// ---------- upgrade per barang ----------
// level barang terpasang: save.lv[pilot][slot]; level barang cadangan (tidak terpasang): save.spareLv[id] = [level>0, ...]
function upCap() { return Math.min(UP_MAX, Game.save.cleared.length); }
function slotLv(pid, k) { return (Game.save.lv[pid] && Game.save.lv[pid][k]) || 0; }
function lvItem(id, lv = 0) { return itemKind(id) === 'bp' ? BACKPACKS[id] : upItem(id, lv); }
function fpow(id, lv = 0) { return upFrame(id, lv).power; }
// jumlah cadangan per level: { 0: n, 2: n, ... }
function spareLevels(id) {
  const s = Game.save, up = s.spareLv[id] || [], out = {};
  const zero = freeCount(id) - up.length;
  if (zero > 0) out[0] = zero;
  for (const l of up) out[l] = (out[l] || 0) + 1;
  return out;
}
// pasang barang (dengan level tertentu) ke slot robot; barang lama kembali ke gudang beserta levelnya
function equipItem(pid, k, id, lv) {
  const s = Game.save, L = s.load[pid], LV = s.lv[pid] || (s.lv[pid] = {});
  const old = L[k], oldLv = LV[k] || 0;
  if (id !== 'none' && lv > 0) { const a = s.spareLv[id] || [], i = a.indexOf(lv); if (i >= 0) a.splice(i, 1); }
  if (old !== 'none' && oldLv > 0) (s.spareLv[old] = s.spareLv[old] || []).push(oldLv);
  L[k] = id; LV[k] = id === 'none' ? 0 : lv;
}
function upSpent(id, lv) { let t = 0; for (let i = 1; i <= lv; i++) t += upCost(id, i); return t; }
function wType(id) { return WEAPONS[id] && !FRAMES[id] ? WEAPONS[id].type : null; }

// ---------- Scene judul (latar kanvas) ----------
class TitleScene {
  constructor() {
    this.t = 0; this.theme = 'desert'; this.bg = null; this.fx = new FXSys(); this.amb = new Ambient('ember', 90);
    const pl = { name: '', lvl: 1 };
    this.hero = makeUnit({ team: 'P', pilot: pl, load: PILOTS[0].load, ...pilotLook('raka'), name: '' });
    this.ally = makeUnit({ team: 'P', pilot: pl, load: PILOTS[3].load, ...pilotLook('laras'), name: '' });
    this.foes = ['brawler', 'gunner', 'heavy'].map((k) => makeUnit({ team: 'E', pilot: pl, load: ENEMY_T[k], ...enemyLook(ENEMY_T[k]), name: '' }));
    this.foes.forEach((f) => { f.colors = teamColors('#2a1a1c', '#3a2a2a', '#ff4a3a', '#1c1214'); });
    this.nextBoom = 1.5;
  }
  render(dt) {
    const iso = Game.iso, c = iso.ctx, W = iso.W, H = iso.H;
    this.t += dt;
    if (!this.bg || this.bgW !== W || this.bgH !== H) { this.bg = makeBackdrop(W, H, this.theme, iso.dpr); this.bgW = W; this.bgH = H; }
    c.setTransform(iso.dpr, 0, 0, iso.dpr, 0, 0);
    c.drawImage(this.bg, 0, 0, W, H);
    const hz = H * 0.6;
    this.nextBoom -= dt;
    if (this.nextBoom <= 0) { this.nextBoom = U.rf(1.2, 3.2); this.fx.explode(W * U.rf(0.35, 0.95), hz - U.rf(0, 10), 0.6, 0.8); }
    this.foes.forEach((f, i) => {
      c.globalAlpha = 0.85;
      drawMech(c, f, W * (0.42 + i * 0.07), hz + 6 + i * 3, H * 0.0011, -1, { bob: Math.sin(this.t * 2 + i) * 0.5, t: this.t });
    });
    c.globalAlpha = 1;
    this.fx.update(dt); this.fx.draw(c);
    this.amb.update(dt); this.amb.draw(c, W, H);
    const s = Math.min(H * 0.0058, W * 0.0042);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(W * 0.6, H * 0.935, 40 * s * 0.8, 6 * s, 0, 0, 6.28); c.fill();
    drawMech(c, this.ally, W * 0.6, H * 0.93, s * 0.8, -1, { bob: Math.sin(this.t * 1.5 + 1) * 1, t: this.t });
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(W * 0.8, H * 1.0, 44 * s, 7 * s, 0, 0, 6.28); c.fill();
    drawMech(c, this.hero, W * 0.8, H * 0.995, s, -1, { bob: Math.sin(this.t * 1.5) * 1.2, t: this.t });
    const g = c.createLinearGradient(0, H * 0.75, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = g; c.fillRect(0, H * 0.75, W, H * 0.25);
  }
}

// ---------- Pratinjau mecha di hangar ----------
class HangarView {
  constructor(cv) { this.cv = cv; this.t = 0; this.unit = null; }
  render(dt) {
    const cv = this.cv;
    if (!cv.isConnected || !this.unit) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(50, Math.round(r.width)), H = Math.max(50, Math.round(r.height));
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.t += dt;
    let g = c.createRadialGradient(W / 2, H * 0.6, 20, W / 2, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#15263a'); g.addColorStop(1, '#04070b');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const fy = H * 0.84;
    c.strokeStyle = 'rgba(95,212,255,0.09)'; c.lineWidth = 1;
    for (let i = -16; i <= 16; i++) { c.beginPath(); c.moveTo(W / 2 + i * 14, fy); c.lineTo(W / 2 + i * 70, H); c.stroke(); }
    for (let k = 0; k < 6; k++) { const y = fy + (H - fy) * Math.pow(k / 6, 1.6); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.font = `700 ${Math.round(H * 0.22)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillText(this.unit.frame.name.toUpperCase(), W / 2, H * 0.36);
    const s = Math.min(H / 112, W / 160);
    g = c.createRadialGradient(W / 2, fy, 0, W / 2, fy, 70 * s);
    g.addColorStop(0, 'rgba(95,212,255,0.35)'); g.addColorStop(1, 'rgba(95,212,255,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(W / 2, fy, 70 * s, 14 * s, 0, 0, 6.28); c.fill();
    c.strokeStyle = 'rgba(95,212,255,0.5)'; c.beginPath(); c.ellipse(W / 2, fy, 52 * s, 10 * s, 0, 0, 6.28); c.stroke();
    drawMech(c, this.unit, W / 2 - 22 * s, fy, s, 1, { bob: Math.sin(this.t * 1.6) * 1.2, t: this.t });
    const sy = ((this.t * 0.3) % 1) * H;
    g = c.createLinearGradient(0, sy - 30, 0, sy);
    g.addColorStop(0, 'rgba(95,212,255,0)'); g.addColorStop(1, 'rgba(95,212,255,0.12)');
    c.fillStyle = g; c.fillRect(0, sy - 30, W, 30);
    c.strokeStyle = 'rgba(255,180,60,0.7)'; c.lineWidth = 2;
    const b = 18;
    [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]].forEach(([x, y, dx, dy]) => { c.beginPath(); c.moveTo(x, y + dy * b); c.lineTo(x, y); c.lineTo(x + dx * b, y); c.stroke(); });
    c.fillStyle = '#7f909e'; c.font = `500 11px ${FONT}`; c.textAlign = 'left';
    c.fillText(`FRAME ${this.unit.frame.cls} · DAYA ${this.unit.frame.power}`, 18, 24);
  }
}

const UI = {
  hangarView: null, mapPrev: null,
  set(html, cls) {
    const s = document.getElementById('screen');
    s.innerHTML = `<div class="scr ${cls}">${html}</div>`;
    this.hangarView = null; this.mapPrev = null;
    return s.firstElementChild;
  },
  clear() { document.getElementById('screen').innerHTML = ''; this.hangarView = null; this.mapPrev = null; },
  toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 'tst ' + type; t.textContent = msg;
    document.getElementById('toast').appendChild(t);
    setTimeout(() => t.remove(), 2400);
  },
  modal(html) {
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="md-box panel">${html}</div>`;
    m.classList.remove('hidden');
    m.onclick = (e) => { if (e.target === m) this.closeModal(); };
    return m.firstElementChild;
  },
  closeModal() { const m = document.getElementById('modal'); m.classList.add('hidden'); m.innerHTML = ''; },
  modalOpen() { return !document.getElementById('modal').classList.contains('hidden'); },
  confirm(title, msg) {
    return new Promise((res) => {
      const b = this.modal(`<h2>${title}</h2><p>${msg}</p><div class="md-btns"><button class="btn" data-a="n">BATAL</button><button class="btn primary" data-a="y">YA</button></div>`);
      b.querySelector('[data-a=y]').onclick = () => { this.closeModal(); res(true); };
      b.querySelector('[data-a=n]').onclick = () => { this.closeModal(); res(false); };
    });
  },
  bind(el, map) { el.querySelectorAll('[data-a]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); SFX.init(); SFX.play('ui'); const f = map[b.dataset.a]; if (f) f(b); }; }); },

  // ----- JUDUL -----
  title() {
    Game.stopBattle();
    const s = Game.save, has = !!(s && s.started);
    const el = this.set(`
      <div class="tt-logo">
        <div class="tt-pre">TACTICAL MECHA WARFARE</div>
        <h1 class="tt-h"><span>STEEL</span><em>VANGUARD</em></h1>
        <div class="tt-sub">SKUADRON GARUDA · PERANG PERBATASAN 2091</div>
      </div>
      <div class="tt-menu">
        ${has ? `<button class="btn primary" data-a="cont">LANJUTKAN<small>${s.done ? 'KAMPANYE SELESAI' : MISSIONS[s.mission].code + ' · ' + MISSIONS[s.mission].name}</small></button>` : ''}
        <button class="btn ${has ? '' : 'primary'}" data-a="new">KAMPANYE BARU</button>
        <button class="btn" data-a="help">CARA BERMAIN</button>
        <button class="btn" data-a="set">PENGATURAN</button>
      </div>
      <div class="tt-foot">TERINSPIRASI GAME TAKTIK MECHA KLASIK · 100% HTML5 CANVAS · TANPA ASET EKSTERNAL</div>`, 'title');
    this.bind(el, {
      cont: () => (s.done ? this.ending() : this.briefing(s.mission)),
      new: async () => {
        if (has && !(await this.confirm('KAMPANYE BARU', 'Progres kampanye yang tersimpan akan dihapus. Lanjutkan?'))) return;
        Game.save = newSave(); Game.persist(); this.briefing(0);
      },
      help: () => this.help(),
      set: () => this.settings(),
    });
  },

  // ----- BRIEFING -----
  briefing(mi) {
    Game.stopBattle();
    ensureJoined(mi);
    const m = MISSIONS[mi], s = Game.save;
    const counts = {};
    m.enemies.forEach((e) => { counts[e] = (counts[e] || 0) + 1; });
    const squad = s.pilots.filter((p) => p.join <= mi).length;
    const el = this.set(`
      <div class="br-left">
        <div class="br-code">OPERASI ${m.code} · MISI ${mi + 1}/${MISSIONS.length}</div>
        <h1>${m.name}</h1>
        <div class="br-time">${m.time}</div>
        <div class="br-text">${m.brief}</div>
        <div class="br-intel">
          <div><label>MUSUH</label><b>${m.enemies.length} UNIT</b></div>
          <div><label>SKUADRON</label><b>${squad} UNIT</b></div>
          <div><label>HADIAH</label><b>¢ ${U.fmt(m.reward)}</b></div>
        </div>
        ${m.gift && m.gift.length && !s.cleared.includes(mi) ? `<div class="br-en">${m.gift.map((id) => `<span style="border-color:var(--amber);color:var(--amber);background:rgba(255,180,60,.08)">🎁 ${(itemKind(id) === 'bp' ? BACKPACKS[id] : itemInfo(id)).name}</span>`).join('')}</div>` : ''}
        <div class="br-en">${Object.entries(counts).map(([k, n]) => `<span class="${ENEMY_T[k].boss ? 'boss' : ''}">${ENEMY_T[k].boss ? '★ ' : ''}${ENEMY_T[k].name} ×${n}</span>`).join('')}</div>
        <div class="br-btns">
          <button class="btn" data-a="back">◀ JUDUL</button>
          <button class="btn warn" data-a="hangar">HANGAR & TOKO</button>
          <button class="btn primary" data-a="go">MULAI MISI ▶</button>
        </div>
      </div>
      <div class="br-right">
        <div class="br-maplabel">PETA TAKTIS · ${THEMES[m.theme] && m.w}×${m.h}</div>
        <canvas id="brMap"></canvas>
        <div class="br-legend"><span><i style="background:#5fb4ff"></i>POSISI GARUDA</span><span><i style="background:#ff5a4d"></i>POSISI MUSUH</span><span>KEMENANGAN: ${m.boss ? 'HANCURKAN TYRANT' : 'HANCURKAN SEMUA MUSUH'}</span></div>
      </div>`, 'brief');
    const map = genMap(m);
    const cv = el.querySelector('#brMap');
    this.mapPrev = { cv, map };
    this.bind(el, { back: () => this.title(), hangar: () => this.hangar(mi), go: () => Game.startBattle(mi) });
  },

  // ----- HANGAR -----
  hangar(mi) {
    Game.stopBattle();
    ensureJoined(mi);
    const s = Game.save, m = MISSIONS[mi];
    const pilots = s.pilots.filter((p) => p.join <= mi);
    const st = { sel: 0, tab: 'equip', open: null };
    const el = this.set(`
      <div class="hg-top">
        <div class="hg-title">HANGAR<span>${m.code} · ${m.name}</span></div>
        <div class="hg-cred">¢ <b id="hgCred"></b></div>
        <button class="btn sm" data-a="back">◀ BRIEFING</button>
        <button class="btn sm primary" data-a="go">LUNCURKAN ▶</button>
      </div>
      <div class="hg-main">
        <div class="hg-pilots panel" id="hgPilots"></div>
        <div class="hg-center"><canvas id="hgCv"></canvas><div class="hg-stats panel" id="hgStats"></div></div>
        <div class="hg-right panel"><div class="hg-tabs"><button data-t="equip">PERLENGKAPAN</button><button data-t="upg">UPGRADE</button><button data-t="shop">TOKO</button></div><div id="hgList" class="hg-list"></div></div>
      </div>`, 'hangar');
    const view = new HangarView(el.querySelector('#hgCv'));
    this.hangarView = view;
    this.bind(el.querySelector('.hg-top'), { back: () => this.briefing(mi), go: () => Game.startBattle(mi) });
    el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { SFX.play('ui'); st.tab = b.dataset.t; st.open = null; render(); }; });
    if (s.fresh.length) el.querySelector('[data-t=shop]').innerHTML = 'TOKO <i class="new">BARU</i>';

    const SLOTS = [['frame', 'FRAME'], ['r', 'LENGAN KANAN'], ['l', 'LENGAN KIRI'], ['sh', 'BAHU'], ['bp', 'RANSEL']];
    const fits = (slot, id) => {
      if (slot === 'frame') return !!FRAMES[id] && !FRAMES[id].hidden;
      if (id === 'none') return slot !== 'frame';
      if (slot === 'bp') return itemKind(id) === 'bp';
      const w = WEAPONS[id];
      if (!w || FRAMES[id] || itemKind(id) === 'bp') return false;
      return slot === 'sh' ? w.type === 'MSL' : w.type !== 'MSL';
    };
    const optsFor = (slot, cur) => {
      const ids = ['none', ...Object.keys(s.inv).filter((id) => s.inv[id] > 0)];
      if (!ids.includes(cur)) ids.push(cur);
      return ids.filter((id) => fits(slot, id));
    };
    const curPilot = () => pilots[st.sel];
    const render = () => {
      const p = curPilot(), L = s.load[p.id];
      el.querySelector('#hgCred').textContent = U.fmt(s.credits);
      el.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === st.tab));
      const LV = s.lv[p.id] || {};
      view.unit = makeUnit({ team: 'P', pilot: p, load: L, lv: LV, ...pilotLook(p.id), name: p.call });
      el.querySelector('#hgPilots').innerHTML = pilots.map((q, i) => {
        const l = s.load[q.id];
        return `<div class="hg-pc ${i === st.sel ? 'on' : ''}" data-i="${i}"><div class="c1">${q.call}<i>LV ${q.lvl}</i></div><div class="c2">${q.name} · ${PILOTS.find((z) => z.id === q.id).role}</div><div class="c3">${lvItem(l.frame, slotLv(q.id, 'frame')).name} · ${lvItem(l.r, slotLv(q.id, 'r')).name}</div></div>`;
      }).join('');
      el.querySelectorAll('.hg-pc').forEach((d) => { d.onclick = () => { SFX.play('select'); st.sel = +d.dataset.i; st.open = null; render(); }; });
      const f = lvItem(L.frame, LV.frame || 0), wt = weightOf(L);
      const grips = [['r', 'l', 'larm'], ['l', 'r', 'rarm']].map(([k, o]) => {
        const g = gripMod(L[k], L[o]);
        return g ? `<div class="hs-grip ${g > 0 ? 'ok' : 'bad'}">${g > 0 ? '🎯' : '✋'} ${WEAPONS[L[k]].name}: ${g > 0 ? 'pegangan 2 tangan, AKURASI +' + g : 'tangan lain terisi, AKURASI ' + g + ' — kosongkan tangan lain'}</div>` : '';
      }).join('');
      const bar = (v, mx, col) => `<div class="bar"><i style="width:${Math.min(100, (v / mx) * 100)}%;background:${col}"></i></div>`;
      el.querySelector('#hgStats').innerHTML = `
        <div class="hs-row"><span>BADAN</span>${bar(f.body, 340, '#5fe08a')}<b>${f.body}</b></div>
        <div class="hs-row"><span>GERAK</span>${bar(f.move + (BACKPACKS[L.bp].move || 0), 7, '#5fd4ff')}<b>${f.move + (BACKPACKS[L.bp].move || 0)}</b></div>
        <div class="hs-row"><span>LENGAN</span>${bar(f.arm, 175, '#5fe08a')}<b>${f.arm}</b></div>
        <div class="hs-row"><span>LOMPAT</span>${bar(f.jump + (BACKPACKS[L.bp].jump || 0), 4, '#5fd4ff')}<b>${f.jump + (BACKPACKS[L.bp].jump || 0)}</b></div>
        <div class="hs-row"><span>KAKI</span>${bar(f.legs, 230, '#5fe08a')}<b>${f.legs}</b></div>
        <div class="hs-row"><span>EVASI</span>${bar(f.eva + p.eva, 40, '#5fd4ff')}<b>${f.eva + p.eva}</b></div>
        <div class="hs-row hs-full"><span>BOBOT</span>${bar(wt, f.power, wt > f.power ? '#ff5a4d' : '#ffb43c')}<b>${wt}/${f.power}</b></div>
        ${grips}
        <div class="hs-pilot">PILOT <b>${p.name}</b> · LV <b>${p.lvl}</b> · XP ${p.xp}/100 · AKURASI <b>+${p.acc}</b> · EVASI <b>+${p.eva}</b><br>SKILL <span class="skill">${p.skill}</span> — ${SKILLS[p.skill].desc}</div>`;
      const list = el.querySelector('#hgList');
      if (st.tab === 'equip') {
        list.innerHTML = `<div class="hg-note">Setiap barang hanya bisa dipakai 1 robot dan membawa <b>level upgrade-nya sendiri</b>. Butuh lebih? Beli lagi di <b>TOKO</b>.</div>` + SLOTS.map(([k, label]) => {
          const id = L[k], clv = LV[k] || 0, it = lvItem(id, clv);
          let h = `<button class="hg-slot ${st.open === k ? 'open' : ''}" data-slot="${k}">${id === 'none' ? '<span class="tag">—</span>' : itemTag(id)}<span><label>${label}</label>${it.name}</span><span class="wt">${k === 'frame' ? 'DAYA ' + it.power : 'BBT ' + it.wt}</span></button>`;
          if (st.open === k) {
            // satu pilihan per (barang, level) — barang ber-upgrade tampil terpisah
            const opts = [];
            for (const oid of optsFor(k, id)) {
              if (oid === 'none') { opts.push([oid, 0, Infinity]); continue; }
              const lvls = spareLevels(oid);
              if (oid === id) opts.push([oid, clv, -1]);
              const ks = Object.keys(lvls).map(Number).sort((a, b) => b - a);
              for (const l of ks) if (!(oid === id && l === clv)) opts.push([oid, l, lvls[l]]);
              if (oid !== id && !ks.length) opts.push([oid, 0, 0]);
            }
            h += '<div class="hg-opts">' + opts.map(([oid, ol, n]) => {
              const cur = n === -1, nl = { ...L, [k]: oid }, flv = k === 'frame' ? ol : LV.frame || 0;
              const heavy = weightOf(nl) > fpow(nl.frame, flv), oi = lvItem(oid, ol), out = n === 0;
              const stock = oid === 'none' ? '' : cur ? '<span class="stk on">TERPASANG</span>' : `<span class="stk ${out ? 'out' : ''}">${out ? 'HABIS' : 'SISA ' + n}</span>`;
              return `<div class="hg-opt ${cur ? 'cur' : ''} ${heavy || out ? 'dis' : ''}" data-opt="${oid}" data-lv="${ol}" ${cur ? 'data-cur="1"' : ''}><span>${oi.name} ${stock}</span><span class="wt">${heavy ? 'TERLALU BERAT · ' : ''}${k === 'frame' ? 'DAYA ' + oi.power : 'BBT ' + oi.wt}</span><small>${oid === 'none' ? 'Tidak ada perlengkapan' : itemStats(oid, ol)}</small></div>`;
            }).join('') + '</div>';
          }
          return h;
        }).join('');
        list.querySelectorAll('[data-slot]').forEach((b) => { b.onclick = () => { SFX.play('ui'); st.open = st.open === b.dataset.slot ? null : b.dataset.slot; render(); }; });
        list.querySelectorAll('[data-opt]').forEach((b) => {
          b.onclick = () => {
            if (b.dataset.cur) { st.open = null; render(); return; }
            const k = st.open, oid = b.dataset.opt, ol = +b.dataset.lv, nl = { ...L, [k]: oid };
            if (oid !== 'none' && !(spareLevels(oid)[ol] > 0)) { SFX.play('error'); this.toast('Stok habis — sedang dipakai robot lain. Beli lagi di TOKO.', 'err'); return; }
            if (weightOf(nl) > fpow(nl.frame, k === 'frame' ? ol : LV.frame || 0)) { SFX.play('error'); this.toast('Bobot melebihi daya frame!', 'err'); return; }
            equipItem(p.id, k, oid, ol); SFX.play('select'); Game.persist(); st.open = null; render();
          };
        });
      } else if (st.tab === 'upg') {
        const cap = upCap();
        let h = `<div class="hg-note">Upgrade hanya untuk barang yang terpasang di robot <b>${p.call}</b>. Robot lain tidak ikut naik. Barang yang dilepas tetap membawa levelnya. Batas level naik tiap stage selesai — sekarang <b>+${cap}</b> dari +${UP_MAX}.${cap < UP_MAX ? ' Selesaikan stage berikutnya untuk membuka +' + (cap + 1) + '.' : ''}</div>`;
        let any = false;
        for (const [k, label] of SLOTS) {
          const id = L[k];
          if (!upgradable(id)) continue;
          any = true;
          const lv = LV[k] || 0, nx = lv + 1, cost = upCost(id, nx), it = lvItem(id, lv);
          let pips = '';
          for (let i = 0; i < UP_MAX; i++) pips += `<i class="${i < lv ? 'on' : i < cap ? '' : 'lock'}"></i>`;
          const btn = lv >= UP_MAX ? '<button class="btn sm" disabled>MAKS</button>'
            : nx > cap ? `<button class="btn sm" disabled>🔒 SELESAIKAN STAGE ${nx}</button>`
            : `<button class="btn sm ${s.credits >= cost ? 'primary' : ''}" data-up="${k}" ${s.credits >= cost ? '' : 'disabled'}>UPGRADE +${nx} ¢${U.fmt(cost)}</button>`;
          h += `<div class="hg-cat">${label}</div><div class="hg-shop hg-up">${itemTag(id)}<span class="nm">${it.name}<em class="own">MILIK ${p.call}</em></span>
            <div class="hg-sb">${btn}</div>
            <div class="up-pips">${pips}<span>${upDesc(id)}</span></div>
            <small>SEKARANG: ${itemStats(id, lv)}</small>${lv < UP_MAX && nx <= cap ? `<small class="nx">+${nx}: ${itemStats(id, nx)}</small>` : ''}</div>`;
        }
        if (!any) h += '<div class="hg-note">Robot ini belum memasang barang yang bisa di-upgrade.</div>';
        h += '<div class="hg-note" style="border-color:var(--dim)">Ransel tidak bisa di-upgrade. Pilih robot lain di panel kiri untuk meng-upgrade perlengkapannya.</div>';
        list.innerHTML = h;
        list.querySelectorAll('[data-up]').forEach((b) => {
          b.onclick = () => {
            const k = b.dataset.up, id = L[k], nx = slotLv(p.id, k) + 1, cost = upCost(id, nx);
            if (s.credits < cost || nx > upCap()) return;
            s.credits -= cost; (s.lv[p.id] = s.lv[p.id] || {})[k] = nx; Game.persist();
            SFX.play('buy'); this.toast(`UPGRADE BERHASIL: ${p.call} · ${lvItem(id, nx).name}`, 'ok'); render();
          };
        });
      } else {
        const info = (id) => (itemKind(id) === 'bp' ? BACKPACKS[id] : itemInfo(id));
        let h = '<div class="hg-note">Beli beberapa unit agar bisa dipakai lebih dari satu robot. Jual barang yang tidak terpakai seharga 50%.</div>';
        for (const [title, test] of SHOP_CATS) {
          const ids = s.cat.filter(test);
          if (!ids.length) continue;
          h += `<div class="hg-cat">${title}</div>`;
          h += ids.map((id) => {
            const it = info(id), own = invCount(id), used = usedCount(id), free = own - used, sell = Math.round(it.price / 2);
            return `<div class="hg-shop">${itemTag(id)}<span class="nm">${it.name}${s.fresh.includes(id) ? ' <i class="new">BARU</i>' : ''}<em class="own">MILIK ${own} · DIPAKAI ${used}</em></span>
              <div class="hg-sb"><button class="btn sm ${s.credits >= it.price ? 'primary' : ''}" data-buy="${id}" ${s.credits >= it.price ? '' : 'disabled'}>BELI ¢${U.fmt(it.price)}</button><button class="btn sm" data-sell="${id}" ${free > 0 ? '' : 'disabled'}>JUAL ¢${U.fmt(sell)}</button></div>
              <small>${itemStats(id)}</small><p>${it.desc || ''}</p></div>`;
          }).join('');
        }
        list.innerHTML = h;
        list.querySelectorAll('[data-buy]').forEach((b) => {
          b.onclick = () => {
            const id = b.dataset.buy, it = info(id);
            if (s.credits < it.price) return;
            s.credits -= it.price; addItem(id); s.fresh = s.fresh.filter((x) => x !== id); Game.persist();
            SFX.play('buy'); this.toast(`${it.name} dibeli! (milik ${invCount(id)}) Pasang di tab PERLENGKAPAN.`, 'ok'); render();
          };
        });
        list.querySelectorAll('[data-sell]').forEach((b) => {
          b.onclick = () => {
            const id = b.dataset.sell, it = info(id);
            if (freeCount(id) <= 0) return;
            // jual cadangan tanpa upgrade lebih dulu; jika semua ber-upgrade, jual level terendah (+50% biaya upgrade kembali)
            const lv = spareLevels(id)[0] ? 0 : Math.min(...(s.spareLv[id] || [0]));
            if (lv > 0) s.spareLv[id].splice(s.spareLv[id].indexOf(lv), 1);
            const val = Math.round((it.price + upSpent(id, lv)) / 2);
            s.inv[id]--; s.credits += val; Game.persist();
            SFX.play('ui'); this.toast(`${it.name}${lv ? ' +' + lv : ''} dijual (¢${U.fmt(val)}).`, 'ok'); render();
          };
        });
      }
    };
    render();
  },

  // ----- HASIL MISI -----
  result(B) {
    HUD.hide();
    const s = Game.save, m = MISSIONS[B.mi];
    let html;
    if (B.win) {
      const first = !s.cleared.includes(B.mi);
      const credits = Math.round((m.reward + B.kills * 300) * (first ? 1 : 0.5));
      s.credits += credits;
      const gifts = first ? (m.gift || []) : [];
      gifts.forEach((id) => addItem(id));
      const cap0 = upCap();
      if (first) s.cleared.push(B.mi);
      const capUp = upCap() > cap0 ? upCap() : 0;
      const rows = B.units.filter((u) => u.team === 'P').map((u) => {
        const p = u.pilot, gain = u.xp + 25 + (u.dead ? 0 : 15);
        p.xp += gain;
        let up = 0;
        while (p.xp >= 100) { p.xp -= 100; p.lvl++; p.acc += 2; p.eva += 1; up++; }
        return { u, gain, up };
      });
      const newItems = m.unlock.filter((id) => !s.cat.includes(id));
      s.cat.push(...newItems);
      s.fresh = newItems.slice();
      const nm = (id) => (itemKind(id) === 'bp' ? BACKPACKS[id] : itemInfo(id)).name;
      const last = B.mi >= MISSIONS.length - 1;
      if (B.mi >= s.mission) s.mission = Math.min(B.mi + 1, MISSIONS.length - 1);
      if (last) s.done = true;
      Game.persist();
      const joiner = !last && s.pilots.find((p) => p.join === B.mi + 1);
      html = `<div class="rs-box panel">
        <div class="rs-h win">MISI BERHASIL</div>
        <div class="rs-sub">${m.code} · ${m.name}</div>
        <div class="rs-stats"><div><label>GILIRAN</label><b>${B.turn}</b></div><div><label>MUSUH HANCUR</label><b>${B.kills}</b></div><div><label>UNIT HILANG</label><b>${B.lost}</b></div><div><label>KREDIT</label><b style="color:var(--amber)">+${U.fmt(credits)}</b></div></div>
        <div class="rs-pl">${rows.map((r) => `<div class="rs-pr"><b>${r.u.name}</b><span>${r.u.pilot.name}</span><span>+${r.gain} XP</span><span class="lv">${r.up ? 'LEVEL UP!' : 'LV ' + r.u.pilot.lvl}</span></div>`).join('')}</div>
        ${gifts.length ? `<div class="rs-new" style="color:var(--amber);border-color:var(--amber);background:rgba(255,180,60,.08)">🎁 HADIAH ITEM (sudah masuk PERLENGKAPAN): ${gifts.map(nm).join(', ')}</div>` : ''}
        ${capUp ? `<div class="rs-new" style="color:var(--cyan);border-color:var(--cyan)">⬆ BATAS UPGRADE NAIK KE +${capUp} — buka tab UPGRADE di HANGAR</div>` : ''}
        ${newItems.length ? `<div class="rs-new">🛒 BARANG BARU DI TOKO: ${newItems.map(nm).join(', ')}</div>` : ''}
        ${!first ? '<div class="rs-new" style="color:var(--dim);border-color:var(--dim)">Misi ulangan: kredit 50%, tanpa hadiah item.</div>' : ''}
        ${joiner ? `<div class="rs-new">PILOT BARU BERGABUNG: ${joiner.call} — ${joiner.name}</div>` : ''}
        <div class="rs-btns">${last ? '<button class="btn primary" data-a="end">EPILOG ▶</button>' : '<button class="btn" data-a="title">JUDUL</button><button class="btn warn" data-a="hangar">HANGAR</button><button class="btn primary" data-a="next">MISI BERIKUTNYA ▶</button>'}</div>
      </div>`;
    } else {
      html = `<div class="rs-box panel">
        <div class="rs-h lose">MISI GAGAL</div>
        <div class="rs-sub">${m.code} · ${m.name} — SKUADRON GARUDA MUNDUR</div>
        <p style="text-align:center;color:#9aabb8;margin-bottom:20px;line-height:1.6">Tips: Gunakan hutan dan bebatuan untuk evasi, serang bersama agar LINK aktif,<br>simpan AP untuk serangan balasan, dan upgrade perlengkapan di hangar.</p>
        <div class="rs-btns"><button class="btn" data-a="title">JUDUL</button><button class="btn warn" data-a="hangar">HANGAR</button><button class="btn primary" data-a="retry">ULANGI MISI</button></div>
      </div>`;
    }
    const el = this.set(html, 'result');
    this.bind(el, {
      next: () => this.briefing(s.mission), hangar: () => this.hangar(B.win ? s.mission : B.mi),
      title: () => this.title(), retry: () => Game.startBattle(B.mi), end: () => this.ending(),
    });
  },

  ending() {
    Game.stopBattle();
    const el = this.set(`<div class="en-box">
      <div class="br-code" style="margin-bottom:10px">EPILOG</div>
      <h1>PERANG BERAKHIR</h1>
      <p>TYRANT runtuh di gerbang Benteng Besi. Tanpa komandannya, sisa pasukan Republik Valkar menyerah sebelum matahari terbit.</p>
      <p>Skuadron Garuda pulang membawa kemenangan. Nama mereka dicatat dalam sejarah Perang Perbatasan 2091.</p>
      <p style="color:var(--amber);letter-spacing:3px">TERIMA KASIH TELAH BERMAIN · STEEL VANGUARD</p>
      <div class="rs-btns" style="margin-top:24px"><button class="btn" data-a="replay">MAINKAN ULANG MISI</button><button class="btn primary" data-a="title">KEMBALI KE JUDUL</button></div>
    </div>`, 'ending');
    this.bind(el, { title: () => this.title(), replay: () => this.missionSelect() });
  },
  missionSelect() {
    const b = this.modal(`<h2>PILIH MISI</h2><div class="md-col">${MISSIONS.map((m, i) => `<button class="btn" data-m="${i}">${m.code} · ${m.name}</button>`).join('')}</div><div class="md-btns"><button class="btn" data-x="1">TUTUP</button></div>`);
    b.querySelectorAll('[data-m]').forEach((x) => { x.onclick = () => { this.closeModal(); this.briefing(+x.dataset.m); }; });
    b.querySelector('[data-x]').onclick = () => this.closeModal();
  },

  help() {
    const b = this.modal(`<h2>CARA BERMAIN</h2>
      <h3>KONTROL</h3>
      <ul><li><b>Klik kiri</b>: pilih unit / petak / target</li><li><b>Klik kanan</b> atau <kbd>ESC</kbd>: batal / kembali</li><li><b>Seret</b> mouse atau <kbd>W A S D</kbd> / panah: geser kamera · <b>Scroll</b>: zoom</li><li><kbd>Q</kbd> / <kbd>E</kbd> atau tombol ⟲ ⟳: putar kamera 90°</li><li><kbd>TAB</kbd> ganti unit · <kbd>T</kbd> akhiri giliran · <kbd>SPASI</kbd> lewati animasi</li></ul>
      <h3>KONTROL HP / LAYAR SENTUH</h3>
      <ul><li><b>Tap</b>: pilih unit / petak / target (tap 1× saja)</li><li><b>Geser 1 jari</b>: geser kamera · <b>cubit 2 jari</b>: zoom</li><li>Tombol <b>✕</b> batal / kembali · <b>UNIT ▸</b> ganti unit · <b>⟲ ⟳</b> putar kamera · <b>AKHIRI</b> akhiri giliran</li><li>Saat animasi tempur: tap 1× percepat, tap lagi lewati</li><li>Paling nyaman dimainkan dengan <b>HP dimiringkan</b> (landscape)</li></ul>
      <h3>SISTEM PERTEMPURAN</h3>
      <ul>
        <li>Setiap mecha punya 4 bagian: <b>BADAN, L.ARM, R.ARM, KAKI</b>. Jika BADAN hancur, unit hancur. Lengan hancur berarti senjatanya hilang. Kaki hancur membuat gerak tinggal 1 petak.</li>
        <li><b>AP</b> (Action Point) bertambah +6 tiap giliran (maks 12). Menyerang, membalas, dan LINK memakai AP.</li>
        <li><b>LINK</b>: rekan yang target-nya masuk jangkauan senjata mereka ikut menyerang otomatis (maks 2), asalkan AP cukup.</li>
        <li><b>BALASAN</b>: musuh membalas jika senjatanya menjangkau dan AP-nya cukup. Misil tidak bisa membalas.</li>
        <li>Senjata: <span class="t-MG">MG</span> jarak 1-3 banyak peluru · <span class="t-SG">SG</span> jarak 1-2 sangat kuat dekat · <span class="t-RF">RF</span> jarak jauh akurat · <span class="t-MELEE">MLE</span> jarak 1 sangat sakit · <span class="t-MSL">MSL</span> jarak 3+ amunisi terbatas.</li>
        <li>Medan: Hutan +15 evasi, Bebatuan/Puing +10. Posisi lebih tinggi menambah akurasi.</li>
        <li><b>Skill pilot</b>: ZOOM, DUEL, GUARD, DOUBLE. Peluangnya naik seiring level.</li>
        <li>Di <b>HANGAR</b>, ganti frame & senjata. Total bobot harus ≤ daya frame.</li>
        <li><b>UPGRADE</b> (per robot & per barang): pilih robot, lalu upgrade frame/senjata yang terpasang. Robot lain tidak ikut naik; barang yang dilepas tetap membawa levelnya. Tiap stage selesai, batas upgrade naik +1 (maks +5). Frame: HP +8% & DAYA +2. Senjata: DAMAGE +10% & AKURASI +2 per level.</li>
        <li><b>Sniper, Bazoka & Pelontar Granat</b> butuh 2 tangan: kosongkan tangan lain untuk <b>+15 akurasi</b>. Kalau tangan lain memegang senjata/perisai, akurasi <b>-15</b>.</li>
      </ul>
      <div class="md-btns"><button class="btn primary" data-x="1">MENGERTI</button></div>`);
    b.querySelector('[data-x]').onclick = () => this.closeModal();
  },
  settings() {
    const S = Game.settings;
    const b = this.modal(`<h2>PENGATURAN</h2>
      <div class="set-row"><div>Animasi Pertempuran<small>Adegan sinematik saat menyerang</small></div><button class="tgl" data-k="cine"></button></div>
      <div class="set-row"><div>Efek Suara<small>Suara prosedural WebAudio</small></div><button class="tgl" data-k="sound"></button></div>
      <div class="set-row"><div>Kecepatan Cepat<small>Mempercepat animasi & fase musuh</small></div><button class="tgl" data-k="fast"></button></div>
      <div class="md-btns"><button class="btn primary" data-x="1">SELESAI</button></div>`);
    const upd = () => b.querySelectorAll('.tgl').forEach((t) => { const on = S[t.dataset.k]; t.classList.toggle('on', on); t.textContent = on ? 'ON' : 'OFF'; });
    b.querySelectorAll('.tgl').forEach((t) => { t.onclick = () => { S[t.dataset.k] = !S[t.dataset.k]; Game.applySettings(); SFX.play('ui'); upd(); }; });
    b.querySelector('[data-x]').onclick = () => this.closeModal();
    upd();
  },
  battleMenu() {
    const B = Game.battle;
    if (!B || B.over) return;
    const b = this.modal(`<h2>MENU</h2><div class="md-col">
      <button class="btn primary" data-a="resume">LANJUTKAN</button>
      <button class="btn" data-a="help">CARA BERMAIN</button>
      <button class="btn" data-a="set">PENGATURAN</button>
      <button class="btn warn" data-a="retry">ULANGI MISI</button>
      <button class="btn danger" data-a="quit">MUNDUR KE BRIEFING</button>
      <button class="btn danger" data-a="title">KELUAR KE JUDUL</button></div>`);
    this.bind(b, {
      resume: () => this.closeModal(), help: () => this.help(), set: () => this.settings(),
      retry: () => { this.closeModal(); Game.startBattle(B.mi); },
      quit: () => { this.closeModal(); this.briefing(B.mi); },
      title: () => { this.closeModal(); this.title(); },
    });
  },
};
