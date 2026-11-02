-- Make the activated solo title available to presence, profiles and generic
-- invitations to play. No rooms, wallet rules or game results are changed.
insert into public.game_catalog(slug, display_name, sort_order)
values ('bombshift', 'BombShift', 6)
on conflict (slug) do nothing;
