# MetaGo Analytics Portal

Next.js app that puts the five internal dashboards (LTV, Weight Loss, Sales &
Prescription, FE Tracker, Engagement & Retention) behind **MetaGo Central Auth**
(Google SSO), with per-user dashboard + download access and a user-management panel.

**→ [One-click deploy + stakeholder guide: `DEPLOY.md`](./DEPLOY.md)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsumitroy-alt%2Fmetago-analytics-portal&env=OIDC_CLIENT_ID,APP_URL,BOOTSTRAP_ADMINS,ALLOWED_EMAIL_DOMAIN&envDescription=MetaGo%20Central%20Auth%20client%20id%20plus%20app%20config&envLink=https%3A%2F%2Fgithub.com%2Fsumitroy-alt%2Fmetago-analytics-portal%2Fblob%2Fmain%2FDEPLOY.md&project-name=metago-analytics-portal&repository-name=metago-analytics-portal)

The whole dashboard UI (the artifact we built) is reused verbatim at
`app/portal/portal.html`; this project wraps it in real authentication.

---

## How auth works

Login is the standard **OAuth 2.0 Authorization Code + PKCE** flow against MetaGo
Central Auth (`https://one.metago.health`), and tokens are verified with the
official `@metago-health/auth-node` SDK (JWKS-based, `aud`-checked — no shared
secret).

```
Browser → /api/auth/login → one.metago.health/oauth/authorize  (Google behind it)
        ← redirect back →  /api/auth/callback  (?code)
        callback: exchange code → verify access_token (SDK) → set httpOnly cookie
        → /portal   (dashboard bundle served with the verified user injected)
```

- `lib/oidc.ts` — endpoints, PKCE, code/refresh exchange
- `lib/auth.ts` — `getUser()` verifies the session cookie via the SDK → `{ id, email, role, client }`
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

> **Note on the SDK:** `@metago-health/auth-node` is a MetaGo package. If it lives on a
> private registry (GitHub Packages / private npm), add an `.npmrc` with your registry +
> auth token before `npm install`, and set the exact version in `package.json` (the
> `^1.0.0` here is a placeholder — confirm with the auth team).

---

## Deploy to Vercel

1. Push this folder to a Git repo and **Import Project** in Vercel.
2. Set the env vars from `.env.example` in **Project → Settings → Environment Variables**
   (`APP_URL` = your Vercel URL, e.g. `https://analytics.metago.health`).
3. Add that URL's `/api/auth/callback` to the client's whitelisted redirect URIs.
4. Deploy.

---

## What's done vs. next

**Done (this scaffold)**
- Real MetaGo SSO login (Auth Code + PKCE) + SDK token verification.
- Route protection; real identity injected into the portal; real sign-out.
- All five dashboards, downloads, and the sync control (UI) carried over unchanged.
- Per-user access model + admin API (`/api/users`).

**Next (before go-live)**
- **Swap the user store** in `lib/users.ts` from in-memory to **Vercel Postgres/KV**
  (it currently resets per deploy and isn't shared across instances).
- **Wire the User-Management panel** in the portal to the `/api/users` endpoints
  (today it still edits a browser-local list from the prototype).
- **refresh_token** rotation in a route handler (today an expired access token just
  bounces the user through a silent re-login).
- **Sync button → sheet refresh** (held per your call): a small `doPost` on each
  sheet's Apps Script + a Vercel route that triggers it.
