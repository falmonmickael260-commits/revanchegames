-- Keep social voice room access codes on the server only. LiveKit room
-- metadata is visible to participants, so it stores a boolean lock indicator
-- while this table stores the keyed digest used by the API to verify entry.
create table if not exists public.voice_room_access_codes (
  room_id text primary key check (room_id ~ '^rg-social-[0-9a-f-]{36}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  passcode_hash text not null check (passcode_hash ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.voice_room_access_codes enable row level security;
revoke all on table public.voice_room_access_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.voice_room_access_codes to service_role;
