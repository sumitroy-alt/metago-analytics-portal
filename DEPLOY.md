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

## Before real production traffic

- Swap the in-memory store in `lib/users.ts` for **Vercel Postgres/KV** (it resets per deploy).
- Wire the User-Management panel to `/api/users`.
- Add `refresh_token` rotation.
