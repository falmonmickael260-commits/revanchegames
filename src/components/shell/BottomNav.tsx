"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home,Gamepad2,Crown,Users,UserRound } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { Avatar } from "@/components/ui/Avatar";
export function BottomNav(){
 const path=usePathname(),{me,dmUnread,unreadCount}=useSocial();
 const messages=[...dmUnread.values()].reduce((sum,n)=>sum+n,0);
 const items=[{id:"home",href:"/",label:"Accueil",Icon:Home,active:path==="/",count:0},{id:"games",href:"/library",label:"Jeux",Icon:Gamepad2,active:path.startsWith("/library"),count:0},{id:"club",href:"/community",label:"Club",Icon:Crown,active:["/community","/voice","/chat","/messages"].some(r=>path.startsWith(r)),count:messages+unreadCount},{id:"friends",href:"/friends",label:"Amis",Icon:Users,active:path.startsWith("/friends"),count:0},{id:"profile",href:"/profile",label:"Profil",Icon:UserRound,active:path.startsWith("/profile"),count:0}];
 return <nav aria-label="Navigation principale" className="rg-bottom-nav rg-premium-nav" style={{height:"var(--rg-bottom-nav-h)",paddingBottom:"var(--rg-safe-bottom)"}}>{items.map(({id,href,label,Icon,active,count})=><Link key={id} href={href} aria-label={label} aria-current={active?"page":undefined} className={`${active?"is-active":""} ${id==="club"?"rg-premium-central":""}`}><span className="rg-nav-icon">{id==="club"?<span className="rg-premium-r"><Crown/>R</span>:id==="profile"&&me?<Avatar username={me.username} avatarUrl={me.avatarUrl} size="sm"/>:<Icon strokeWidth={2.2}/>}{count>0&&<span className="rg-count">{count>99?"99+":count}</span>}</span><span>{label}</span></Link>)}</nav>
}