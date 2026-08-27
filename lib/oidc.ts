import crypto from 'crypto';

// MetaGo Central Auth — endpoints derived from the issuer.
// Confirmed live at https://one.metago.health/.well-known/openid-configuration :
//   authorization_endpoint /oauth/authorize · token_endpoint /oauth/token
//   response_types: code · grant_types: authorization_code, refresh_token · PKCE: S256
export const ISSUER = process.env.OIDC_ISSUER || 'https://one.metago.health';
export const CLIENT_ID = process.env.OIDC_CLIENT_ID || '';
export const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
export const SCOPE = process.env.OIDC_SCOPE || 'openid profile email';
export const APP_URL = process.env.APP_URL || 'http://localhost:3000';
export const REDIRECT_URI = `${APP_URL}/api/auth/callback`;

export const AUTHORIZE_URL = `${ISSUER}/oauth/authorize`;
export const TOKEN_URL = `${ISSUER}/oauth/token`;
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function makePkce() {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function randomState() {
  return b64url(crypto.randomBytes(24));
}

export function authorizeUrl(state: string, challenge: string) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenSet> {
  // Public (PKCE) client: no secret. Confidential client: send it.
  if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`token endpoint ${res.status}: ${t}`);
  }
  return res.json();
}

export function exchangeCode(code: string, codeVerifier: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  );
}

export function refresh(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  );
}
