-- Revanche Game — l'envoi d'avatar passe obligatoirement par le serveur.
--
-- Avant cette migration, le navigateur écrivait directement dans le bucket
-- `avatars`. Toute vérification faite côté navigateur (type de fichier,
-- taille, et a fortiori modération du contenu) était donc contournable : il
-- suffisait d'appeler l'API de stockage soi-même.
--
-- On retire ce droit. Seule la clé de service écrit désormais, depuis
-- `POST /api/avatar`, après avoir décodé l'image, l'avoir réencodée et
-- l'avoir soumise à la modération. La lecture reste publique : les avatars
-- s'affichent pour tout le monde, y compris les visiteurs non connectés.

drop policy if exists "avatars_write_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- `avatars_read_all` est volontairement conservée telle quelle.

-- Note : la clé `service_role` contourne RLS, donc aucune politique
-- d'écriture n'est nécessaire pour la route serveur.
