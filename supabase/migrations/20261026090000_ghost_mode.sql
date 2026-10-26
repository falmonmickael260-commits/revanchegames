-- Revanche Game — mode fantôme : apparaître hors ligne pour ses amis, même
-- connecté.
--
-- Plus fort que `share_activity` (qui masque seulement *le jeu en cours*,
-- pas la connexion elle-même) : un joueur en mode fantôme n'est tout
-- simplement jamais publié sur le canal de présence Realtime (voir
-- use-presence.ts) — ses amis le voient "hors ligne", sans rien à démasquer
-- côté serveur puisqu'il n'y a rien à lire. Les amis qui ne sont pas en mode
-- fantôme continuent de se voir normalement entre eux, sans changement.

alter table public.profiles
  add column if not exists ghost_mode boolean not null default false;
