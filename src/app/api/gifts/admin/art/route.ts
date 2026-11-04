import sharp from "sharp";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { moderateImage } from "@/lib/moderation";
import { apiError, RequestError, requireSameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.is_anonymous) throw new RequestError("Connexion requise.", 401);
    const { data: allowed } = await db.rpc("is_support_admin");
    if (!allowed) throw new RequestError("Administration réservée.", 403);
    const form = await request.formData();
    const giftId = form.get("giftId"), file = form.get("file");
    if (typeof giftId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(giftId) || !(file instanceof File))
      throw new RequestError("Image invalide.");
    if (file.size > 8 * 1024 * 1024) throw new RequestError("Image limitée à 8 Mo.", 413);
    let output: Buffer;
    try {
      const input = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" });
      const meta = await input.metadata();
      if (!meta.width || !meta.height || meta.width < 128 || meta.height < 128
        || !["jpeg","png","webp","avif"].includes(meta.format ?? "")) throw new Error("format");
      output = await input.rotate().resize(512,512,{ fit: "contain", background: { r:0,g:0,b:0,alpha:0 } }).webp({ quality: 82 }).toBuffer();
    } catch { throw new RequestError("Choisis une image carrée ou détourée d’au moins 128 pixels."); }
    if (output.byteLength > 2 * 1024 * 1024) throw new RequestError("Image trop lourde après conversion.", 413);
    const verdict = await moderateImage(output, "image/webp");
    if (verdict.rejected) throw new RequestError(verdict.reason ?? "Image refusée.", 422);
    const service = createServiceClient();
    const path = `${giftId}/${crypto.randomUUID()}.webp`;
    const { error } = await service.storage.from("gift-art").upload(path, output, { contentType: "image/webp", upsert: false });
    if (error) throw new RequestError("Envoi impossible.", 503);
    const { data } = service.storage.from("gift-art").getPublicUrl(path);
    return Response.json({ url: data.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
