import { Link } from "@remix-run/react";

export function Footer() {
  return (
    <footer className="w-full mt-auto" style={{ borderTop: "1px solid var(--color-border)" }}>
      <div
        className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-4 md:px-6 py-6"
        style={{ maxWidth: "1280px" }}
      >
        {/* Left: nav links */}
        <nav className="flex items-center gap-4" aria-label="Footer navigation">
          <FooterLink to="/communities">Communities</FooterLink>
          <FooterLink to="/about">About</FooterLink>
          <FooterLink to="/legal/terms">Terms</FooterLink>
          <FooterLink to="/legal/privacy">Privacy</FooterLink>
        </nav>

        {/* Right: built-by credit */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            Built by
          </span>
          <a
            href="https://twitter.com/d3vclippedit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 no-underline transition-opacity hover:opacity-70"
            aria-label="d3vclippedit on Twitter"
          >
            <D3vWordmark />
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-xs no-underline transition-colors hover:text-text"
      style={{ color: "var(--color-text-faint)" }}
    >
      {children}
    </Link>
  );
}

/** The d3v wordmark — gothic text, no portraits. Footer credit only. */
function D3vWordmark() {
  return (
    <svg
      width="28"
      height="16"
      viewBox="0 0 28 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <text
        x="0"
        y="13"
        fontFamily="'JetBrains Mono', ui-monospace, monospace"
        fontWeight="500"
        fontSize="11"
        fill="#6B6B73"
        letterSpacing="-0.2"
      >
        d3v
      </text>
    </svg>
  );
}
