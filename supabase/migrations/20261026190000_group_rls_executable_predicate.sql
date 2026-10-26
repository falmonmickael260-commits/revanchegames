-- Revanche Game — répare la lecture des groupes.
--
-- ## Le bug
--
-- Les trois politiques de lecture appelaient `is_group_member()`, dont le
-- droit d'exécution avait été révoqué pour `authenticated`. Or **une
-- politique RLS s'évalue avec les droits de celui qui interroge**, pas avec
-- ceux du propriétaire de la table : la politique échouait donc pour tout le
-- monde, membres compris. Un membre ne pouvait lire ni le groupe, ni la liste
-- des membres, ni les messages.
--
-- Le compteur de non-lus, lui, fonctionnait — il passe par
-- `my_friend_groups()`, qui est `security definer` et contourne RLS. C'est
-- exactement ce qui rendait le bug sournois : la liste des groupes
-- s'affichait correctement alors que le chat était vide.
--
-- ## La correction
--
-- Une fonction dédiée aux politiques, `am_i_group_member()`, exécutable par
-- `authenticated`. Elle ne prend **que** l'identifiant du groupe et lit
-- `auth.uid()` elle-même : on ne peut donc pas s'en servir pour sonder
-- l'appartenance d'autrui, contrairement à `is_group_member(group, user)`,
-- qui reste réservée aux fonctions internes.

create or replace function public.am_i_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

revoke all on function public.am_i_group_member(uuid) from public, anon;
grant execute on function public.am_i_group_member(uuid) to authenticated;

drop policy if exists "friend_groups_select_member" on public.friend_groups;
drop policy if exists "friend_group_members_select_member" on public.friend_group_members;
drop policy if exists "friend_group_messages_select_member" on public.friend_group_messages;

create policy "friend_groups_select_member" on public.friend_groups
  for select using (public.am_i_group_member(id));

create policy "friend_group_members_select_member" on public.friend_group_members
  for select using (public.am_i_group_member(group_id));

create policy "friend_group_messages_select_member" on public.friend_group_messages
  for select using (public.am_i_group_member(group_id));
