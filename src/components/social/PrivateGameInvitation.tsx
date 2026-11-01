'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { respondToGameInvitation } from '@/lib/social/api';
import { invitationPath } from '@/lib/social/invitation-path';
import { GAMES } from '@/data/games';

type Invitation = { id: string; game_slug: string; status: string; expires_at: string; room_code: string | null; room_instance: string | null };

export function PrivateGameInvitation({ id, own, onJoined }: { id: string; own: boolean; onJoined: () => void }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    const db = createClient();
    const load = async () => {
      const { data } = await db.from('game_invitations').select('id,game_slug,status,expires_at,room_code,room_instance').eq('id', id).single();
      if (!stopped) { setInvitation(data); setLoaded(true); setNow(Date.now()); }
    };
    const refresh = () => { void load(); };
    const channel = db.channel(`rg-private-invitation-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_invitations', filter: `id=eq.${id}` }, refresh)
      .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    refresh();
    const timer = setInterval(() => { if (!stopped) setNow(Date.now()); }, 5000);
    return () => { stopped = true; clearInterval(timer); void db.removeChannel(channel); };
  }, [id]);

  if (!loaded) return <p className="mt-1 text-xs text-text-faint">Chargement de l’invitation…</p>;
  if (!invitation) return <p className="mt-1 text-xs text-text-faint">Invitation indisponible.</p>;
  const game = GAMES.find(g => g.id === invitation.game_slug);
  const expired = invitation.status === 'pending' && new Date(invitation.expires_at).getTime() <= now;
  const resumable = invitation.status === 'accepted' && Boolean(invitation.room_instance);
  const joinable = !own && game?.enabled && ((!expired && invitation.status === 'pending') || resumable);
  const status = expired ? 'Invitation expirée' : invitation.status === 'declined' ? 'Invitation refusée' :
    invitation.status === 'cancelled' ? 'Invitation remplacée ou annulée' : invitation.status === 'accepted' ? 'Invitation acceptée' : 'Invitation à jouer';

  async function join() {
    setBusy(true); setError('');
    const result = await respondToGameInvitation(id, true);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    if (result.data?.status === 'accepted') {
      onJoined();
      router.push(invitationPath(result.data));
    }
  }

  return <div className="mt-1 flex w-full flex-col gap-2 rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-left" aria-label={`Invitation privée à ${game?.name || invitation.game_slug}`}>
    <p className="font-display text-xs font-semibold text-cyan">{game?.name || invitation.game_slug}</p>
    <p className="font-body text-xs text-text-dim" role="status">{status}</p>
    {joinable && <button type="button" disabled={busy} onClick={join}
      className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void disabled:opacity-50">
      {busy ? 'Connexion…' : resumable ? 'Reprendre la partie' : invitation.room_code ? 'Rejoindre' : 'Ouvrir le jeu'}
    </button>}
    {error && <p role="alert" className="font-body text-xs text-text-dim">{error}</p>}
  </div>;
}
