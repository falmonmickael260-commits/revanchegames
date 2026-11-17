'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Flag, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSocial } from '@/components/social/SocialProvider';
import { ReportDialog } from '@/components/social/ReportDialog';
import { ReportIssueButton } from '@/components/social/ReportIssueButton';
type Player = { id:string; username:string; player_tag:string|null };
export default function ReportPlayerPage() {
  const { me } = useSocial();
  const [query,setQuery] = useState('');
  const [players,setPlayers] = useState<Player[]>([]);
  const [searched,setSearched] = useState(false);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState('');
  const [target,setTarget] = useState<Player|null>(null);
  async function search(event:FormEvent) {
    event.preventDefault();setPending(true);setError('');setPlayers([]);setSearched(false);
    try {
      const response=await fetch(`/api/reports/players?${new URLSearchParams({search:query.trim()})}`,{cache:'no-store'});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Recherche indisponible.');
      setPlayers(result.rows);setSearched(true);
    }catch(error){setError(error instanceof Error?error.message:'Connexion interrompue. Réessaie.');}
    finally{setPending(false);}
  }
  return <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6">
    <PageHeader eyebrow="Profil · Paramètres" title="Signaler un joueur" />
    <p className="text-sm leading-relaxed text-text-dim">Recherche le profil par son pseudo, son identifiant public RG-… ou son UUID. Sélectionne le bon joueur, explique les faits et ajoute jusqu’à trois captures d’écran. La modération examinera le signalement ; aucune sanction n’est automatique.</p>
    {!me ? <p className="rounded-xl border border-border-soft bg-surface p-4 text-sm text-text-dim"><Link className="text-cyan" href="/sign-in?next=%2Fsettings%2Freport">Connecte-toi avec ton compte Revanche Games</Link> pour envoyer un signalement.</p> : <>
      <form onSubmit={search} className="rounded-xl border border-border-soft bg-surface p-4">
        <label className="block text-sm font-semibold text-text">Pseudo ou identifiant du joueur
          <input value={query} minLength={2} maxLength={120} required disabled={pending} onChange={event=>{setQuery(event.target.value);setPlayers([]);setSearched(false);setError('');}} placeholder="Pseudo, RG-identifiant ou UUID" className="mt-2 w-full rounded-lg border border-border-soft bg-void px-3 py-3 text-base text-text placeholder:text-text-faint focus:border-cyan focus:outline-none" />
        </label>
        <button type="submit" disabled={pending||query.trim().length<2} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"><Search className="h-4 w-4" />{pending?'Recherche…':'Rechercher le joueur'}</button>
      </form>
      {error && <p role="alert" className="text-sm text-violet-soft">{error}</p>}
      {!!players.length && <ul aria-label="Profils correspondants" className="flex flex-col gap-2">{players.map(player=><li key={player.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface p-4">
        <div className="min-w-0"><p className="break-words font-semibold text-text">{player.username}</p><p className="break-all text-xs text-text-faint">{player.player_tag?`RG-${player.player_tag}`:player.id}</p></div>
        <button type="button" onClick={()=>setTarget(player)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm text-cyan"><Flag className="h-4 w-4" />Signaler ce joueur</button>
      </li>)}</ul>}
      {searched&&!players.length && <p role="status" className="text-sm text-text-dim">Aucun autre profil ne correspond. Vérifie le pseudo ou copie son identifiant public. Ton propre profil n’apparaît pas dans cette recherche.</p>}
      <div className="text-sm text-text-dim"><p className="mb-3">Profil introuvable, joueur invité ou problème sans cible ? Décris-le dans un signalement de problème et joins tes captures.</p><ReportIssueButton context="profil:parametres:signalement" /></div>
    </>}
    <nav className="flex flex-wrap gap-4 text-sm text-cyan"><Link href="/settings/reports">Suivre mes signalements</Link><Link href="/settings">Retour aux paramètres</Link></nav>
    {target && <ReportDialog target={{id:target.id,username:target.username,playerTag:target.player_tag||undefined}} context="profil:parametres:signalement" requireDetails onClose={()=>setTarget(null)} />}
  </div>;
}
