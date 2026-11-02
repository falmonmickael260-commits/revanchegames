"use client";
import { useEffect, useState } from "react";
import { createLocalStore } from "./create-local-store";
import { createClient } from "./supabase/client";
type RecentGame = { id: string; openedAt: number };
const store = createLocalStore<RecentGame[]>("recent-games", []);
export function recordRecentGame(id: string) {
  store.set([{ id, openedAt: Date.now() }, ...store.getSnapshot().filter(game => game.id !== id)].slice(0, 12));
}
export function useRecentGames(userId?: string | null) {
  const local=store.useValue()[0];
  const [remote,setRemote]=useState<{userId:string;games:RecentGame[]}|null>(null);
  useEffect(()=>{
    if(!userId)return;
    let stopped=false;
    void createClient().rpc("recent_matches",{p_user_id:userId,p_limit:20}).then(({data})=>{
      if(stopped)return;
      const games=(data??[]).map((row:{game_slug:string;finished_at:string})=>({id:row.game_slug,openedAt:Date.parse(row.finished_at)}));
      setRemote({userId,games});
    });
    return()=>{stopped=true;};
  },[userId]);
  const values=[...local,...(remote?.userId===userId?remote?.games??[]:[])].sort((a,b)=>b.openedAt-a.openedAt);
  const seen=new Set<string>();
  return values.filter(value=>{if(seen.has(value.id))return false;seen.add(value.id);return true;}).slice(0,12);
}
