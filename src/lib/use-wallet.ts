"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "./supabase/client";

/**
 * Solde de pièces Revanche du joueur connecté, synchronisé en direct.
 *
 * Lecture seule ici — par construction : `wallet_accounts` n'a aucune
 * policy insert/update pour authenticated/anon (voir
 * 20261025000000_platform_core.sql), seul `service_role` ou une fonction
 * `security definer` (ex. `redeem_promo_code`) peut créditer un compte.
 * Rien de ce hook ne pourrait donc modifier un solde même en le voulant.
 *
 * `useId()` pour le nom du canal temps réel, pas une valeur statique : ce
 * hook peut être monté par plusieurs composants à la fois (en-tête,
 * boutique…), et deux canaux du même nom font planter Supabase Realtime
 * ("cannot add postgres_changes callbacks ... after subscribe()") — déjà
 * rencontré une fois sur l'identité du joueur, voir use-identity.ts.
 */
export function useWallet(userId: string | null): { balance: number | null; ready: boolean } {
  const [balance, setBalance] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("wallet_accounts")
        .select("balance_coins")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (cancelled) return;
      // Pas encore de ligne : le portefeuille n'a jamais reçu de mouvement,
      // le solde est donc bien 0 — pas "inconnu".
      setBalance(data?.balance_coins ?? 0);
      setReady(true);
    }
    void load();

    const channel = supabase
      .channel(`rg-wallet-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_accounts", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  return { balance, ready };
}
