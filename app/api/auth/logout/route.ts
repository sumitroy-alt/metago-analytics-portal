import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { APP_URL } from '@/lib/oidc';
import { AT_COOKIE, RT_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const jar = await cookies();
  jar.delete(AT_COOKIE);
  jar.delete(RT_COOKIE);
  // MetaGo Central Auth discovery exposes no end_session_endpoint, so we clear the
  // local session and return home. (Add a redirect to an auth logout URL here if one exists.)
  return NextResponse.redirect(APP_URL);
}
