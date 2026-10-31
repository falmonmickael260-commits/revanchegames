-- Le chat général est réservé aux comptes connectés et son historique est
-- purgé automatiquement chaque jour (messages âgés d'au moins 24 h).
drop policy if exists "chat_messages_select_all" on public.chat_messages;
create policy "chat_messages_select_authenticated" on public.chat_messages
  for select to authenticated using (auth.uid() is not null);

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge-general-chat-daily',
  '0 0 * * *',
  $job$delete from public.chat_messages where created_at < now() - interval '24 hours'$job$
)
where not exists (select 1 from cron.job where jobname = 'purge-general-chat-daily');
