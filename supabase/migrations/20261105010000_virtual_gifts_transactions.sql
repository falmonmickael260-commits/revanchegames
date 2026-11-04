-- Tirage serveur à partir de l'aléa cryptographique de gen_random_uuid().
-- Rejection sampling évite le biais du modulo pour chaque intervalle entier.
create function public.gift_secure_int(p_min integer,p_max integer)
returns integer language plpgsql volatile security definer set search_path=public as $$
declare v_span bigint; v_limit bigint; v_sample bigint;
begin
  if p_min is null or p_max is null or p_min > p_max or p_max-p_min > 1000000 then
    raise exception 'intervalle de tirage invalide' using errcode='22023';
  end if;
  v_span := p_max::bigint-p_min::bigint+1;
  v_limit := (4294967296::bigint / v_span) * v_span;
  loop
    v_sample := ('x' || substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint;
    exit when v_sample < v_limit;
  end loop;
  return (p_min::bigint + v_sample % v_span)::integer;
end;
$$;
revoke all on function public.gift_secure_int(integer,integer) from public,anon,authenticated;
grant execute on function public.gift_secure_int(integer,integer) to service_role;

create function public.send_virtual_gift(
  p_sender uuid,p_recipient uuid,p_gift_id text,p_quantity integer,
  p_context text,p_room_id text,p_room_sid text,p_idempotency_key uuid
) returns public.gift_send_batches
language plpgsql volatile security definer set search_path=public as $$
declare
  v_settings public.gift_settings;
  v_gift public.gift_catalog;
  v_existing public.gift_send_batches;
  v_batch public.gift_send_batches;
  v_sender_balance bigint;
  v_cost bigint;
  v_rev bigint;
  v_reward bigint := 0;
  v_roll integer;
  v_weight_total integer;
  v_pick integer;
  v_band public.gift_reward_bands;
  v_rule text;
  v_low integer;
  v_high integer;
  v_recipient_age timestamptz;
  v_sender_age timestamptz;
  v_spent bigint;
  v_recipient_spent bigint;
  v_last timestamptz;
  v_lock_id uuid;
  v_i integer;
begin
  if p_sender is null or p_recipient is null or p_sender=p_recipient or p_idempotency_key is null then
    raise exception 'Expéditeur, destinataire ou opération invalide.' using errcode='22023';
  end if;
  if p_context not in ('dm','voice') or (p_context='voice' and (p_room_id is null or p_room_sid is null))
    or (p_context='dm' and (p_room_id is not null or p_room_sid is not null)) then
    raise exception 'Contexte de cadeau invalide.' using errcode='22023';
  end if;
  if p_context='voice' and (p_room_id !~ '^rg-social-[0-9a-f-]{36}$' or length(p_room_sid)>100) then
    raise exception 'Salon invalide.' using errcode='22023';
  end if;
  select * into v_existing from public.gift_send_batches
    where sender_id=p_sender and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.recipient_id<>p_recipient or v_existing.gift_id<>p_gift_id
      or v_existing.quantity<>p_quantity or v_existing.context<>p_context
      or v_existing.room_id is distinct from p_room_id or v_existing.room_sid is distinct from p_room_sid then
      raise exception 'Cette opération existe déjà avec d’autres paramètres.' using errcode='23505';
    end if;
    return v_existing;
  end if;
  select * into strict v_settings from public.gift_settings where singleton=true;
  if not v_settings.gifts_enabled then raise exception 'Les cadeaux ne sont pas encore activés.' using errcode='42501'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>v_settings.max_quantity then
    raise exception 'Quantité de cadeaux invalide.' using errcode='22023';
  end if;
  select * into v_gift from public.gift_catalog where id=p_gift_id;
  if not found or not v_gift.active or (v_gift.starts_at is not null and v_gift.starts_at>now())
    or (v_gift.ends_at is not null and v_gift.ends_at<=now()) then
    raise exception 'Ce cadeau n’est pas disponible.' using errcode='22023';
  end if;
  if v_gift.price_coins>10 and not v_settings.renta_enabled then
    raise exception 'Les cadeaux avec renta ne sont pas encore activés.' using errcode='42501';
  end if;
  if p_context='dm' and (not public.are_friends(p_sender,p_recipient)
    or public.is_blocked_between(p_sender,p_recipient)) then
    raise exception 'Ce cadeau ne peut être envoyé qu’à un ami non bloqué.' using errcode='42501';
  end if;
  select created_at into v_sender_age from public.profiles where id=p_sender;
  select created_at into v_recipient_age from public.profiles where id=p_recipient;
  if v_sender_age is null or v_recipient_age is null then
    raise exception 'Profil introuvable.' using errcode='22023';
  end if;
  if v_sender_age > now()-make_interval(hours=>v_settings.min_account_age_hours)
    or v_recipient_age > now()-make_interval(hours=>v_settings.min_account_age_hours) then
    raise exception 'Compte trop récent pour les cadeaux.' using errcode='42501';
  end if;
  if exists(select 1 from public.stripe_wallet_debts where user_id in(p_sender,p_recipient) and coins>0) then
    raise exception 'Cadeaux indisponibles tant qu’un solde de remboursement reste dû.' using errcode='42501';
  end if;

  -- Toujours verrouiller les deux comptes dans le même ordre pour éviter les
  -- interblocages si deux joueurs s'envoient simultanément des cadeaux.
  insert into public.wallet_accounts(user_id) values(p_sender),(p_recipient) on conflict do nothing;
  for v_lock_id in select user_id from public.wallet_accounts
    where user_id in(p_sender,p_recipient) order by user_id loop
    perform 1 from public.wallet_accounts where user_id=v_lock_id for update;
  end loop;
  -- Sous le verrou, un retry identique renvoie le résultat initial sans
  -- nouveau débit ni nouveau tirage.
  select * into v_existing from public.gift_send_batches
    where sender_id=p_sender and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.recipient_id<>p_recipient or v_existing.gift_id<>p_gift_id
      or v_existing.quantity<>p_quantity or v_existing.context<>p_context
      or v_existing.room_id is distinct from p_room_id or v_existing.room_sid is distinct from p_room_sid then
      raise exception 'Cette opération existe déjà avec d’autres paramètres.' using errcode='23505';
    end if;
    return v_existing;
  end if;
  v_cost := v_gift.price_coins::bigint*p_quantity;
  v_rev := v_gift.rev_points::bigint*p_quantity;
  select balance_coins into v_sender_balance from public.wallet_accounts where user_id=p_sender;
  if v_sender_balance < v_cost then raise exception 'Solde de pièces insuffisant.' using errcode='P0001'; end if;
  select coalesce(sum(total_price),0),max(created_at) into v_spent,v_last
    from public.gift_send_batches where sender_id=p_sender and created_at>now()-interval '24 hours';
  select coalesce(sum(total_price),0) into v_recipient_spent
    from public.gift_send_batches where sender_id=p_sender and recipient_id=p_recipient
      and created_at>now()-interval '24 hours';
  if v_spent+v_cost>v_settings.max_daily_spend or v_recipient_spent+v_cost>v_settings.max_daily_to_recipient then
    raise exception 'Limite quotidienne de cadeaux atteinte.' using errcode='P0001';
  end if;
  if v_last is not null and v_last>now()-make_interval(secs=>v_settings.cooldown_seconds) then
    raise exception 'Attends quelques secondes avant un autre cadeau.' using errcode='P0001';
  end if;

  v_rule := case when v_gift.price_coins=10 then 'none'
    when v_gift.price_coins=30 then 'thirty' else 'general' end;
  if v_rule<>'none' then
    select coalesce(sum(weight),0)::integer into v_weight_total from public.gift_reward_bands where rule=v_rule;
    if v_weight_total<=0 then raise exception 'Probabilités des cadeaux indisponibles.' using errcode='P0001'; end if;
  end if;
  insert into public.gift_send_batches(sender_id,recipient_id,gift_id,quantity,unit_price,unit_rev,
    total_price,total_rev,total_reward,context,room_id,room_sid,idempotency_key)
  values(p_sender,p_recipient,v_gift.id,p_quantity,v_gift.price_coins,v_gift.rev_points,
    v_cost,v_rev,0,p_context,p_room_id,p_room_sid,p_idempotency_key) returning * into v_batch;

  for v_i in 1..p_quantity loop
    v_roll := 0;
    if v_rule<>'none' then
      v_pick := public.gift_secure_int(1,v_weight_total);
      for v_band in select * from public.gift_reward_bands where rule=v_rule order by band loop
        v_pick := v_pick-v_band.weight;
        exit when v_pick<=0;
      end loop;
      if v_rule='thirty' then
        v_low:=v_band.min_amount; v_high:=v_band.max_amount;
      else
        v_low:=ceil(v_gift.price_coins*v_band.min_percent)::integer;
        v_high:=floor(v_gift.price_coins*v_band.max_percent)::integer;
        v_low:=greatest(v_low,ceil(v_gift.price_coins*0.30)::integer);
        v_high:=least(v_high,floor(v_gift.price_coins*1.50)::integer);
      end if;
      if v_low>v_high then raise exception 'Bande de récompense invalide.' using errcode='P0001'; end if;
      v_roll:=public.gift_secure_int(v_low,v_high);
    end if;
    insert into public.gift_reward_rolls(batch_id,ordinal,coins,rule,band)
      values(v_batch.id,v_i,v_roll,v_rule,case when v_rule='none' then null else v_band.band end);
    v_reward:=v_reward+v_roll;
  end loop;
  update public.gift_send_batches set total_reward=v_reward where id=v_batch.id returning * into v_batch;

  insert into public.wallet_ledger(user_id,delta_coins,reason,reference)
    values(p_sender,-v_cost,'gift_purchase','gift:debit:'||v_batch.id::text);
  if v_reward>0 then
    insert into public.wallet_ledger(user_id,delta_coins,reason,reference)
      values(p_recipient,v_reward,'gift_renta','gift:renta:'||v_batch.id::text);
  end if;
  insert into public.rev_accounts(user_id,total_rev,updated_at) values(p_recipient,v_rev,now())
    on conflict(user_id) do update set total_rev=public.rev_accounts.total_rev+excluded.total_rev,updated_at=now();
  insert into public.rev_ledger(recipient_id,batch_id,points) values(p_recipient,v_batch.id,v_rev);
  insert into public.gift_collection(recipient_id,gift_id,quantity)
    values(p_recipient,v_gift.id,p_quantity)
    on conflict(recipient_id,gift_id) do update set
      quantity=public.gift_collection.quantity+excluded.quantity,last_received_at=now();
  insert into public.gift_received_events(batch_id,recipient_id,gift_id,quantity)
    values(v_batch.id,p_recipient,v_gift.id,p_quantity);
  if p_context='dm' then
    insert into public.direct_messages(from_user_id,to_user_id,body,gift_batch_id)
      values(p_sender,p_recipient,'Cadeau envoyé : '||v_gift.name||' ×'||p_quantity,v_batch.id);
  end if;
  insert into public.notifications(user_id,kind,actor_id,gift_batch_id)
    values(p_recipient,'gift_received',p_sender,v_batch.id);
  return v_batch;
end;
$$;
revoke all on function public.send_virtual_gift(uuid,uuid,text,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.send_virtual_gift(uuid,uuid,text,integer,text,text,text,uuid) to service_role;

create function public.get_rev_progress(p_user_id uuid)
returns table(total_rev bigint,level integer,level_label text,level_start bigint,next_total bigint)
language plpgsql stable security definer set search_path=public as $$
declare v_total bigint;
begin
  if auth.uid() is null or p_user_id is null or
    (auth.uid()<>p_user_id and not public.are_friends(auth.uid(),p_user_id)) then
    raise exception 'Profil inaccessible.' using errcode='42501';
  end if;
  select coalesce(a.total_rev,0) into v_total from public.profiles p
    left join public.rev_accounts a on a.user_id=p.id where p.id=p_user_id;
  if not found then raise exception 'Profil introuvable.' using errcode='22023'; end if;
  return query select v_total,l.level,l.label,l.required_total,
    (select min(required_total) from public.rev_levels where required_total>v_total)
    from public.rev_levels l where l.required_total<=v_total order by l.required_total desc limit 1;
end;
$$;
revoke all on function public.get_rev_progress(uuid) from public,anon;
grant execute on function public.get_rev_progress(uuid) to authenticated;

create function public.gift_admin_metrics()
returns table(sent_count bigint,items_sent bigint,coins_spent bigint,rev_distributed bigint,coins_rewarded bigint,failed_attempts bigint)
language sql stable security definer set search_path=public as $$
  select count(*)::bigint,coalesce(sum(quantity),0)::bigint,coalesce(sum(total_price),0)::bigint,
    coalesce(sum(total_rev),0)::bigint,coalesce(sum(total_reward),0)::bigint,
    (select count(*) from public.gift_attempts) from public.gift_send_batches;
$$;
revoke all on function public.gift_admin_metrics() from public,anon,authenticated;
grant execute on function public.gift_admin_metrics() to service_role;
