export const CORE_STREAMERS = [
  { login: "lacy", display: "Lacy" },
  { login: "jasontheween", display: "JasonTheWeen" },
  { login: "marlon", display: "Marlon" },
  { login: "stableronaldo", display: "StableRonaldo" },
  { login: "silky", display: "Silky" },
  { login: "adapt", display: "Adapt" },
] as const;

export type StreamerLogin = (typeof CORE_STREAMERS)[number]["login"];

export interface StreamStatus {
  login: StreamerLogin;
  display: string;
  isLive: boolean;
  viewerCount: number;
  streamTitle: string | null;
  gameName: string | null;
  thumbnailUrl: string | null;
  startedAt: string | null;
}

export function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
