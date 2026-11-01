import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { openGameContext } from '@/lib/game-connector/server';
import { registerGameRoom } from '@/lib/game-connector/platform';
import { DirectInvitePicker } from '@/components/social/DirectInvitePicker';

export default function InvitePage({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
  return <Suspense fallback={<p className="p-6 text-text-dim">Vérification du salon…</p>}><InviteContext params={searchParams} /></Suspense>;
}
async function InviteContext({ params }: { params: Promise<{ context?: string }> }) {
  await connection();
  const { context } = await params;
  if (!context) return <p className="p-6">Ouvre « Inviter un ami » depuis ton jeu.</p>;
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user || user.is_anonymous) redirect(`/sign-in?next=${encodeURIComponent(`/invite?context=${encodeURIComponent(context)}`)}`);
  let room, game;
  try {
    const value = openGameContext(context);
    if (value.uid && value.uid !== user.id) throw new Error('Connecte-toi avec le compte utilisé dans le jeu.');
    room = await registerGameRoom(value.game, value.session); game = value.game;
  } catch (error) { return <p role="alert" className="p-6">{error instanceof Error ? error.message : 'Salon indisponible.'}</p>; }
  return <DirectInvitePicker game={game} room={room.code} />;
}
