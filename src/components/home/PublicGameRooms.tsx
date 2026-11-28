'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, RefreshCw, Users, Search } from 'lucide-react';
import { GameArt } from '@/components/library/GameArt';
import { GAMES } from '@/data/games';
import { PUBLIC_ROOM_GAMES } from '@/lib/game-connector/protocol';
import type { PublicGameRoom } from '@/lib/game-connector/public-rooms';
import { useSocial } from '@/components/social/SocialProvider';
import { useGameSession } from '@/components/game/GameSessionProvider';

const publicGames = GAMES.filter(game => game.enabled && (PUBLIC_ROOM_GAMES as readonly string[]).includes(game.id));

export function PublicGameRooms({visible=true}:{visible?:boolean}) {
  const router = useRouter();
  const { active } = useGameSession();
  const { me } = useSocial();
  const [showGames, setShowGames] = useState(false);
  const [gameFilter,setGameFilter]=useState('all');
  const [roomQuery,setRoomQuery]=useState('');
  const [rooms, setRooms] = useState<PublicGameRoom[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const joiningRef = useRef(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if(!visible)return;
    if(process.env.NEXT_PUBLIC_RG_VISUAL_PREVIEW==="1"){setRooms([]);setLoadError(false);return;}
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch('/api/game/rooms/public', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error();
        const nextRooms = await response.json();
        if (!controller.signal.aborted) {
          setRooms(nextRooms);
          setLoadError(false);
        }
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      request?.abort();
    };
  }, [reload, me?.id, visible]);

  async function join(room: PublicGameRoom) {
    if (room.isHost && active?.slug === room.game_slug && active.roomCode === room.ownRoomCode) {
      router.push(`/play/${room.game_slug}`);
      return;
    }
    if (joiningRef.current) return;
    joiningRef.current = true;
    setJoining(room.id);
    setJoinError('');
    try {
      const response = await fetch('/api/game/rooms/public', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: room.id }),
      });
      if (response.status === 401) {
        router.push('/sign-in?next=%2F%23salons');
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible de rejoindre ce salon.');
      router.push(`/play/${room.game_slug}?salon=${room.id}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Impossible de rejoindre ce salon.');
      setReload(value => value + 1);
    } finally {
      joiningRef.current = false;
      setJoining(null);
    }
  }

  const visibleRooms=rooms?.filter(room=>(gameFilter==='all'||gameFilter===room.game_slug)&&(`${room.host_name} ${GAMES.find(game=>game.id===room.game_slug)?.name??room.game_slug}`).toLocaleLowerCase().includes(roomQuery.trim().toLocaleLowerCase()));
  return (
    <section id="salons" className="rg-home-section scroll-mt-24" aria-labelledby="public-rooms-title">
      <div className="rg-section-heading">
        <div><h2 id="public-rooms-title">Salons</h2><p>Parties publiques en attente de joueurs.</p></div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setReload(value => value + 1)} className="rg-text-link p-2" aria-label="Actualiser les salons">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowGames(value => !value)} aria-expanded={showGames} aria-controls="public-room-games" className="rg-primary-button">
            <Plus className="h-4 w-4" /> Créer une partie
          </button>
        </div>
      </div>
      <div className="rg-room-filters"><label><Search/><input aria-label="Rechercher un salon" placeholder="Rechercher un salon…" value={roomQuery} onChange={event=>setRoomQuery(event.target.value)}/></label><div className="rg-room-game-filter"><button type="button" aria-pressed={gameFilter==='all'} onClick={()=>setGameFilter('all')}>Tous</button>{publicGames.map(game=><button type="button" key={game.id} aria-pressed={gameFilter===game.id} onClick={()=>setGameFilter(game.id)}>{game.name}</button>)}</div></div>
      <div id="public-room-games" hidden={!showGames} className="mb-3 rounded-2xl border border-border-soft bg-surface p-3">
        <p className="mb-2 text-xs text-text-dim">Choisis un jeu et crée ton salon. Il apparaîtra sur l’Accueil.</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {publicGames.map(game => {
            const href = `/play/${game.id}?public=1`;
            return <li key={game.id}>
              <Link href={me ? href : `/sign-in?next=${encodeURIComponent(href)}`} className="rg-room-create-game block rounded-xl border border-border-soft px-3 py-2 text-sm font-semibold text-text hover:bg-surface-raised">
                <GameArt game={game} className="rg-room-create-art"/><span>{game.name}</span>
              </Link>
            </li>;
          })}
        </ul>
      </div>
      {joinError && <p role="alert" className="mb-3 text-sm text-text">{joinError}</p>}
      {loadError ? <p role="status" className="text-sm text-text-dim">Les salons sont momentanément indisponibles.</p>
        : rooms === null ? <p role="status" className="text-sm text-text-dim">Chargement des salons…</p>
        : rooms.length === 0 ? (
          <div className="rg-inline-empty">
            <Users className="h-5 w-5" />
            <p>{process.env.NEXT_PUBLIC_RG_VISUAL_PREVIEW==="1"?"Aperçu : salons de production non connectés.":"Aucune partie publique pour le moment."}</p>
            <Link href={active?.roomCode ? `/play/${active.slug}` : '/library'}>
              {active?.roomCode ? 'Ouvrir mon salon' : 'Choisir un jeu'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="rg-room-list grid gap-2 sm:grid-cols-2">
            {visibleRooms?.length===0&&<li className="rg-room-no-result">Aucun salon ne correspond à ta recherche.</li>}
            {visibleRooms?.map(room => {
              const game = GAMES.find(game => game.id === room.game_slug);
              return (
                <li key={room.id} className="rg-room-entry flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface p-3">
                  {game&&<GameArt game={game} className="rg-room-entry-art"/>}
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-text">{game?.name ?? room.game_slug}</h3>
                    <p className="truncate text-xs text-text-dim">{room.host_name} · {room.player_count}/{room.capacity} joueurs</p>
                  </div>
                  <button type="button" disabled={joining !== null} className="rg-primary-button shrink-0 disabled:opacity-50" onClick={() => void join(room)}>
                    {joining === room.id ? 'Connexion…' : room.isHost ? 'Reprendre ma partie' : 'Rejoindre'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}
