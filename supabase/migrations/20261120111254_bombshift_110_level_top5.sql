-- Public output is limited to five names and times. Account saves remain private.
create or replace function public.bombshift_level_top5(p_map_id text)
returns table(rank bigint, username text, best_time_ms bigint)
language sql stable security invoker set search_path = ''
as $$
  with candidates as (
    select s.user_id,
      case when p.ghost_mode or not p.profile_visible then 'Joueur discret' else p.username end as name,
      case when jsonb_typeof(s.save_data #> array['maps',p_map_id,'bestTimeMs']) = 'number'
        then (s.save_data #>> array['maps',p_map_id,'bestTimeMs'])::numeric end as time_ms
    from public.bombshift_account_progress s
    join public.profiles p on p.id = s.user_id
    where (p_map_id in ('volcano','ice','temple','volcano2','ice2','temple2','volcano3','ice3','temple3')
      or p_map_id ~ '^level-([1-9][0-9]|10[0-9]|110)$')
      and s.save_data #> array['maps',p_map_id,'cleared'] = 'true'::jsonb
  ), valid as (
    select * from candidates where time_ms > 0 and time_ms <= 86400000 and time_ms = trunc(time_ms)
  )
  select row_number() over(order by time_ms, user_id), name, time_ms::bigint
  from valid order by time_ms, user_id limit 5;
$$;
revoke all on function public.bombshift_level_top5(text) from public, anon, authenticated;
grant execute on function public.bombshift_level_top5(text) to service_role;
