import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { moderateImage, isModerationConfigured } from "@/lib/moderation";

/**
 * Envoi d'une photo de profil.
 *
 * ## Pourquoi cette route existe
 *
 * Avant, le navigateur envoyait le fichier **directement** au stockage
 * Supabase. Toute vérification faite côté navigateur était donc décorative :
 * il suffisait d'appeler l'API de stockage soi-même pour la contourner. Le
 * serveur ne voyait jamais l'image, et ne pouvait donc rien en dire.
 *
 * Désormais le fichier passe par ici, et c'est le seul chemin : les règles
 * d'écriture du bucket `avatars` ont été retirées au navigateur (migration
 * 20261026140000). Ce qui permet trois choses impossibles autrement :
 *
 *  1. **Vérifier que c'est vraiment une image.** `sharp` la décode ; un
 *     fichier qui n'est pas une image échoue ici, quelle que soit son
 *     extension ou son en-tête `Content-Type` annoncé.
 *  2. **La réencoder.** La sortie est un WebP 512×512 reconstruit à partir
 *     des pixels : les métadonnées EXIF (dont la géolocalisation) et tout
 *     contenu caché après les données d'image disparaissent.
 *  3. **La soumettre à la modération** avant qu'elle ne soit publiée.
 */

/** Taille maximale acceptée en entrée, avant réencodage. */
const MAX_BYTES = 5 * 1024 * 1024;
/** Côté de l'avatar final. Carré : c'est ce que l'interface affiche partout. */
const OUTPUT_SIZE = 512;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return NextResponse.json({ error: "Session expirée — reconnecte-toi." }, { status: 401 });
  }

  // Un joueur dont la photo a été retirée par la modération ne peut pas en
  // remettre une tant que son dossier n'est pas rouvert.
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_status, avatar_url")
    .eq("id", user.id)
    .single();

  if (profile?.avatar_status === "rejected") {
    return NextResponse.json(
      {
        error:
          "Ta photo de profil a été retirée par la modération. Contacte le support pour pouvoir en remettre une.",
      },
      { status: 403 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: "Envoi illisible." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La photo doit faire moins de 5 Mo." }, { status: 413 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  // ---- 1. Décodage : prouve que c'est une image, et laquelle ----
  let normalized: Buffer;
  try {
    const image = sharp(input, { failOn: "error" });
    const meta = await image.metadata();

    if (!meta.width || !meta.height) {
      return NextResponse.json({ error: "Ce fichier n'est pas une image valide." }, { status: 400 });
    }
    if (!["jpeg", "png", "webp", "avif", "gif"].includes(meta.format ?? "")) {
      return NextResponse.json(
        { error: "Formats acceptés : JPEG, PNG, WebP, AVIF ou GIF." },
        { status: 415 },
      );
    }
    // Une image minuscule agrandie en 512 donnerait une bouillie.
    if (meta.width < 64 || meta.height < 64) {
      return NextResponse.json(
        { error: "Cette image est trop petite (128 × 128 pixels minimum)." },
        { status: 400 },
      );
    }

    normalized = await image
      // `rotate()` sans argument applique l'orientation EXIF avant de la
      // perdre : sans ça, une photo prise de travers au téléphone
      // ressortirait couchée.
      .rotate()
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Ce fichier n'est pas une image valide." }, { status: 400 });
  }

  // ---- 2. Modération ----
  const verdict = await moderateImage(normalized, "image/webp");
  if (verdict.rejected) {
    return NextResponse.json({ error: verdict.reason }, { status: 422 });
  }

  // ---- 3. Publication ----
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Envoi indisponible pour le moment." }, { status: 503 });
  }

  // Le navigateur n'a plus le droit d'écrire dans le bucket : c'est cette
  // clé, côté serveur, qui publie — après les vérifications ci-dessus.
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const path = `${user.id}/${Date.now()}.webp`;
  const { error: uploadError } = await admin.storage.from("avatars").upload(path, normalized, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: "L'envoi a échoué. Réessaie." }, { status: 502 });
  }

  const { data: publicUrl } = admin.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl.publicUrl })
    .eq("id", user.id);

  if (updateError) {
    // On ne laisse pas derrière nous un fichier que plus rien ne référence.
    await admin.storage.from("avatars").remove([path]);
    return NextResponse.json({ error: "Impossible d'enregistrer cette photo." }, { status: 500 });
  }

  // ---- 4. Ménage : l'ancienne photo ne sert plus ----
  const previous = profile?.avatar_url;
  if (previous && previous.includes("/avatars/")) {
    const oldPath = previous.split("/avatars/")[1]?.split("?")[0];
    // On ne supprime que dans le dossier du joueur — jamais ailleurs, même
    // si l'URL enregistrée était inattendue.
    if (oldPath && oldPath.startsWith(`${user.id}/`)) {
      await admin.storage.from("avatars").remove([oldPath]);
    }
  }

  return NextResponse.json({
    url: publicUrl.publicUrl,
    // Dit honnêtement à l'interface si la photo a réellement été analysée.
    moderated: verdict.checked,
    moderationConfigured: isModerationConfigured(),
  });
}
