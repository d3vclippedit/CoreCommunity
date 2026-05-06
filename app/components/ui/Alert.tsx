import { cn } from "~/lib/cn";

interface AlertProps {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = "info", children, className }: AlertProps) {
  const colors = {
    error: { bg: "var(--color-danger)", text: "white" },
    success: { bg: "#1a3d2a", text: "var(--color-success)" },
    info: { bg: "var(--color-bg-elev-2)", text: "var(--color-text-dim)" },
  };

  const c = colors[variant];

  return (
    <div
      className={cn("px-4 py-3 rounded-md text-sm", className)}
      style={{
        background: variant === "error" ? "rgba(229,72,77,0.12)" : c.bg,
        border: `1px solid ${variant === "error" ? "var(--color-danger)" : variant === "success" ? "var(--color-success)" : "var(--color-border)"}`,
        color: variant === "error" ? "var(--color-danger)" : c.text,
      }}
      role="alert"
    >
      {children}
    </div>
  );
}
