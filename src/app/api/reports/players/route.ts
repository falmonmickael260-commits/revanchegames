import { supportSession } from '@/lib/support-server';
import { apiError, RequestError } from '@/lib/request-security';
export async function GET(request: Request) {
  try {
    const { db } = await supportSession("Connecte-toi avec un compte confirmé pour envoyer un signalement.");
    const query = (new URL(request.url).searchParams.get('search') || '').trim();
    if (query.length < 2 || query.length > 120) throw new RequestError('Saisis un pseudo ou un identifiant de 2 à 120 caractères.');
    const { data, error } = await db.rpc('report_player_lookup', { p_query: query });
    if (error) throw new RequestError('Recherche de profil indisponible.', 503);
    return Response.json({ rows: data || [] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return apiError(error); }
}
