import { trustedFortuneBody, ensureFortuneCatalog, validateFortuneResult } from '@/lib/fortune-empire';
import { createServiceClient } from '@/lib/supabase/server';
import { RequestError } from '@/lib/request-security';
export async function POST(request:Request){
  try {
    const data=validateFortuneResult(await trustedFortuneBody(request,'result'));
    await ensureFortuneCatalog();
    const {data:id,error}=await createServiceClient().rpc('record_game_result',{
      p_game_slug:'fortune-empire',p_idempotency_key:`fortune-empire:${data.instance}`,
      p_room_code:data.room,p_raw_payload:data,
      p_players:data.players.map(p=>({user_id:p.userId,guest_label:p.userId?null:p.name,outcome:p.outcome,score:p.score,position:p.position})),
    });
    if(error) return Response.json({error:'Enregistrement indisponible.'},{status:503});
    return Response.json({id},{headers:{'cache-control':'no-store'}});
  } catch(error){return Response.json({error:error instanceof RequestError?error.message:'Enregistrement indisponible.'},{status:error instanceof RequestError?error.status:503});}
}
