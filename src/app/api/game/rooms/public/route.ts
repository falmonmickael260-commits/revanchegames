import { apiError, readLimitedBody, requireSameOrigin, RequestError, UUID_PATTERN } from '@/lib/request-security';
import { joinPublicGameRoom, listPublicGameRooms } from '@/lib/game-connector/public-rooms';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try { return Response.json(await listPublicGameRooms(), { headers }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { id } = JSON.parse(Buffer.from(await readLimitedBody(request, 256)).toString()) ?? {};
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) throw new RequestError('Salon invalide.');
    return Response.json(await joinPublicGameRoom(id), { headers });
  } catch (error) { return apiError(error); }
}
