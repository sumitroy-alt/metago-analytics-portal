# MetaGo Analytics Portal

Next.js app that puts the five internal dashboards (LTV, Weight Loss, Sales &
Prescription, FE Tracker, Engagement & Retention) behind **MetaGo Central Auth**
(Google SSO), with per-user dashboard + download access and a user-management panel.

**→ Tech team: start with [`HANDOFF.md`](./HANDOFF.md)** — what to deploy, which
credentials to plug in, and who does what. [`DEPLOY.md`](./DEPLOY.md) has the finer
detail.

The whole dashboard UI (the artifact we built) is reused verbatim at
`app/portal/portal.html`; this project wraps it in real authentication.

---

## How auth works

Login is the standard **OAuth 2.0 Authorization Code + PKCE** flow against MetaGo
Central Auth (`https://one.metago.health`), and tokens are verified against the
auth service's public **JWKS** using the `jose` library (RS256, `iss`/`aud`/`typ`
checked — no shared secret). `jose` is the same primitive MetaGo's own auth SDK uses;
we call it directly so the app has no dependency on a private npm package.

```
Browser → /api/auth/login → one.metago.health/oauth/authorize  (Google behind it)
        ← redirect back →  /api/auth/callback  (?code)
        callback: exchange code → verify access_token (SDK) → set httpOnly cookie
        → /portal   (dashboard bundle served with the verified user injected)
```

- `lib/oidc.ts` — endpoints, PKCE, code/refresh exchange
- `lib/verify.ts` — `verifyAccessToken()` checks the token against the JWKS via `jose`
- `lib/auth.ts` — `getUser()` verifies the session cookie → `{ id, email, role, client }`
- `middleware.ts` — sends unauthenticated requests to `/api/auth/login`
- `app/portal/route.ts` — gates + serves the portal with `window.__ME__` (identity + access) injected
- `app/portal/integration.js` — bridges the portal UI to that real identity (real sign-out, access-filtered cards)
- `lib/users.ts` — per-app access store (roles, dashboards, download, approval)
- `app/api/users/route.ts` — admin API behind the user-management panel

---

## One-time setup with your auth team

Register **this app as a client** of MetaGo Central Auth (`metago-auth`) and get:

1. a **client id** → set as `OIDC_CLIENT_ID` (this is also the token `aud` we verify), and
2. our **redirect URI whitelisted**: `${APP_URL}/api/auth/callback`
   (e.g. `http://localhost:3000/api/auth/callback` for dev, and the Vercel URL for prod).

Also confirm two things:
- the **scope** for a browser user-login (discovery advertises `mcp`, which is the
  machine/connector scope — a user login usually wants `openid profile email`), and
- whether we're a **public (PKCE)** client (no secret) or **confidential** (set `OIDC_CLIENT_SECRET`).

No Google OAuth client and no shared signing secret are needed — trust flows from
the auth service's public JWKS.

---

## Run locally

```bash
cp .env.example .env.local     # then fill in OIDC_CLIENT_ID + SESSION_SECRET
npm install
npm run dev                    # http://localhost:3000
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`BOOTSTRAP_ADMINS` (comma-separated emails) become admins on first login; everyone
else lands as **pending** with no dashboards until an admin grants access.

All dependencies are public npm packages — a plain `npm install` works, no private
registry or `.npmrc` needed.

---

## Deploy

Standard Next.js app — deploy on any Next.js host. Set the env vars from
`.env.example`, and whitelist `${APP_URL}/api/auth/callback` with the auth team.
Full step-by-step (including live-data setup) is in [`HANDOFF.md`](./HANDOFF.md).

---

## What's done vs. next

**Done**
- Real MetaGo SSO login (Auth Code + PKCE) + JWKS token verification (`jose`).
- Route protection; real identity injected into the portal; real sign-out.
- **All five dashboards live** — data pulled from the sheets by an hourly GitHub
  Action (`scripts/refresh_data.py`), including LTV.
- **Sync button wired** (`app/api/sync`) → triggers the refresh job on demand.
- Per-user access model + admin API (`/api/users`).

**Next (config, not code — see [`HANDOFF.md`](./HANDOFF.md))**
- Register the app with MetaGo Central Auth (`OIDC_CLIENT_ID` + redirect whitelist).
- Add the Google service-account key so the hourly refresh can read the sheets.
- Set `GITHUB_TOKEN` if you want the in-app Sync button to trigger refreshes.

**Nice-to-haves before heavy traffic**
- Swap the in-memory user store in `lib/users.ts` for a real DB (resets per deploy).
- Wire the in-portal User-Management panel to `/api/users` (today it's browser-local).
- Add `refresh_token` rotation (today an expired token re-triggers a silent login).
