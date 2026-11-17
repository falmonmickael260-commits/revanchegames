import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { fulfillStripeEvent } from '../../../src/lib/stripe/fulfillment';
import { AdminError } from './server';
export async function reconcilePurchase(id:string,actor:string,target:unknown){
  if(typeof target!=='string'||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new AdminError('Vérification des paiements non configurée.',503);
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:order,error}=await db.from('stripe_purchases').select('id,session_id,livemode').eq('id',target).single();
  if(error||!order?.session_id)throw new AdminError('L’achat ne possède pas de session Stripe vérifiable.',409);
  try{
    // A stable synthetic trigger causes the existing fulfillment to fetch Stripe's
    // current session/intent/charge/refunds/disputes and calculate net entitlement.
    // It never trusts a client-supplied amount, user, payment status or coin count.
    await fulfillStripeEvent({id:`admin-reconcile:${id}`,type:'checkout.session.completed',livemode:order.livemode,
      data:{object:{id:order.session_id}}},db);
    const finished=await db.rpc('admin_finish_reconciliation',{p_id:id,p_actor:actor,p_verified:true});
    if(finished.error)throw new Error('Audit indisponible.');
    return finished.data;
  }catch{
    await db.rpc('admin_finish_reconciliation',{p_id:id,p_actor:actor,p_verified:false});
    throw new AdminError('Vérification Stripe inachevée. Réessayez avec la même opération ; aucun crédit supplémentaire n’est déduit de cette erreur.',503);
  }
}
