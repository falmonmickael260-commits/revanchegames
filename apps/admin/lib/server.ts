import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export class AdminError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function adminDb() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: values => {
      for (const { name, value, options } of values) jar.set(name, value, options);
    } },
  });
}
export async function adminSession() {
  const db = await adminDb();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user || user.is_anonymous || !user.email_confirmed_at) throw new AdminError('Connexion à un compte confirmé requise.', 401);
  // This RPC also checks the current membership and signed aal2 claim in SQL.
  const { data, error: denied } = await db.rpc('admin_query', { p_section: 'session' });
  if (denied || !data) throw new AdminError(denied?.code === '42501' ? 'Droits administrateur et double authentification requis.' : 'Administration indisponible. Vérifiez les migrations et la configuration.', denied?.code === '42501' ? 403 : 503);
  return { db, user, membership: data };
}
export function sameAdminOrigin(request: Request) {
  const configured = process.env.ADMIN_SITE_URL;
  if (!configured) throw new AdminError('Adresse administrateur non configurée.', 503);
  if (request.headers.get('origin') !== new URL(configured).origin) throw new AdminError('Origine refusée.', 403);
}
export const json = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store, private' } });
export function failure(error: unknown) {
  return Response.json({ error: error instanceof AdminError ? error.message : 'Service temporairement indisponible.' }, {
    status: error instanceof AdminError ? error.status : 503,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}
