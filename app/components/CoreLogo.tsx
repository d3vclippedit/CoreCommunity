import { useEffect, useRef } from "react";

const SAMPLE_STEP = 7;
const MAX_NODES = 210;
const CONNECT_DIST = 24;
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

  // CORE — large, upper section
  const coreFs = Math.round(Math.min(w * 0.3, h * 0.23));
  oc.font = `900 ${coreFs}px "Inter",system-ui,sans-serif`;
  oc.fillText("CORE", w / 2, h * 0.36);

  // COMMUNITIES — smaller, lower section
  const commFs = Math.round(coreFs * 0.4);
  oc.font = `800 ${commFs}px "Inter",system-ui,sans-serif`;
  oc.fillText("COMMUNITIES", w / 2, h * 0.65);

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
        // Home spring — keeps letters legible
        p.vx += (p.baseX - p.x) * HOME_FORCE;
        p.vy += (p.baseY - p.y) * HOME_FORCE;

        // Ambient micro-drift for life
        p.vx += (Math.random() - 0.5) * 0.04;
        p.vy += (Math.random() - 0.5) * 0.04;

        // Cursor gravity
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

      // Connections — trace letter structure
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

      // Cursor glow
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

      // Nodes
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

    // Wait for fonts so the offscreen text sampling uses the correct metrics
    document.fonts.ready.then(init);

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
        // Fade edges so the canvas boundary is invisible
        maskImage: "radial-gradient(ellipse 95% 90% at 50% 50%, black 60%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 95% 90% at 50% 50%, black 60%, transparent 100%)",
        ...style,
      }}
    />
  );
}
