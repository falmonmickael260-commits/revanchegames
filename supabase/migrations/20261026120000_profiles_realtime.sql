-- `profiles` n'était pas diffusée en temps réel : un changement de
-- confidentialité (mode fantôme, activité partagée…) depuis /settings ne
-- parvenait donc jamais à l'identité déjà chargée ailleurs dans la coquille
-- (voir use-identity.ts) avant un rechargement complet de la page.
alter publication supabase_realtime add table public.profiles;
