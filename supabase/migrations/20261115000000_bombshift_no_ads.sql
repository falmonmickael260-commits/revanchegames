begin;

-- Add an account-bound product to the existing verified Stripe payment flow.
alter table public.stripe_purchases drop constraint if exists stripe_purchases_pack_id_check;
alter table public.stripe_purchases drop constraint if exists stripe_purchases_check2;
alter table public.stripe_purchases drop constraint if exists stripe_purchases_product_amount_check;
alter table public.stripe_purchases add constraint stripe_purchases_pack_id_check
  check (pack_id in ('coins_1000','coins_2000','bombshift_no_ads'));
alter table public.stripe_purchases add constraint stripe_purchases_product_amount_check check (
  (pack_id='coins_1000' and coins=1000 and amount=119) or
  (pack_id='coins_2000' and coins=2000 and amount=200) or
  (pack_id='bombshift_no_ads' and coins=0 and amount=99));

create or replace function public.begin_stripe_purchase(p_id uuid, p_user uuid, p_pack text, p_live boolean)
returns public.stripe_purchases language plpgsql security definer set search_path=public as $$
declare r public.stripe_purchases; v_count integer;
begin
  -- Durable, per-player rate limit, including concurrent requests on multiple instances.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 7351));
  select * into r from public.stripe_purchases where id=p_id;
  if found then
    if r.user_id<>p_user or r.pack_id<>p_pack or r.livemode<>p_live then raise exception 'achat incompatible'; end if;
    if r.created_at < now()-interval '23 hours' then raise exception 'achat expiré'; end if;
    return r;
  end if;
  if p_pack='bombshift_no_ads' then
    if exists(select 1 from public.stripe_purchases where user_id=p_user and pack_id=p_pack and livemode=p_live and state='paid') then
      raise exception 'Sans publicité déjà activé';
    end if;
    select * into r from public.stripe_purchases where user_id=p_user and pack_id=p_pack
      and livemode=p_live and state='pending' and created_at>now()-interval '25 minutes'
      order by created_at desc limit 1;
    if found then return r; end if;
  end if;
  select count(*) into v_count from public.stripe_purchases where user_id=p_user and created_at>now()-interval '10 minutes';
  if v_count>=5 then raise exception 'trop de tentatives' using errcode='54000'; end if;
  if p_pack not in ('coins_1000','coins_2000','bombshift_no_ads') or p_pack is null then raise exception 'pack invalide'; end if;
  insert into public.stripe_purchases(id,user_id,pack_id,coins,amount,livemode)
    values(p_id,p_user,p_pack,case p_pack when 'coins_1000' then 1000 when 'coins_2000' then 2000 else 0 end,
      case p_pack when 'coins_1000' then 119 when 'coins_2000' then 200 else 99 end,p_live) returning * into r;
  return r;
end; $$;

revoke all on function public.begin_stripe_purchase(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.begin_stripe_purchase(uuid,uuid,text,boolean) to service_role;

commit;
