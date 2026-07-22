# Lunaro Gate — CLAUDE.md
> Working context file for Claude Code. Read this before doing anything.
> Master spec: `LUNARO_GATE_SPEC.md`. This file is the day-to-day operating manual.

---

## What Lunaro Gate Is

Two-part system that gates DSLRBooth photobooth access at venues without payment integration:

1. **Cashier Web App** (Next.js on Vercel) — cashier generates 4-digit code per paid order
2. **Booth Electron App** (Windows, on booth laptop) — customer enters code, app unlocks DSLRBooth and starts session

Backed by **Neon Postgres**. Booth polls Vercel API routes every 2s during active sessions (no realtime service).

---

## Current Build Status

### Built and working (`web/`)
- Neon Postgres schema + env validation + DB client
- Code lifecycle API routes: `generate`, `claim`, `[code]/status`, `in-flight`, `recent`, `expire-old`
- DSLRBooth webhook receiver
- Pricing config API route (no hardcoded prices in UI)
- Cashier UI: prints selector, code modal, recent codes table
- Code expiry moved from Vercel Cron to an hourly GitHub Actions workflow (`.github/workflows/expire-codes.yml`) — Vercel Hobby plan only allows daily cron
- Typecheck/lint scripts, ESLint config, CI workflow, standalone output for Vercel deploy

### Not started
- **Booth Electron app** (`booth/` workspace doesn't exist yet)

**Next steps (in order):**
1. Scaffold the `booth/` Electron app per `LUNARO_GATE_SPEC.md`
2. Wire booth polling + DSLRBooth `/api/start`, `/api/print`, lockscreen calls (see `dslrbooth-api` skill)

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Cashier + webhooks + API | Next.js 14 App Router on Vercel | TypeScript strict |
| Booth helper | Electron + React + Vite + TypeScript | Windows only, fullscreen, always-on-top when idle |
| Database | Neon Postgres | Region: `ap-southeast-1` (Singapore) |
| DB client (Vercel) | `@neondatabase/serverless` | HTTP-based, edge-friendly |
| Styling | Tailwind CSS | Premium dark theme (Lunaro palette) |
| Realtime | Polling every 2s | No realtime service |
| DSLRBooth API | http://localhost:1500 | GET requests with `password=...` |
| DSLRBooth webhooks | GET to `https://[vercel-url]/api/webhook?booth_id=default` | |
| Package manager | `npm` (workspaces) | Simplest, no extra tooling |

---

## DSLRBooth API

Full endpoint and webhook-event reference: see the `dslrbooth-api` skill (`.claude/skills/dslrbooth-api/SKILL.md`).

---

## The Code Lifecycle (memorize this)

```
[cashier POSTs /api/codes/generate]
        ↓
   status: 'unused'
        ↓
[customer types code at booth, booth POSTs /api/codes/claim]
        ↓
   status: 'claimed'
        ↓
[booth calls /api/start on DSLRBooth, session_start webhook fires]
        ↓
   status: 'in_session'
        ↓
[DSLRBooth auto-prints 1, printing webhook fires]
        ↓
   prints_completed: 1
        ↓
[DSLRBooth fires session_end webhook]
        ↓
   status: 'used', completed_at: now()
        ↓
[Booth Electron polling detects status='used',
 checks prints_paid_for vs prints_completed,
 calls DSLRBooth /api/print?count=(diff) for extras]
        ↓
[More printing webhooks → prints_completed increments]
        ↓
[Booth locks DSLRBooth + comes back to Enter Code screen]
```

---

## Data Flow Rules

**All DB access goes through Next.js API routes.** No direct Neon queries from the browser or Electron. Ever. The `DATABASE_URL` lives in Vercel env vars only.

**Booth polls, doesn't subscribe.** During an active session, the booth polls `GET /api/codes/[code]/status` every `POLL_INTERVAL_MS` (default 2000ms). Stops polling when status becomes `used`.

**Webhooks are unauthenticated GETs.** DSLRBooth webhooks hit `https://[vercel-url]/api/webhook?event_type=...&booth_id=...`. Correlation to a code is by `booth_id + most recent status='claimed' or 'in_session'`. Not perfect, but works because only one session runs per booth at a time.

---

## How Claude Should Work With Shahnawaz

Non-negotiable working preferences:

### Bug & feature handling
- When multiple bugs/features listed, do NOT tackle all at once
- Pick starting order based on code dependencies and impact
- Fix one issue at a time, confirm, move to next
- Quality over speed

### Before writing any fix
- Read the actual file first: `cat file.ts | head -80` then `sed -n '80,160p'` in chunks
- Never write a fix based on assumptions
- Verify current state before proposing changes

### QA responsibility
- Act as Senior QA — flag likely issues before Shahnawaz tests
- After every fix: state expected behavior clearly, tell him what to watch for
- Never say "it should work now" without describing the exact flow

### Claude Code prompt format
Every prompt must follow this exact format:

```
Read CLAUDE.md for full context.

[describe what's already done and confirmed working]

[describe the single specific task — one thing only]

TypeScript strict — no any types.

Do not touch any other files.
```

### TypeScript
- Strict mode everywhere. Zero `any`.
- After every change: run `npx tsc --noEmit` in the affected workspace. Must return zero errors.

### Chat length
- When chat gets long, reasoning degrades
- Shahnawaz will ask to switch chats
- Always keep CLAUDE.md updated before switching
- Opening message for new chat includes the most recently changed file(s)

### Git workflow (auto-commit)
- Work happens directly on `main`. No feature branches, no PRs.
- After completing a prompt/task and confirming `npx tsc --noEmit` is clean, **automatically commit and push without waiting to be asked**:
  ```
  git add .
  git commit -m "<short, specific message describing what changed>"
  git push origin main
  ```
- Commit messages should be lowercase, imperative, specific (e.g. `add codes/generate api route`, not `updates` or `wip`).
- Never commit if `npx tsc --noEmit` fails or the task is half-finished. Fix first, then commit.
- Never force-push. Never rewrite history. Never commit `.env` or `.env.local`.
- If a `git push` fails (e.g. remote has newer commits), run `git pull --rebase origin main` first, resolve any conflicts, then push. Ask Shahnawaz before resolving any conflict that touches logic (not just formatting).
- At the start of a session, run `git pull origin main` before making any changes (Shahnawaz works across two machines — Mac for `web/`, Windows for `booth/`).

---

## Hard Constraints (from spec, never violate)

1. Internet required on both cashier and booth
2. Codes are single-use, 2-hour expiry, 4 digits numeric
3. DSLRBooth lock screen on between sessions
4. TypeScript strict, zero `any`
5. No PII in `codes` table
6. Webhooks always respond 200 OK
7. All currency in PKR
8. DSLRBooth API password only in env, never in code
9. Electron: fullscreen alwaysOnTop when showing "Enter Code", minimized when DSLRBooth active
10. Atomic code claim via single UPDATE — never SELECT then UPDATE
11. All DB access through Next.js API routes
12. Booth polls every 2s during active session, stops when status='used'

---

## Environment Variables

### Vercel (`web/`)
See `web/.env.local.example` for the current list and required values.

### Electron app (`booth/`)
```
GATE_API_BASE_URL=https://[vercel-url]
DSLRBOOTH_API_URL=http://localhost:1500
DSLRBOOTH_API_PASSWORD=rfX31g1P0P6X1PvC
BOOTH_ID=default
POLL_INTERVAL_MS=2000
SESSION_TIMEOUT_MS=300000
```

---

## Design Tokens

Palette lives in `web/tailwind.config.ts`. Layout: 1920×1080 landscape for booth. Touch targets min 64×64px. Currency always `PKR`.

---

## Known Open Items (resolve when building)

- [ ] Verify DSLRBooth auto-print behavior with v6.40+ on actual hardware
- [ ] Test webhook delivery latency booth → Vercel under venue WiFi
- [ ] Confirm Electron `alwaysOnTop` reliably stays on top of DSLRBooth fullscreen on Windows 10/11
- [ ] Decide Electron auto-update (Phase 2) or manual installer

---

## What's NOT in scope right now

- Payment gateway integration
- Operator dashboard
- Multi-booth / multi-tenant
- SMS code delivery
- Cloud photo gallery
- Custom templates
- Analytics

---

*End of CLAUDE.md. Update when status changes. Never let code drift from this document or `LUNARO_GATE_SPEC.md`.*
