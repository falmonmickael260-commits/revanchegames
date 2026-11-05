-- Sauvegarde de progression BombShift liee au compte Revanche Games.
-- Les valeurs viennent d'un jeu client : elles ne donnent ni XP, ni pieces,
-- ni avantage economique et ne sont jamais lues par les vues de statistiques.
create table if not exists public.bombshift_account_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  save_data jsonb not null check (jsonb_typeof(save_data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.bombshift_account_progress enable row level security;
revoke all on public.bombshift_account_progress from public, anon, authenticated;
grant select, insert, update on public.bombshift_account_progress to service_role;

comment on table public.bombshift_account_progress is
  'Client game progress snapshot for BombShift; service-role access only, no wallet or XP fulfillment.';
