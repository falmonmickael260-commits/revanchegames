import { trustedFortuneBody, ensureFortuneCatalog } from '@/lib/fortune-empire';
import { verifyPlatformToken } from '@/lib/platform-token';
import { RequestError } from '@/lib/request-security';
export async function POST(request:Request){
  try {
    const body=await trustedFortuneBody(request,'identity') as {token?:unknown};
    await ensureFortuneCatalog();
    return Response.json({identity:verifyPlatformToken(body?.token)},{headers:{'cache-control':'no-store'}});
  } catch(error){return Response.json({error:error instanceof RequestError?error.message:'Connexion indisponible.'},{status:error instanceof RequestError?error.status:503});}
}
