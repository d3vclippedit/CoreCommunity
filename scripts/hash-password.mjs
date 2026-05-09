import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "@noble/hashes/utils.js";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = argon2id(new TextEncoder().encode(password), salt, { t: 3, m: 4096, p: 1, dkLen: 32 });
const saltB64 = Buffer.from(salt).toString("base64").replace(/=/g, "");
const hashB64 = Buffer.from(hash).toString("base64").replace(/=/g, "");
console.log(`$argon2id$t=3,m=4096,p=1$${saltB64}$${hashB64}`);
