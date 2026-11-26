# VAULT + DemoBank

**VAULT** is an approval-council API that protects payouts by checking the **destination account**, not every transaction. **DemoBank** is a minimal fake fintech front end that drives it.

> **VAULT never holds money. VAULT only says YES or NO.**
> This is a demo: no real SMS, no real bank, no BVN, no KYC.


| | |
|---|---|
| Live app | `https://vault-banking-gold.vercel.app/` |
| Live API | `https://vault-demo-m81n.onrender.com` |


> The API runs on Render's free tier and sleeps when idle. The first request after a pause can take up to about 50 seconds. Open `/health` once to wake it before a demo.

---

## How it works

Every user has **one locked Home Account** and a **council of 5 members**.

| Payout destination | VAULT's answer |
|---|---|
| The Home Account | **APPROVED instantly.** No council, 0 delay. |
| Any other (new) account | **BLOCKED.** Needs **3 council approvals + a 24 hour delay**. |
| A new account, and one council member rejects | **REJECTED forever.** It can never be reversed. |

A user never waits on their normal payouts. They only wait when money is going somewhere new, so a thief who gets into the account cannot redirect payouts without 3 council members and 24 hours.

```mermaid
flowchart TD
  A[Payout request] --> B{Destination is the Home Account?}
  B -- Yes --> C[APPROVED, 0 delay, no council]
  B -- No --> D[BLOCKED]
  D --> E{3 council approvals?}
  E -- No --> D
  E -- Yes --> F{24 hours passed?}
  F -- No --> D
  F -- Yes --> G[APPROVED]
  D -. any member rejects .-> H[REJECTED forever]
```

### Statuses

| Status | Reason | Meaning |
|---|---|---|
| `APPROVED` | `HOME_ACCOUNT` | Destination is the Home Account |
| `BLOCKED` | `NEED_APPROVALS` | New account, fewer than 3 approvals |
| `BLOCKED` | `WAITING_24H` | 3 approvals reached, 24 hour delay still running |
| `APPROVED` | `UNLOCKED` | 3 approvals and the 24 hour delay completed |
| `REJECTED` | `VETOED` | A council member rejected it. Final. |

---

## Tech stack

- **API:** Node.js, Express, MongoDB (Mongoose), JWT, bcrypt
- **Web:** Next.js (React), TypeScript, Tailwind, shadcn/ui
- **Tests:** Jest (rules engine)
- **Hosting:** Render (API), Vercel (web), MongoDB Atlas free tier (database)

## Project structure

```
vault-demo/
├── api/
│   ├── src/
│   │   ├── server.js              entry point, Mongo connection
│   │   ├── app.js                 Express app and route mounting
│   │   ├── rules/vaultRules.js    pure rules engine (no DB)
│   │   ├── models/                User, Council, Payout, DemoClock, ...
│   │   ├── controllers/           auth, vault (council), payout
│   │   ├── middleware/            user auth, council member auth, errors
│   │   ├── routes/                auth, vault, api, demo
│   │   ├── services/clock.js      demo clock (fake time, stored in the DB)
│   │   └── docs/openapi.js        Swagger definition for /docs
│   ├── tests/vaultRules.test.js
│   └── scripts/payout-flow.ps1    end-to-end test script (PowerShell)
└── web/                           Next.js demo UI
```

---

## Run it locally

**Requirements:** Node.js 20+ and a MongoDB Atlas connection string.

### 1. API

```bash
cd api
npm install
cp .env.example .env     # on Windows: copy .env.example .env
npm run dev
```

`api/.env`:

```
PORT=4000
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/vault-demo
JWT_SECRET=use-a-long-random-string
CLIENT_URL=http://localhost:3000
```

Variable names must match exactly. `MONGODB_URI` is the one people most often misspell. On success the terminal shows `MongoDB connected` and `API running on :4000`.

For several allowed web origins, separate them with commas: `CLIENT_URL=https://your-app.vercel.app,http://localhost:3000` (no trailing slashes).

### 2. Web

```bash
cd web
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev
```

Open http://localhost:3000.

### 3. Tests

```bash
cd api
npm test
```

The rules engine tests cover the Home Account check, the 3 approvals, the 24 hour delay, and rejection.

---

## API reference

All responses are JSON. Send `Content-Type: application/json` on POST requests. Errors look like `{ "error": "message" }` with a 400, 401, 403, 404 or 409 status.

Browsers only send GET requests from the address bar. To call the POST endpoints, use the `/docs` page, Postman, curl, or the demo UI.

### Two kinds of token

| Token | Where it comes from | Used for |
|---|---|---|
| **User token** | `POST /auth/signup` or `/auth/login` | Creating the council, `payout/check`, `audit` |
| **Council member token** | Returned per member by `POST /vault/create` | `payout/approve` only |

A user token is refused on `payout/approve` (403). Only a council member can approve or reject.

### Setup

**`POST /auth/signup`** and **`POST /auth/login`**

```json
{ "name": "Ada", "email": "ada@test.com", "password": "secret123" }
```

Returns `{ "token": "...", "user": { ... } }`. Login takes only `email` and `password`. Use the token as `Authorization: Bearer <token>`.

**`POST /vault/create`** (user token)

```json
{
  "members": ["Member 1", "Member 2", "Member 3", "Member 4", "Member 5"],
  "homeAccount": { "bank": "GTBank", "number": "0123456789", "name": "Ada Obi" }
}
```

Creates the 5 member council and locks the Home Account. The response includes the council `id` and each member's `id` and `token`. `GET /vault/council/mine` returns the same view later.

### Payout gate

**`POST /api/payout/check`** (user token)

```json
{
  "toAccount": { "bank": "OPay", "number": "9876543210", "name": "Chidi Unknown" },
  "amount": 200000
}
```

To the Home Account:

```json
{
  "payoutId": "6b0...",
  "accountType": "HOME",
  "status": "APPROVED",
  "reason": "HOME_ACCOUNT",
  "approvalsRequired": 0,
  "approvalsReceived": 0,
  "progress": null,
  "delayHours": 0,
  "hoursRemaining": 0
}
```

To any other account:

```json
{
  "payoutId": "6b0...",
  "accountType": "NEW",
  "status": "BLOCKED",
  "reason": "NEED_APPROVALS",
  "approvalsRequired": 3,
  "approvalsReceived": 0,
  "progress": "0 of 3",
  "delayHours": 24,
  "hoursRemaining": 24
}
```

**`POST /api/payout/approve`** (council member token only)

```json
{ "payoutId": "6b0...", "decision": "APPROVE", "channel": "sms" }
```

- `decision` is `APPROVE` or `REJECT`.
- `channel` is free text (for example `app`, `sms`, `email`, `whatsapp`). It defaults to `api`.
- Progress counts up as `1 of 3`, `2 of 3`, `3 of 3`. After 3 approvals the payout stays `BLOCKED` (`WAITING_24H`) until the 24 hours pass.
- One `REJECT` makes the payout `REJECTED` permanently. A reject is still accepted during the 24 hour wait.
- A member can vote once per payout (409 if they repeat).
- A payout that is already `APPROVED` or `REJECTED` returns 409.

**`GET /api/audit/:payoutId`** (user token or council member token)

Returns the payout plus its full history:

```json
{
  "status": "APPROVED",
  "progress": "3 of 3",
  "history": [
    { "event": "PAYOUT_CHECKED",  "name": "VAULT",    "channel": "api",    "detail": "Destination is a NEW account. Blocked: ...", "at": "..." },
    { "event": "MEMBER_APPROVED", "name": "Member 1", "channel": "sms",    "detail": "Approval 1 of 3", "memberId": "...", "at": "..." },
    { "event": "MEMBER_APPROVED", "name": "Member 2", "channel": "email",  "detail": "Approval 2 of 3", "at": "..." },
    { "event": "MEMBER_APPROVED", "name": "Member 3", "channel": "app",    "detail": "Approval 3 of 3", "at": "..." },
    { "event": "PAYOUT_APPROVED", "name": "VAULT",    "channel": "system", "detail": "3 approvals received and 24h delay completed", "at": "..." }
  ]
}
```

`at` is demo clock time, which the 24 hour logic uses. `realAt` is real wall clock time.

### Demo clock (testing only)

Nobody can wait 24 real hours, so the API has a fake clock stored in the database.

| Endpoint | Body | Effect |
|---|---|---|
| `POST /demo/advance` | `{ "hours": 1 }` or `{ "hours": 24 }` | Moves fake time forward ("Simulate 1 Hour Passed") |
| `POST /demo/set-time` | `{ "time": "02:14" }` | Sets the fake clock to that Lagos time today |
| `GET /demo/clock` | | Current fake time |
| `POST /demo/reset` (user token) | | Deletes your council and payouts, resets balance and clock |

The clock is shared by everyone on the same deployment. These routes are unauthenticated apart from `reset`, so keep them to demo environments.

---

## Try it in the browser

1. Open the live app, sign up, and create the council (the Ada Obi / GTBank defaults are pre-filled).
2. **Send payout to Home Account** gives a green `Status: APPROVED` with 0 delay.
3. **Set clock to 2:14 AM**, then **Send payout to this account** (Chidi Unknown, OPay) gives a red `Status: BLOCKED`, `Approvals: 0/3`.
4. Pick Member 1, a channel, and press **Approve**. Repeat for Members 2 and 3. The counter goes `1/3`, `2/3`, `3/3`, then shows "Waiting for the 24-hour delay".
5. Press **+24h** (or **Simulate 1 Hour Passed** 24 times). The status becomes `APPROVED`.
6. Read the **audit trail**: who approved, when, and through which channel.
7. Send another payout to the new account, approve as Member 1, then **Reject** as Member 2. The status is `REJECTED` and cannot be undone.

Or use the Swagger page at `/docs`: it has pre-filled example requests with an Authorize button for the two token types.

### Scripted end-to-end test (PowerShell)

```powershell
cd api
powershell -ExecutionPolicy Bypass -File .\scripts\payout-flow.ps1
```

The script resets the demo, creates a council, then runs the Home Account check, the new account check, the approvals (including duplicate vote, wrong token and extra approval errors), the 24 hour advance, the audit, and a rejection. Edit the `$api` line at the top to target the live API.

---

## Deployment

| Part | Where | Settings |
|---|---|---|
| Database | MongoDB Atlas (M0 free) | Network access must allow `0.0.0.0/0` because Render has no fixed IP |
| API | Render web service | Root Directory `api`, Build `npm install`, Start `npm start`, env vars `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` |
| Web | Vercel | Root Directory `web`, env var `NEXT_PUBLIC_API_URL` set to the Render URL |

`CLIENT_URL` on Render must include the Vercel URL, otherwise the browser blocks the calls (CORS).

---

## Design notes

- **The rules engine is a pure function** (`api/src/rules/vaultRules.js`). It has no database or Express dependency, which is why it is unit tested directly.
- **Evaluation is lazy.** Every read or vote re-checks the rules against the demo clock, so there is no background job.
- **The clock lives in the database,** so a server restart does not reset it mid-demo.
- **The 24 hour delay starts when the payout is checked.**
- **VAULT stores decisions, not money.** The API returns YES or NO and an audit trail. Moving funds is the fintech's job.

## Out of scope (for now)

- Real SMS, email or WhatsApp delivery (`channel` is only recorded)
- Real banks, BVN or KYC
- Per-check pricing (planned: 100 Naira per check above 50k)
- Final DemoBank design (logo, gold and black dashboard), balance and withdraw wiring

## License

Private demo project. All rights reserved.