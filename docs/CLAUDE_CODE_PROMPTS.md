# Lunaro Gate — Claude Code Prompts

Ordered prompts to build Lunaro Gate end to end. Feed them to Claude Code **one at a time, in order**. After each prompt:
1. Read the diff
2. Test the expected behavior (I'll describe what to test in each prompt)
3. Only move to the next prompt when the current one works

**Where to run each prompt:**
- Prompts 1–8: Mac (web app work, no Windows dependency)
- Prompt 9: Manual — deploy + smoke test
- Prompts 10–14: Windows booth laptop (Electron + DSLRBooth work)

**After every prompt:** commit + push to Git so the machines stay in sync.

---

## Phase A — Web App (run on Mac)

---

### Prompt 1: Monorepo scaffold + shared types

```
Read CLAUDE.md for full context.

This is the first code prompt. The repo is empty except for planning docs.

Task: scaffold the monorepo root and the `shared/` package.

Root:
1. Create package.json with npm workspaces: ["web", "booth", "shared"]
2. Create a base tsconfig.json (strict mode, target ES2022, module ESNext, moduleResolution bundler)
3. Add a top-level README.md that briefly describes the project and points to LUNARO_GATE_SPEC.md and CLAUDE.md
4. Confirm .gitignore covers node_modules, .next, .env, dist, out, build

Shared package (`shared/`):
1. Create shared/package.json — name "@lunaro-gate/shared", type "module", version 0.1.0
2. Create shared/tsconfig.json extending the root
3. Create shared/src/types.ts with the following exported types (derived from LUNARO_GATE_SPEC.md sections 6 and 9):
   - CodeStatus (string literal union: 'unused' | 'claimed' | 'in_session' | 'used' | 'expired' | 'voided')
   - Code (matches codes table columns)
   - WebhookEvent (matches webhook_events table)
   - GenerateCodeRequest / GenerateCodeResponse
   - ClaimCodeRequest / ClaimCodeResponse (with discriminated union on 'ok')
   - CodeStatusResponse
   - RecentCodesResponse
4. Create shared/src/constants.ts with:
   - DEFAULT_BOOTH_ID = 'default'
   - MAX_CODE_ATTEMPTS = 50
5. Create shared/src/index.ts that re-exports everything from types and constants

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- Run `npm install` at repo root — should succeed
- Run `npx tsc --noEmit -p shared/tsconfig.json` — zero errors
- Directory tree looks like the "Repo Structure" section of `LUNARO_GATE_SPEC.md`

---

### Prompt 2: Next.js scaffold + Tailwind

```
Read CLAUDE.md for full context.

Prompt 1 is complete: root monorepo, shared package with types and constants, all committed.

Task: scaffold the Next.js 14 App Router app in `web/`.

1. Create web/package.json:
   - name "@lunaro-gate/web"
   - dependencies: next@14, react@18, react-dom@18, @neondatabase/serverless, zod, "@lunaro-gate/shared": "*"
   - devDependencies: typescript, @types/react, @types/node, tailwindcss, postcss, autoprefixer
   - scripts: dev (next dev -p 3000), build, start, lint, typecheck (tsc --noEmit)
2. Create web/tsconfig.json extending the root, with Next.js defaults (jsx preserve, plugins next)
3. Create web/next.config.mjs (default export, transpilePackages: ["@lunaro-gate/shared"])
4. Create web/tailwind.config.ts with the Lunaro palette from CLAUDE.md "Design Tokens" section:
   - bg #0B1929, surface #16293D, gold #C9A84C, textPri #E8EFF5, textSec #8A9BAD, success #4AC47A, danger #C45A4A, border rgba(200,212,224,0.12)
   - content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"]
5. Create web/postcss.config.mjs
6. Create web/app/layout.tsx — minimal HTML shell, imports globals.css, sets lang="en", bg-bg text-textPri fonts
7. Create web/app/globals.css — Tailwind directives + a base body rule
8. Create web/app/page.tsx as a placeholder that just says "Lunaro Gate" and links to /cashier

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- `cd web && npm run dev` starts on port 3000
- Homepage loads showing "Lunaro Gate" with the dark background
- `npm run typecheck` in `web/` returns zero errors

---

### Prompt 3: DB client + env validation

```
Read CLAUDE.md for full context.

Prompts 1-2 complete: shared types, Next.js scaffold with Tailwind and Lunaro palette.

Task: build the database client and env validation for the web app.

1. Create web/lib/env.ts:
   - Uses zod to define a schema for all env vars listed in CLAUDE.md "Environment Variables" > Vercel section
   - Parses process.env once at module load
   - Exports a strongly typed `env` object
   - Throws a helpful error if required vars are missing
2. Create web/lib/db.ts:
   - Uses `@neondatabase/serverless` neon() function with env.DATABASE_URL
   - Exports a `sql` tagged template literal function (import { neon } from '@neondatabase/serverless')
   - Adds a small helper `query<T>(text: string, params: unknown[]): Promise<T[]>` for parameterized queries when tagged template isn't ergonomic
   - Adds typed helpers for the two RPCs:
     - generateCode(printsPaidFor, boothId, expiryHours) → returns code string
     - claimCode(code, boothId) → returns { code, prints_paid_for, expires_at } | null
     - expireOldCodes() → returns number
3. Add web/.env.local.example with all env var names (empty values) — commit this
4. Add "check:env" script to web/package.json that runs `node -e "require('./lib/env')"` to validate env at build time

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- Create `web/.env.local` with your actual Neon DATABASE_URL (from Step 1.2 of Setup Guide) + defaults for other vars
- Run `cd web && npx tsx -e "import('./lib/db').then(async ({generateCode}) => console.log(await generateCode(1)))"` — should print a 4-digit code
- Check Neon SQL Editor — a row exists in `codes` table

---

### Prompt 4: Code API routes (generate, claim, recent, status, in-flight)

```
Read CLAUDE.md for full context.

Prompts 1-3 complete: shared types, Next.js scaffold, db client with typed RPCs. Generated a test code and verified it's in Neon.

Task: build all five code-related API routes.

Routes (all under web/app/api/):
1. POST /api/codes/generate — parses { prints_paid_for }, calls generateCode(), returns { code, prints_paid_for, expires_at }
2. POST /api/codes/claim — parses { code, booth_id? }, calls claimCode(), returns discriminated union { ok: true, code, prints_paid_for, expires_at } | { ok: false, reason: 'not_found' | 'expired' | 'already_used' }. Use a follow-up SELECT to determine the specific reason when claim returns null.
3. GET /api/codes/recent?booth_id=&limit= — returns { codes: [...] }, ordered by generated_at desc, default limit 20
4. GET /api/codes/[code]/status — returns full row or 404
5. GET /api/codes/in-flight?booth_id= — returns { code: string | null } — most recent 'claimed' or 'in_session' code for the booth

All routes:
- Use zod for input validation
- Return typed JSON matching shared/src/types.ts
- Log errors to console.error with request context
- Use runtime = 'edge' for /generate, /claim, /recent, /status, /in-flight (all short-lived, Neon serverless client works on edge)

Rate limiting: for /generate only, use Vercel Edge Middleware. Create web/middleware.ts that limits by IP to env.GATE_RATE_LIMIT_PER_MIN. Use an in-memory Map with time buckets (simple, per-instance, acceptable for our volume). Return 429 with { error: 'rate_limited' } on exceed.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- `cd web && npm run dev`, then test in another terminal:
  ```
  curl -X POST http://localhost:3000/api/codes/generate -H 'content-type: application/json' -d '{"prints_paid_for":2}'
  ```
  Should return a code.
- `curl http://localhost:3000/api/codes/recent` returns the code you just made
- `curl -X POST http://localhost:3000/api/codes/claim -H 'content-type: application/json' -d '{"code":"XXXX"}'` (use the code) returns `{ok:true,...}` first time, `{ok:false,reason:"already_used"}` if run again
- Rate limit: 31 rapid /generate calls → last one returns 429

---

### Prompt 5: Webhook API route

```
Read CLAUDE.md for full context.

Prompts 1-4 complete: all code CRUD routes working, rate limit middleware active.

Task: build the DSLRBooth webhook receiver.

Create web/app/api/webhook/route.ts:
- Handles GET requests (DSLRBooth sends GETs)
- Query params: event_type, param1, param2, param3, param4, booth_id
- Behavior:
  1. Always insert a row into webhook_events (raw JSONB includes the full URL search params)
  2. If event_type = 'session_start': find most recent code where booth_id matches AND status='claimed'; update to status='in_session'
  3. If event_type = 'printing': find most recent code where booth_id matches AND status='in_session'; increment prints_completed by parseInt(param2, 10) — default 1 if param2 missing
  4. If event_type = 'session_end': find most recent code where booth_id matches AND status='in_session'; set status='used', completed_at=now()
- Always respond 200 OK with { ok: true } — even on internal errors. Log errors but never propagate.
- runtime = 'edge'

Use a single SQL statement per action (no SELECT-then-UPDATE). Example for session_end:
  update codes set status='used', completed_at=now()
  where code = (
    select code from codes
    where booth_id=$1 and status='in_session'
    order by claimed_at desc nulls last limit 1
  )
  returning code;

If the returned code is not null, use it to backfill the code column on the webhook_events row you inserted at the start (either update after, or do the correlation lookup first then insert — pick whichever is cleaner).

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
Manual smoke test with curl:
```
# Generate + claim a code first
curl -X POST http://localhost:3000/api/codes/generate -H 'content-type: application/json' -d '{"prints_paid_for":2}'   # returns "1234"
curl -X POST http://localhost:3000/api/codes/claim -H 'content-type: application/json' -d '{"code":"1234"}'

# Simulate DSLRBooth webhooks
curl "http://localhost:3000/api/webhook?event_type=session_start&param1=print&booth_id=default"
curl "http://localhost:3000/api/webhook?event_type=printing&param1=%2Ffile&param2=1&param3=EpsonL8050&booth_id=default"
curl "http://localhost:3000/api/webhook?event_type=session_end&booth_id=default"

# Verify state
curl http://localhost:3000/api/codes/1234/status
# → { status: 'used', prints_completed: 1, prints_paid_for: 2, ... }
```

---

### Prompt 6: Expiry cron + vercel.json

```
Read CLAUDE.md for full context.

Prompts 1-5 complete: webhook route works, manual smoke test end-to-end passed.

Task: add the expiry cron.

1. Create web/app/api/codes/expire-old/route.ts:
   - POST handler
   - Calls expireOldCodes() from lib/db.ts
   - Returns { expired_count: N }
   - runtime = 'nodejs' (crons don't run on edge in Vercel)
   - Add a simple auth check: require header 'x-vercel-cron' to be present (Vercel sends this on cron invocations); return 401 otherwise
2. Create web/vercel.json:
   {
     "crons": [
       { "path": "/api/codes/expire-old", "schedule": "0 * * * *" }
     ]
   }

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- Manual test: `curl -X POST -H "x-vercel-cron: 1" http://localhost:3000/api/codes/expire-old` returns `{ expired_count: 0 }`
- Without header, returns 401

---

### Prompt 7: Cashier UI page

```
Read CLAUDE.md for full context.

Prompts 1-6 complete: all API routes working, cron configured.

Task: build the cashier UI at /cashier.

Create web/app/cashier/page.tsx as a client component. Reference LUNARO_GATE_SPEC.md section 7 for the UI spec.

Requirements:
- Large centered "How many prints?" card with [-] and [+] buttons around a number (min 1, max GATE_MAX_PRINTS_PER_CODE = 5 for now, hardcode 5 — server enforces truth)
- Live price calculation: base + (count - 1) * additionalPrice. Display as "PKR 500" format.
- "GENERATE CODE" button — POSTs to /api/codes/generate. Disabled while loading.
- On success: show a modal overlay with the 4-digit code in huge type (space out digits), "Hand to customer", "Expires in 2 hours", two buttons: [PRINT] and [DONE]
- [PRINT] triggers window.print() with a print stylesheet that ONLY shows the code + expiry (not the rest of the app)
- [DONE] closes the modal
- Bottom half: "Today's codes (last 20)" — table with columns: Code | Prints | Time | Status
  - Fetches from /api/codes/recent on mount + every 30s + on generate
  - Status shown with colored dot: unused=neutral gray, claimed=gold, in_session=gold, used=success green, expired=text-secondary, voided=danger
- Use fetch with proper error handling — show a red banner on API errors

Design:
- Dark theme with the Lunaro palette (already in tailwind.config.ts)
- Generous whitespace, feel premium
- Large touch targets (buttons min h-16)
- Use the print stylesheet trick: @media print { body > *:not(.print-slip) { display: none; } .print-slip { display: block; } }

Create supporting components in web/components/ as needed (CashierForm, CodeModal, RecentCodesTable). Keep files small.

Do not add authentication. Do not add a header/nav. This is a single-purpose page.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- Visit http://localhost:3000/cashier
- Generate a code → modal appears with big code
- Print button opens browser print preview showing only the code
- Recent codes list shows the code
- Refresh page → recent codes still there

---

### Prompt 8: Push + first Vercel deploy

```
Read CLAUDE.md for full context.

Prompts 1-7 complete: web app fully built locally. All routes + cashier UI work end to end.

Task: prepare for and verify the first successful Vercel deployment.

1. Add a top-level "typecheck" script to root package.json that runs typecheck across all workspaces: `npm run typecheck --workspaces --if-present`
2. Add a "lint" script (basic eslint config for Next.js in web/, no lint in shared)
3. Add a GitHub Actions workflow .github/workflows/ci.yml that runs on push to main:
   - Node 20
   - npm install
   - Root typecheck
   - web/ build (next build)
4. Verify web/next.config.mjs has `output: 'standalone'` for Vercel efficiency
5. Verify all env vars used are documented in .env.local.example

Do not deploy — that's a manual step. Just make sure everything is ready.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- Push to GitHub
- Vercel auto-deploys
- Vercel deployment succeeds (green checkmark)
- Visit `https://your-vercel-url.vercel.app/cashier` — cashier UI works in production
- Generate a code, verify it appears in Neon SQL Editor

---

### 🚦 Checkpoint: Web app is live

**Do the following manually before moving to booth prompts:**

1. Test cashier flow on production URL — generate 3 codes with different print counts
2. From the production URL, simulate DSLRBooth webhooks via curl (see Prompt 5 for examples). Confirm codes progress through statuses correctly.
3. Update your DSLRBooth trigger URL on the Windows laptop with your production Vercel URL (Step 4.4 in Setup Guide)
4. Copy `SETUP_GUIDE.md` Windows Step 4.5 test — verify the webhook actually hits Vercel: generate a code, claim it via production API, then trigger a real DSLRBooth session; watch Vercel logs.

If all clean, move to Phase B.

---

## Phase B — Booth Electron App (run on Windows booth laptop)

**Switch machines.** Pull the latest from Git on the Windows laptop, then run these prompts.

---

### Prompt 9: Electron scaffold with Vite

```
Read CLAUDE.md for full context.

Web app is complete and deployed to Vercel. Now building the booth Electron app.

Task: scaffold the Electron app in `booth/` using Vite for the renderer.

1. Create booth/package.json:
   - name "@lunaro-gate/booth"
   - main "dist/main/main.js"
   - dependencies: electron@30, react@18, react-dom@18, zod, "@lunaro-gate/shared": "*"
   - devDependencies: typescript, vite, @vitejs/plugin-react, electron-builder, @types/react, @types/node, concurrently, cross-env, tailwindcss, postcss, autoprefixer
   - scripts:
     - dev: concurrently "npm:dev:vite" "npm:dev:main" "npm:dev:electron"
     - dev:vite: vite (renderer on port 5173)
     - dev:main: tsc -p tsconfig.main.json --watch
     - dev:electron: wait for port 5173 then electron .
     - build: npm run build:renderer && npm run build:main
     - build:renderer: vite build
     - build:main: tsc -p tsconfig.main.json
     - package: electron-builder
     - typecheck: tsc --noEmit -p tsconfig.main.json && tsc --noEmit -p tsconfig.renderer.json
2. Create booth/tsconfig.main.json for main process (CommonJS out, target ES2022, out to dist/main)
3. Create booth/tsconfig.renderer.json for renderer (ESNext, JSX, includes src/renderer)
4. Create booth/vite.config.ts (root src/renderer, base "./", build out to dist/renderer)
5. Create booth/src/main/main.ts:
   - Creates BrowserWindow: fullscreen: true, alwaysOnTop: true, autoHideMenuBar: true, kiosk: true (in production only, not dev)
   - In dev: loads http://localhost:5173. In prod: loads dist/renderer/index.html.
   - Uses setAlwaysOnTop(true, 'screen-saver') level
6. Create booth/src/main/preload.ts (empty contextBridge stub for now)
7. Create booth/src/renderer/index.html with root div
8. Create booth/src/renderer/main.tsx that renders <App />
9. Create booth/src/renderer/App.tsx — placeholder that shows "Lunaro Gate" on the Lunaro dark background
10. Create booth/tailwind.config.ts + postcss.config.mjs matching the web/ palette exactly
11. Create booth/src/renderer/index.css with Tailwind directives
12. Create booth/.env.example with all vars from CLAUDE.md booth section

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- `cd booth && npm install` succeeds
- Create `booth/.env` with your real GATE_API_BASE_URL and DSLRBOOTH_API_PASSWORD
- `cd booth && npm run dev` opens a fullscreen Electron window showing "Lunaro Gate" on the dark background
- Ctrl+Shift+I opens devtools (dev mode only)
- Close with Cmd+Q or task manager

---

### Prompt 10: DSLRBooth client + Gate API client + IPC contract

```
Read CLAUDE.md for full context.

Prompt 9 complete: Electron shell running, shows Lunaro Gate placeholder.

Task: build the API clients in the main process and expose them via typed IPC.

1. Create booth/src/main/env.ts — zod-validated env loader for main process (dotenv already loaded by Electron's process.env in dev)
2. Create booth/src/main/dslrbooth-client.ts:
   - Wraps http://localhost:1500 API from CLAUDE.md "DSLRBooth API Cheat Sheet"
   - Exports typed methods: startPrintSession(), reprint(count), showLockScreen(), exitLockScreen()
   - Each method: constructs URL with password query param, fetches, parses { IsSuccessful, ErrorMessage } response
   - Throws typed DslrBoothError with message from ErrorMessage on failure
   - Includes a health-check method testConnection() that GETs a lightweight endpoint (try /api/lockscreen/show — if it returns 200 (with or without success), API is up)
3. Create booth/src/main/gate-api-client.ts:
   - Wraps GATE_API_BASE_URL routes
   - Exports typed methods:
     - claimCode(code) → returns ClaimCodeResponse from shared
     - getCodeStatus(code) → returns CodeStatusResponse from shared
     - getInFlightCode() → returns { code: string | null }
   - Uses global fetch, 10 second timeout via AbortController
   - Throws typed GateApiError on network failure
4. Create booth/src/main/ipc-handlers.ts:
   - Registers ipcMain.handle for each capability:
     - 'gate:claim-code' → gate-api-client.claimCode
     - 'gate:get-status' → gate-api-client.getCodeStatus
     - 'gate:get-in-flight' → gate-api-client.getInFlightCode
     - 'dslr:start-session' → dslrbooth-client.startPrintSession
     - 'dslr:reprint' → dslrbooth-client.reprint
     - 'dslr:lock' → dslrbooth-client.showLockScreen
     - 'dslr:unlock' → dslrbooth-client.exitLockScreen
     - 'window:minimize' → mainWindow.minimize
     - 'window:show' → mainWindow.show + focus + setAlwaysOnTop(true, 'screen-saver')
5. Update booth/src/main/main.ts to import and call registerIpcHandlers(mainWindow) after window creation
6. Update booth/src/main/preload.ts to expose window.gateAPI with the typed methods above via contextBridge. Define the TypeScript type as `GateAPI` in a new file booth/src/renderer/global.d.ts.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- `npm run typecheck` in `booth/` returns zero errors
- Open devtools console, type `await window.gateAPI['dslr:lock']()` — DSLRBooth's lock screen should appear
- Type `await window.gateAPI['dslr:unlock']()` — lock screen dismisses

---

### Prompt 11: IdleScreen + Keypad UI

```
Read CLAUDE.md for full context.

Prompts 9-10 complete: Electron shell + IPC + API clients wired. Manual test of dslr:lock/unlock through devtools console works.

Task: build the IdleScreen UI with the on-screen keypad.

Reference LUNARO_GATE_SPEC.md section 8 "Idle screen" diagram.

1. Create booth/src/renderer/screens/IdleScreen.tsx as a functional component
2. Create booth/src/renderer/components/Keypad.tsx — 3x4 grid of numeric buttons + backspace + confirm (✓)
   - Buttons min 96x96px, gold border on hover/tap, big font
   - Confirm button disabled until 4 digits entered
3. Create booth/src/renderer/components/CodeDisplay.tsx — 4 slots showing each digit as it's typed (empty slot = underscore)
4. Create booth/src/renderer/components/LogoHeader.tsx — placeholder Lunaro text logo in gold (real logo swap later)
5. Create booth/src/renderer/components/ErrorBanner.tsx — red banner overlay, dismisses after 3s
6. IdleScreen composition:
   - Vertical centered layout
   - LogoHeader at top
   - "Enter your 4-digit code" title
   - CodeDisplay (bound to local state)
   - Keypad (calls onKeyPress prop)
   - Small "Need help? Ask the cafe staff." footer text
7. State inside IdleScreen: `enteredCode: string`. On keypad key press, update. On confirm, call `onCodeSubmit(code)` prop. Backspace removes last digit.
8. Shake animation utility: create booth/src/renderer/hooks/useShake.ts that returns { shake: () => void, className: string } — when shake() is called, className flips to 'animate-shake' for 500ms then back. Add the keyframe to tailwind.config.ts.
9. Update booth/src/renderer/App.tsx to render <IdleScreen onCodeSubmit={(code) => console.log('submit', code)} /> for now. Real submit wiring is next prompt.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- Electron window shows keypad UI with 4 empty digit slots
- Tap digits — slots fill in
- Backspace works
- Confirm button disabled until 4 digits
- Confirm with 4 digits → console.log fires
- UI looks premium (Lunaro dark theme, gold accents)

---

### Prompt 12: State machine + polling + session flow

```
Read CLAUDE.md for full context.

Prompts 9-11 complete: Electron shell, API clients, IdleScreen with keypad. Confirm submit fires a console.log.

Task: wire the full session state machine.

Reference LUNARO_GATE_SPEC.md section 8 "State machine".

1. Create booth/src/renderer/state/session-machine.ts:
   - TypeScript discriminated union for states: IDLE | VALIDATING | UNLOCKING | STARTING | SESSION_ACTIVE | FINISHING | RECOVERY
   - Custom hook useSessionMachine() that manages the state transitions
   - Each transition returns a Promise that either succeeds (moves to next state) or fails (moves to RECOVERY with a message)
2. Wire IdleScreen → VALIDATING:
   - On code submit, call window.gateAPI['gate:claim-code'](code)
   - On {ok:true}: transition to UNLOCKING
   - On {ok:false, reason}: shake the code display, show ErrorBanner ("Invalid code. Try again or ask staff."), return to IDLE with cleared code
3. VALIDATING → UNLOCKING: call gateAPI['dslr:unlock']. On success → STARTING. On fail → RECOVERY.
4. UNLOCKING → STARTING: call gateAPI['dslr:start-session']. On success → SESSION_ACTIVE, call gateAPI['window:minimize']. On fail → RECOVERY.
5. Create booth/src/renderer/hooks/usePolling.ts — generic polling hook that takes (fn, intervalMs, shouldStop). Starts on mount, clears interval on unmount.
6. SESSION_ACTIVE:
   - Show a minimal "Session in progress" screen (mostly won't be visible since window is minimized, but needed for the moment window returns)
   - Use usePolling with intervalMs = POLL_INTERVAL_MS to fetch code status every 2s
   - Also start a 5-minute timeout — if elapsed without status becoming 'used', transition to RECOVERY
   - When polled status === 'used': transition to FINISHING with the fetched { prints_paid_for, prints_completed }
7. FINISHING:
   - If prints_paid_for > prints_completed: call gateAPI['dslr:reprint'](diff)
   - Wait 2 seconds (give DSLRBooth time to accept the print job)
   - Call gateAPI['dslr:lock']
   - Call gateAPI['window:show']
   - Transition to IDLE
8. RECOVERY:
   - Log the failure to console.error with context
   - Call gateAPI['dslr:lock'] (best-effort, catch errors)
   - Call gateAPI['window:show']
   - Show a red "Something went wrong. Please ask staff for help." screen for 10s
   - Auto-transition to IDLE
9. On app startup (App.tsx useEffect):
   - Call gateAPI['dslr:lock'] to ensure locked
   - Call gateAPI['gate:get-in-flight'] to check for a mid-session code
   - If in-flight code exists: skip to SESSION_ACTIVE state polling that code

Update booth/src/renderer/App.tsx to use useSessionMachine and render the appropriate screen based on state.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:** full end-to-end test with real DSLRBooth:
1. On Windows booth laptop, `cd web && ...` — actually the web app is deployed already, that's fine. Just make sure the booth laptop has internet.
2. On Mac browser, go to cashier URL, generate a code for 2 prints
3. On booth laptop, in Electron app, type the code + ✓
4. Electron window minimizes
5. DSLRBooth lock screen dismisses, session starts
6. DSLRBooth captures + auto-prints 1
7. Session ends
8. Booth calls /api/print?count=1 → DSLRBooth prints the second copy
9. DSLRBooth locks again
10. Electron window comes back showing "Enter Code"
11. Try the same code again → "Invalid code"

If any step fails, share exact behavior and errors.

---

### Prompt 13: Windows installer + autostart docs

```
Read CLAUDE.md for full context.

Prompts 1-12 complete: full end-to-end flow working with real DSLRBooth on Windows.

Task: package the Electron app as a Windows installer.

1. Create booth/electron-builder.json:
   - appId: "io.lunaro.gate"
   - productName: "Lunaro Gate"
   - directories.output: "release/"
   - files: ["dist/**/*", "node_modules/**/*", "package.json"]
   - win.target: "nsis"
   - nsis.oneClick: false, allowElevation: true, allowToChangeInstallationDirectory: true, createDesktopShortcut: true
2. Update booth/package.json scripts:
   - "package:win": "npm run build && electron-builder --win"
3. Run `npm run package:win` on the Windows laptop
4. Verify the installer at booth/release/Lunaro Gate Setup X.X.X.exe

Then follow Setup Guide Step 8 for autostart configuration.

TypeScript strict — no any types.

Do not touch any other files.
```

**Expected after this prompt:**
- `booth/release/Lunaro Gate Setup 0.1.0.exe` exists
- Run it, install to default location
- Launch from Start menu — same UI as dev mode
- Follow SETUP_GUIDE.md Step 8 to configure autostart

---

## 🎉 You're done

You now have:
- ✅ A production Vercel deployment serving cashiers
- ✅ A Windows installer running on the booth laptop
- ✅ DSLRBooth locked until a valid code is entered
- ✅ Exact print counts per paid code
- ✅ A crash-recovery flow

## Post-launch checklist

1. Run the full flow 5 times with real payments before going live
2. Print a physical cheat sheet for cafe staff
3. Test what happens when internet drops mid-session (the booth should recover gracefully when it comes back)
4. Test what happens when DSLRBooth crashes (customer asks staff, staff manually restarts DSLRBooth from Task Manager and re-enters a code)

## When something goes wrong later

- Copy the failure into a new chat with Claude, along with `CLAUDE.md` and `LUNARO_GATE_SPEC.md`
- Include exact error messages, Vercel log excerpts, DSLRBooth log excerpts
- One bug at a time — remember the working preference

---

*End of prompts.*
