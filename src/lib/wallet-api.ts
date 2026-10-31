"use client";

import { createClient } from "./supabase/client";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function toMessage(error: { code?: string; message: string }): string {
  if (!error.message || /fetch|network|failed to/i.test(error.message)) {
    return "Problème de connexion — réessaie.";
  }
  return error.message.charAt(0).toUpperCase() + error.message.slice(1);
}

export type PromoRedemption = { rewardCoins: number; newBalance: number };

/** Code promo → pièces créditées. Toute la logique (unicité, plafond, expiration) vit côté serveur. */
export async function redeemPromoCode(code: string): Promise<ActionResult<PromoRedemption>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: code });
  if (error) return { ok: false, error: toMessage(error) };
  const row = (data as { reward_coins: number; new_balance: number }[] | null)?.[0];
  if (!row) return { ok: false, error: "Réponse inattendue du serveur." };
  return { ok: true, data: { rewardCoins: row.reward_coins, newBalance: row.new_balance } };
}
