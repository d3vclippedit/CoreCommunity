import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, label, hint, className, id, ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        {...props}
        className={cn(
          "w-full px-3 py-2 text-sm rounded-md transition-colors outline-none",
          "placeholder:text-[--color-text-faint]",
          error
            ? "border-[--color-danger] focus:ring-1 focus:ring-[--color-danger]"
            : "border-[--color-border] focus:border-[--color-text-dim]",
          className,
        )}
        style={{
          background: "var(--color-bg-elev-2)",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
          color: "var(--color-text)",
        }}
      />
      {hint && !error && (
        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
});
