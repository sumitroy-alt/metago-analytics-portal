import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, APP_URL } from '@/lib/oidc';
import { verifyAccessToken, type MetagoUser } from '@/lib/verify';
import { ensureUser } from '@/lib/users';
import { AT_COOKIE, RT_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').toLowerCase();

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const jar = await cookies();

  if (err) return fail(`Auth service returned: ${err}`);
  if (!code || !state) return fail('Missing code or state.');
  if (state !== jar.get('mg_state')?.value) return fail('State mismatch — please try again.');

  const verifier = jar.get('mg_pkce')?.value;
  if (!verifier) return fail('Missing PKCE verifier — please try again.');

  let tokens;
  try {
    tokens = await exchangeCode(code, verifier);
  } catch (e: any) {
    return fail(`Token exchange failed: ${e?.message || e}`);
  }

  let user: MetagoUser;
  try {
    user = await verifyAccessToken(tokens.access_token);
  } catch (e: any) {
    return fail(`Token verification failed: ${e?.message || e}`);
  }

  if (domain && !user.email.toLowerCase().endsWith('@' + domain)) {
    return fail(`Sign-in restricted to @${domain} accounts.`);
  }

  // Record the user in the app access store (first-timers land as "pending").
  ensureUser(user.email, (user as any).name || user.email, user.role);

  const secure = process.env.NODE_ENV === 'production';
  const res = NextResponse.redirect(`${APP_URL}/portal`);
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  const jar2 = await cookies();
  jar2.set(AT_COOKIE, tokens.access_token, { ...base, maxAge: tokens.expires_in || 3600 });
  if (tokens.refresh_token) jar2.set(RT_COOKIE, tokens.refresh_token, { ...base, maxAge: 60 * 60 * 24 * 30 });
  jar2.delete('mg_pkce');
  jar2.delete('mg_state');
  return res;
}

function fail(msg: string) {
  return new NextResponse(
    `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;padding:40px;color:#16211f">
     <h2>Sign-in problem</h2><p>${msg}</p><p><a href="/api/auth/login">Try again</a></p></body>`,
    { status: 400, headers: { 'content-type': 'text/html' } },
  );
}
