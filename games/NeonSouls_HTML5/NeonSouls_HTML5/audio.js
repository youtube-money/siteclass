"use strict";
// AUDIO: every sound and every music loop is synthesised at runtime. No asset files, no network.
const SR = 22050;

function _env(n, a, curve) {
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) e[i] = Math.pow(1 - i / n, curve);
  const k = Math.max(1, Math.min(n, (a * SR) | 0));
  for (let i = 0; i < k; i++) e[i] *= i / k;
  return e;
}
function box(x, k) {                       // moving average ("same" convolution with ones(k)/k)
  const n = x.length, out = new Float32Array(n), pre = new Float64Array(n + 1), off = (k - 1) >> 1;
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + x[i];
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + off), lo = Math.max(0, i + off - (k - 1));
    out[i] = (pre[hi + 1] - pre[lo]) / k;
  }
  return out;
}
function tone(f0, f1, dur, wave, vol, curve, a) {
  wave = wave || "sine"; vol = vol === undefined ? .3 : vol; curve = curve === undefined ? 2 : curve; a = a === undefined ? .004 : a;
  const n = Math.max(8, (dur * SR) | 0), out = new Float32Array(n), env = _env(n, a, curve);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f1 !== f0 ? f0 * Math.pow(f1 / f0, i / SR / dur) : f0;
    ph += f / SR;
    const p = ph % 1;
    let w;
    if (wave === "sine") w = Math.sin(TAU * ph);
    else if (wave === "square") w = (Math.sin(TAU * ph) >= 0 ? 1 : -1) * .7;
    else if (wave === "saw") w = 2 * p - 1;
    else w = 2 * Math.abs(2 * p - 1) - 1;
    out[i] = w * env[i] * vol;
  }
  return out;
}
function noise(dur, vol, smooth, curve, hp) {
  vol = vol === undefined ? .3 : vol; smooth = smooth || 1; curve = curve === undefined ? 2 : curve;
  const n = Math.max(8, (dur * SR) | 0);
  let x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  if (smooth > 1) { x = box(x, smooth); const g = Math.sqrt(smooth) * .75; for (let i = 0; i < n; i++) x[i] *= g; }
  if (hp) { const b = box(x, 6); for (let i = 0; i < n; i++) x[i] -= b[i]; }
  const env = _env(n, .002, curve);
  for (let i = 0; i < n; i++) x[i] *= env[i] * vol;
  return x;
}
function layer(...parts) {
  const items = parts.map(p => p instanceof Float32Array ? [p, 0] : p);
  let n = 0;
  for (const [a, d] of items) n = Math.max(n, ((d * SR) | 0) + a.length);
  const out = new Float32Array(n);
  for (const [a, d] of items) { const i = (d * SR) | 0; for (let j = 0; j < a.length; j++) out[i + j] += a[j]; }
  return out;
}
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const seq = (notes, wave, dur, vol, curve, step) => notes.map((m, i) => [tone(midi(m), midi(m), dur, wave, vol, curve), i * step]);

// every SFX is a thunk, so the sounds are built a few at a time and never freeze a frame
function sfxDefs() {
  const T = tone, N = noise, D = {};
  D.shoot = () => layer(T(900, 380, .05, "square", .07));
  D.shoot_n = () => layer(T(1600, 900, .035, "tri", .06));
  D.shoot_p = () => layer(T(260, 90, .13, "saw", .11), N(.08, .05, 4));
  D.shoot_h = () => layer(T(500, 900, .09, "tri", .08));
  D.shoot_r = () => layer(T(300, 1200, .14, "sine", .09));
  D.hit = () => layer(N(.03, .09, 1, 1.5, true));
  D.hit_b = () => layer(N(.04, .1, 2), T(180, 120, .05, "square", .06));
  D.kill = () => layer(N(.2, .22, 14), T(420, 70, .18, "sine", .25));
  D.kill_big = () => layer(N(.45, .3, 28), T(200, 40, .4, "sine", .4), [T(900, 200, .2, "saw", .08), .02]);
  D.boom = () => layer(N(.8, .5, 40, 1.6), T(110, 28, .7, "sine", .6), [N(.5, .25, 10), .05]);
  D.boss_boom = () => layer(N(1.6, .55, 60, 1.3), T(90, 24, 1.4, "sine", .7), [N(1.0, .3, 14), .25], [T(70, 30, 1.0, "saw", .15), .1]);
  D.coin = () => layer(T(1318, 1318, .07, "square", .08, 1.2), [T(1760, 1760, .12, "square", .08, 1.6), .055]);
  D.coin2 = () => layer(T(1568, 1568, .07, "square", .08, 1.2), [T(2093, 2093, .12, "square", .08, 1.6), .055]);
  D.coin3 = () => layer(T(1864, 1864, .07, "square", .08, 1.2), [T(2489, 2489, .12, "square", .08, 1.6), .055]);
  D.pickup = () => layer(...seq([72, 76, 79, 84], "tri", .1, .18, 1.5, .05));
  D.power = () => layer(...seq([60, 67, 72, 76, 79, 84], "square", .14, .1, 1.4, .06));
  D.hurt = () => layer(T(240, 50, .35, "saw", .3), N(.25, .25, 6));
  D.shield = () => layer(T(900, 1800, .12, "sine", .22), [T(1800, 600, .2, "tri", .15), .05]);
  D.bomb = () => layer(N(1.0, .5, 50, 1.4), T(140, 26, .9, "sine", .7), T(200, 1600, .5, "saw", .1, 1.0));
  D.pulse = () => layer(T(120, 900, .5, "sine", .35, 1.2), N(.4, .2, 5, 1.8), [T(900, 200, .4, "tri", .15), .1]);
  D.laser = () => layer(T(90, 60, 2.2, "saw", .22, .6, .15), T(180, 120, 2.2, "square", .08, .5, .15), N(2.2, .18, 3, .5));
  D.laser_charge = () => layer(T(80, 900, .7, "saw", .18, 1.0, .1), N(.7, .1, 2, 1.0));
  D.hole = () => layer(T(300, 40, 1.2, "sine", .4, 1.0), N(1.2, .3, 20, 1.2), [T(60, 35, 1.4, "saw", .15), .1]);
  D.storm = () => layer(N(.5, .35, 3, 2.5, true), T(1400, 100, .35, "saw", .2), [N(.6, .3, 25), .1]);
  D.zap = () => layer(N(.12, .22, 1, 2, true), T(2400, 300, .1, "saw", .12));
  D.warn = () => layer(...[0, 1, 2].map(i => [T(520, 520, .22, "square", .2, .5), i * .3]), ...[0, 1, 2].map(i => [T(390, 390, .22, "square", .2, .5), i * .3 + .15]));
  D.roar = () => layer(T(75, 38, 1.8, "saw", .45, .8, .1), N(1.6, .28, 30, .8), T(150, 70, 1.6, "square", .12, 1));
  D.fanfare = () => layer(...seq([57, 64, 69, 76], "square", .22, .12, 1.2, .09), [T(midi(81), midi(81), .6, "tri", .2, 1.0), .36]);
  D.victory = () => layer(...seq([60, 64, 67, 72, 76, 79, 84], "tri", .35, .2, 1.2, .12), ...[60, 64, 67, 72].map(m => [T(midi(m), midi(m), 1.2, "square", .06, .8), .8]));
  D.gameover = () => layer(...[67, 63, 60, 55].map((m, i) => [T(midi(m), midi(m) * .96, .5, "saw", .18, 1.0), i * .28]));
  D.click = () => layer(T(1200, 800, .04, "square", .1));
  D.hover = () => layer(T(700, 700, .025, "tri", .05));
  D.card = () => layer(T(600, 1500, .12, "sine", .2), [T(1500, 2000, .15, "tri", .15), .06]);
  D.deny = () => layer(T(160, 110, .15, "square", .15));
  D.graze = () => layer(T(2600, 2600, .018, "sine", .06, 1.0));
  D.heart = () => layer(T(70, 45, .12, "sine", .6), [T(60, 40, .14, "sine", .5), .17]);
  D.phoenix = () => layer(T(200, 1500, 1.0, "saw", .2, 1.0), N(1.0, .25, 10, 1.4), [T(800, 1800, .6, "tri", .2), .3]);
  D.unlock = () => layer(...seq([64, 68, 71, 76, 80, 83, 88], "square", .5, .1, 1.0, .1));
  D.slow_on = () => layer(T(800, 120, .5, "sine", .3, 1.0));
  D.slow_off = () => layer(T(120, 800, .35, "sine", .25, 1.0));
  return D;
}

function renderMusic(si, boss, menu) {
  const rng = mulberry(1000 + si * 37);
  const [root, scaleName, bpm0] = menu ? [45, "minor", 96] : STAGES[si % STAGES.length].mus;
  const bpm = boss ? bpm0 + 18 : bpm0, sc = SCALES[scaleName];
  const step = 60 / bpm / 4, spb = Math.floor(step * 16 * SR), bars = 8, total = spb * bars;
  const buf = new Float32Array(total), prog = PROGS[si % PROGS.length];
  const kick = tone(120, 38, .16, "sine", .9, 2.2);
  const snare = layer(noise(.13, .5, 3, 2.0), tone(220, 150, .09, "tri", .25));
  const hat = noise(.035, .22, 1, 2.0, true);
  const cache = new Map();
  const note = (m, dur, wave, vol, smooth) => {
    smooth = smooth || 1;
    const k = m + "|" + dur.toFixed(3) + "|" + wave + "|" + vol + "|" + smooth;
    let w = cache.get(k);
    if (!w) { w = tone(midi(m), midi(m), dur, wave, vol, 1.6); if (smooth > 1) w = box(w, smooth); cache.set(k, w); }
    return w;
  };
  const put = (arr, pos, g) => { g = g === undefined ? 1 : g; pos %= total; for (let i = 0; i < arr.length; i++) buf[(pos + i) % total] += arr[i] * g; };
  const deg = d => root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const probs = !boss ? [1, 0, .3, .6, 0, .5, .3, 0, 1, 0, .4, .6, 0, .6, .3, .5] : [1, .6, .5, .6, 1, .6, .5, .6, 1, .6, .5, .6, 1, .6, .7, .6];
  const bassPat = probs.map(p => rng() < p ? 1 : 0); bassPat[0] = 1;
  const arpIdx = Array.from({ length: 16 }, () => [0, 1, 2, 3, 2, 1][Math.floor(rng() * 6)]);
  const lead = Array.from({ length: 16 }, () => { const c = [null, 4, 5, 6, 7, 8, 9][Math.floor(rng() * 7)]; return rng() < .55 ? c : null; });
  for (let bar = 0; bar < bars; bar++) {
    const d0 = prog[bar % 4], tones = [deg(d0), deg(d0 + 2), deg(d0 + 4), deg(d0 + 7)], base = bar * spb;
    let pad = new Float32Array(spb);
    for (const m of tones.slice(0, 3)) for (const det of [-.12, .12]) {
      const f = midi(m + 12) * Math.pow(2, det / 12);
      let ph = 0;
      for (let i = 0; i < spb; i++) { ph += f / SR; pad[i] += 2 * (ph % 1) - 1; }
    }
    pad = box(pad, 10);
    const pg = menu ? .07 : .05;
    for (let i = 0; i < spb; i++) buf[(base + i) % total] += pad[i] * Math.pow(Math.sin(i / (spb - 1) * Math.PI), .6) * pg;
    for (let s = 0; s < 16; s++) {
      const pos = base + Math.floor(s * step * SR);
      if (menu) {
        if (s === 0 || s === 8) put(kick, pos, .35);
        if (s % 2 === 0) put(note(tones[arpIdx[s] % 4] + 12, step * 3, "tri", .12), pos);
        continue;
      }
      if (s % 4 === 0 || (boss && s === 14)) put(kick, pos, s % 8 === 0 ? .9 : .75);
      if (s === 4 || s === 12 || (boss && (s === 10 || s === 15))) put(snare, pos, boss ? .9 : .7);
      if (boss || s % 2 === 0) put(hat, pos, s % 4 === 2 ? .7 : .4);
      if (bassPat[s]) put(note(tones[0] - 24, step * 1.7, "saw", .22, 5), pos);
      if (boss || s % 2 === 0) put(note(tones[arpIdx[s]] + (boss ? 24 : 12), step * 1.6, "square", boss ? .08 : .07), pos);
      if (boss && lead[s] !== null && bar >= 2) put(note(deg(lead[s] + d0) + 12, step * 2.5, "tri", .13), pos);
    }
  }
  let pk = 0; for (let i = 0; i < total; i++) { const v = Math.abs(buf[i]); if (v > pk) pk = v; }
  const k = .55 / (pk || 1); for (let i = 0; i < total; i++) buf[i] *= k;
  return buf;
}

class AudioSys {
  constructor() {
    this.ok = false; this.sfxVol = .8; this.musVol = .55; this.muted = false;
    this.ctx = null; this.sounds = {}; this.last = {}; this.musicCache = {}; this.rendering = {};
    this.want = null; this.curKey = null; this.src = null; this.srcGain = null;
    this.queue = []; this.busy = false; this.active = 0; this.pending = [];
  }
  init() {                                  // must run inside a user gesture (browser rule)
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.mgain = this.ctx.createGain(); this.mgain.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.ok = true;
      this.pending = Object.entries(sfxDefs());
      this._buildSfx();
      if (this.want) this._enqueue(this.want);
    } catch (e) { console.warn("audio disabled", e); }
  }
  _buildSfx() {
    const t0 = performance.now();
    while (this.pending.length && performance.now() - t0 < 10) {
      const [k, fn] = this.pending.shift();
      const d = fn(), b = this.ctx.createBuffer(1, d.length, SR), ch = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) ch[i] = Math.max(-1, Math.min(1, d[i])) * .97;
      this.sounds[k] = b;
    }
    if (this.pending.length) setTimeout(() => this._buildSfx(), 0);
  }
  play(name, vol, gap) {
    if (!this.ok || this.muted) return;
    vol = vol === undefined ? 1 : vol;
    const now = performance.now();
    if (gap && now - (this.last[name] || -999) < gap) return;
    this.last[name] = now;
    const b = this.sounds[name]; if (!b || this.active > 24) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = b; g.gain.value = Math.min(1, vol * this.sfxVol);
    s.connect(g); g.connect(this.sfxBus);
    this.active++; s.onended = () => { this.active--; };
    s.start();
  }
  _enqueue(key) {
    const id = JSON.stringify(key);
    if (this.musicCache[id] || this.rendering[id]) return;
    this.rendering[id] = true; this.queue.push(key); this._pump();
  }
  _pump() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    setTimeout(() => {
      const key = this.queue.shift(), id = JSON.stringify(key);
      try {
        const d = key[0] === "menu" ? renderMusic(0, false, true) : renderMusic(key[0], key[1] === "boss", false);
        const b = this.ctx.createBuffer(1, d.length, SR); b.getChannelData(0).set(d);
        this.musicCache[id] = b;
      } catch (e) { console.warn("music render failed", e); }
      delete this.rendering[id]; this.busy = false; this._pump();
    }, 30);
  }
  music(key) { this.want = key; if (this.ok && key) this._enqueue(key); }
  prefetch(key) { if (this.ok) this._enqueue(key); }
  update() {
    if (!this.ok) return;
    const wid = this.want ? JSON.stringify(this.want) : null;
    if (wid !== this.curKey) {
      const c = this.ctx, t = c.currentTime;
      if (wid === null) { this._stopSrc(.6); this.curKey = null; }
      else if (this.musicCache[wid]) {
        this._stopSrc(.25);
        const s = c.createBufferSource(), g = c.createGain();
        s.buffer = this.musicCache[wid]; s.loop = true; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .7);
        s.connect(g); g.connect(this.mgain); s.start();
        this.src = s; this.srcGain = g; this.curKey = wid;
      }
    }
    this.mgain.gain.value = this.muted ? 0 : this.musVol;
    this.master.gain.value = this.muted ? 0 : 1;
  }
  _stopSrc(f) {
    if (!this.src) return;
    const t = this.ctx.currentTime, s = this.src, g = this.srcGain;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + f); s.stop(t + f + .05); } catch (e) { }
    this.src = null;
  }
}
