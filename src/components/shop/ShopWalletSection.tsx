"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { useWallet } from "@/lib/use-wallet";
import { PromoCodeForm } from "./PromoCodeForm";

/** Solde actuel + code promo — regroupés car tous deux liés au compte connecté. */
export function ShopWalletSection() {
  const { me, ready } = useSocial();
  const { balance, ready: walletReady } = useWallet(me?.id ?? null);

  if (ready && !me) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border-soft bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm text-text-dim">
          Crée un compte Revanche Games pour avoir ton propre portefeuille de pièces.
        </p>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/sign-up"
            className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void"
          >
            Créer un compte
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-border-soft px-4 py-2 font-display text-sm font-semibold text-text-dim"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-amber/25 bg-surface p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber/10">
          <Coins className="h-5 w-5 text-amber" strokeWidth={2} />
        </span>
        <div>
          <p className="font-body text-xs uppercase tracking-[0.2em] text-text-faint">Ton solde</p>
          <p className="font-display text-2xl font-bold text-text">
            {balance !== null ? balance.toLocaleString("fr-FR") : walletReady ? "Indisponible" : "…"}{" "}
            <span className="font-body text-sm font-normal text-text-faint">pièces</span>
          </p>
        </div>
      </div>

      <PromoCodeForm />
    </div>
  );
}
