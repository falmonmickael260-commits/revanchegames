"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GiftArt } from "./GiftArt";
import { celebrateGift, type GiftEvent } from "@/lib/gifts/types";

type WallGift = {
  id: string; name: string; image_url: string; animation_type: string; rarity: string;
  animation_tier: "small" | "medium" | "prestige"; celebration_message: string;
};
type Entry = { gift_id: string; quantity: number; last_received_at: string; gift: WallGift | null };
type Recent = { id: string; gift_id: string; quantity: number; created_at: string; senderName: string | null; gift: WallGift | null };

export function GiftWall({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [view, setView] = useState<"collection" | "history">("collection");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const channelId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/gifts/wall?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Collection indisponible.");
      setEntries((result.collection ?? []) as Entry[]);
      setRecent((result.history ?? []) as Recent[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Collection momentanément indisponible.");
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    const db = createClient();
    const channel = db.channel(`rg-gift-wall-${userId}-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_received_events", filter: `recipient_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    const resume = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", resume);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", resume); void db.removeChannel(channel); };
  }, [userId, channelId, load]);

  const validEntries = entries.filter((entry): entry is Entry & { gift: WallGift } => Boolean(entry.gift));
  const total = validEntries.reduce((sum, entry) => sum + Number(entry.quantity), 0);
  const exceptional = useMemo(() => validEntries.filter(entry => entry.gift.animation_tier === "prestige"), [validEntries]);

  const preview = (entry: Entry & { gift: WallGift }) => {
    const { gift } = entry;
    const event: GiftEvent = {
      id: `profile-preview-${gift.id}-${crypto.randomUUID()}`,
      gift: { id: gift.id, name: gift.name, image_url: gift.image_url, animation_type: gift.animation_type,
        rarity: gift.rarity as GiftEvent["gift"]["rarity"], animation_tier: gift.animation_tier, celebration_message: gift.celebration_message },
      quantity: Number(entry.quantity), senderId: userId, senderName: "", senderAvatarUrl: null,
      recipientId: userId, recipientName: "", recipientAvatarUrl: null, totalRev: null, totalReward: null,
      createdAt: new Date().toISOString(), context: "dm", animationTier: gift.animation_tier,
      celebrationMessage: gift.celebration_message, preview: true,
    };
    celebrateGift(event);
  };

  return <section id="mes-cadeaux" className="rg-gift-wall">
    <div className="rg-profile-section-heading rg-gift-wall-heading">
      <div><span>COLLECTION PERSONNELLE</span><h2>Mur à cadeaux</h2></div>
      <span>{total} cadeau{total > 1 ? "x" : ""} · {validEntries.length} modèle{validEntries.length > 1 ? "s" : ""}</span>
    </div>

    <section className="rg-gift-wall-showcase" aria-labelledby="gift-exception-title">
      <div className="rg-gift-wall-showcase-heading"><span>VITRINE</span><h3 id="gift-exception-title">Mes cadeaux d’exception</h3>
        {exceptional.length > 0 && <small>{exceptional.length} modèle{exceptional.length > 1 ? "s" : ""}</small>}
      </div>
      {loading ? <div className="rg-gift-wall-showcase-empty" aria-label="Chargement de la vitrine"><span className="rg-gift-wall-loading-shine" /></div>
        : exceptional.length ? <div className="rg-gift-wall-showcase-grid">{exceptional.map(entry => <button type="button" key={entry.gift_id}
          className="rg-gift-wall-feature" data-tier="prestige" onClick={() => preview(entry)}
          aria-label={`Prévisualiser ${entry.gift.name}, quantité ${entry.quantity}`}>
          <span className="rg-gift-wall-feature-aura" aria-hidden="true" />
          <span className="rg-gift-wall-art"><GiftArt src={entry.gift.image_url} name={entry.gift.name} animation={entry.gift.animation_type} size={132} /></span>
          <span className="rg-gift-wall-quantity">×{entry.quantity}</span>
          <span className="rg-gift-wall-feature-name">{entry.gift.name}</span>
          <span className="rg-gift-wall-feature-hint">Toucher pour l’animation</span>
        </button>)}</div>
        : <div className="rg-gift-wall-showcase-empty"><span className="rg-gift-wall-empty-star" aria-hidden="true">✧</span>
          <p>Les cadeaux les plus prestigieux que tu recevras apparaîtront ici.</p></div>}
    </section>

    <div className="rg-gift-wall-tabs" role="group" aria-label="Contenu du mur à cadeaux">
      <button type="button" aria-pressed={view === "collection"} onClick={() => setView("collection")}>Collection <span>{validEntries.length}</span></button>
      <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>Historique</button>
    </div>

    {loading ? <p className="rg-gift-wall-state">Chargement de la collection…</p> : error ? <p className="rg-gift-wall-state" role="status">{error}</p>
      : view === "collection" ? validEntries.length ? <div className="rg-gift-wall-grid" key="collection">
        {validEntries.map(entry => <button type="button" key={entry.gift_id} className="rg-gift-wall-card"
          data-tier={entry.gift.animation_tier} data-rarity={entry.gift.rarity} onClick={() => preview(entry)}
          aria-label={`Prévisualiser ${entry.gift.name}, quantité ${entry.quantity}`}>
          <span className="rg-gift-wall-art"><GiftArt src={entry.gift.image_url} name={entry.gift.name} animation={entry.gift.animation_type} size={112} /></span>
          <span className="rg-gift-wall-quantity">×{entry.quantity}</span>
          <strong>{entry.gift.name}</strong><small>Toucher pour animer</small>
        </button>)}
      </div> : <p className="rg-gift-wall-state">Aucun cadeau reçu pour le moment. Tes prochains cadeaux apparaîtront ici.</p>
        : recent.length ? <div className="rg-gift-wall-history" key="history">{recent.map(item => item.gift && <article key={item.id} data-tier={item.gift.animation_tier}>
          <button type="button" className="rg-gift-wall-history-art" onClick={() => preview({ gift_id: item.gift_id, quantity: item.quantity, last_received_at: item.created_at, gift: item.gift! })}
            aria-label={`Prévisualiser ${item.gift.name}`}><GiftArt src={item.gift.image_url} name={item.gift.name} animation={item.gift.animation_type} size={66} /></button>
          <div><strong>{item.gift.name} <span>×{item.quantity}</span></strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time>
            {item.senderName && <small>Offert par {item.senderName}</small>}</div>
        </article>)}</div> : <p className="rg-gift-wall-state">Aucun cadeau dans l’historique pour le moment.</p>}
  </section>;
}
