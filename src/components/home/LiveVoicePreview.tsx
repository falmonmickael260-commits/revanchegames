"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { Headphones,ArrowRight,AudioLines,Lock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { VoiceRoom } from "@/lib/voice-shared";
export function LiveVoicePreview({userId}:{userId?:string}){
 const [rooms,setRooms]=useState<VoiceRoom[]|null>(null);
 useEffect(()=>{if(!userId)return;let active=true;let controller:AbortController|undefined;async function refresh(){controller?.abort();controller=new AbortController();const signal=controller.signal;try{const res=await fetch("/api/voice",{cache:"no-store",signal});if(!res.ok)throw Error();const data=await res.json();if(active&&!signal.aborted)setRooms(Array.isArray(data.rooms)?data.rooms:[])}catch{if(active&&!signal.aborted)setRooms(null)}}void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh()},10000);return()=>{active=false;controller?.abort();clearInterval(timer)}},[userId]);
 return <section className="rg-premium-live"><div className="rg-party-title"><h2><Headphones/> Salons vocaux en direct</h2><Link href="/voice">Tout voir <ArrowRight/></Link></div>{userId&&rooms&&rooms.length>0?<div className="rg-premium-voice-rail">{rooms.slice(0,8).map((room,i)=><Link href="/voice" key={room.id} className={`rg-premium-room room-tone-${i%3}`}><div className="rg-premium-room-art"><Headphones/></div><strong>{room.title}{room.locked&&<Lock size={12}/>}</strong><div><Avatar username={room.hostName} avatarUrl={room.hostAvatar} size="sm"/><span>{room.hostName}</span></div><small><AudioLines/>{room.count} en ligne</small></Link>)}</div>:<Link href="/voice" className="rg-premium-room-empty"><Headphones/><span><strong>Rejoins le vocal</strong><small>{!userId?"Connecte-toi pour découvrir les salons.":rooms===null?"Consulter les salons disponibles.":"Aucun salon ouvert pour le moment."}</small></span><ArrowRight/></Link>}</section>
}