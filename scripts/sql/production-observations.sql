-- Contrôles en lecture seule après essais avec les comptes dédiés.
begin read only;
select p.username, w.user_id, w.balance_coins, w.updated_at
from public.wallet_accounts w join public.profiles p on p.id=w.user_id
order by w.updated_at desc limit 20;
select p.username, l.delta_coins, l.reason, l.reference, l.created_at
from public.wallet_ledger l join public.profiles p on p.id=l.user_id
where l.reference like 'role:%' or l.reference like 'role-refund:%'
   or l.reference like 'promo:%' or l.reference like 'la-meute-win:%'
order by l.created_at desc limit 40;
select room_code, user_id, role_key, price_coins, status, charged, created_at, resolved_at
from public.role_reservations order by created_at desc limit 30;
-- Ces deux résultats doivent rester vides.
select code,user_id,count(*) from public.promo_redemptions group by code,user_id having count(*)>1;
select reference,count(*) from public.wallet_ledger where reference is not null group by reference having count(*)>1;
commit;
