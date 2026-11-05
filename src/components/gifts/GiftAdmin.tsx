"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { GiftArt } from "./GiftArt";
import type { Gift } from "@/lib/gifts/types";
import { theoreticalGiftReward } from "@/lib/gifts/economy";
import { celebrateGift } from "@/lib/gifts/types";

type Settings = { gifts_enabled:boolean; renta_enabled:boolean; max_quantity:number; max_daily_spend:number;
  max_daily_to_recipient:number; cooldown_seconds:number; min_account_age_hours:number };
type Band = { rule:string; band:number; min_amount:number|null; max_amount:number|null;
  min_percent:number|null; max_percent:number|null; weight:number };
type Level = { level:number; required_total:number; label:string };
type Summary = { sent_count:number; items_sent:number; coins_spent:number; rev_distributed:number; coins_rewarded:number; failed_attempts:number };
type Send = { id:string; sender_id:string; recipient_id:string; gift_id:string; quantity:number; total_price:number; total_rev:number; total_reward:number; context:string; created_at:string };
type Attempt = { id:string; gift_id:string|null; error_code:string; created_at:string };
type Audit = { id:string; action:string; target:string; created_at:string };
type Data = { gifts:Gift[]; settings:Settings; bands:Band[]; levels:Level[]; metrics:Summary;
  sends:Send[]; attempts:Attempt[]; audits:Audit[]; activationAllowed:boolean };

const field = "rounded-lg border border-border-soft bg-void px-2.5 py-2 text-sm text-text";
const animations = ["petals","double-heartbeat","bounce","kiss-hearts","bear-hug","bloom","box-open","lightning","butterfly","macarons-bounce","ring-turn","crystal-glint","bear-bow","flower-glow","perfume-mist","unicorn-nod","ruby-pulse","chest-open","diamond-turn","crown-bloom","cat-wave","shooting-star","firework","swan-glide"];
const blank: Gift = { id:"",name:"",price_coins:10,rev_points:5,image_url:"",animation_type:"bounce",rarity:"common",active:false,starts_at:null,ends_at:null,limited:false };

export function GiftAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<Gift | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/gifts/admin", { cache:"no-store",signal });
      const next = await response.json() as Data & { error?:string };
      if (!response.ok) throw new Error(next.error || "Administration indisponible.");
      if (signal?.aborted) return;
      setData(next); setSettings(next.settings); setBands(next.bands); setLevels(next.levels);
      setError("");
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Lecture impossible."); }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { void load(controller.signal); }, 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/gifts/admin", { method:"PATCH",headers:{ "Content-Type":"application/json" },body:JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      setNotice("Modification enregistrée.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (!selected) return;
    if (!selected.id) { setError("Saisis d’abord l’identifiant du cadeau."); return; }
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file",file); form.append("giftId",selected.id);
      const response = await fetch("/api/gifts/admin/art", { method:"POST",body:form });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Image refusée.");
      setSelected({ ...selected, image_url:result.url });
      setNotice("Image envoyée. Enregistre le cadeau pour la publier.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Envoi impossible."); }
    finally { setBusy(false); }
  }
  function saveGift(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    void patch({ action:"gift",id:selected.id,name:selected.name,priceCoins:Number(selected.price_coins),imageUrl:selected.image_url,
      animationType:selected.animation_type,rarity:selected.rarity,active:selected.active,limited:selected.limited,
      startsAt:selected.starts_at,endsAt:selected.ends_at });
  }
  function saveVisual() {
    if (!selected) return;
    void patch({ action:"visual",id:selected.id,animationTier:selected.animation_tier ?? "small",
      celebrationMessage:selected.celebration_message ?? "" });
  }
  if (!data) return <div className="rg-page"><PageHeader eyebrow="Administration" title="Cadeaux" /><p className="mt-5 text-sm text-text-dim">{error || "Chargement…"}</p><Link href="/settings/support/admin" className="mt-4 inline-block text-sm text-cyan">Retour à l’administration</Link></div>;
  function previewFirework() {
    const gift = data?.gifts.find(item => item.id === "feu-artifice");
    if (!gift) { setError("Le cadeau Feu d’artifice est introuvable dans le catalogue."); return; }
    celebrateGift({ id: `admin-preview-${Date.now()}`, gift: { id: gift.id, name: gift.name,
      image_url: gift.image_url, animation_type: gift.animation_type, rarity: gift.rarity }, quantity: 1,
      senderId: "admin-preview-sender", senderName: "Aperçu expéditeur", senderAvatarUrl: null,
      recipientId: "admin-preview-recipient", recipientName: "Aperçu destinataire", recipientAvatarUrl: null,
      totalRev: null, totalReward: null, createdAt: new Date().toISOString(), context: "dm",
      animationTier: "prestige", celebrationMessage: gift.celebration_message
        || "Certaines personnes méritent bien plus que des étoiles… Elles méritent un ciel entier illuminé pour elles.", demo: true });
  }
  return <div className="rg-page rg-gift-admin">
    <PageHeader eyebrow="Administration" title="Cadeaux" subtitle="Catalogue, probabilités, progression REV et suivi des transactions." />
    <Link href="/settings/support/admin" className="text-sm text-cyan">← Administration de l’assistance</Link>
    <section className="rg-gift-admin-preview"><div><span>DÉMONSTRATION VISUELLE</span><h2>Feu d’artifice</h2><p>Prévisualisation sans débit, récompense, notification ni écriture en base.</p></div><button type="button" onClick={previewFirework}>Tester l’animation Feu d’artifice</button></section>
    {!data.activationAllowed && <p className="rg-gift-admin-lock">Les récompenses aléatoires et les envois restent désactivés. Une validation juridique et économique, puis la variable serveur GIFT_FINANCIAL_APPROVED=1, sont nécessaires avant activation.</p>}
    {error && <p role="alert" className="rg-gift-error">{error}</p>}{notice && <p role="status" className="text-sm text-amber">{notice}</p>}
    <section><h2>Bilan</h2><div className="rg-gift-admin-metrics">{[["Envois",data.metrics?.sent_count],["Cadeaux",data.metrics?.items_sent],["Pièces dépensées",data.metrics?.coins_spent],["REV attribués",data.metrics?.rev_distributed],["Pièces de renta",data.metrics?.coins_rewarded],["Échecs",data.metrics?.failed_attempts]].map(([label,value])=><div key={String(label)}><strong>{Number(value??0).toLocaleString("fr-FR")}</strong><span>{label}</span></div>)}</div></section>
    <section><div className="rg-gift-admin-heading"><h2>Catalogue ({data.gifts.length})</h2><button type="button" onClick={() => setSelected({ ...blank })}>Ajouter un cadeau</button></div><div className="rg-gift-admin-catalog">{data.gifts.map(gift=><button key={gift.id} type="button" onClick={() => setSelected({ ...gift })}>
      <GiftArt src={gift.image_url} name={gift.name} animation={gift.animation_type} size={60} /><span><strong>{gift.name}</strong><small>{gift.price_coins} pièces · {gift.rev_points} REV · {gift.active ? "En vente" : "Désactivé"}</small></span>
    </button>)}</div></section>
    {selected && <section className="rg-gift-admin-editor"><div className="rg-gift-admin-heading"><h2>{data.gifts.some(gift=>gift.id===selected.id) ? "Modifier le cadeau" : "Nouveau cadeau"}</h2><button type="button" onClick={() => setSelected(null)}>Fermer</button></div><form onSubmit={saveGift}>
      <label>Identifiant<input className={field} value={selected.id} disabled={data.gifts.some(gift=>gift.id===selected.id)} onChange={event=>setSelected({ ...selected,id:event.target.value })} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
      <label>Nom<input className={field} value={selected.name} onChange={event=>setSelected({ ...selected,name:event.target.value })} required /></label>
      <label>Prix en pièces<input className={field} type="number" min="10" max="100000" step="2" value={selected.price_coins} onChange={event=>setSelected({ ...selected,price_coins:Number(event.target.value) })} required /></label>
      <label>REV reçus<input className={field} value={Number(selected.price_coins)/2} readOnly title="50 % du prix, calculé automatiquement" /></label>
      <label>Animation<select className={field} value={selected.animation_type} onChange={event=>setSelected({ ...selected,animation_type:event.target.value })}>{animations.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Catégorie d’animation<select className={field} value={selected.animation_tier ?? "small"} onChange={event=>setSelected({ ...selected,animation_tier:event.target.value as NonNullable<Gift["animation_tier"]> })}><option value="small">Petit cadeau</option><option value="medium">Intermédiaire</option><option value="prestige">Prestige</option></select></label>
      <label className="rg-gift-admin-message">Message personnalisé<textarea className={field} maxLength={240} rows={3} value={selected.celebration_message ?? ""} onChange={event=>setSelected({ ...selected,celebration_message:event.target.value })} /></label>
      <label>Rareté<select className={field} value={selected.rarity} onChange={event=>setSelected({ ...selected,rarity:event.target.value as Gift["rarity"] })}>{["common","uncommon","rare","epic","legendary"].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Début (ISO)<input className={field} type="datetime-local" value={selected.starts_at?.slice(0,16)??""} onChange={event=>setSelected({ ...selected,starts_at:event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
      <label>Fin (ISO)<input className={field} type="datetime-local" value={selected.ends_at?.slice(0,16)??""} onChange={event=>setSelected({ ...selected,ends_at:event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
      <label className="rg-gift-admin-check"><input type="checkbox" checked={selected.active} onChange={event=>setSelected({ ...selected,active:event.target.checked })} /> En vente</label>
      <label className="rg-gift-admin-check"><input type="checkbox" checked={selected.limited} onChange={event=>setSelected({ ...selected,limited:event.target.checked })} /> Édition limitée</label>
      <label className="rg-gift-admin-art">Illustration<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={event=>{ const file=event.target.files?.[0]; if(file) void upload(file); event.target.value=""; }} /><small>{selected.image_url || "Aucune image choisie"}</small></label>
      <button type="submit" disabled={busy || !selected.image_url}>Enregistrer le cadeau</button>
      <button type="button" disabled={busy || !selected.id} onClick={saveVisual}>Enregistrer animation et message</button>
    </form></section>}
    {settings && <section><h2>Limites et activation</h2><form className="rg-gift-admin-settings" onSubmit={event=>{event.preventDefault();void patch({ action:"settings",...settings });}}>
      {(["max_quantity","max_daily_spend","max_daily_to_recipient","cooldown_seconds","min_account_age_hours"] as const).map(key=><label key={key}>{({max_quantity:"Quantité maximale",max_daily_spend:"Dépense par 24 h",max_daily_to_recipient:"Vers un joueur par 24 h",cooldown_seconds:"Pause entre envois (s)",min_account_age_hours:"Âge minimal du compte (h)"})[key]}<input className={field} type="number" min="0" value={settings[key]} onChange={event=>setSettings({ ...settings,[key]:Number(event.target.value) })} /></label>)}
      <label className="rg-gift-admin-check"><input type="checkbox" checked={settings.gifts_enabled} disabled={!data.activationAllowed} onChange={event=>setSettings({ ...settings,gifts_enabled:event.target.checked })} /> Envois activés</label>
      <label className="rg-gift-admin-check"><input type="checkbox" checked={settings.renta_enabled} disabled={!data.activationAllowed} onChange={event=>setSettings({ ...settings,renta_enabled:event.target.checked })} /> Renta activée</label>
      <button type="submit" disabled={busy}>Enregistrer les limites</button>
    </form></section>}
    <section><h2>Probabilités par bande</h2><p>Poids relatifs. Un montant entier est tiré dans la bande choisie ; les mêmes poids s’appliquent à tous les joueurs.</p><div className="rg-gift-admin-bands">{bands.map((band,index)=><div key={`${band.rule}:${band.band}`}><strong>{band.rule === "thirty" ? "Cadeaux à 30" : "50 pièces et plus"} · bande {band.band}</strong><span>{band.rule === "thirty" ? `${band.min_amount}–${band.max_amount} pièces` : `${Math.round(Number(band.min_percent)*100)}–${Math.round(Number(band.max_percent)*100)} %`}</span><label>Poids<input className={field} type="number" min="0" max="10000" value={band.weight} onChange={event=>setBands(bands.map((item,i)=>i===index?{...item,weight:Number(event.target.value)}:item))} /></label><button type="button" disabled={busy} onClick={()=>void patch({action:"band",rule:band.rule,band:band.band,weight:band.weight})}>Enregistrer</button></div>)}</div>
      <div className="rg-gift-admin-yield"><strong>Rendement théorique par cadeau</strong>{[10,30,50,100,250,500,520].map(price=>{const value=theoreticalGiftReward(price,bands);return <span key={price}>{price} pièces → {value ? `${value.expected.toFixed(2)} pièces en moyenne (${value.returnPercent.toFixed(1)} %)` : "configuration invalide"}</span>;})}</div>
    </section>
    <section><h2>Paliers REV initiaux</h2><p>Barème provisoire, indépendant de l’XP. Les points REV ne sont pas dépensables.</p><div className="rg-gift-admin-levels">{levels.map((level,index)=><div key={level.level}><strong>Niveau {level.level}</strong><input className={field} aria-label={`Seuil REV niveau ${level.level}`} type="number" min="0" value={level.required_total} disabled={level.level===1} onChange={event=>setLevels(levels.map((item,i)=>i===index?{...item,required_total:Number(event.target.value)}:item))} /><input className={field} aria-label={`Nom niveau ${level.level}`} value={level.label} disabled={level.level===1} onChange={event=>setLevels(levels.map((item,i)=>i===index?{...item,label:event.target.value}:item))} /><button type="button" disabled={busy||level.level===1} onClick={()=>void patch({action:"level",level:level.level,requiredTotal:level.required_total,label:level.label})}>Enregistrer</button></div>)}</div></section>
    <section><h2>Derniers envois</h2><div className="rg-gift-admin-log">{data.sends.length ? data.sends.map(send=><p key={send.id}><time>{new Date(send.created_at).toLocaleString("fr-FR")}</time> · {send.gift_id} ×{send.quantity} · {send.total_price} pièces débitées · {send.total_rev} REV · {send.total_reward} pièces de renta · {send.context}</p>) : <p>Aucun envoi.</p>}</div></section>
    <section><h2>Tentatives en erreur</h2><div className="rg-gift-admin-log">{data.attempts.length ? data.attempts.map(attempt=><p key={attempt.id}><time>{new Date(attempt.created_at).toLocaleString("fr-FR")}</time> · {attempt.gift_id || "Cadeau inconnu"} · code {attempt.error_code}</p>) : <p>Aucune tentative en erreur.</p>}</div></section>
    <section><h2>Journal administrateur</h2><div className="rg-gift-admin-log">{data.audits.length ? data.audits.map(audit=><p key={audit.id}><time>{new Date(audit.created_at).toLocaleString("fr-FR")}</time> · {audit.action} · {audit.target}</p>) : <p>Aucune modification.</p>}</div></section>
  </div>;
}
