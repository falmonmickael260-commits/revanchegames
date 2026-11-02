"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, MessageCircle, Search, Users } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { DirectMessageDialog } from "@/components/social/DirectMessageDialog";
import { GroupsSection } from "@/components/social/GroupsSection";
import type { FriendEntry } from "@/lib/social/types";
type Conversation = { other_id:string; username:string; avatar_url:string|null; last_body:string; last_at:string; unread:number };
export function MessagesView() {
  const { me, ready, friends, presence, dmUnread } = useSocial();
  const [snapshot,setSnapshot] = useState<{userId:string;rows:Conversation[]}|null>(null);
  const [query,setQuery] = useState("");
  const router=useRouter(),params=useSearchParams();
  const [error,setError] = useState("");
  const [tab,setTab] = useState<"private"|"groups">("private");
  const load = useCallback(async () => {
    if (!me) return;
    const { data,error } = await createClient().rpc("direct_conversations");
    if (error) { setError("Les conversations n’ont pas pu être chargées. Réessaie."); return; }
    setSnapshot({ userId:me.id, rows:data ?? [] }); setError("");
  }, [me]);
  useEffect(() => {
    if (!me) return;
    const db=createClient(); let stopped=false;
    const refresh=()=>{if(!stopped) void load();};
    const channel=db.channel(`rg-inbox-${me.id}`).on("postgres_changes",{event:"*",schema:"public",table:"direct_messages"},refresh).subscribe(status=>{if(status==="SUBSCRIBED")refresh();});
    const first=setTimeout(refresh,0);
    const visible=()=>{if(document.visibilityState==="visible")refresh();}; document.addEventListener("visibilitychange",visible);
    return()=>{stopped=true;clearTimeout(first);document.removeEventListener("visibilitychange",visible);void db.removeChannel(channel);};
  },[me,load]);
  const rows = snapshot?.userId===me?.id ? snapshot?.rows ?? [] : [];
  const known=new Set(rows.map(row=>row.other_id));
  const entries=[...rows,...friends.filter(friend=>!known.has(friend.id)).map(friend=>({other_id:friend.id,username:friend.username,avatar_url:friend.avatarUrl,last_body:"Commencer une conversation",last_at:"",unread:0}))]
    .filter(row=>row.username.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selectedId=params.get("with");
  const selectedRow=entries.find(row=>row.other_id===selectedId);
  const selected:FriendEntry|null=selectedId ? friends.find(friend=>friend.id===selectedId) ?? (selectedRow?{id:selectedRow.other_id,username:selectedRow.username,avatarUrl:selectedRow.avatar_url,friendshipId:"",presence:presence.get(selectedRow.other_id)?.status??"offline",gameSlug:null}:null) : null;
  const open=(row:Conversation)=>router.push(`/messages?with=${encodeURIComponent(row.other_id)}`,{scroll:false});
  return <div className="rg-page rg-messages-page"><PageHeader eyebrow="Garde le lien" title="Messages" subtitle="Les conversations qui continuent entre deux parties." />
    <div className="rg-social-tabs"><button type="button" aria-pressed={tab==="private"} onClick={()=>setTab("private")}><MessageCircle className="h-4 w-4" />Privés</button><button type="button" aria-pressed={tab==="groups"} onClick={()=>setTab("groups")}><Users className="h-4 w-4" />Groupes</button><Link href="/chat">Chat global<ArrowUpRight className="h-4 w-4" /></Link></div>
    {!ready ? <div className="rg-skeleton h-40" /> : !me ? <div className="rg-signin-card"><MessageCircle /><h2>Retrouve tes conversations.</h2><p>Connecte-toi pour écrire à tes amis, recevoir leurs invitations et rejoindre tes groupes.</p><Link href="/sign-in?next=/messages" className="rg-primary-button">Se connecter</Link></div> : tab==="groups" ? <GroupsSection /> : <>
      <label className="rg-search-field"><Search className="h-4 w-4" /><input aria-label="Rechercher une conversation" placeholder="Un ami, une conversation…" value={query} onChange={event=>setQuery(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}<button type="button" onClick={()=>void load()} className="ml-3 underline">Réessayer</button></p>}
      {!snapshot && !error ? <div className="rg-skeleton h-40" /> : <div className="rg-conversation-list">{entries.map(row=>{
        const count=dmUnread.get(row.other_id) ?? Number(row.unread);
        const online=presence.get(row.other_id)?.status;
        return <button type="button" key={row.other_id} onClick={()=>open(row)} className="rg-conversation-row" aria-label={`Conversation avec ${row.username}${count ? `, ${count} non lus` : ""}`}>
          <span className={online==="online"||online==="in_game"?"rg-online-avatar":""}><Avatar username={row.username} avatarUrl={row.avatar_url} /></span><span className="min-w-0 flex-1 text-left"><strong>{row.username}</strong><span className="rg-message-preview">{row.last_body}</span></span><span className="rg-conversation-meta">{row.last_at && <time dateTime={row.last_at}>{new Date(row.last_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</time>}{count>0&&<span className="rg-unread-bubble">{count>99?"99+":count}</span>}</span>
        </button>;
      })}{!entries.length&&<div className="rg-inline-empty"><MessageCircle /><p>{query?"Aucune conversation correspondante.":"Les bons moments commencent par un message."}</p><Link href="/friends">Trouver mes amis</Link></div>}</div>}
    </>}
    {selected&&me&&<DirectMessageDialog me={me} friend={selected} onClose={()=>router.replace("/messages",{scroll:false})} />}
  </div>;
}
