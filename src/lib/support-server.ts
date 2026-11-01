import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { RequestError } from "@/lib/request-security";

export async function supportSession() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user || user.is_anonymous || !user.email_confirmed_at) throw new RequestError("Connecte-toi avec un compte confirmé pour contacter l’assistance.", 401);
  return { db, user };
}

export async function normalizeScreenshot(file: File): Promise<Buffer> {
  if (file.size > 5 * 1024 * 1024) throw new RequestError("La capture doit faire au maximum 5 Mo.", 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new RequestError("Formats acceptés : JPEG, PNG et WebP.", 415);
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: "error", limitInputPixels: 20000000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || !metadata.width || !metadata.height || (metadata.pages || 1) > 1) {
      throw new Error("Image invalide");
    }
    return await image.rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new RequestError("La capture n’est pas une image valide.", 415); }
}
