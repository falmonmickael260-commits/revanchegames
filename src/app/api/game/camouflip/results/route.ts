import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Player={userId:string|null;name:string;role:'hunter'|'prop';outcome:'win'|'loss';score:number;eliminations:number;survived:boolean;timeSeconds:number};

export async function POST(request:Request){
  const key=process.env.PLATFORM_SHARED_SECRET;
  const signature=request.headers.get('x-rg-signature')||'';
  const [stamp,hex]=signature.split('.');
  const raw=await request.text();
  if(!key||raw.length>16384||!/^\d{10}$/.test(stamp||'')||!/^[a-f0-9]{64}$/.test(hex||'')||Math.abs(Date.now()/1000-Number(stamp))>30)return Response.json({error:'Signature invalide.'},{status:403});
  const expected=createHmac('sha256',key).update(`rg-camouflip-result-v1.${stamp}.${raw}`).digest();
  if(!timingSafeEqual(expected,Buffer.from(hex,'hex')))return Response.json({error:'Signature invalide.'},{status:403});
  let body:unknown;try{body=JSON.parse(raw);}catch{return Response.json({error:'Résultat invalide.'},{status:400});}
  const data=body as Record<string,unknown>;
  const players=data.players as Player[];
  if(data.game!=='camouflip'||typeof data.room!=='string'||!/^[A-Z0-9]{4}$/.test(data.room)||!uuid.test(String(data.instance))||!Number.isInteger(data.round)||Number(data.round)<1||!Number.isFinite(data.startedAt)||!Number.isFinite(data.endedAt)||Number(data.endedAt)<Number(data.startedAt)||!Array.isArray(players)||players.length<1||players.length>7)return Response.json({error:'Résultat invalide.'},{status:400});
  const ids=new Set<string>();
  for(const p of players){
    if(!p||p.userId!==null&&!uuid.test(p.userId)||typeof p.name!=='string'||p.name.length>100||!['hunter','prop'].includes(p.role)||!['win','loss'].includes(p.outcome)||!Number.isFinite(p.score)||!Number.isInteger(p.eliminations)||p.eliminations<0||p.eliminations>6||typeof p.survived!=='boolean'||!Number.isInteger(p.timeSeconds)||p.timeSeconds<0||p.timeSeconds>3600)return Response.json({error:'Joueur invalide.'},{status:400});
    if(p.userId){if(ids.has(p.userId))return Response.json({error:'Joueur dupliqué.'},{status:400});ids.add(p.userId);}
  }
  const {data:result,error}=await createServiceClient().rpc('record_game_result',{
    p_game_slug:'camouflip',p_idempotency_key:`camouflip:${data.instance}:${data.round}`,
    p_room_code:data.room,p_raw_payload:data,
    p_players:players.map((p,i)=>({user_id:p.userId,guest_label:p.userId?null:p.name,outcome:p.outcome,score:p.score,position:i+1})),
  });
  if(error){console.error('[camouflip] record_game_result failed',error);return Response.json({error:'Enregistrement indisponible.'},{status:503});}
  return Response.json({id:result},{headers:{'cache-control':'no-store'}});
}
