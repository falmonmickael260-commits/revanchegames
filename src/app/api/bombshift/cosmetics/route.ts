import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError } from "@/lib/request-security";
const origins = new Set(["https://revanchegames.com","https://www.revanchegames.com","https://revanchegames-production.up.railway.app"]);
const errors: Record<string,string> = {login_required:"Compte requis.",invalid_item:"Article inconnu.",invalid_action:"Action invalide.",price_changed:"Prix modifié : recharge la boutique.",not_owned:"Article non acheté.",insufficient_balance:"Solde de pièces insuffisant.",chest_unavailable:"Coffre indisponible : une rareté est complète."};
export async function POST(request:Request) {
 try {
  const origin=request.headers.get("origin");
  if (!origin || !origins.has(origin) || request.headers.get("sec-fetch-site")==="cross-site") throw new RequestError("Origine refusée.",403);
  const auth=await createClient();
  const {data:{user},error:authError}=await auth.auth.getUser();
  if(authError || !user || user.is_anonymous || !user.email_confirmed_at || Date.parse(user.banned_until??"")>Date.now()) throw new RequestError("Compte confirmé requis.",401);
  let input;
  try { input=JSON.parse(new TextDecoder().decode(await readLimitedBody(request,2048))); } catch(error) {if(error instanceof RequestError) throw error; throw new RequestError("Requête invalide.");}
  const action=input?.action;
  if(!["catalog","buy","equip","chest"].includes(action)) throw new RequestError("Action invalide.");
  if(action!=="catalog" && action!=="chest" && (typeof input.item!=="string" || !/^(hero|bomb)-[a-z]{1,20}$/.test(input.item))) throw new RequestError("Article invalide.");
  const {data,error}=await createServiceClient().rpc("bombshift_cosmetic_shop_v2",{p_user:user.id,p_action:action,p_item:action==="catalog"||action==="chest"?null:input.item,p_price:Number.isSafeInteger(input?.price)?input.price:null,p_request:typeof input?.requestKey==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestKey)?input.requestKey:null});
  if(error || !data) throw new RequestError("Boutique indisponible.",503);
  if(data.error) throw new RequestError(errors[data.error]??"Action indisponible.",409);
  return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return apiError(error);}
}