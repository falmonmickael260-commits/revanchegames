export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readLimitedBody(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > limit) throw new RequestError("Envoi trop volumineux.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RequestError("Envoi trop volumineux.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export function requireSameOrigin(request: Request) {
  // For support pages this canonical origin falls back to the existing site URL.
  // Never trust forwarded/Host headers as the list of allowed origins.
  const configured = process.env.STRIPE_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) throw new RequestError("Service non configuré.", 503);
  const origin = new URL(configured).origin;
  if (request.headers.get("origin") !== origin) throw new RequestError("Origine refusée.", 403);
}

export function apiError(error: unknown): Response {
  return Response.json({ error: error instanceof RequestError ? error.message : "Service temporairement indisponible." }, {
    status: error instanceof RequestError ? error.status : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
