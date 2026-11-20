import { adminBearer } from "@/lib/admin/bearer";
import { reconcilePurchase } from "@/lib/admin/reconcile";
import {
  apiError,
  readLimitedBody,
  RequestError,
  UUID_PATTERN,
} from "@/lib/request-security";
export async function POST(request: Request) {
  try {
    const { user } = await adminBearer(request, "credit");
    const body = JSON.parse(
      new TextDecoder().decode(await readLimitedBody(request, 1024)),
    );
    if (!UUID_PATTERN.test(body?.id) || !UUID_PATTERN.test(body?.target))
      throw new RequestError("Opération invalide.");
    return Response.json(
      await reconcilePurchase(body.id, user.id, body.target),
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
