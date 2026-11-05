-- Retire les plafonds de dépense quotidiens, sans toucher aux débits,
-- aux récompenses ni aux contrôles anti-doublon de la transaction.
do $$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(
    'public.send_virtual_gift(uuid,uuid,text,integer,text,text,text,uuid)'::regprocedure
  ) into v_definition;

  v_updated := regexp_replace(
    v_definition,
    'if v_spent\+v_cost>v_settings\.max_daily_spend or v_recipient_spent\+v_cost>v_settings\.max_daily_to_recipient then[[:space:]]+raise exception ''Limite quotidienne de cadeaux atteinte\.'' using errcode=''P0001'';[[:space:]]+end if;',
    '-- Plafonds quotidiens retires a la demande du proprietaire.',
    'g'
  );

  if v_updated = v_definition then
    raise exception 'Impossible de retirer les plafonds : bloc attendu absent de send_virtual_gift.';
  end if;

  execute v_updated;
end;
$$;
