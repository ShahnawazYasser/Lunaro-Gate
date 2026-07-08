# Lunaro Gate — Setup Guide

This guide covers everything you need to do manually before running Claude Code prompts. Follow in order. Each step assumes the previous is complete.

**Estimated time:** 60 minutes total (first-time). Ignore steps marked ⏩ if already done for a previous Lunaro project.

---

## What You'll End Up With

By the end of this guide:
- ✅ Neon Postgres database with schema applied
- ✅ Vercel project linked to your GitHub repo
- ✅ Local dev environment on your Mac (for `web/`)
- ✅ Local dev environment on the Windows booth laptop (for `booth/`)
- ✅ DSLRBooth Pro configured with API + lock screen + webhook
- ✅ Windows autostart configured
- ✅ A working end-to-end smoke test

Then you move to `CLAUDE_CODE_PROMPTS.md` to actually build the app.

---

## Prerequisites

### Accounts you need
- ✅ GitHub (you already have — repo is `ShahnawazYasser/Lunaro-Gate`)
- ⏩ Neon account → https://neon.tech (sign in with GitHub)
- ⏩ Vercel account → https://vercel.com (sign in with GitHub)

### Software on your Mac
- ⏩ Node.js 20+ (`node -v` should show v20 or v22)
- ⏩ npm 10+ (`npm -v`)
- ⏩ Git
- ⏩ Cursor or VS Code
- ⏩ Claude Code (`npm install -g @anthropic-ai/claude-code`)

### Software on the Windows booth laptop
- ✅ DSLRBooth Professional v6.40+ (you already have)
- ⬜ Node.js 20+ for Windows (https://nodejs.org)
- ⬜ Git for Windows (https://git-scm.com/download/win)
- ⬜ Cursor or VS Code for Windows
- ⬜ Claude Code for Windows

If you're missing any Windows tools, install them now. They take ~10 minutes total.

---

## Step 1: Neon Database (5 minutes)

### 1.1 Create the Neon project

1. Go to https://console.neon.tech
2. Click **New Project** (top right)
3. Fill in:
   - **Project name:** `Lunaro Gate`
   - **Postgres version:** `17` (latest)
   - **Region:** **Singapore (`ap-southeast-1`)** — closest to Lahore with low latency
   - **Database name:** leave as `neondb`
4. Click **Create project**

Neon will provision the database. Takes about 30 seconds.

### 1.2 Grab the connection strings

After project creation, you'll see the **Connection Details** panel. There are two you need:

1. **Pooled connection** (labeled "Pooled connection" or "connection pooler"). Looks like:
   ```
   postgres://neondb_owner:XXXX@ep-something-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Copy this. This is `DATABASE_URL`.

2. **Direct connection** (labeled "Direct connection"). Looks like:
   ```
   postgres://neondb_owner:XXXX@ep-something.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Copy this too. This is `DATABASE_URL_UNPOOLED`.

**Save both** in a temporary text file. You'll paste them into Vercel and your local `.env.local` shortly.

### 1.3 Apply the schema

1. In the Neon Console, left sidebar → **SQL Editor**
2. Click **New query**
3. Open `db/schema.sql` from the files I gave you
4. Copy the **entire contents** and paste into Neon SQL Editor
5. Click **Run** (or Cmd/Ctrl + Enter)
6. Should see: `Success. No rows returned` for the DDL parts, and results for verification queries (if you uncommented them)

### 1.4 Verify

In the same SQL Editor, run:
```sql
select public.generate_code(2);
select * from public.codes;
```
You should see:
- First query: returns a 4-digit code like `'4729'`
- Second query: shows one row with your generated code

Then run:
```sql
select * from public.claim_code((select code from public.codes limit 1));
select * from public.codes;
```
You should see:
- First query: returns the code with `prints_paid_for`
- Second query: same row but `status='claimed'`, `claimed_at` populated

If that all works, clean up:
```sql
truncate public.codes cascade;
truncate public.webhook_events;
```

**Neon is done.** ✅

---

## Step 2: Vercel Project (5 minutes)

### 2.1 Import your Git repo

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Find **Lunaro-Gate** in the list. Click **Import**.
4. Configuration screen:
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** click **Edit** → set to `web` (the Next.js app lives in a subfolder)
   - **Build/Output settings:** leave defaults
5. **DO NOT click Deploy yet.** First we need env vars.

### 2.2 Set environment variables

In the same configuration screen, expand **Environment Variables**. Add each of these:

| Name | Value |
|---|---|
| `DATABASE_URL` | (your pooled Neon connection string from Step 1.2) |
| `DATABASE_URL_UNPOOLED` | (your direct Neon connection string from Step 1.2) |
| `GATE_DEFAULT_BOOTH_ID` | `default` |
| `GATE_BASE_PRICE_PKR` | `500` |
| `GATE_ADDITIONAL_COPY_PRICE_PKR` | `250` |
| `GATE_MAX_PRINTS_PER_CODE` | `5` |
| `GATE_CODE_EXPIRY_HOURS` | `2` |
| `GATE_RATE_LIMIT_PER_MIN` | `30` |

Leave all set to **Production, Preview, Development** (default).

### 2.3 Deploy

Click **Deploy**. It will fail on this first attempt because there's no code in the repo yet — that's fine and expected. Vercel is now configured and waiting.

### 2.4 Grab your Vercel URL

Once deployed (even a failed deploy), Vercel shows a URL like:
```
https://lunaro-gate-abc123.vercel.app
```
Save this. This becomes `GATE_API_BASE_URL` for the Electron app.

**Vercel is done.** ✅

---

## Step 3: Local Dev on Mac (10 minutes)

### 3.1 Clone the repo

Open Terminal:
```bash
cd ~/Documents   # or wherever you keep code
git clone https://github.com/ShahnawazYasser/Lunaro-Gate.git
cd Lunaro-Gate
```

### 3.2 Add the planning files to the repo

Copy the files I gave you into the repo root:
```bash
cp ~/Downloads/lunaro-gate/LUNARO_GATE_SPEC.md ./
cp ~/Downloads/lunaro-gate/CLAUDE.md ./
mkdir -p db docs
cp ~/Downloads/lunaro-gate/schema.sql ./db/
cp ~/Downloads/lunaro-gate/SETUP_GUIDE.md ./docs/
cp ~/Downloads/lunaro-gate/CLAUDE_CODE_PROMPTS.md ./docs/
```
(Adjust paths depending on where you saved them.)

### 3.3 Add a .gitignore

Create `.gitignore` at repo root:
```
node_modules/
.next/
.env
.env.local
.env.*.local
dist/
out/
build/
release/
*.log
.DS_Store
.vscode/
.idea/
```

### 3.4 Commit + push

```bash
git add .
git commit -m "docs: initial planning artifacts and schema"
git push origin main
```

This will trigger a Vercel redeploy (still failing since no code yet — that's fine).

### 3.5 Open Claude Code in the repo

```bash
cd ~/Documents/Lunaro-Gate
claude
```

Claude Code is now positioned at the repo root, ready to receive prompts from `docs/CLAUDE_CODE_PROMPTS.md`.

**Mac is ready.** ✅

---

## Step 4: DSLRBooth Configuration (Windows booth laptop, 10 minutes)

### 4.1 Enable the API

1. Open DSLRBooth Professional
2. Click **Settings** (top right)
3. **General** tab → scroll to **API** section
4. Enable **API server**
5. Copy the **Password** shown. Save it. This is your `DSLRBOOTH_API_PASSWORD`.
6. Confirm the port shown is **1500** (default)

### 4.2 Configure the Lock Screen

1. Still in Settings → **Lock Screen** tab
2. Enable **Lock Screen**
3. Set a **PIN** (e.g. `1234` — this is DSLRBooth's own PIN, separate from your app)
4. Optional: set a lock screen background image (Lunaro logo works here)
5. Save

**Why:** the lock screen is DSLRBooth's own gate. When our Electron app crashes or the code is invalid, DSLRBooth stays locked. Only unlocked programmatically via our API call.

### 4.3 Configure print behavior

1. Settings → **Print** tab
2. **Auto-print after session:** enabled, **1 copy**
3. Save

**Why:** DSLRBooth auto-prints 1 copy. Our Electron app calls `/api/print?count=N-1` for extras after `session_end`.

### 4.4 Configure webhooks

1. Settings → **Triggers** tab (or **Webhooks**, name varies by version)
2. Find the **URL Trigger** section
3. Paste your Vercel URL with the webhook path:
   ```
   https://lunaro-gate-abc123.vercel.app/api/webhook?booth_id=default
   ```
   (Use YOUR actual Vercel URL from Step 2.4.)
4. Enable the following events:
   - ✅ Session Start
   - ✅ Printing
   - ✅ Session End
5. Save

### 4.5 Test the API

Open a browser on the booth laptop, paste this (replacing `YOUR_PASSWORD`):
```
http://localhost:1500/api/lockscreen/show?password=YOUR_PASSWORD
```

DSLRBooth should show its lock screen. Then:
```
http://localhost:1500/api/lockscreen/exit?password=YOUR_PASSWORD
```
Lock screen dismisses.

If both work, API is live. ✅

**DSLRBooth is configured.** ✅

---

## Step 5: Local Dev on Windows Booth Laptop (10 minutes)

### 5.1 Clone the repo

Open PowerShell:
```powershell
cd $HOME\Documents
git clone https://github.com/ShahnawazYasser/Lunaro-Gate.git
cd Lunaro-Gate
```

### 5.2 Open Claude Code

```powershell
claude
```

You'll run some prompts here (specifically the `booth/` prompts) later — the Windows machine is required to test Electron + DSLRBooth integration.

**Windows dev is ready.** ✅

---

## Step 6: Sanity Check Before Building

Confirm each of the following is true before moving to Claude Code prompts:

- [ ] Neon: `select 1 from public.codes` succeeds in Neon SQL Editor
- [ ] Neon connection strings saved in a text file (both pooled + unpooled)
- [ ] Vercel project imported, all env vars set
- [ ] Vercel URL known and saved
- [ ] GitHub repo `ShahnawazYasser/Lunaro-Gate` has the planning docs pushed
- [ ] DSLRBooth API password saved
- [ ] DSLRBooth lock screen PIN set
- [ ] DSLRBooth `/api/lockscreen/show` and `/exit` verified working
- [ ] DSLRBooth webhook URL configured with your Vercel URL
- [ ] Mac has Node 20+, Claude Code, and repo cloned
- [ ] Windows has Node 20+, Claude Code, and repo cloned

All ✅? Move to Step 7.

---

## Step 7: Run the Build

Open `docs/CLAUDE_CODE_PROMPTS.md`. Feed the prompts to Claude Code one at a time, in order. Confirm each prompt's expected behavior before moving to the next.

**Rule:** if a prompt fails or produces something wrong, stop, share the output with me in chat, and I'll debug. Don't push forward with broken code.

---

## Step 8: Windows Autostart (do this AFTER the app is built)

Once the Electron booth app is built and installed, configure Windows to launch it automatically:

### 8.1 Add Electron app to startup

1. Press `Win + R`, type `shell:startup`, hit Enter
2. Right-click in the folder → **New** → **Shortcut**
3. Location: full path to `Lunaro Gate.exe` (from wherever `electron-builder` installed it)
4. Name it `Lunaro Gate`

### 8.2 Add DSLRBooth to startup

Same process, pointing to `DSLRBooth.exe`.

### 8.3 Set launch order

Windows launches startup items roughly in parallel. To ensure DSLRBooth is up before Lunaro Gate tries to talk to it:

Option A (simple): add a delay in Electron code — on app startup, wait 15 seconds before first API call. Retry if DSLRBooth isn't ready.

Option B (better): use a small `.bat` file:
```batch
@echo off
start "" "C:\Program Files\dslrBooth\dslrBooth.exe"
timeout /t 20 /nobreak
start "" "C:\Users\%USERNAME%\AppData\Local\Programs\lunaro-gate\Lunaro Gate.exe"
```
Save as `startup.bat` in the startup folder instead of the shortcuts above.

### 8.4 Disable auto-updates

- Windows Update: Settings → Update → **Pause updates for 7 days** before every event
- DSLRBooth updates: Settings → About → **Disable auto-updates**

---

## Troubleshooting

### Neon connection fails from Vercel
Check the connection string is the **pooled** one (has `pooler` in the hostname). The unpooled one only works from long-lived processes.

### DSLRBooth API returns 401 / unauthorized
Wrong password. Re-copy from Settings → General → API. Password is case-sensitive.

### Vercel build fails with "Module not found"
Root directory setting is wrong. It should be `web`, not empty. Go to Vercel project → Settings → General → Root Directory → set to `web`.

### Electron app doesn't stay on top of DSLRBooth
On Windows 10/11, `alwaysOnTop: true` should work. If it doesn't, in the Electron main process add:
```typescript
mainWindow.setAlwaysOnTop(true, 'screen-saver');
```
This uses the highest z-order level.

### Webhook not firing from DSLRBooth to Vercel
- Confirm booth laptop has internet (`ping vercel.com` should work)
- Test Vercel webhook endpoint manually: `curl "https://your-url.vercel.app/api/webhook?event_type=test"` should return `{"ok":true}`
- Check DSLRBooth trigger URL is exactly right (no typos in the domain or query string)

---

## After Everything Works

- Test with a real customer flow at least 5 times before deploying
- Set up a WhatsApp group with the cafe staff so they can text you if the booth misbehaves
- Keep a printed cheat sheet at the till: "Trouble? Text Shahnawaz at [number]. Emergency: unlock booth with PIN [XXXX] on the DSLRBooth screen."

---

*End of setup guide. If any step breaks, don't skip — share the error and I'll debug.*
