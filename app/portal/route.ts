import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getUser } from '@/lib/auth';
import { getAccess, ensureUser, allowedDashboards } from '@/lib/users';
import { APP_URL } from '@/lib/oidc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The portal UI (the full dashboard bundle we built) + the auth-integration shim,
// wrapped into one HTML document. Read from disk once.
let TEMPLATE: string | null = null;
function template(): string {
  if (TEMPLATE) return TEMPLATE;
  const dir = path.join(process.cwd(), 'app', 'portal');
  const portal = fs.readFileSync(path.join(dir, 'portal.html'), 'utf8');
  const integ = fs.readFileSync(path.join(dir, 'integration.js'), 'utf8');
  TEMPLATE =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>MetaGo Analytics Portal</title>__ME__</head><body>' +
    portal +
    '\n<script>' +
    integ +
    '</script></body></html>';
  return TEMPLATE;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/api/auth/login`);

  const acc = getAccess(user.email) || ensureUser(user.email, (user as any).name || user.email, user.role);
  const me = {
    email: user.email,
    name: (user as any).name || user.email.split('@')[0],
    role: acc.role,
    status: acc.status,
    dashboards: allowedDashboards(acc),
    download: acc.role === 'admin' ? true : acc.download,
  };

  const page = template().replace('__ME__', `<script>window.__ME__=${JSON.stringify(me)};</script>`);
  return new NextResponse(page, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
