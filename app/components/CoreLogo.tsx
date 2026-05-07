import { useState } from "react";

export function CoreLogo({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        cursor: "default",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Mark: two concentric C arcs + dot — the "Core" glyph */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        style={{
          width: "clamp(80px, 11vw, 130px)",
          height: "auto",
          marginBottom: "clamp(20px, 4vw, 40px)",
          transform: hovered ? "rotate(-10deg) scale(1.08)" : "none",
          transition: "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)",
          filter: hovered
            ? "drop-shadow(0 0 20px rgba(245,245,247,0.3))"
            : "drop-shadow(0 0 0px rgba(245,245,247,0))",
        }}
      >
        {/* Outer C */}
        <path
          d="M 80 18 A 44 44 0 1 0 80 82"
          fill="none"
          stroke="rgba(245,245,247,0.92)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Inner C */}
        <path
          d="M 70 32 A 26 26 0 1 0 70 68"
          fill="none"
          stroke="rgba(245,245,247,0.45)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Centre dot */}
        <circle cx="50" cy="50" r="5.5" fill="#F5F5F7" />
      </svg>

      {/* CORE — fills ~70% of container width */}
      <div
        style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontWeight: 900,
          fontSize: "clamp(72px, 11.5vw, 148px)",
          lineHeight: 0.87,
          letterSpacing: "-0.04em",
          color: "#F5F5F7",
          opacity: hovered ? 1 : 0.92,
          transition: "opacity 0.3s ease",
          textAlign: "center",
        }}
      >
        CORE
      </div>

      {/* divider */}
      <div
        style={{
          width: "clamp(48px, 8vw, 96px)",
          height: "1px",
          background: hovered
            ? "linear-gradient(90deg, transparent, rgba(245,245,247,0.35), transparent)"
            : "linear-gradient(90deg, transparent, rgba(245,245,247,0.12), transparent)",
          margin: "clamp(10px, 2vw, 18px) 0",
          transition: "background 0.4s ease",
        }}
      />

      {/* COMMUNITIES */}
      <div
        style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontWeight: 500,
          fontSize: "clamp(9px, 1.1vw, 12px)",
          letterSpacing: "0.45em",
          paddingLeft: "0.45em",
          color: hovered ? "#A1A1AA" : "#6B6B73",
          transition: "color 0.4s ease",
          textAlign: "center",
        }}
      >
        COMMUNITIES
      </div>
    </div>
  );
}
