import 'server-only';
import { cookies } from 'next/headers';
import { verifyAccessToken, type MetagoUser } from './verify';

export const AT_COOKIE = 'mg_at';
export const RT_COOKIE = 'mg_rt';

/** The verified caller, or null if not signed in / token expired. */
export async function getUser(): Promise<MetagoUser | null> {
  const store = await cookies();
  const at = store.get(AT_COOKIE)?.value;
  if (!at) return null;
  try {
    return await verifyAccessToken(at);
  } catch {
    // Expired / invalid — the user is bounced back through /api/auth/login, which
    // re-auths silently if the MetaGo Central Auth session is still alive.
    return null;
  }
}

export type { MetagoUser };
