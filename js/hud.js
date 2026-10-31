'use strict';
// ================= HUD PERTEMPURAN (DOM) =================
const HUD = {
  el: {},
  init() {
    for (const id of ['hud', 'tbCode', 'tbName', 'tbTurn', 'unitPanel', 'targetPanel', 'actionMenu', 'preview', 'hint', 'tileInfo', 'banner', 'btnEnd', 'btnMenu', 'btnLink', 'btnCancel'])
      this.el[id] = document.getElementById(id);
    this.el.btnEnd.onclick = () => { SFX.init(); if (Game.battle) Game.battle.endPlayerTurn(); };
    this.el.btnMenu.onclick = () => { SFX.play('ui'); UI.battleMenu(); };
    this.el.btnCancel.onclick = () => { if (Game.battle) Game.battle.cancel(); };
    document.getElementById('btnNext').onclick = () => { if (Game.battle) Game.battle.cycleUnit(); };
    document.getElementById('btnRotL').onclick = () => Game.rotate(-1);
    document.getElementById('btnRotR').onclick = () => Game.rotate(1);
    this.el.btnLink.onclick = () => {
      const B = Game.battle; if (!B) return;
      B.linkOn = !B.linkOn; this.linkBtn(B); SFX.play('ui');
      if (B.mode === 'confirm') this.preview(B, B.sel, B.tgt, B.ws);
    };
  },
  show(B) {
    this.el.hud.classList.remove('hidden');
    this.el.tbCode.textContent = B.mis.code;
    this.el.tbName.textContent = B.mis.name;
    this.linkBtn(B); this.turn(B);
  },
  hide() {
    this.el.hud.classList.add('hidden');
    this.el.banner.classList.add('hidden');
    ['unitPanel', 'targetPanel', 'actionMenu', 'preview'].forEach((k) => this.el[k].classList.add('hidden'));
  },
  linkBtn(B) { this.el.btnLink.textContent = 'LINK ' + (B.linkOn ? 'ON' : 'OFF'); this.el.btnLink.style.color = B.linkOn ? 'var(--amber)' : 'var(--dim)'; },
  turn(B) {
    this.el.tbTurn.innerHTML = `GILIRAN <b>${B.turn}</b> · <span class="${B.phase === 'P' ? 'p' : 'e'}">${B.phase === 'P' ? 'FASE PEMAIN' : 'FASE MUSUH'}</span>`;
    this.el.btnEnd.disabled = B.phase !== 'P' || B.busy;
  },
  hint(t) { this.el.hint.textContent = t || ''; },
  cancelBtn(v) { this.el.btnCancel.classList.toggle('hidden', !v); },
  tileInfo(t) {
    if (!t) { this.el.tileInfo.textContent = ''; return; }
    const T = TERRAIN[t.t];
    this.el.tileInfo.innerHTML = `<b>${T.name}</b> · TINGGI ${t.h}${T.eva ? ` · <span class="good">EVA +${T.eva}</span>` : ''}${T.cost > 1 && !T.block ? ' · GERAK x2' : ''}${T.block ? ' · <span class="bad">TAK DAPAT DILALUI</span>' : ''}`;
  },
  wRow(tag, w, broken, u) {
    if (!w || w.type === 'NONE') return '';
    const st = w.type === 'SHIELD' ? `BLOK ${w.chance}% · -${Math.round(w.block * 100)}%` : `${w.dmg}×${w.hits}${w.blast ? ' BLAST' : ''} · R${w.rmin}-${w.rmax} · AP${w.ap}${w.ammo ? ` · ${u.ammo}/${w.ammo}` : ''}`;
    return `<div class="wr ${broken ? 'broken' : ''}"><span class="tag t-${w.type}">${tag}</span><span class="wn">${w.name}</span><span class="ws">${st}</span></div>`;
  },
  panelHTML(u, B) {
    const tcol = u.team === 'P' ? 'var(--cyan)' : 'var(--red)', pl = u.pilot;
    const parts = PARTS.map((p) => {
      const v = u.parts[p], m = u.max[p], r = v / m;
      return `<div class="prt"><span>${PART_NAME[p]}</span><div class="bar"><i style="width:${r * 100}%;background:${hpCol(r)}"></i></div><b class="${v <= 0 ? 'dead' : ''}">${v <= 0 ? 'HANCUR' : v}</b></div>`;
    }).join('');
    let pips = '';
    for (let i = 0; i < u.apMax; i++) pips += `<i class="${i < u.ap ? 'on' : ''}"></i>`;
    const wps = this.wRow('R', u.W.rarm, u.parts.rarm <= 0, u) + this.wRow('L', u.W.larm, u.parts.larm <= 0, u) + this.wRow('S', u.W.sh, u.sh !== 'none' && u.ammo <= 0, u);
    const t = B.map.T[u.y][u.x], terr = TERRAIN[t.t];
    const bp = BACKPACKS[u.bp];
    return `
      <div class="up-head" style="border-color:${tcol}"><div><div class="up-call" style="color:${tcol}">${u.name}</div><div class="up-pilot">${pl.name}${pl.skill ? ` · <span class="skill">${pl.skill}</span>` : ''}</div></div><div class="up-lv">LV<b>${pl.lvl}</b></div></div>
      <div class="up-body"><canvas width="220" height="192"></canvas><div class="up-parts">${parts}</div></div>
      <div class="up-ap"><span>AP</span><div class="pips">${pips}</div><b>${u.ap}/${u.apMax}</b></div>
      <div class="up-wps">${wps || '<div class="wr"><span class="wn" style="color:var(--dim)">Tidak ada senjata</span></div>'}</div>
      <div class="up-foot">${u.frame.name} <em>${u.frame.cls}</em> · GERAK ${moveOf(u)} · LOMPAT ${jumpOf(u)} · EVA ${u.frame.eva + pl.eva}${terr.eva ? ` <span class="good">+${terr.eva} ${terr.name}</span>` : ''}${u.guarding ? ' <span class="good">· BERTAHAN +15</span>' : ''}${bp.kind === 'repair' ? ` · REPAIR ${u.repairs}` : ''}</div>`;
  },
  showUnit(u, B, which = 'unitPanel') {
    const el = this.el[which];
    if (!u || !B) { el.classList.add('hidden'); return; }
    el.innerHTML = this.panelHTML(u, B);
    el.classList.remove('hidden');
    const cv = el.querySelector('canvas'), c = cv.getContext('2d');
    c.setTransform(2, 0, 0, 2, 0, 0);
    drawMech(c, u, u.team === 'P' ? 36 : 74, 88, 0.82, u.team === 'P' ? 1 : -1, {});
  },
  hideActions() { this.el.actionMenu.classList.add('hidden'); },
  hidePreview() { this.el.preview.classList.add('hidden'); },
  actions(B, u) {
    const el = this.el.actionMenu;
    let h = `<div class="am-title">PERINTAH · ${u.name}</div>`;
    Combat.weaponsOf(u).forEach((ws, i) => {
      const ok = Combat.canUse(u, ws), n = B.targetsFor(u, ws).length;
      const note = ok ? (n ? `${n} target dalam jangkauan` : `jangkauan ${ws.w.rmin}-${ws.w.rmax} · tak ada target`) : ws.slot === 'sh' && u.ammo <= 0 ? 'amunisi habis' : 'AP tidak cukup';
      h += `<button class="am-btn ${ok && n ? 'has' : ''}" data-a="w${i}" ${ok ? '' : 'disabled'}><span class="tag t-${ws.w.type}">${TYPE_ICON[ws.w.type]}</span><span class="am-n">${ws.w.name}</span><span class="am-s">${note}</span><span class="am-ap">AP ${ws.w.ap}</span></button>`;
    });
    if (BACKPACKS[u.bp].kind === 'repair')
      h += `<button class="am-btn" data-a="repair" ${u.repairs > 0 && u.ap >= 3 ? '' : 'disabled'}><span class="tag t-REP">REP</span><span class="am-n">Perbaikan</span><span class="am-s">diri / rekan bersebelahan · sisa ${u.repairs}</span><span class="am-ap">AP 3</span></button>`;
    h += `<button class="am-btn" data-a="guard"><span class="tag t-GRD">DEF</span><span class="am-n">Bertahan</span><span class="am-s">+15 evasi sampai giliran berikut</span></button>`;
    h += `<button class="am-btn" data-a="wait"><span class="tag">END</span><span class="am-n">Selesai</span><span class="am-s">simpan AP untuk balasan & link</span></button>`;
    if (u.moved && B.undo) h += `<button class="am-btn" data-a="undo"><span class="tag">↶</span><span class="am-n">Batal Gerak</span><span class="am-s">kembali ke posisi awal</span></button>`;
    el.innerHTML = h;
    el.classList.remove('hidden');
    el.querySelectorAll('button').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); SFX.play('ui'); B.menuAction(b.dataset.a); };
      if (b.dataset.a[0] === 'w') {
        b.onmouseenter = () => B.previewRange(+b.dataset.a.slice(1));
        b.onmouseleave = () => B.previewRange(-1);
      }
    });
  },
  preview(B, a, d, ws) {
    const hc = Combat.hitChance(B, a, d, ws.w);
    const exp = Math.round((hc / 100) * ws.w.dmg * ws.w.hits);
    const cw = Combat.counterWeapon(B, d, a);
    const links = B.linkOn ? Combat.linkers(B, a, d) : [];
    let h = `<div class="pv-head"><span class="tag t-${ws.w.type}">${TYPE_ICON[ws.w.type]}</span>${ws.w.name}<span class="pv-vs">▶ ${d.name}</span></div>
      <div class="pv-grid"><div><label>AKURASI</label><b class="big">${hc}%</b></div><div><label>DAMAGE</label><b>${ws.w.dmg}×${ws.w.hits}</b></div><div><label>RATA-RATA</label><b>≈${exp}</b></div><div><label>AP</label><b>${a.ap}→${a.ap - ws.w.ap}</b></div></div>`;
    if (ws.w.blast) h += `<div class="pv-ok" style="color:var(--amber);border-color:var(--amber);background:rgba(255,180,60,.08)">💥 LEDAKAN: setiap tembakan yang kena merusak SEMUA bagian target</div>`;
    const gm = Combat.grip(a, ws.w);
    if (gm > 0) h += `<div class="pv-ok">🎯 PEGANGAN 2 TANGAN: tangan lain kosong, akurasi +${gm}</div>`;
    else if (gm < 0) h += `<div class="pv-warn">✋ 1 TANGAN: tangan lain ${a.parts[ws.slot === 'rarm' ? 'larm' : 'rarm'] > 0 ? 'memegang senjata' : 'hancur'}, akurasi ${gm}</div>`;
    if (ws.w.type === 'FL') h += `<div class="pv-ok" style="color:var(--amber);border-color:var(--amber);background:rgba(255,180,60,.08)">🔥 API: menembus perisai musuh</div>`;
    h += cw ? `<div class="pv-warn">⚠ BALASAN: ${d.name} akan membalas dengan ${cw.w.name} (${Combat.hitChance(B, d, a, cw.w)}%)</div>` : `<div class="pv-ok">✓ Musuh tidak dapat membalas serangan ini</div>`;
    h += `<div class="pv-link">LINK ${B.linkOn ? '' : '(OFF)'}: ${links.length ? links.map((l) => `<span>${l.u.name} · ${l.ws.w.name}</span>`).join('') : '<em>tidak ada rekan dalam jangkauan</em>'}</div>`;
    h += `<div class="pv-btns"><button class="btn sm" data-a="cancel">BATAL</button><button class="btn sm primary" data-a="go">SERANG ▶</button></div>`;
    const el = this.el.preview;
    el.innerHTML = h; el.classList.remove('hidden');
    el.querySelector('[data-a=cancel]').onclick = () => B.cancel();
    el.querySelector('[data-a=go]').onclick = () => B.confirmAttack();
  },
  banner(text, sub, team) {
    return new Promise((res) => {
      const b = this.el.banner;
      b.className = team === 'E' ? 'e' : 'p';
      b.querySelector('.bn-text').textContent = text;
      b.querySelector('.bn-sub').textContent = sub || '';
      b.style.animation = 'none'; void b.offsetWidth;
      const dur = 1.45 / Time.speed;
      b.style.animation = `bnIn ${dur}s ease forwards`;
      SFX.play('phase');
      setTimeout(() => { b.classList.add('hidden'); res(); }, dur * 1000);
    });
  },
};
