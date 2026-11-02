"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { NAV_ITEMS } from "@/data/nav";
import { useSocial } from "@/components/social/SocialProvider";
import { Avatar } from "@/components/ui/Avatar";
const groups=[{label:"L’expérience Revanche",ids:["home","library","community","messages","leaderboard"]},{label:"Mes espaces",ids:["voice","friends","chat","favorites","recent","new"]},{label:"Mon compte",ids:["shop","profile","settings"]}];
export function Sidebar(){
 const pathname=usePathname(),{me,dmUnread}=useSocial();const unread=[...dmUnread.values()].reduce((sum,n)=>sum+n,0);
 return <aside className="rg-desktop-sidebar"><div className="rg-sidebar-logo"><Logo /></div><nav aria-label="Navigation ordinateur">{groups.map(group=><div key={group.label} className="rg-sidebar-group"><p>{group.label}</p>{group.ids.map(id=>{const item=NAV_ITEMS.find(item=>item.id===id)!;const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);const Icon=item.icon;return <Link key={id} href={item.href} aria-current={active?"page":undefined} className={active?"is-active":""}><Icon className="h-[18px] w-[18px]" strokeWidth={active?2.5:1.7} /><span>{item.label}</span>{id==="messages"&&unread>0&&<span className="rg-sidebar-count">{unread>99?"99+":unread}</span>}</Link>;})}</div>)}</nav><Link href={me?"/profile":"/sign-in"} className="rg-sidebar-player">{me?<Avatar username={me.username} avatarUrl={me.avatarUrl} size="sm" />:<span className="rg-brand-mark">R</span>}<span><strong>{me?.username||"Rejoins l’aventure"}</strong><small>{me?"Mon espace joueur":"Connexion et inscription"}</small></span></Link></aside>;
}
