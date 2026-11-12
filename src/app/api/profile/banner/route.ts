import { PROFILE_MEDIA_ENABLED, PROFILE_MEDIA_PAUSED_MESSAGE } from "@/lib/profile-media";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { moderateImage } from "@/lib/moderation";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  if (!PROFILE_MEDIA_ENABLED) {
    return NextResponse.json({ error: PROFILE_MEDIA_PAUSED_MESSAGE }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const candidate = (await request.formData()).get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: "Envoi illisible." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image limitée à 5 Mo." }, { status: 413 });

  let output: Buffer;
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" });
    const meta = await input.metadata();
    if (!meta.width || !meta.height || meta.width < 500 || meta.height < 180 || !["jpeg", "png", "webp", "avif"].includes(meta.format ?? "")) {
      return NextResponse.json({ error: "Choisis une image d’au moins 500 × 180 pixels." }, { status: 400 });
    }
    output = await input.rotate().resize(1400, 525, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Image invalide." }, { status: 400 });
  }

  const verdict = await moderateImage(output, "image/webp");
  if (verdict.rejected) return NextResponse.json({ error: verdict.reason }, { status: 422 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return NextResponse.json({ error: "Envoi indisponible." }, { status: 503 });
  const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await db.from("profiles").select("banner_url").eq("id", user.id).maybeSingle();
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage.from("profile-banners").upload(path, output, { contentType: "image/webp", cacheControl: "3600", upsert: false });
  if (uploadError) return NextResponse.json({ error: "Envoi impossible." }, { status: 502 });

  const { data: url } = admin.storage.from("profile-banners").getPublicUrl(path);
  const { error: updateError } = await admin.from("profiles").update({ banner_url: url.publicUrl }).eq("id", user.id);
  if (updateError) {
    await admin.storage.from("profile-banners").remove([path]);
    return NextResponse.json({ error: "Impossible d’enregistrer la bannière." }, { status: 500 });
  }
  const previous = profile?.banner_url?.split("/profile-banners/")[1]?.split("?")[0];
  if (previous?.startsWith(`${user.id}/`)) await admin.storage.from("profile-banners").remove([previous]);
  return NextResponse.json({ url: url.publicUrl });
}
