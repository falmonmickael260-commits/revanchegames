begin;
-- Only promotional codes are written. Existing admin_execute and all wallet,
-- sanction, support, membership and reconciliation operations stay untouched.
create function public.admin_save_promo(p_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); previous public.admin_operations; reason text:=btrim(p_payload->>'reason');
  result jsonb; before_data jsonb; v_promo_code text; v_promo_coins bigint;
  v_promo_limit integer; v_promo_expires timestamptz; v_promo_active boolean;
begin
  if not public.admin_allowed('economy') then raise exception 'administration non autorisée' using errcode='42501'; end if;
  if p_id is null or p_payload is null or reason is null or char_length(reason) not between 3 and 1000 then
    raise exception 'motif obligatoire (3 à 1000 caractères)' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,1711));
  select * into previous from public.admin_operations where id=p_id;
  if found then
    if previous.actor_id<>me or previous.action<>'promo' or previous.payload<>p_payload then raise exception 'identifiant déjà utilisé pour une autre opération' using errcode='22023'; end if;
    return previous.result;
  end if;
    v_promo_code:=upper(btrim(coalesce(p_payload->>'code','')));
    if v_promo_code !~ '^[A-Z0-9_-]{3,60}$' then raise exception 'Code promo invalide : utilise de 3 à 60 lettres, chiffres, tirets ou underscores.' using errcode='22023'; end if;
    if coalesce(p_payload->>'coins','') !~ '^[0-9]{1,7}$' then raise exception 'Nombre de pièces invalide : saisis un entier de 1 à 1000000.' using errcode='22023'; end if;
    v_promo_coins:=(p_payload->>'coins')::bigint;
    if v_promo_coins not between 1 and 1000000 then raise exception 'Nombre de pièces invalide : saisis un entier de 1 à 1000000.' using errcode='22023'; end if;
    if nullif(btrim(p_payload->>'limit'),'') is not null then
      if (p_payload->>'limit') !~ '^[0-9]{1,10}$' then raise exception 'Limite d’utilisations invalide : saisis un entier positif ou laisse vide.' using errcode='22023'; end if;
      if (p_payload->>'limit')::bigint not between 1 and 2147483647 then raise exception 'Limite d’utilisations invalide : saisis un entier positif ou laisse vide.' using errcode='22023'; end if;
      v_promo_limit:=(p_payload->>'limit')::integer;
    end if;
    v_promo_active:=coalesce((p_payload->>'active')::boolean,true);
    begin
      v_promo_expires:=nullif(btrim(p_payload->>'expires'),'')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Date d’expiration invalide.' using errcode='22023';
    end;
    if v_promo_active and v_promo_expires is not null and v_promo_expires<=now() then raise exception 'Date d’expiration invalide : choisis une date future ou laisse vide.' using errcode='22023'; end if;
    select to_jsonb(p.*) into before_data from public.promo_codes p where code=v_promo_code for update;
    insert into public.promo_codes(code,reward_coins,active,max_redemptions,expires_at)
      values(v_promo_code,v_promo_coins,v_promo_active,v_promo_limit,v_promo_expires)
      on conflict(code) do update set reward_coins=excluded.reward_coins,active=excluded.active,
        max_redemptions=excluded.max_redemptions,expires_at=excluded.expires_at
      returning to_jsonb(promo_codes.*) into result;
  insert into public.admin_audit(id,actor_id,action,target,reason,before_value,after_value)
    values(p_id,me,'promo',v_promo_code,reason,before_data,result);
  insert into public.admin_operations(id,actor_id,action,payload,result) values(p_id,me,'promo',p_payload,result);
  return result;
end $$;
revoke all on function public.admin_save_promo(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_promo(uuid,jsonb) to authenticated;
comment on function public.admin_save_promo(uuid,jsonb) is 'Promo-only administration API with current economy role, MFA, reason, replay protection and audit; never credits a wallet.';
commit;
