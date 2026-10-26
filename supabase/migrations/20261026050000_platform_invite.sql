-- Revanche Game — « Inviter à me rejoindre », distinct d'« Inviter à jouer ».
--
-- Pas de nouvelle table : c'est une simple notification, comme les autres —
-- aucun état à accepter/refuser, juste un signal qu'on peut ignorer. La seule
-- règle propre à celle-ci est la limite de fréquence (voir plus bas) : rien
-- n'empêcherait sinon un spam de clics sur le même ami.

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
    'friend_request',
    'friend_accepted',
    'game_invitation',
    'invitation_accepted',
    'invitation_declined',
    'platform_invite'
  ));

create or replace function public.invite_to_platform(p_to_user_id uuid)
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
  if p_to_user_id is null or p_to_user_id = v_me then
    raise exception 'destinataire invalide' using errcode = '22023';
  end if;
  if not public.are_friends(v_me, p_to_user_id) then
    raise exception 'vous ne pouvez inviter que vos amis' using errcode = '42501';
  end if;
  if public.is_blocked_between(v_me, p_to_user_id) then
    raise exception 'relation bloquée' using errcode = '42501';
  end if;

  -- Pas plus d'une invitation à la plateforme par paire toutes les deux
  -- heures : évite le spam par clics répétés, sans mémoriser d'état
  -- supplémentaire — la table `notifications` elle-même fait foi.
  if exists (
    select 1 from public.notifications
    where user_id = p_to_user_id
      and actor_id = v_me
      and kind = 'platform_invite'
      and created_at > now() - interval '2 hours'
  ) then
    raise exception 'invitation déjà envoyée récemment — réessayez plus tard' using errcode = '55000';
  end if;

  insert into public.notifications (user_id, kind, actor_id)
  values (p_to_user_id, 'platform_invite', v_me);

  return true;
end;
$$;

grant execute on function public.invite_to_platform(uuid) to authenticated;
