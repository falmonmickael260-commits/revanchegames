import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError, requireSameOrigin } from "@/lib/request-security";

async function authorized() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || user.is_anonymous) throw new RequestError("Connexion requise.", 401);
  const { data: allowed } = await db.rpc("is_support_admin");
  if (!allowed) throw new RequestError("Administration réservée.", 403);
  return { user, service: createServiceClient() };
}

const response = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });

export async function GET() {
  try {
    const { service } = await authorized();
    const [gifts, settings, bands, levels, metrics, sends, attempts, audits] = await Promise.all([
      service.from("gift_catalog").select("*").order("price_coins").order("name"),
      service.from("gift_settings").select("*").eq("singleton", true).single(),
      service.from("gift_reward_bands").select("*").order("rule").order("band"),
      service.from("rev_levels").select("*").order("level"),
      service.rpc("gift_admin_metrics"),
      service.from("gift_send_batches").select("id,sender_id,recipient_id,gift_id,quantity,total_price,total_rev,total_reward,context,created_at").order("created_at", { ascending: false }).limit(50),
      service.from("gift_attempts").select("id,sender_id,recipient_id,gift_id,error_code,created_at").order("created_at", { ascending: false }).limit(50),
      service.from("gift_admin_audit").select("id,actor_id,action,target,created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    if ([gifts,settings,bands,levels,metrics,sends,attempts,audits].some(result => result.error)) throw new RequestError("Données administrateur indisponibles.", 503);
    const { max_daily_spend: _maxDailySpend, max_daily_to_recipient: _maxDailyToRecipient, ...visibleSettings } = settings.data;
    return response({ gifts: gifts.data, settings: visibleSettings, bands: bands.data, levels: levels.data,
      metrics: metrics.data?.[0], sends: sends.data, attempts: attempts.data, audits: audits.data,
      activationAllowed: process.env.GIFT_FINANCIAL_APPROVED === "1" });
  } catch (error) { return apiError(error); }
}

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const rarity = new Set(["common","uncommon","rare","epic","legendary"]);
const animation = new Set(["petals","double-heartbeat","bounce","kiss-hearts","bear-hug","bloom","box-open","lightning","butterfly","macarons-bounce","ring-turn","crystal-glint","bear-bow","flower-glow","perfume-mist","unicorn-nod","ruby-pulse","chest-open","diamond-turn","crown-bloom","cat-wave","shooting-star","firework","swan-glide"]);

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { user, service } = await authorized();
    let body: Record<string, unknown>;
    try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 8192))); }
    catch { throw new RequestError("Modification invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("Modification invalide.");
    let value: Record<string, unknown>;
    if (body.action === "gift") {
      const id = body.id;
      if (typeof id !== "string" || !slug.test(id)) throw new RequestError("Identifiant invalide.");
      const price = Number(body.priceCoins), name = body.name, art = body.imageUrl;
      let approvedArt = false;
      if (typeof art === "string") {
        if (/^\/gifts\/[a-z0-9-]+\.webp$/.test(art)) approvedArt = true;
        else try {
          const url = new URL(art);
          approvedArt = url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
            && url.pathname.startsWith(`/storage/v1/object/public/gift-art/${id}/`);
        } catch { approvedArt = false; }
      }
      if (!Number.isInteger(price) || price < 10 || price > 100000 || price % 2 !== 0
        || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80
        || !approvedArt
        || typeof body.animationType !== "string" || !animation.has(body.animationType)
        || typeof body.rarity !== "string" || !rarity.has(body.rarity)
        || typeof body.active !== "boolean" || typeof body.limited !== "boolean") throw new RequestError("Données du cadeau invalides.");
      const start = body.startsAt === null || body.startsAt === "" ? null : body.startsAt;
      const end = body.endsAt === null || body.endsAt === "" ? null : body.endsAt;
      if ((start !== null && (typeof start !== "string" || !Number.isFinite(Date.parse(start))))
        || (end !== null && (typeof end !== "string" || !Number.isFinite(Date.parse(end))))
        || (start && end && Date.parse(start as string) >= Date.parse(end as string))) throw new RequestError("Dates invalides.");
      value = { id, name: name.trim(), price_coins: price, image_url: art, animation_type: body.animationType,
        rarity: body.rarity, active: body.active, limited: body.limited, starts_at: start, ends_at: end, updated_at: new Date().toISOString() };
    } else if (body.action === "settings") {
      const numbers = ["max_quantity","cooldown_seconds","min_account_age_hours"] as const;
      if (numbers.some(field => !Number.isInteger(body[field]) || Number(body[field]) < 0)
        || Number(body.max_quantity) < 1 || Number(body.max_quantity) > 100
        || Number(body.cooldown_seconds) > 3600 || Number(body.min_account_age_hours) > 8760
        || typeof body.gifts_enabled !== "boolean" || typeof body.renta_enabled !== "boolean") throw new RequestError("Limites invalides.");
      if ((body.gifts_enabled || body.renta_enabled) && process.env.GIFT_FINANCIAL_APPROVED !== "1")
        throw new RequestError("Validation financière et juridique requise avant activation.", 403);
      const { data: existingSettings, error: settingsError } = await service.from("gift_settings")
        .select("max_daily_spend,max_daily_to_recipient").eq("singleton", true).single();
      if (settingsError || !existingSettings) throw new RequestError("Paramètres des cadeaux indisponibles.", 503);
      value = { ...Object.fromEntries(numbers.map(field => [field, body[field]])),
        max_daily_spend: existingSettings.max_daily_spend,
        max_daily_to_recipient: existingSettings.max_daily_to_recipient,
        gifts_enabled: body.gifts_enabled, renta_enabled: body.renta_enabled };
    } else if (body.action === "band") {
      const rule = body.rule, band = body.band, weight = body.weight;
      if ((rule !== "thirty" && rule !== "general") || !Number.isInteger(band) || !Number.isInteger(weight)
        || Number(band) < 1 || Number(weight) < 0 || Number(weight) > 10000) throw new RequestError("Probabilité invalide.");
      value = { rule, band, weight };
    } else if (body.action === "level") {
      const level = body.level, required = body.requiredTotal, label = body.label;
      if (!Number.isInteger(level) || Number(level) < 2 || Number(level) > 1000
        || !Number.isSafeInteger(required) || Number(required) < 1
        || typeof label !== "string" || label.trim().length < 2 || label.trim().length > 40) throw new RequestError("Niveau invalide.");
      value = { level, required_total: required, label: label.trim() };
    } else if (body.action === "visual") {
      const id = body.id, tier = body.animationTier, message = body.celebrationMessage;
      if (typeof id !== "string" || !slug.test(id)
        || !["small","medium","prestige"].includes(String(tier))
        || typeof message !== "string" || message.length > 240) throw new RequestError("Présentation invalide.");
      const saved = await service.rpc("gift_admin_update_visual", { p_actor: user.id, p_gift_id: id,
        p_tier: tier, p_message: message });
      if (saved.error) throw new RequestError("Modification visuelle impossible.", 409);
      return response({ ok: true, value: saved.data });
    } else throw new RequestError("Action inconnue.");
    const saved = await service.rpc("gift_admin_apply", { p_actor: user.id, p_action: body.action, p_value: value });
    if (saved.error) throw new RequestError("Enregistrement impossible. Vérifie les valeurs et les seuils.", 409);
    return response({ ok: true, value: saved.data });
  } catch (error) { return apiError(error); }
}
