-- Revanche Game — messagerie privée entre amis.
--
-- Même principe que friendships / game_invitations / notifications (voir
-- 20261026030000_social_core.sql) : aucune écriture directe par le
-- navigateur. Un message ne peut partir que via `send_direct_message`, qui
-- revérifie l'amitié et l'absence de blocage à chaque envoi — une amitié
-- peut être rompue entre deux messages, et la vérification à l'ajout en
-- liste ne suffirait pas.

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Identifie la conversation indépendamment du sens du message. Comme
  -- `friendships_unique_pair`, mais ici pour grouper en un aller-retour
  -- plutôt que pour contraindre l'unicité (une conversation a forcément
  -- plusieurs lignes).
  pair_key text generated always as (
    least(from_user_id, to_user_id)::text || ':' || greatest(from_user_id, to_user_id)::text
  ) stored,
  constraint direct_messages_not_self check (from_user_id <> to_user_id)
);

create index direct_messages_pair_idx on public.direct_messages (pair_key, created_at desc);
create index direct_messages_unread_idx on public.direct_messages (to_user_id) where read_at is null;

alter table public.direct_messages enable row level security;

create policy "direct_messages_select_involved" on public.direct_messages
  for select using (auth.uid() in (from_user_id, to_user_id));

-- Pas de politique insert/update : tout passe par les fonctions ci-dessous.

-- Envoie un message privé. Échoue silencieusement-côté-protocole (une
-- exception, reprise telle quelle par l'interface) si l'amitié a été rompue
-- ou si un blocage existe entre-temps.
create or replace function public.send_direct_message(p_to_user_id uuid, p_body text)
returns public.direct_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.direct_messages;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if p_to_user_id is null or p_to_user_id = v_me then
    raise exception 'destinataire invalide' using errcode = '22023';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 1000 then
    raise exception 'message invalide' using errcode = '22023';
  end if;
  -- Réutilise les mêmes fonctions que `send_game_invitation` : une seule
  -- définition de « amis » et de « bloqué » pour toute la plateforme.
  if not public.are_friends(v_me, p_to_user_id) then
    raise exception 'vous ne pouvez écrire qu''à vos amis' using errcode = '42501';
  end if;
  if public.is_blocked_between(v_me, p_to_user_id) then
    raise exception 'relation bloquée' using errcode = '42501';
  end if;

  insert into public.direct_messages (from_user_id, to_user_id, body)
  values (v_me, p_to_user_id, v_body)
  returning * into v_row;

  return v_row;
end;
$$;

-- Marque comme lus tous les messages reçus d'un ami précis.
create or replace function public.mark_direct_messages_read(p_other_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_count int;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  update public.direct_messages
  set read_at = now()
  where to_user_id = v_me
    and from_user_id = p_other_id
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Nombre de messages non lus, par expéditeur — une seule requête pour
-- afficher le pastille de chaque ami dans la liste, plutôt qu'un aller-retour
-- par ami.
create or replace function public.unread_direct_message_counts()
returns table (from_user_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select from_user_id, count(*)
  from public.direct_messages
  where to_user_id = auth.uid() and read_at is null
  group by from_user_id;
$$;

grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.mark_direct_messages_read(uuid) to authenticated;
grant execute on function public.unread_direct_message_counts() to authenticated;

-- Realtime : RLS applique déjà la même politique SELECT que la lecture
-- normale, donc chaque joueur ne reçoit en direct que ses propres
-- conversations.
alter publication supabase_realtime add table public.direct_messages;
