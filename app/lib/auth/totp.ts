const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = "";
  for (let i = 0; i < 20; i += 5) {
    const b = [
      bytes[i] ?? 0,
      bytes[i + 1] ?? 0,
      bytes[i + 2] ?? 0,
      bytes[i + 3] ?? 0,
      bytes[i + 4] ?? 0,
    ];
    out += B32[(b[0] >> 3) & 31];
    out += B32[((b[0] & 7) << 2) | (b[1] >> 6)];
    out += B32[(b[1] >> 1) & 31];
    out += B32[((b[1] & 1) << 4) | (b[2] >> 4)];
    out += B32[((b[2] & 15) << 1) | (b[3] >> 7)];
    out += B32[(b[3] >> 2) & 31];
    out += B32[((b[3] & 3) << 3) | (b[4] >> 5)];
    out += B32[b[4] & 31];
  }
  return out;
}

function b32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, "");
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hotp(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    b32Decode(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const msg = new ArrayBuffer(8);
  new DataView(msg).setUint32(4, counter >>> 0, false);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const offset = (sig[19] ?? 0) & 0xf;
  const code =
    (((sig[offset] ?? 0) & 0x7f) << 24) |
    ((sig[offset + 1] ?? 0) << 16) |
    ((sig[offset + 2] ?? 0) << 8) |
    (sig[offset + 3] ?? 0);
  return (code % 1_000_000).toString().padStart(6, "0");
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const t = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (const delta of [-1, 0, 1]) {
    if ((await hotp(secret, counter + delta)) === t) return true;
  }
  return false;
}

export function getOtpAuthUri(secret: string, handle: string): string {
  const label = encodeURIComponent(`Cormunities:@${handle}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Cormunities&digits=6&period=30&algorithm=SHA1`;
}
