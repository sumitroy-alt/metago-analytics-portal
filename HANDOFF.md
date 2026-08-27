# MetaGo Analytics Portal — Handoff for the tech team

This repo is a **complete, ready-to-deploy** app. It puts MetaGo's five internal
dashboards (LTV, Weight Loss, Sales & Prescription, FE Tracker, Engagement &
Retention) behind company SSO login, with per-user access control and an
auto-refresh that keeps the numbers in step with the source Google Sheets.

The code is done. What's left is **configuration you run once**: deploy it, plug in a
few credentials, and share the sheets with a read-only robot account. This document
is the process. Choose whatever host and tooling you prefer — it's a standard
Next.js 15 (App Router) app with no exotic requirements.

---

## Who does what

| Step | Owner | Effort |
| --- | --- | --- |
| 1. Deploy the app to a host | **Tech team** | standard Next.js deploy |
| 2. Register the app with MetaGo Central Auth (for login) | **Tech team** + auth team | one request |
| 3. Create the Google "reader" service account | **Tech team** | ~5 min |
| 4. **Share the 5 sheets with the reader account** | **Sumit** (sheet owners) | ~2 min |
| 5. Add the secrets, then switch on auto-refresh | **Tech team** | ~5 min |

Only **step 4** needs Sumit — everything else is the tech team's. The reason: only
someone who can share those specific sheets can grant the robot access. (Note: the
**FE Tracker** sheet is owned by `musa.shaikh@ketto.org`, so that one needs Musa or
someone with share rights on it.)

---

## The stack (what you're deploying)

| Layer | What |
| --- | --- |
| App | **Next.js 15** (App Router). Runs on any Next.js host. |
| Login | **MetaGo Central Auth** — OAuth 2.0 **Authorization Code + PKCE** against `one.metago.health` |
| Token check | **JWKS** verification with `jose` (RS256; checks `iss`, `aud`, `typ:access`) — no shared secret |
| Dashboards | Prebuilt UI at `app/portal/portal.html`; data injected at request time from `app/portal/data.js` |
| Access control | Per-user role + dashboard + download grants (`lib/users.ts`) |
| Live data | GitHub Action pulls the sheets hourly → regenerates `data.js` → redeploy shows fresh numbers |

---

## Step 1 — Deploy

Standard Next.js build (`npm install`, `npm run build`, `npm start`, or your host's
Git integration). The app **builds and runs without any credentials** — it's fully
login-gated, so nothing is exposed before the auth step below. It just can't sign
anyone in yet. Set the environment variables from **`.env.example`** in your host's
settings.

## Step 2 — Register the app for login (with the MetaGo auth team)

Ask whoever runs **MetaGo Central Auth** (`metago-auth`) to register this app as a
client, and get back:

1. a **client id** → set as `OIDC_CLIENT_ID`
2. the **redirect URI whitelisted**: `${APP_URL}/api/auth/callback`

Also confirm: the **login scope** (discovery advertises `mcp`, the machine scope — a
browser user-login usually wants `openid profile email`), and whether the client is
**public (PKCE)** (no secret) or **confidential** (set `OIDC_CLIENT_SECRET`).

**Environment variables** (full list in `.env.example`):

| Variable | Value | Needed for |
| --- | --- | --- |
| `APP_URL` | The deployed URL | always |
| `OIDC_CLIENT_ID` | Client id from MetaGo Central Auth | login |
| `SESSION_SECRET` | 32+ char random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | login |
| `BOOTSTRAP_ADMINS` | Comma-separated admin emails (e.g. `sumit.roy@ketto.org`) | recommended |
| `ALLOWED_EMAIL_DOMAIN` | `metago.health` | recommended |
| `OIDC_CLIENT_SECRET` | Only if registered confidential | optional |

## Steps 3–5 — Turn on live data

The dashboard numbers live in `app/portal/data.js`, which is **regenerated from the
sheets** by the GitHub Action `.github/workflows/refresh-data.yml` (runs **hourly** +
on demand). Flow:

```
hourly → reads the 5 sheets with a Google service account
       → runs scripts/refresh_data.py → rewrites data.js
       → commits it → host redeploys with fresh numbers
```

**Step 3 — Create the reader (service account):** In **Google Cloud Console**, create
a **service account**, enable the **Google Drive API** on that project, and download
its **JSON key**. This account is read-only and only ever sees sheets you explicitly
share with it. It has an email like `…@….iam.gserviceaccount.com`.

**Step 4 — Share the sheets (Sumit):** Give that email **Viewer** access on all five
sheets — Weight, Sales, FE Tracker, Engagement & Retention, and LTV. (Same "Share"
button as sharing with a colleague.) Sheet IDs are listed in `scripts/refresh_data.py`.

**Step 5 — Add secrets and run it once:**
1. **GitHub → repo → Settings → Secrets and variables → Actions** → add secret
   **`GOOGLE_SERVICE_ACCOUNT_JSON`** = the full JSON key from step 3.
2. **Actions → "Refresh dashboard data" → Run workflow** to test it. After that it
   runs hourly on its own.
3. *(Optional)* For the in-app **Sync now** button, set **`GITHUB_TOKEN`** (a token
   with `workflow` scope) in the app's env. Without it, hourly refresh still works;
   the button just won't trigger an on-demand refresh.

---

## How "Sync" behaves (so there's no confusion)

- **Direction: it PULLS** the current contents of the sheets *into* the dashboard.
  It does **not** push anything into the sheets or force the sheets to recalculate.
- **Not instant / not a live wire:** a sheet edit shows up on the dashboard at the
  **next refresh** — automatically within the hour, or in ~1–2 min if someone clicks
  **Sync now**.
- **Per-dashboard buttons, one shared engine:** each dashboard shows its own Sync
  button, but today one refresh job re-pulls all five together (kept consistent).
- **Change the cadence:** edit the `cron` in `.github/workflows/refresh-data.yml`
  (`0 * * * *` = hourly; `*/15 * * * *` = every 15 min, etc.).

---

## Before heavy production traffic (nice-to-haves, not blockers)

- Swap the in-memory user store in `lib/users.ts` for a real DB (Postgres/KV) — it
  currently resets on each deploy and isn't shared across instances.
- Wire the in-portal User-Management panel to the existing `/api/users` endpoints
  (today the panel edits a browser-local list).
- Add `refresh_token` rotation (today an expired token just re-triggers a silent login).

---

## Repo location

Currently at **`github.com/sumitroy-alt/metago-analytics-portal`** (personal account).
To move it under the **Metago-health** org, an org member needs to either add
`sumitroy-alt` to the org, or create the repo in the org and push this code there — a
transfer from a non-member account is blocked by GitHub.
