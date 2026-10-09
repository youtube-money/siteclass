"use strict";
// GRAPHICS: canvas-2D port. Glow and bullet sprites are cached so a frame stays cheap.
const FONT = 'Consolas, "DejaVu Sans Mono", "Courier New", monospace';
const mk = (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; };

function text(c, s, size, col, x, y, anchor, alpha) {
  c.font = "bold " + size + "px " + FONT;
  c.textAlign = anchor === "l" ? "left" : anchor === "r" ? "right" : "center";
  c.textBaseline = "middle";
  if (alpha !== undefined && alpha < 1) c.globalAlpha = Math.max(0, alpha);
  c.fillStyle = rgb(col);
  c.fillText(s, x, y);
  if (alpha !== undefined && alpha < 1) c.globalAlpha = 1;
}
function textW(c, s, size) { c.font = "bold " + size + "px " + FONT; return c.measureText(s).width; }

const _glow = new Map(), _orb = new Map();
function glowSprite(col, r) {
  const key = (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + "|" + r;
  let s = _glow.get(key);
  if (!s) {
    if (_glow.size > 500) _glow.clear();
    s = mk(r * 2, r * 2);
    const g = s.getContext("2d"), gr = g.createRadialGradient(r, r, 0, r, r, r);
    for (const [t, a] of [[0, 1], [.15, .62], [.3, .33], [.5, .12], [.7, .035], [1, 0]]) gr.addColorStop(t, rgb(col, a));
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    _glow.set(key, s);
  }
  return s;
}
function addGlow(c, col, x, y, r, k) {
  r = Math.max(3, Math.round(r));
  c.globalCompositeOperation = "lighter";
  if (k !== undefined && k < 1) c.globalAlpha = k;
  c.drawImage(glowSprite(col, r), (x - r) | 0, (y - r) | 0);
  c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
}
function radial(c, col, x, y, r, k) {            // big one-off glow (used while baking backgrounds)
  const gr = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, a] of [[0, 1], [.15, .62], [.3, .33], [.5, .12], [.7, .035], [1, 0]]) gr.addColorStop(t, rgb(col, a * k));
  c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function orbSprite(col, r) {
  const key = (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + "|" + r;
  let s = _orb.get(key);
  if (!s) {
    const R = Math.ceil(r * 2.4) + 1;
    const cv = mk(R * 2, R * 2), g = cv.getContext("2d"), gr = g.createRadialGradient(R, R, 0, R, R, R);
    gr.addColorStop(0, rgb(col, .45)); gr.addColorStop(.5, rgb(col, .2)); gr.addColorStop(1, rgb(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
    g.fillStyle = rgb(col); g.beginPath(); g.arc(R, R, r, 0, TAU); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(R, R, Math.max(1, r * .55), 0, TAU); g.fill();
    s = [cv, R]; _orb.set(key, s);
  }
  return s;
}
function drawOrb(c, col, x, y, r) { const [s, R] = orbSprite(col, r); c.drawImage(s, (x - R) | 0, (y - R) | 0); }

// ---- primitive helpers (mirror the pygame ones so the shapes port 1:1)
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = rgb(fill); c.fill(); }
  if (stroke) { c.strokeStyle = rgb(stroke); c.lineWidth = lw || 2; c.lineJoin = "round"; c.stroke(); }
}
function body(c, col, pts, w, k) { poly(c, pts, dimc(col, k === undefined ? .28 : k), col, w === undefined ? 2 : w); }
function circ(c, col, x, y, r) { if (r < 1) return; c.fillStyle = rgb(col); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function ring(c, col, x, y, r, w) { if (r < 1) return; c.strokeStyle = rgb(col); c.lineWidth = Math.max(1, w === undefined ? 2 : w); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
function line(c, col, x1, y1, x2, y2, w) { c.strokeStyle = rgb(col); c.lineWidth = Math.max(1, w || 1); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function polyline(c, col, pts, w) { c.strokeStyle = rgb(col); c.lineWidth = Math.max(1, w || 1); c.lineJoin = "round"; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
function ell(c, x, y, w, h, fill, stroke, lw) {       // rect-bounded ellipse like pygame
  c.beginPath(); c.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, TAU);
  if (fill) { c.fillStyle = rgb(fill); c.fill(); }
  if (stroke) { c.strokeStyle = rgb(stroke); c.lineWidth = lw || 2; c.stroke(); }
}
function arcp(c, col, x, y, w, h, a0, a1, lw) {       // pygame arc: angles counter-clockwise, y up
  c.strokeStyle = rgb(col); c.lineWidth = lw || 2; c.beginPath();
  c.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, -a1, -a0); c.stroke();
}
function rot(pts, a, cx, cy, s) {
  s = s === undefined ? 1 : s; cx = cx || 0; cy = cy || 0;
  const ca = Math.cos(a), sa = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x * ca - y * sa) * s, cy + (x * sa + y * ca) * s]);
}
const sin = Math.sin, cos = Math.cos, PI = Math.PI;

function makeShipSprite(ship) {
  const N = 100, big = mk(N * 2, N * 2), g = big.getContext("2d"), c0 = N;
  for (const [pts, kind] of SHAPES[ship.id]) {
    const col = kind === "m" ? ship.col : ship.acc;
    const P = pts.map(([x, y]) => [c0 + x * 2, c0 + y * 2]);
    poly(g, P, dimc(col, .30));
    poly(g, pts.map(([x, y]) => [c0 + x * 2 * .6, c0 + y * 2 * .6 + (kind === "m" ? 6 : 0)]), dimc(col, .55));
    poly(g, P, null, col, 4);
  }
  circ(g, [230, 250, 255], c0, c0 - 8, 9); ring(g, ship.acc, c0, c0 - 8, 9, 3);
  const out = mk(N, N), o = out.getContext("2d");
  o.imageSmoothingQuality = "high"; o.drawImage(big, 0, 0, N, N);
  return out;
}

// ======================================================= enemy species (all face downward)
const DRAW = {};
DRAW.scout = (c, x, y, r, c1, c2, t, e) => {
  body(c, c1, [[x, y + r], [x + r * .95, y - r * .35], [x + r * .4, y - r * .8], [x, y - r * .35], [x - r * .4, y - r * .8], [x - r * .95, y - r * .35]]);
  circ(c, c2, x, y, r * .26);
  const f = 3 + 2 * sin(t * .6);
  line(c, c2, x - r * .3, y - r * .75, x - r * .3, y - r * .75 - f, 2); line(c, c2, x + r * .3, y - r * .75, x + r * .3, y - r * .75 - f, 2);
};
DRAW.dart = (c, x, y, r, c1, c2, t, e) => {
  body(c, c1, [[x, y + r * 1.2], [x + r * .75, y - r], [x, y - r * .45], [x - r * .75, y - r]]);
  line(c, c2, x, y + r * .9, x, y - r * .3, 2); addGlow(c, c2, x, y - r * .9, 10, .8);
};
DRAW.shard = DRAW.dart;
DRAW.wasp = (c, x, y, r, c1, c2, t, e) => {
  const w = sin(t * .8) * .5;
  for (const s of [-1, 1]) body(c, c2, rot([[0, 0], [s * r * 1.3, -r * .5], [s * r * .9, r * .3]], s * w, x, y - r * .2), 2, .2);
  body(c, c1, [[x, y + r * 1.1], [x + r * .5, y], [x + r * .35, y - r * .8], [x - r * .35, y - r * .8], [x - r * .5, y]]);
  circ(c, c2, x, y - r * .1, r * .22); line(c, c2, x, y + r * 1.1, x, y + r * 1.5, 2);
};
DRAW.jelly = (c, x, y, r, c1, c2, t, e) => {
  for (let i = -2; i <= 2; i++) {
    const pts = []; for (let j = 0; j < 5; j++) pts.push([x + i * r * .35 + sin(t * .1 + i + j * .9) * 5, y + r * .2 + j * r * .42]);
    polyline(c, dimc(c1, .8), pts, 2);
  }
  ell(c, x - r, y - r, r * 2, r * 1.5, dimc(c1, .25), c1, 2);
  const p = .5 + .5 * sin(t * .12);
  addGlow(c, c2, x, y - r * .2, r * (.9 + .5 * p), .7); circ(c, c2, x, y - r * .2, r * .25);
};
DRAW.crab = (c, x, y, r, c1, c2, t, e) => {
  const o = (sin(t * .1) + 1) * .2;
  for (const s of [-1, 1]) {
    body(c, c2, rot([[0, 0], [s * r * .7, r * .1], [s * r * .5, r * .7], [s * r * .2, r * .45]], s * o, x + s * r * .8, y), 2, .3);
    line(c, c1, x + s * r * .5, y - r * .1, x + s * r * .85, y + r * .05, 4);
  }
  body(c, c1, [[x - r * .8, y - r * .5], [x + r * .8, y - r * .5], [x + r * .95, y + r * .2], [x, y + r * .8], [x - r * .95, y + r * .2]]);
  for (const s of [-1, 1]) { circ(c, c2, x + s * r * .3, y, r * .16); line(c, c1, x + s * r * .5, y - r * .5, x + s * r * .7, y - r * .85, 2); }
};
DRAW.gear = (c, x, y, r, c1, c2, t, e) => {
  const a = t * .035, pts = [];
  for (let i = 0; i < 16; i++) { const rr = i % 2 === 0 ? r : r * .78; for (const off of [-.12, .12]) { const an = a + (i + off * 3) * TAU / 16; pts.push([x + cos(an) * rr, y + sin(an) * rr]); } }
  body(c, c1, pts, 2, .25); ring(c, c2, x, y, r * .5, 2); circ(c, c2, x, y, r * .2); addGlow(c, c2, x, y, r * .8, .5);
};
DRAW.skull = (c, x, y, r, c1, c2, t, e) => {
  const yy = y + sin(t * .06) * 2;
  ell(c, x - r * .9, yy - r, r * 1.8, r * 1.5, dimc(c1, .28), c1, 2);
  body(c, c1, [[x - r * .5, yy + r * .3], [x + r * .5, yy + r * .3], [x + r * .35, yy + r * .95], [x - r * .35, yy + r * .95]], 2, .22);
  for (const s of [-1, 1]) { circ(c, [0, 0, 0], x + s * r * .38, yy - r * .15, r * .27); addGlow(c, c2, x + s * r * .38, yy - r * .15, 11, .9); }
  for (let i = 0; i < 3; i++) line(c, c1, x - r * .22 + i * r * .22, yy + r * .45, x - r * .22 + i * r * .22, yy + r * .85, 1);
};
DRAW.bat = (c, x, y, r, c1, c2, t, e) => {
  const f = sin(t * .7 + e.ph) * .5;
  for (const s of [-1, 1]) body(c, c1, rot([[0, 0], [s * r * 1.5, -r * .6], [s * r * 1.2, 0], [s * r * .9, r * .5], [s * r * .5, r * .2]], s * f, x, y), 2, .25);
  circ(c, c1, x, y, r * .45); addGlow(c, c2, x, y - r * .1, 8, .9);
};
DRAW.turret = (c, x, y, r, c1, c2, t, e) => {
  const a = e.aim, pts = []; for (let i = 0; i < 6; i++) pts.push([x + cos(i * TAU / 6) * r, y + sin(i * TAU / 6) * r]);
  body(c, c1, pts, 2, .25); line(c, c2, x, y, x + cos(a) * r * 1.5, y + sin(a) * r * 1.5, 5); circ(c, c1, x, y, r * .45);
  if (e.fcd < 30) addGlow(c, RED, x + cos(a) * r * 1.5, y + sin(a) * r * 1.5, 16, 1);
};
DRAW.crystal = (c, x, y, r, c1, c2, t, e) => {
  body(c, c1, [[x, y - r * 1.15], [x + r * .75, y], [x, y + r * 1.15], [x - r * .75, y]], 2, .22);
  line(c, c2, x, y - r * 1.15, x, y + r * 1.15, 1); line(c, c2, x - r * .75, y, x + r * .75, y, 1);
  addGlow(c, c2, x, y, r * (.8 + .2 * sin(t * .1)), .6);
};
DRAW.mine = (c, x, y, r, c1, c2, t, e) => {
  const a = t * .03;
  for (let i = 0; i < 8; i++) { const th = a + i * TAU / 8; line(c, c1, x + cos(th) * r * .6, y + sin(th) * r * .6, x + cos(th) * r * 1.2, y + sin(th) * r * 1.2, 3); }
  circ(c, dimc(c1, .3), x, y, r * .7); ring(c, c1, x, y, r * .7, 2);
  const p = (sin(t * .25) + 1) / 2;
  addGlow(c, RED, x, y, 10 + 6 * p, .6 + .4 * p); circ(c, mixc(c2, RED, p), x, y, r * .22);
};
DRAW.eye = (c, x, y, r, c1, c2, t, e) => {
  ell(c, x - r * 1.1, y - r * .75, r * 2.2, r * 1.5, dimc(c1, .22), c1, 2);
  const a = e.aim, ix = x + cos(a) * r * .35, iy = y + sin(a) * r * .25;
  circ(c, c2, ix, iy, r * .48); circ(c, [0, 0, 0], ix, iy, r * .22); addGlow(c, c2, ix, iy, r * 1.1, .5);
  for (const s of [-1, 1]) line(c, c1, x + s * r * 1.1, y, x + s * r * 1.5, y + sin(t * .1) * 4, 2);
};
DRAW.knight = (c, x, y, r, c1, c2, t, e) => {
  body(c, c1, [[x - r * .8, y - r * .9], [x + r * .8, y - r * .9], [x + r * .95, y + r * .2], [x, y + r * 1.05], [x - r * .95, y + r * .2]], 3, .24);
  body(c, c2, [[x - r * .55, y - r * .1], [x + r * .55, y - r * .1], [x + r * .4, y + r * .45], [x, y + r * .75], [x - r * .4, y + r * .45]], 2, .3);
  line(c, c2, x, y - r * .9, x, y - r * 1.4 + sin(t * .1) * 3, 4); circ(c, c2, x, y - r * .45, r * .17); addGlow(c, c2, x, y - r * .45, 12, .8);
};
DRAW.flame = (c, x, y, r, c1, c2, t, e) => {
  for (const [k, col] of [[1.0, c1], [.68, mixc(c1, c2, .6)], [.38, c2]]) {
    const fl = sin(t * .35 + k * 5) * 2;
    poly(c, [[x, y + r * 1.1 * k], [x + r * .75 * k, y - r * .1 * k + fl], [x + r * .35 * k, y - r * .9 * k], [x, y - r * 1.4 * k + fl], [x - r * .35 * k, y - r * .9 * k], [x - r * .75 * k, y - r * .1 * k - fl]], col);
  }
  addGlow(c, c1, x, y, r * 2, .5);
};
DRAW.squid = (c, x, y, r, c1, c2, t, e) => {
  for (let i = -2; i <= 2; i++) { const pts = []; for (let j = 0; j < 5; j++) pts.push([x + i * r * .3 + sin(t * .12 + i * 1.3 + j * .8) * (3 + j), y - r * .2 - j * r * .35]); polyline(c, dimc(c1, .9), pts, 3); }
  body(c, c1, [[x, y + r * 1.2], [x + r * .8, y + r * .1], [x + r * .5, y - r * .9], [x - r * .5, y - r * .9], [x - r * .8, y + r * .1]], 2, .24);
  for (const s of [-1, 1]) circ(c, c2, x + s * r * .3, y + r * .1, r * .17);
  addGlow(c, c2, x, y, r * 1.1, .4);
};
DRAW.manta = (c, x, y, r, c1, c2, t, e) => {
  const u = sin(t * .09) * r * .35;
  for (const s of [-1, 1]) body(c, c1, [[x, y + r * .5], [x + s * r * 1.5, y - r * .4 + u * s * .3], [x + s * r * 1.0, y - r * .7], [x, y - r * .45]], 2, .24);
  line(c, c2, x, y - r * .4, x, y - r * 1.4 - u * .3, 2);
  for (const s of [-1, 1]) circ(c, c2, x + s * r * .2, y + r * .1, r * .12);
  addGlow(c, c2, x, y, r * .9, .45);
};

// ======================================================= bosses : each has its own body
const BDRAW = {};
BDRAW.SENTINEL = (c, x, y, r, c1, c2, t, b) => {
  for (let i = 0; i < 6; i++) body(c, c1, rot([[r * 1.05, -14], [r * 1.3, -8], [r * 1.3, 8], [r * 1.05, 14]], t * .01 + i * TAU / 6, x, y), 2, .3);
  const hx = []; for (let i = 0; i < 6; i++) hx.push([x + cos(i * TAU / 6) * r, y + sin(i * TAU / 6) * r]);
  body(c, c1, hx, 3, .22); ring(c, c2, x, y, r * .62, 2); circ(c, [10, 10, 20], x, y, r * .5);
  const a = b.aim; circ(c, c2, x + cos(a) * 9, y + sin(a) * 9, r * .26); circ(c, WHITE, x + cos(a) * 12, y + sin(a) * 12, r * .1);
  addGlow(c, c2, x, y, r * 1.2, .55);
  for (const s of [-1, 1]) body(c, c2, [[x + s * r * 1.15, y - 10], [x + s * r * 1.6, y + 14], [x + s * r * 1.15, y + 30]], 2, .3);
};
BDRAW.HYDRA = (c, x, y, r, c1, c2, t, b) => {
  for (const i of [-1, 0, 1]) {
    const sw = sin(t * .035 + i * 1.7) * 18, hx = x + i * r * 1.35 + sw, hy = y - r * (i === 0 ? .7 : .15) + cos(t * .03 + i) * 8;
    const pts = [[x + i * r * .3, y + r * .5], [x + i * r * .9, y + r * .1 + sw * .3], [hx, hy + r * .5], [hx, hy]];
    polyline(c, dimc(c1, .45), pts, r * .38); polyline(c, c1, pts, 3);
    body(c, c1, [[hx - r * .38, hy - r * .25], [hx + r * .38, hy - r * .25], [hx, hy + r * .5]], 2, .3);
    for (const s of [-1, 1]) circ(c, c2, hx + s * r * .16, hy - r * .05, 4);
    addGlow(c, c2, hx, hy, 22, .6);
  }
  ell(c, x - r * .75, y - r * .15, r * 1.5, r * 1.1, dimc(c1, .3), c1, 3);
  for (let i = 0; i < 5; i++) circ(c, c2, x - r * .45 + i * r * .22, y + r * .35, 4);
};
BDRAW.LEVIATHAN = (c, x, y, r, c1, c2, t, b) => {
  for (const s of [-1, 1]) body(c, c1, [[x + s * r * .6, y], [x + s * r * 1.7, y - r * .5 + sin(t * .05) * 10], [x + s * r * 1.4, y + r * .5], [x + s * r * .7, y + r * .35]], 2, .25);
  ell(c, x - r * 1.1, y - r * .9, r * 2.2, r * 1.7, dimc(c1, .25), c1, 3);
  const lure = [x + sin(t * .04) * 14, y - r * 1.4];
  polyline(c, c1, [[x, y - r * .8], [x + 10, y - r * 1.15], lure], 3);
  addGlow(c, c2, lure[0], lure[1], 28, 1); circ(c, WHITE, lure[0], lure[1], 5);
  for (const s of [-1, 1]) { circ(c, [255, 255, 230], x + s * r * .45, y - r * .25, r * .2); circ(c, [0, 0, 0], x + s * r * .45 + cos(b.aim) * 4, y - r * .25 + sin(b.aim) * 4, r * .09); }
  const op = 8 + 8 * sin(t * .05);
  for (let i = 0; i < 9; i++) { const tx = x - r * .8 + i * r * .2; body(c, WHITE, [[tx, y + r * .3], [tx + r * .1, y + r * .3 + op + 8], [tx + r * .2, y + r * .3]], 1, .6); }
};
BDRAW.BEHEMOTH = (c, x, y, r, c1, c2, t, b) => {
  for (const s of [-1, 1]) {
    c.fillStyle = rgb(dimc(c1, .25)); c.fillRect(x + s * r * 1.15 - r * .22, y - r * .8, r * .44, r * 1.8);
    for (let j = 0; j < 6; j++) { const yy = y - r * .7 + j * r * .3 + (t * .8) % (r * .3); line(c, c1, x + s * r * 1.15 - r * .2, yy, x + s * r * 1.15 + r * .2, yy, 2); }
  }
  body(c, c1, [[x - r, y - r * .6], [x + r, y - r * .6], [x + r * 1.05, y + r * .7], [x - r * 1.05, y + r * .7]], 3, .22);
  for (let i = 0; i < 5; i++) circ(c, c2, x - r * .8 + i * r * .4, y + r * .5, 3);
  const a = b.aim; circ(c, dimc(c1, .4), x, y - r * .05, r * .5); ring(c, c1, x, y - r * .05, r * .5, 3);
  for (const off of [-.12, .12]) line(c, c2, x, y - r * .05, x + cos(a + off) * r * 1.15, y - r * .05 + sin(a + off) * r * 1.15, 8);
  addGlow(c, c2, x, y - r * .05, r * .6, .5);
};
BDRAW.OBLIVION = (c, x, y, r, c1, c2, t, b) => {
  for (let i = 0; i < 7; i++) {
    const a = -PI / 2 + (i - 3) * .42;
    body(c, c1, [[x + cos(a - .1) * r * .9, y + sin(a - .1) * r * .9], [x + cos(a) * r * 1.5, y + sin(a) * r * 1.5], [x + cos(a + .1) * r * .9, y + sin(a + .1) * r * .9]], 2, .3);
  }
  for (let k = 0; k < 3; k++) {
    const a = t * (.02 + k * .01) * (k % 2 ? 1 : -1), f = 1 - k * .18;
    arcp(c, mixc(c1, c2, k / 2), x - r * f, y - r * f, r * 2 * f, r * 2 * f, a, a + 4.2, 4);
  }
  circ(c, [0, 0, 0], x, y, r * .55); ring(c, c2, x, y, r * .55, 3); addGlow(c, c2, x, y, r * 1.4, .45);
  circ(c, c2, x + cos(b.aim) * 8, y + sin(b.aim) * 8, r * .14);
};
BDRAW.TEMPEST = (c, x, y, r, c1, c2, t, b) => {
  const f = sin(t * .08) * .22;
  for (const s of [-1, 1]) {
    const fe = [];
    for (let j = 0; j < 6; j++) { const a = -.3 + j * .2 + f * s, L = r * (2.1 - j * .1); fe.push([x + s * cos(a) * L, y - sin(a) * L * .55 + j * 6]); }
    body(c, c1, [[x + s * r * .3, y - r * .3], ...fe, [x + s * r * .4, y + r * .5]], 2, .22);
    addGlow(c, c2, fe[0][0], fe[0][1], 20, .5 + .4 * sin(t * .3 + s));
    if (Math.floor(t) % 20 < 3) polyline(c, c2, [fe[0], [fe[0][0] + s * 14, fe[0][1] + 12], [fe[0][0] + s * 4, fe[0][1] + 26]], 2);
  }
  body(c, c1, [[x, y + r * .9], [x + r * .45, y - r * .1], [x + r * .3, y - r * .7], [x - r * .3, y - r * .7], [x - r * .45, y - r * .1]], 3, .3);
  body(c, c2, [[x - r * .15, y + r * .1], [x + r * .15, y + r * .1], [x, y + r * .6]], 1, .9);
  for (const s of [-1, 1]) circ(c, c2, x + s * r * .16, y - r * .35, 4);
};
BDRAW.ECLIPSE = (c, x, y, r, c1, c2, t, b) => {
  for (let i = 0; i < 16; i++) { const a = t * .01 + i * TAU / 16, L = r * (1.4 + .15 * (i % 2)); line(c, dimc(c2, .7), x + cos(a) * r * 1.05, y + sin(a) * r * 1.05, x + cos(a) * L, y + sin(a) * L, 3); }
  addGlow(c, c2, x, y, r * 1.8, .55); circ(c, dimc(c1, .5), x, y, r);
  for (const [dx, dy, rr] of [[-.3, -.2, .22], [.35, .25, .17], [.1, -.5, .12], [-.4, .4, .13]]) circ(c, dimc(c1, .32), x + dx * r, y + dy * r, rr * r);
  ring(c, c1, x, y, r, 3);
  const sh = t * .012; circ(c, [4, 4, 12], x + cos(sh) * r * .45, y + sin(sh) * r * .45, r * .9); ring(c, c2, x, y, r * 1.02, 2);
};
BDRAW.SERAPH = (c, x, y, r, c1, c2, t, b) => {
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) {
    const a = -.15 + j * .45 + sin(t * .04) * .08, L = r * (2.0 - j * .35);
    body(c, j !== 1 ? c1 : c2, [[x + s * r * .25, y - r * .1 + j * 6], [x + s * cos(a) * L, y - sin(a) * L * .6 + j * 4 - r * .2],
      [x + s * cos(a + .17) * L * .75, y - sin(a + .17) * L * .45 + j * 8], [x + s * r * .3, y + r * .25 + j * 8]], 2, .2);
  }
  body(c, c1, [[x, y - r * .9], [x + r * .5, y - r * .1], [x, y + r * .9], [x - r * .5, y - r * .1]], 3, .25);
  line(c, c2, x, y - r * .9, x, y + r * .9, 1); ring(c, c2, x, y - r * 1.15, r * .38, 3);
  addGlow(c, c2, x, y - r * .1, r * 1.1, .6); circ(c, WHITE, x, y - r * .1, r * .12);
};
BDRAW.ABYSS = (c, x, y, r, c1, c2, t, b) => {
  for (let i = 0; i < 8; i++) {
    const base = -.3 + i * .55 - 1.2, pts = [];
    for (let j = 0; j < 9; j++) pts.push([x + cos(base + PI / 2) * (r * .45 + j * r * .22) + sin(t * .05 + j * .6 + i) * (6 + j * 2.5), y + r * .3 + j * r * .18 + Math.abs(sin(base)) * j * 2]);
    polyline(c, dimc(c1, .5), pts, r * .2); polyline(c, c1, pts, 2); addGlow(c, c2, pts[8][0], pts[8][1], 10, .6);
  }
  ell(c, x - r, y - r * 1.05, r * 2, r * 1.6, dimc(c1, .25), c1, 3);
  circ(c, [240, 255, 240], x, y - r * .3, r * .38);
  circ(c, c2, x + cos(b.aim) * r * .1, y - r * .3 + sin(b.aim) * r * .1, r * .22);
  circ(c, [0, 0, 0], x + cos(b.aim) * r * .13, y - r * .3 + sin(b.aim) * r * .13, r * .1);
  addGlow(c, c2, x, y - r * .3, r * .9, .4);
};
BDRAW.TYRANT = (c, x, y, r, c1, c2, t, b) => {
  for (const s of [-1, 1]) { const fx = x + s * r * 1.45, fy = y + r * .2 + sin(t * .05 + s) * 10; body(c, c1, [[fx - 22, fy - 20], [fx + 22, fy - 20], [fx + 26, fy + 18], [fx - 26, fy + 18]], 3, .25); addGlow(c, c2, fx, fy, 26, .5); }
  body(c, c1, [[x - r * .9, y - r * .3], [x + r * .9, y - r * .3], [x + r * 1.1, y + r * .9], [x - r * 1.1, y + r * .9]], 3, .2);
  for (let i = 0; i < 4; i++) polyline(c, c2, [[x - r * .6 + i * r * .4, y + r * .9], [x - r * .5 + i * r * .4, y + r * .4], [x - r * .65 + i * r * .4, y]], 2);
  body(c, c1, [[x - r * .55, y - r * .95], [x + r * .55, y - r * .95], [x + r * .6, y - r * .2], [x, y + r * .15], [x - r * .6, y - r * .2]], 3, .25);
  body(c, c2, [[x - r * .55, y - r * .95], [x - r * .45, y - r * 1.5], [x - r * .22, y - r * 1.1], [x, y - r * 1.65], [x + r * .22, y - r * 1.1], [x + r * .45, y - r * 1.5], [x + r * .55, y - r * .95]], 2, .3);
  for (const s of [-1, 1]) { circ(c, c2, x + s * r * .25, y - r * .5, r * .1); addGlow(c, c2, x + s * r * .25, y - r * .5, 16, .9); }
};
BDRAW.CHRONOS = (c, x, y, r, c1, c2, t, b) => {
  [.01, -.015].forEach((sp, k) => {
    const pts = [];
    for (let i = 0; i < 24; i++) { const rr = r * (i % 2 === 0 ? 1.35 : 1.15) - k * 10; for (const off of [-.15, .15]) { const an = t * sp + (i + off) * TAU / 24; pts.push([x + cos(an) * rr, y + sin(an) * rr]); } }
    poly(c, pts, null, dimc(k ? c2 : c1, .35), 2);
  });
  circ(c, dimc(c1, .22), x, y, r); ring(c, c1, x, y, r, 4);
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r2 = r * (i % 3 ? .95 : .98); line(c, c2, x + cos(a) * r * .82, y + sin(a) * r * .82, x + cos(a) * r2, y + sin(a) * r2, i % 3 === 0 ? 4 : 2); }
  const a1 = t * .05, a2 = t * .004;
  line(c, WHITE, x, y, x + cos(a1) * r * .85, y + sin(a1) * r * .85, 3); line(c, c2, x, y, x + cos(a2) * r * .55, y + sin(a2) * r * .55, 6);
  circ(c, c2, x, y, 8); addGlow(c, c2, x, y, r * 1.3, .35);
};
BDRAW.ZENITH = (c, x, y, r, c1, c2, t, b) => {
  for (let i = 0; i < 20; i++) {
    const a = t * .008 + i * TAU / 20, L = r * (i % 2 === 0 ? 1.9 : 1.45) + sin(t * .1 + i) * 8;
    body(c, i % 2 ? c2 : c1, [[x + cos(a - .09) * r * .8, y + sin(a - .09) * r * .8], [x + cos(a) * L, y + sin(a) * L], [x + cos(a + .09) * r * .8, y + sin(a + .09) * r * .8]], 1, .5);
  }
  addGlow(c, c2, x, y, r * 2.2, .8);
  [.03, -.02, .015].forEach((sp, k) => { const a = t * sp, f = 1 - k * .22; arcp(c, k % 2 ? c2 : c1, x - r * f, y - r * f, r * 2 * f, r * 2 * f, a, a + 4.4, 4); });
  circ(c, WHITE, x, y, r * .42); addGlow(c, WHITE, x, y, r * .9, .9); circ(c, c2, x + cos(b.aim) * 7, y + sin(b.aim) * 7, r * .14);
};

// ======================================================= backgrounds
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; }
function makeBg(st) {
  const cv = mk(W, H), g = cv.getContext("2d"), rng = mulberry(hashStr(st.name));
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgb(st.top)); gr.addColorStop(1, rgb(st.bot));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i++) radial(g, st.neb[i % 2], rng() * W, rng() * H, 180 + rng() * 160, .22);
  g.globalCompositeOperation = "source-over";
  if (st.deco.includes("planet")) {
    const [px, py, pr] = rng() < .5 ? [1020, 190, 150] : [230, 220, 130], pc = st.neb[0];
    for (let i = pr; i > 0; i -= 3) circ(g, mixc(dimc(pc, .55), dimc(pc, .08), i / pr), px - (pr - i) * .25, py - (pr - i) * .25, i);
    ell(g, px - pr * 1.7, py - pr * .22, pr * 3.4, pr * .44, null, dimc(st.neb[1], .5), 3);
  }
  if (st.deco.includes("circuit")) {
    for (let i = 0; i < 26; i++) {
      let x0 = Math.floor(rng() * 32) * 40, y0 = Math.floor(rng() * 18) * 40;
      const pts = [[x0, y0]], n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        x0 += (rng() < .5 ? -1 : 1) * (1 + Math.floor(rng() * 3)) * 40; pts.push([x0, y0]);
        y0 += (rng() < .5 ? -1 : 1) * (1 + Math.floor(rng() * 3)) * 40; pts.push([x0, y0]);
      }
      polyline(g, dimc(st.neb[0], .28), pts, 2); circ(g, dimc(st.neb[0], .5), pts[pts.length - 1][0], pts[pts.length - 1][1], 4);
    }
  }
  return cv;
}

class Deco {
  constructor() {
    this.t = 0; this.flash = 0; this.bolt = []; this.speed = 1;
    this.stars = Array.from({ length: 130 }, () => [rnd(0, W), rnd(0, H), rnd(.4, 3.6)]);
    this.embers = Array.from({ length: 34 }, () => [rnd(0, W), rnd(0, H), rnd(.5, 2), rnd(1, 3)]);
    this.rain = Array.from({ length: 55 }, () => [rnd(0, W), rnd(0, H), rnd(14, 34), rnd(14, 24)]);
    this.rocks = Array.from({ length: 8 }, () => [rnd(0, W), rnd(-H, H), rnd(.4, 1.3), rnd(14, 40), rnd(0, 6), rnd(-.02, .02), Math.random()]);
    this.ds = mk(W / 2, H / 2); this.dc = this.ds.getContext("2d");
  }
  update(st, slow) {
    slow = slow === undefined ? 1 : slow; this.t++;
    const sp = this.speed * slow, dec = st.deco;
    for (const s of this.stars) { s[1] += s[2] * .6 * sp; if (s[1] > H) { s[0] = rnd(0, W); s[1] = -4; } }
    if (dec.includes("embers")) for (const e of this.embers) { e[1] -= e[2] * sp; e[0] += sin(this.t * .02 + e[3]) * .5; if (e[1] < -10) { e[0] = rnd(0, W); e[1] = H + 10; } }
    if (dec.includes("rain")) for (const r of this.rain) { r[1] += r[2] * sp; r[0] -= 3 * sp; if (r[1] > H) { r[0] = rnd(0, W + 80); r[1] = -r[3]; } }
    if (dec.includes("rocks")) for (const r of this.rocks) { r[1] += r[2] * sp; r[4] += r[5]; if (r[1] > H + 60) { r[0] = rnd(0, W); r[1] = -60; } }
    if (dec.includes("storm")) {
      if (this.flash > 0) this.flash--;
      else if (Math.random() < .004) {
        this.flash = 9; let x = rnd(100, W - 100), yy = 0; this.bolt = [[x, 0]];
        while (yy < H) { yy += rnd(40, 80); x += rnd(-40, 40); this.bolt.push([x, yy]); }
      }
    }
  }
  drawBack(c, st, quality) {
    const t = this.t, dec = st.deco;
    for (const [x, y, z] of this.stars) {
      const v = Math.min(255, 70 + z * 45 | 0); c.fillStyle = rgb([v, v, Math.min(255, v + 25)]);
      const sz = z > 2.4 ? 2 : 1; c.fillRect(x | 0, y | 0, sz, sz);
    }
    if (dec.includes("rocks")) for (const r of this.rocks) {
      const n = 7, P = [];
      for (let i = 0; i < n; i++) {
        const a = r[4] + i * TAU / n, k1 = .7 + .3 * ((i * 7 + Math.floor(r[6] * 9)) % 3) / 2;
        P.push([r[0] + cos(a) * r[3] * k1, r[1] + sin(a) * r[3] * k1]);
      }
      poly(c, P, st.bot, dimc(st.neb[0], .5), 2);
    }
    if (dec.includes("embers")) for (const e of this.embers) addGlow(c, st.pal[0], e[0], e[1], 5 + e[3] * 2, .8);
    if (quality >= 1 && ["aurora", "vortex", "beams", "grid"].some(k => dec.includes(k))) {
      const d = this.dc, hw = W / 4, hh = H / 4;
      d.clearRect(0, 0, W / 2, H / 2);
      if (dec.includes("aurora")) for (let k = 0; k < 3; k++) {
        d.strokeStyle = rgb(dimc(st.neb[k % 2], .26)); d.lineWidth = 6; d.beginPath();
        for (let x = 0; x < W / 2; x += 6) { const y = 60 + k * 45 + sin(x * .02 + t * .012 + k * 2) * 28 + sin(x * .007 - t * .006) * 18; d.moveTo(x, y); d.lineTo(x, y + 50 + 20 * sin(x * .03 + t * .02)); }
        d.stroke();
      }
      if (dec.includes("vortex")) for (let k = 0; k < 5; k++) {
        const pts = []; for (let i = 0; i < 34; i++) { const a = t * .012 + k * TAU / 5 + i * .17, rr = 8 + i * 6.5; pts.push([hw + cos(a) * rr, hh + sin(a) * rr * .8]); }
        polyline(d, dimc(st.neb[k % 2], .3), pts, 5);
      }
      if (dec.includes("beams")) for (let k = 0; k < 5; k++) {
        const x = (((k * 160 + sin(t * .006 + k) * 70) % (W / 2 + 100)) + (W / 2 + 100)) % (W / 2 + 100) - 50;
        poly(d, [[x, 0], [x + 30, 0], [x - 90, H / 2], [x - 150, H / 2]], dimc(st.neb[k % 2], .32));
      }
      if (dec.includes("grid")) {
        for (let i = 0; i < 16; i++) { const f = Math.pow((i / 16 + t * .004) % 1, 2); line(d, dimc(st.pal[0], .5), 0, H / 2 - 20 - f * (H / 2 - 100), W / 2, H / 2 - 20 - f * (H / 2 - 100), 2); }
        for (let i = -8; i <= 8; i++) line(d, dimc(st.pal[0], .4), hw + i * 20, H / 2 - 100, hw + i * 95, H / 2, 2);
      }
      c.globalCompositeOperation = "lighter"; c.imageSmoothingEnabled = quality >= 2;
      c.drawImage(this.ds, 0, 0, W, H); c.imageSmoothingEnabled = true; c.globalCompositeOperation = "source-over";
    }
    if (dec.includes("circuit")) for (let i = 0; i < 5; i++) { const p = (t * 3 + i * 260) % 1400; addGlow(c, st.neb[0], (p * 1.37) % W, (p * .91 + i * 120) % H, 14, .5); }
    if (dec.includes("rain")) {
      c.strokeStyle = rgb(dimc(st.neb[0], .55)); c.lineWidth = 1; c.beginPath();
      for (const r of this.rain) { c.moveTo(r[0], r[1]); c.lineTo(r[0] - 3, r[1] + r[3]); }
      c.stroke();
    }
    if (dec.includes("storm") && this.flash > 0) {
      c.globalCompositeOperation = "lighter"; const f = this.flash / 3;
      c.fillStyle = rgb([14 * f, 16 * f, 34 * f]); c.fillRect(0, 0, W, H); c.globalCompositeOperation = "source-over";
      if (this.bolt.length > 1 && this.flash > 4) polyline(c, [220, 230, 255], this.bolt, 3);
    }
  }
}
