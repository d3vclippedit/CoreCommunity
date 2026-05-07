import { useEffect, useRef } from "react";

const FIGURE_SIZE = 18;
const SAMPLE_STEP = 22;
const MAX_FIGURES = 85;
const CONNECT_DIST = 52;
const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
const BOB_AMP = 2.8;
const BOB_FREQ = 0.0011;
const GRAVITY_DIST = 110;
const GRAVITY_DIST_SQ = GRAVITY_DIST * GRAVITY_DIST;
const GRAVITY_FORCE = 0.055;
const HOME_FORCE = 0.02;
const MAX_SPEED = 4;
const DAMPING = 0.86;

interface Figure {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  phase: number;
  opacity: number;
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
) {
  const headR = size * 0.27;
  const bodyW = size * 0.27;
  const bodyH = size * 0.42;
  const headCy = y - bodyH * 0.5 - headR * 0.7;
  const bodyCy = y + bodyH * 0.08;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#F5F5F7";

  // Head
  ctx.beginPath();
  ctx.arc(x, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(x, bodyCy, bodyW, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function sampleImage(img: HTMLImageElement, canvasW: number, canvasH: number): Figure[] {
  const off = document.createElement("canvas");
  off.width = canvasW;
  off.height = canvasH;
  const oc = off.getContext("2d");
  if (!oc) return [];

  oc.drawImage(img, 0, 0, canvasW, canvasH);
  const { data } = oc.getImageData(0, 0, canvasW, canvasH);

  // Detect whether the PNG has a dark background (use brightness) or transparent (use alpha)
  const cornerAlphas = [
    data[3],
    data[(canvasW - 1) * 4 + 3],
    data[(canvasH - 1) * canvasW * 4 + 3],
    data[((canvasH - 1) * canvasW + canvasW - 1) * 4 + 3],
  ];
  const avgCornerAlpha = cornerAlphas.reduce((a, b) => a + b, 0) / 4;
  const hasTransparentBg = avgCornerAlpha < 128;

  const raw: { bx: number; by: number }[] = [];

  for (let y = 0; y < canvasH; y += SAMPLE_STEP) {
    for (let x = 0; x < canvasW; x += SAMPLE_STEP) {
      const i = (y * canvasW + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const brightness = (r + g + b) / 3;

      const hit = hasTransparentBg ? a > 60 && brightness > 80 : brightness > 155;

      if (hit) raw.push({ bx: x, by: y });
    }
  }

  // If first pass found too little, retry assuming dark-outline-on-light background
  let source = raw;
  if (raw.length < 20) {
    const alt: { bx: number; by: number }[] = [];
    for (let y = 0; y < canvasH; y += SAMPLE_STEP) {
      for (let x = 0; x < canvasW; x += SAMPLE_STEP) {
        const i = (y * canvasW + x) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (data[i + 3] > 180 && brightness < 210) alt.push({ bx: x, by: y });
      }
    }
    if (alt.length > raw.length) source = alt;
  }

  const step = source.length > MAX_FIGURES ? Math.ceil(source.length / MAX_FIGURES) : 1;

  return source
    .filter((_, i) => i % step === 0)
    .slice(0, MAX_FIGURES)
    .map(({ bx, by }) => ({
      x: bx + (Math.random() - 0.5) * 3,
      y: by + (Math.random() - 0.5) * 3,
      baseX: bx,
      baseY: by,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.7 + Math.random() * 0.3,
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

    let figures: Figure[] = [];
    const mouse = { x: -9999, y: -9999, inside: false };
    let raf = 0;
    let cancelled = false;
    let startTime = 0;

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

    function draw(ts: number) {
      if (cancelled) return;
      if (!startTime) startTime = ts;
      const t = ts - startTime;

      const w = el.offsetWidth;
      const h = el.offsetHeight;
      g.clearRect(0, 0, w, h);

      // Ambient glow — pulses slowly behind the logo
      const glowAlpha = 0.06 + 0.03 * Math.sin(t * 0.0008);
      // Find centroid of figures to anchor the glow
      if (figures.length > 0) {
        let cx = 0;
        let cy = 0;
        for (const f of figures) {
          cx += f.baseX;
          cy += f.baseY;
        }
        cx /= figures.length;
        cy /= figures.length;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
        gr.addColorStop(0, `rgba(245,245,247,${glowAlpha * 2})`);
        gr.addColorStop(0.4, `rgba(245,245,247,${glowAlpha})`);
        gr.addColorStop(1, "rgba(245,245,247,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }

      // Update figure physics
      for (const f of figures) {
        // Gentle bob
        const bob = BOB_AMP * Math.sin(t * BOB_FREQ + f.phase);

        // Home spring
        f.vx += (f.baseX - f.x) * HOME_FORCE;
        f.vy += (f.baseY - f.y + bob) * HOME_FORCE;

        // Micro drift
        f.vx += (Math.random() - 0.5) * 0.03;
        f.vy += (Math.random() - 0.5) * 0.03;

        // Cursor gravity
        if (mouse.inside) {
          const dx = mouse.x - f.x;
          const dy = mouse.y - f.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < GRAVITY_DIST_SQ && d2 > 1) {
            const d = Math.sqrt(d2);
            const force = (1 - d / GRAVITY_DIST) * (1 - d / GRAVITY_DIST) * GRAVITY_FORCE;
            f.vx += (dx / d) * force;
            f.vy += (dy / d) * force;
          }
        }

        f.vx *= DAMPING;
        f.vy *= DAMPING;

        const spd = f.vx * f.vx + f.vy * f.vy;
        if (spd > MAX_SPEED * MAX_SPEED) {
          const s = Math.sqrt(spd);
          f.vx = (f.vx / s) * MAX_SPEED;
          f.vy = (f.vy / s) * MAX_SPEED;
        }

        f.x += f.vx;
        f.y += f.vy;
      }

      // Connection lines
      g.lineWidth = 0.6;
      for (let i = 0; i < figures.length; i++) {
        for (let j = i + 1; j < figures.length; j++) {
          const dx = figures[j].x - figures[i].x;
          const dy = figures[j].y - figures[i].y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= CONNECT_DIST_SQ) continue;

          const d = Math.sqrt(d2);
          let alpha = (1 - d / CONNECT_DIST) * 0.4;

          // Boost lines near cursor
          if (mouse.inside) {
            const midX = (figures[i].x + figures[j].x) / 2;
            const midY = (figures[i].y + figures[j].y) / 2;
            const md2 = (mouse.x - midX) ** 2 + (mouse.y - midY) ** 2;
            if (md2 < GRAVITY_DIST_SQ) {
              alpha += (1 - Math.sqrt(md2) / GRAVITY_DIST) * 0.3;
            }
          }

          g.beginPath();
          g.moveTo(figures[i].x, figures[i].y);
          g.lineTo(figures[j].x, figures[j].y);
          g.strokeStyle = `rgba(245,245,247,${Math.min(0.7, alpha)})`;
          g.stroke();
        }
      }

      // Draw figure icons
      for (const f of figures) {
        let alpha = f.opacity;
        let size = FIGURE_SIZE;

        if (mouse.inside) {
          const dx = mouse.x - f.x;
          const dy = mouse.y - f.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < GRAVITY_DIST_SQ) {
            const boost = (1 - Math.sqrt(d2) / GRAVITY_DIST) * 0.35;
            alpha = Math.min(1, alpha + boost);
            size = FIGURE_SIZE * (1 + (1 - Math.sqrt(d2) / GRAVITY_DIST) * 0.25);
          }
        }

        drawPerson(g, f.x, f.y, size, alpha);
      }

      // Cursor glow
      if (mouse.inside) {
        const gr = g.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          GRAVITY_DIST * 0.7,
        );
        gr.addColorStop(0, "rgba(245,245,247,0.08)");
        gr.addColorStop(0.5, "rgba(245,245,247,0.03)");
        gr.addColorStop(1, "rgba(245,245,247,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(mouse.x, mouse.y, GRAVITY_DIST * 0.7, 0, Math.PI * 2);
        g.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    function init() {
      if (cancelled) return;
      if (!setSize()) return;

      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        figures = sampleImage(img, el.offsetWidth, el.offsetHeight);
        raf = requestAnimationFrame(draw);
      };
      img.onerror = () => {
        // Fallback: start with empty canvas — no crash
        raf = requestAnimationFrame(draw);
      };
      img.src = "/Corelogo.png";
    }

    // Small delay to let layout settle before reading offsetWidth/Height
    const t = setTimeout(init, 80);

    const ro = new ResizeObserver(() => {
      if (!setSize()) return;
      // Re-sample at new canvas dimensions
      const img = new Image();
      img.onload = () => {
        if (!cancelled) figures = sampleImage(img, el.offsetWidth, el.offsetHeight);
      };
      img.src = "/Corelogo.png";
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
      clearTimeout(t);
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
        maskImage: "radial-gradient(ellipse 92% 88% at 50% 50%, black 55%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 92% 88% at 50% 50%, black 55%, transparent 100%)",
        ...style,
      }}
    />
  );
}
