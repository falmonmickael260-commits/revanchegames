"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSession } from "@/lib/use-session";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS, type SupportMessage, type SupportTicket } from "@/lib/support";

const fieldClass = "w-full rounded-lg border border-border-soft bg-void px-3 py-2 text-sm text-text focus:border-cyan focus:outline-none";
type TicketDetail = { ticket: SupportTicket; messages: SupportMessage[]; events: { id: string; status: keyof typeof SUPPORT_STATUS; created_at: string }[] };

export function SupportDesk({ admin = false, transaction = "" }: { admin?: boolean; transaction?: string }) {
  const { user, loading } = useSession();
  const userId = user?.id;
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [messageOffset, setMessageOffset] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/support/tickets?offset=${offset}${admin ? "&scope=admin" : ""}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lecture impossible.");
      if (signal?.aborted) return;
      setTickets(data.tickets); setUnread(data.unreadCount); setIsAdmin(data.isAdmin); setOwner(userId);
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Lecture impossible."); }
  }, [userId, offset, admin]);
  const refreshDetail = useCallback(async (signal?: AbortSignal) => {
    if (!selected || !userId) return;
    try {
      const response = await fetch(`/api/support/tickets/${selected}?offset=${messageOffset}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lecture impossible.");
      if (!signal?.aborted) setDetail(data);
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Lecture impossible."); }
  }, [selected, userId, messageOffset]);
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void refresh(controller.signal), 0);
    const interval = setInterval(() => void refresh(controller.signal), 30000);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(interval); };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void refreshDetail(controller.signal), 0);
    const interval = setInterval(() => void refreshDetail(controller.signal), 30000);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(interval); };
  }, [refreshDetail]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("screenshot");
    if (file instanceof File && file.size && (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Capture : JPEG, PNG ou WebP, 5 Mo maximum."); return;
    }
    submitting.current = true; setBusy(true); setError(""); setNotice("");
    requestId.current ||= crypto.randomUUID(); data.set("requestId", requestId.current);
    try {
      const response = await fetch("/api/support/tickets", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Envoi impossible.");
      requestId.current = null; form.reset(); setSelected(result.id); setMessageOffset(0);
      setNotice(`Demande reçue. Référence : ${result.id}`); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Envoi impossible."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/support/tickets/${selected}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: data.get("message") || "", ...(admin ? { status: data.get("status") } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Envoi impossible.");
      form.reset(); setNotice("Demande mise à jour."); await Promise.all([refresh(), refreshDetail()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Envoi impossible."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function markRead() {
    try {
      const response = await fetch("/api/support/notifications", { method: "POST" });
      if (!response.ok) throw new Error("Mise à jour impossible.");
      setUnread(0);
    } catch { setError("Mise à jour des notifications impossible."); }
  }
  const active = owner === userId && detail?.ticket.id === selected ? detail : null;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow={admin ? "Administration" : "Compte"} title={admin ? "Administration de l’assistance" : "Nous contacter / Assistance et litiges"}
        subtitle="Tes échanges avec l’équipe restent privés. Ne transmets jamais de numéro de carte, de cryptogramme, de mot de passe ou de clé secrète." />
      <div className="flex flex-wrap gap-4 text-sm text-cyan">
        <Link href="/settings">Paramètres</Link><Link href="/profile#mes-achats">Mes achats</Link>
        {!admin && isAdmin && <Link href="/settings/support/admin">Administration</Link>}
        {admin && <Link href="/settings/support">Mes demandes</Link>}
      </div>
      {loading ? <p className="text-text-dim">Chargement…</p> : !user || user.is_anonymous ? <Link href="/sign-in" className="text-cyan">Connecte-toi pour créer et consulter tes demandes.</Link> : <>
        {error && <p role="alert" className="rounded-xl border border-amber/30 p-4 text-sm text-amber">{error}</p>}
        {notice && <p role="status" className="text-sm text-cyan">{notice}</p>}
        {unread > 0 && <button type="button" onClick={markRead} className="self-start text-sm text-cyan">{unread} notification(s) d’assistance · Marquer comme lues</button>}
        {!admin && <form onSubmit={create} className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-text">Nouvelle demande</h2>
          <label className="flex flex-col gap-1 text-sm text-text-dim">Catégorie
            <select name="category" required className={fieldClass}>{Object.entries(SUPPORT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-dim">Objet<input name="subject" required minLength={3} maxLength={150} className={fieldClass} /></label>
          <label className="flex flex-col gap-1 text-sm text-text-dim">Description détaillée
            <textarea name="description" required minLength={20} maxLength={5000} rows={5} className={fieldClass} placeholder="Décris le problème, sa date, le jeu concerné et les étapes pour le reproduire. Pour un signalement, précise le pseudo du joueur." />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-dim">Référence de transaction (facultatif)<input name="transactionReference" maxLength={160} defaultValue={transaction} className={fieldClass} /></label>
          <label className="flex flex-col gap-1 text-sm text-text-dim">Capture d’écran (facultatif)
            <input name="screenshot" type="file" accept="image/jpeg,image/png,image/webp" className={fieldClass} />
            <span className="text-xs text-text-faint">JPEG, PNG ou WebP · 5 Mo maximum. Masque toutes les données bancaires et informations sensibles avant l’envoi.</span>
          </label>
          <button disabled={busy} className="self-start rounded-lg bg-cyan px-4 py-2 font-display text-sm font-semibold text-void disabled:opacity-50">{busy ? "Envoi…" : "Envoyer la demande"}</button>
        </form>}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between gap-3"><h2 className="font-display text-lg font-semibold text-text">{admin ? "Demandes des joueurs" : "Mes demandes"}</h2><button type="button" onClick={() => { void refresh(); void refreshDetail(); }} className="text-sm text-cyan">Actualiser</button></div>
          {owner === userId && !tickets.length && <p className="text-sm text-text-dim">Aucune demande sur cette page.</p>}
          {owner === userId && tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => { setSelected(ticket.id); setMessageOffset(0); }} className={`rounded-xl border bg-surface p-4 text-left ${selected === ticket.id ? "border-cyan" : "border-border-soft"}`}>
            <p className="flex flex-wrap justify-between gap-2 font-display text-sm font-semibold text-text"><span>{ticket.subject}</span><span className="text-cyan">{SUPPORT_STATUS[ticket.status]}</span></p>
            <p className="mt-1 break-all text-xs text-text-faint">{new Date(ticket.created_at).toLocaleString("fr-FR")} · {ticket.id}</p>
          </button>)}
          <div className="flex justify-between text-sm text-cyan"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))} className="disabled:opacity-40">Précédent</button><button disabled={tickets.length < 20} onClick={() => setOffset(offset + 20)} className="disabled:opacity-40">Suivant</button></div>
        </section>
        {active && <section className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-5">
          <h2 className="break-words font-display text-lg font-semibold text-text">{active.ticket.subject}</h2>
          <p className="text-sm text-cyan">{SUPPORT_CATEGORIES[active.ticket.category]} · {SUPPORT_STATUS[active.ticket.status]}</p>
          <p className="whitespace-pre-wrap break-words text-sm text-text-dim">{active.ticket.description}</p>
          {active.ticket.transaction_reference && <p className="break-all text-xs text-text-faint">Transaction : {active.ticket.transaction_reference}</p>}
          {admin && <p className="break-all text-xs text-text-faint">Compte joueur : {active.ticket.user_id}</p>}
          {active.ticket.attachment_path && <a href={`/api/support/tickets/${active.ticket.id}/attachment`} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan">Consulter la capture privée</a>}
          {admin && <p className="text-xs text-text-faint">Vérifie le paiement et le mode dans Stripe avant toute action. Un changement de statut du ticket ne déclenche aucun remboursement.</p>}
          <ol className="flex flex-col gap-3">{active.messages.map((message) => <li key={message.id} className="rounded-lg bg-void p-3">
            <p className="text-xs text-cyan">{message.from_admin ? "Équipe Revanche Games" : "Joueur"} · {new Date(message.created_at).toLocaleString("fr-FR")}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-dim">{message.body}</p>
          </li>)}</ol>
          <div className="flex justify-between text-sm text-cyan"><button disabled={!messageOffset} onClick={() => setMessageOffset(Math.max(0, messageOffset - 50))} className="disabled:opacity-40">Réponses précédentes</button><button disabled={active.messages.length < 50} onClick={() => setMessageOffset(messageOffset + 50)} className="disabled:opacity-40">Réponses suivantes</button></div>
          <form key={active.ticket.id + active.ticket.updated_at} onSubmit={reply} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-text-dim">Répondre<textarea name="message" rows={3} maxLength={5000} required={!admin} className={fieldClass} /></label>
            {admin && <label className="flex flex-col gap-1 text-sm text-text-dim">État de la demande<select name="status" defaultValue={active.ticket.status} className={fieldClass}>{Object.entries(SUPPORT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            <button disabled={busy} className="self-start rounded-lg bg-cyan px-4 py-2 font-display text-sm font-semibold text-void disabled:opacity-50">{busy ? "Envoi…" : admin ? "Enregistrer la réponse et le statut" : "Envoyer la réponse"}</button>
          </form>
          <details className="text-xs text-text-faint"><summary>Historique des statuts</summary><ul className="mt-2 flex flex-col gap-1">{active.events.map((event) => <li key={event.id}>{new Date(event.created_at).toLocaleString("fr-FR")} · {SUPPORT_STATUS[event.status]}</li>)}</ul></details>
        </section>}
      </>}
    </div>
  );
}
