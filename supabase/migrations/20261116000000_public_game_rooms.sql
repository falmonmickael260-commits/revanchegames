create table public.public_game_rooms (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.game_catalog(slug),
  room_code text not null,
  instance_key text not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  refreshed_at timestamptz,
  unique(game_slug, room_code, instance_key)
);
create index public_game_rooms_active_idx on public.public_game_rooms(refreshed_at desc) where refreshed_at is not null;
alter table public.public_game_rooms enable row level security;
revoke all on public.public_game_rooms from public, anon, authenticated;
grant select, insert, update, delete on public.public_game_rooms to service_role;

create function public.find_public_game_rooms(p_viewer uuid, p_id uuid default null)
returns table(id uuid, game_slug text, room_code text, instance_key text, host_id uuid, host_name text, player_count int, capacity int)
language sql stable security definer set search_path = public as $$
  select r.id, r.game_slug, r.room_code, r.instance_key, r.host_id, p.username, rr.player_count, rr.capacity
  from public.public_game_rooms r
  join public.room_registry rr using (game_slug, room_code, instance_key)
  join public.profiles p on p.id = r.host_id
  where (p_id is null or r.id = p_id)
    and r.refreshed_at > now() - interval '50 seconds'
    and rr.refreshed_at > now() - interval '50 seconds'
    and rr.status = 'open' and rr.player_count < rr.capacity
    and (p_viewer is null or not public.is_blocked_between(p_viewer, r.host_id))
  order by r.refreshed_at desc, r.id
  limit 60;
$$;
revoke all on function public.find_public_game_rooms(uuid, uuid) from public, anon, authenticated;
grant execute on function public.find_public_game_rooms(uuid, uuid) to service_role;
