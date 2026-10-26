-- Revanche Game — groupes d'amis, chat de groupe, invitation d'un groupe à jouer.
--
-- Rien n'est dupliqué du socle existant :
--   • « être ami » reste défini par `are_friends` — on n'ajoute que ses amis ;
--   • inviter un groupe à jouer crée de vraies lignes `game_invitations`,
--     donc le parcours d'acceptation, l'expiration et le code de salon sont
--     exactement ceux des invitations entre deux joueurs ;
--   • les notifications passent par la table `notifications` existante.
--
-- ## Le piège à connaître : la récursion RLS
--
-- Une politique sur `friend_group_members` qui interroge
-- `friend_group_members` pour savoir si l'on est membre se rappelle
-- elle-même — PostgreSQL répond « infinite recursion detected in policy ».
-- D'où `is_group_member()`, en `security definer` : elle contourne RLS, donc
-- les politiques peuvent s'appuyer dessus sans se mordre la queue.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  avatar_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index friend_groups_owner_idx on public.friend_groups (owner_id);

create table public.friend_group_members (
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  -- Couper les notifications de messages pour ce groupe seulement.
  muted boolean not null default false,
  -- Sert au compteur de non-lus, comme `read_at` pour les messages privés.
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  -- La clé primaire composite interdit d'ajouter deux fois la même personne :
  -- c'est la base qui le garantit, pas du code applicatif.
  primary key (group_id, user_id)
);

create index friend_group_members_user_idx on public.friend_group_members (user_id);

create table public.friend_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index friend_group_messages_group_idx
  on public.friend_group_messages (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Appartenance — la fonction dont dépendent toutes les politiques
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

/** Rôle d'un joueur dans un groupe, ou null s'il n'en est pas membre. */
create or replace function public.group_role(p_group_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.friend_group_members
  where group_id = p_group_id and user_id = p_user_id;
$$;

-- Fonctions internes : les politiques et les autres fonctions s'en servent,
-- jamais le navigateur.
revoke all on function public.is_group_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.group_role(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Règles d'accès
--
-- Lecture réservée aux membres. Aucune politique d'écriture : tout passe par
-- les fonctions plus bas, qui revérifient le rôle.
-- ---------------------------------------------------------------------------

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.friend_group_messages enable row level security;

create policy "friend_groups_select_member" on public.friend_groups
  for select using (public.is_group_member(id, auth.uid()));

create policy "friend_group_members_select_member" on public.friend_group_members
  for select using (public.is_group_member(group_id, auth.uid()));

create policy "friend_group_messages_select_member" on public.friend_group_messages
  for select using (public.is_group_member(group_id, auth.uid()));

-- Seul réglage qu'un membre modifie lui-même : son propre silence et sa
-- propre position de lecture. Il ne peut toucher ni son rôle, ni la ligne
-- d'un autre (`using` et `with check` le limitent à lui-même, et le rôle est
-- protégé par le déclencheur ci-dessous).
create policy "friend_group_members_update_self" on public.friend_group_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.guard_group_member_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Une mise à jour directe ne peut changer que `muted` et `last_read_at`.
  -- S'octroyer le rôle d'administrateur passerait sinon par un simple UPDATE.
  if new.role is distinct from old.role
     or new.group_id is distinct from old.group_id
     or new.user_id is distinct from old.user_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'modification non autorisée' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_group_member_self_update
  before update on public.friend_group_members
  for each row
  -- Les fonctions `security definer` plus bas écrivent en tant que
  -- propriétaire ; ce garde-fou ne vise que les UPDATE venant du navigateur.
  when (current_setting('role', true) is distinct from 'service_role')
  execute function public.guard_group_member_self_update();

-- ---------------------------------------------------------------------------
-- 4. Notifications : deux nouveaux motifs
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists group_id uuid references public.friend_groups (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_request',
  'friend_accepted',
  'game_invitation',
  'invitation_accepted',
  'invitation_declined',
  'platform_invite',
  'group_added',
  'group_removed'
));

-- ---------------------------------------------------------------------------
-- 5. Fonctions — création et gestion
-- ---------------------------------------------------------------------------

/**
 * Crée un groupe et y place son propriétaire, plus les amis choisis.
 *
 * Seuls des amis peuvent être ajoutés : la même règle que pour les messages
 * privés et les invitations à jouer. On ne peut donc pas se servir d'un
 * groupe pour écrire à quelqu'un qui ne nous a pas acceptés.
 */
create or replace function public.create_friend_group(
  p_name text,
  p_member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_group_id uuid;
  v_member uuid;
  v_count int;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'donne un nom à ton groupe' using errcode = '22023';
  end if;

  select count(*) into v_count from public.friend_groups where owner_id = v_me;
  if v_count >= 30 then
    raise exception 'tu as atteint la limite de 30 groupes' using errcode = '55000';
  end if;

  insert into public.friend_groups (name, owner_id)
  values (trim(p_name), v_me)
  returning id into v_group_id;

  insert into public.friend_group_members (group_id, user_id, role)
  values (v_group_id, v_me, 'owner');

  foreach v_member in array coalesce(p_member_ids, '{}')
  loop
    if v_member <> v_me and public.are_friends(v_me, v_member) then
      -- `on conflict do nothing` : un même identifiant passé deux fois dans
      -- le tableau ne crée pas de doublon.
      insert into public.friend_group_members (group_id, user_id, role)
      values (v_group_id, v_member, 'member')
      on conflict do nothing;

      insert into public.notifications (user_id, kind, actor_id, group_id)
      values (v_member, 'group_added', v_me, v_group_id);
    end if;
  end loop;

  return v_group_id;
end;
$$;

/** Ajoute des amis à un groupe. Réservé au propriétaire et aux administrateurs. */
create or replace function public.add_group_members(
  p_group_id uuid,
  p_member_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role text;
  v_member uuid;
  v_added int := 0;
  v_size int;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  v_role := public.group_role(p_group_id, v_me);
  if v_role is null then
    raise exception 'tu n''es pas membre de ce groupe' using errcode = '42501';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'seul le créateur ou un administrateur peut ajouter des membres'
      using errcode = '42501';
  end if;

  select count(*) into v_size from public.friend_group_members where group_id = p_group_id;

  foreach v_member in array coalesce(p_member_ids, '{}')
  loop
    if v_size >= 50 then
      raise exception 'un groupe est limité à 50 membres' using errcode = '55000';
    end if;
    -- On n'ajoute que ses propres amis : être administrateur ne donne pas le
    -- droit d'enrôler des inconnus.
    if v_member <> v_me and public.are_friends(v_me, v_member) then
      insert into public.friend_group_members (group_id, user_id, role)
      values (p_group_id, v_member, 'member')
      on conflict do nothing;

      if found then
        v_added := v_added + 1;
        v_size := v_size + 1;
        insert into public.notifications (user_id, kind, actor_id, group_id)
        values (v_member, 'group_added', v_me, p_group_id);
      end if;
    end if;
  end loop;

  return v_added;
end;
$$;

/**
 * Retire un membre, ou se retire soi-même.
 *
 * Départ du propriétaire : la propriété passe au plus ancien administrateur,
 * à défaut au plus ancien membre. S'il était seul, le groupe est supprimé —
 * laisser un groupe sans propriétaire le rendrait ingérable.
 */
create or replace function public.remove_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role text;
  v_target_role text;
  v_heir uuid;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  v_role := public.group_role(p_group_id, v_me);
  if v_role is null then
    raise exception 'tu n''es pas membre de ce groupe' using errcode = '42501';
  end if;

  v_target_role := public.group_role(p_group_id, p_user_id);
  if v_target_role is null then
    raise exception 'cette personne n''est pas membre du groupe' using errcode = 'P0002';
  end if;

  if p_user_id <> v_me then
    if v_role not in ('owner', 'admin') then
      raise exception 'seul le créateur ou un administrateur peut retirer un membre'
        using errcode = '42501';
    end if;
    -- Un administrateur ne peut pas évincer le propriétaire.
    if v_target_role = 'owner' then
      raise exception 'le créateur du groupe ne peut pas être retiré' using errcode = '42501';
    end if;
    -- Ni un autre administrateur : seul le propriétaire arbitre entre pairs.
    if v_target_role = 'admin' and v_role <> 'owner' then
      raise exception 'seul le créateur peut retirer un administrateur' using errcode = '42501';
    end if;
  end if;

  delete from public.friend_group_members
  where group_id = p_group_id and user_id = p_user_id;

  if p_user_id <> v_me then
    insert into public.notifications (user_id, kind, actor_id, group_id)
    values (p_user_id, 'group_removed', v_me, p_group_id);
  end if;

  if v_target_role = 'owner' then
    select user_id into v_heir
    from public.friend_group_members
    where group_id = p_group_id
    order by (role = 'admin') desc, joined_at
    limit 1;

    if v_heir is null then
      delete from public.friend_groups where id = p_group_id;
      return 'deleted';
    end if;

    update public.friend_group_members
    set role = 'owner'
    where group_id = p_group_id and user_id = v_heir;

    update public.friend_groups set owner_id = v_heir where id = p_group_id;
    return 'transferred';
  end if;

  return 'removed';
end;
$$;

/** Renomme un groupe, ou change son rôle à un membre. */
create or replace function public.update_friend_group(
  p_group_id uuid,
  p_name text default null,
  p_promote_user_id uuid default null,
  p_promote_role text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role text;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  v_role := public.group_role(p_group_id, v_me);
  if v_role not in ('owner', 'admin') then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;

  if p_name is not null then
    if char_length(trim(p_name)) = 0 then
      raise exception 'le nom ne peut pas être vide' using errcode = '22023';
    end if;
    update public.friend_groups set name = trim(p_name) where id = p_group_id;
  end if;

  if p_promote_user_id is not null then
    -- Distribuer des rôles est une prérogative du propriétaire seul.
    if v_role <> 'owner' then
      raise exception 'seul le créateur peut changer les rôles' using errcode = '42501';
    end if;
    if p_promote_role not in ('admin', 'member') then
      raise exception 'rôle invalide' using errcode = '22023';
    end if;
    if p_promote_user_id = v_me then
      raise exception 'le créateur garde son rôle' using errcode = '22023';
    end if;

    update public.friend_group_members
    set role = p_promote_role
    where group_id = p_group_id and user_id = p_promote_user_id;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Fonctions — chat de groupe
-- ---------------------------------------------------------------------------

create or replace function public.send_group_message(p_group_id uuid, p_body text)
returns public.friend_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.friend_group_messages;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 1000 then
    raise exception 'message invalide' using errcode = '22023';
  end if;
  if not public.is_group_member(p_group_id, v_me) then
    raise exception 'tu n''es pas membre de ce groupe' using errcode = '42501';
  end if;

  insert into public.friend_group_messages (group_id, user_id, body)
  values (p_group_id, v_me, v_body)
  returning * into v_row;

  -- Écrire vaut lecture : on ne compte pas ses propres messages comme non lus.
  update public.friend_group_members
  set last_read_at = v_row.created_at
  where group_id = p_group_id and user_id = v_me;

  return v_row;
end;
$$;

create or replace function public.mark_group_read(p_group_id uuid)
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

  update public.friend_group_members
  set last_read_at = now()
  where group_id = p_group_id and user_id = v_me;

  return found;
end;
$$;

create or replace function public.set_group_muted(p_group_id uuid, p_muted boolean)
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

  update public.friend_group_members
  set muted = coalesce(p_muted, false)
  where group_id = p_group_id and user_id = v_me;

  return found;
end;
$$;

/**
 * Les groupes du joueur, avec ce qu'il faut pour les afficher en liste :
 * nombre de membres, messages non lus, aperçu du dernier message.
 *
 * Une seule requête plutôt qu'une par groupe côté navigateur.
 */
create or replace function public.my_friend_groups()
returns table (
  id uuid,
  name text,
  avatar_url text,
  owner_id uuid,
  my_role text,
  muted boolean,
  member_count bigint,
  unread_count bigint,
  last_message_at timestamptz,
  last_message_preview text,
  member_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  return query
  select
    g.id,
    g.name,
    g.avatar_url,
    g.owner_id,
    me.role,
    me.muted,
    (select count(*) from public.friend_group_members m where m.group_id = g.id),
    (select count(*) from public.friend_group_messages msg
      where msg.group_id = g.id
        and msg.created_at > me.last_read_at
        and msg.user_id <> v_me),
    (select max(msg.created_at) from public.friend_group_messages msg where msg.group_id = g.id),
    (select msg.body from public.friend_group_messages msg
      where msg.group_id = g.id order by msg.created_at desc limit 1),
    (select array_agg(m.user_id) from public.friend_group_members m where m.group_id = g.id)
  from public.friend_groups g
  join public.friend_group_members me on me.group_id = g.id and me.user_id = v_me
  order by coalesce(
    (select max(msg.created_at) from public.friend_group_messages msg where msg.group_id = g.id),
    g.created_at
  ) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Inviter tout un groupe à jouer
--
-- Ne réinvente rien : crée une vraie `game_invitation` par membre, donc
-- l'acceptation, l'expiration, la vérification du salon et la bannière
-- d'invitation sont exactement celles des invitations entre deux joueurs.
-- Les membres acceptant tombent sur le même `room_code`, donc dans la même
-- partie, sans avoir à taper quoi que ce soit.
-- ---------------------------------------------------------------------------

create or replace function public.invite_group_to_play(
  p_group_id uuid,
  p_game_slug text,
  p_room_code text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_member uuid;
  v_sent int := 0;
  v_room public.room_registry;
  v_capacity_left int;
  v_invitation uuid;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group_id, v_me) then
    raise exception 'tu n''es pas membre de ce groupe' using errcode = '42501';
  end if;
  if not exists (select 1 from public.game_catalog where slug = p_game_slug) then
    raise exception 'jeu inconnu' using errcode = 'P0002';
  end if;

  -- Place restante, quand le salon est connu du registre. Un salon inconnu
  -- n'est pas refusé : chaque jeu reste maître de ses salons, c'est son
  -- serveur qui tranchera à l'arrivée.
  if p_room_code is not null then
    select rr.* into v_room
    from public.room_registry rr
    where rr.game_slug = p_game_slug and rr.room_code = p_room_code;

    if v_room.id is not null then
      if v_room.status in ('closed', 'started') then
        raise exception 'ce salon n''accepte plus de joueurs' using errcode = '55000';
      end if;
      if v_room.capacity is not null then
        v_capacity_left := v_room.capacity - v_room.player_count;
        if v_capacity_left <= 0 then
          raise exception 'ce salon est complet' using errcode = '55000';
        end if;
      end if;
    end if;
  end if;

  for v_member in
    select m.user_id from public.friend_group_members m
    where m.group_id = p_group_id and m.user_id <> v_me
  loop
    -- On n'invite que ceux avec qui l'amitié tient toujours, et personne de
    -- bloqué : appartenir au même groupe ne contourne pas ces règles.
    if public.are_friends(v_me, v_member) and not public.is_blocked_between(v_me, v_member) then
      -- Respecte la capacité annoncée du salon plutôt que d'inviter plus de
      -- monde qu'il ne peut en accueillir.
      exit when v_capacity_left is not null and v_sent >= v_capacity_left;

      update public.game_invitations
      set status = 'cancelled', responded_at = now()
      where status = 'pending'
        and from_user_id = v_me
        and to_user_id = v_member
        and game_slug = p_game_slug;

      insert into public.game_invitations (game_slug, from_user_id, to_user_id, room_code)
      values (p_game_slug, v_me, v_member, p_room_code)
      returning id into v_invitation;

      insert into public.notifications (user_id, kind, actor_id, game_slug, invitation_id, group_id)
      values (v_member, 'game_invitation', v_me, p_game_slug, v_invitation, p_group_id);

      v_sent := v_sent + 1;
    end if;
  end loop;

  return v_sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Droits d'exécution
-- ---------------------------------------------------------------------------

grant execute on function public.create_friend_group(text, uuid[]) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.update_friend_group(uuid, text, uuid, text) to authenticated;
grant execute on function public.send_group_message(uuid, text) to authenticated;
grant execute on function public.mark_group_read(uuid) to authenticated;
grant execute on function public.set_group_muted(uuid, boolean) to authenticated;
grant execute on function public.my_friend_groups() to authenticated;
grant execute on function public.invite_group_to_play(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Temps réel
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.friend_group_messages;
alter publication supabase_realtime add table public.friend_group_members;
