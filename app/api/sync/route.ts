import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getAccess } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Sync now" → triggers the data-refresh GitHub Action (workflow_dispatch), which
 * re-reads the sheets, regenerates data.js and commits it, so Vercel redeploys with
 * fresh numbers (~1–2 min). Needs env:
 *   GITHUB_TOKEN  – a PAT with `workflow` scope (repo access)
 *   GITHUB_REPO   – "owner/name" (defaults below)
 */
const REPO = process.env.GITHUB_REPO || 'sumitroy-alt/metago-analytics-portal';
const WORKFLOW = 'refresh-data.yml';

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const acc = getAccess(user.email);
  if (!acc || acc.status !== 'active') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not configured — set it to enable on-demand sync.' },
      { status: 501 },
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  );

  if (res.status === 204) return NextResponse.json({ queued: true });
  const text = await res.text();
  return NextResponse.json({ error: `dispatch failed (${res.status}): ${text}` }, { status: 502 });
}
