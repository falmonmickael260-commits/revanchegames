-- Camouflip rejoint le catalogue existant et ses vues de résultats.
insert into public.game_catalog(slug,display_name,sort_order)
values ('camouflip','Camouflip',6)
on conflict (slug) do update set display_name=excluded.display_name;

-- Détails par rôle calculés à partir des résultats attestés par le serveur du jeu.
-- La vue game_stats existante fournit déjà parties, victoires, défaites et taux.
create or replace view public.camouflip_stats as
select p.user_id,
  count(*) filter (where detail.value->>'role'='hunter' and p.outcome='win') as hunter_wins,
  count(*) filter (where detail.value->>'role'='prop' and p.outcome='win') as prop_wins,
  coalesce(sum((detail.value->>'eliminations')::int) filter (where detail.value->>'role'='hunter'),0) as props_eliminated,
  count(*) filter (where detail.value->>'role'='prop' and detail.value->>'survived'='true') as rounds_survived,
  coalesce(sum((detail.value->>'timeSeconds')::int),0) as time_seconds
from public.game_result_players p
join public.game_results r on r.id=p.result_id and r.game_slug='camouflip'
join lateral jsonb_array_elements(r.raw_payload->'players') detail(value) on detail.value->>'userId'=p.user_id::text
where p.user_id is not null
group by p.user_id;

grant select on public.camouflip_stats to authenticated;

create or replace view public.camouflip_global_stats as
select (select count(*) from public.game_results where game_slug='camouflip') as games_played,
       (select count(distinct p.user_id) from public.game_result_players p join public.game_results r on r.id=p.result_id where r.game_slug='camouflip' and p.user_id is not null) as distinct_players;
grant select on public.camouflip_global_stats to authenticated;
