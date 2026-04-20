/* ============================================================
   KIC — 5-STAGE INTRO REVEAL
   Apple-style scroll-driven morphing / rotation.
   Each stage has an explicit global timeline [enterStart,
   enterEnd, exitStart, exitEnd] on the 0..1 intro progress.
   Stage 1 is pre-entered (visible on load).
   Stage 4 never fully exits (hands off to main landing).
   ============================================================ */

(function () {
  const root = document.getElementById('introReveal');
  if (!root) return;

  const stages = Array.from(root.querySelectorAll('.stage'));
  const dots   = Array.from(root.querySelectorAll('.si-dot'));
  const geoEls = Array.from(root.querySelectorAll('.geo'));

  // Global progress ranges for each stage: [enterStart, enterEnd, exitStart, exitEnd]
  const timelines = [
    [-0.20, 0.00, 0.28, 0.40],   // Stage 2 — Kick / Inspire / Conquer (now first)
    [ 0.36, 0.50, 0.60, 0.72],   // Stage 3 — Dream Begins, Dream Ends
    [ 0.68, 0.84, 1.20, 1.40],   // Stage 4 — CTA: holds until end
  ];

  // Per-stage choreography.
  const choreo = [
    { // Stage 2 — rise from below, exit upward (no rotate / scale / blur)
      enter: { rot:   0, scale: 1.00, x: 0,    y: 120, blur:  0 },
      exit:  { rot:   0, scale: 1.00, x: 0,    y:-120, blur:  0 },
    },
    { // Stage 3 — rise from below, exit upward (no rotate / scale / blur)
      enter: { rot:   0, scale: 1.00, x: 0,    y: 120, blur:  0 },
      exit:  { rot:   0, scale: 1.00, x: 0,    y:-120, blur:  0 },
    },
    { // Stage 4 — rise from below (no exit)
      enter: { rot:   0, scale: 1.00, x: 0,    y: 120, blur:  0 },
      exit:  { rot:   0, scale: 1.00, x: 0,    y: -40, blur:  0 },
    },
  ];

  // smoothstep — Apple-ish ease
  const ease = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };

  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function renderStage(stage, i, p) {
    const [es, ee, xs, xe] = timelines[i];
    const cfg = choreo[i];

    let opacity, rot, scale, x, y, blur;

    if (p < es) {
      opacity = 0;
      ({ rot, scale, x, y, blur } = cfg.enter);
    } else if (p < ee) {
      const t = ease((p - es) / (ee - es));
      opacity = t;
      rot   = lerp(cfg.enter.rot,   0, t);
      scale = lerp(cfg.enter.scale, 1, t);
      x     = lerp(cfg.enter.x,     0, t);
      y     = lerp(cfg.enter.y,     0, t);
      blur  = lerp(cfg.enter.blur,  0, t);
    } else if (p < xs) {
      opacity = 1; rot = 0; scale = 1; x = 0; y = 0; blur = 0;
    } else if (p < xe) {
      const t = ease((p - xs) / (xe - xs));
      opacity = 1 - t;
      rot   = lerp(0, cfg.exit.rot,   t);
      scale = lerp(1, cfg.exit.scale, t);
      x     = lerp(0, cfg.exit.x,     t);
      y     = lerp(0, cfg.exit.y,     t);
      blur  = lerp(0, cfg.exit.blur,  t);
    } else {
      opacity = 0;
      ({ rot, scale, x, y, blur } = cfg.exit);
    }

    stage.style.opacity = opacity.toFixed(3);
    stage.style.transform =
      `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ` +
      `rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    stage.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none';

    const visible = opacity > 0.5;
    stage.classList.toggle('is-active', visible);
    return visible;
  }

  function render() {
    const rect  = root.getBoundingClientRect();
    const vh    = window.innerHeight;
    const total = root.offsetHeight - vh;
    const s     = clamp(-rect.top, 0, Math.max(total, 1));
    const p     = total > 0 ? s / total : 0;

    let activeIdx = 0;
    stages.forEach((stage, i) => {
      if (renderStage(stage, i, p)) activeIdx = i;
    });

    // ---- Inner choreography (per-stage micro-motion) ----

    // Stage 2 — stagger the three words (now index 0)
    {
      const [es, ee] = timelines[0];
      const local = clamp((p - es) / (ee - es), 0, 1);
      const words = stages[0].querySelectorAll('.word');
      words.forEach((w, idx) => {
        const t = ease(clamp((local - idx * 0.14) / 0.5, 0, 1));
        w.style.transform =
          // `translateX(${lerp(-90, 0, t).toFixed(1)}px) ` +
          `rotate(${lerp(-8, 0, t).toFixed(2)}deg)`;
        w.style.opacity = t.toFixed(3);
      });
    }

    // Stage 3 — rise from below, staggered (now index 1)
    {
      const [es, ee] = timelines[1];
      const local = clamp((p - es) / (ee - es), 0, 1);
      const lines = stages[1].querySelectorAll('.line');
      if (lines[0]) {
        const t = ease(local);
        lines[0].style.transform = `translateY(${lerp(60, 0, t).toFixed(1)}px)`;
        lines[0].style.opacity   = t.toFixed(3);
      }
      if (lines[1]) {
        const t = ease(clamp((local - 0.22) / 0.78, 0, 1));
        lines[1].style.transform = `translateY(${lerp(60, 0, t).toFixed(1)}px)`;
        lines[1].style.opacity   = t.toFixed(3);
      }
    }

    // Stage 4 — prelude fades in before CTA, hint fades in last. (now index 2)
    // NOTE: the Apply button (<button>) is intentionally left untouched
    // so its :hover CSS transform keeps working. The stage-level
    // transform already carries the button into view.
    {
      const [es, ee] = timelines[2];
      const local = clamp((p - es) / (ee - es), 0, 1);
      const prelude = stages[2].querySelector('.stage-prelude');
      const hint    = stages[2].querySelector('.scroll-to-main');
      if (prelude) {
        const t = ease(clamp(local / 0.35, 0, 1));
        prelude.style.opacity   = t.toFixed(3);
        prelude.style.transform = `translateY(${lerp(24, 0, t).toFixed(1)}px)`;
      }
      if (hint) {
        const t = ease(clamp((local - 0.55) / 0.45, 0, 1));
        hint.style.opacity   = t.toFixed(3);
        hint.style.transform = `translate(-50%, ${lerp(20, 0, t).toFixed(1)}px)`;
      }
    }

    // Dots indicator
    dots.forEach((d, i) => d.classList.toggle('is-on', i === activeIdx));

    // Geo ambient — subtle parallax + atmospheric opacity breath
    geoEls.forEach((el, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      const amt  = 30 + i * 10;
      el.style.translate = `0 ${(p * amt * sign).toFixed(1)}px`;
    });
  }

  // rAF-throttled
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        render();
        ticking = false;
      });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('load', render);
  render();
})();
