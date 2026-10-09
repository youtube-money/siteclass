"use strict";
// NEON SOULS HTML5 - drawing, menus, HUD, input
const P = Game.prototype;
const fillR = (c, col, x, y, w, h) => { c.fillStyle = rgb(col); c.fillRect(x, y, w, h); };
const rrect = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
const inR = (r, p) => p[0] >= r.x && p[0] < r.x + r.w && p[1] >= r.y && p[1] < r.y + r.h;
const R_ = (x, y, w, h) => ({ x, y, w, h });
const GREYT = [140, 145, 160];

// ================================================================ world
P.drawWorld = function (S) {
  const st = STAGES[this.theme_i], bg = this.bgFor(this.theme_i), q = this.quality, t = this.t;
  if (this.bg_fade > 0 && this.bg_prev) {
    S.drawImage(this.bg_prev, 0, 0); S.globalAlpha = 1 - this.bg_fade / 70; S.drawImage(bg, 0, 0); S.globalAlpha = 1;
  } else S.drawImage(bg, 0, 0);
  this.deco.drawBack(S, st, q);
  for (const h of this.holes) {
    const r = 40 + 10 * Math.sin(h[2] * .3); addGlow(S, PURPLE, h[0], h[1], 170, .8);
    for (let k = 0; k < 4; k++) { const a = h[2] * .15 + k * TAU / 4, pts = []; for (let i = 0; i < 12; i++) pts.push([h[0] + Math.cos(a + i * .22) * (r + i * 7), h[1] + Math.sin(a + i * .22) * (r + i * 7)]); polyline(S, PURPLE, pts, 2); }
    circ(S, [0, 0, 0], h[0], h[1], r * .7);
  }
  for (const c of this.coin_p.list) {
    const sq = Math.abs(Math.sin((t + c.t) * .12)), w = Math.max(2, 6 * sq | 0);
    S.fillStyle = rgb(GOLD); S.beginPath(); S.ellipse(c.x, c.y, w, 6, 0, 0, TAU); S.fill();
    S.fillStyle = rgb([255, 245, 170]); S.beginPath(); S.ellipse(c.x, c.y, Math.max(1, w * .5), 3, 0, 0, TAU); S.fill();
    if (q >= 2) addGlow(S, GOLD, c.x, c.y, 11, .5);
  }
  for (const it of this.items) {
    const col = ITEMS[it.kind][0], y = it.y + Math.sin(it.t * .1) * 3;
    addGlow(S, col, it.x, y, 30, .8); circ(S, dimc(col, .25), it.x, y, 15); ring(S, col, it.x, y, 15, 2); text(S, ITEMS[it.kind][2], 16, WHITE, it.x, y);
  }
  for (const e of this.enemies) this.drawEnemy(S, e);
  if (this.boss) this.drawBoss(S);
  for (const bm of this.beams) this.drawBeam(S, bm);
  if (this.laser_ch > 0) addGlow(S, WHITE, this.px, this.py - 36, 20 + (40 - this.laser_ch) * 1.8, 1);
  if (this.laser_t > 0) {
    const w = 70 + Math.sin(t * .8) * 8, x0 = this.px - w / 2, h = this.py - 20;
    S.globalCompositeOperation = "lighter"; fillR(S, [60, 20, 90], x0 - 10, 0, w + 20, h); fillR(S, [150, 70, 255], x0, 0, w, h); S.globalCompositeOperation = "source-over";
    fillR(S, WHITE, this.px - w * .2, 0, w * .4, h); addGlow(S, WHITE, this.px, this.py - 30, 60, 1);
  }
  for (const b of this.pb.list) this.drawPBullet(S, b);
  for (const b of this.eb.list) if (b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20) drawOrb(S, b.col, b.x, b.y, b.r);
  for (const bl of this.bolts) { const pts = bl[0]; if (pts.length > 1) { polyline(S, dimc(bl[2], .45), pts, 7); polyline(S, bl[2], pts, 3); polyline(S, WHITE, pts, 1); } }
  if (this.state !== "dead") this.drawPlayer(S);
  for (const r of this.rings) { const k = 1 - r[2] / r[3]; ring(S, dimc(r[4], Math.max(.12, k)), r[0], r[1], r[2], Math.max(1, (r[5] * k + 1) | 0)); }
  for (const p of this.parts.list) { const k = p.life / p.mx; fillR(S, dimc(p.col, k), p.x | 0, p.y | 0, p.sz, p.sz); }
  for (const tx of this.texts) text(S, tx[2], 20, tx[3], tx[0], tx[1], "c", Math.min(1, tx[4] / 25));
  if (this.flash > 0) { S.globalCompositeOperation = "lighter"; const v = this.flash * 70 | 0; fillR(S, [v, v, v], 0, 0, W, H); S.globalCompositeOperation = "source-over"; }
};
P.drawEnemy = function (S, e) {
  const x = e.x, y = e.y, r = e.r;
  if (this.quality >= 1) addGlow(S, e.col, x, y, r * 2.1, e.elite ? .55 : .32);
  if (e.tele > 0) { const a = e.aim; line(S, [255, 40, 40], x, y, x + Math.cos(a) * 1400, y + Math.sin(a) * 1400, (e.tele | 0) % 6 < 3 ? 1 : 2); }
  DRAW[e.kind](S, x, y, r, e.col, e.col2, this.t, e);
  if (e.elite) {
    const a = this.t * .06;
    for (let i = 0; i < 3; i++) { S.strokeStyle = rgb(e.col2); S.lineWidth = 3; S.beginPath(); S.arc(x, y, r * 1.35, a + i * TAU / 3, a + i * TAU / 3 + 1.2); S.stroke(); }
    const w = r * 2; fillR(S, [60, 0, 0], x - w / 2, y - r - 14, w, 4); fillR(S, RED, x - w / 2, y - r - 14, w * clamp(e.hp / e.maxhp, 0, 1), 4);
  }
  if (e.hit > 0) addGlow(S, WHITE, x, y, r * 1.5, .7);
};
P.drawBoss = function (S) {
  const b = this.boss;
  if (this.quality >= 1) addGlow(S, b.col, b.x, b.y, b.r * 2.6, .3);
  if (b.state === "charge" && b.ct < 45) addGlow(S, RED, b.x, b.y, b.r * 2.2, clamp(.5 + .4 * Math.sin(this.t * .6), 0, 1));
  BDRAW[b.id](S, b.x, b.y, b.r, b.col, b.col2, this.t, b);
  if (b.hit > 0) addGlow(S, WHITE, b.x, b.y, b.r * 1.6, .65);
};
P.drawBeam = function (S, bm) {
  const ca = Math.cos(bm.ang), sa = Math.sin(bm.ang), x0 = bm.x, y0 = bm.y, x1 = x0 + ca * bm.len, y1 = y0 + sa * bm.len;
  if (bm.tele > 0) { const k = 1 - bm.tele / 60; line(S, dimc(RED, .3 + .7 * k), x0, y0, x1, y1, 1 + (k * 3 | 0)); }
  else {
    const w = bm.w * Math.min(1, bm.life / 8 + .2);
    line(S, dimc(bm.col, .35), x0, y0, x1, y1, w * 1.7); line(S, bm.col, x0, y0, x1, y1, w); line(S, WHITE, x0, y0, x1, y1, Math.max(2, w * .4)); addGlow(S, bm.col, x0, y0, 50, .8);
  }
};
P.drawPBullet = function (S, b) {
  if (b.kind === "ring") { const k = Math.max(.2, b.life / 54); ring(S, dimc(b.col, k), b.x, b.y, b.rr, 4); ring(S, dimc(WHITE, k * .7), b.x, b.y, b.rr - 3, 1); return; }
  if (b.r >= 7) { drawOrb(S, b.col, b.x, b.y, b.r); return; }
  const sp = Math.max(.1, Math.hypot(b.vx, b.vy)), tx = b.vx / sp * Math.min(sp * 1.1, 22), ty = b.vy / sp * Math.min(sp * 1.1, 22), w = Math.max(2, b.r * 1.5 | 0);
  line(S, dimc(b.col, .55), b.x, b.y, b.x - tx, b.y - ty, w + 2); line(S, b.col, b.x, b.y, b.x - tx * .8, b.y - ty * .8, w); line(S, WHITE, b.x, b.y, b.x - tx * .5, b.y - ty * .5, Math.max(1, w >> 1));
  if (this.quality >= 2) addGlow(S, b.col, b.x, b.y, 12, .6);
};
P.drawPlayer = function (S) {
  const x = this.px, y = this.py, s = this.ship, t = this.t;
  const blink = this.invuln > 0 && ((this.invuln / 3 | 0) % 2 === 0) && this.invuln < 55;
  const fl = 14 + 8 * Math.sin(t * .7) + (this.slow_on ? 10 : 0);
  poly(S, [[x - 8, y + 18], [x, y + 18 + fl * 1.6], [x + 8, y + 18]], s.acc); poly(S, [[x - 4, y + 18], [x, y + 18 + fl], [x + 4, y + 18]], WHITE);
  addGlow(S, s.col, x, y + 22, 36, .6);
  if (this.has("last") && this.hp < this.maxhp * .3) addGlow(S, RED, x, y, 80, .5 + .3 * Math.sin(t * .3));
  if (!blink) S.drawImage(this.ship_sprites[s.id], (x - 50) | 0, (y - 50) | 0);
  if (this.buffs.over) addGlow(S, [255, 77, 77], x, y, 70, .6);
  if (this.buffs.magnet) ring(S, dimc([255, 102, 255], .5), x, y, this.magr * 3.2, 1);
  if (this.aegis > 0) { ring(S, ICE, x, y, 38, 2); addGlow(S, ICE, x, y, 52, .35); }
  if (this.has("blades")) for (let i = 0; i < 3; i++) { const a = t * .09 + i * TAU / 3, bx = x + Math.cos(a) * 74, by = y + Math.sin(a) * 74; poly(S, rot([[0, -14], [6, 0], [0, 14], [-6, 0]], a + 1.57, bx, by), CYAN); addGlow(S, CYAN, bx, by, 22, .6); }
  if (this.has("drones") || this.buffs.drones) for (const sd of [-1, 1]) { const dx = x + sd * 52, dy = y + 10 + Math.sin(t * .1 + sd) * 4; poly(S, [[dx, dy - 9], [dx + 7, dy], [dx, dy + 9], [dx - 7, dy]], [102, 255, 238]); addGlow(S, [102, 255, 238], dx, dy, 20, .6); }
  circ(S, s.col, x, y - 4, s.hr + 3); circ(S, WHITE, x, y - 4, Math.max(2, s.hr - 1));
};
// ================================================================ widgets
P.bar = function (S, x, y, w, h, k, col, lag) {
  fillR(S, [12, 14, 28], x, y, w, h);
  if (lag !== undefined) fillR(S, [220, 220, 240], x, y, w * clamp(lag, 0, 1) | 0, h);
  fillR(S, col, x, y, w * clamp(k, 0, 1) | 0, h);
  S.strokeStyle = rgb(dimc(col, .8)); S.lineWidth = 1; S.strokeRect(x + .5, y + .5, w - 1, h - 1);
};
P.button = function (S, cx, cy, w, h, label, cb, col, size, enabled, sub, rcb) {
  col = col || CYAN; size = size || 24; enabled = enabled !== false;
  const r = R_(cx - w / 2, cy - h / 2, w, h), hov = enabled && inR(r, this.mouse), c = enabled ? col : [90, 95, 110];
  rrect(S, r.x, r.y, w, h, 8); S.fillStyle = rgb(dimc(c, hov ? .38 : .16)); S.fill();
  S.strokeStyle = rgb(c); S.lineWidth = hov ? 3 : 2; S.stroke();
  if (hov) addGlow(S, c, cx, cy, Math.max(w, h) * .75, .25);
  const tc = enabled ? WHITE : GREYT;
  if (sub) { text(S, label, size, tc, cx, cy - size * .35); text(S, sub, Math.max(11, size - 11), c, cx, cy + size * .75); } else text(S, label, size, tc, cx, cy);
  if (enabled) { this.btns.push([r, cb, rcb]); if (hov && this.hover_r !== r.x + "," + r.y) { this.sfx("hover", .6, 30); } }
  if (hov) this.hover_r = r.x + "," + r.y;
  return hov;
};
P.titleText = function (S, s, size, col, x, y) {
  for (const [off, k] of [[6, .18], [3, .35]]) for (const [dx, dy] of [[-off, 0], [off, 0], [0, -off], [0, off]]) text(S, s, size, dimc(col, k), x + dx, y + dy);
  text(S, s, size, col, x, y); text(S, s, size, mixc(col, WHITE, .55), x, y - 2, "c", .5);
};
P.wrap = function (s, n) { const out = []; let cur = ""; for (const w of s.split(" ")) { if (cur.length + w.length + 1 > n) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } out.push(cur); return out; };
P.dark = function (S, a) { S.fillStyle = "rgba(0,0,8," + (a / 255).toFixed(3) + ")"; S.fillRect(0, 0, W, H); };
// ================================================================ HUD
P.drawHud = function (S) {
  const st = this.st, t = this.t;
  text(S, "HP", 16, [200, 255, 220], 24, 22, "l");
  this.bar(S, 56, 14, 270, 16, this.hp / this.maxhp, mixc(RED, GREEN, this.hp / this.maxhp), this.hp_lag / this.maxhp);
  text(S, Math.ceil(this.hp) + " / " + this.maxhp, 14, WHITE, 190, 22);
  for (let i = 0; i < this.aegis; i++) { circ(S, ICE, 66 + i * 20, 44, 7); ring(S, WHITE, 66 + i * 20, 44, 7, 1); }
  text(S, "EN", 14, [170, 190, 255], 24, 64, "l");
  this.bar(S, 56, 58, 270, 12, this.energy / 100, this.energy >= 100 ? [120, 200, 255] : BLUE);
  if (this.has("pulse")) fillR(S, WHITE, 56 + 270 * .35 | 0, 56, 2, 16);
  for (let i = 0; i < this.bombs; i++) { circ(S, PURPLE, 70 + i * 22, 90, 8); text(S, "B", 12, WHITE, 70 + i * 22, 90); }
  if (this.tw_t > 0) { const w = WEAPONS[this.tw]; text(S, w.name, 14, w.col, 24, 114, "l"); this.bar(S, 24, 124, 160, 5, this.tw_t / TW_TIME, w.col); }
  let yy = 140; for (const k in this.buffs) { text(S, k.toUpperCase() + " " + (Math.floor(this.buffs[k] / 60) + 1) + "s", 13, ITEMS[k][0], 24, yy, "l"); yy += 16; }
  const cf = this.coin_flash;
  circ(S, GOLD, W - 40, 24, 11 + (cf ? 3 : 0)); circ(S, [255, 245, 170], W - 40, 24, 5);
  text(S, fmt(this.coins), 26, GOLD, W - 58, 24, "r"); text(S, "SCORE " + fmt(this.score), 18, WHITE, W - 24, 54, "r"); text(S, "RUN +" + fmt(this.run_coins), 14, [200, 180, 90], W - 24, 74, "r");
  if (this.combo >= 3) {
    const k = Math.min(1, this.combo_t / 130);
    text(S, "COMBO x" + this.combo, 30 + Math.min(14, this.combo >> 3), mixc([255, 80, 80], YELLOW, Math.min(1, this.combo / 60)), W - 24, 112, "r"); fillR(S, YELLOW, W - 24 - 150 * k, 134, 150 * k, 3);
  }
  if (this.boss && this.boss.ready) {
    const b = this.boss; this.bar(S, W / 2 - 300, 20, 600, 16, b.hp / b.maxhp, b.col);
    for (let i = 1; i < b.nph; i++) fillR(S, WHITE, W / 2 - 300 + 600 * (1 - i / b.nph) | 0, 18, 2, 20);
    text(S, b.id, 20, WHITE, W / 2, 52);
  } else {
    text(S, "STAGE " + this.stage + "  -  " + st.name, 18, st.pal[0], W / 2, 18);
    this.bar(S, W / 2 - 160, 32, 320, 6, (this.phase === "wave" || this.phase === "intro") ? clamp(this.stage_t / this.dur, 0, 1) : 1, st.pal[0]);
  }
  // abilities
  const acts = [["bomb", "BOMB", "SPACE", PURPLE, 0, () => this.useBomb(), this.bombs > 0 && this.bomb_cd <= 0]];
  const RC = { pulse: CYAN, slow: GREEN, laser: [190, 110, 255], hole: [140, 90, 255], storm: [220, 230, 255] };
  for (const [key, thr, name, kk, kind, cost] of RELICS) if (kind === "a" && this.has(key)) {
    const fn = { pulse: () => this.usePulse(), laser: () => this.useLaser(), hole: () => this.useHole(), storm: () => this.useStorm(), slow: () => { } }[key];
    acts.push([key, name, kk, RC[key], cost, fn, this.energy >= Math.max(cost, 1)]);
  }
  const bw = 74, x0 = W / 2 - (acts.length * (bw + 10) - 10) / 2;
  acts.forEach(([key, name, kk, col, cost, fn, ok], i) => {
    const r = R_(x0 + i * (bw + 10), H - 78, bw, 62), hov = inR(r, this.mouse);
    rrect(S, r.x, r.y, r.w, r.h, 8); S.fillStyle = rgb(dimc(col, ok ? .35 : .12)); S.fill(); S.strokeStyle = rgb(ok ? col : dimc(col, .4)); S.lineWidth = hov ? 3 : 2; S.stroke();
    text(S, name.split(" ")[0].slice(0, 7), 14, ok ? WHITE : [130, 135, 150], r.x + r.w / 2, r.y + 20); text(S, "[" + kk + "]", 14, ok ? col : [100, 100, 120], r.x + r.w / 2, r.y + 40);
    if (cost) text(S, "" + cost, 12, [170, 190, 255], r.x + r.w / 2, r.y + 54); else if (key === "bomb") text(S, "x" + this.bombs, 12, [220, 190, 255], r.x + r.w / 2, r.y + 54);
    if (key === "slow") { r.hold = true; this.btns.push([r, null, null, "slow"]); } else this.btns.push([r, fn, null]);
  });
  let px0 = 24;
  for (const [key, thr, name, kk, kind] of RELICS) if (kind === "p" && this.has(key)) { circ(S, [30, 36, 60], px0 + 12, H - 30, 13); ring(S, CYAN, px0 + 12, H - 30, 13, 2); text(S, name[0], 15, WHITE, px0 + 12, H - 30); px0 += 32; }
  this.toasts.forEach(([s, col, life], i) => text(S, s, 22, col, 28, 190 + i * 30, "l", Math.min(1, life / 40)));
  if (this.phase === "intro") {
    const k = this.ptimer / 190, a = Math.max(0, Math.min(1, (1 - k) * 6, k * 4));
    text(S, "STAGE " + this.stage, 74, WHITE, W / 2, 250, "c", a); text(S, st.name, 42, st.pal[0], W / 2, 320, "c", a); text(S, "BOSS: " + st.boss, 22, [200, 200, 220], W / 2, 366, "c", a);
  } else if (this.phase === "warn") {
    if ((this.ptimer / 10 | 0) % 2 === 0) text(S, "WARNING", 96, RED, W / 2, 270);
    const d = BOSSES[st.boss]; text(S, st.boss, 54, d.col, W / 2, 350); text(S, d.title, 22, [230, 230, 240], W / 2, 395);
  } else if (this.phase === "clear") { text(S, "STAGE CLEAR", 80, GOLD, W / 2, 250); text(S, "+" + fmt(this.pay) + " COINS", 46, WHITE, W / 2, 325); }
  if (this.hp < this.maxhp * .25 && this.state === "play") { S.globalAlpha = (60 + 90 * (.5 + .5 * Math.sin(t * .18))) / 255; S.drawImage(this.vignette, 0, 0, W, H); S.globalAlpha = 1; }
};
// ================================================================ menus
P.drawMenuBg = function (S) { S.drawImage(this.bgFor(this.theme_i), 0, 0); this.deco.drawBack(S, STAGES[this.theme_i], this.quality); };
P.drawTitle = function (S) {
  this.drawMenuBg(S); this.titleText(S, "NEON SOULS", 118, CYAN, W / 2, 130); text(S, "I N F I N I T E   E D I T I O N", 24, PINK, W / 2, 205);
  const y = 330;
  this.button(S, W / 2, y, 380, 62, "PLAY", () => this.go("stages"), CYAN, 30);
  this.button(S, W / 2 - 195, y + 80, 280, 54, "HANGAR", () => this.go("hangar"), PINK, 24);
  this.button(S, W / 2 + 195, y + 80, 280, 54, "RELIC VAULT", () => this.go("vault"), PURPLE, 24);
  this.button(S, W / 2 - 195, y + 146, 280, 54, "SETTINGS", () => this.go("settings"), BLUE, 24);
  this.button(S, W / 2 + 195, y + 146, 280, 54, "CONTROLS", () => this.go("controls"), GREEN, 24);
  circ(S, GOLD, 40, 34, 12); text(S, fmt(this.coins), 28, GOLD, 60, 34, "l");
  text(S, "BEST STAGE " + this.best + "   HI-SCORE " + fmt(this.hi), 16, [190, 200, 230], 28, 70, "l");
  const yy = 560 + Math.sin(this.t * .04) * 10; addGlow(S, this.ship.col, 1080, yy, 110, .4);
  S.drawImage(this.ship_sprites[this.ship.id], 1030, yy - 50 | 0);
  poly(S, [[1072, yy + 30], [1080, yy + 52 + 6 * Math.sin(this.t * .7)], [1088, yy + 30]], this.ship.acc); text(S, this.ship.id, 20, this.ship.col, 1080, yy + 80);
};
P.drawStages = function (S) {
  this.drawMenuBg(S); this.titleText(S, "SELECT STAGE", 54, CYAN, W / 2, 52);
  const cw = 280, ch = 140; this.thumbs = this.thumbs || {};
  STAGES.forEach((st, i) => {
    const n = i + 1, cx = 50 + cw / 2 + (i % 4) * (cw + 20), cy = 112 + ch / 2 + (i / 4 | 0) * (ch + 16), ok = n <= this.best + 1;
    const r = R_(cx - cw / 2, cy - ch / 2, cw, ch), hov = inR(r, this.mouse);
    if (!this.thumbs[i]) { const tc = mk(cw, ch); tc.getContext("2d").drawImage(this.bgFor(i), 0, 0, cw, ch); this.thumbs[i] = tc; }
    S.drawImage(this.thumbs[i], r.x, r.y);
    if (!ok) fillR(S, [0, 0, 0], r.x, r.y, cw, ch);
    rrect(S, r.x, r.y, cw, ch, 6); S.strokeStyle = rgb(ok ? st.pal[0] : [60, 60, 70]); S.lineWidth = hov && ok ? 4 : 2; S.stroke();
    if (ok) {
      text(S, "STAGE " + n, 18, st.pal[0], r.x + 14, r.y + 20, "l"); text(S, st.name, 22, WHITE, r.x + 14, r.y + 50, "l"); text(S, "BOSS  " + st.boss, 16, [220, 220, 235], r.x + 14, r.y + 78, "l");
      text(S, this.best >= n ? "CLEARED" : "NEW", 14, this.best >= n ? GREEN : YELLOW, r.x + cw - 12, r.y + 20, "r");
      st.species.forEach((k, j) => DRAW[k](S, r.x + 28 + j * 54, r.y + ch - 28, 12, st.pal[0], st.pal[1], this.t + j * 9, { ph: j, aim: Math.PI / 2, fcd: 99, hit: 0, tele: 0, burst: 0, sang: 0, elite: false }));
      if (hov) { addGlow(S, st.pal[0], cx, cy, 150, .2); if (n > 1) text(S, "+" + (n - 1) + " free upgrades", 13, [200, 255, 200], r.x + cw - 12, r.y + ch - 14, "r"); }
      this.btns.push([r, () => this.startRun(n), null]);
      if (hov && this.hover_r !== "s" + i) { this.sfx("hover", .6, 30); this.hover_r = "s" + i; }
    } else { text(S, "LOCKED", 26, [160, 165, 180], cx, cy - 10); text(S, "clear stage " + (n - 1), 15, [130, 135, 150], cx, cy + 20); }
  });
  const d = DIFFS[this.diff_i];
  this.button(S, W / 2 - 220, 650, 380, 58, "DIFFICULTY: " + d[0], () => this.cycleDiff(), [YELLOW, ORANGE, RED][this.diff_i], 22, true, "coins x" + d[3].toFixed(1) + "   enemy bullets x" + d[1].toFixed(2) + "   enemy HP x" + d[2].toFixed(2));
  this.button(S, W / 2 + 180, 650, 220, 58, "BACK", () => this.back(), GREY, 22);
};
P.cycleDiff = function () { this.diff_i = (this.diff_i + 1) % DIFFS.length; this.save(); };
P.startRun = function (n) { this.sfx("click"); this.newRun(n); this.state = "play"; };
P.drawHangar = function (S) {
  this.drawMenuBg(S); this.titleText(S, "HANGAR", 54, PINK, W / 2, 48); circ(S, GOLD, 40, 34, 12); text(S, fmt(this.coins), 28, GOLD, 60, 34, "l");
  this.button(S, W / 2 - 110, 100, 200, 40, "SHIPS", () => this.setTab("ships"), this.tab === "ships" ? PINK : GREY, 18);
  this.button(S, W / 2 + 110, 100, 200, 40, "UPGRADES", () => this.setTab("upg"), this.tab === "upg" ? CYAN : GREY, 18);
  if (this.tab === "ships") {
    SHIPS.forEach((s, i) => {
      const r = R_(60, 135 + i * 62, 420, 56), own = this.owned.has(s.id), req = SHIP_REQ[s.id] || 0, sel = i === this.shop_sel, hov = inR(r, this.mouse);
      rrect(S, r.x, r.y, r.w, r.h, 8); S.fillStyle = rgb(dimc(s.col, sel ? .35 : .14)); S.fill(); S.strokeStyle = rgb(sel || hov ? s.col : dimc(s.col, .5)); S.lineWidth = sel ? 3 : 1; S.stroke();
      S.drawImage(this.ship_sprites[s.id], r.x + 4, r.y + 3, 50, 50); text(S, s.id, 22, WHITE, r.x + 66, r.y + 20, "l");
      let lab, c; if (i === this.ship_i) { lab = "EQUIPPED"; c = GREEN; } else if (own) { lab = "OWNED"; c = CYAN; } else if (this.best < req) { lab = "CLEAR STAGE " + req; c = [150, 150, 165]; } else { lab = fmt(s.price) + " coins"; c = GOLD; }
      text(S, lab, 15, c, r.x + 66, r.y + 42, "l"); this.btns.push([r, () => this.selShip(i), null]);
    });
    const s = SHIPS[this.shop_sel], cx = 860; addGlow(S, s.col, cx, 290, 190, .35); const bob = Math.sin(this.t * .04) * 8;
    S.drawImage(this.ship_sprites[s.id], cx - 100, 190 + bob, 200, 200);
    poly(S, [[cx - 14, 370 + bob], [cx, 410 + bob + 8 * Math.sin(this.t * .7)], [cx + 14, 370 + bob]], s.acc);
    text(S, s.id, 40, s.col, cx, 150); text(S, WEAPONS[s.weapon].name, 20, WHITE, cx, 440); text(S, s.desc, 16, [190, 200, 225], cx, 468);
    [["HULL", s.hp / 180], ["SPEED", s.spd / 11], ["DAMAGE", s.dmg / 1.3], ["FIRE RATE", 1 / s.rate / 1.12], ["HITBOX", 1 - (s.hr - 3) / 5], ["BOMBS", s.bombs / 4]].forEach(([n, v], j) => { const y = 500 + j * 22; text(S, n, 14, [180, 190, 220], 640, y, "l"); this.bar(S, 740, y - 6, 300, 12, clamp(v, 0, 1), s.col); });
    if (this.owned.has(s.id)) this.button(S, cx, 665, 320, 50, this.shop_sel === this.ship_i ? "EQUIPPED" : "EQUIP", () => this.equip(this.shop_sel), GREEN, 24, this.shop_sel !== this.ship_i);
    else { const req = SHIP_REQ[s.id] || 0; if (this.best < req) this.button(S, cx, 665, 320, 50, "LOCKED - CLEAR STAGE " + req, null, GREY, 20, false); else this.button(S, cx, 665, 320, 50, "BUY  " + fmt(s.price), () => this.buyShip(this.shop_sel), GOLD, 24, this.coins >= s.price); }
  } else {
    UPG.forEach(([k, name, desc, base, mx], i) => {
      const y = 190 + i * 74, lv = this.upg[k], r = R_(170, y - 32, 940, 64);
      rrect(S, r.x, r.y, r.w, r.h, 8); S.fillStyle = rgb([14, 20, 40]); S.fill(); S.strokeStyle = rgb(CYAN); S.lineWidth = 1; S.stroke();
      text(S, name, 24, WHITE, r.x + 20, y - 10, "l"); text(S, desc, 15, [170, 190, 220], r.x + 20, y + 16, "l");
      for (let j = 0; j < mx; j++) fillR(S, j < lv ? CYAN : [40, 50, 80], r.x + 360 + j * 26, y - 8, 20, 16);
      const cost = Math.floor(base * Math.pow(1.55, lv) / 5) * 5;
      if (lv >= mx) this.button(S, r.x + r.w - 110, y, 180, 46, "MAX", null, GREEN, 20, false); else this.button(S, r.x + r.w - 110, y, 180, 46, "BUY  " + fmt(cost), () => this.buyUpg(k, cost), GOLD, 20, this.coins >= cost);
    });
  }
  this.button(S, this.tab === "upg" ? W / 2 : 160, 690, this.tab === "upg" ? 220 : 200, 40, "BACK", () => this.back(), GREY, 20);
};
P.setTab = function (t) { this.tab = t; this.sfx("click"); };
P.selShip = function (i) { this.shop_sel = i; this.sfx("click"); };
P.equip = function (i) { this.ship_i = i; this.sfx("pickup"); this.save(); };
P.buyShip = function (i) { const s = SHIPS[i]; if (this.coins >= s.price && !this.owned.has(s.id) && this.best >= (SHIP_REQ[s.id] || 0)) { this.coins -= s.price; this.owned.add(s.id); this.ship_i = i; this.sfx("unlock"); this.save(); } else this.sfx("deny"); };
P.buyUpg = function (k, cost) { const mx = UPG.find(u => u[0] === k)[4]; if (this.coins >= cost && this.upg[k] < mx) { this.coins -= cost; this.upg[k]++; this.sfx("card"); this.save(); } else this.sfx("deny"); };
P.drawVault = function (S) {
  this.drawMenuBg(S); this.titleText(S, "RELIC VAULT", 54, PURPLE, W / 2, 48); text(S, "Relics unlock permanently when you defeat a stage boss", 18, [190, 200, 230], W / 2, 92);
  const cols = { pulse: CYAN, slow: GREEN, blades: [120, 230, 255], chain: [200, 220, 255], laser: [190, 110, 255], drones: [102, 255, 238], hole: [140, 90, 255], phoenix: ORANGE, storm: [220, 230, 255], last: RED };
  RELICS.forEach(([key, thr, name, kk, kind, cost, desc], i) => {
    const cx = 140 + (i % 5) * 250, cy = 220 + (i / 5 | 0) * 210, r = R_(cx - 112, cy - 92, 224, 190), ok = this.best >= thr, c = cols[key];
    rrect(S, r.x, r.y, r.w, r.h, 10); S.fillStyle = rgb(dimc(c, ok ? .2 : .06)); S.fill(); S.strokeStyle = rgb(ok ? c : [60, 62, 74]); S.lineWidth = 2; S.stroke();
    if (ok) addGlow(S, c, cx, cy - 40, 60, .6);
    circ(S, dimc(c, ok ? .4 : .12), cx, cy - 40, 28); ring(S, ok ? c : [70, 72, 85], cx, cy - 40, 28, 3);
    text(S, ok ? name[0] : "?", 34, ok ? WHITE : [90, 92, 105], cx, cy - 40); text(S, ok ? name : "LOCKED", 17, ok ? WHITE : [130, 132, 145], cx, cy + 4);
    if (ok) { this.wrap(desc, 24).forEach((l, j) => text(S, l, 13, [200, 205, 225], cx, cy + 28 + j * 16)); text(S, kind === "a" ? (cost ? "ACTIVE [" + kk + "]  cost " + cost : "ACTIVE [" + kk + "]  hold") : "PASSIVE", 13, c, cx, cy + 82); }
    else { text(S, "Defeat the boss of", 13, [120, 122, 135], cx, cy + 30); text(S, "STAGE " + thr, 20, [150, 152, 165], cx, cy + 52); }
  });
  this.button(S, W / 2, 680, 220, 44, "BACK", () => this.back(), GREY, 20);
};
P.drawSettings = function (S) {
  this.drawMenuBg(S); this.titleText(S, "SETTINGS", 54, BLUE, W / 2, 60);
  [["MUSIC VOLUME", this.mus_vol, d => this.setVol("mus", d)], ["SFX VOLUME", this.sfx_vol, d => this.setVol("sfx", d)]].forEach(([n, v, fn], i) => {
    const y = 170 + i * 70; text(S, n, 26, WHITE, 330, y, "l"); this.button(S, 700, y, 60, 46, "-", () => fn(-.1), CYAN, 28); this.bar(S, 750, y - 10, 280, 20, v, CYAN); this.button(S, 1080, y, 60, 46, "+", () => fn(.1), CYAN, 28);
  });
  const qn = ["LOW", "MEDIUM", "HIGH"];
  text(S, "GRAPHICS", 26, WHITE, 330, 320, "l"); this.button(S, 800, 320, 360, 50, (this.auto_q ? "AUTO  (" : "") + qn[this.quality] + (this.auto_q ? ")" : ""), () => this.cycleQuality(), GREEN, 22);
  text(S, "FULLSCREEN", 26, WHITE, 330, 400, "l"); this.button(S, 800, 400, 360, 50, document.fullscreenElement ? "ON" : "OFF", () => this.toggleFull(), ORANGE, 22);
  text(S, "MUTE  (M)", 26, WHITE, 330, 480, "l"); this.button(S, 800, 480, 360, 50, this.audio.muted ? "MUTED" : "SOUND ON", () => this.toggleMute(), PINK, 22);
  text(S, "AUTO FIRE", 26, WHITE, 330, 560, "l"); this.button(S, 800, 560, 360, 50, this.autofire ? "ON  (always shooting)" : "OFF  (hold click / touch / Z)", () => this.toggleAutofire(), YELLOW, 20);
  this.button(S, W / 2, 660, 240, 44, "BACK", () => this.back(), GREY, 22);
};
P.setVol = function (w, d) { if (w === "mus") { this.mus_vol = clamp(Math.round((this.mus_vol + d) * 100) / 100, 0, 1); this.audio.musVol = this.mus_vol; } else { this.sfx_vol = clamp(Math.round((this.sfx_vol + d) * 100) / 100, 0, 1); this.audio.sfxVol = this.sfx_vol; } this.sfx("click"); this.save(); };
P.cycleQuality = function () { if (this.auto_q) { this.auto_q = false; this.quality = 0; } else if (this.quality < 2) this.quality++; else { this.auto_q = true; this.quality = 2; } this.save(); };
P.toggleFull = function () { try { if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch (e) { } };
P.toggleAutofire = function () { this.autofire = !this.autofire; this.sfx("click"); this.save(); };
P.toggleMute = function () { this.audio.muted = !this.audio.muted; };
P.drawControls = function (S) {
  this.drawMenuBg(S); this.titleText(S, "CONTROLS", 54, GREEN, W / 2, 60);
  [["MOVE", "Mouse (ship follows the cursor)  /  WASD or arrows  /  touch-drag"], ["SHOOT", "Automatic (Settings: turn off, then hold click / touch / Z)"], ["BOMB", "SPACE  /  B  /  right click  /  on-screen button"], ["NOVA PULSE", "Q   (relic, 35 energy)"], ["BULLET TIME", "hold E / hold its button   (relic)"], ["MEGA LASER", "R   (relic, full energy)"], ["BLACK HOLE", "F   (relic, 60 energy)"], ["THUNDER STORM", "T   (relic, 80 energy)"], ["PAUSE", "P  /  ESC"], ["MUTE / FULLSCREEN", "M  /  F11"], ["TIP", "Graze bullets to charge energy. Kill fast to build combos."]]
    .forEach(([a, b], i) => { text(S, a, 22, YELLOW, 220, 140 + i * 44, "l"); text(S, b, 20, WHITE, 520, 140 + i * 44, "l"); });
  this.button(S, W / 2, 650, 240, 48, "BACK", () => this.back(), GREY, 22);
};
P.go = function (s) { this.state = s; this.sfx("click"); if (s === "hangar") this.shop_sel = this.ship_i; };
P.back = function () { this.state = "title"; this.sfx("click"); this.save(); };
// ================================================================ overlays
P.drawPause = function (S) {
  this.dark(S, 170); this.titleText(S, "PAUSED", 80, CYAN, W / 2, 200);
  this.button(S, W / 2, 330, 340, 60, "RESUME", () => this.togglePause(), CYAN, 28); this.button(S, W / 2, 410, 340, 54, "RETRY STAGE", () => this.retryStage(), ORANGE, 24); this.button(S, W / 2, 485, 340, 54, "QUIT TO MENU", () => this.quitToMenu(), [200, 80, 80], 24);
  text(S, "Music " + Math.round(this.mus_vol * 100) + "%   SFX " + Math.round(this.sfx_vol * 100) + "%   (M = mute)", 16, [170, 180, 210], W / 2, 570);
};
P.quitToMenu = function () { this.hi = Math.max(this.hi, this.score | 0); this.save(); this.audio.music(["menu"]); this.newRun(1, true); this.state = "title"; };
P.drawCards = function (S) {
  this.dark(S, 175); text(S, "STAGE " + this.stage + " COMPLETE", 52, GOLD, W / 2, 90); text(S, "+" + fmt(this.pay) + " coins    -    choose an upgrade", 24, WHITE, W / 2, 142);
  this.cards.forEach(([key, title, desc, col], i) => {
    const cx = W / 2 + (i - 1) * 370, r = R_(cx - 165, 200, 330, 400), hov = inR(r, this.mouse);
    rrect(S, r.x, r.y, r.w, r.h, 14); S.fillStyle = rgb(dimc(col, hov ? .3 : .16)); S.fill(); S.strokeStyle = rgb(col); S.lineWidth = hov ? 4 : 2; S.stroke();
    addGlow(S, col, cx, 330, hov ? 140 : 110, .5); circ(S, dimc(col, .5), cx, 330, 54); ring(S, col, cx, 330, 54, 4); text(S, "" + (i + 1), 48, WHITE, cx, 330); text(S, title, 30, col, cx, 440);
    this.wrap(desc, 22).forEach((l, j) => text(S, l, 20, WHITE, cx, 490 + j * 26)); this.btns.push([r, () => this.pickCard(i), null]);
    if (hov && this.hover_r !== "c" + i) { this.sfx("hover", .6, 30); this.hover_r = "c" + i; }
  });
  text(S, "press 1 / 2 / 3 or tap a card", 18, [170, 180, 210], W / 2, 650);
};
P.drawDead = function (S) {
  if (this.dead_t > 30) {
    this.dark(S, Math.min(200, this.dead_t * 4)); text(S, "SHIP DESTROYED", 80, RED, W / 2, 190); text(S, "STAGE " + this.stage + "  -  " + this.st.name, 28, WHITE, W / 2, 262);
    text(S, "SCORE  " + fmt(this.score), 30, YELLOW, W / 2, 320); text(S, "COINS EARNED THIS RUN  +" + fmt(this.run_coins), 26, GOLD, W / 2, 365); text(S, "HI-SCORE " + fmt(this.hi) + "   BEST STAGE " + this.best, 18, [190, 200, 230], W / 2, 405);
    this.button(S, W / 2, 490, 380, 62, "RETRY STAGE", () => this.retryStage(), ORANGE, 28); this.button(S, W / 2 - 105, 570, 200, 50, "HANGAR", () => { this.quitToMenu(); this.go("hangar"); }, PINK, 20); this.button(S, W / 2 + 105, 570, 200, 50, "MENU", () => this.quitToMenu(), GREY, 20);
  }
};
P.drawVictory = function (S) {
  this.dark(S, 190); this.titleText(S, "VICTORY", 120, GOLD, W / 2, 190); text(S, "THE LAST FLAME IS EXTINGUISHED", 32, WHITE, W / 2, 280);
  text(S, "All relics are yours.  The void is endless - enemies grow stronger from here.", 20, [200, 210, 235], W / 2, 330); text(S, "SCORE " + fmt(this.score) + "    COINS " + fmt(this.coins), 26, YELLOW, W / 2, 390);
  this.button(S, W / 2, 480, 420, 62, "CONTINUE  (ENDLESS)", () => this.beginCards(), GREEN, 28); this.button(S, W / 2, 560, 300, 50, "MENU", () => this.quitToMenu(), GREY, 22);
};
// ================================================================ frame
P.draw = function () {
  const S = this.ctx, st = this.state; this.btns = [];
  if (["title", "stages", "hangar", "vault", "settings", "controls"].includes(st)) {
    ({ title: this.drawTitle, stages: this.drawStages, hangar: this.drawHangar, vault: this.drawVault, settings: this.drawSettings, controls: this.drawControls })[st].call(this, S);
  } else {
    this.drawWorld(this.c);
    let sx = 0, sy = 0; if (this.shake > 0) { sx = rnd(-1, 1) * this.shake | 0; sy = rnd(-1, 1) * this.shake | 0; }
    if (sx || sy) fillR(S, [0, 0, 0], 0, 0, W, H);
    S.drawImage(this.world, sx, sy);
    if (st === "play" || st === "pause" || (st === "dead" && this.dead_t < 30)) this.drawHud(S);
    if (st === "pause") this.drawPause(S); else if (st === "cards") this.drawCards(S); else if (st === "dead") this.drawDead(S); else if (st === "victory") this.drawVictory(S);
  }
  if (this.audio.muted) text(S, "MUTED", 14, [200, 100, 100], W - 10, H - 12, "r");
};
// ================================================================ input
P.togglePause = function () { if (this.state === "play") { this.state = "pause"; this.sfx("click"); } else if (this.state === "pause") { this.state = "play"; this.sfx("click"); } };
P.onKey = function (k, down) {
  if (!down) { this.keys.delete(k); return; }
  this.audio.init(); this.keys.add(k);
  if (k === "f11") { this.toggleFull(); return; }
  if (k === "m") { this.toggleMute(); return; }
  const s = this.state;
  if (s === "play") { if (k === " " || k === "b") this.useBomb(); else if (k === "q") this.usePulse(); else if (k === "r") this.useLaser(); else if (k === "f") this.useHole(); else if (k === "t") this.useStorm(); else if (k === "p" || k === "escape") this.togglePause(); }
  else if (s === "pause") { if (k === "p" || k === "escape") this.togglePause(); }
  else if (s === "cards") { if (k === "1" || k === "2" || k === "3") this.pickCard(+k - 1); }
  else if (s === "dead") { if ((k === "enter" || k === " ") && this.dead_t > 40) this.retryStage(); else if (k === "escape") this.quitToMenu(); }
  else if (s === "title") { if (k === "enter") this.go("stages"); }
  else if (s === "victory") { if (k === "enter") this.beginCards(); }
  else if (k === "escape") this.back();
};
P.onClick = function (pos, button) {
  this.mouse = pos;
  if (button === 2 && this.state === "play") { this.useBomb(); return; }
  for (let i = this.btns.length - 1; i >= 0; i--) { const b = this.btns[i]; if (inR(b[0], pos)) { const f = button === 0 ? b[1] : b[2]; if (f) f(); return; } }
};
P.slowHit = function (pos) { for (const b of this.btns) if (b[3] === "slow" && inR(b[0], pos)) return true; return false; };
