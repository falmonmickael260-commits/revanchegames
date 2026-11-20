-- The server calls this after reusing the existing verified Stripe fulfillment.
-- Browsers cannot forge an audit outcome; summary is read from the order itself.
create function public.admin_finish_reconciliation(p_id uuid,p_actor uuid,p_verified boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare op public.admin_operations; summary jsonb;
begin
  select * into op from public.admin_operations where id=p_id and actor_id=p_actor and action='reconcile' for update;
  if not found then raise exception 'opération introuvable'; end if;
  select jsonb_build_object('purchase',id,'state',state,'entitled_coins',entitled_coins,
    'refunded_amount',refunded_amount,'verification',case when p_verified then 'verified' else 'retryable_failure' end)
    into summary from public.stripe_purchases where id=(op.payload->>'target')::uuid;
  update public.admin_operations set result=summary where id=p_id;
  update public.admin_audit set after_value=summary where id=p_id;
  return summary;
end $$;
revoke all on function public.admin_finish_reconciliation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_finish_reconciliation(uuid,uuid,boolean) to service_role;
