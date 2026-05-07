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
      style={{ position: "relative", ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* mix-blend-mode:screen makes any dark/black areas in the PNG transparent,
          so the white figure icons glow through naturally on the dark background */}
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
    </div>
  );
}
