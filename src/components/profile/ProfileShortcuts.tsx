"use client";
import Link from "next/link";
import { Coins, MessageCircle, Users, ArrowUpRight } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { useWallet } from "@/lib/use-wallet";
export function ProfileShortcuts(){const {me,friends,dmUnread}=useSocial(),{balance,ready}=useWallet(me?.id??null);const unread=[...dmUnread.values()].reduce((sum,n)=>sum+n,0);return <div className="rg-profile-shortcuts"><Link href="/shop"><Coins /><strong>{ready&&balance!==null?balance.toLocaleString("fr-FR"):"—"}</strong><span>Mes pièces</span><ArrowUpRight /></Link><Link href="/friends"><Users /><strong>{friends.length}</strong><span>Mes amis</span><ArrowUpRight /></Link><Link href="/messages"><MessageCircle /><strong>{unread}</strong><span>Messages non lus</span><ArrowUpRight /></Link></div>;}
