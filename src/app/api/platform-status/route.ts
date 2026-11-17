import { createClient } from '@/lib/supabase/server';
import { apiError, RequestError } from '@/lib/request-security';
export async function GET(){
  try{
    const db=await createClient();const {data:{user}}=await db.auth.getUser();
    if(!user)return Response.json({restricted:false,announcements:[]},{headers:{'Cache-Control':'no-store, private'}});
    const [access,announcements,heartbeat]=await Promise.all([
      db.rpc('my_platform_access'),db.from('admin_announcements').select('id,body,created_at').order('created_at',{ascending:false}).limit(5),db.rpc('platform_heartbeat'),
    ]);
    if(access.error||announcements.error||heartbeat.error)throw new RequestError('État de la plateforme indisponible.',503);
    return Response.json({...access.data,announcements:announcements.data},{headers:{'Cache-Control':'no-store, private'}});
  }catch(error){return apiError(error);}
}
