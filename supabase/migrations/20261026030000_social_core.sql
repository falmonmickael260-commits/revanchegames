-- Revanche Game — socle social : amis, présence, invitations, notifications,
-- abonnements push.
--
-- Principes suivis ici, et à respecter si on étend ce fichier :
--
-- 1. Aucune écriture directe par le navigateur sur les tables sensibles.
--    `friendships`, `game_invitations` et `notifications` n'ont que des
--    politiques SELECT. Toute mutation passe par une fonction `security
--    definer` qui revérifie l'identité avec `auth.uid()` — jamais avec un
--    identifiant envoyé par le client. Un joueur ne peut donc pas s'inviter
--    dans l'amitié d'autrui, accepter une invitation qui ne lui est pas
--    destinée, ni forger une notification.
-- 2. Les contraintes d'unicité font le travail que du code applicatif ferait
--    mal en cas de double clic ou de course entre deux onglets.
-- 3. Une seule relation par paire de joueurs, quel que soit le sens de la
--    demande (voir `friendships_unique_pair`).

-- ---------------------------------------------------------------------------
-- 1. Confidentialité et recherche sur les profils
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- Partager « en partie sur Kilomax » avec ses amis, ou rester discret.
  add column if not exists share_activity boolean not null default true,
  -- Refuser de recevoir de nouvelles demandes d'ami.
  add column if not exists allow_friend_requests boolean not null default true;

-- Recherche par préfixe de pseudonyme. L'index porte sur `lower(username)`
-- avec text_pattern_ops : c'est ce que `search_players` interroge, donc la
-- recherche reste indexée même avec beaucoup de comptes.
create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username) text_pattern_ops);

-- ---------------------------------------------------------------------------
-- 2. Amitiés
-- ---------------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  -- Qui a bloqué : le blocage est dirigé, contrairement à l'amitié.
  blocked_by uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  -- `blocked_by` est renseigné exactement quand le statut est 'blocked'.
  constraint friendships_blocker_matches_status check ((status = 'blocked') = (blocked_by is not null))
);

-- Le cœur de « pas de demandes ni d'amitiés en double » : une seule ligne par
-- paire, que ce soit A qui demande à B ou B qui demande à A.
create unique index friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_requester_idx on public.friendships (requester_id, status);
create index friendships_addressee_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

-- Lecture : seulement les relations où l'on est impliqué.
create policy "friendships_select_involved" on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));

-- Aucune politique insert/update/delete : voir les fonctions plus bas.

-- ---------------------------------------------------------------------------
-- 3. Invitations à jouer
-- ---------------------------------------------------------------------------

create table public.game_invitations (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.game_catalog (slug),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  -- Facultatif : chaque jeu reste maître de ses salons. Sans code, l'invitation
  -- vaut « rejoins-moi sur ce jeu ».
  room_code text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint game_invitations_not_self check (from_user_id <> to_user_id)
);

-- Une seule invitation en attente par (expéditeur, destinataire, jeu) :
-- empêche le spam et les doubles clics.
create unique index game_invitations_one_pending
  on public.game_invitations (from_user_id, to_user_id, game_slug)
  where status = 'pending';

create index game_invitations_to_user_idx
  on public.game_invitations (to_user_id, status, created_at desc);
create index game_invitations_from_user_idx
  on public.game_invitations (from_user_id, status, created_at desc);

alter table public.game_invitations enable row level security;

create policy "game_invitations_select_involved" on public.game_invitations
  for select using (auth.uid() in (from_user_id, to_user_id));

-- ---------------------------------------------------------------------------
-- 4. Notifications dans la plateforme
--
-- Volontairement indépendantes du push : elles fonctionnent même si le
-- navigateur refuse les notifications système, et restent consultables à la
-- reconnexion. Le push n'est qu'un moyen de les faire sonner plus tôt.
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'friend_request',
    'friend_accepted',
    'game_invitation',
    'invitation_accepted',
    'invitation_declined'
  )),
  -- Qui a provoqué la notification (l'ami, l'invitant).
  actor_id uuid references public.profiles (id) on delete cascade,
  game_slug text references public.game_catalog (slug),
  invitation_id uuid references public.game_invitations (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

-- Pas de politique UPDATE : marquer comme lu passe par
-- `mark_notifications_read`, pour qu'un client ne puisse pas réécrire `kind`
-- ou `actor_id` d'une notification qu'il a reçue.

-- ---------------------------------------------------------------------------
-- 5. Abonnements Web Push
--
-- Ici, et seulement ici, le client écrit directement : un abonnement push est
-- produit par le navigateur du joueur et ne concerne que lui. Les politiques
-- le limitent strictement à ses propres lignes. La clé VAPID privée, elle,
-- ne vit que côté serveur (variable d'environnement) — jamais en base.
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Identifie l'appareil/navigateur. Unique : un même appareil qui se
  -- réabonne met à jour sa ligne au lieu d'en créer une seconde.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Incrémenté quand un envoi échoue ; sert à purger les abonnements morts.
  failure_count int not null default 0
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Fonctions — toutes les mutations sensibles
-- ---------------------------------------------------------------------------

-- Deux joueurs sont-ils amis ? Utilisé par les invitations.
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;

-- Y a-t-il un blocage entre ces deux joueurs, dans un sens ou l'autre ?
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'blocked'
      and least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;

-- Recherche de joueurs par préfixe de pseudonyme.
--
-- Ne renvoie que ce qui est déjà public (pseudonyme, avatar) — jamais
-- d'adresse e-mail, qui n'est de toute façon pas dans `profiles`. Exclut le
-- demandeur et toute personne avec qui il y a un blocage. `relationship` dit
-- où en est la relation, pour que l'interface propose la bonne action.
create or replace function public.search_players(p_query text, p_limit int default 10)
returns table (
  id uuid,
  username text,
  avatar_url text,
  relationship text,
  accepts_requests boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_needle text := lower(trim(coalesce(p_query, '')));
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  -- Deux caractères minimum : évite de renvoyer tout l'annunaire sur une lettre.
  if char_length(v_needle) < 2 then
    return;
  end if;

  return query
  select
    pr.id,
    pr.username,
    pr.avatar_url,
    coalesce(
      case
        when f.status = 'accepted' then 'friend'
        when f.status = 'pending' and f.requester_id = v_me then 'request_sent'
        when f.status = 'pending' then 'request_received'
      end,
      'none'
    ) as relationship,
    pr.allow_friend_requests as accepts_requests
  from public.profiles pr
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(pr.id, v_me)
   and greatest(f.requester_id, f.addressee_id) = greatest(pr.id, v_me)
  where pr.id <> v_me
    and lower(pr.username) like v_needle || '%'
    -- Un blocage rend le joueur invisible dans la recherche, dans les deux sens.
    and coalesce(f.status, '') <> 'blocked'
  order by pr.username
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
end;
$$;

-- Envoie une demande d'ami.
create or replace function public.send_friend_request(p_target_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_existing public.friendships;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if p_target_id is null or p_target_id = v_me then
    raise exception 'destinataire invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'joueur introuvable' using errcode = 'P0002';
  end if;
  if not (select allow_friend_requests from public.profiles where id = p_target_id) then
    raise exception 'ce joueur n''accepte pas les demandes d''ami' using errcode = '42501';
  end if;

  select * into v_existing
  from public.friendships
  where least(requester_id, addressee_id) = least(v_me, p_target_id)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_target_id);

  if v_existing.id is not null then
    if v_existing.status = 'blocked' then
      raise exception 'relation bloquée' using errcode = '42501';
    end if;
    -- Déjà amis, ou demande déjà en attente dans un sens ou l'autre :
    -- on renvoie la relation existante au lieu d'en créer une seconde.
    return v_existing.id;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, p_target_id, 'pending')
  returning id into v_id;

  insert into public.notifications (user_id, kind, actor_id)
  values (p_target_id, 'friend_request', v_me);

  return v_id;
end;
$$;

-- Accepte ou refuse une demande reçue. Seul le destinataire peut répondre, et
-- seulement tant que la demande est en attente.
create or replace function public.respond_to_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.friendships;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  -- `for update` : deux clics simultanés sur Accepter ne peuvent pas passer
  -- tous les deux.
  select * into v_row from public.friendships where id = p_friendship_id for update;

  if v_row.id is null then
    raise exception 'demande introuvable' using errcode = 'P0002';
  end if;
  if v_row.addressee_id <> v_me then
    raise exception 'cette demande ne vous est pas adressée' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'demande déjà traitée' using errcode = '55000';
  end if;

  if p_accept then
    update public.friendships
    set status = 'accepted', responded_at = now()
    where id = p_friendship_id;

    insert into public.notifications (user_id, kind, actor_id)
    values (v_row.requester_id, 'friend_accepted', v_me);

    return 'accepted';
  end if;

  -- Refus : on supprime la ligne plutôt que de la marquer, pour que le
  -- demandeur puisse retenter plus tard sans rester bloqué par l'unicité
  -- de paire — et sans qu'on lui notifie le refus.
  delete from public.friendships where id = p_friendship_id;
  return 'declined';
end;
$$;

-- Retire un ami (ou annule une demande qu'on a envoyée).
create or replace function public.remove_friend(p_other_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_deleted int;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  delete from public.friendships
  where least(requester_id, addressee_id) = least(v_me, p_other_id)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_other_id)
    -- On ne lève pas un blocage par mégarde : cela passe par unblock_player.
    and status <> 'blocked';

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- Bloque un joueur : supprime l'amitié éventuelle, annule les invitations en
-- cours dans les deux sens, et pose un blocage dirigé.
create or replace function public.block_player(p_other_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if p_other_id is null or p_other_id = v_me then
    raise exception 'cible invalide' using errcode = '22023';
  end if;

  delete from public.friendships
  where least(requester_id, addressee_id) = least(v_me, p_other_id)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_other_id);

  insert into public.friendships (requester_id, addressee_id, status, blocked_by, responded_at)
  values (v_me, p_other_id, 'blocked', v_me, now());

  update public.game_invitations
  set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and least(from_user_id, to_user_id) = least(v_me, p_other_id)
    and greatest(from_user_id, to_user_id) = greatest(v_me, p_other_id);

  return true;
end;
$$;

-- Lève un blocage — seulement celui qu'on a posé soi-même.
create or replace function public.unblock_player(p_other_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_deleted int;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  delete from public.friendships
  where status = 'blocked'
    and blocked_by = v_me
    and least(requester_id, addressee_id) = least(v_me, p_other_id)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_other_id);

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- Invite un ami à jouer.
--
-- Ne contourne aucune règle de jeu : si un `room_code` est fourni et que le
-- salon est connu du registre, on vérifie qu'il est encore ouvert et qu'il
-- reste de la place. Le registre n'étant qu'un miroir (chaque jeu reste maître
-- de ses salons), un salon inconnu du registre n'est pas refusé — c'est le
-- serveur du jeu qui tranchera à l'arrivée.
create or replace function public.send_game_invitation(
  p_to_user_id uuid,
  p_game_slug text,
  p_room_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_room public.room_registry;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if not exists (select 1 from public.game_catalog where slug = p_game_slug) then
    raise exception 'jeu inconnu' using errcode = 'P0002';
  end if;
  if not public.are_friends(v_me, p_to_user_id) then
    raise exception 'vous ne pouvez inviter que vos amis' using errcode = '42501';
  end if;
  if public.is_blocked_between(v_me, p_to_user_id) then
    raise exception 'relation bloquée' using errcode = '42501';
  end if;

  if p_room_code is not null then
    select * into v_room
    from public.room_registry
    where game_slug = p_game_slug and room_code = p_room_code;

    if v_room.id is not null then
      if v_room.status in ('closed', 'started') then
        raise exception 'ce salon n''accepte plus de joueurs' using errcode = '55000';
      end if;
      if v_room.capacity is not null and v_room.player_count >= v_room.capacity then
        raise exception 'ce salon est complet' using errcode = '55000';
      end if;
    end if;
  end if;

  -- Une invitation en attente du même expéditeur pour le même jeu est
  -- remplacée : le code de salon a pu changer entre-temps.
  update public.game_invitations
  set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and from_user_id = v_me
    and to_user_id = p_to_user_id
    and game_slug = p_game_slug;

  insert into public.game_invitations (game_slug, from_user_id, to_user_id, room_code)
  values (p_game_slug, v_me, p_to_user_id, p_room_code)
  returning id into v_id;

  insert into public.notifications (user_id, kind, actor_id, game_slug, invitation_id)
  values (p_to_user_id, 'game_invitation', v_me, p_game_slug, v_id);

  return v_id;
end;
$$;

-- Répond à une invitation. Renvoie le jeu et le salon à rejoindre en cas
-- d'acceptation, pour que l'interface puisse ouvrir directement la partie.
--
-- Atomique et à usage unique : le `for update` + le test de statut font qu'une
-- invitation déjà traitée ou expirée ne peut pas être acceptée une deuxième
-- fois, même sur deux appareils simultanément.
create or replace function public.respond_to_game_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns table (status text, game_slug text, room_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.game_invitations;
  v_room public.room_registry;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  select * into v_row from public.game_invitations where id = p_invitation_id for update;

  if v_row.id is null then
    raise exception 'invitation introuvable' using errcode = 'P0002';
  end if;
  if v_row.to_user_id <> v_me then
    raise exception 'cette invitation ne vous est pas adressée' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'invitation déjà traitée' using errcode = '55000';
  end if;
  if v_row.expires_at <= now() then
    raise exception 'invitation expirée' using errcode = '55000';
  end if;

  if not p_accept then
    update public.game_invitations
    set status = 'declined', responded_at = now()
    where id = p_invitation_id;

    insert into public.notifications (user_id, kind, actor_id, game_slug, invitation_id)
    values (v_row.from_user_id, 'invitation_declined', v_me, v_row.game_slug, v_row.id);

    return query select 'declined'::text, v_row.game_slug, null::text;
  end if;

  -- Le salon peut s'être rempli ou fermé entre l'envoi et la réponse.
  if v_row.room_code is not null then
    -- `rr.` est obligatoire ici : les paramètres de sortie de cette fonction
    -- s'appellent `status`, `game_slug` et `room_code`, donc une référence de
    -- colonne non qualifiée serait ambiguë et la fonction échouerait.
    select rr.* into v_room
    from public.room_registry rr
    where rr.game_slug = v_row.game_slug and rr.room_code = v_row.room_code;

    if v_room.id is not null then
      if v_room.status in ('closed', 'started') then
        raise exception 'ce salon n''accepte plus de joueurs' using errcode = '55000';
      end if;
      if v_room.capacity is not null and v_room.player_count >= v_room.capacity then
        raise exception 'ce salon est complet' using errcode = '55000';
      end if;
    end if;
  end if;

  update public.game_invitations
  set status = 'accepted', responded_at = now()
  where id = p_invitation_id;

  insert into public.notifications (user_id, kind, actor_id, game_slug, invitation_id)
  values (v_row.from_user_id, 'invitation_accepted', v_me, v_row.game_slug, v_row.id);

  return query select 'accepted'::text, v_row.game_slug, v_row.room_code;
end;
$$;

-- Marque des notifications comme lues (toutes, ou une liste précise).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
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

  update public.notifications
  set read_at = now()
  where user_id = v_me
    and read_at is null
    and (p_ids is null or id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Chiffres publics de la plateforme.
--
-- `registered_players` est un vrai `count(*)` sur `profiles`, calculé à la
-- lecture : il suit donc immédiatement les créations et suppressions de
-- comptes, ne compte chaque compte qu'une fois (clé primaire), et ne compte
-- aucun visiteur anonyme (un visiteur n'a pas de profil). Aucune donnée
-- privée n'entre dans ce calcul — `profiles` ne contient pas d'e-mail.
create or replace function public.platform_stats()
returns table (registered_players bigint, games_recorded bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles),
    (select count(*) from public.game_results);
$$;

-- ---------------------------------------------------------------------------
-- 7. Droits d'exécution
--
-- `security definer` contourne RLS : ces fonctions doivent donc être les
-- seules portes d'entrée, et n'être appelables que par un compte connecté.
-- Chacune revérifie `auth.uid()` en première ligne.
-- ---------------------------------------------------------------------------

revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

grant execute on function public.search_players(text, int) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_player(uuid) to authenticated;
grant execute on function public.unblock_player(uuid) to authenticated;
grant execute on function public.send_game_invitation(uuid, text, text) to authenticated;
grant execute on function public.respond_to_game_invitation(uuid, boolean) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Le compteur d'inscrits s'affiche aussi pour un visiteur non connecté.
grant execute on function public.platform_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Temps réel
--
-- Realtime applique les politiques RLS de la table : chaque joueur ne reçoit
-- que les lignes qu'il a le droit de lire (ses notifications, ses invitations,
-- ses relations).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.game_invitations;
alter publication supabase_realtime add table public.friendships;
