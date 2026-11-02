-- Presentation-only aggregate. No identity, profile or individual score is exposed.
create function public.game_popularity()
returns table(game_slug text, games_played bigint)
language sql stable security definer set search_path=public as $$
  select s.game_slug, sum(s.games_played)::bigint
  from public.game_stats s
  group by s.game_slug
  having sum(s.games_played)>0
  order by sum(s.games_played) desc, s.game_slug;
$$;
revoke all on function public.game_popularity() from public;
grant execute on function public.game_popularity() to anon,authenticated;

-- Inbox over existing messages, scoped to the caller. No message is moved or rewritten.
create function public.direct_conversations()
returns table(other_id uuid, username text, avatar_url text, last_body text, last_at timestamptz, unread bigint)
language sql stable security definer set search_path=public as $$
  with involved as (
    select m.*, case when m.from_user_id=auth.uid() then m.to_user_id else m.from_user_id end other_id
    from public.direct_messages m where auth.uid() in (m.from_user_id,m.to_user_id)
  ), latest as (
    select distinct on (i.other_id) i.other_id,i.body,i.created_at
    from involved i order by i.other_id,i.created_at desc,i.id desc
  ), counts as (
    select i.other_id,count(*) filter(where i.to_user_id=auth.uid() and i.read_at is null) unread
    from involved i group by i.other_id
  )
  select l.other_id,
    case when public.are_friends(auth.uid(),l.other_id) and not public.is_blocked_between(auth.uid(),l.other_id) then p.username else 'Conversation' end,
    case when public.are_friends(auth.uid(),l.other_id) and not public.is_blocked_between(auth.uid(),l.other_id) then p.avatar_url else null end,
    l.body,l.created_at,c.unread
  from latest l join public.profiles p on p.id=l.other_id join counts c on c.other_id=l.other_id
  order by l.created_at desc;
$$;
revoke all on function public.direct_conversations() from public,anon;
grant execute on function public.direct_conversations() to authenticated;
