-- Revanche Game — signature de profil, signalements, et modération d'avatar.
--
-- Trois ajouts indépendants mais liés par un même besoin : donner à un joueur
-- de quoi se présenter, et donner à la plateforme de quoi réagir quand ce
-- qu'il publie pose problème.

-- ---------------------------------------------------------------------------
-- 1. Signature de profil
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- Une phrase courte affichée sous le pseudonyme. Volontairement limitée :
  -- c'est une signature, pas une biographie, et elle doit tenir sur une ligne
  -- dans la liste d'amis comme sur la fiche de profil.
  add column if not exists signature text,
  -- État de modération de la photo de profil. `rejected` sert au retrait
  -- d'une photo signalée : l'avatar est effacé et le joueur ne peut pas en
  -- remettre une tant que l'état n'est pas remis à `ok`.
  add column if not exists avatar_status text not null default 'ok';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_signature_length'
  ) then
    alter table public.profiles
      add constraint profiles_signature_length
      check (signature is null or char_length(signature) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_status_valid'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_status_valid
      check (avatar_status in ('ok', 'pending', 'rejected'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Signalements
--
-- Le filet de sécurité derrière la modération automatique : ce qu'un
-- programme laisse passer, un joueur le signale. Écriture réservée à la
-- fonction `submit_report`, qui applique les limites de fréquence.
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  -- Nul pour un signalement qui ne vise personne (bug, souci technique).
  target_user_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'avatar',        -- photo de profil choquante
    'signature',     -- texte de signature
    'username',      -- pseudonyme
    'behaviour',     -- comportement en jeu ou dans le chat
    'message',       -- message privé ou public
    'bug',           -- souci technique
    'other'
  )),
  -- Où le problème a été rencontré : slug de jeu, code de salon, page.
  context text,
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_not_self check (target_user_id is null or target_user_id <> reporter_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_user_id, status);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

-- Un seul signalement ouvert par (auteur, cible, motif) : signaler deux fois
-- la même photo ne crée pas deux dossiers.
create unique index if not exists reports_one_open_per_target
  on public.reports (reporter_id, target_user_id, kind)
  where status in ('open', 'reviewing') and target_user_id is not null;

alter table public.reports enable row level security;

-- On ne lit que ses propres signalements — jamais ceux qui nous visent, et
-- jamais ceux des autres. Le traitement se fait avec la clé de service.
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id);

-- Aucune politique d'écriture : tout passe par submit_report.

-- ---------------------------------------------------------------------------
-- 3. Fonctions
-- ---------------------------------------------------------------------------

/**
 * Enregistre un signalement.
 *
 * Limites appliquées côté base, donc incontournables depuis le navigateur :
 *  • 10 signalements par heure et par compte ;
 *  • un seul dossier ouvert par (auteur, cible, motif), via l'index unique ;
 *  • impossible de se signaler soi-même.
 */
create or replace function public.submit_report(
  p_kind text,
  p_target_user_id uuid default null,
  p_context text default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_recent int;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if p_target_user_id is not null and p_target_user_id = v_me then
    raise exception 'vous ne pouvez pas vous signaler vous-même' using errcode = '22023';
  end if;
  if p_target_user_id is not null
     and not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'joueur introuvable' using errcode = 'P0002';
  end if;

  select count(*) into v_recent
  from public.reports
  where reporter_id = v_me and created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'trop de signalements envoyés récemment, réessaie plus tard'
      using errcode = '55000';
  end if;

  insert into public.reports (reporter_id, target_user_id, kind, context, details)
  values (v_me, p_target_user_id, p_kind, left(coalesce(p_context, ''), 200), p_details)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    -- L'index unique a parlé : un dossier est déjà ouvert pour ce motif.
    raise exception 'tu as déjà signalé ce joueur pour ce motif' using errcode = '55000';
  end if;

  return v_id;
end;
$$;

/**
 * Retire la photo de profil d'un joueur et l'empêche d'en remettre une.
 *
 * Réservée à la clé de service : c'est une décision de modération, pas une
 * action de joueur. Remettre `avatar_status` à 'ok' rend le droit d'en
 * publier une nouvelle.
 */
create or replace function public.set_avatar_status(
  p_user_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('ok', 'pending', 'rejected') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;

  update public.profiles
  set avatar_status = p_status,
      -- Un refus efface la photo : la laisser visible viderait la mesure de
      -- son sens.
      avatar_url = case when p_status = 'rejected' then null else avatar_url end
  where id = p_user_id;

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Droits d'exécution
-- ---------------------------------------------------------------------------

grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

-- Modération : jamais appelable depuis un navigateur.
revoke all on function public.set_avatar_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_avatar_status(uuid, text) to service_role;
