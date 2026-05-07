import { useEffect, useRef, useState } from "react";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
}

export function CoreLogo({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, inside: false });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const el: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = g;

    const sparks: Spark[] = [];
    let raf = 0;
    let cancelled = false;
    let lastSpawn = 0;

    function setSize() {
      const dpr = window.devicePixelRatio || 1;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnSpark(cx: number, cy: number) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 30;
      const speed = 0.4 + Math.random() * 1.2;
      sparks.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * speed,
        vy: -(0.3 + Math.random() * 0.8),
        life: 1,
        decay: 0.016 + Math.random() * 0.012,
        size: 1.2 + Math.random() * 2.2,
      });
    }

    function draw(ts: number) {
      if (cancelled) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const { x: mx, y: my, inside } = mouseRef.current;

      if (inside) {
        // Spawn sparks around cursor
        if (ts - lastSpawn > 35) {
          for (let i = 0; i < 4; i++) spawnSpark(mx, my);
          lastSpawn = ts;
        }

        // Cursor glow
        const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
        gr.addColorStop(0, "rgba(245,245,247,0.14)");
        gr.addColorStop(0.45, "rgba(245,245,247,0.04)");
        gr.addColorStop(1, "rgba(245,245,247,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(mx, my, 90, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw + update sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.015; // slight gravity
        s.life -= s.decay;

        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,245,247,${s.life * 0.75})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    setSize();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(setSize);
    ro.observe(el);

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inside: true,
      };
    };
    const onLeave = () => {
      mouseRef.current = { ...mouseRef.current, inside: false };
    };

    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        @keyframes coreFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.01); }
        }
      `}</style>

      {/* The actual logo — mix-blend-mode:screen makes the black background
          invisible so only the white figures glow through on any dark background */}
      <img
        src="/Corelogo.png"
        alt="Core Communities"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          mixBlendMode: "screen",
          animation: "coreFloat 5s ease-in-out infinite",
          filter: hovered
            ? "brightness(1.3) drop-shadow(0 0 48px rgba(245,245,247,0.55))"
            : "brightness(1.05) drop-shadow(0 0 22px rgba(245,245,247,0.25))",
          transition: "filter 0.5s ease",
        }}
      />

      {/* Canvas overlay — cursor sparkles and glow, pointer-events are on the
          wrapper div above so this sits invisibly over the image */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
