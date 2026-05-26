(() => {
  'use strict';

  if (window.__proofcoreFoReactivated) return;
  window.__proofcoreFoReactivated = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(() => {
    reactivateFoCanvas();
    reactivateVariableProximity();
  });

  function reactivateFoCanvas() {
    const canvas = [...document.querySelectorAll('canvas')]
      .find(c => c.closest('main') && c.className.includes('absolute')) ||
      document.querySelector('main canvas') ||
      document.querySelector('canvas');

    if (!canvas) return;

    // SingleFile يحفظ لقطة canvas كصورة داخل background-image. نحذفها ونرسم fo الحقيقي فوق نفس المكان.
    canvas.style.setProperty('background-image', 'none', 'important');
    canvas.style.setProperty('background-color', 'transparent', 'important');
    canvas.style.setProperty('pointer-events', 'none', 'important');

    const root = canvas.parentElement || canvas.closest('section') || document.body;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const opts = {
      dotSize: 2,
      gap: 43,
      baseColor: '#ffffff34',
      activeColor: '#ffffff',
      proximity: 340,
      speedTrigger: 100,
      shockRadius: 340,
      shockStrength: 5,
      maxSpeed: 5000,
      resistance: 600,
      returnDuration: 5
    };

    const mouse = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, lastTime: 0, lastX: 0, lastY: 0 };
    const dots = [];
    let dpr = 1;
    let raf = 0;

    const throttle = (fn, wait) => {
      let last = 0;
      return (...args) => {
        const now = performance.now();
        if (now - last >= wait) {
          last = now;
          fn(...args);
        }
      };
    };

    // مطابق لطريقة fo الأصلية: لا يفهم hex-alpha في المزج؛ لذلك #ffffff34 تتحول إلى أسود في منطقة القرب ثم تفتح للأبيض.
    const hexToRgb = value => {
      const m = String(value).match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
    };

    const baseRgb = () => hexToRgb(opts.baseColor);
    const activeRgb = () => hexToRgb(opts.activeColor);

    function canvasRect() {
      const r = root.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
      return canvas.getBoundingClientRect();
    }

    function resize() {
      const r = canvasRect();
      const width = Math.max(1, r.width || window.innerWidth);
      const height = Math.max(1, r.height || window.innerHeight);
      dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const step = opts.dotSize + opts.gap;
      const cols = Math.floor((width + opts.gap) / step);
      const rows = Math.floor((height + opts.gap) / step);
      const gridW = step * cols - opts.gap;
      const gridH = step * rows - opts.gap;
      const startX = (width - gridW) / 2 + opts.dotSize / 2;
      const startY = (height - gridH) / 2 + opts.dotSize / 2;

      dots.length = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          dots.push({
            cx: startX + x * step,
            cy: startY + y * step,
            xOffset: 0,
            yOffset: 0,
            vx: 0,
            vy: 0,
            active: false
          });
        }
      }
    }

    function draw() {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.clearRect(0, 0, width, height);

      const near2 = opts.proximity * opts.proximity;
      const base = baseRgb();
      const active = activeRgb();

      for (const dot of dots) {
        dot.vx += -dot.xOffset / opts.resistance;
        dot.vy += -dot.yOffset / opts.resistance;
        dot.vx *= 0.92;
        dot.vy *= 0.92;
        dot.xOffset += dot.vx;
        dot.yOffset += dot.vy;

        if (Math.abs(dot.xOffset) < 0.01 && Math.abs(dot.yOffset) < 0.01) {
          dot.xOffset = 0;
          dot.yOffset = 0;
          dot.active = false;
        }

        let color = opts.baseColor;
        const dx = dot.cx - mouse.x;
        const dy = dot.cy - mouse.y;
        const dist2 = dx * dx + dy * dy;

        if (dist2 <= near2) {
          const power = 1 - Math.sqrt(dist2) / opts.proximity;
          color = `rgb(${Math.round(base.r + (active.r - base.r) * power)},${Math.round(base.g + (active.g - base.g) * power)},${Math.round(base.b + (active.b - base.b) * power)})`;
        }

        ctx.save();
        ctx.translate(dot.cx + dot.xOffset, dot.cy + dot.yOffset);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, opts.dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    function impulse(dot, x, y, power = 1) {
      dot.active = true;
      dot.vx += x * 0.075 * power;
      dot.vy += y * 0.075 * power;
    }

    const onMouseMove = throttle(e => {
      const now = performance.now();
      const dt = mouse.lastTime ? now - mouse.lastTime : 16;
      let vx = ((e.clientX - mouse.lastX) / dt) * 1000;
      let vy = ((e.clientY - mouse.lastY) / dt) * 1000;
      let speed = Math.hypot(vx, vy);

      if (speed > opts.maxSpeed) {
        const k = opts.maxSpeed / speed;
        vx *= k;
        vy *= k;
        speed = opts.maxSpeed;
      }

      mouse.lastTime = now;
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
      mouse.vx = vx;
      mouse.vy = vy;
      mouse.speed = speed;

      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;

      if (speed <= opts.speedTrigger) return;

      for (const dot of dots) {
        const dist = Math.hypot(dot.cx - mouse.x, dot.cy - mouse.y);
        if (dist < opts.proximity && !dot.active) {
          const tx = dot.cx - mouse.x + vx * 0.005;
          const ty = dot.cy - mouse.y + vy * 0.005;
          impulse(dot, tx, ty, 1);
        }
      }
    }, 50);

    function onClick(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const dot of dots) {
        const dist = Math.hypot(dot.cx - x, dot.cy - y);
        if (dist < opts.shockRadius && !dot.active) {
          const power = Math.max(0, 1 - dist / opts.shockRadius);
          impulse(dot, (dot.cx - x) * opts.shockStrength * power, (dot.cy - y) * opts.shockStrength * power, 1);
        }
      }
    }

    resize();
    cancelAnimationFrame(raf);
    draw();

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(root);
    else window.addEventListener('resize', resize);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('click', onClick);
  }

  function parseFontVariation(value) {
    return new Map(String(value).split(',').map(v => v.trim()).filter(Boolean).map(v => {
      const [axis, num] = v.split(/\s+/);
      return [axis.replace(/['"]/g, ''), parseFloat(num)];
    }));
  }

  function reactivateVariableProximity() {
    const containers = [...document.querySelectorAll('.variable-proximity')];
    if (!containers.length) return;

    const from = parseFontVariation("'wght' 300");
    const to = parseFontVariation("'wght' 900");
    const axes = [...from.entries()].map(([axis, fromValue]) => ({ axis, fromValue, toValue: to.get(axis) ?? fromValue }));
    const radius = 300;
    let mx = -9999;
    let my = -9999;
    let lastX = null;
    let lastY = null;

    const setPointer = (x, y) => { mx = x; my = y; };
    window.addEventListener('mousemove', e => setPointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => {
      const t = e.touches && e.touches[0];
      if (t) setPointer(t.clientX, t.clientY);
    }, { passive: true });

    function frame() {
      if (mx !== lastX || my !== lastY) {
        lastX = mx;
        lastY = my;

        for (const container of containers) {
          const box = container.getBoundingClientRect();
          const localX = mx - box.left;
          const localY = my - box.top;
          const letters = [...container.querySelectorAll('span[aria-hidden="true"]')]
            .filter(el => el.textContent && el.textContent.trim().length);

          for (const el of letters) {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2 - box.left;
            const cy = r.top + r.height / 2 - box.top;
            const dist = Math.hypot(localX - cx, localY - cy);

            if (dist >= radius) {
              el.style.fontVariationSettings = "'wght' 300";
              continue;
            }

            const t = Math.min(Math.max(1 - dist / radius, 0), 1);
            const exponential = t * t;
            el.style.fontVariationSettings = axes.map(a => `'${a.axis}' ${a.fromValue + (a.toValue - a.fromValue) * exponential}`).join(', ');
          }
        }
      }
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
})();
