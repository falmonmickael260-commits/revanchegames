"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { useWallet } from "@/lib/use-wallet";

/** Le solde de pièces, dans l'en-tête — visible seulement une fois connecté. */
export function WalletPill() {
  const { me } = useSocial();
  const { balance, ready } = useWallet(me?.id ?? null);

  if (!me) return null;

  return (
    <Link
      href="/shop"
      aria-label={
        ready && balance !== null
          ? `Boutique — ${balance.toLocaleString("fr-FR")} pièces Revanche`
          : "Boutique"
      }
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-2.5 py-1.5 font-display text-xs font-semibold text-amber transition-colors hover:border-amber/40"
    >
      <Coins className="h-3.5 w-3.5" strokeWidth={2.5} />
      <span className="tabular-nums">{ready && balance !== null ? balance.toLocaleString("fr-FR") : "…"}</span>
    </Link>
  );
}
