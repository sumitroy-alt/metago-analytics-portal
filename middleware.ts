import { NextRequest, NextResponse } from 'next/server';

// Lightweight gate: anything not public and without a session cookie is sent to
// login. Full cryptographic verification happens in getUser() (Node runtime),
// since the JWKS verifier can't run on the Edge middleware runtime.
const PUBLIC = [/^\/api\/auth\//, /^\/_next\//, /^\/favicon/, /^\/robots/, /^\/assets\//];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const hasSession = req.cookies.has('mg_at');
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/api/auth/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
