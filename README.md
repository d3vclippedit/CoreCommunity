# CORE

Communities for creators who actually run them.

A creator-owned community platform — Reddit-style discoverable forums, Twitter-Communities-style identity, built specifically for streamers and the people around them.

**Stack:** Remix (Vite) · Cloudflare Pages · D1 · KV · R2 · Drizzle ORM · Tailwind v4 · Biome

---

## Local development

### Prerequisites

- Node 20+
- pnpm 9+
- Wrangler CLI (`pnpm add -g wrangler`)

### Setup

```bash
pnpm install

# Copy and fill in env vars
cp .dev.vars.example .dev.vars

# Copy and fill in Cloudflare resource IDs
cp wrangler.toml.example wrangler.toml
```

### Create Cloudflare resources (first time only)

```bash
wrangler d1 create core-db
wrangler kv:namespace create core-sessions
wrangler r2 bucket create core-media
```

Paste the returned IDs into `wrangler.toml`.

### Database

```bash
# Generate migrations from schema changes
pnpm db:generate

# Apply migrations locally
pnpm db:migrate:local

# Seed dev data
pnpm db:seed
```

### Run dev server

```bash
pnpm dev
```

### Testing

```bash
pnpm test          # Vitest unit tests
pnpm test:e2e      # Playwright E2E
pnpm typecheck     # TypeScript
pnpm lint          # Biome
```

---

## Deployment

Push to `main` triggers the GitHub Actions deploy workflow → Cloudflare Pages.

Set these secrets in GitHub Actions:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Set these via Wrangler for runtime:
```bash
wrangler pages secret put RESEND_API_KEY
wrangler pages secret put SESSION_SECRET
```

---

## Project structure

```
app/
  components/
    layout/      # AppShell, Header, Footer
    ui/          # Button, Input, Dialog, Toast (Phase 1+)
    post/        # PostCard, PostComposer, VoteButtons (Phase 3+)
    community/   # CommunityHeader, Sidebar (Phase 2+)
  lib/
    auth/        # session, password, email (Phase 1+)
    db/          # drizzle client (Phase 1+)
    permissions.ts
    embeds.ts
    ratelimit.ts
  routes/
  styles/
db/
  schema.ts
  migrations/
  seed.ts
tests/
  unit/
  e2e/
```

---

Built by [@d3vclippedit](https://twitter.com/d3vclippedit)
