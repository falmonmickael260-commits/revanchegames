import { apiError, requireSameOrigin, RequestError, UUID_PATTERN } from '@/lib/request-security';
import { acceptGameInvitation } from '@/lib/game-connector/platform';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new RequestError('Invitation invalide.');
    return Response.json(await acceptGameInvitation(id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
