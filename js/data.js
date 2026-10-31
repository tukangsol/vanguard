'use strict';
// ================= DATA GAME =================
const PARTS = ['body', 'larm', 'rarm', 'legs'];
const PART_NAME = { body: 'BADAN', larm: 'L.ARM', rarm: 'R.ARM', legs: 'KAKI' };
const TYPE_NAME = { SMG: 'SMG', MG: 'Senapan Mesin', SG: 'Shotgun', RF: 'Rifle', SR: 'Sniper', BZ: 'Bazoka', GL: 'Pelontar Granat', FL: 'Pelontar Api', MELEE: 'Jarak Dekat', SHIELD: 'Perisai', MSL: 'Misil', NONE: '—' };
const TYPE_ICON = { SMG: 'SMG', MG: 'MG', SG: 'SG', RF: 'RF', SR: 'SNP', BZ: 'BZK', GL: 'GRN', FL: 'FLM', MELEE: 'MLE', SHIELD: 'SHD', MSL: 'MSL', NONE: '—' };

const WEAPONS = {
  none: { name: 'Kosong', type: 'NONE', wt: 0, price: 0 },
  // --- SMG ---
  wasp: { name: 'Wasp SMG', type: 'SMG', dmg: 9, hits: 8, acc: 80, rmin: 1, rmax: 2, ap: 2, wt: 5, price: 1200, desc: 'Senapan mesin ringan. Hemat AP, sangat akurat di jarak dekat.' },
  stinger: { name: 'Stinger SMG', type: 'SMG', dmg: 12, hits: 8, acc: 82, rmin: 1, rmax: 2, ap: 2, wt: 7, price: 2400, desc: 'SMG berperedam dengan laju tembak tinggi.' },
  // --- MG ---
  viper: { name: 'Viper MG-1', type: 'MG', dmg: 13, hits: 6, acc: 72, rmin: 1, rmax: 3, ap: 3, wt: 8, price: 1000, desc: 'Senapan mesin standar. Rentetan peluru menyebar ke banyak bagian.' },
  hornet: { name: 'Hornet MG-2', type: 'MG', dmg: 17, hits: 6, acc: 75, rmin: 1, rmax: 3, ap: 3, wt: 11, price: 1800, desc: 'MG kaliber besar bermagasin drum, stabil dan kuat.' },
  tempest: { name: 'Tempest Gatling', type: 'MG', dmg: 15, hits: 10, acc: 66, rmin: 1, rmax: 3, ap: 4, wt: 15, price: 4600, desc: 'Gatling berputar — badai peluru yang menghancurkan.' },
  // --- SG ---
  breaker: { name: 'Breaker SG', type: 'SG', dmg: 11, hits: 8, acc: 66, rmin: 1, rmax: 2, ap: 2, wt: 9, price: 1000, desc: 'Shotgun pompa ringan. Sangat kuat di jarak dekat, hemat AP.' },
  cyclone: { name: 'Cyclone SG', type: 'SG', dmg: 15, hits: 9, acc: 68, rmin: 1, rmax: 2, ap: 2, wt: 12, price: 2600, desc: 'Shotgun otomatis dengan sebaran padat.' },
  ravager: { name: 'Ravager SG', type: 'SG', dmg: 22, hits: 7, acc: 64, rmin: 1, rmax: 2, ap: 3, wt: 15, price: 4400, desc: 'Shotgun laras ganda kaliber raksasa.' },
  // --- RIFLE ---
  carbine: { name: 'Carbine AR', type: 'RF', dmg: 28, hits: 3, acc: 78, rmin: 2, rmax: 4, ap: 3, wt: 9, price: 2000, desc: 'Senapan serbu tiga peluru, seimbang dan andal.' },
  longbow: { name: 'Longbow RF', type: 'RF', dmg: 40, hits: 2, acc: 80, rmin: 2, rmax: 5, ap: 3, wt: 10, price: 1500, desc: 'Rifle presisi, dua tembakan kaliber berat.' },
  // --- SNIPER ---
  falcon: { name: 'Falcon SR', type: 'SR', dmg: 72, hits: 1, acc: 88, rmin: 3, rmax: 7, ap: 4, wt: 12, price: 3600, desc: 'Senapan runduk jarak jauh. Paling akurat bila tangan lain KOSONG (+15 AKU).' },
  railspike: { name: 'Railspike RG', type: 'SR', dmg: 95, hits: 1, acc: 92, rmin: 3, rmax: 8, ap: 5, wt: 15, price: 5600, desc: 'Railgun elektromagnetik. Pegang 2 tangan (tangan lain kosong) untuk +15 AKU.' },
  // --- LEDAKAN (blast: kena SEMUA bagian) ---
  thunder: { name: 'Thunder BZ', type: 'BZ', blast: true, dmg: 34, hits: 1, acc: 72, rmin: 2, rmax: 5, ap: 4, wt: 14, price: 3400, desc: 'Bazoka. LEDAKAN merusak SEMUA bagian. Pegang 2 tangan untuk +15 AKU.' },
  hailstorm: { name: 'Hailstorm GL', type: 'GL', blast: true, dmg: 24, hits: 2, acc: 68, rmin: 2, rmax: 4, ap: 4, wt: 12, price: 3900, desc: 'Pelontar granat. Dua ledakan ke SEMUA bagian. Pegang 2 tangan untuk +15 AKU.' },
  // --- API ---
  salamander: { name: 'Salamander FT', type: 'FL', dmg: 16, hits: 5, acc: 86, rmin: 1, rmax: 2, ap: 3, wt: 10, price: 3000, desc: 'Pelontar api. Menembus perisai.' },
  // --- JARAK DEKAT ---
  knuckle: { name: 'Iron Knuckle', type: 'MELEE', dmg: 64, hits: 1, acc: 88, rmin: 1, rmax: 1, ap: 2, wt: 6, price: 800, desc: 'Tinju baja. Ringan, murah, mematikan.' },
  rod: { name: 'Steel Rod', type: 'MELEE', dmg: 80, hits: 1, acc: 90, rmin: 1, rmax: 1, ap: 2, wt: 8, price: 1800, desc: 'Tongkat baja panjang. Pukulan cepat dan akurat.' },
  blade: { name: 'Heat Blade', type: 'MELEE', dmg: 90, hits: 1, acc: 93, rmin: 1, rmax: 1, ap: 2, wt: 9, price: 4200, desc: 'Pedang berbilah panas. Sangat akurat.' },
  pile: { name: 'Piledriver', type: 'MELEE', dmg: 100, hits: 1, acc: 85, rmin: 1, rmax: 1, ap: 3, wt: 10, price: 3200, desc: 'Pasak hidrolik penembus armor.' },
  hammer: { name: 'Titan Hammer', type: 'MELEE', dmg: 135, hits: 1, acc: 74, rmin: 1, rmax: 1, ap: 4, wt: 16, price: 5000, desc: 'Palu godam hidrolik. Pukulan paling dahsyat.' },
  // --- PERISAI ---
  buckler: { name: 'Buckler', type: 'SHIELD', block: 0.35, chance: 38, wt: 5, price: 1000, desc: '38% peluang menahan 35% kerusakan. Sangat ringan.' },
  aegis: { name: 'Aegis Shield', type: 'SHIELD', block: 0.4, chance: 45, wt: 8, price: 1400, desc: '45% peluang menahan 40% kerusakan (kecuali ke kaki).' },
  bulwark: { name: 'Bulwark Shield', type: 'SHIELD', block: 0.5, chance: 60, wt: 12, price: 2400, desc: '60% peluang menahan 50% kerusakan (kecuali ke kaki).' },
  // --- BAHU ---
  sparrow: { name: 'Sparrow ML', type: 'MSL', dmg: 52, hits: 2, acc: 76, rmin: 3, rmax: 7, ap: 4, ammo: 3, wt: 12, price: 1800, desc: 'Peluncur misil bahu. Jangkauan jauh, amunisi 3.' },
  harpoon: { name: 'Harpoon ML', type: 'MSL', dmg: 76, hits: 2, acc: 80, rmin: 3, rmax: 8, ap: 5, ammo: 3, wt: 16, price: 3800, desc: 'Misil berat berpemandu. Amunisi 3.' },
  hydra: { name: 'Hydra ML', type: 'MSL', dmg: 38, hits: 4, acc: 74, rmin: 3, rmax: 7, ap: 5, ammo: 2, wt: 15, price: 4600, desc: 'Meluncurkan 4 misil sekaligus. Amunisi 2.' },
  quake: { name: 'Quake Mortar', type: 'MSL', blast: true, dmg: 40, hits: 1, acc: 70, rmin: 4, rmax: 9, ap: 5, ammo: 2, wt: 16, price: 5200, desc: 'Mortir bahu. LEDAKAN ke SEMUA bagian, jangkauan sangat jauh. Amunisi 2.' },
};
const BACKPACKS = {
  none: { name: 'Kosong', wt: 0, price: 0 },
  repair: { name: 'Repair Pack', kind: 'repair', uses: 2, heal: 90, wt: 6, price: 1200, desc: '2x perbaikan lapangan (+90 HP badan).' },
  repair2: { name: 'Repair Pack II', kind: 'repair', uses: 3, heal: 120, wt: 8, price: 2600, desc: '3x perbaikan lapangan (+120 HP badan).' },
  booster: { name: 'Jet Booster', kind: 'booster', move: 1, jump: 1, wt: 5, price: 1600, desc: '+1 Gerak, +1 Lompat.' },
  sensor: { name: 'Sensor Pack', kind: 'sensor', acc: 8, wt: 4, price: 2200, desc: '+8 akurasi untuk semua senjata.' },
  ammo: { name: 'Ammo Pack', kind: 'ammo', ammo: 2, wt: 5, price: 1800, desc: '+2 amunisi senjata bahu.' },
};
const FRAMES = {
  wisp: { name: 'Wisp', cls: 'RINGAN', body: 180, arm: 100, legs: 140, move: 6, jump: 2, eva: 14, power: 34, style: 0, price: 1800, desc: 'Frame ringan yang lincah.' },
  kestrel: { name: 'Kestrel', cls: 'RINGAN', body: 215, arm: 115, legs: 160, move: 6, jump: 3, eva: 16, power: 40, style: 0, price: 3400, desc: 'Frame ringan generasi baru, lompatan tinggi.' },
  vanguard: { name: 'Vanguard', cls: 'SEDANG', body: 240, arm: 130, legs: 170, move: 5, jump: 2, eva: 8, power: 44, style: 1, price: 2400, desc: 'Frame serbaguna standar Aliansi.' },
  bastion: { name: 'Bastion', cls: 'SEDANG', body: 290, arm: 150, legs: 200, move: 5, jump: 2, eva: 9, power: 52, style: 1, price: 5600, desc: 'Frame sedang berlapis armor komposit.' },
  goliath: { name: 'Goliath', cls: 'BERAT', body: 340, arm: 175, legs: 230, move: 4, jump: 1, eva: 3, power: 60, style: 2, price: 4200, desc: 'Benteng berjalan. Lambat tapi sangat tangguh.' },
  tyrant: { name: 'TYRANT', cls: 'PROTOTIPE', body: 500, arm: 210, legs: 300, move: 4, jump: 1, eva: 5, power: 99, style: 2, price: 0, hidden: true, desc: 'Prototipe rahasia Valkar.' },
};
for (const o of [WEAPONS, BACKPACKS, FRAMES]) for (const k in o) o[k].id = k;

const SKILLS = {
  ZOOM: { name: 'ZOOM', chance: 30, desc: 'Peluang semua tembakan diarahkan tepat ke BADAN musuh.' },
  DUEL: { name: 'DUEL', chance: 45, desc: 'Peluang serangan jarak dekat x1.6 dan mengincar BADAN.' },
  GUARD: { name: 'GUARD', chance: 35, desc: 'Peluang memotong semua kerusakan 50% saat diserang.' },
  DOUBLE: { name: 'DOUBLE', chance: 25, desc: 'Peluang menembak dua kali (senjata non-jarak dekat).' },
};

const PILOTS = [
  { id: 'raka', name: 'Raka Aditya', call: 'GARUDA-1', role: 'Komandan Skuadron', acc: 8, eva: 5, skill: 'ZOOM', color: '#58799a', accent: '#ffb43c', visor: '#7ff3ff', sec: '#3f566e', join: 0, design: { head: 'crest', pad: 'round', mark: 'wing', num: 1 },
    load: { frame: 'vanguard', r: 'viper', l: 'aegis', sh: 'sparrow', bp: 'repair' } },
  { id: 'sinta', name: 'Sinta Maharani', call: 'GARUDA-2', role: 'Penyerbu', acc: 5, eva: 10, skill: 'DUEL', color: '#4b8a86', accent: '#ff6b5a', visor: '#ffd36a', sec: '#e2e6e8', join: 0, design: { head: 'twin', pad: 'slim', mark: 'stripe', num: 2 },
    load: { frame: 'wisp', r: 'breaker', l: 'knuckle', sh: 'none', bp: 'repair' } },
  { id: 'bima', name: 'Bima Satria', call: 'GARUDA-3', role: 'Tank Pendukung', acc: 5, eva: 3, skill: 'GUARD', color: '#6c7a47', accent: '#ffd24a', visor: '#9dff6b', sec: '#4a5236', join: 0, design: { head: 'dome', pad: 'layered', mark: 'chevron', num: 3 },
    load: { frame: 'vanguard', r: 'breaker', l: 'aegis', sh: 'sparrow', bp: 'repair' } },
  { id: 'laras', name: 'Laras Wening', call: 'GARUDA-4', role: 'Penembak Jitu', acc: 11, eva: 6, skill: 'DOUBLE', color: '#8a7756', accent: '#5fd4ff', visor: '#5fd4ff', sec: '#5e5240', join: 0, design: { head: 'sniper', pad: 'angular', mark: 'camo', num: 4 },
    load: { frame: 'vanguard', r: 'longbow', l: 'viper', sh: 'none', bp: 'repair' } },
  { id: 'dimas', name: 'Dimas Prakoso', call: 'GARUDA-5', role: 'Spesialis Misil', acc: 9, eva: 5, skill: 'ZOOM', color: '#68608a', accent: '#9dff6b', visor: '#d0a8ff', sec: '#3b3650', join: 2, design: { head: 'visor', pad: 'angular', mark: 'number', num: 5 },
    load: { frame: 'vanguard', r: 'hornet', l: 'none', sh: 'harpoon', bp: 'repair' } },
];

const ENEMY_T = {
  scout: { name: 'Scout', frame: 'wisp', r: 'wasp', l: 'knuckle', sh: 'none', bp: 'none', ai: 'aggro', color: '#8a4a32', sec: '#3a3230', design: { head: 'mono', pad: 'slim', mark: 'hazard' } },
  gunner: { name: 'Gunner', frame: 'vanguard', r: 'viper', l: 'aegis', sh: 'none', bp: 'none', ai: 'aggro', color: '#7a3a35', sec: '#4a4040', design: { head: 'mono', pad: 'angular', mark: 'number', num: 7 } },
  rifle: { name: 'Marksman', frame: 'vanguard', r: 'longbow', l: 'aegis', sh: 'none', bp: 'none', ai: 'ranged', color: '#5f5a3e', sec: '#3c3a2c', accent: '#c94a3a', design: { head: 'sniper', pad: 'angular', mark: 'stripe' } },
  missile: { name: 'Artileri', frame: 'vanguard', r: 'viper', l: 'none', sh: 'sparrow', bp: 'none', ai: 'ranged', color: '#6a4a3a', sec: '#3e3a36', design: { head: 'dome', pad: 'layered', mark: 'hazard' } },
  brawler: { name: 'Brawler', frame: 'kestrel', r: 'cyclone', l: 'blade', sh: 'none', bp: 'none', ai: 'aggro', color: '#9a2f2f', sec: '#2a2224', accent: '#e8e2d4', visor: '#ff9a2a', design: { head: 'horn', pad: 'spike', mark: 'skull' } },
  heavy: { name: 'Juggernaut', frame: 'goliath', r: 'tempest', l: 'bulwark', sh: 'harpoon', bp: 'repair', ai: 'aggro', color: '#4a3a3a', sec: '#6a2a24', accent: '#ffd24a', design: { head: 'mono', pad: 'layered', mark: 'hazard' } },
  sniper: { name: 'Sniper', frame: 'kestrel', r: 'railspike', l: 'none', sh: 'none', bp: 'sensor', ai: 'ranged', color: '#4b4458', sec: '#2e2a36', accent: '#9a8ab0', visor: '#7dff6a', design: { head: 'sniper', pad: 'slim', mark: 'camo' } },
  grenadier: { name: 'Grenadier', frame: 'vanguard', r: 'thunder', l: 'none', sh: 'none', bp: 'none', ai: 'ranged', color: '#6a5030', sec: '#3a3226', accent: '#ffd24a', design: { head: 'dome', pad: 'layered', mark: 'hazard' } },
  flamer: { name: 'Flamer', frame: 'kestrel', r: 'salamander', l: 'rod', sh: 'none', bp: 'none', ai: 'aggro', color: '#a0482a', sec: '#3a2420', accent: '#ffb43c', visor: '#ffb43c', design: { head: 'mono', pad: 'spike', mark: 'stripe' } },
  boss: { name: 'TYRANT', frame: 'tyrant', r: 'hornet', l: 'pile', sh: 'harpoon', bp: 'repair2', ai: 'aggro', boss: true, skill: 'DOUBLE', pilot: 'Kol. Drago Varn', color: '#2d2d33', sec: '#4a1a18', accent: '#d4a73a', visor: '#ff3a2a', design: { head: 'tyrant', pad: 'spike', mark: 'skull' } },
};
const ENEMY_NAMES = ['Sersan Orlov', 'Letnan Kessler', 'Kopral Vasko', 'Sersan Brandt', 'Letnan Morva', 'Kapten Ilyin', 'Kopral Drez', 'Sersan Halvar', 'Letnan Petrova', 'Kopral Zeman', 'Sersan Radek', 'Letnan Voss'];

const TERRAIN = {
  grass: { name: 'Padang Rumput', eva: 0, cost: 1 },
  dirt: { name: 'Tanah', eva: 0, cost: 1 },
  sand: { name: 'Pasir', eva: 0, cost: 1 },
  snow: { name: 'Salju', eva: 0, cost: 1 },
  road: { name: 'Jalan Raya', eva: 0, cost: 1 },
  concrete: { name: 'Beton', eva: 0, cost: 1 },
  metal: { name: 'Pelat Baja', eva: 0, cost: 1 },
  forest: { name: 'Hutan', eva: 15, cost: 2 },
  rock: { name: 'Bebatuan', eva: 10, cost: 2 },
  rubble: { name: 'Reruntuhan', eva: 10, cost: 2 },
  crate: { name: 'Kontainer', eva: 12, cost: 2 },
  building: { name: 'Atap Gedung', eva: 5, cost: 1 },
  water: { name: 'Air Dalam', eva: 0, cost: 99, block: true },
};

const THEMES = {
  grass: {
    sky: ['#4f86b8', '#f0d9a8'], bg: ['#1b2b22', '#070b09'],
    tile: { grass: '#6a8d40', dirt: '#8a7048', forest: '#5a7e36', rock: '#728846', building: '#8f918c', water: '#3c7fa6', concrete: '#979690', road: '#77746c' },
    side: '#5e4a33', rockCol: '#86857a', crateCol: '#7a5a36', tree: ['#2d5a2a', '#43793a'], treeType: 'round',
    cine: { far: 'hills', farCol: '#5e7f92', midCol: '#3b5838', ground: ['#5f7d3c', '#26361b'], sunX: 0.76, sunY: 0.32, sun: '#fff1c0', amb: 'leaf' },
  },
  desert: {
    sky: ['#3d2f57', '#f6a35a'], bg: ['#2b1f1a', '#0b0706'],
    tile: { sand: '#d3a868', dirt: '#b48550', rock: '#c99d63', crate: '#cfa365', building: '#b8a387', concrete: '#a89d86' },
    side: '#8d6a42', rockCol: '#9a7656', crateCol: '#9b4a2e',
    cine: { far: 'dunes', farCol: '#9a5848', midCol: '#6e4234', ground: ['#c99a5e', '#5e4027'], sunX: 0.3, sunY: 0.82, sun: '#ffcf7a', amb: 'dust' },
  },
  snow: {
    sky: ['#7d97b6', '#e3eaf2'], bg: ['#1c2633', '#080b10'],
    tile: { snow: '#e3eaf1', dirt: '#aeb8c3', forest: '#d3dde6', rock: '#cbd5df', water: '#4f7ea5', building: '#959fab' },
    side: '#7d8896', rockCol: '#7f8995', crateCol: '#6d5a48', tree: ['#24443a', '#2f5648'], treeType: 'pine', snowCap: true,
    cine: { far: 'mount', farCol: '#8796ab', midCol: '#56657a', ground: ['#dfe7ee', '#8c9aa8'], sunX: 0.62, sunY: 0.3, sun: '#ffffff', amb: 'snow' },
  },
  urban: {
    sky: ['#04081a', '#26345a'], bg: ['#0e1424', '#030509'], night: true,
    tile: { concrete: '#555963', road: '#393d46', grass: '#2f442f', rubble: '#4f525a', crate: '#555963', building: '#4a505e' },
    side: '#2b2e35', rockCol: '#6b675f', crateCol: '#3f5c7a',
    cine: { far: 'city', farCol: '#1a2440', midCol: '#0f1522', ground: ['#2b3038', '#0b0e12'], sunX: 0.8, sunY: 0.22, sun: '#dfe8ff', amb: 'rain' },
  },
  fortress: {
    sky: ['#16070a', '#b0452a'], bg: ['#2a1210', '#070303'],
    tile: { metal: '#5a5f66', concrete: '#6c6762', rubble: '#5d5650', crate: '#5a5f66', building: '#4d5157', dirt: '#5d4a3b' },
    side: '#33363b', rockCol: '#6d6158', crateCol: '#7a5a2a',
    cine: { far: 'fort', farCol: '#3a1c1c', midCol: '#1f1111', ground: ['#4a3a32', '#160f0d'], sunX: 0.5, sunY: 0.96, sun: '#ff6a3a', amb: 'ember' },
  },
};

const GEN = {
  grass: { base: 'grass', alt: 'dirt', deco: 'forest', decoT: 0.62, rock: 'rock', rockP: 0.04, bld: [2, 2], water: 0.1, hmax: 2 },
  desert: { base: 'sand', alt: 'dirt', deco: 'rock', decoT: 0.72, rock: 'crate', rockP: 0.05, bld: [4, 2], water: 0, hmax: 2 },
  snow: { base: 'snow', alt: 'dirt', deco: 'forest', decoT: 0.6, rock: 'rock', rockP: 0.05, bld: [2, 2], water: 0.09, hmax: 3 },
  urban: { base: 'concrete', alt: 'grass', deco: 'rubble', decoT: 0.74, rock: 'crate', rockP: 0.05, bld: [8, 3], water: 0, hmax: 1, roads: true },
  fortress: { base: 'metal', alt: 'concrete', deco: 'rubble', decoT: 0.72, rock: 'crate', rockP: 0.06, bld: [6, 3], water: 0, hmax: 2 },
};

const MISSIONS = [
  {
    code: 'OP-01', name: 'POS PERBATASAN', theme: 'grass', seed: 1207, w: 12, h: 12, reward: 2500, lvl: 1,
    time: '06:40 — LEMBAH SENDANG', enemies: ['scout', 'gunner', 'gunner', 'scout'], unlock: ['cyclone', 'kestrel', 'bulwark', 'stinger', 'rod', 'carbine'], gift: ['carbine', 'wasp'],
    brief: 'Pukul 04:00 pagi tadi, pasukan Republik Valkar melintasi garis demarkasi dan merebut pos pengintai di Lembah Sendang.\n\nSkuadron Garuda, rebut kembali pos itu dan hancurkan semua unit musuh.\n\nINTEL: 4 unit ringan-sedang. Gunakan hutan sebagai perlindungan (+15 evasi). Serang bersama-sama agar rekan di dekatmu ikut menembak (LINK).',
  },
  {
    code: 'OP-02', name: 'KILANG GURUN', theme: 'desert', seed: 3311, w: 13, h: 13, reward: 3200, lvl: 2,
    time: '17:25 — KILANG TANJUNG MERAH', enemies: ['gunner', 'rifle', 'missile', 'scout', 'grenadier'], unlock: ['goliath', 'pile', 'repair2', 'thunder', 'falcon', 'salamander'], gift: ['thunder', 'repair'],
    brief: 'Valkar menduduki kilang minyak Tanjung Merah untuk memutus pasokan bahan bakar Aliansi.\n\nUnit artileri misil terdeteksi di belakang garis musuh. Misil punya jarak minimum 3 petak, jadi dekati mereka secepatnya.\n\nINTEL: 5 unit, termasuk penembak jitu ber-rifle.',
  },
  {
    code: 'OP-03', name: 'CELAH SALJU', theme: 'snow', seed: 5150, w: 13, h: 13, reward: 3800, lvl: 3,
    time: '09:10 — CELAH MERAPI UTARA', enemies: ['heavy', 'rifle', 'missile', 'brawler', 'flamer', 'scout'], unlock: ['harpoon', 'tempest', 'blade', 'hailstorm', 'sensor', 'ammo'], gift: ['falcon', 'sensor'],
    brief: 'Konvoi lapis baja Valkar menembus Celah Merapi Utara menuju ibu kota.\n\nKapten Dimas Prakoso (GARUDA-5), spesialis misil, bergabung dengan skuadron mulai misi ini.\n\nINTEL: Juggernaut kelas berat terdeteksi. Hancurkan lengannya untuk melumpuhkan senjatanya, atau hancurkan kakinya agar ia tak bisa bergerak.',
  },
  {
    code: 'OP-04', name: 'PELABUHAN MALAM', theme: 'urban', seed: 7741, w: 14, h: 14, reward: 4500, lvl: 4,
    time: '23:50 — PELABUHAN SUNDA KELAPA', enemies: ['sniper', 'missile', 'brawler', 'heavy', 'grenadier', 'flamer'], unlock: ['railspike', 'bastion', 'hammer', 'ravager', 'hydra', 'quake'], gift: ['blade', 'hydra'],
    brief: 'Operasi malam. Valkar membangun jembatan logistik lewat pelabuhan kota.\n\nGedung-gedung tinggi bisa dinaiki frame ringan dan sedang. Penembak di posisi tinggi mendapat bonus akurasi.\n\nINTEL: Sniper bersenjata railgun bersembunyi di antara gedung. Hati-hati.',
  },
  {
    code: 'OP-05', name: 'BENTENG BESI', theme: 'fortress', seed: 9091, w: 14, h: 14, reward: 6000, lvl: 5, boss: true,
    time: '05:30 — BENTENG BESI, VALKAR', enemies: ['boss', 'heavy', 'sniper', 'brawler', 'missile', 'grenadier', 'flamer'], unlock: [], gift: [],
    brief: 'Inilah serangan terakhir: markas komando Valkar, Benteng Besi.\n\nKolonel Drago Varn memimpin langsung dengan prototipe raksasa TYRANT. Hancurkan TYRANT dan perang berakhir.\n\nINTEL: TYRANT punya armor sangat tebal dan skill DOUBLE. Lumpuhkan lengannya lebih dulu.',
  },
];

// ---------- UPGRADE (per jenis item; batas level = jumlah stage yang sudah selesai) ----------
const UP_MAX = 5;
function upgradable(id) { return id !== 'none' && (!!FRAMES[id] || (!!WEAPONS[id] && WEAPONS[id].type !== 'NONE')); }
function upFrame(id, lv = 0) {
  const f = FRAMES[id];
  if (!lv) return f;
  const m = 1 + 0.08 * lv;
  return { ...f, body: Math.round(f.body * m), arm: Math.round(f.arm * m), legs: Math.round(f.legs * m), power: f.power + 2 * lv, lv, name: `${f.name} +${lv}` };
}
function upWeapon(id, lv = 0) {
  const w = WEAPONS[id] || WEAPONS.none;
  if (w.type === 'NONE') return { ...w };
  if (!lv) return { ...w, lv: 0 };
  if (w.type === 'SHIELD') return { ...w, chance: w.chance + 4 * lv, block: Math.round((w.block + 0.03 * lv) * 100) / 100, lv, name: `${w.name} +${lv}` };
  return { ...w, dmg: Math.round(w.dmg * (1 + 0.1 * lv)), acc: w.acc + 2 * lv, lv, name: `${w.name} +${lv}` };
}
function upCost(id, lv) { return Math.max(300, Math.round((itemInfo(id).price || 2000) * 0.25 * lv / 100) * 100); }
function upItem(id, lv) { return FRAMES[id] ? upFrame(id, lv) : upWeapon(id, lv); }
function upDesc(id) {
  if (FRAMES[id]) return 'HP +8% · DAYA +2 per level';
  return WEAPONS[id].type === 'SHIELD' ? 'Peluang blok +4% · Tahan +3% per level' : 'DAMAGE +10% · AKURASI +2 per level';
}

// ---------- PEGANGAN DUA TANGAN (Sniper & senjata ledakan) ----------
const TWO_HAND = ['SR', 'BZ', 'GL'];
const GRIP_BONUS = 15, GRIP_PEN = 15;
// mod akurasi: tangan lain kosong & utuh = +15, tangan lain memegang sesuatu / hancur = -15
function gripMod(wid, otherId, otherAlive = true) {
  const w = WEAPONS[wid];
  if (!w || !TWO_HAND.includes(w.type)) return 0;
  return otherId === 'none' && otherAlive ? GRIP_BONUS : -GRIP_PEN;
}
// cara mengayun senjata jarak dekat
const MELEE_KIND = { knuckle: 'thrust', pile: 'thrust', rod: 'slash', blade: 'slash', hammer: 'smash' };

function itemInfo(id) { return FRAMES[id] || WEAPONS[id] || BACKPACKS[id]; }
function itemKind(id) {
  if (FRAMES[id]) return 'frame';
  if (BACKPACKS[id] && id !== 'none') return 'bp';
  const w = WEAPONS[id];
  return w && w.type === 'MSL' ? 'sh' : 'arm';
}
function itemTag(id) {
  const k = itemKind(id);
  if (k === 'frame') return '<span class="tag t-FRAME">FRM</span>';
  if (k === 'bp') return '<span class="tag t-BP">BP</span>';
  const w = WEAPONS[id];
  return `<span class="tag t-${w.type}">${TYPE_ICON[w.type]}</span>`;
}
function itemStats(id, lv = 0) {
  const k = itemKind(id), it = k === 'bp' ? BACKPACKS[id] : lv ? upItem(id, lv) : itemInfo(id);
  if (id === 'none') return '';
  if (k === 'frame') return `HP ${it.body}/${it.arm}/${it.legs} · GRK ${it.move} · LMP ${it.jump} · EVA ${it.eva} · DAYA ${it.power}`;
  if (k === 'bp') return `${it.desc} · BBT ${it.wt}`;
  if (it.type === 'SHIELD') return `BLOK ${it.chance}% · -${Math.round(it.block * 100)}% · BBT ${it.wt}`;
  return `${it.dmg}×${it.hits}${it.blast ? ' LEDAKAN' : ''} · R${it.rmin}-${it.rmax} · AKU ${it.acc} · AP ${it.ap}${it.ammo ? ' · AMU ' + it.ammo : ''} · BBT ${it.wt}${TWO_HAND.includes(it.type) ? ' · 2 TANGAN' : ''}`;
}
