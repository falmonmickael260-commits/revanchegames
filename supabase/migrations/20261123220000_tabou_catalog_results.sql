-- Tabou / Revanche Games: catalog, verified player identity and genuine results.
-- All existing platform data remains untouched.
insert into public.game_catalog(slug,display_name,sort_order)
values ('tabou','Tabou Live',12)
on conflict (slug) do update set display_name=excluded.display_name;

alter table public.taboo_players
  add column if not exists platform_user_id uuid references public.profiles(id) on delete set null;
create unique index if not exists taboo_platform_member_per_room
  on public.taboo_players(room_id,platform_user_id) where platform_user_id is not null;

-- Only the server with service_role may link a verified RG user.
-- No browser RLS policies are granted write access to taboo_players.
create or replace function public.taboo_save_completed_result()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_players jsonb;
begin
  if old.status <> 'playing' or new.status <> 'finished' then
    return new;
  end if;
  select jsonb_agg(
    jsonb_build_object(
      'user_id',p.platform_user_id,
      'guest_label',case when p.platform_user_id is null then p.name else null end,
      'outcome',case when new.score_a=new.score_b then 'draw'
                 when (new.score_a > new.score_b and p.team='A')
                   or (new.score_b > new.score_a and p.team='B') then 'win'
                 else 'loss' end,
      'score',case when p.team='A' then new.score_a else new.score_b end,
      'position',case when new.score_a = new.score_b then 1
                      when (new.score_a > new.score_b and p.team='A')
                        or (new.score_b > new.score_a and p.team='B') then 1
                      else 2 end
    ) order by p.created_at
  ) into v_players
  from public.taboo_players p where p.room_id=new.id;
  if jsonb_array_length(coalesce(v_players,'[]'::jsonb)) = 0 then return new; end if;
  perform public.record_game_result(
    'tabou',
    'tabou:' || new.id::text,
    new.code,
    jsonb_build_object('game','tabou','room',new.code,'instance',new.id,
      'scoreA',new.score_a,'scoreB',new.score_b,'turns',new.turn_number,
      'finishedAt',now()),
    v_players
  );
  return new;
end $$;
revoke all on function public.taboo_save_completed_result() from public,anon,authenticated;
drop trigger if exists taboo_game_complete_stats on public.taboo_rooms;
create trigger taboo_game_complete_stats
after update of status on public.taboo_rooms
for each row when (new.status='finished' and old.status is distinct from new.status)
execute function public.taboo_save_completed_result();
