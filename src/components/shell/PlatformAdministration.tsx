'use client';
import { useEffect, useState } from 'react';
import { useGameSession } from '@/components/game/GameSessionProvider';
import { useSession } from '@/lib/use-session';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function PlatformAdministration(){
  const pathname=usePathname();const {user}=useSession();const {stop}=useGameSession();
  const [state,setState]=useState<{userId:string;restricted:boolean;announcements:{id:string;body:string}[]}|null>(null);
  useEffect(()=>{
    if(!user)return;let cancelled=false;
    async function load(){
      try{const response=await fetch('/api/platform-status',{cache:'no-store'});if(!response.ok)return;
        const data=await response.json();if(cancelled)return;
        setState({userId:user!.id,restricted:Boolean(data.restricted),announcements:data.announcements||[]});
        if(data.restricted)stop();
      }catch{/* Retry on the next tick; backend policies enforce sanctions. */}
    }
    void load();const timer=setInterval(()=>void load(),30000);
    const resume=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',resume);
    return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
  },[user,stop]);
  if(!user||state?.userId!==user.id)return null;
  if(state.restricted&&!pathname.startsWith('/settings/support'))return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-void/95 p-6"><section className="max-w-lg rounded-2xl border border-border bg-surface p-6 text-text"><h2 className="font-display text-xl">Accès au jeu suspendu</h2><p className="my-4 text-text-dim">Une sanction est en cours sur ton compte. Tu peux contacter l’équipe pour obtenir des précisions.</p><Link href="/settings/support" className="text-cyan">Contacter l’assistance</Link></section></div>;
  if(!state.announcements.length)return null;
  return <aside aria-label="Annonces de l’équipe" className="fixed bottom-20 right-4 z-40 max-w-sm space-y-2">{state.announcements.map(a=><div key={a.id} className="rounded-xl border border-cyan/30 bg-surface p-4 text-sm text-text shadow-lg"><p className="mb-1 text-xs text-cyan">Revanche Games · Équipe</p>{a.body}</div>)}</aside>;
}
