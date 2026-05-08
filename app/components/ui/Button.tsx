import type { ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.96]";

  const variants = {
    primary:
      "bg-[--color-text] text-[--color-bg] hover:opacity-90 hover:shadow-[0_0_0_2px_rgba(245,245,247,0.14),0_0_16px_rgba(245,245,247,0.09)]",
    secondary:
      "bg-[--color-bg-elev-2] text-[--color-text] border border-[--color-border] hover:border-[--color-text-faint] hover:bg-[--color-bg-elev-1]",
    ghost: "text-[--color-text-dim] hover:text-[--color-text] hover:bg-[--color-bg-elev-2]",
    danger:
      "bg-[--color-danger] text-white hover:opacity-90 hover:shadow-[0_0_16px_rgba(229,72,77,0.4)]",
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5 gap-1.5",
    md: "text-sm px-4 py-2 gap-2",
    lg: "text-sm px-5 py-2.5 gap-2",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {loading && (
        <svg
          className="animate-spin -ml-0.5 h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
