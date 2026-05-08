import coreLogoUrl from "~/assets/Main.png";

export function CoreLogo({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <img
        src={coreLogoUrl}
        alt="Cormunities"
        className="core-logo-img"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          mixBlendMode: "screen",
          animation: "coreFloat 5s ease-in-out infinite",
          filter: "brightness(1.05) drop-shadow(0 0 22px rgba(245,245,247,0.25))",
          transition: "filter 0.5s ease",
        }}
      />
    </div>
  );
}
