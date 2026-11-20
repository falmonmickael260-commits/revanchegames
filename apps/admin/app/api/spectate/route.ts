import { adminSession, failure, json } from "../../../lib/server";
import { forwardControl } from "../../../lib/control";
export async function GET(request: Request) {
  try {
    const { db } = await adminSession();
    const q = new URL(request.url).searchParams;
    return json(
      await forwardControl(
        db,
        `/api/admin/observer?${new URLSearchParams({ room: q.get("room") || "", access: q.get("access") || "" })}`,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
