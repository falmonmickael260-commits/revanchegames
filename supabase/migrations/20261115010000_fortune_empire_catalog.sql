insert into public.game_catalog(slug,display_name,sort_order) values ('fortune-empire','Fortune Empire',20) on conflict (slug) do update set display_name=excluded.display_name;
