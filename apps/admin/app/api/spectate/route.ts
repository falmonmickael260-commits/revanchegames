import { createHmac } from 'node:crypto';
import { adminSession, AdminError, failure, json } from '../../../lib/server';
const origins:Record<string,string>={
  kilomax:'https://www.kilomax.fr',
  president:'https://le-president-production.up.railway.app',
  'quiz-master':'https://www.quizzmaster.fr','la-meute':'https://www.lameutenoire.fr',
  '10000':'https://lewisdee.onrender.com',camouflip:'https://camouflip-production.up.railway.app',
  'fortune-empire':'https://atlasroyal-production.up.railway.app',
};
export async function GET(request:Request){
  try{
    const {db,user}=await adminSession();const q=new URL(request.url).searchParams;
    const {data,error}=await db.rpc('admin_observer_room',{p_room:q.get('room'),p_access:q.get('access')});
    if(error||!data)throw new AdminError('Accès spectateur refusé ou expiré.',403);
    const origin=process.env[`ADMIN_GAME_URL_${String(data.game).toUpperCase().replace(/-/g,'_')}`]||origins[data.game];
    if(!origin)throw new AdminError('Le moteur de ce jeu n’est pas encore raccordé au mode spectateur.',501);
    const key=data.game==='fortune-empire'?process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE||process.env.PLATFORM_SHARED_SECRET:process.env.PLATFORM_SHARED_SECRET;
    if(!key)throw new AdminError('Connexion spectateur non configurée.',503);
    const raw=JSON.stringify({v:1,...data,operation:'snapshot',actor:user.id,access:q.get('access')});
    const stamp=String(Math.floor(Date.now()/1000));
    const signature=`${stamp}.${createHmac('sha256',key).update(`rg-admin-observer-v1.${stamp}.${raw}`).digest('hex')}`;
    const response=await fetch(`${new URL(origin).origin}/api/platform/observer`,{method:'POST',headers:{'content-type':'application/json','x-rg-signature':signature},body:raw,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))throw new AdminError('Le salon est fermé, remplacé ou le serveur spectateur n’est pas encore déployé.',503);
    const snapshot=await response.json();
    if(snapshot.game!==data.game||snapshot.room!==data.room||snapshot.instance!==data.instance||!snapshot.publicState)throw new AdminError('État du jeu invalide.',503);
    return json(snapshot);
  }catch(error){return failure(error);}
}
