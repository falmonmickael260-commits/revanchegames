-- Phase 1 cadeaux. Aucune fonctionnalité financière n'est activée par cette migration.
-- L'activation explicite reste réservée à l'administration après revue juridique/économique.
create table public.gift_settings (
  singleton boolean primary key default true check (singleton),
  gifts_enabled boolean not null default false,
  renta_enabled boolean not null default false,
  max_quantity integer not null default 20 check (max_quantity between 1 and 100),
  max_daily_spend bigint not null default 5000 check (max_daily_spend > 0),
  max_daily_to_recipient bigint not null default 1500 check (max_daily_to_recipient > 0),
  cooldown_seconds integer not null default 5 check (cooldown_seconds between 0 and 3600),
  min_account_age_hours integer not null default 24 check (min_account_age_hours between 0 and 8760),
  updated_at timestamptz not null default now()
);
insert into public.gift_settings(singleton) values(true);

create table public.gift_catalog (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  price_coins integer not null check (price_coins between 10 and 100000 and price_coins % 2 = 0),
  rev_points integer generated always as (price_coins / 2) stored,
  image_url text not null,
  animation_type text not null check (char_length(animation_type) between 2 and 50),
  rarity text not null default 'common' check (rarity in ('common','uncommon','rare','epic','legendary')),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  limited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

insert into public.gift_catalog(id,name,price_coins,image_url,animation_type,rarity) values
('rose-rouge','Rose rouge',10,'/gifts/rose-rouge.webp','petals','common'),
('petit-coeur','Petit cœur',10,'/gifts/petit-coeur.webp','double-heartbeat','common'),
('bonbon-sucre','Bonbon sucré',10,'/gifts/bonbon-sucre.webp','bounce','common'),
('bisou','Bisou',10,'/gifts/bisou.webp','kiss-hearts','common'),
('ourson-calin','Ourson câlin',30,'/gifts/ourson-calin.webp','bear-hug','common'),
('bouquet-tulipes','Bouquet de tulipes',30,'/gifts/bouquet-tulipes.webp','bloom','common'),
('chocolats-gourmands','Chocolats gourmands',30,'/gifts/chocolats-gourmands.webp','box-open','common'),
('coup-de-foudre','Coup de foudre',30,'/gifts/coup-de-foudre.webp','lightning','common'),
('papillon-nacre','Papillon nacré',50,'/gifts/papillon-nacre.webp','butterfly','uncommon'),
('macarons-colores','Macarons colorés',50,'/gifts/macarons-colores.webp','macarons-bounce','uncommon'),
('bague-doree','Bague dorée',50,'/gifts/bague-doree.webp','ring-turn','uncommon'),
('fleur-cristal','Fleur de cristal',50,'/gifts/fleur-cristal.webp','crystal-glint','uncommon'),
('ourson-royal','Ourson royal',100,'/gifts/ourson-royal.webp','bear-bow','rare'),
('bouquet-lumineux','Bouquet lumineux',100,'/gifts/bouquet-lumineux.webp','flower-glow','rare'),
('coffret-parfum','Coffret parfum',100,'/gifts/coffret-parfum.webp','perfume-mist','rare'),
('licorne-celeste','Licorne céleste',250,'/gifts/licorne-celeste.webp','unicorn-nod','epic'),
('coeur-rubis','Cœur de rubis',250,'/gifts/coeur-rubis.webp','ruby-pulse','epic'),
('coffre-surprise','Coffre surprise',250,'/gifts/coffre-surprise.webp','chest-open','epic'),
('diamant-violet','Diamant violet',500,'/gifts/diamant-violet.webp','diamond-turn','epic'),
('couronne-fleurie','Couronne fleurie',500,'/gifts/couronne-fleurie.webp','crown-bloom','epic'),
('chat-imperial','Chat impérial',500,'/gifts/chat-imperial.webp','cat-wave','epic'),
('etoile-filante','Étoile filante',520,'/gifts/etoile-filante.webp','shooting-star','legendary'),
('feu-artifice','Feu d''artifice',520,'/gifts/feu-artifice.webp','firework','legendary'),
('cygne-blanc','Cygne blanc',520,'/gifts/cygne-blanc.webp','swan-glide','legendary');

-- Barème provisoire, public et modifiable. Les poids s'appliquent à des bandes,
-- puis chaque montant entier de la bande est tiré uniformément côté serveur.
create table public.gift_reward_bands (
  rule text not null check (rule in ('thirty','general')),
  band integer not null check (band between 1 and 10),
  min_amount integer,
  max_amount integer,
  min_percent numeric(6,4),
  max_percent numeric(6,4),
  weight integer not null check (weight >= 0),
  primary key(rule,band),
  check ((rule='thirty' and min_amount is not null and max_amount is not null and min_percent is null and max_percent is null)
    or (rule='general' and min_amount is null and max_amount is null and min_percent is not null and max_percent is not null)),
  check (min_amount is null or (min_amount >= 1 and max_amount >= min_amount and max_amount <= 30)),
  check (min_percent is null or (min_percent >= 0.30 and max_percent <= 1.50 and max_percent >= min_percent))
);
insert into public.gift_reward_bands(rule,band,min_amount,max_amount,weight) values
('thirty',1,1,10,70),('thirty',2,11,20,25),('thirty',3,21,30,5);
insert into public.gift_reward_bands(rule,band,min_percent,max_percent,weight) values
('general',1,0.30,0.4999,65),('general',2,0.50,0.9999,30),('general',3,1.00,1.50,5);

create table public.rev_levels (
  level integer primary key check (level between 1 and 1000),
  required_total bigint not null unique check (required_total >= 0),
  label text not null default 'REV',
  created_at timestamptz not null default now()
);
insert into public.rev_levels(level,required_total,label) values
(1,0,'Élan'),(2,100,'Étincelle'),(3,300,'Présence'),(4,700,'Éclat'),
(5,1300,'Rayonnement'),(6,2100,'Prestige'),(7,3200,'Aura'),
(8,4600,'Légende'),(9,6400,'Mythe'),(10,8700,'Icône');

create table public.rev_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_rev bigint not null default 0 check (total_rev >= 0),
  updated_at timestamptz not null default now()
);

create table public.gift_send_batches (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null references public.gift_catalog(id),
  quantity integer not null check (quantity between 1 and 100),
  unit_price integer not null check (unit_price > 0),
  unit_rev integer not null check (unit_rev > 0),
  total_price bigint not null check (total_price > 0),
  total_rev bigint not null check (total_rev > 0),
  total_reward bigint not null check (total_reward >= 0),
  context text not null check (context in ('dm','voice')),
  room_id text,
  room_sid text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique(sender_id,idempotency_key),
  check (sender_id <> recipient_id),
  check ((context='voice' and room_id is not null and room_sid is not null) or (context='dm' and room_id is null and room_sid is null))
);
create index gift_sends_recipient_idx on public.gift_send_batches(recipient_id,created_at desc);
create index gift_sends_sender_idx on public.gift_send_batches(sender_id,created_at desc);
create index gift_sends_room_idx on public.gift_send_batches(room_id,created_at desc) where room_id is not null;

create table public.gift_reward_rolls (
  batch_id uuid not null references public.gift_send_batches(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  coins integer not null check (coins >= 0),
  rule text not null check (rule in ('none','thirty','general')),
  band integer,
  primary key(batch_id,ordinal)
);
create table public.rev_ledger (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null unique references public.gift_send_batches(id) on delete cascade,
  points bigint not null check (points > 0),
  created_at timestamptz not null default now()
);
create table public.gift_collection (
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null references public.gift_catalog(id),
  quantity bigint not null check (quantity > 0),
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  primary key(recipient_id,gift_id)
);
create table public.gift_received_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.gift_send_batches(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null references public.gift_catalog(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index gift_received_recent_idx on public.gift_received_events(recipient_id,created_at desc);
create table public.gift_attempts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete set null,
  gift_id text,
  idempotency_key uuid,
  error_code text not null,
  created_at timestamptz not null default now()
);
create table public.gift_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

-- Le portefeuille existant continue de calculer le solde depuis wallet_ledger.
alter table public.wallet_ledger drop constraint wallet_ledger_reason_check;
alter table public.wallet_ledger add constraint wallet_ledger_reason_check
  check (reason in ('purchase','reward','refund','adjustment','gift_purchase','gift_renta'));

alter table public.direct_messages add column gift_batch_id uuid unique references public.gift_send_batches(id);
alter table public.notifications add column gift_batch_id uuid references public.gift_send_batches(id);
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_request','friend_accepted','game_invitation','invitation_accepted','invitation_declined',
  'platform_invite','group_added','group_removed','gift_received'
));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gift-art','gift-art',true,2097152,array['image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy gift_art_public_read on storage.objects for select using(bucket_id='gift-art');

alter table public.gift_settings enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.gift_reward_bands enable row level security;
alter table public.rev_levels enable row level security;
alter table public.rev_accounts enable row level security;
alter table public.gift_send_batches enable row level security;
alter table public.gift_reward_rolls enable row level security;
alter table public.rev_ledger enable row level security;
alter table public.gift_collection enable row level security;
alter table public.gift_received_events enable row level security;
alter table public.gift_attempts enable row level security;
alter table public.gift_admin_audit enable row level security;

revoke all on public.gift_settings,public.gift_catalog,public.gift_reward_bands,public.rev_levels,
  public.rev_accounts,public.gift_send_batches,public.gift_reward_rolls,public.rev_ledger,
  public.gift_collection,public.gift_received_events,public.gift_attempts,public.gift_admin_audit from anon,authenticated;
grant select on public.gift_settings,public.gift_catalog,public.gift_reward_bands,public.rev_levels,
  public.rev_accounts,public.gift_send_batches,public.gift_reward_rolls,public.rev_ledger,
  public.gift_collection,public.gift_received_events to authenticated;
grant select on public.gift_catalog,public.gift_reward_bands,public.rev_levels,public.gift_collection,
  public.gift_received_events to anon;
grant all on public.gift_settings,public.gift_catalog,public.gift_reward_bands,public.rev_levels,
  public.rev_accounts,public.gift_send_batches,public.gift_reward_rolls,public.rev_ledger,
  public.gift_collection,public.gift_received_events,public.gift_attempts,public.gift_admin_audit to service_role;

create policy gift_settings_read on public.gift_settings for select to authenticated using(true);
create policy gift_catalog_read on public.gift_catalog for select to anon,authenticated using(true);
create policy gift_bands_read on public.gift_reward_bands for select to authenticated using(true);
create policy rev_levels_read on public.rev_levels for select to anon,authenticated using(true);
create policy rev_accounts_own on public.rev_accounts for select to authenticated using(user_id=auth.uid());
create policy gift_sends_participants on public.gift_send_batches for select to authenticated using(auth.uid() in(sender_id,recipient_id));
create policy gift_rolls_participants on public.gift_reward_rolls for select to authenticated using(
  exists(select 1 from public.gift_send_batches b where b.id=batch_id and auth.uid() in(b.sender_id,b.recipient_id)));
create policy rev_ledger_own on public.rev_ledger for select to authenticated using(recipient_id=auth.uid());
create policy gift_collection_public on public.gift_collection for select to anon,authenticated using(true);
create policy gift_events_public on public.gift_received_events for select to anon,authenticated using(true);

alter publication supabase_realtime add table public.rev_accounts;
alter publication supabase_realtime add table public.gift_send_batches;
alter publication supabase_realtime add table public.gift_received_events;
