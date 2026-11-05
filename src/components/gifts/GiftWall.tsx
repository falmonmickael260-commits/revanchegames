"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GiftArt } from "./GiftArt";
import type { Gift } from "@/lib/gifts/types";

type Entry = { gift_id: string; quantity: number; last_received_at: string; gift: Gift | null };
type Recent = { id: string; gift_id: string; quantity: number; created_at: string; gift: Gift | null };

export function GiftWall({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [view, setView] = useState<"collection" | "history">("collection");
  const [loading, setLoading] = useState(true);
  const channelId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const load = useCallback(async () => {
    const db = createClient();
    const [{ data: collection }, { data: events }] = await Promise.all([
      db.from("gift_collection").select("gift_id,quantity,last_received_at,gift:gift_catalog(id,name,image_url,animation_type,rarity,price_coins,active,starts_at,ends_at,limited,animation_tier,celebration_message)").eq("recipient_id", userId).order("last_received_at", { ascending: false }),
      db.from("gift_received_events").select("id,gift_id,quantity,created_at,gift:gift_catalog(id,name,image_url,animation_type,rarity,price_coins,active,starts_at,ends_at,limited,animation_tier,celebration_message)").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    setEntries((collection ?? []) as unknown as Entry[]);
    setRecent((events ?? []) as unknown as Recent[]);
    setLoading(false);
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
  const total = entries.reduce((sum, entry) => sum + Number(entry.quantity), 0);
  return <section id="mes-cadeaux" className="rg-gift-wall">
    <div className="rg-profile-section-heading"><div><span>COLLECTION</span><h2>Mur à cadeaux</h2></div><span>{total} cadeau{total > 1 ? "x" : ""} · {entries.length} modèle{entries.length > 1 ? "s" : ""}</span></div>
    <div className="rg-gift-wall-tabs"><button type="button" aria-pressed={view === "collection"} onClick={() => setView("collection")}>Collection</button><button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>Historique</button></div>
    {loading ? <p className="rg-gift-wall-empty">Chargement de la collection…</p> : view === "collection" ? entries.length ? <div className="rg-gift-wall-grid">{entries.map(entry => entry.gift && <article key={entry.gift_id} data-rarity={entry.gift.rarity}>
      <GiftArt src={entry.gift.image_url} name={entry.gift.name} animation={entry.gift.animation_type} size={84} />
      <strong>{entry.gift.name}</strong><span>×{entry.quantity}</span>
    </article>)}</div> : <p className="rg-gift-wall-empty">Aucun cadeau reçu pour le moment.</p>
      : recent.length ? <div className="rg-gift-wall-history">{recent.map(item => item.gift && <article key={item.id}><GiftArt src={item.gift.image_url} name={item.gift.name} animation={item.gift.animation_type} size={55} /><div><strong>{item.gift.name} ×{item.quantity}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time></div></article>)}</div> : <p className="rg-gift-wall-empty">Aucun cadeau reçu pour le moment.</p>}
  </section>;
}
