'use client';
import { useState } from 'react';
import { useSocial } from './SocialProvider';
import { sendGameInvitation } from '@/lib/social/api';
import { requestPushDelivery } from '@/lib/push-client';
import { GAMES } from '@/data/games';
export function DirectInvitePicker({ game, room }: { game: string; room: string }) {
  const { friends } = useSocial();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function invite(id: string) {
    setBusy(true);
    const result = await sendGameInvitation(id, game, room);
    setBusy(false);
    setMessage(result.ok ? 'Invitation envoyée.' : result.error);
    if (result.ok && result.data) void requestPushDelivery({ type: 'game_invitation', invitationId: result.data });
  }
  return <section className="mx-auto flex max-w-lg flex-col gap-4 p-6">
    <h1 className="font-display text-xl text-text">Inviter un ami à {GAMES.find(g => g.id === game)?.name}</h1>
    <p className="text-text-dim">Choisis un ami pour te rejoindre directement dans ta partie.</p>
    {friends.length === 0 && <p className="text-text-dim">Ajoute un ami depuis la rubrique Amis pour pouvoir l’inviter.</p>}
    {friends.map(friend => <button key={friend.id} disabled={busy} onClick={() => invite(friend.id)} className="rounded-xl border border-border bg-surface p-3 text-left text-text disabled:opacity-50">Inviter {friend.username}</button>)}
    {message && <p role="status" className="text-text-dim">{message}</p>}
  </section>;
}
