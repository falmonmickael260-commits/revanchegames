import { readDomirushRequest } from '@/lib/dominorush';
import { verifyPlatformToken } from '@/lib/platform-token';
import { RequestError } from '@/lib/request-security';

export async function POST(request: Request) {
  try {
    const body = await readDomirushRequest(request, 'identity') as { token?: unknown } | null;
    return Response.json({ identity: verifyPlatformToken(body?.token) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : 'Connexion indisponible.' },
      { status: error instanceof RequestError ? error.status : 503 });
  }
}
