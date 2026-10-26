-- Revanche Game — retire l'écriture directe sur `friend_group_members`.
--
-- La migration précédente autorisait un membre à modifier sa propre ligne
-- (pour `muted` et `last_read_at`), avec un déclencheur censé l'empêcher de
-- s'attribuer un rôle au passage. Deux problèmes :
--
--  1. **Le déclencheur bloquait nos propres fonctions.** Sa condition
--     s'appuyait sur `current_setting('role')`, qui vaut `authenticated`
--     même pendant l'exécution d'une fonction `security definer` — le rôle
--     de session n'est pas celui du propriétaire de la fonction. Le
--     transfert de propriété de `remove_group_member` et la promotion
--     d'`update_friend_group` auraient donc échoué sur
--     « modification non autorisée ».
--  2. **La politique était superflue.** Les deux seuls champs qu'un membre
--     a besoin de changer ont déjà leur fonction : `set_group_muted` et
--     `mark_group_read`.
--
-- On supprime donc les deux. `friend_group_members` n'a plus qu'une
-- politique de lecture, comme les autres tables du socle social : aucune
-- écriture directe depuis le navigateur, tout passe par des fonctions qui
-- revérifient le rôle.

drop trigger if exists trg_group_member_self_update on public.friend_group_members;
drop function if exists public.guard_group_member_self_update();
drop policy if exists "friend_group_members_update_self" on public.friend_group_members;
