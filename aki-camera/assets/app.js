// Aki Cam landing page. No framework: small modules, each started only when its section is near.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));

function near(el, fn, margin = '400px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
}
function watch(el, fn) {          // fn(visible) whenever the element enters or leaves the viewport, or the tab hides
  let on = false, seen = false;
  const set = () => { const v = seen && !document.hidden; if (v !== on) { on = v; fn(v); } };
  new IntersectionObserver((es) => { seen = es[0].isIntersecting; set(); }).observe(el);
  document.addEventListener('visibilitychange', set);
}
function press(group, btn) { $$('button', group).forEach((b) => b.setAttribute('aria-pressed', String(b === btn))); }
function imageReady(img) {
  if (img.complete && img.naturalWidth) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  return new Promise((res, rej) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', rej, { once: true }); });
}
function loadImage(src) { const i = new Image(); i.decoding = 'async'; i.src = src; return imageReady(i).then(() => i); }
function webgl2() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } }

/* ---------- reveal ---------- */
(() => {
  const els = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
})();

/* ---------- hero (WebGL, loaded after first paint) ---------- */
(() => {
  const hero = $('#top'), canvas = $('#hero-gl');
  if (!hero || !canvas) return;
  const start = () => idle(() => {
    if (!webgl2()) return;                                    // poster stays
    import('./hero.js').then((m) => m.initHero({ hero, canvas, stage: $('.hero-stage', hero), caption: $('#hero-cap'), reduced }))
      .catch(() => hero.classList.remove('gl-on'));
  });
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
})();

/* ---------- Looks viewfinder ---------- */
(() => {
  const finder = $('#finder'); if (!finder) return;
  const base = $('.base', finder), next = $('.next', finder), wipe = $('.wipe', finder);
  const col = $('#look-col'), name = $('#look-name'), desc = $('#look-desc');
  const list = $('#look-list'), tabs = $('#look-tabs');
  let token = 0, anim = null;
  function show(btn) {
    const src = btn.dataset.src, my = ++token;
    press(list, btn);
    col.textContent = btn.dataset.col; name.textContent = btn.dataset.name; desc.textContent = btn.dataset.desc;
    base.alt = btn.dataset.alt;
    loadImage(src).then(() => {
      if (my !== token) return;
      if (anim) { anim.forEach((a) => a.cancel()); anim = null; }
      if (reduced || !next.animate) { base.src = src; return; }
      next.src = src;
      const o = { duration: 620, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' };
      const a1 = next.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], o);
      const a2 = wipe.animate([{ left: '0%', opacity: 1 }, { left: '100%', opacity: 1, offset: .96 }, { left: '100%', opacity: 0 }], o);
      anim = [a1, a2];
      a1.finished.then(() => { if (my !== token) return; base.src = src; return imageReady(base); }).then(() => { if (my === token && anim) { anim.forEach((a) => a.cancel()); anim = null; } }).catch(() => {});
    }).catch(() => {});
  }
  list.addEventListener('click', (e) => { const b = e.target.closest('button.look'); if (b) show(b); });
  if (finePointer) list.addEventListener('pointerover', (e) => { const b = e.target.closest('button.look'); if (b && !b.dataset.warm) { b.dataset.warm = 1; new Image().src = b.dataset.src; } });
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    press(tabs, b);
    $$('.look-group', list).forEach((g) => { g.hidden = g.dataset.col !== b.dataset.col; });
  });
})();

/* ---------- depth strip ---------- */
(() => {
  const strip = $('#strip'); if (!strip) return;
  const figs = $$('figure', strip);
  $$('.arrow').forEach((a) => a.addEventListener('click', () => {
    const w = figs[0].getBoundingClientRect().width + parseFloat(getComputedStyle(strip).columnGap || 20);
    strip.scrollBy({ left: w * (a.dataset.dir === 'next' ? 1 : -1), behavior: reduced ? 'auto' : 'smooth' });
  }));
  const mid = figs[Math.floor(figs.length / 2) - 1];
  strip.scrollLeft = mid.offsetLeft - (strip.clientWidth - mid.offsetWidth) / 2;
  if (reduced) return;
  let raf = 0, active = false;
  function paint() {
    raf = 0;
    const r = strip.getBoundingClientRect(), mid = r.left + r.width / 2;
    for (const f of figs) {
      const b = f.getBoundingClientRect();
      if (b.right < r.left - 400 || b.left > r.right + 400) continue;
      const w = f.offsetWidth, c = b.left + b.width / 2;
      const d = Math.max(-3, Math.min(3, (c - mid) / w)), a = Math.abs(d);
      f.style.transform = `perspective(1300px) translateY(${(-18 * Math.max(0, 1 - a)).toFixed(1)}px) rotateY(${(-d * 15).toFixed(2)}deg) scale(${(1 - Math.min(a, 2) * .05).toFixed(3)})`;
      f.style.zIndex = String(10 - Math.round(a * 2));
      f.lastElementChild.style.opacity = (1 - Math.min(1, a * .75)).toFixed(2);
      f.firstElementChild.style.filter = `brightness(${(1 - Math.min(a, 2.5) * .2).toFixed(2)})`;
    }
  }
  const req = () => { if (!raf && active) raf = requestAnimationFrame(paint); };
  strip.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req, { passive: true });
  watch(strip, (v) => { active = v; req(); });
})();

/* ---------- camcorder ---------- */
near($('#vhs'), async () => {
  const box = $('#vhs'), hud = $('.hud', box), img = $('img', box), canvas = $('canvas', box), sets = $('#sets'), tc = $('.tc', hud), date = $('.br', hud);
  const now = new Date(), MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], p2 = (n) => String(n).padStart(2, '0');
  const DATES = {
    mon: `${MON[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`,
    dotted: `${now.getFullYear()}.${p2(now.getMonth() + 1)}.${p2(now.getDate())}`,
    time: `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`,
    film: `’${p2(now.getFullYear() % 100)} ${p2(now.getMonth() + 1)} ${p2(now.getDate())}`,
  };
  date.textContent = DATES[hud.dataset.date || 'mon'];
  let fx = null, amt = 0.7, secs = 0, tick = 0, raf = 0, last = 0, t = 0, visible = false;
  if (webgl2()) {
    const m = await import('./fx.js');
    fx = m.createFX(canvas, m.VHS, 960);
    if (fx) { await imageReady(img).catch(() => {}); fx.setImage(img); fx.draw({ uTime: 3.1, uAmt: amt }); box.classList.add('live'); }
  }
  function loop(ts) {
    raf = 0; if (!visible || !fx || fx.lost) return;
    if (ts - last >= 32) { t += Math.min(.1, (ts - last) / 1000); last = ts; fx.draw({ uTime: t, uAmt: amt }); }
    raf = requestAnimationFrame(loop);
  }
  watch(box, (v) => {
    visible = v; box.classList.toggle('run', v && !reduced);
    clearInterval(tick);
    if (v && !reduced) {
      tick = setInterval(() => { secs++; tc.textContent = `${Math.floor(secs / 3600)}:${p2(Math.floor(secs / 60) % 60)}:${p2(secs % 60)}`; }, 1000);
      if (fx && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }
  });
  let token = 0;
  sets.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    press(sets, b); const my = ++token;
    loadImage(b.dataset.img).then((im) => {
      if (my !== token) return;
      amt = parseFloat(b.dataset.amt); hud.dataset.font = b.dataset.font; hud.dataset.tone = b.dataset.tone || ''; date.textContent = DATES[b.dataset.date];
      img.removeAttribute('srcset'); img.src = b.dataset.img; img.alt = b.dataset.alt;
      if (fx) { fx.setImage(im); fx.draw({ uTime: t || 3.1, uAmt: amt }); }
    }).catch(() => {});
  });
});

/* ---------- date stamp ---------- */
(() => {
  const stamp = $('#stamp'), opts = $('#stamp-opts'); if (!stamp || !opts) return;
  opts.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    press(b.parentElement, b); stamp.dataset[b.dataset.k] = b.dataset.v;
  });
})();

/* ---------- lens filters ---------- */
near($('#lens-fx-wrap'), async () => {
  const box = $('#lens-fx-wrap'), img = $('img', box), canvas = $('canvas', box), ui = $('#lens-chips'), sub = $('#lens-sub'), label = $('#lens-name');
  if (!webgl2()) { $('.lens-ui').hidden = true; return; }
  const m = await import('./fx.js');
  const fx = m.createFX(canvas, m.LENS, 1100);
  if (!fx) { $('.lens-ui').hidden = true; return; }
  await imageReady(img).catch(() => {});
  const full = await loadImage(img.currentSrc || img.src).catch(() => img);
  fx.setImage(full);
  let mode = 1, s = 0, raf = 0, t0 = 0, fish = 7;
  const draw = () => fx.draw({ uMode: mode, uS: s });
  function run(ts) {
    if (!t0) t0 = ts;
    const p = Math.min(1, (ts - t0) / 700); s = 1 - Math.pow(1 - p, 3); draw();
    raf = p < 1 ? requestAnimationFrame(run) : 0;
  }
  function set(n) {
    mode = n; cancelAnimationFrame(raf); raf = 0; t0 = 0;
    if (reduced) { s = 1; draw(); } else { s = 0; raf = requestAnimationFrame(run); }
  }
  box.classList.add('live');
  let started = false;
  watch(box, (v) => { if (v && !started) { started = true; set(mode); } });
  draw();
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    press(ui, b);
    const isFish = b.dataset.mode === 'fish'; sub.hidden = !isFish;
    label.innerHTML = ''; const st = document.createElement('b'); st.textContent = b.dataset.name; label.append(st, ' ' + b.dataset.desc);
    set(isFish ? fish : parseInt(b.dataset.mode, 10));
  });
  sub.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(sub, b); fish = parseInt(b.dataset.fish, 10); set(fish); });
  window.addEventListener('resize', () => { if (!raf) draw(); }, { passive: true });
});

/* ---------- Pro controls ---------- */
near($('#pro-card'), async () => {
  const card = $('#pro-card'), box = $('.fx', card), img = $('img', box), canvas = $('canvas', box), histo = $('.histo', card), level = $('.level', card);
  const tabs = $('.pro-tabs', card), read = $('#pro-read'), dial = $('#pro-dial'), reset = $('#pro-reset');
  const sig = (n) => { const d = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / d) * d; };
  const P = {
    iso: { name: 'ISO', auto: 151, val: (t) => sig(32 * Math.pow(2, t * 6.64)), fmt: (v) => String(v) },
    s: { name: 'S', auto: 551, val: (t) => sig(8000 * Math.pow(2, -t * 11)), fmt: (v) => '1/' + v },
    wb: { name: 'WB', auto: 415, val: (t) => Math.round((2500 + t * 6500) / 50) * 50, fmt: (v) => v + 'K' },
    tint: { name: 'TINT', auto: 540, val: (t) => Math.round(-50 + t * 100), fmt: (v) => (v > 0 ? '+' : '') + v },
    focus: { name: 'FOCUS', auto: 620, val: (t) => Math.round(t * 100), fmt: (v) => String(v) },
  };
  const state = {}; for (const k in P) state[k] = P[k].auto;
  let cur = 'iso', fx = null, pix = null;
  const value = (k) => P[k].val(state[k] / 1000);
  function grade() {
    const gain = Math.max(.04, Math.min(9, (value('iso') / 64) * (120 / value('s'))));
    const k = Math.max(-1, Math.min(1, (value('wb') - 5200) / 3800)), tn = value('tint') - 4;
    return { gain, wb: [1 + .3 * k, 1 - tn * .0045, 1 - .3 * k], blur: Math.abs(value('focus') - 62) / 62 * 5 };
  }
  function drawHisto(g) {
    if (!pix) return;
    const bins = new Float32Array(64);
    for (let i = 0; i < pix.length; i += 4) {
      let r = Math.pow(pix[i] / 255, 2.2) * g.gain * g.wb[0], gr = Math.pow(pix[i + 1] / 255, 2.2) * g.gain * g.wb[1], b = Math.pow(pix[i + 2] / 255, 2.2) * g.gain * g.wb[2];
      const l = Math.pow(Math.min(1, .299 * r + .587 * gr + .114 * b), 1 / 2.2);
      bins[Math.min(63, Math.floor(l * 64))]++;
    }
    let max = 0; for (let i = 1; i < 63; i++) max = Math.max(max, bins[i]); max = Math.max(max, bins[0] * .35, bins[63] * .35, 1);
    const c = histo.getContext('2d'), w = histo.width, h = histo.height, pad = 12;
    c.clearRect(0, 0, w, h); c.beginPath(); c.moveTo(pad, h - pad);
    for (let i = 0; i < 64; i++) c.lineTo(pad + (i / 63) * (w - pad * 2), h - pad - Math.min(1, bins[i] / max) * (h - pad * 2));
    c.lineTo(w - pad, h - pad); c.closePath(); c.fillStyle = 'rgba(255,255,255,.86)'; c.fill();
  }
  function paint() {
    const g = grade();
    if (fx) fx.draw({ uGain: g.gain, uWB: g.wb, uBlur: g.blur });
    drawHisto(g);
    for (const b of $$('button', tabs)) {
      const k = b.dataset.k, a = state[k] === P[k].auto, sp = b.lastElementChild; sp.textContent = '';
      if (a) { const i = document.createElement('i'); i.className = 'a'; i.textContent = 'A '; i.style.fontStyle = 'normal'; sp.append(i); }
      sp.append(P[k].fmt(value(k)));
    }
    const a = state[cur] === P[cur].auto;
    read.textContent = `${P[cur].name} ${a ? 'AUTO ' : ''}${P[cur].fmt(value(cur))}`;
    dial.setAttribute('aria-valuetext', P[cur].fmt(value(cur)));
  }
  await imageReady(img).catch(() => {});
  try { const c = document.createElement('canvas'); c.width = 60; c.height = 80; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 60, 80); pix = x.getImageData(0, 0, 60, 80).data; } catch (e) { pix = null; }
  if (webgl2()) {
    const m = await import('./fx.js'); fx = m.createFX(canvas, m.PRO, 1040);
    if (fx) { fx.setImage(img); box.classList.add('live'); }
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(tabs, b); cur = b.dataset.k; dial.value = state[cur]; dial.setAttribute('aria-label', b.dataset.label); paint(); });
  dial.addEventListener('input', () => { let v = +dial.value; if (Math.abs(v - P[cur].auto) < 14) v = P[cur].auto; state[cur] = v; paint(); });
  reset.addEventListener('click', () => { for (const k in P) state[k] = P[k].auto; dial.value = state[cur]; paint(); });
  dial.value = state[cur]; paint();
  window.addEventListener('resize', paint, { passive: true });
  if (finePointer && !reduced) {
    card.addEventListener('pointermove', (e) => { const r = card.getBoundingClientRect(); const d = ((e.clientX - r.left) / r.width - .5) * 7; level.style.transform = `rotate(${d.toFixed(2)}deg)`; level.classList.toggle('ok', Math.abs(d) < .5); });
    card.addEventListener('pointerleave', () => { level.style.transform = ''; level.classList.add('ok'); });
  }
});

/* ---------- pointer tilt for device frames ---------- */
if (finePointer && !reduced) {
  $$('[data-tilt]').forEach((host) => {
    const el = $('.tilt', host); if (!el) return;
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(1100px) rotateY(${(x * 12).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`;
    });
    host.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}
