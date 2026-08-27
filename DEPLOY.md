# Deploy the MetaGo Analytics Portal

A self-contained deploy guide you can hand to a stakeholder. One click stands up
their own copy on Vercel.

## The stack

| Layer | What |
| --- | --- |
| App | **Next.js 15** (App Router) on **Vercel** |
| Login | **MetaGo Central Auth** — OAuth 2.0 **Authorization Code + PKCE** against `one.metago.health` (Google behind it) |
| Token check | **JWKS** verification with `jose` (RS256, `iss`, `aud`, `typ:access`) — no shared secret |
| Data | The five dashboards (bundled UI), served only to a signed-in, authorised user |
| Access control | Per-user role + dashboard + download grants (`lib/users.ts`) |

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsumitroy-alt%2Fmetago-analytics-portal&env=OIDC_CLIENT_ID,APP_URL,BOOTSTRAP_ADMINS,ALLOWED_EMAIL_DOMAIN&envDescription=MetaGo%20Central%20Auth%20client%20id%20plus%20app%20config&envLink=https%3A%2F%2Fgithub.com%2Fsumitroy-alt%2Fmetago-analytics-portal%2Fblob%2Fmain%2FDEPLOY.md&project-name=metago-analytics-portal&repository-name=metago-analytics-portal)

> The repo is **private** (it contains real dashboard data). To use the button, the
> person deploying needs read access to the repo — add them as a GitHub collaborator,
> or share the source zip.

## Or import manually

1. **https://vercel.com/new** → select your team.
2. Import the repo (if it isn't listed, click **Adjust GitHub App Permissions** and grant it).
3. Add the environment variables below.
4. **Deploy.**

## Environment variables

| Variable | Value | Needed |
| --- | --- | --- |
| `APP_URL` | The URL Vercel assigns (e.g. `https://<name>.vercel.app`) | yes |
| `OIDC_CLIENT_ID` | This app's client id from **MetaGo Central Auth** (see prerequisite) | for login |
| `BOOTSTRAP_ADMINS` | Comma-separated admin emails, e.g. `sumit.roy@ketto.org` | recommended |
| `ALLOWED_EMAIL_DOMAIN` | `metago.health` | recommended |
| `OIDC_CLIENT_SECRET` | Only if registered as a *confidential* client | optional |
| `OIDC_SCOPE` | `openid profile email` (confirm with auth team) | optional |

The app **builds and deploys without `OIDC_CLIENT_ID`** — it's safely login-gated, so
no data is exposed. It simply can't sign anyone in until the prerequisite below is done.

## Prerequisite — one-time, with the MetaGo auth team

Register this app as a **client** of MetaGo Central Auth (`metago-auth`) and get:
1. a **client id** → set as `OIDC_CLIENT_ID`, and
2. the **redirect URI whitelisted**: `${APP_URL}/api/auth/callback`.

Also confirm the **login scope** and whether the client is **public (PKCE)** or
**confidential**. No Google OAuth client and no shared secret are needed.

## Post-deploy checklist

- [ ] Set `APP_URL` to the real deployed URL, then redeploy.
- [ ] `OIDC_CLIENT_ID` set and its `${APP_URL}/api/auth/callback` whitelisted.
- [ ] Open the URL → you're bounced to MetaGo login → back in → dashboards load.
- [ ] First admin (from `BOOTSTRAP_ADMINS`) opens **User management** (👥) and grants access.

## Live data refresh (auto-updating dashboards)

The dashboard numbers come from `app/portal/data.js`, which is **regenerated from the
live sheets** by a GitHub Action — so the dashboards track the sheets without any UI
changes.

**How it flows:** `refresh-data.yml` (hourly + on-demand) → reads the sheets with a
Google **service account** → runs `scripts/refresh_data.py` → rewrites `data.js` →
commits it → **Vercel auto-redeploys** with fresh numbers.

**One-time setup:**
1. In **Google Cloud**, create a **service account** and download its **JSON key**.
   Enable the **Google Drive API** on that project.
2. **Share each of the 4 sheets** (View access) with the service account's email
   (`…@….iam.gserviceaccount.com`): Weight, Sales, FE Tracker, Engagement & Retention.
3. In **GitHub → repo → Settings → Secrets and variables → Actions**, add a secret
   **`GOOGLE_SERVICE_ACCOUNT_JSON`** = the full JSON key.
4. Run it once: **Actions → "Refresh dashboard data" → Run workflow** (then it runs hourly).

**Cadence:** hourly by default (edit the `cron` in `.github/workflows/refresh-data.yml`);
pairs naturally with the sheets' own ~9am sync. The **Sync button** in the UI can later
trigger this on demand.

> LTV Opportunity data is still embedded in the UI (its parser is a follow-up); the other
> four dashboards are live via this pipeline.

## Before real production traffic

- Swap the in-memory store in `lib/users.ts` for **Vercel Postgres/KV** (it resets per deploy).
- Wire the User-Management panel to `/api/users`.
- Add `refresh_token` rotation.
- Add the LTV parser to `scripts/refresh_data.py` so LTV is live too.
