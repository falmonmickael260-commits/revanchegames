-- Add BacRush to the central statistics/invitation catalog.
insert into public.game_catalog (slug, display_name, sort_order)
values ('bacrush', 'BacRush', 7)
on conflict (slug) do nothing;
