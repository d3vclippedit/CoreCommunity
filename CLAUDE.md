# CORE — Claude Code Project Brief

Read this file at the start of every session before writing or changing code.
Locked decisions are non-negotiable unless Ollie (@d3vclippedit) explicitly overrides in chat.

---

## 0. Quick context

**Working name:** CORE — Create. Own. Run. Everything. (provisional — see §13.1 naming risk)
**Tagline:** Communities for creators who actually run them.
**Developer brand:** @d3vclippedit (Ollie). Footer + About page only.
**Stack:** Remix (Vite) + @remix-run/cloudflare · Cloudflare Pages · D1 (SQLite) · KV · R2 · Drizzle ORM · Tailwind v4 · Biome · pnpm

---

## 1. Locked tech stack

Do NOT change without written permission from Ollie.

| Concern | Choice |
|---|---|
| Frontend + backend | Remix (Vite) + @remix-run/cloudflare |
| Hosting | Cloudflare Pages + Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| Object storage | Cloudflare R2 |
| Sessions/cache | Cloudflare KV |
| Auth | Custom session-cookie + Argon2id |
| Email | Resend (free tier) |
| Styling | Tailwind CSS v4 |
| Components | Radix UI primitives + own styled components — NO shadcn |
| Icons | lucide-react |
| Rich text | Tiptap (minimal toolbar) |
| Lint/format | Biome |
| Testing | Vitest + Playwright |
| CI/CD | GitHub Actions → wrangler pages deploy |
| Package manager | pnpm, Node 20 LTS |

---

## 2. Design tokens (§5.2)

```css
--bg: #0A0A0C
--bg-elev-1: #111114
--bg-elev-2: #18181C
--border: #222227
--text: #F5F5F7
--text-dim: #A1A1AA
--text-faint: #6B6B73
--accent: #F5F5F7  (per-community override)
--danger: #E5484D
--success: #3DD68C
--font-sans: Inter, Geist, system-ui
--font-mono: JetBrains Mono, ui-monospace
--radius-sm: 6px / --radius-md: 10px / --radius-lg: 14px
```

**Aesthetic:** Clean, minimal, dark, professional. Not Discord-purple. Not gamer-styled.

**Layout:** 3-col desktop (left nav 256px · center feed max 720px · right rail 288px) · 2-col tablet · 1-col mobile.

---

## 3. V1 ships / V2 stubs

**V1:** Auth · Communities · Posts (text/image/link/video) · Comments (threaded) · Voting · Community feed (hot/new/top) · Platform home feed · Basic moderation (remove/ban/timeout/audit/reports) · Verified-streamer badge (manual) · /communities directory · Settings

**V2 (stub only):** Badges · XP/level/reputation · Leaderboards · Section types beyond General · Polls UI · Followers · Bookmarks UI · Trending algorithm · Auto-moderation · Appeals · Tags

---

## 4. Roles and permissions

| Permission | Member | Mod | Senior Mod | Admin | Streamer |
|---|---|---|---|---|---|
| Read | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post/comment/vote | ✓ | ✓ | ✓ | ✓ | ✓ |
| Remove post/comment | | ✓ | ✓ | ✓ | ✓ |
| Pin post | | ✓ | ✓ | ✓ | ✓ |
| Feature post | | | ✓ | ✓ | ✓ |
| Timeout user | | ✓ | ✓ | ✓ | ✓ |
| Ban user | | | ✓ | ✓ | ✓ |
| Manage rules/sections | | | ✓ | ✓ | ✓ |
| Customize theme | | | | ✓ | ✓ |
| Manage staff | | | Mods only | ✓ | ✓ |
| Manage admins | | | | | ✓ |
| Delete community | | | | | ✓ |

---

## 5. Phase gates

Finish each phase gate before starting the next phase.

- **Phase 0 gate:** Styled homepage renders at pages.dev URL. Header + footer. No console errors.
- **Phase 1 gate:** All auth flows work end-to-end. Tests green. Email arrives.
- **Phase 2 gate:** Two users can create communities, customize, subscribe/unsubscribe. Mobile works.
- **Phase 3 gate:** Full post → comment → vote loop. Embeds render. Hot sort works. Pinning works.
- **Phase 4 gate:** Reports → queue → resolve. Audit log records all. Banned users rejected. Permission tests pass.
- **Phase 5 gate:** No console errors on common flows. Lighthouse a11y > 95 / perf > 85. CLAUDE.md updated.

---

## 6. Don't-do list

- No streamer portraits from d3vclippedit logo (likeness rights).
- No chat/DMs/voice/WebSockets.
- No separate backend service.
- No new paid third-party SaaS.
- No V2 features in V1 unless trivial.
- No Discord/Twitch purple or gamer styling.
- No PII beyond email + handle + displayName + bio.
- No API keys in commits. Secrets via env/Wrangler only.
- Never commit `.dev.vars` or `wrangler.toml` with real IDs.

---

## 7. Open questions (answer in chat before relevant phase)

1. **CORE name risk** — unaffiliated streaming group called CORE just launched. Do not buy a core.<tld> domain. Use pages.dev until Ollie talks to them. Add non-affiliation disclosure on /about.
2. **Community creation gating** — recommended: (b) verified streamers + manual approval. Confirm.
3. **Verified-streamer criteria** — manual review of Twitch/YouTube/Kick? Follower threshold?
4. **Email sender domain** — noreply@<final-domain> — TBD after domain purchase.
5. **d3vclippedit social links** — Ollie to provide Twitter/X, TikTok, YouTube, Twitch, Instagram URLs.
6. **Backup name** — pick one in case CORE-the-group says no.
7. **Default accent color** — white (#F5F5F7) or a real CORE accent (green, electric blue)?

---

## 8. Code conventions

- TypeScript strict everywhere. No `any` outside genuinely untyped third-party adapters.
- Server-only code in `*.server.ts` files.
- Loaders return `json({ ... })` with explicit Drizzle-inferred types.
- Actions: `redirect()` on success, `json({ errors }, { status: 400 })` on validation fail.
- Forms: native `<Form>` + `useActionData`. No client-side fetch unless necessary.
- Commit: `feat(scope): subject` / `fix:` / `chore:` / `refactor:` / `test:`
- No comments explaining what code does. Only comment the *why* when non-obvious.
- No half-finished features. No backwards-compat shims for removed code.

---

Last updated: May 2026 — initial scaffold by @d3vclippedit + Claude. Update when decisions change.
