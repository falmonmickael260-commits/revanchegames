"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gift, X } from "lucide-react";
import { useWallet } from "@/lib/use-wallet";
import { celebrateGift, type Gift as GiftItem, type GiftEvent } from "@/lib/gifts/types";
import { GiftArt } from "./GiftArt";
import { giftPresentation } from "@/lib/gifts/presentation";

type Recipient = { id: string; name: string };
type Catalog = { gifts: GiftItem[]; settings: { enabled: boolean; max_quantity: number } };

export function GiftLauncher({ meId, recipients, context, roomId, onSent }: {
  meId: string;
  recipients: Recipient[];
  context: "dm" | "voice";
  roomId?: string;
  onSent?: (batchId: string, messageId: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [giftId, setGiftId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const { balance, ready } = useWallet(meId);
  const selected = catalog?.gifts.find(gift => gift.id === giftId);
  const receiver = recipients.find(person => person.id === recipientId) ?? recipients[0];
  const total = (selected?.price_coins ?? 0) * quantity;
  const available = useMemo(() => (catalog?.gifts ?? []).filter(gift => gift.active
    && (!gift.starts_at || Date.parse(gift.starts_at) <= now)
    && (!gift.ends_at || Date.parse(gift.ends_at) > now)), [catalog, now]);

  useEffect(() => {
    if (!open || catalog) return;
    let cancelled = false;
    const timer = setTimeout(() => setLoading(true), 0);
    void fetch("/api/gifts", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Catalogue indisponible.");
      if (!cancelled) { setCatalog(data); setGiftId((value: string) => value || data.gifts?.[0]?.id || "");
        setQuantity(value => Math.min(value, data.settings?.max_quantity ?? 20)); }
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Catalogue indisponible."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, catalog]);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, busy]);

  async function send() {
    if (!selected || !receiver || busy || !catalog?.settings.enabled || !ready || balance === null || balance < total) return;
    const signature = `${receiver.id}:${selected.id}:${quantity}:${context}:${roomId ?? ""}`;
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/gifts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: receiver.id, giftId: selected.id, quantity, context, roomId,
          idempotencyKey: attempt.current.id }) });
      const result = await response.json();
      if (!response.ok || !result.batch?.id) throw new Error(result.error || "Envoi impossible.");
      const eventResponse = await fetch(`/api/gifts/events?id=${encodeURIComponent(result.batch.id)}`, { cache: "no-store" });
      if (eventResponse.ok) celebrateGift(await eventResponse.json() as GiftEvent);
      attempt.current = null;
      setOpen(false);
      try { await onSent?.(result.batch.id, result.messageId ?? null); } catch { /* cadeau confirmé, signal complémentaire facultatif */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible. Réessaie.");
    } finally { setBusy(false); }
  }

  return <>
    <button type="button" aria-label="Offrir un cadeau" title="Offrir un cadeau" className="rg-gift-launcher" onClick={() => { setOpen(true); setNow(Date.now()); setError(""); }}>
      <Gift size={20} />
    </button>
    {open && <div className="rg-gift-sheet-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Offrir un cadeau" className="rg-gift-sheet">
        <header><div><span>UNE ATTENTION POUR UN AMI</span><h2>Offrir un cadeau</h2></div><button type="button" aria-label="Fermer" onClick={() => setOpen(false)} disabled={busy}><X size={20} /></button></header>
        <div className="rg-gift-sheet-content">
          <div className="rg-gift-sheet-summary"><span>Destinataire <strong>{context === "voice" ? <select aria-label="Destinataire du cadeau" value={receiver?.id ?? ""} onChange={event => { setRecipientId(event.target.value); attempt.current = null; }}>{recipients.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select> : receiver?.name ?? "—"}</strong></span><span>Mon solde <strong>{ready && balance !== null ? balance.toLocaleString("fr-FR") : "—"} pièces</strong></span></div>
          {loading && <p className="rg-gift-sheet-message">Chargement des cadeaux…</p>}
          {!loading && !catalog?.settings.enabled && <p className="rg-gift-sheet-message">Les cadeaux ne sont pas disponibles pour le moment.</p>}
          <div className="rg-gift-grid">{available.map(gift => <button type="button" key={gift.id} className={gift.id === giftId ? "is-selected" : ""} onClick={() => { setGiftId(gift.id); attempt.current = null; }} aria-pressed={gift.id === giftId}>
            <GiftArt src={gift.image_url} name={gift.name} animation={gift.animation_type} size={70} /><strong>{gift.name}</strong><span>{gift.price_coins} pièces</span>
          </button>)}</div>
          {selected && <div className="rg-gift-selection"><GiftArt src={selected.image_url} name={selected.name} animation={selected.animation_type} size={82} /><div><strong>{selected.name}</strong><span>Une attention pour {receiver?.name ?? "ton ami"}</span><small>{selected.celebration_message || giftPresentation(selected).message}</small></div></div>}
          <div className="rg-gift-quantity"><span>Quantité</span><div>{[1,5,10,20].filter(value => value <= (catalog?.settings.max_quantity ?? 20)).map(value => <button key={value} type="button" aria-pressed={quantity === value} onClick={() => { setQuantity(value); attempt.current = null; }}>×{value}</button>)}<input type="number" aria-label="Quantité personnalisée" min="1" max={catalog?.settings.max_quantity ?? 20} value={quantity} onChange={event => { setQuantity(Math.max(1,Math.min(catalog?.settings.max_quantity ?? 20,Number(event.target.value)||1))); attempt.current = null; }} /></div></div>
          {error && <p role="alert" className="rg-gift-error">{error}</p>}
        </div>
        <footer><span>Total <strong>{total.toLocaleString("fr-FR")} pièces</strong></span><button type="button" onClick={() => void send()} disabled={busy || !catalog?.settings.enabled || !selected || !receiver || balance === null || balance < total}>{busy ? "Envoi…" : "Envoyer le cadeau"}</button></footer>
      </section>
    </div>}
  </>;
}
