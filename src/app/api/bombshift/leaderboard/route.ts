import { createServiceClient } from '@/lib/supabase/server';
import { isBombshiftMapId } from '@/lib/bombshift-progress';

// Rankings contain public display names and times only; account saves stay private.
const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
export async function GET(request: Request) {
  const mapId = new URL(request.url).searchParams.get('mapId');
  if (!isBombshiftMapId(mapId)) return Response.json({ error: 'Niveau inconnu.' }, { status: 400, headers });
  try {
    const { data, error } = await createServiceClient().rpc('bombshift_level_top5', { p_map_id: mapId });
    if (error) return Response.json({ error: 'Classement temporairement indisponible.' }, { status: 503, headers });
    return Response.json({ mapId, entries: data ?? [] }, { headers });
  } catch {
    return Response.json({ error: 'Classement temporairement indisponible.' }, { status: 503, headers });
  }
}
