-- Revanche Game — chat général en temps réel
-- La table chat_messages existe déjà (socle commun) ; il ne manquait que sa
-- diffusion en direct aux clients connectés.
alter publication supabase_realtime add table public.chat_messages;
