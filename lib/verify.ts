import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { JWKS_URL, ISSUER, CLIENT_ID } from './oidc';

/**
 * Verifies a MetaGo Central Auth access token against the published JWKS.
 * Faithful re-implementation of `@metago-health/auth-node`'s `createTokenVerifier`
 * using `jose` (so there is no private-registry dependency for the build):
 *   - RS256 only, keys fetched from JWKS_URL and cached (handles rotation)
 *   - enforces issuer + audience (this app's client id) + expiry
 *   - requires typ === "access"
 * Swap back to the official SDK by importing `createTokenVerifier` and pointing it
 * at the same issuer/audience — the returned shape is identical.
 */
export interface MetagoUser {
  id: string;
  email: string;
  role: string;
  client: string;
}

const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export async function verifyAccessToken(token: string): Promise<MetagoUser> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: CLIENT_ID,
    algorithms: ['RS256'],
  });
  if (payload['typ'] !== 'access') {
    throw new Error('not an access token');
  }
  const aud = payload.aud;
  return {
    id: String(payload.sub || ''),
    email: String(payload['email'] || ''),
    role: String(payload['role'] || 'user'),
    client: String(Array.isArray(aud) ? aud[0] : aud || ''),
  };
}
