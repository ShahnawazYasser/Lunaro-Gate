# Lunaro Gate — Master Specification
**Version:** 1.1
**Owner:** Shahnawaz Yasser
**Status:** Spec locked — ready to build
**Repo:** https://github.com/ShahnawazYasser/Lunaro-Gate

---

## 0. What This Is

Lunaro Gate is a small two-part system that gates access to a DSLRBooth-powered photobooth at venues without integrated payment. The cashier at the venue's till generates a unique 4-digit code per paid order. The customer enters the code at the booth, which then unlocks DSLRBooth, runs a session, and prints exactly the number of copies they paid for.

**Why it exists:** Phase 1 of solving "booth usage without payment." Phase 2 will integrate a real payment gateway.

**Non-goal:** This is not a replacement for the long-term Lunaro OS Electron app. This is a thin shim around DSLRBooth so we can deploy paid sessions at coffee shops in Lahore *today*.

---

## 1. System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  CASHIER TILL  (any browser, no login)                           │
│  https://[vercel-url]/cashier                                    │
│  [Generate Code for N prints] → shows 4-digit code               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS (POST /api/codes/generate)
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│  VERCEL (Next.js 14, App Router)                                 │
│  API Routes:                                                     │
│    POST /api/codes/generate                                      │
│    GET  /api/codes/recent                                        │
│    POST /api/codes/claim                                         │
│    GET  /api/codes/[code]/status                                 │
│    GET  /api/webhook  (called by DSLRBooth)                      │
│    POST /api/codes/expire-old (cron, hourly)                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Postgres over TLS
                             ↓
                  ┌──────────────────────┐
                  │  NEON POSTGRES        │
                  │  - codes              │
                  │  - webhook_events     │
                  │  Region: ap-southeast-1│
                  └──────────────────────┘
                             ↑
                             │ HTTPS (all via API routes above)
                             │
┌────────────────────────────┴─────────────────────────────────────┐
│  BOOTH LAPTOP (Windows)                                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LUNARO GATE (Electron app, fullscreen always-on-top)   │    │
│  │  Idle: "Enter your 4-digit code" + keypad                │    │
│  │  On valid code:                                          │    │
│  │    1. POST /api/codes/claim  → atomically claim          │    │
│  │    2. GET  localhost:1500/api/lockscreen/exit            │    │
│  │    3. GET  localhost:1500/api/start?mode=print           │    │
│  │    4. minimize() (so DSLRBooth shows)                    │    │
│  │    5. START POLLING /api/codes/[code]/status every 2s    │    │
│  │  On poll result status='used':                           │    │
│  │    1. If prints_paid_for > prints_completed:             │    │
│  │       GET /api/print?count=(diff)                        │    │
│  │    2. GET localhost:1500/api/lockscreen/show             │    │
│  │    3. show() + focus() + always-on-top back to "Enter"   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DSLRBooth Professional (fullscreen behind Electron)    │    │
│  │  - Lock screen ON by default (PIN-protected)             │    │
│  │  - API: http://localhost:1500                            │    │
│  │  - Webhook URL: https://[vercel-url]/api/webhook?booth_id=default │
│  │  - Auto-print: 1 copy per session                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Cashier + webhook receiver + API | Next.js 14 (App Router) on Vercel | TypeScript strict |
| Booth helper | Electron + React + TypeScript | Windows only |
| Styling | Tailwind CSS | Premium dark theme |
| Database | Neon Postgres | `ap-southeast-1` (Singapore) or `us-east-2` — pick lowest ping from Lahore |
| DB client (Vercel) | `@neondatabase/serverless` | HTTP-based, edge-friendly |
| DB migrations | Raw SQL files run via Neon SQL Editor or psql | No ORM overhead |
| Hosting | Vercel | Auto-deploy from `main` branch |
| Realtime | Polling (2s intervals during active session) | No realtime service needed |

**Explicitly not using:**
- Supabase (hit 2-project free tier limit)
- Ably / Pusher / other realtime service
- Prisma / Drizzle / ORM (raw SQL is fine at this scale)
- Redis (nothing needs it yet)

---

## 3. Repo Structure (Monorepo, npm workspaces)

```
lunaro-gate/
├── package.json                      ← root, workspaces config
├── web/                              ← Next.js (cashier + webhooks + API)
│   ├── app/
│   │   ├── cashier/page.tsx
│   │   ├── api/
│   │   │   ├── codes/
│   │   │   │   ├── generate/route.ts
│   │   │   │   ├── recent/route.ts
│   │   │   │   ├── claim/route.ts
│   │   │   │   ├── [code]/status/route.ts
│   │   │   │   └── expire-old/route.ts
│   │   │   └── webhook/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── db.ts                     ← Neon client + query helpers
│   │   └── env.ts                    ← env var validation (zod)
│   ├── components/
│   ├── .env.local.example
│   ├── vercel.json                   ← cron config for /api/codes/expire-old
│   ├── next.config.mjs
│   ├── package.json
│   └── tsconfig.json
│
├── booth/                            ← Electron app (booth laptop)
│   ├── src/
│   │   ├── main/
│   │   │   ├── main.ts               ← Electron entry, window mgmt, DSLRBooth calls
│   │   │   ├── dslrbooth-client.ts   ← Typed wrapper for localhost:1500
│   │   │   ├── gate-api-client.ts    ← Typed wrapper for Vercel API
│   │   │   ├── ipc-handlers.ts
│   │   │   └── preload.ts            ← contextBridge
│   │   └── renderer/
│   │       ├── index.html
│   │       ├── App.tsx
│   │       ├── screens/
│   │       │   ├── IdleScreen.tsx    ← "Enter Code" UI
│   │       │   └── SessionActive.tsx ← Minimal overlay while polling
│   │       ├── components/
│   │       │   ├── Keypad.tsx
│   │       │   └── LogoHeader.tsx
│   │       └── hooks/
│   │           └── usePolling.ts     ← reusable polling hook
│   ├── .env.example
│   ├── electron-builder.json         ← Windows installer config
│   ├── vite.config.ts                ← Vite for renderer
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                           ← Cross-package types
│   ├── src/
│   │   ├── types.ts                  ← Code, WebhookEvent, ApiResponses
│   │   └── constants.ts              ← Timing defaults, status enums
│   ├── package.json
│   └── tsconfig.json
│
├── db/
│   └── schema.sql                    ← DDL + functions (idempotent)
│
├── docs/
│   ├── SETUP_GUIDE.md
│   └── CLAUDE_CODE_PROMPTS.md
│
├── CLAUDE.md
├── LUNARO_GATE_SPEC.md               ← This file
├── .gitignore
└── README.md
```

---

## 4. Design System (Lunaro brand)

- Background: `#0B1929` (midnight navy)
- Card surface: `#16293D`
- Border: `rgba(200,212,224,0.12)`
- Gold accent: `#C9A84C`
- Text primary: `#E8EFF5`
- Text secondary: `#8A9BAD`
- Success: `#4AC47A`
- Danger: `#C45A4A`

Typography: System UI / Segoe UI. Currency: always `PKR` — never `$`. Touch targets minimum 64×64px on the booth screen. Booth is landscape 1920×1080.

---

## 5. The Code

- **Format:** 4-digit numeric (e.g. `4729`). Stored as string to preserve leading zeros.
- **Single use.** Once a session is started against it, it's burned. Cannot be reused.
- **Expiry:** 2 hours from generation. After that, status flips to `expired` and the booth rejects it.
- **Collision check:** On generation, retry up to 50 times with `INSERT ... ON CONFLICT DO NOTHING`. Extremely unlikely at current volume.
- **What the code carries:** just `prints_paid_for`. Nothing else.

---

## 6. Data Model

See `db/schema.sql` for canonical DDL. Summary:

```
codes
─────────────────────────────────────────────
code              text PK              -- '4729'
status            text NOT NULL         -- enum: unused|claimed|in_session|used|expired|voided
prints_paid_for   int NOT NULL          -- CHECK 1..10
prints_completed  int NOT NULL DEFAULT 0
generated_at      timestamptz NOT NULL DEFAULT now()
expires_at        timestamptz NOT NULL  -- generated_at + 2 hours
claimed_at        timestamptz NULL
completed_at      timestamptz NULL
booth_id          text NOT NULL DEFAULT 'default'
metadata          jsonb NOT NULL DEFAULT '{}'

Indexes: (status), (expires_at), (booth_id, status), (generated_at DESC)


webhook_events
─────────────────────────────────────────────
id           uuid PK
code         text NULL REFERENCES codes(code)
event_type   text NOT NULL
param1..4    text NULL
received_at  timestamptz NOT NULL DEFAULT now()
booth_id     text NOT NULL DEFAULT 'default'
raw          jsonb NOT NULL DEFAULT '{}'

Index: (received_at DESC), (booth_id, received_at DESC)
```

### Status transitions

```
unused ──── customer enters code ────→ claimed
claimed ── session_start webhook ────→ in_session
in_session ── session_end webhook ──→ used
unused ──── 2h expiry (cron) ────────→ expired
* ──── manual void (future) ─────────→ voided
```

### Postgres functions

Two functions defined in `schema.sql`:
- `generate_code(prints_paid_for, booth_id, expiry_hours) → text` — atomic code creation with collision retry.
- `claim_code(code, booth_id) → table(code, prints_paid_for, expires_at)` — atomic single-UPDATE claim.

Both functions run with the connecting user's privileges (no `SECURITY DEFINER`). All access is through Next.js API routes using a single `DATABASE_URL`.

---

## 7. Cashier App Spec

### Route: `GET /cashier`

### UI (single page, no login)

```
┌──────────────────────────────────────────────────────┐
│                    LUNARO BOOTH                       │
│                                                       │
│             ┌────────────────────────┐                │
│             │   How many prints?     │                │
│             │                         │                │
│             │      [-]   1   [+]      │                │
│             │                         │                │
│             │   Total: PKR 500        │                │
│             │                         │                │
│             │  ┌──────────────────┐   │                │
│             │  │  GENERATE CODE   │   │                │
│             │  └──────────────────┘   │                │
│             └────────────────────────┘                │
│                                                       │
│  Today's codes (last 20):                             │
│  ───────────────────────────────────                  │
│   4729   1 print    14:32   ● unused                  │
│   1058   2 prints   14:21   ✓ used                    │
│   8843   1 print    13:55   ✗ expired                 │
│   ...                                                 │
└──────────────────────────────────────────────────────┘
```

### Behavior

- **Prints selector:** `[-]` and `[+]` buttons, min 1, max 5 (from `GATE_MAX_PRINTS_PER_CODE`). Default 1.
- **Price display:** client-side. `500 + (N - 1) * 250` PKR. Display-only — no charge.
- **Generate button:** `POST /api/codes/generate` with `{ prints_paid_for: N }`. Response: `{ code, expires_at }`. Displays code in a large modal:
  ```
  ┌──────────────────────────────┐
  │  Your code:                  │
  │        4 7 2 9               │
  │  Hand to customer            │
  │  Expires in 2 hours          │
  │   [PRINT]      [DONE]        │
  └──────────────────────────────┘
  ```
- **Print button:** `window.print()` with a printable slip stylesheet. Uses the till's system printer.
- **Recent codes list:** last 20 codes, refreshes on generate + auto every 30s.
- **Rate limiting:** cashier route uses Vercel Edge Middleware — max 30 code generations per IP per minute. Returns 429 with friendly message.

### No auth
Confirmed: no login. URL is shared only with the cashier device. Rate limiting protects against abuse.

---

## 8. Booth Electron App Spec

### Window
- Fullscreen on primary display
- `alwaysOnTop: true` while showing "Enter Code"
- `minimize()` after session starts (DSLRBooth surfaces)
- `show()` + `focus()` + `setAlwaysOnTop(true)` when polling detects `status='used'`

### Idle screen
```
┌──────────────────────────────────────┐
│                                      │
│             [Lunaro logo]            │
│                                      │
│      Enter your 4-digit code         │
│                                      │
│       ┌──┐ ┌──┐ ┌──┐ ┌──┐            │
│       │_ │ │_ │ │_ │ │_ │            │
│       └──┘ └──┘ └──┘ └──┘            │
│                                      │
│         ┌───┐ ┌───┐ ┌───┐            │
│         │ 1 │ │ 2 │ │ 3 │            │
│         │ 4 │ │ 5 │ │ 6 │            │
│         │ 7 │ │ 8 │ │ 9 │            │
│         │ ⌫ │ │ 0 │ │ ✓ │            │
│         └───┘ └───┘ └───┘            │
│                                      │
│   Need help? Ask the cafe staff.     │
└──────────────────────────────────────┘
```

### State machine

```
IDLE
  ↓ user enters 4 digits + ✓
VALIDATING
  ├── invalid → shake + "Invalid code" → IDLE
  ↓ POST /api/codes/claim returns { code, prints_paid_for }
UNLOCKING
  ↓ GET localhost:1500/api/lockscreen/exit
STARTING
  ↓ GET localhost:1500/api/start?mode=print
  ↓ minimize()
SESSION_ACTIVE
  ↓ poll GET /api/codes/{code}/status every 2s
  ├── timeout (5min without status='used') → RECOVERY
  ↓ status='used' detected
FINISHING
  ├── if prints_paid_for > prints_completed:
  │     GET localhost:1500/api/print?count=(diff)
  ↓ GET localhost:1500/api/lockscreen/show
  ↓ show() + focus() + alwaysOnTop=true
IDLE

RECOVERY
  ↓ log to sentry/console
  ↓ GET localhost:1500/api/lockscreen/show
  ↓ show()
  ↓ display "Something went wrong. Please ask staff for help."
  ↓ 10s auto-return to IDLE
```

### Wrong-code handling
Per your spec: unlimited retries. Shake animation + red banner. No staff alert.

### Recovery on app start
On Electron app start:
1. Bring window to front, alwaysOnTop=true
2. `GET localhost:1500/api/lockscreen/show` (ensure locked)
3. Query `GET /api/codes/status/in-flight?booth_id=default` to check if any code was mid-session when app crashed → if found, resume polling for that code

---

## 9. API Routes Spec

All routes live in `web/app/api/`. All return JSON. All log errors to Vercel logs.

### `POST /api/codes/generate`
Body:
```json
{ "prints_paid_for": 2 }
```
Response 200:
```json
{
  "code": "4729",
  "prints_paid_for": 2,
  "expires_at": "2026-07-07T16:32:00Z"
}
```
Errors:
- 400 if `prints_paid_for` out of range
- 429 if rate limited
- 500 if collision retry exhausted (extremely unlikely)

### `GET /api/codes/recent?booth_id=default&limit=20`
Response 200:
```json
{
  "codes": [
    { "code": "4729", "prints_paid_for": 1, "status": "unused",
      "generated_at": "...", "prints_completed": 0 },
    ...
  ]
}
```

### `POST /api/codes/claim`
Body:
```json
{ "code": "4729", "booth_id": "default" }
```
Response 200 (success):
```json
{
  "ok": true,
  "code": "4729",
  "prints_paid_for": 2,
  "expires_at": "..."
}
```
Response 200 (invalid — DO NOT use 4xx, this keeps the booth UI simple):
```json
{ "ok": false, "reason": "not_found" | "expired" | "already_used" }
```

### `GET /api/codes/[code]/status`
Response 200:
```json
{
  "code": "4729",
  "status": "in_session",
  "prints_paid_for": 2,
  "prints_completed": 1,
  "claimed_at": "...",
  "completed_at": null
}
```
Returns 404 if code not found.

### `GET /api/codes/in-flight?booth_id=default`
Response 200:
```json
{ "code": "4729" | null }
```
Used by booth app on startup to recover from crashes.

### `GET /api/webhook?event_type=...&param1=...&booth_id=default`
DSLRBooth calls this. Always returns 200 OK. Behavior:

| event_type | Action |
|---|---|
| `session_start` | Find booth's most recent `claimed` code → set `in_session` |
| `printing` | Find booth's most recent `in_session` code → increment `prints_completed` by `param2` |
| `session_end` | Find booth's most recent `in_session` code → set `used`, `completed_at = now()` |
| others | Log to `webhook_events` only |

### `POST /api/codes/expire-old` (Vercel cron, hourly)
Runs `SELECT expire_old_codes()`. Returns `{ expired_count: N }`.

Vercel cron config in `web/vercel.json`:
```json
{
  "crons": [
    { "path": "/api/codes/expire-old", "schedule": "0 * * * *" }
  ]
}
```

---

## 10. The Print Count Flow (locked)

### DSLRBooth Settings (manual, one-time)
- Print mode: **enabled**
- Auto-print after session: **enabled, 1 copy**
- Sharing screen timeout: 5s or less
- Webhook URL: `https://[vercel-url]/api/webhook?booth_id=default`
- API password: (copy from DSLRBooth Settings → General → API)

### Runtime flow
```
1. Customer enters code (e.g. 4 prints paid)
2. Booth POSTs /api/codes/claim → status=claimed
3. Booth GETs localhost:1500/api/start?mode=print
4. DSLRBooth webhook: session_start → status=in_session
5. DSLRBooth runs the photo session
6. DSLRBooth auto-prints 1 copy → webhook: printing param2=1 → prints_completed=1
7. DSLRBooth webhook: session_end → status=used
8. Booth polling detects status=used
9. diff = prints_paid_for - prints_completed = 3
10. Booth GETs localhost:1500/api/print?count=3
11. DSLRBooth prints 3 more → webhook: printing param2=3 → prints_completed=4
12. Booth locks DSLRBooth + returns to IDLE
```

---

## 11. Environment Variables

### Vercel (`web/`)
```
DATABASE_URL=postgres://...pooler.neon.tech/...
DATABASE_URL_UNPOOLED=postgres://...neon.tech/...   # for cron migrations
GATE_DEFAULT_BOOTH_ID=default
GATE_BASE_PRICE_PKR=500
GATE_ADDITIONAL_COPY_PRICE_PKR=250
GATE_MAX_PRINTS_PER_CODE=5
GATE_CODE_EXPIRY_HOURS=2
GATE_RATE_LIMIT_PER_MIN=30
```

### Booth Electron app (`booth/`)
```
GATE_API_BASE_URL=https://[vercel-url]
DSLRBOOTH_API_URL=http://localhost:1500
DSLRBOOTH_API_PASSWORD=rfX31g1P0P6X1PvC
BOOTH_ID=default
POLL_INTERVAL_MS=2000
SESSION_TIMEOUT_MS=300000
```

---

## 12. Hard Constraints — Never Violate

1. Booth must have internet. Confirmed acceptable.
2. Codes are single-use, 2-hour expiry, 4 digits.
3. DSLRBooth lock screen is on between sessions.
4. TypeScript strict, zero `any`. `npx tsc --noEmit` clean after every change.
5. No PII in `codes` table.
6. Webhooks always respond 200 OK.
7. All currency in PKR. Never USD.
8. DSLRBooth API password in env only, never hardcoded, never logged.
9. Booth Electron: fullscreen + alwaysOnTop when idle, minimized when DSLRBooth active.
10. Atomic code claim via single UPDATE — never `SELECT then UPDATE`.
11. All DB access through Next.js API routes. Browser + Electron never touch Neon directly.

---

## 13. Phase 2 / Future (NOT NOW)

- Payment gateway (Alfalah, Stripe)
- Operator dashboard (void codes, revenue, multi-booth)
- SMS/WhatsApp code delivery
- Multi-tenant (multi-shop, multi-booth per shop)
- Real payment reconciliation with cashier system
- Metabase analytics on Neon

---

*End of spec. Update this file when decisions change. Never let code drift from this document.*
