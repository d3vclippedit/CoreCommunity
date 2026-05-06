/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  RESEND_API_KEY: string;
  SESSION_SECRET: string;
  COMMUNITY_CREATION_OPEN: string; // "true" | "false" — feature flag
}
