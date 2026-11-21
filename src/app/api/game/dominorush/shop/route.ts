import { readDomirushRequest } from '@/lib/dominorush';
import { verifyPlatformToken } from '@/lib/platform-token';
import { RequestError, UUID_PATTERN } from '@/lib/request-security';
import { createServiceClient } from '@/lib/supabase/server';

const errors: Record<string, string> = {
  login_required: 'Ouvre Domirush depuis ton compte Revanche Games.',
  price_changed: 'Le prix a changé. Rouvre la boutique pour l’actualiser.',
  price_pending: 'Prix à définir.',
  insufficient_balance: 'Ton solde de pièces est insuffisant.',
  not_owned: 'Ce skin ne fait pas partie de ta collection.',
};

export async function POST(request: Request) {
  try {
    const data = await readDomirushRequest(request, 'shop') as { action?: unknown; token?: unknown; item?: unknown; expectedPrice?: unknown } | null;
    const action = data?.action;
    if (action !== 'catalog' && action !== 'buy' && action !== 'equip') throw new RequestError('Action invalide.');
    if (action !== 'catalog' && (typeof data?.item !== 'string' || !/^[a-z]{1,20}$/.test(data.item))) {
      throw new RequestError('Skin invalide.');
    }
    const identity = verifyPlatformToken(data?.token);
    if ((data?.token || action !== 'catalog') && (!identity || !UUID_PATTERN.test(identity.uid))) {
      throw new RequestError(errors.login_required, 401);
    }

    const db = createServiceClient();
    if (identity) {
      const { data: account, error } = await db.auth.admin.getUserById(identity.uid);
      if (error || !account.user || account.user.is_anonymous || Date.parse(account.user.banned_until ?? '') > Date.now()) {
        throw new RequestError(errors.login_required, 401);
      }
    }
    const { data: shop, error } = await db.rpc('domirush_shop', {
      p_action: action, p_user: identity?.uid ?? null, p_skin: typeof data?.item === "string" ? data.item : null,
      p_expected_price: typeof data?.expectedPrice === "number" && Number.isSafeInteger(data.expectedPrice) && data.expectedPrice > 0 && data.expectedPrice <= 2147483647 ? data.expectedPrice : null,
    });
    if (error || !shop) throw new RequestError('Portefeuille indisponible.', 503);
    if (shop.error) throw new RequestError(errors[shop.error] ?? 'Action indisponible.', 409);
    return Response.json(shop, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : 'Boutique indisponible.' },
      { status: error instanceof RequestError ? error.status : 503, headers: { 'cache-control': 'no-store' } });
  }
}
