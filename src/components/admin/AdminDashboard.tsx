"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSocial } from "@/components/social/SocialProvider";

type Player = { id: string; username: string; created_at: string; suspended: boolean; isAdmin: boolean };
type Report = { id: string; reporter_id: string; target_user_id: string | null; kind: string; details: string | null; context: string | null; status: string; created_at: string };
type Audit = { id: string; actor_id: string; target_id: string; action: string; reason: string; created_at: string };
type Dashboard = { actorId: string; players: Player[]; matchingPlayers: number; adminCount: number; openTickets: number; reports: Report[]; totalPlayers: number; games: number; audit: Audit[] };
const labels: Record<string, string> = { suspend: "Suspendre", restore: "Réactiver", reviewing: "Examiner", resolved: "Résoudre", dismissed: "Classer sans suite" };
const date = (value: string) => new Date(value).toLocaleDateString("fr-FR");
const panel = "rounded-2xl border border-border-soft bg-surface p-5";
const button = "rounded-lg border border-border-soft px-3 py-2 text-sm text-cyan disabled:opacity-40";

export function AdminDashboard() {
  const { me } = useSocial();
  const userId = me?.id;
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadedUser, setLoadedUser] = useState<string>();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{ targetId: string; action: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/admin?search=${encodeURIComponent(query)}&page=${page}`, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Chargement impossible.");
      if (!signal?.aborted) { setData(result); setLoadedUser(userId); setError(""); }
    } catch (error) {
      if (!signal?.aborted) { setData(null); setError(error instanceof Error ? error.message : "Chargement impossible."); }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [query, page, userId]);
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void load(controller.signal), 0);
    return () => { clearTimeout(initial); controller.abort(); };
  }, [load]);
  const current = loadedUser === userId ? data : null;

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!pending || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pending, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action impossible.");
      setPending(null); setReason(""); setNotice("Action enregistrée dans le journal administrateur."); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Action impossible."); }
    finally { setSaving(false); }
  }
  function choose(targetId: string, action: string, name: string) { setReason(""); setNotice(""); setPending({ targetId, action, name }); }

  return <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
    <PageHeader eyebrow="Revanche Games" title="Administration" subtitle="Pilotez les comptes, la modération et les outils de la plateforme." action={<button className={button} disabled={loading || saving} onClick={() => { setLoading(true); void load(); }}>Actualiser</button>} />
    {error && <p role="alert" className="rounded-xl border border-amber/40 p-4 text-amber">{error}</p>}
    {notice && <p role="status" className="text-cyan">{notice}</p>}
    {loading && <p role="status" className="text-text-dim">Chargement des données…</p>}
    {!loading && !current && <Link href="/sign-in" className={button}>Se connecter avec un compte administrateur</Link>}
    {current && <>
      <section aria-label="Vue d’ensemble" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Joueurs inscrits", current.totalPlayers], ["Parties terminées", current.games], ["Demandes à traiter", current.openTickets], ["Administrateurs", current.adminCount]].map(([name, value]) => <div key={name} className={panel}><p className="text-sm text-text-dim">{name}</p><strong className="mt-2 block text-3xl text-text">{value}</strong></div>)}
      </section>
      <nav aria-label="Outils administrateur" className="grid gap-3 sm:grid-cols-2">
        <Link href="/settings/support/admin" className={panel}><h2 className="font-semibold text-cyan">Assistance et litiges →</h2><p className="mt-2 text-sm text-text-dim">Répondre aux joueurs, consulter les pièces jointes et suivre les demandes de paiement ou de remboursement.</p></Link>
        <Link href="/settings/gifts/admin" className={panel}><h2 className="font-semibold text-cyan">Cadeaux et économie →</h2><p className="mt-2 text-sm text-text-dim">Gérer le catalogue, les visuels, les règles et consulter les transactions de cadeaux.</p></Link>
      </nav>
      {pending && <section className={panel} aria-label="Confirmation de l’action"><h2 className="text-lg font-semibold text-text">{labels[pending.action]} : {pending.name}</h2>
        {pending.action === "suspend" && <p className="mt-2 text-sm text-amber">Le joueur ne pourra plus se connecter. Ses sessions seront révoquées ; un accès déjà autorisé peut rester valide jusqu’à expiration du jeton.</p>}
        <form onSubmit={apply} className="mt-4 flex flex-col gap-3"><label className="text-sm text-text-dim" htmlFor="admin-reason">Motif obligatoire (conservé dans le journal)</label><textarea id="admin-reason" required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="rounded-lg border border-border-soft bg-surface-raised p-3 text-text" /><div className="flex gap-3"><button disabled={saving || reason.trim().length < 5} className={button}>{saving ? "Enregistrement…" : "Confirmer"}</button><button type="button" disabled={saving} className={button} onClick={() => setPending(null)}>Annuler</button></div></form>
      </section>}
      <section className={panel}><h2 className="text-xl font-semibold text-text">Joueurs</h2>
        <form onSubmit={e => { e.preventDefault(); setLoading(true); setPage(0); setQuery(search.trim()); if (page === 0 && query === search.trim()) void load(); }} className="my-4 flex flex-wrap gap-2"><label htmlFor="player-search" className="sr-only">Rechercher un pseudonyme</label><input id="player-search" placeholder="Rechercher un pseudonyme" maxLength={60} value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface-raised px-3 py-2 text-text" /><button className={button} disabled={loading}>Rechercher</button></form>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-text"><thead><tr className="border-b border-border-soft text-text-dim"><th className="p-3">Joueur</th><th className="p-3">Inscription</th><th className="p-3">État</th><th className="p-3">Action</th></tr></thead><tbody>{current.players.map(player => <tr key={player.id} className="border-b border-border-soft"><td className="p-3"><Link className="text-cyan" href={`/profile/${player.id}`}>{player.username}</Link><small className="block text-text-faint">{player.id}</small></td><td className="p-3">{date(player.created_at)}</td><td className="p-3">{player.isAdmin ? "Administrateur" : player.suspended ? "Suspendu" : "Actif"}</td><td className="p-3">{player.isAdmin ? "Compte protégé" : <button disabled={saving} className={button} onClick={() => choose(player.id, player.suspended ? "restore" : "suspend", player.username)}>{player.suspended ? "Réactiver" : "Suspendre"}</button>}</td></tr>)}</tbody></table></div>
        {!current.players.length && <p className="py-4 text-text-dim">Aucun joueur trouvé.</p>}
        <div className="mt-4 flex items-center justify-between gap-3"><button disabled={page === 0 || loading} className={button} onClick={() => { setLoading(true); setPage(page - 1); }}>Précédent</button><span className="text-sm text-text-dim">Page {page + 1} · {current.matchingPlayers} résultat(s)</span><button disabled={(page + 1) * 20 >= current.matchingPlayers || loading} className={button} onClick={() => { setLoading(true); setPage(page + 1); }}>Suivant</button></div>
      </section>
      <section className={panel}><h2 className="text-xl font-semibold text-text">Signalements à traiter</h2><p className="my-2 text-sm text-text-dim">Les 50 plus anciens signalements ouverts ou en cours.</p><div className="flex flex-col gap-3">{current.reports.map(report => <article key={report.id} className="rounded-xl border border-border-soft p-4"><div className="flex justify-between gap-3"><strong className="text-text">{report.kind} · {report.status === "open" ? "Nouveau" : "En cours"}</strong><time className="text-sm text-text-dim">{date(report.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-text">{report.details || "Aucun détail fourni."}</p><p className="my-2 break-all text-xs text-text-faint">Auteur : {report.reporter_id} · Cible : {report.target_user_id || "Plateforme"} · Contexte : {report.context || "—"}</p><div className="flex flex-wrap gap-2">{["reviewing", "resolved", "dismissed"].map(action => <button key={action} disabled={saving || report.status === action} className={button} onClick={() => choose(report.id, action, `signalement ${report.id}`)}>{labels[action]}</button>)}</div></article>)}{!current.reports.length && <p className="text-sm text-text-dim">Aucun signalement en attente.</p>}</div></section>
      <section className={panel}><h2 className="mb-4 text-xl font-semibold text-text">Journal des actions</h2><p className="mb-3 text-sm text-text-dim">Les 20 dernières actions sur les comptes et signalements. Les outils d’assistance et de cadeaux conservent leurs propres historiques.</p>{current.audit.map(entry => <article key={entry.id} className="border-b border-border-soft py-3 text-sm"><p className="text-text">{labels[entry.action]} · {date(entry.created_at)}</p><p className="whitespace-pre-wrap break-words text-text-dim">{entry.reason}</p><p className="break-all text-xs text-text-faint">Administrateur : {entry.actor_id} · Cible : {entry.target_id}</p></article>)}{!current.audit.length && <p className="text-text-dim">Aucune action enregistrée.</p>}</section>
    </>}
  </div>;
}
