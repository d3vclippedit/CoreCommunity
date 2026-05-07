import { useEffect, useRef } from "react";

// Finer step captures Pacifico's thin script strokes
const SAMPLE_STEP = 4;
const MAX_NODES = 420;
const CONNECT_DIST = 20;
const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
const GRAVITY_DIST = 145;
const GRAVITY_DIST_SQ = GRAVITY_DIST * GRAVITY_DIST;
const GRAVITY_FORCE = 0.11;
const HOME_FORCE = 0.016;
const MAX_SPEED = 5;
const DAMPING = 0.87;

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
}

function buildParticles(w: number, h: number): Particle[] {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const oc = off.getContext("2d");
  if (!oc) return [];

  oc.fillStyle = "#000";
  oc.fillRect(0, 0, w, h);
  oc.fillStyle = "#fff";
  oc.textAlign = "center";
  oc.textBaseline = "middle";

  // Adaptively size each word to fill a target fraction of canvas width.
  // measureText handles Pacifico's irregular script character widths correctly.
  let coreFs = 40;
  oc.font = `${coreFs}px "Pacifico",cursive`;
  while (oc.measureText("Core").width < w * 0.54 && coreFs < 300) coreFs += 3;

  let commFs = 30;
  oc.font = `${commFs}px "Pacifico",cursive`;
  while (oc.measureText("Communities").width < w * 0.86 && commFs < 200) commFs += 3;

  // Vertical centering — script fonts need more gap for ascenders/descenders
  const textGap = Math.round(coreFs * 0.35);
  const totalH = coreFs + textGap + commFs;
  const groupTop = (h - totalH) / 2;
  const coreCenterY = Math.round(groupTop + coreFs / 2);
  const commCenterY = Math.round(groupTop + coreFs + textGap + commFs / 2);

  oc.font = `${coreFs}px "Pacifico",cursive`;
  oc.fillText("Core", w / 2, coreCenterY);

  oc.font = `${commFs}px "Pacifico",cursive`;
  oc.fillText("Communities", w / 2, commCenterY);

  const { data } = oc.getImageData(0, 0, w, h);
  const raw: { bx: number; by: number }[] = [];

  for (let y = 0; y < h; y += SAMPLE_STEP) {
    for (let x = 0; x < w; x += SAMPLE_STEP) {
      if (data[(y * w + x) * 4] > 100) {
        raw.push({ bx: x, by: y });
      }
    }
  }

  const step = raw.length > MAX_NODES ? Math.ceil(raw.length / MAX_NODES) : 1;

  return raw
    .filter((_, i) => i % step === 0)
    .map(({ bx, by }) => ({
      x: bx + (Math.random() - 0.5) * 2,
      y: by + (Math.random() - 0.5) * 2,
      baseX: bx,
      baseY: by,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1.2 + Math.random() * 1.1,
      opacity: 0.55 + Math.random() * 0.45,
    }));
}

export function CoreLogo({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const el: HTMLCanvasElement = canvas;
    const g: CanvasRenderingContext2D = ctx;

    let particles: Particle[] = [];
    const mouse = { x: 0, y: 0, inside: false };
    let raf = 0;
    let cancelled = false;

    function setSize(): boolean {
      const dpr = window.devicePixelRatio || 1;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return false;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    function draw() {
      if (cancelled) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      g.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.vx += (p.baseX - p.x) * HOME_FORCE;
        p.vy += (p.baseY - p.y) * HOME_FORCE;

        p.vx += (Math.random() - 0.5) * 0.04;
        p.vy += (Math.random() - 0.5) * 0.04;

        if (mouse.inside) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < GRAVITY_DIST_SQ && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / GRAVITY_DIST) * (1 - d / GRAVITY_DIST) * GRAVITY_FORCE;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;

        const spd = p.vx * p.vx + p.vy * p.vy;
        if (spd > MAX_SPEED * MAX_SPEED) {
          const s = Math.sqrt(spd);
          p.vx = (p.vx / s) * MAX_SPEED;
          p.vy = (p.vy / s) * MAX_SPEED;
        }

        p.x += p.vx;
        p.y += p.vy;
      }

      g.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x;
          const dy = particles[j].y - particles[i].y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= CONNECT_DIST_SQ) continue;

          const d = Math.sqrt(d2);
          let alpha = (1 - d / CONNECT_DIST) * 0.5;

          if (mouse.inside) {
            const di2 =
              (mouse.x - particles[i].x) * (mouse.x - particles[i].x) +
              (mouse.y - particles[i].y) * (mouse.y - particles[i].y);
            const dj2 =
              (mouse.x - particles[j].x) * (mouse.x - particles[j].x) +
              (mouse.y - particles[j].y) * (mouse.y - particles[j].y);
            const near2 = Math.min(di2, dj2);
            if (near2 < GRAVITY_DIST_SQ) {
              alpha += (1 - Math.sqrt(near2) / GRAVITY_DIST) * 0.38;
            }
          }

          g.beginPath();
          g.moveTo(particles[i].x, particles[i].y);
          g.lineTo(particles[j].x, particles[j].y);
          g.strokeStyle = `rgba(245,245,247,${Math.min(0.8, alpha)})`;
          g.stroke();
        }
      }

      if (mouse.inside) {
        const gr = g.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          GRAVITY_DIST * 0.75,
        );
        gr.addColorStop(0, "rgba(245,245,247,0.07)");
        gr.addColorStop(0.5, "rgba(245,245,247,0.02)");
        gr.addColorStop(1, "rgba(245,245,247,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(mouse.x, mouse.y, GRAVITY_DIST * 0.75, 0, Math.PI * 2);
        g.fill();
      }

      for (const p of particles) {
        let alpha = p.opacity;
        let r = p.r;

        if (mouse.inside) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < GRAVITY_DIST_SQ) {
            const boost = (1 - Math.sqrt(d2) / GRAVITY_DIST) * 0.38;
            alpha = Math.min(1, alpha + boost);
            r = p.r * (1 + (1 - Math.sqrt(d2) / GRAVITY_DIST) * 0.4);
          }
        }

        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fillStyle = `rgba(245,245,247,${alpha})`;
        g.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    let started = false;

    function init() {
      if (cancelled) return;
      if (!setSize()) return;
      particles = buildParticles(el.offsetWidth, el.offsetHeight);
      if (!started) {
        started = true;
        raf = requestAnimationFrame(draw);
      }
    }

    // Explicitly wait for Pacifico — document.fonts.ready doesn't guarantee
    // late-loaded script fonts are measured correctly in the offscreen canvas.
    document.fonts.load('48px "Pacifico"').then(init);

    const ro = new ResizeObserver(() => {
      if (!started) return;
      if (setSize()) {
        particles = buildParticles(el.offsetWidth, el.offsetHeight);
      }
    });
    ro.observe(el);

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.inside = true;
    };
    const onMouseLeave = () => {
      mouse.inside = false;
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        maskImage: "radial-gradient(ellipse 95% 90% at 50% 50%, black 60%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 95% 90% at 50% 50%, black 60%, transparent 100%)",
        ...style,
      }}
    />
  );
}

/**
 * Shows the raw Pacifico text + red sample-dot overlay so font sizing
 * and particle density can be verified before the animation goes live.
 * Usage: swap CoreLogo for CoreLogoDebug in _index.tsx temporarily.
 */
export function CoreLogoDebug({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const el: HTMLCanvasElement = canvas;

    function render() {
      const dpr = window.devicePixelRatio || 1;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = "#0A0A0C";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#F5F5F7";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let coreFs = 40;
      ctx.font = `${coreFs}px "Pacifico",cursive`;
      while (ctx.measureText("Core").width < w * 0.54 && coreFs < 300) coreFs += 3;

      let commFs = 30;
      ctx.font = `${commFs}px "Pacifico",cursive`;
      while (ctx.measureText("Communities").width < w * 0.86 && commFs < 200) commFs += 3;

      const textGap = Math.round(coreFs * 0.35);
      const totalH = coreFs + textGap + commFs;
      const groupTop = (h - totalH) / 2;
      const coreCenterY = Math.round(groupTop + coreFs / 2);
      const commCenterY = Math.round(groupTop + coreFs + textGap + commFs / 2);

      ctx.font = `${coreFs}px "Pacifico",cursive`;
      ctx.fillText("Core", w / 2, coreCenterY);
      ctx.font = `${commFs}px "Pacifico",cursive`;
      ctx.fillText("Communities", w / 2, commCenterY);

      // Red dots showing the exact pixel positions the particle sampler will use
      ctx.fillStyle = "rgba(239,68,68,0.85)";
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      for (let y = 0; y < h; y += SAMPLE_STEP) {
        for (let x = 0; x < w; x += SAMPLE_STEP) {
          const px = Math.round(x * dpr);
          const py = Math.round(y * dpr);
          if (data[(py * el.width + px) * 4] > 100) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.font = `500 11px "Inter",system-ui,sans-serif`;
      ctx.fillStyle = "rgba(245,245,247,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(
        `Core: ${coreFs}px  |  Communities: ${commFs}px  |  step: ${SAMPLE_STEP}  |  max: ${MAX_NODES}`,
        12,
        h - 12,
      );
    }

    document.fonts.load('48px "Pacifico"').then(render);
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ display: "block", ...style }} />;
}
