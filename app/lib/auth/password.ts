import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { decodeBase64Url, encodeBase64Url } from "~/lib/utils";

// Kept low for Cloudflare Workers CPU limits while remaining secure
const ARGON2_PARAMS = { t: 3, m: 4096, p: 1, dkLen: 32 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = argon2id(password, salt, ARGON2_PARAMS);
  return `$argon2id$t=3,m=4096,p=1$${encodeBase64Url(salt)}$${encodeBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    // Format: $argon2id$params$salt$hash — split gives ["", "argon2id", params, salt, hash]
    if (parts.length !== 5 || parts[1] !== "argon2id") return false;
    const salt = decodeBase64Url(parts[3]);
    const expectedHash = decodeBase64Url(parts[4]);
    const actualHash = argon2id(password, salt, ARGON2_PARAMS);
    // Constant-time comparison
    if (actualHash.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < actualHash.length; i++) diff |= actualHash[i] ^ expectedHash[i];
    return diff === 0;
  } catch {
    return false;
  }
}

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "1234567890",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "welcome",
  "shadow",
  "monkey",
  "dragon",
  "master",
  "666666",
  "qwertyuiop",
  "superman",
  "michael",
  "jessica",
  "letmein",
  "trustno1",
  "batman",
  "access",
  "hello",
  "whatever",
  "pass",
  "q1w2e3r4",
  "qwerty123",
  "pass123",
  "admin123",
  "login",
  "admin",
  "welcome1",
  "abc123",
  "passw0rd",
  "p@ssword",
  "p@ssw0rd",
  "Pa$$word",
  "Pa$$w0rd",
  "password!",
]);

export type PasswordError = "too_short" | "too_weak" | "too_common";

export function validatePassword(password: string): PasswordError | null {
  if (password.length < 10) return "too_short";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "too_common";
  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score < 3) return "too_weak";
  return null;
}

export const PASSWORD_ERROR_MESSAGES: Record<PasswordError, string> = {
  too_short: "Password must be at least 10 characters.",
  too_weak: "Password must include at least 3 of: lowercase, uppercase, numbers, symbols.",
  too_common: "That password is too common. Please choose a stronger one.",
};
