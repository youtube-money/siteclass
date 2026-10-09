"use strict";
// NEON SOULS HTML5 - game logic (port of the Python edition)
class Pool {
  constructor(make) { this.make = make; this.list = []; this.free = []; }
  get() { const o = this.free.length ? this.free.pop() : this.make(); o.dead = false; this.list.push(o); return o; }
  sweep() { const l = this.list; let j = 0; for (let i = 0; i < l.length; i++) { const o = l[i]; if (o.dead) this.free.push(o); else l[j++] = o; } l.length = j; }
  clear() { for (const o of this.list) this.free.push(o); this.list.length = 0; }
}
const mkEB = () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 6, col: PINK, kind: 0, t: 0, life: 0, ang: 0, rad: 0, spin: 0, rel: 0, dead: false, grazed: false, dmg: 0 });
const mkPB = () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 1, r: 4, col: CYAN, kind: "n", pierce: 0, hit: [], age: 0, ph: 0, x0: 0, dead: false, life: 0, rr: 0, home: 0, tg: null });
const mkPart = () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, mx: 0, col: WHITE, sz: 2, dead: false });
const mkCoin = () => ({ x: 0, y: 0, vx: 0, vy: 0, val: 1, t: 0, auto: false, dead: false });
const SAVE_KEY = "neon_souls_html5_v1";
const wchoice = (items, weights) => { let s = 0; for (const w of weights) s += w; let r = Math.random() * s; for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };
const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

class Game {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext("2d", { alpha: false });
    this.world = document.createElement("canvas"); this.world.width = W; this.world.height = H;
    this.c = this.world.getContext("2d", { alpha: false });
    this.loadSave();
    this.audio = new AudioSys(); this.audio.sfxVol = this.sfx_vol; this.audio.musVol = this.mus_vol;
    this.deco = new Deco(); this.bgs = {}; this.bg_prev = null; this.bg_fade = 0;
    this.ship_sprites = {}; for (const s of SHIPS) this.ship_sprites[s.id] = makeShipSprite(s);
    this.vignette = this.makeVignette();
    this.state = "title"; this.t = 0; this.theme_i = 0;
    this.mouse = [W / 2, H - 120]; this.mode = "mouse"; this.touch = false; this.keys = new Set();
    this.btns = []; this.mdown = false; this.shake = 0; this.flash = 0; this.freeze = 0;
    this.tab = "ships"; this.shop_sel = this.ship_i; this.sel_stage = 1;
    this.fps_hist = []; this.low_t = 0; this.fps = 60;
    this.eb = new Pool(mkEB); this.pb = new Pool(mkPB); this.parts = new Pool(mkPart); this.coin_p = new Pool(mkCoin);
    this.toasts = []; this.cards = []; this.confirm = null;
    this.newRun(1, true); this.state = "title";
    this.audio.music(["menu"]);
  }
  // ------------------------------------------------------------ save
  loadSave() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {}; } catch (e) { d = {}; }
    this.coins = d.coins | 0; this.owned = new Set((d.owned || []).concat(["KNIGHT"]));
    const ids = SHIPS.map(s => s.id); const sid = d.ship || "KNIGHT";
    this.ship_i = ids.includes(sid) && this.owned.has(sid) ? ids.indexOf(sid) : 0;
    this.best = d.best | 0; this.hi = d.hi | 0;
    this.upg = {}; for (const u of UPG) this.upg[u[0]] = ((d.upg || {})[u[0]]) | 0;
    this.diff_i = (d.diff | 0) % DIFFS.length;
    this.sfx_vol = d.sfx === undefined ? .8 : +d.sfx; this.mus_vol = d.mus === undefined ? .55 : +d.mus;
    this.quality = d.quality === undefined ? 2 : d.quality | 0; this.auto_q = d.auto_q === undefined ? true : !!d.auto_q;
    this.autofire = d.autofire === undefined ? true : !!d.autofire;
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: this.coins | 0, owned: [...this.owned], ship: SHIPS[this.ship_i].id, best: this.best, hi: this.hi, upg: this.upg, diff: this.diff_i, sfx: this.sfx_vol, mus: this.mus_vol, quality: this.quality, auto_q: this.auto_q, autofire: this.autofire }));
    } catch (e) { }
  }
  makeVignette() {
    const cv = mk(W / 4, H / 4), g = cv.getContext("2d");
    for (let i = 0; i < 30; i++) { const k = i / 30; g.strokeStyle = "rgba(255,0,30," + (.59 * (1 - k) * (1 - k)).toFixed(3) + ")"; g.lineWidth = 1; g.strokeRect(i + .5, i + .5, W / 4 - 2 * i - 1, H / 4 - 2 * i - 1); }
    return cv;
  }
  // ------------------------------------------------------------ shortcuts
  get ship() { return SHIPS[this.ship_i]; }
  get st() { return STAGES[(this.stage - 1) % STAGES.length]; }
  get sti() { return (this.stage - 1) % STAGES.length; }
  has(k) { return this.best >= RELIC[k][1]; }
  toast(text, col, life) { this.toasts.push([text, col || WHITE, life || 170]); if (this.toasts.length > 5) this.toasts.shift(); }
  sfx(n, v, gap) { this.audio.play(n, v, gap); }
  bgFor(i) { if (!this.bgs[i]) this.bgs[i] = makeBg(STAGES[i]); return this.bgs[i]; }
  setTheme(i, fade) { if (i !== this.theme_i && fade) { this.bg_prev = this.bgFor(this.theme_i); this.bg_fade = 70; } this.theme_i = i; }
  // ------------------------------------------------------------ run
  recalc() {
    const s = this.ship, u = this.upg;
    this.maxhp = s.hp + 12 * u.hull + this.r_hp; this.dmgm = 1.4 * s.dmg * (1 + .07 * u.dmg) * this.r_dmg;
    this.ratem = (1 / s.rate) * (1 + .04 * u.rate) * this.r_rate; this.magr = 60 + 14 * u.mag + this.r_mag;
    this.coinm = (1 + .08 * u.bank) * this.r_coin * DIFFS[this.diff_i][3]; this.nrgm = (1 + .10 * u.nrg) * this.r_nrg;
  }
  newRun(start, init) {
    start = start || 1;
    this.r_hp = this.r_mag = 0; this.r_dmg = this.r_rate = this.r_coin = this.r_nrg = 1;
    this.shots = 2; this.pierce_b = 0; this.crit = 0; this.vamp = 0; this.aegis = 0; this.score = this.run_coins = 0;
    this.stage = start; this.recalc(); this.hp = this.hp_lag = this.maxhp; this.bombs = this.ship.bombs; this.energy = 50;
    this.tw = null; this.tw_t = 0; this.buffs = {}; this.combo = this.combo_t = 0; this.px = W / 2; this.py = H - 120;
    this.invuln = 0; this.cool = 0; this.phoenix_used = false; this.bomb_cd = 0; this.laser_t = this.laser_ch = 0; this.storm_t = 0;
    this.slow_on = false; this.drone_cd = 0; this.holes = []; this.bolts = []; this.rings = []; this.texts = []; this.items = [];
    this.enemies = []; this.beams = []; this.boss = null; this.dead_t = 0; this.coin_flash = 0; this.ts = 1; this.won = false;
    this.diff = DIFFS[this.diff_i]; this.pay = 0; this.hits_boss = 0;
    this.eb.clear(); this.pb.clear(); this.parts.clear(); this.coin_p.clear();
    if (!init) {
      for (let i = 0; i < start - 1; i++) this.applyCard(this.rollCards(1, true)[0][0], true);
      this.hp = this.hp_lag = this.maxhp;
    }
    this.startStage(true);
  }
  snapshot() {
    const keys = ["r_hp", "r_mag", "r_dmg", "r_rate", "r_coin", "r_nrg", "shots", "pierce_b", "crit", "vamp", "aegis", "bombs", "score"];
    this.snap = {}; for (const k of keys) this.snap[k] = this[k]; this.snap.stage = this.stage;
  }
  restoreSnapshot() { for (const k in this.snap) this[k] = this.snap[k]; this.recalc(); }
  startStage(first) {
    this.state = "play"; this.snapshot(); this.phase = "intro"; this.ptimer = 190; this.stage_t = 0;
    this.dur = 2700 + 90 * Math.min(this.stage, 14); this.spawn_cd = 80; this.elite_cd = 1100; this.boss = null;
    this.enemies.length = 0; this.eb.clear(); this.beams.length = 0; this.holes.length = 0; this.phoenix_used = false; this.hits_boss = 0;
    this.setTheme(this.sti, !first); this.hp = Math.min(this.maxhp, this.hp + .25 * this.maxhp); this.flash = .8;
    this.audio.music([this.sti, "play"]); this.audio.prefetch([this.sti, "boss"]); this.sfx("fanfare");
    this.px = W / 2; this.py = H - 120;
  }
  retryStage() {
    this.restoreSnapshot(); this.stage = this.snap.stage; this.hp = this.hp_lag = this.maxhp; this.invuln = 120; this.energy = Math.max(this.energy, 50);
    this.coin_p.clear(); this.items.length = 0; this.startStage(true);
  }
  // ------------------------------------------------------------ effects
  burst(x, y, col, n, speed) {
    const cap = [90, 220, 400][this.quality]; n = (n * [.5, .8, 1][this.quality]) | 0;
    for (let i = 0; i < n; i++) {
      if (this.parts.list.length > cap) return;
      const p = this.parts.get(), a = rnd(0, TAU), s = rnd(.5, speed);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = p.mx = randint(18, 40); p.col = col; p.sz = choice([2, 2, 3, 4]);
    }
  }
  ringFx(x, y, maxr, col, w, speed) { this.rings.push([x, y, 8, maxr, col, w || 3, speed || Math.max(6, maxr / 24)]); }
  pop(x, y, s, col) { this.texts.push([x, y, s, col || WHITE, 40]); }
  // ------------------------------------------------------------ damage / death
  bdmg(m) { return (6.5 + 1.15 * this.stage) * Math.pow(this.diff[1], .5) * (m === undefined ? 1 : m); }
  hurt(dmg) {
    if (this.invuln > 0 || this.state !== "play" || this.phase === "clear") return;
    if (this.aegis > 0) { this.aegis--; this.invuln = 40; this.ringFx(this.px, this.py, 90, ICE); this.pop(this.px, this.py - 34, "BLOCKED", ICE); this.sfx("shield"); return; }
    dmg = Math.floor(dmg); this.hp -= dmg; this.invuln = 55; this.shake = 14; this.flash = .35; this.hits_boss++; this.combo = this.combo >> 1;
    this.pop(this.px, this.py - 34, "-" + dmg, RED); this.burst(this.px, this.py, this.ship.col, 18, 6); this.ringFx(this.px, this.py, 100, RED); this.sfx("hurt");
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  die() {
    if (this.has("phoenix") && !this.phoenix_used) {
      this.phoenix_used = true; this.hp = this.maxhp * .5; this.invuln = 170; this.eb.clear(); this.beams.length = 0;
      this.ringFx(this.px, this.py, 700, ORANGE, 6, 18); this.ringFx(this.px, this.py, 450, GOLD, 4, 14);
      for (const e of this.enemies.slice()) this.dmgEnemy(e, 60);
      if (this.boss) this.dmgBoss(this.boss.maxhp * .04);
      this.flash = 1; this.shake = 25; this.toast("PHOENIX HEART!", ORANGE); this.sfx("phoenix"); return;
    }
    this.state = "dead"; this.dead_t = 0;
    this.burst(this.px, this.py, WHITE, 60, 11); this.burst(this.px, this.py, this.ship.col, 40, 9); this.ringFx(this.px, this.py, 320, RED, 5, 14);
    this.sfx("boom"); this.sfx("gameover"); this.audio.music(null); this.hi = Math.max(this.hi, this.score | 0); this.save();
  }
  // ------------------------------------------------------------ coins / items
  addCoins(v) { this.coins += v; this.run_coins += v; }
  coinVal(m) { return Math.max(1, Math.floor((3 + 2.3 * this.stage) * (m === undefined ? 1 : m) * this.coinm * (1 + Math.min(this.combo, 60) * .004))); }
  spawnCoins(x, y, n, val) {
    const cap = [60, 120, 220][this.quality];
    for (let i = 0; i < n; i++) {
      if (this.coin_p.list.length > cap) { this.addCoins(val); continue; }
      const c = this.coin_p.get(), a = rnd(0, TAU), s = rnd(1, 4.5);
      c.x = x; c.y = y; c.vx = Math.cos(a) * s; c.vy = Math.sin(a) * s - 2; c.val = val; c.t = randint(0, 60); c.auto = false;
    }
  }
  dropItem(x, y, kind) {
    if (!kind) {
      const pool = [["heal", 14], ["bomb", 7], ["aegis", 8], ["magnet", 7], ["drones", 5], ["over", 6], ["energy", 10], ["coins", 9], ["multi", 6]].concat(TIMED_WEAPONS.map(w => [w, 6]));
      kind = wchoice(pool.map(p => p[0]), pool.map(p => p[1]));
    }
    this.items.push({ x, y, kind, t: 0 });
  }
  pickup(it) {
    const k = it.kind, col = ITEMS[k][0];
    if (k === "heal") { this.hp = Math.min(this.maxhp, this.hp + .3 * this.maxhp); this.toast("HEART  +30% HP", col); }
    else if (k === "bomb") { this.bombs = Math.min(8, this.bombs + 1); this.toast("+1 BOMB", col); }
    else if (k === "aegis") { this.aegis = Math.min(5, this.aegis + 2); this.toast("AEGIS  blocks " + this.aegis + " hits", col); }
    else if (k === "magnet") { this.buffs.magnet = 900; this.toast("MAGNET  15s", col); }
    else if (k === "drones") { this.buffs.drones = 900; this.toast("SPIRIT DRONES  15s", col); }
    else if (k === "over") { this.buffs.over = 480; this.toast("OVERDRIVE  8s", col); }
    else if (k === "energy") { this.energy = Math.min(100, this.energy + 40); this.toast("ENERGY  +40", col); }
    else if (k === "coins") { const v = this.coinVal(6); this.addCoins(v); this.toast("COIN BAG  +" + v, col); }
    else if (k === "multi") { if (this.shots < 7) { this.shots++; this.toast("EXTRA SHOT  x" + this.shots, col); } else { this.score += 500; this.toast("MAX SHOTS  +500", col); } }
    else { this.tw = k; this.tw_t = TW_TIME; this.toast(WEAPONS[k].name + "  15s", col); }
    this.ringFx(it.x, it.y, 80, col); this.burst(it.x, it.y, col, 16, 5);
    this.sfx(TIMED_WEAPONS.includes(k) || k === "multi" ? "power" : "pickup");
  }
  // ------------------------------------------------------------ cards
  rollCards(n, offensive) {
    n = n || 3;
    let pool = CARDS.filter(c => !offensive || ["dmg", "rate", "shot", "hull", "pierce", "crit"].includes(c[0]));
    if (this.shots >= 7) pool = pool.filter(c => c[0] !== "shot");
    const out = []; pool = pool.slice();
    while (pool.length && out.length < n) { const c = wchoice(pool, pool.map(p => p[4])); pool.splice(pool.indexOf(c), 1); out.push(c); }
    if (!offensive && !out.some(c => ["dmg", "rate", "shot"].includes(c[0]))) out[out.length - 1] = choice(CARDS.filter(c => c[0] === "dmg" || c[0] === "rate"));
    return out;
  }
  applyCard(key) {
    if (key === "dmg") this.r_dmg *= 1.16; else if (key === "rate") this.r_rate *= 1.12; else if (key === "shot") this.shots = Math.min(7, this.shots + 1);
    else if (key === "hull") { this.r_hp += 30; this.recalc(); this.hp = Math.min(this.maxhp, this.hp + .5 * this.maxhp + 30); }
    else if (key === "aegis") this.aegis = Math.min(5, this.aegis + 2); else if (key === "bomb") this.bombs = Math.min(8, this.bombs + 2);
    else if (key === "pierce") this.pierce_b++; else if (key === "crit") this.crit = Math.min(.8, this.crit + .10);
    else if (key === "mag") this.r_mag += 70; else if (key === "nrg") this.r_nrg *= 1.35; else if (key === "coin") this.r_coin *= 1.2; else if (key === "vamp") this.vamp += 1.5;
    this.recalc();
  }
  // ------------------------------------------------------------ shooting
  curWeapon() { return this.tw_t > 0 && this.tw ? this.tw : this.ship.weapon; }
  mkB(x, y, a, w, o) {
    o = o || {}; const b = this.pb.get(), sp = o.spd === undefined ? w.spd : o.spd;
    b.x = x; b.y = y; b.x0 = x; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    b.dmg = (o.dmg === undefined ? w.dmg : o.dmg) * (o.dm === undefined ? 1 : o.dm); b.r = o.r === undefined ? w.r : o.r;
    b.col = w.col; b.kind = o.kind || "n"; b.pierce = (o.pierce === undefined ? w.pierce : o.pierce) + this.pierce_b;
    b.hit = []; b.age = 0; b.ph = rnd(0, 6); b.life = 0; b.rr = 0; b.home = 0; b.tg = null; return b;
  }
  fire() {
    const kind = this.curWeapon(), w = WEAPONS[kind], n = this.shots, over = (this.buffs.over || 0) > 0;
    const last = this.has("last") && this.hp < this.maxhp * .3;
    let dm = this.dmgm * (over ? 1.4 : 1) * (last ? 1.5 : 1);
    if (this.crit && Math.random() < this.crit) dm *= 3;
    const rate = this.ratem * (over ? 1.6 : 1) * (last ? 1.3 : 1);
    this.cool = Math.max(2, w.cd / rate);
    const x = this.px, y = this.py - 24, up = -Math.PI / 2, d2r = Math.PI / 180;
    const mkb = (xx, yy, a, o) => this.mkB(xx, yy, a, w, Object.assign({ dm }, o || {}));
    if (kind === "SPREAD" || kind === "FAN") { const cnt = n + 2; for (let i = 0; i < cnt; i++) mkb(x, y, up + (i - (cnt - 1) / 2) * (kind === "SPREAD" ? 9 : 8) * d2r); }
    else if (kind === "HOMING") { for (let i = 0; i < n; i++) { const b = mkb(x, y, up + (i - (n - 1) / 2) * 18 * d2r); b.home = .13; } }
    else if (kind === "NEEDLE") { for (let i = 0; i < n; i++) mkb(x + (i - (n - 1) / 2) * 9, y, up + rnd(-.05, .05)); }
    else if (kind === "TRIDENT") { const cnt = 1 + 2 * ((n + 1) >> 1); for (let i = 0; i < cnt; i++) { const off = i - (cnt - 1) / 2, b = mkb(x + off * 6, y, up, { kind: "tri" }); b.vx = off * 3.4; } }
    else if (kind === "RING") { for (let i = 0; i < Math.min(n, 3); i++) { const b = mkb(x, y - 8, up, { kind: "ring", spd: 2.6 }); b.rr = 10 + i * 18; b.life = 54; b.vx = 0; b.vy = -2.6; } }
    else if (kind === "WAVE") { for (let i = 0; i < n; i++) { const b = mkb(x, y, up, { kind: "wave" }); b.x0 = x + (i - (n - 1) / 2) * 24; b.ph = i * Math.PI; } }
    else if (kind === "SOLAR") {
      this.mkB(x, y, up, WEAPONS.RAIL, { dm, dmg: 5 });
      for (let i = 0; i < n; i++) { const b = this.mkB(x, y, up + (i - (n - 1) / 2) * .5, WEAPONS.HOMING, { dm, dmg: 1.2 }); b.home = .14; }
    } else { const gap = (kind === "PLASMA" || kind === "RAIL") ? 28 : 14; for (let i = 0; i < n; i++) mkb(x + (i - (n - 1) / 2) * gap, y, up); }
    this.sfx({ NEEDLE: "shoot_n", PLASMA: "shoot_p", HOMING: "shoot_h", RING: "shoot_r" }[kind] || "shoot", .35, 70);
  }
  // ------------------------------------------------------------ enemies
  spawnEnemy(kind, x, y, elite, vx, vy, hpm) {
    y = y === undefined ? -40 : y; vx = vx || 0; vy = vy || 0; hpm = hpm || 1;
    const sp = SPECIES[kind], pal = this.st.pal;
    const e = { kind, x, y, x0: x, vx, vy, t: 0, ph: rnd(0, TAU), r: sp.r * (elite ? 1.35 : 1), elite: !!elite, col: kind !== "shard" ? pal[0] : pal[1], col2: pal[1], hit: 0, aim: Math.PI / 2, dead: false, state: 0,
      fcd: rnd(30, sp.fr || 60), ty: rnd(90, 230), dirx: choice([-1, 1]), tele: 0, burst: 0, sang: rnd(0, TAU), leave: false, spd: sp.spd * (1 + .025 * Math.min(this.stage, 20)), life: 0, mv_side: 0, y0: undefined };
    e.maxhp = e.hp = sp.hp * (1 + .2 * (this.stage - 1)) * this.diff[2] * (elite ? 3.6 : 1) * hpm;
    if (kind === "dart" || kind === "shard") { const a = Math.atan2(this.py - y, this.px - x + rnd(-80, 80)); e.vx = Math.cos(a) * e.spd; e.vy = Math.sin(a) * e.spd; }
    this.enemies.push(e); return e;
  }
  spawnGroup() {
    const sp = this.st.species, prog = this.stage_t / this.dur;
    const g = wchoice(["line", "vee", "sides", "swarm", "shooter", "heavy"], [28, 14, 12, 14, 18 + prog * 10, 7 + prog * 14 + this.stage]);
    const [fod, fast, shoot, heavy] = sp;
    if (g === "line") { const n = randint(3, 5 + Math.min(3, this.stage >> 2)), k = choice([fod, fast]); for (let i = 0; i < n; i++) this.spawnEnemy(k, W * (i + 1) / (n + 1), -30 - (i % 2) * 20, false, 0, 0); }
    else if (g === "vee") { for (let i = -2; i <= 2; i++) this.spawnEnemy(fod, W / 2 + i * 70, -30 - Math.abs(i) * 38); }
    else if (g === "sides") { const k = choice([fod, shoot]), cnt = randint(2, 4); for (let i = 0; i < cnt; i++) { const s = choice([-1, 1]), e = this.spawnEnemy(k, s > 0 ? -30 : W + 30, rnd(70, 260) + i * 40); e.mv_side = s; } }
    else if (g === "swarm") { const cnt = randint(8, 12 + Math.floor(this.stage / 3)); for (let i = 0; i < cnt; i++) this.spawnEnemy(fast, W / 2 + rnd(-300, 300), -30 - i * 28); }
    else if (g === "shooter") { const cnt = randint(1, 2 + Math.floor(this.stage / 5)); for (let i = 0; i < cnt; i++) this.spawnEnemy(shoot, rnd(160, W - 160), -30 - i * 60); }
    else this.spawnEnemy(heavy, rnd(220, W - 220));
  }
  dmgEnemy(e, d) { if (e.dead) return; e.hp -= d; e.hit = 3; if (e.hp <= 0) this.killEnemy(e); else this.sfx("hit", .5, 45); }
  killEnemy(e) {
    e.dead = true; const sp = SPECIES[e.kind];
    this.burst(e.x, e.y, e.col, e.elite ? 26 : 16, 7); this.burst(e.x, e.y, WHITE, 4, 4); this.ringFx(e.x, e.y, 60 + 30 * (e.elite ? 1 : 0), e.col, 3);
    this.combo++; this.combo_t = 130; const mult = 1 + Math.min(this.combo, 100) / 25;
    this.score += Math.floor((20 + 6 * this.stage) * sp.val * (e.elite ? 4 : 1) * mult);
    this.energy = Math.min(100, this.energy + (2.2 + (e.elite ? 8 : 0)) * this.nrgm);
    if (this.vamp) this.hp = Math.min(this.maxhp, this.hp + this.vamp);
    this.sfx(e.elite || e.r > 25 ? "kill_big" : "kill", .7, 40);
    if ([10, 25, 50, 100, 200].includes(this.combo)) { this.toast("COMBO x" + this.combo + " !", YELLOW); this.sfx("power", .5); }
    const cv = this.coinVal(sp.val);
    if (e.elite) { this.spawnCoins(e.x, e.y, 6, cv); this.dropItem(e.x, e.y); this.freeze = 3; this.shake = Math.max(this.shake, 8); }
    else if (e.kind !== "shard") {
      if (Math.random() < .62) this.spawnCoins(e.x, e.y, 1 + (sp.hp >= 24 ? 1 : 0), cv);
      if (Math.random() < (sp.hp < 15 ? .085 : .2)) this.dropItem(e.x, e.y);
    }
    if (e.kind === "crystal") for (let i = 0; i < 3; i++) this.spawnEnemy("shard", e.x + (i - 1) * 22, e.y);
    if (e.kind === "mine") for (let i = 0; i < 8; i++) this.ebul(e.x, e.y, i * TAU / 8, 3.4, e.col2);
  }
  bsp(v) { return v * this.diff[1] * (1 + .018 * Math.min(this.stage, 24)); }
  ebul(x, y, a, sp, col, r, kind, dmg, kw) {
    kw = kw || {}; const b = this.eb.get();
    b.x = x; b.y = y; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.r = r === undefined ? 6 : r; b.col = col || PINK; b.kind = kind || 0; b.t = 0; b.grazed = false;
    b.life = kw.life === undefined ? 400 : kw.life; b.dmg = dmg !== undefined && dmg !== null ? dmg : this.bdmg();
    b.ang = kw.ang || 0; b.rad = kw.rad || 0; b.spin = kw.spin || 0; b.rel = kw.rel || 0; return b;
  }
  aimTo(x, y) { return Math.atan2(this.py - y, this.px - x); }
  enemyFire(e) {
    const fp = SPECIES[e.kind].fp;
    if (!fp || e.y < 10 || e.leave) return;
    const x = e.x, y = e.y, col = e.col2, bs = this.bsp(1), a = this.aimTo(x, y);
    if (fp === "aim") this.ebul(x, y + e.r * .5, a, 4.3 * bs, col);
    else if (fp === "tri") { for (const o of [-.26, 0, .26]) this.ebul(x, y + e.r * .5, a + o, 4.2 * bs, col); }
    else if (fp === "ring") { const n = 10 + Math.floor(this.stage / 3), off = rnd(0, TAU); for (let i = 0; i < n; i++) this.ebul(x, y, off + i * TAU / n, 2.9 * bs, col); }
    else if (fp === "fan") { for (let i = 0; i < 5; i++) this.ebul(x, y + e.r * .5, Math.PI / 2 + (i - 2) * .3 + (a - Math.PI / 2) * .5, 3.9 * bs, col); }
    else if (fp === "spiral") { e.sang += .55; for (let k = 0; k < 2; k++) this.ebul(x, y, e.sang + k * Math.PI, 3.4 * bs, col); }
    else if (fp === "burst") e.burst = 3;
    else if (fp === "snipe") e.tele = 38;
    else if (fp === "wall") { for (let i = -3; i <= 3; i++) this.ebul(x + i * 22, y + e.r * .6, Math.PI / 2, 3.5 * bs, col, 5); }
    else if (fp === "rain") { for (let i = 0; i < 3; i++) this.ebul(x + (i - 1) * 18, y, Math.PI / 2 + rnd(-.25, .25), rnd(3.2, 4.2) * bs, col); }
  }
  updateEnemies(ts) {
    const px = this.px, py = this.py;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sp = SPECIES[e.kind], mv = sp.mv; e.t += ts; const t = e.t; e.life += ts; if (e.hit) e.hit--;
      e.aim = Math.atan2(py - e.y, px - e.x); const s = e.spd * ts;
      if (e.mv_side) { e.x += e.mv_side * s * 1.6; e.y += Math.sin(t * .04) * .6; if ((e.mv_side > 0 && e.x > W + 60) || (e.mv_side < 0 && e.x < -60)) e.dead = true; }
      else if (mv === "sine") { e.y += s * .8; e.x = e.x0 + Math.sin(t * .04 + e.ph) * 90; }
      else if (mv === "dive") { e.x += e.vx * ts; e.y += e.vy * ts; }
      else if (mv === "zig") { e.y += s * .75; e.x += e.dirx * s * 1.5; if (Math.floor(t) % 45 === 0) e.dirx *= -1; e.x = clamp(e.x, 30, W - 30); }
      else if (mv === "drift") { e.y += s * .6; e.x += Math.sin(t * .03 + e.ph) * .9 * ts; }
      else if (mv === "swarm") { e.y += s * .9; e.x = e.x0 + Math.sin(t * .12 + e.ph) * 60; }
      else if (mv === "hover" || mv === "slow" || mv === "strafe") {
        if (e.leave) e.y -= 2.2 * ts;
        else if (e.y < e.ty) e.y += mv !== "slow" ? Math.min(s * 1.6, e.ty - e.y + .5) : s;
        else if (mv === "strafe") { e.x += e.dirx * s * 1.9; if (e.x < 60 || e.x > W - 60) e.dirx *= -1; }
        else if (mv === "hover") e.x = e.x0 + Math.sin(t * .02 + e.ph) * 110;
        if (t > (mv !== "slow" ? 900 : 1200) && !e.elite) e.leave = true;
        e.x = clamp(e.x, 30, W - 30);
      } else if (mv === "circle") { const a = t * .045 + e.ph; e.y0 = (e.y0 === undefined ? -40 : e.y0) + s * .45; e.x = e.x0 + Math.cos(a) * 120; e.y = e.y0 + Math.sin(a) * 70; }
      if (e.y > H + 70 || e.y < -120 || e.x < -100 || e.x > W + 100) { if (e.t > 20) e.dead = true; }
      if (sp.fp && !e.dead) {
        e.fcd -= ts;
        if (e.tele > 0) { e.tele -= ts; if (e.tele <= 0) { const a = this.aimTo(e.x, e.y); this.ebul(e.x, e.y, a, this.bsp(8), RED, 5); this.ebul(e.x, e.y, a + .06, this.bsp(7.4), RED, 4); } }
        if (e.burst > 0 && Math.floor(t) % 8 === 0) { e.burst--; this.ebul(e.x, e.y, this.aimTo(e.x, e.y), this.bsp(5.2), e.col2); }
        if (e.fcd <= 0) { this.enemyFire(e); const fr = sp.fr / (1 + .02 * this.stage) / (e.elite ? 1.4 : 1); e.fcd = fr * rnd(.85, 1.2); }
      }
      if (!e.dead && this.state === "play" && Math.hypot(e.x - px, e.y - py) < e.r + this.ship.hr + 3) {
        this.hurt(this.bdmg(1.8));
        if (["dart", "bat", "shard", "mine", "flame"].includes(e.kind) && !e.elite) { e.dead = true; this.burst(e.x, e.y, e.col, 14, 6); if (e.kind === "mine") this.killEnemy(e); }
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);
  }
  // ------------------------------------------------------------ boss
  spawnBoss() {
    const d = BOSSES[this.st.boss], hp = 700 * Math.pow(1.125, this.stage - 1) * this.diff[2] * (1 + .4 * Math.floor((this.stage - 1) / 12));
    this.boss = { id: this.st.boss, d, x: W / 2, y: -140, hp, maxhp: hp, r: d.r, col: d.col, col2: d.col2, t: 0, state: "enter", aim: Math.PI / 2, hit: 0, ready: false, phase: -1, cd: [], streams: [], tx: W / 2, ty: 150, ct: 0, mv: d.mv, nph: d.phases.length };
    this.setPhase(this.boss, 0, true);
  }
  setPhase(b, i, silent) {
    b.phase = i; b.cd = b.d.phases[i].map(a => a.cd * rnd(.5, 1) + 30);
    if (!silent) { this.eb.clear(); this.beams.length = 0; this.ringFx(b.x, b.y, 500, b.col, 6, 16); this.flash = .6; this.shake = 20; this.toast("PHASE " + (i + 1) + " / " + b.nph, b.col2); this.sfx("roar", .6); }
  }
  dmgBoss(d) {
    const b = this.boss; if (!b || !b.ready) return;
    b.hp -= d; b.hit = 3; this.energy = Math.min(100, this.energy + .02 * this.nrgm * Math.min(d, 10));
    if (b.hp <= 0) this.bossDead();
    else { const i = Math.min(b.nph - 1, Math.floor((1 - b.hp / b.maxhp) * b.nph)); if (i !== b.phase) this.setPhase(b, i); }
  }
  bossDead() {
    const b = this.boss; this.boss = null;
    for (let i = 0; i < 12; i++) this.burst(b.x + rnd(-80, 80), b.y + rnd(-60, 60), choice([b.col, WHITE, YELLOW]), 24, 9);
    this.ringFx(b.x, b.y, 900, WHITE, 8, 18); this.ringFx(b.x, b.y, 600, b.col, 6, 14); this.eb.clear(); this.beams.length = 0;
    for (const e of this.enemies) this.killEnemy(e); this.enemies = [];
    this.flash = 1; this.shake = 30; this.freeze = 12; this.phase = "clear"; this.ptimer = 260; this.boss_pos = [b.x, b.y];
    let pay = Math.floor(300 * Math.pow(this.stage, 1.35) * this.diff[3] * (1 + .1 * Math.floor((this.stage - 1) / 12)) * (1 + .1 * this.upg.bank) * this.r_coin);
    if (this.hits_boss === 0) { pay = Math.floor(pay * 1.25); this.toast("NO-HIT BONUS  +25%", GREEN); }
    this.addCoins(pay); this.pay = pay; this.score += Math.floor(5000 * this.stage * (1 + this.combo / 50));
    for (let i = 0; i < 36; i++) { const c = this.coin_p.get(), a = rnd(0, TAU), s = rnd(2, 9); c.x = b.x; c.y = b.y; c.vx = Math.cos(a) * s; c.vy = Math.sin(a) * s; c.val = 0; c.t = randint(0, 60); c.auto = true; }
    for (let i = 0; i < 3; i++) this.dropItem(b.x + rnd(-60, 60), b.y + rnd(-30, 30));
    const old = this.best; this.best = Math.max(this.best, this.stage);
    for (const r of RELICS) if (old < r[1] && r[1] <= this.best) { this.toast("NEW RELIC UNLOCKED:  " + r[2], GOLD, 300); this.sfx("unlock"); }
    this.hi = Math.max(this.hi, this.score | 0); this.sfx("boss_boom"); this.sfx("victory"); this.audio.music([this.sti, "play"]); this.save();
  }
  bossAtk(b, a) {
    const t = a.t, bs = this.bsp(1), x = b.x, y = b.y + b.r * .3, ang = this.aimTo(x, y), c1 = b.col2, c2 = b.col;
    if (t === "fan") { const n = a.n, sp = a.spread * Math.PI / 180; for (let i = 0; i < n; i++) this.ebul(x, y, ang + (n > 1 ? (i - (n - 1) / 2) * sp / Math.max(1, n - 1) : 0), a.sp * bs, c1); this.sfx("shoot", .25, 100); }
    else if (t === "ring") { const off = rnd(0, TAU); for (let i = 0; i < a.n; i++) this.ebul(x, y, off + i * TAU / a.n, a.sp * bs, i % 2 ? c2 : c1); }
    else if (t === "rain") { for (let i = 0; i < a.n; i++) this.ebul(rnd(30, W - 30), -12, Math.PI / 2 + rnd(-.08, .08), a.sp * bs * rnd(.85, 1.15), c1, 5); }
    else if (t === "spiral") b.streams.push({ k: "spiral", left: a.dur, every: a.rate, tick: 0, arms: a.arms, ang: rnd(0, TAU), sp: a.sp });
    else if (t === "burst") b.streams.push({ k: "burst", left: a.n * 8, every: 8, tick: 0, sp: a.sp });
    else if (t === "wall") { const gap = clamp(this.px + rnd(-90, 90), 120, W - 120); for (let xx = 20; xx < W; xx += 38) if (Math.abs(xx - gap) > 80) this.ebul(xx, y, Math.PI / 2, a.sp * bs, c2, 6); }
    else if (t === "beamv") {
      const xs = [this.px]; for (let i = 0; i < a.n - 1; i++) xs.push(clamp(this.px + (i % 2 === 0 ? 1 : -1) * (130 + 110 * (i >> 1)), 30, W - 30));
      for (const xx of xs) this.beams.push({ x: xx, y: -20, ang: Math.PI / 2, len: H + 60, w: 42, tele: 60, life: 36, col: c2, rot: 0, follow: false, hitcd: 0 });
      this.sfx("laser_charge", .4);
    } else if (t === "sweep") {
      const s = choice([-1, 1]); this.beams.push({ x, y, ang: ang - s * .9, len: 1500, w: 30, tele: 55, life: 120, col: c2, rot: s * (.0165 * (1 + .1 * this.diff_i)), follow: true, hitcd: 0 }); this.sfx("laser_charge", .4);
    } else if (t === "orbit") { const n = a.n; for (let i = 0; i < n; i++) this.ebul(x, y, 0, 0, c1, 6, 3, null, { ang: i * TAU / n, rad: 92, spin: .045, rel: 70 + i * 9, life: 600 }); }
    else if (t === "summon") { const sp = this.st.species; for (let i = 0; i < a.n; i++) { const e = this.spawnEnemy(sp[i % 2], x + (i - (a.n - 1) / 2) * 90, y); e.ty = rnd(200, 300); } }
    else if (t === "charge") { b.state = "charge"; b.ct = 0; this.sfx("laser_charge", .5); }
    else if (t === "homing") { for (let i = 0; i < a.n; i++) this.ebul(x, y, ang + (i - (a.n - 1) / 2) * .6, 2.8 * bs, c1, 7, 1, null, { life: 300 }); }
    else if (t === "mines") { for (let i = 0; i < a.n; i++) this.ebul(x, y, rnd(.3, Math.PI - .3), rnd(3.4, 5) * bs, c2, 8, 2, null, { life: 200 }); }
  }
  updateBoss(ts) {
    const b = this.boss; if (!b) return;
    b.t += ts; if (b.hit) b.hit--; b.aim = this.aimTo(b.x, b.y);
    if (b.state === "enter") { b.y += (b.ty - b.y) * .035 * ts + .6; if (b.y >= b.ty - 6) { b.state = "fight"; b.ready = true; } return; }
    const t = b.t;
    if (b.state === "charge") {
      b.ct += ts;
      if (b.ct < 45) b.x += Math.sin(b.ct * 1.5) * 3;
      else if (b.ct < 70) { b.y += 18 * ts; b.x += clamp(this.px - b.x, -3, 3); }
      else if (b.ct < 74) { this.ringFx(b.x, b.y, 250, b.col, 5); for (let i = 0; i < 18; i++) this.ebul(b.x, b.y, i * TAU / 18, this.bsp(4.4), b.col2); this.shake = 16; b.ct = 75; }
      else { b.y += (b.ty - b.y) * .06 * ts; if (Math.abs(b.y - b.ty) < 8) b.state = "fight"; }
    } else {
      if (b.mv === "sway") { b.tx = W / 2 + Math.sin(t * .012) * W * .3; b.x += (b.tx - b.x) * .05 * ts; b.y += (150 + Math.sin(t * .02) * 18 - b.y) * .05 * ts; }
      else if (b.mv === "sweep") { b.x += (W / 2 + Math.sin(t * .02) * W * .38 - b.x) * .08 * ts; b.y += (135 + Math.cos(t * .04) * 30 - b.y) * .05 * ts; }
      else { if (Math.floor(t) % 170 === 0) { b.tx = rnd(220, W - 220); b.ty = rnd(115, 230); } b.x += (b.tx - b.x) * .03 * ts; b.y += (b.ty - b.y) * .03 * ts; }
      const fast = 1 + .06 * this.diff_i, ph = b.d.phases[b.phase];
      for (let i = 0; i < ph.length; i++) { b.cd[i] -= ts * fast; if (b.cd[i] <= 0 && b.state === "fight") { this.bossAtk(b, ph[i]); b.cd[i] = ph[i].cd * rnd(.9, 1.15); } }
    }
    for (const s of b.streams) {
      s.left -= ts; s.tick += ts;
      if (s.tick >= s.every) {
        s.tick = 0; const bs = this.bsp(1);
        if (s.k === "spiral") { s.ang += .21; for (let k = 0; k < s.arms; k++) this.ebul(b.x, b.y, s.ang + k * TAU / s.arms, s.sp * bs, k % 2 ? b.col2 : b.col); }
        else this.ebul(b.x, b.y, this.aimTo(b.x, b.y), s.sp * bs, b.col2, 6);
      }
    }
    b.streams = b.streams.filter(s => s.left > 0);
    if (this.state === "play" && b.ready && Math.hypot(b.x - this.px, b.y - this.py) < b.r * .8 + this.ship.hr) this.hurt(this.bdmg(2.5));
  }
  // ------------------------------------------------------------ bullets
  nearest(x, y, maxd) {
    let best = null, bd = maxd || 9999;
    for (const e of this.enemies) if (e.y > -10) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { best = e; bd = d; } }
    const b = this.boss; if (b && b.ready) { const d = Math.hypot(b.x - x, b.y - y) - b.r * .5; if (d < bd) { best = b; bd = d; } }
    return best;
  }
  hitTarget(b, tgt) {
    const d = b.dmg;
    if ("ready" in tgt) { this.dmgBoss(d); this.sfx("hit_b", .45, 60); } else this.dmgEnemy(tgt, d);
    this.burst(b.x, b.y, b.col, 2, 3);
    if (this.has("chain") && Math.random() < .22) {
      let cur = tgt; const done = new Set([tgt]);
      for (let k = 0; k < 3; k++) {
        let nx = null, bd = 190;
        for (const e of this.enemies) if (!done.has(e) && !e.dead) { const dd = Math.hypot(e.x - cur.x, e.y - cur.y); if (dd < bd) { nx = e; bd = dd; } }
        if (!nx) break;
        done.add(nx); this.bolts.push([[[cur.x, cur.y], [nx.x, nx.y]], 9, CYAN]); this.dmgEnemy(nx, d * .6); cur = nx;
      }
      this.sfx("zap", .3, 80);
    }
  }
  updatePBullets(ts) {
    const boss = this.boss;
    for (const b of this.pb.list) {
      b.age++; const k = b.kind;
      if (k === "ring") {
        b.rr += 6.2; b.y += b.vy * .5; b.life--; if (b.life <= 0) { b.dead = true; continue; }
        for (const e of this.enemies) if (!b.hit.includes(e) && Math.abs(Math.hypot(e.x - b.x, e.y - b.y) - b.rr) < e.r + 9) { b.hit.push(e); this.dmgEnemy(e, b.dmg); }
        if (boss && this.boss === boss && boss.ready && !b.hit.includes(boss) && Math.abs(Math.hypot(boss.x - b.x, boss.y - b.y) - b.rr) < boss.r + 9) { b.hit.push(boss); this.dmgBoss(b.dmg); }
        continue;
      }
      if (b.home) {
        if (b.tg === null || b.age % 12 === 0 || b.tg.dead) b.tg = this.nearest(b.x, b.y);
        const tg = b.tg;
        if (tg && !tg.dead) { const want = Math.atan2(tg.y - b.y, tg.x - b.x); let cur = Math.atan2(b.vy, b.vx); cur += clamp(angDiff(cur, want), -b.home, b.home); const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp; }
      }
      if (k === "wave") { b.y += b.vy; b.x = b.x0 + Math.sin(b.age * .22 + b.ph) * 42; }
      else if (k === "tri") { b.vx *= .955; b.x += b.vx; b.y += b.vy; }
      else { b.x += b.vx; b.y += b.vy; }
      if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) { b.dead = true; continue; }
      for (const e of this.enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        if (Math.abs(e.x - b.x) < e.r + b.r && Math.abs(e.y - b.y) < e.r + b.r + 6 && Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r + 3) {
          this.hitTarget(b, e);
          if (b.pierce <= 0) { b.dead = true; break; }
          b.pierce--; b.hit.push(e);
        }
      }
      if (!b.dead && boss && this.boss === boss && boss.ready && !b.hit.includes(boss) && Math.hypot(boss.x - b.x, boss.y - b.y) < boss.r * .95 + b.r) {
        this.hitTarget(b, boss);
        if (b.pierce <= 0) b.dead = true; else { b.pierce--; b.hit.push(boss); }
      }
    }
    this.pb.sweep(); this.enemies = this.enemies.filter(e => !e.dead);
  }
  updateEBullets(ts) {
    const px = this.px, py = this.py, hr = this.ship.hr, playing = this.state === "play" && this.phase !== "clear", boss = this.boss, blades = [];
    if (this.has("blades")) for (let i = 0; i < 3; i++) { const a = this.t * .09 + i * TAU / 3; blades.push([px + Math.cos(a) * 74, py + Math.sin(a) * 74]); }
    for (const b of this.eb.list) {
      b.t += ts; const k = b.kind;
      if (k === 1) { const want = Math.atan2(py - b.y, px - b.x); let cur = Math.atan2(b.vy, b.vx); cur += clamp(angDiff(cur, want), -.025 * ts, .025 * ts); const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp; }
      else if (k === 2) { b.vx *= .97; b.vy *= .97; if (b.t > 75) { for (let i = 0; i < 10; i++) this.ebul(b.x, b.y, i * TAU / 10 + b.t, this.bsp(3), b.col, 4); b.dead = true; continue; } }
      else if (k === 3) {
        if (!boss) { b.dead = true; continue; }
        b.ang += b.spin * ts; b.x = boss.x + Math.cos(b.ang) * b.rad; b.y = boss.y + Math.sin(b.ang) * b.rad;
        if (b.t >= b.rel) { const a = Math.atan2(py - b.y, px - b.x); b.kind = 0; b.vx = Math.cos(a) * this.bsp(6); b.vy = Math.sin(a) * this.bsp(6); }
        continue;
      }
      b.x += b.vx * ts; b.y += b.vy * ts; b.life -= ts;
      if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -60 || b.y > H + 40) { b.dead = true; continue; }
      for (const bl of blades) if ((b.x - bl[0]) ** 2 + (b.y - bl[1]) ** 2 < 576) { b.dead = true; this.burst(b.x, b.y, CYAN, 2, 3); break; }
      if (b.dead) continue;
      if (playing) {
        const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, rr = b.r + hr;
        if (d2 < rr * rr) { this.hurt(b.dmg); b.dead = true; }
        else if (!b.grazed && d2 < (b.r + 22) ** 2 && this.invuln <= 0) { b.grazed = true; this.energy = Math.min(100, this.energy + .7 * this.nrgm); this.score += 8; this.sfx("graze", .5, 50); }
      }
    }
    this.eb.sweep();
  }
  updateBeams(ts) {
    for (const bm of this.beams) {
      if (bm.tele > 0) { bm.tele -= ts; if (bm.follow && this.boss) { bm.x = this.boss.x; bm.y = this.boss.y; } continue; }
      bm.life -= ts;
      if (bm.follow) { bm.ang += bm.rot * ts; if (this.boss) { bm.x = this.boss.x; bm.y = this.boss.y; } }
      if (bm.hitcd > 0) bm.hitcd--;
      if (this.state === "play" && this.phase !== "clear") {
        const ca = Math.cos(bm.ang), sa = Math.sin(bm.ang), rx = this.px - bm.x, ry = this.py - bm.y, along = rx * ca + ry * sa, perp = Math.abs(-rx * sa + ry * ca);
        if (along > 0 && along < bm.len && perp < bm.w / 2 + this.ship.hr + 2) this.hurt(this.bdmg(1.6));
      }
    }
    this.beams = this.beams.filter(b => b.tele > 0 || b.life > 0);
  }
  updateItems() {
    const px = this.px, py = this.py, mag = this.magr * (this.buffs.magnet ? 3.2 : 1);
    for (const it of this.items) {
      it.t++; const d = Math.hypot(it.x - px, it.y - py);
      if (d < mag * 1.2) { it.x += (px - it.x) * .12; it.y += (py - it.y) * .12; } else it.y += 1.3;
      if (d < 30) { it.dead = true; this.pickup(it); }
    }
    this.items = this.items.filter(i => !i.dead && i.y < H + 30);
    const mag2 = this.magr * (this.buffs.magnet ? 3.5 : 1);
    for (const c of this.coin_p.list) {
      c.t++;
      if (c.auto) {
        c.vx *= .94; c.vy *= .94; if (c.t > 55) { c.x += (px - c.x) * .16; c.y += (py - c.y) * .16; } c.x += c.vx; c.y += c.vy;
        if (Math.hypot(c.x - px, c.y - py) < 28 && c.t > 30) { c.dead = true; this.sfx("coin2", .3, 45); }
        continue;
      }
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < mag2) { const f = d > 80 ? .16 : .3; c.x += (px - c.x) * f; c.y += (py - c.y) * f; }
      else { c.vx *= .96; c.vy = c.vy * .96 + .06; c.x += c.vx; c.y += c.vy; }
      if (d < 24) { c.dead = true; this.addCoins(c.val); this.sfx(["coin", "coin2", "coin3"][Math.min(2, Math.floor(this.combo / 25))], .45, 35); this.coin_flash = 10; this.pop(px + rnd(-12, 12), py - 28, "+" + c.val, GOLD); }
      else if (c.y > H + 20) c.dead = true;
    }
    this.coin_p.sweep();
  }
  updateFx() {
    for (const p of this.parts.list) { p.x += p.vx; p.y += p.vy; p.vx *= .96; p.vy *= .96; if (--p.life <= 0) p.dead = true; }
    this.parts.sweep();
    for (const r of this.rings) r[2] += r[6];
    this.rings = this.rings.filter(r => r[2] < r[3]);
    for (const t of this.texts) { t[1] -= .7; t[4]--; }
    this.texts = this.texts.filter(t => t[4] > 0);
    for (const b of this.bolts) b[1]--;
    this.bolts = this.bolts.filter(b => b[1] > 0);
    for (const t of this.toasts) t[2]--;
    this.toasts = this.toasts.filter(t => t[2] > 0);
    this.flash = Math.max(0, this.flash - .035); this.shake = Math.max(0, this.shake - .9); this.hp_lag += (this.hp - this.hp_lag) * .08;
    if (this.coin_flash > 0) this.coin_flash--;
  }
  // ------------------------------------------------------------ abilities
  canAct() { return this.state === "play" && this.phase !== "intro" && this.phase !== "clear"; }
  useBomb() {
    if (!this.canAct() || this.bombs <= 0 || this.bomb_cd > 0) return;
    this.bombs--; this.bomb_cd = 50; this.eb.clear(); this.beams.length = 0;
    this.ringFx(this.px, this.py, W * .9, PURPLE, 7, 24); this.ringFx(this.px, this.py, W * .65, CYAN, 5, 18);
    this.flash = .9; this.shake = 24; this.invuln = Math.max(this.invuln, 75);
    for (const e of this.enemies.slice()) this.dmgEnemy(e, 60 + 6 * this.stage);
    if (this.boss) this.dmgBoss(Math.max(40, this.boss.maxhp * .05));
    this.sfx("bomb");
  }
  usePulse() {
    if (!this.canAct() || !this.has("pulse") || this.energy < 35) return;
    this.energy -= 35; const R = 440;
    this.ringFx(this.px, this.py, R, CYAN, 6, 20); this.ringFx(this.px, this.py, R * .7, WHITE, 3, 16);
    for (const b of this.eb.list) if (Math.hypot(b.x - this.px, b.y - this.py) < R) { b.dead = true; this.score += 5; }
    this.eb.sweep();
    for (const e of this.enemies.slice()) if (Math.hypot(e.x - this.px, e.y - this.py) < R) this.dmgEnemy(e, 30 + 3 * this.stage);
    if (this.boss && Math.hypot(this.boss.x - this.px, this.boss.y - this.py) < R + 60) this.dmgBoss(Math.max(25, this.boss.maxhp * .025));
    this.invuln = Math.max(this.invuln, 25); this.flash = Math.max(this.flash, .4); this.shake = 12; this.sfx("pulse");
  }
  useLaser() { if (!this.canAct() || !this.has("laser") || this.energy < 100 || this.laser_t > 0 || this.laser_ch > 0) return; this.energy = 0; this.laser_ch = 40; this.sfx("laser_charge"); }
  useHole() { if (!this.canAct() || !this.has("hole") || this.energy < 60) return; this.energy -= 60; this.holes.push([this.px, Math.max(160, this.py - 280), 0]); this.sfx("hole"); }
  useStorm() { if (!this.canAct() || !this.has("storm") || this.energy < 80 || this.storm_t > 0) return; this.energy -= 80; this.storm_t = 96; this.sfx("storm"); this.flash = .5; }
  strike() {
    let tg = null;
    if (this.enemies.length && (!this.boss || Math.random() < .6)) tg = choice(this.enemies); else if (this.boss && this.boss.ready) tg = this.boss;
    const x = tg ? tg.x : rnd(80, W - 80), y = tg ? tg.y : rnd(100, 400);
    const pts = [[x + rnd(-20, 20), -10]]; let yy = 0, xx = x;
    while (yy < y) { yy += rnd(35, 70); xx += rnd(-24, 24); pts.push([xx, Math.min(yy, y)]); }
    pts.push([x, y]); this.bolts.push([pts, 14, [230, 240, 255]]);
    this.ringFx(x, y, 90, [200, 220, 255], 3, 10); this.burst(x, y, [200, 220, 255], 10, 6);
    for (const e of this.enemies.slice()) if (Math.hypot(e.x - x, e.y - y) < e.r + 70) this.dmgEnemy(e, 22 + 3 * this.stage);
    if (this.boss && this.boss.ready && Math.hypot(this.boss.x - x, this.boss.y - y) < this.boss.r + 70) this.dmgBoss(Math.max(14, this.boss.maxhp * .011));
    for (const b of this.eb.list) if (Math.hypot(b.x - x, b.y - y) < 90) b.dead = true;
    this.eb.sweep(); this.sfx("zap", .6, 40); this.shake = Math.max(this.shake, 6);
  }
  updateAbilities(ts) {
    if (this.laser_ch > 0) { this.laser_ch--; if (this.laser_ch === 0) { this.laser_t = 150; this.sfx("laser"); } }
    if (this.laser_t > 0) {
      this.laser_t--; this.shake = Math.max(this.shake, 4); const lx = this.px;
      for (const b of this.eb.list) if (Math.abs(b.x - lx) < 46 && b.y < this.py) b.dead = true;
      this.eb.sweep();
      for (const e of this.enemies) if (Math.abs(e.x - lx) < 38 + e.r && e.y < this.py) this.dmgEnemy(e, 5 * this.dmgm + 2);
      const bs = this.boss; if (bs && bs.ready && Math.abs(bs.x - lx) < 38 + bs.r * .9) this.dmgBoss(Math.max(3 * this.dmgm, bs.maxhp * .003));
      this.enemies = this.enemies.filter(e => !e.dead);
    }
    if (this.storm_t > 0) { this.storm_t--; if (this.storm_t % 7 === 0) this.strike(); }
    for (const h of this.holes) {
      h[2]++;
      for (const b of this.eb.list) { const dx = h[0] - b.x, dy = h[1] - b.y, d = Math.hypot(dx, dy) + .1; if (d < 300) { b.x += dx / d * 5; b.y += dy / d * 5; } if (d < 26) b.dead = true; }
      for (const e of this.enemies) { const dx = h[0] - e.x, dy = h[1] - e.y, d = Math.hypot(dx, dy) + .1; if (d < 300 && !e.elite) { e.x += dx / d * 2.2; e.y += dy / d * 2.2; } if (d < 100) this.dmgEnemy(e, .9 + .1 * this.stage); }
      if (this.boss && this.boss.ready && Math.hypot(this.boss.x - h[0], this.boss.y - h[1]) < 110 + this.boss.r) this.dmgBoss(Math.max(.5, this.boss.maxhp * .0011));
    }
    this.eb.sweep(); this.holes = this.holes.filter(h => h[2] < 230);
    if (this.has("blades")) for (let i = 0; i < 3; i++) {
      const a = this.t * .09 + i * TAU / 3, bx = this.px + Math.cos(a) * 74, by = this.py + Math.sin(a) * 74;
      for (const e of this.enemies) if (Math.hypot(e.x - bx, e.y - by) < e.r + 14 && e.life % 6 < 1) this.dmgEnemy(e, 1.3 * this.dmgm + 1);
      const bs = this.boss; if (bs && bs.ready && Math.hypot(bs.x - bx, bs.y - by) < bs.r + 14 && this.t % 8 === 0) this.dmgBoss(.9 * this.dmgm);
    }
    if (this.has("drones") || this.buffs.drones) {
      this.drone_cd--;
      if (this.drone_cd <= 0) {
        const tg = this.nearest(this.px, this.py);
        if (tg) for (const s of [-1, 1]) { const dx = this.px + s * 52, dy = this.py + 10, a = Math.atan2(tg.y - dy, tg.x - dx), b = this.mkB(dx, dy, a, WEAPONS.BLASTER, { dm: this.dmgm * .6, spd: 14, r: 3 }); b.col = [102, 255, 238]; }
        this.drone_cd = 18;
      }
    }
  }
  // ------------------------------------------------------------ flow
  director(ts) {
    if (this.phase === "intro") { if (--this.ptimer <= 0) this.phase = "wave"; }
    else if (this.phase === "wave") {
      this.stage_t += ts; this.spawn_cd -= ts; this.elite_cd -= ts; const cap = 12 + this.stage;
      if (this.stage_t < this.dur) {
        if (this.spawn_cd <= 0 && this.enemies.length < cap) { this.spawnGroup(); this.spawn_cd = Math.max(38, 125 - 3 * this.stage) * rnd(.75, 1.25); }
        if (this.elite_cd <= 0 && this.stage_t > 700) { this.spawnEnemy(choice(this.st.species.slice(1)), rnd(200, W - 200), -40, true); this.elite_cd = Math.max(560, 1000 - 25 * this.stage); this.toast("ELITE INCOMING", RED, 100); }
      } else if (this.enemies.length <= 2 || this.stage_t > this.dur + 420) { this.phase = "warn"; this.ptimer = 200; this.audio.music(null); this.sfx("warn"); }
    } else if (this.phase === "warn") {
      this.ptimer--; if (this.ptimer === 100) this.sfx("roar");
      if (this.ptimer <= 0) { this.phase = "boss"; this.spawnBoss(); this.audio.music([this.sti, "boss"]); }
    } else if (this.phase === "clear") {
      this.ptimer--; if (this.ptimer === 120) this.sfx("fanfare");
      if (this.ptimer <= 0) { if (this.stage === STAGES.length && this.best >= STAGES.length && !this.won) { this.won = true; this.state = "victory"; } else this.beginCards(); }
    }
  }
  beginCards() { this.cards = this.rollCards(3); this.state = "cards"; this.sfx("card"); }
  pickCard(i) { if (this.state !== "cards" || i >= this.cards.length) return; this.applyCard(this.cards[i][0]); this.sfx("unlock", .6); this.stage++; this.startStage(); }
  playerMove() {
    const s = this.ship.spd, K = this.keys;
    const kx = ((K.has("d") || K.has("right")) ? 1 : 0) - ((K.has("a") || K.has("left")) ? 1 : 0), ky = ((K.has("s") || K.has("down")) ? 1 : 0) - ((K.has("w") || K.has("up")) ? 1 : 0);
    if (kx || ky) { this.mode = "keys"; const n = Math.hypot(kx, ky); this.px += kx / n * s * .8; this.py += ky / n * s * .8; }
    else {
      const mx = this.mouse[0]; let my = this.mouse[1]; if (this.touch) my -= 85;
      const dx = mx - this.px, dy = my - this.py, d = Math.hypot(dx, dy);
      if (d > 1.5) { const v = Math.min(d * .32, s * 1.15); this.px += dx / d * v; this.py += dy / d * v; }
    }
    this.px = clamp(this.px, 26, W - 26); this.py = clamp(this.py, 90, H - 34);
  }
  updateBgFade() { if (this.bg_fade > 0) this.bg_fade--; }
  update() {
    this.t++;
    if (["title", "stages", "hangar", "vault", "settings", "controls"].includes(this.state)) {
      this.deco.update(STAGES[this.theme_i]);
      if (this.t % 540 === 0 && this.state === "title") this.setTheme((this.theme_i + 1) % STAGES.length, true);
      this.updateBgFade(); return;
    }
    if (this.state === "pause" || this.state === "cards" || this.state === "victory") { this.updateFx(); return; }
    if (this.freeze > 0) { this.freeze--; return; }
    let ts = 1;
    if (this.state === "play" && this.has("slow") && (this.keys.has("e") || this.slowBtn) && this.energy > 0 && this.phase !== "intro" && this.phase !== "clear") {
      ts = .4; this.energy = Math.max(0, this.energy - .42); if (!this.slow_on) { this.slow_on = true; this.sfx("slow_on"); }
    } else if (this.slow_on) { this.slow_on = false; this.sfx("slow_off"); }
    if (this.phase === "clear") ts = .55;
    this.ts = ts; this.deco.update(this.st, ts); this.updateBgFade();
    if (this.state === "dead") { this.dead_t++; this.updateFx(); this.updateEBullets(ts); return; }
    this.playerMove();
    if (this.invuln > 0) this.invuln--; if (this.bomb_cd > 0) this.bomb_cd--;
    this.energy = Math.min(100, this.energy + .028 * this.nrgm);
    for (const k of Object.keys(this.buffs)) { if (--this.buffs[k] <= 0) delete this.buffs[k]; }
    if (this.tw_t > 0) this.tw_t--;
    if (this.combo_t > 0 && --this.combo_t === 0) this.combo = 0;
    this.cool--;
    if (this.cool <= 0 && this.phase !== "clear" && (this.autofire || this.mdown || this.keys.has("z") || this.keys.has("j"))) this.fire();
    if (this.hp < this.maxhp * .25 && this.hp > 0 && this.t % 55 === 0) this.sfx("heart", .6);
    this.director(ts); this.updateEnemies(ts); this.updateBoss(ts); this.updateAbilities(ts);
    this.updatePBullets(ts); this.updateEBullets(ts); this.updateBeams(ts); this.updateItems(); this.updateFx();
  }
}
