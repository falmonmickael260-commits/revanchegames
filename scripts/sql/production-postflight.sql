-- Lecture seule. Après les migrations, avant le nouveau serveur de jeu.
begin read only;
do $$
declare signature text; role_name text; v_table text;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='role_reservations' and column_name='charged' and is_nullable='NO' and column_default='false') then raise exception 'Colonne charged absente ou incorrecte'; end if;
  if to_regprocedure('public.reserve_role(text,text,uuid,text,bigint)') is not null or to_regprocedure('public.resolve_role_reservations(text,text,uuid[])') is not null then raise exception 'Anciennes signatures encore présentes'; end if;
  foreach signature in array array['reserve_role(text,text,uuid,text,bigint,uuid,timestamptz)','resolve_role_reservations(text,text,uuid[],uuid[])','cancel_role_reservation(uuid)','cancel_role_reservations(text,text)','record_game_result(text,text,text,jsonb,jsonb)','record_la_meute_result(text,text,jsonb,jsonb)'] loop
    if to_regprocedure('public.' || signature) is null then raise exception 'Fonction absente : %', signature; end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,'public.' || signature,'EXECUTE') then raise exception 'Fonction financière accessible à % : %',role_name,signature; end if;
    end loop;
    if not has_function_privilege('service_role','public.' || signature,'EXECUTE') then raise exception 'service_role ne peut pas appeler %',signature; end if;
  end loop;
  foreach v_table in array array['wallet_accounts','wallet_ledger','role_reservations','promo_codes','promo_redemptions','cancelled_role_requests','game_results','game_result_players'] loop
    if to_regclass('public.' || v_table) is null then raise exception 'Table absente : %',v_table; end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.' || v_table)) then raise exception 'RLS désactivée : %',v_table; end if;
    if exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=v_table and p.cmd in ('ALL','INSERT','UPDATE','DELETE') and p.roles && array['public','anon','authenticated']::name[]) then raise exception 'Politique d''écriture cliente à examiner : %',v_table; end if;
  end loop;
  if pg_get_functiondef('public.record_game_result(text,text,text,jsonb,jsonb)'::regprocedure) not like '%serveur de confiance%' then raise exception 'Ancienne RPC non protégée pour La Meute'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.game_result_players'::regclass and tgname='reward_la_meute_winner' and tgenabled in ('O','A')) then raise exception 'Récompense de victoire non activée'; end if;
  if not exists (select 1 from public.promo_codes where code='RG1500' and reward_coins=1500 and active) then raise exception 'Bonus de 1500 pièces non configuré'; end if;
  if pg_get_functiondef('public.redeem_promo_code(text)'::regprocedure) not like '%REVANCHE1500%' then raise exception 'Alias REVANCHE1500 absent'; end if;
  if pg_get_functiondef('public.apply_wallet_ledger()'::regprocedure) not like '%v_held%' then raise exception 'Contrôle des montants réservés absent'; end if;
end;
$$;
select 'profiles' as table_name, count(*) as row_count from public.profiles
union all select 'wallet_accounts',count(*) from public.wallet_accounts
union all select 'wallet_ledger',count(*) from public.wallet_ledger
union all select 'role_reservations',count(*) from public.role_reservations
union all select 'promo_redemptions',count(*) from public.promo_redemptions;
commit;
