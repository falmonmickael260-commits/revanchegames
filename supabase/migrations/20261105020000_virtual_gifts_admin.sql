-- Une modification sensible et son journal sont confirmés ou annulés ensemble.
create function public.gift_admin_apply(p_actor uuid,p_action text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_target text;
  v_gift public.gift_catalog;
  v_settings public.gift_settings;
  v_band public.gift_reward_bands;
  v_level public.rev_levels;
begin
  if p_actor is null or p_value is null or jsonb_typeof(p_value)<>'object' then
    raise exception 'Modification invalide.' using errcode='22023';
  end if;
  if p_action='gift' then
    select to_jsonb(g) into v_before from public.gift_catalog g where id=p_value->>'id';
    insert into public.gift_catalog(id,name,price_coins,image_url,animation_type,rarity,active,limited,starts_at,ends_at,updated_at)
      values(p_value->>'id',p_value->>'name',(p_value->>'price_coins')::integer,
        p_value->>'image_url',p_value->>'animation_type',p_value->>'rarity',
        (p_value->>'active')::boolean,(p_value->>'limited')::boolean,
        (p_value->>'starts_at')::timestamptz,(p_value->>'ends_at')::timestamptz,now())
      on conflict(id) do update set name=excluded.name,price_coins=excluded.price_coins,
        image_url=excluded.image_url,animation_type=excluded.animation_type,rarity=excluded.rarity,
        active=excluded.active,limited=excluded.limited,starts_at=excluded.starts_at,
        ends_at=excluded.ends_at,updated_at=now() returning * into v_gift;
    v_after:=to_jsonb(v_gift); v_target:='gift:'||v_gift.id;
  elsif p_action='settings' then
    select to_jsonb(s) into v_before from public.gift_settings s where singleton=true;
    update public.gift_settings set gifts_enabled=(p_value->>'gifts_enabled')::boolean,
      renta_enabled=(p_value->>'renta_enabled')::boolean,max_quantity=(p_value->>'max_quantity')::integer,
      max_daily_spend=(p_value->>'max_daily_spend')::bigint,
      max_daily_to_recipient=(p_value->>'max_daily_to_recipient')::bigint,
      cooldown_seconds=(p_value->>'cooldown_seconds')::integer,
      min_account_age_hours=(p_value->>'min_account_age_hours')::integer,updated_at=now()
      where singleton=true returning * into v_settings;
    v_after:=to_jsonb(v_settings); v_target:='settings';
  elsif p_action='band' then
    select to_jsonb(b) into v_before from public.gift_reward_bands b
      where rule=p_value->>'rule' and band=(p_value->>'band')::integer;
    update public.gift_reward_bands set weight=(p_value->>'weight')::integer
      where rule=p_value->>'rule' and band=(p_value->>'band')::integer returning * into v_band;
    if not found then raise exception 'Bande introuvable.' using errcode='22023'; end if;
    v_after:=to_jsonb(v_band); v_target:='band:'||v_band.rule||':'||v_band.band;
  elsif p_action='level' then
    select to_jsonb(l) into v_before from public.rev_levels l where level=(p_value->>'level')::integer;
    insert into public.rev_levels(level,required_total,label)
      values((p_value->>'level')::integer,(p_value->>'required_total')::bigint,p_value->>'label')
      on conflict(level) do update set required_total=excluded.required_total,label=excluded.label
      returning * into v_level;
    v_after:=to_jsonb(v_level); v_target:='level:'||v_level.level;
  else
    raise exception 'Action inconnue.' using errcode='22023';
  end if;
  insert into public.gift_admin_audit(actor_id,action,target,before_value,after_value)
    values(p_actor,p_action,v_target,v_before,v_after);
  return v_after;
end;
$$;
revoke all on function public.gift_admin_apply(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.gift_admin_apply(uuid,text,jsonb) to service_role;
