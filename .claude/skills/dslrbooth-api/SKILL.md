---
name: dslrbooth-api
description: DSLRBooth HTTP API endpoints and webhook event reference for Lunaro Gate. Use when writing or debugging code that calls DSLRBooth or handles its webhooks.
---

# DSLRBooth API Cheat Sheet

All endpoints are `GET`. Always append `&password=$DSLRBOOTH_API_PASSWORD`.

| Endpoint | Purpose |
|---|---|
| `/api/start?mode=print` | Start a Print session. Requires DSLRBooth on its start screen. |
| `/api/print?count=N` | Reprint last session's image N times. |
| `/api/lockscreen/show` | Show DSLRBooth lock screen (requires PIN set in DSLRBooth). |
| `/api/lockscreen/exit` | Dismiss the lock screen. |

## DSLRBooth webhook events (fired to our `/api/webhook`)

| event_type | Params | Action in our system |
|---|---|---|
| `session_start` | `param1 = mode` | Transition claimed code → `in_session` |
| `printing` | `param1 = file`, `param2 = num_copies`, `param3 = printer` | Increment `prints_completed` by `param2` |
| `session_end` | — | Transition in_session code → `used` |

Always respond `200 OK { ok: true }`. Never make DSLRBooth retry.
