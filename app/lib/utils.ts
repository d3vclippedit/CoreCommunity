/** Encode a Uint8Array to a base64url string (no padding). */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Decode a base64url string to Uint8Array. */
export function decodeBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Generate a cryptographically random token (32 bytes, base64url). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

/** Generate a UUID v4. */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Seconds since unix epoch. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Add seconds to now, return as Date. */
export function expiresAt(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}
