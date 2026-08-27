import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authorizeUrl, makePkce, randomState, CLIENT_ID } from '@/lib/oidc';

export const runtime = 'nodejs';

// Kick off the OAuth Authorization Code + PKCE flow against MetaGo Central Auth.
export async function GET() {
  if (!CLIENT_ID) {
    return new NextResponse(
      'OIDC_CLIENT_ID is not set. Register this app with MetaGo Central Auth and set it in the environment.',
      { status: 500 },
    );
  }
  const { verifier, challenge } = makePkce();
  const state = randomState();

  const url = authorizeUrl(state, challenge);
  const res = NextResponse.redirect(url);

  const secure = process.env.NODE_ENV === 'production';
  const opts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  const jar = await cookies();
  jar.set('mg_pkce', verifier, opts);
  jar.set('mg_state', state, opts);
  return res;
}
