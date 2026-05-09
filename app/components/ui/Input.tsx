import { type InputHTMLAttributes, forwardRef, useState } from "react";
import { cn } from "~/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  label?: string;
  hint?: string;
}

const sharedInputCls = (error: string | null | undefined, className?: string) =>
  cn(
    "w-full px-3 py-2 text-sm rounded-md transition-colors outline-none",
    "placeholder:text-[--color-text-faint]",
    error
      ? "border-[--color-danger] focus:ring-1 focus:ring-[--color-danger]"
      : "border-[--color-border] focus:border-[--color-text-dim]",
    className,
  );

const sharedInputStyle = (error: string | null | undefined) => ({
  background: "var(--color-bg-elev-2)",
  border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
  color: "var(--color-text)",
});

export function PasswordInput({
  error,
  label,
  hint,
  className,
  id,
  ...props
}: Omit<InputProps, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          id={id}
          {...props}
          type={show ? "text" : "password"}
          className={sharedInputCls(error, cn("pr-10", className))}
          style={sharedInputStyle(error)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--color-text-faint)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {show ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
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
