"use strict";
(function () {
  const cv = document.getElementById("game");
  const game = new Game(cv);
  window.__game = game;
  // ---- fit canvas to the screen keeping 16:9
  function fit() {
    const w = window.innerWidth, h = window.innerHeight, s = Math.min(w / W, h / H);
    cv.style.width = Math.floor(W * s) + "px"; cv.style.height = Math.floor(H * s) + "px";
  }
  window.addEventListener("resize", fit); fit();
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const KEYMAP = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", " ": " ", Escape: "escape", Enter: "enter", F11: "f11" };
  window.addEventListener("keydown", e => {
    if (e.repeat) return; const k = KEYMAP[e.key] || e.key.toLowerCase();
    if ([" ", "left", "right", "up", "down"].includes(k)) e.preventDefault();
    if (k === "f11") e.preventDefault();
    game.onKey(k, true);
  });
  window.addEventListener("keyup", e => game.onKey(KEYMAP[e.key] || e.key.toLowerCase(), false));
  cv.addEventListener("contextmenu", e => e.preventDefault());
  let slowPtr = null;
  cv.addEventListener("pointerdown", e => {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    game.audio.init();
    const p = pos(e); game.touch = e.pointerType === "touch"; game.mouse = p;
    if (e.button === 0 || e.pointerType === "touch") game.mdown = true;
    if (game.slowHit(p)) { game.slowBtn = true; slowPtr = e.pointerId; }
    game.onClick(p, e.button === 2 ? 2 : 0);
  });
  cv.addEventListener("pointermove", e => { game.mouse = pos(e); if (e.pointerType === "touch") game.touch = true; else if (e.pointerType === "mouse") game.touch = false; });
  const up = e => { game.mdown = false; if (slowPtr === e.pointerId) { game.slowBtn = false; slowPtr = null; } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  const pauseIfHidden = () => { if (game.state === "play") game.state = "pause"; game.keys.clear(); game.slowBtn = false; };
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseIfHidden(); });
  window.addEventListener("blur", pauseIfHidden);
  // ---- loop: fixed 60 Hz update, render every frame
  let last = performance.now(), acc = 0; const step = 1000 / 60;
  function frame(now) {
    const dt = Math.min(100, now - last); last = now; acc += dt;
    let n = 0; while (acc >= step && n < 4) { game.update(); acc -= step; n++; }
    if (n === 4) acc = 0;
    game.audio.update();
    game.draw();
    if (game.auto_q && game.state === "play") {
      game.fps_hist.push(dt);
      if (game.fps_hist.length > 90) {
        const avg = game.fps_hist.reduce((a, b) => a + b, 0) / game.fps_hist.length; game.fps_hist = [];
        if (avg > 1000 / 40 && game.quality > 0) game.quality--; else if (avg < 1000 / 100 && game.quality < 2 && game.t % 3 === 0) game.quality = Math.min(2, game.quality + 1);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => { });
})();
