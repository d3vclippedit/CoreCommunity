import { useEffect, useRef } from "react";

const NODE_COUNT = 44;
const HUB_COUNT = 6;
const CONNECT_DIST = 135;
const GRAVITY_DIST = 195;
const GRAVITY_FORCE = 0.09;
const MAX_SPEED = 1.1;
const DAMPING = 0.965;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseOpacity: number;
  phase: number;
  isHub: boolean;
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

    // Explicit non-null aliases — TypeScript doesn't carry narrowing into closures
    const el: HTMLCanvasElement = canvas;
    const g: CanvasRenderingContext2D = ctx;

    let particles: Particle[] = [];
    const mouse = { x: 0, y: 0, inside: false };
    let raf = 0;
    let started = false;

    function initParticles(w: number, h: number) {
      particles = [];
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < NODE_COUNT; i++) {
        const isHub = i < HUB_COUNT;
        particles.push({
          x: isHub ? cx + (Math.random() - 0.5) * w * 0.44 : w * 0.06 + Math.random() * w * 0.88,
          y: isHub ? cy + (Math.random() - 0.5) * h * 0.44 : h * 0.06 + Math.random() * h * 0.88,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          r: isHub ? 2.6 + Math.random() * 1.4 : 0.8 + Math.random() * 1.8,
          baseOpacity: isHub ? 0.72 + Math.random() * 0.28 : 0.16 + Math.random() * 0.38,
          phase: Math.random() * Math.PI * 2,
          isHub,
        });
      }
    }

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
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const t = performance.now() / 1000;
      g.clearRect(0, 0, w, h);

      for (const p of particles) {
        if (mouse.inside) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > 1 && d < GRAVITY_DIST) {
            const f = (1 - d / GRAVITY_DIST) ** 2 * GRAVITY_FORCE;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }
        p.x += p.vx;
        p.y += p.vy;

        const pad = 28;
        if (p.x < pad) p.vx += 0.05;
        else if (p.x > w - pad) p.vx -= 0.05;
        if (p.y < pad) p.vy += 0.05;
        else if (p.y > h - pad) p.vy -= 0.05;
      }

      // Connections
      g.lineWidth = 0.45;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(particles[j].x - particles[i].x, particles[j].y - particles[i].y);
          if (d >= CONNECT_DIST) continue;

          let alpha = (1 - d / CONNECT_DIST) * 0.25;
          if (mouse.inside) {
            const di = Math.hypot(mouse.x - particles[i].x, mouse.y - particles[i].y);
            const dj = Math.hypot(mouse.x - particles[j].x, mouse.y - particles[j].y);
            const nearest = Math.min(di, dj);
            if (nearest < GRAVITY_DIST) {
              alpha += (1 - nearest / GRAVITY_DIST) * 0.42;
            }
          }

          g.beginPath();
          g.moveTo(particles[i].x, particles[i].y);
          g.lineTo(particles[j].x, particles[j].y);
          g.strokeStyle = `rgba(245,245,247,${Math.min(0.65, alpha)})`;
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
          GRAVITY_DIST * 0.85,
        );
        gr.addColorStop(0, "rgba(245,245,247,0.055)");
        gr.addColorStop(0.45, "rgba(245,245,247,0.018)");
        gr.addColorStop(1, "rgba(245,245,247,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(mouse.x, mouse.y, GRAVITY_DIST * 0.85, 0, Math.PI * 2);
        g.fill();
      }

      // Nodes
      for (const p of particles) {
        let alpha = p.baseOpacity;
        let r = p.r;

        if (p.isHub) {
          alpha *= 0.76 + 0.24 * Math.sin(t * 1.05 + p.phase);
        }

        if (mouse.inside) {
          const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (d < GRAVITY_DIST) {
            const boost = (1 - d / GRAVITY_DIST) * 0.44;
            alpha = Math.min(1, alpha + boost);
            r = p.r * (1 + (1 - d / GRAVITY_DIST) * 0.55);
          }
        }

        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fillStyle = `rgba(245,245,247,${alpha})`;
        g.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => {
      const ok = setSize();
      if (ok && !started) {
        started = true;
        initParticles(el.offsetWidth, el.offsetHeight);
        raf = requestAnimationFrame(draw);
      }
    });

    ro.observe(el);

    if (el.offsetWidth > 0 && el.offsetHeight > 0 && !started) {
      if (setSize()) {
        started = true;
        initParticles(el.offsetWidth, el.offsetHeight);
        raf = requestAnimationFrame(draw);
      }
    }

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
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ display: "block", ...style }} />;
}
