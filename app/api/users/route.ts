import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getAccess, listUsers, updateUser, deleteUser } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getUser();
  if (!user) return null;
  const acc = getAccess(user.email);
  return acc && acc.role === 'admin' && acc.status === 'active' ? acc : null;
}

// List all users (admin only) — backs the User Management panel.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ users: listUsers() });
}

// Update a user (role / status / dashboards / download). Body: { email, patch }.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { email, patch } = await req.json();
  const rec = updateUser(email, patch);
  return rec ? NextResponse.json({ user: rec }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

// Remove a user. Body: { email }.
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { email } = await req.json();
  deleteUser(email);
  return NextResponse.json({ ok: true });
}
