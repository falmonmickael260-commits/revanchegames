"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/components/social/SocialProvider";
import Link from "next/link";

type Purchase = {
  id: string; coins: number; amount: number; state: string; refunded_amount: number;
  receipt_url: string | null; created_at: string; livemode: boolean;
  payment_intent: string | null; payment_method: string | null;
};
const labels: Record<string, string> = {
  pending: "En attente", paid: "Payé", expired: "Expiré", failed: "Échoué",
  refunded: "Remboursé", partially_refunded: "Partiellement remboursé", disputed: "En litige",
};
const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const methods: Record<string, string> = { card: "Carte bancaire", apple_pay: "Apple Pay", google_pay: "Google Pay", paypal: "PayPal" };

export function PurchaseHistory({ payment }: { payment?: string }) {
  const { me } = useSocial();
  const userId = me?.id;
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [debt, setDebt] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/stripe/purchases?offset=${offset}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Historique temporairement indisponible.");
      const data = await response.json();
      if (signal?.aborted) return;
      setPurchases(data.purchases); setDebt(data.debtCoins); setLoadedUser(userId); setError("");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Historique indisponible.");
    }
  }, [userId, offset]);
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void load(controller.signal), 0);
    // Includes delayed webhooks; stops after one minute. Manual refresh remains available.
    const interval = setInterval(() => void load(controller.signal), 5000);
    const timeout = setTimeout(() => clearInterval(interval), 60000);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(interval); clearTimeout(timeout); };
  }, [load]);
  const notice = payment === "success" ? "Retour du paiement : consulte l’historique ci-dessous. Les pièces seront créditées après confirmation de Stripe."
    : payment === "cancelled" ? "Tu as quitté le paiement. Consulte l’historique pour vérifier son état." : "";
  if (!me) return null;
  const rows = loadedUser === me.id ? purchases : [];
  return (
    <section id="mes-achats" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-text">Mes achats</h2>
        <button type="button" onClick={() => void load()} className="text-sm text-amber">Actualiser</button>
      </div>
      {notice && <p role="status" className="text-sm text-text-dim">{notice}</p>}
      {error && <p role="alert" className="text-sm text-text-dim">{error}</p>}
      {loadedUser === me.id && debt > 0 && <p className="text-sm text-amber">{debt.toLocaleString("fr-FR")} pièces restent à régulariser après un remboursement ou un litige. Elles seront déduites des prochains crédits d’achat.</p>}
      {!rows.length && !error && <p className="text-sm text-text-dim">{loadedUser === me.id ? "Aucun achat sur cette page." : "Chargement…"}</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((purchase) => (
          <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3 text-sm text-text-dim">
            <div>
              <p className="text-text">{Number(purchase.coins).toLocaleString("fr-FR")} pièces · {euros(purchase.amount)}{!purchase.livemode && " · Test"}</p>
              <p>{new Date(purchase.created_at).toLocaleString("fr-FR")} · {labels[purchase.state] || purchase.state}</p>
              <p>{purchase.payment_method ? methods[purchase.payment_method] || purchase.payment_method : "Moyen de paiement non disponible"}</p>
              <p className="break-all text-xs">Transaction : {purchase.payment_intent || purchase.id}</p>
              {purchase.refunded_amount > 0 && <p>Remboursé : {euros(purchase.refunded_amount)}</p>}
            </div>
            <div className="flex gap-3">
              {purchase.receipt_url?.startsWith("https://pay.stripe.com/") && <a href={purchase.receipt_url} target="_blank" rel="noopener noreferrer" className="text-amber">Reçu Stripe</a>}
              <Link href={`/settings/support?transaction=${encodeURIComponent(purchase.payment_intent || purchase.id)}`} className="text-cyan">Assistance</Link>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between text-sm text-amber">
        <button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))} className="disabled:opacity-40">Précédent</button>
        <button type="button" disabled={rows.length < 20} onClick={() => setOffset(offset + 20)} className="disabled:opacity-40">Suivant</button>
      </div>
      <Link href="/settings/support" className="text-xs text-cyan">Nous contacter / Assistance et litiges</Link>
    </section>
  );
}
