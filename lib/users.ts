import 'server-only';

/**
 * App-level access control: which dashboards + download each person gets,
 * and the admin/user role for THIS app. Keyed by email (from the SSO token).
 *
 * ⚠️ Scaffold store: in-memory, seeded from BOOTSTRAP_ADMINS. It resets on every
 * deploy and is NOT shared across serverless instances. Before go-live, swap the
 * body of these functions for a real database (Vercel Postgres / KV). The rest of
 * the app only depends on this interface, so that swap is isolated here.
 */

export type Role = 'admin' | 'user';
export type Status = 'active' | 'inactive' | 'pending';
export const ALL_DASHBOARDS = ['ltv', 'weight', 'sales', 'fe', 'eng'] as const;
export type DashId = (typeof ALL_DASHBOARDS)[number];

export interface AccessRecord {
  email: string;
  name: string;
  role: Role;
  status: Status;
  dashboards: DashId[]; // ignored for admins (they get all)
  download: boolean;
}

const bootstrapAdmins = (process.env.BOOTSTRAP_ADMINS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const store = new Map<string, AccessRecord>();

function seed() {
  for (const email of bootstrapAdmins) {
    if (!store.has(email)) {
      store.set(email, {
        email,
        name: email.split('@')[0],
        role: 'admin',
        status: 'active',
        dashboards: [...ALL_DASHBOARDS],
        download: true,
      });
    }
  }
}
seed();

/** Called on every SSO login. First-time users land as 'pending' with no access. */
export function ensureUser(email: string, name: string, ssoRole?: string): AccessRecord {
  const key = email.toLowerCase();
  let rec = store.get(key);
  if (!rec) {
    const isAdmin = bootstrapAdmins.includes(key);
    rec = {
      email,
      name: name || email.split('@')[0],
      role: isAdmin || ssoRole === 'admin' ? 'admin' : 'user',
      status: isAdmin ? 'active' : 'pending',
      dashboards: isAdmin ? [...ALL_DASHBOARDS] : [],
      download: isAdmin,
    };
    store.set(key, rec);
  }
  return rec;
}

export function getAccess(email: string): AccessRecord | null {
  return store.get(email.toLowerCase()) || null;
}

export function listUsers(): AccessRecord[] {
  return [...store.values()];
}

export function updateUser(email: string, patch: Partial<AccessRecord>): AccessRecord | null {
  const key = email.toLowerCase();
  const rec = store.get(key);
  if (!rec) return null;
  Object.assign(rec, patch);
  return rec;
}

export function deleteUser(email: string): void {
  store.delete(email.toLowerCase());
}

/** The dashboards a record may open (admins → all). */
export function allowedDashboards(rec: AccessRecord | null): DashId[] {
  if (!rec || rec.status !== 'active') return [];
  return rec.role === 'admin' ? [...ALL_DASHBOARDS] : rec.dashboards;
}
