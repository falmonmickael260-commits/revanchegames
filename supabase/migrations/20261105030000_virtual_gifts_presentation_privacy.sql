-- Presentation metadata for the cinematic gift experience.
alter table public.gift_catalog
  add column if not exists animation_tier text not null default 'small',
  add column if not exists celebration_message text not null default '';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='gift_catalog_animation_tier_check') then
    alter table public.gift_catalog add constraint gift_catalog_animation_tier_check
      check (animation_tier in ('small','medium','prestige'));
  end if;
  if not exists (select 1 from pg_constraint where conname='gift_catalog_celebration_message_check') then
    alter table public.gift_catalog add constraint gift_catalog_celebration_message_check
      check (char_length(celebration_message) between 0 and 240);
  end if;
end $$;

update public.gift_catalog set
  animation_tier=case when price_coins>=500 then 'prestige' when price_coins>=100 then 'medium' else 'small' end,
  celebration_message=case id
    when 'rose-rouge' then 'Un petit éclat de couleur pour illuminer ta journée.'
    when 'petit-coeur' then 'Un petit cœur pour te rappeler que tu comptes.'
    when 'bonbon-sucre' then 'Une douceur rien que pour toi.'
    when 'bisou' then 'Un bisou envoyé avec toute mon affection.'
    when 'ourson-calin' then 'Un câlin tout doux, même à distance.'
    when 'bouquet-tulipes' then 'Un bouquet pour faire fleurir ton sourire.'
    when 'chocolats-gourmands' then 'Quelques chocolats pour rendre ce moment plus doux.'
    when 'coup-de-foudre' then 'Un éclair de bonne humeur rien que pour toi.'
    when 'papillon-nacre' then 'Que cette merveille t’apporte un peu de magie.'
    when 'macarons-colores' then 'Un assortiment de couleurs et de douceur.'
    when 'bague-doree' then 'Un petit bijou pour une personne précieuse.'
    when 'fleur-cristal' then 'Une fleur rare pour quelqu’un d’unique.'
    when 'ourson-royal' then 'Un salut royal et un grand sourire pour toi.'
    when 'bouquet-lumineux' then 'Que ces fleurs illuminent ta journée.'
    when 'coffret-parfum' then 'Une attention délicate, choisie pour toi.'
    when 'licorne-celeste' then 'Un peu de magie pour accompagner ta route.'
    when 'coeur-rubis' then 'Un cœur précieux pour te dire merci.'
    when 'coffre-surprise' then 'Une surprise pour rendre cet instant inoubliable.'
    when 'diamant-violet' then 'Une lumière rare pour une personne exceptionnelle.'
    when 'couronne-fleurie' then 'Aujourd’hui, la couronne est pour toi.'
    when 'chat-imperial' then 'Sa Majesté est venue te saluer.'
    when 'etoile-filante' then 'Fais un vœu, cette étoile est pour toi.'
    when 'feu-artifice' then 'Certaines personnes méritent bien plus que des étoiles… Elles méritent un ciel entier illuminé pour elles.'
    when 'cygne-blanc' then 'Une pensée délicate glisse jusqu’à toi.'
    else celebration_message end;

-- Le client peut lire les cartes et leurs messages, mais pas le REV généré,
-- les bandes de tirage, les soldes, ni les paramètres économiques.
revoke select on public.gift_catalog from anon,authenticated;
grant select(id,name,price_coins,image_url,animation_type,rarity,active,starts_at,ends_at,limited,
  animation_tier,celebration_message) on public.gift_catalog to anon,authenticated;
revoke select on public.gift_settings,public.gift_reward_bands from anon,authenticated;
drop policy if exists gift_settings_read on public.gift_settings;
drop policy if exists gift_bands_read on public.gift_reward_bands;

-- Transactions and per-unit draws are available only through verified server routes.
revoke select on public.gift_send_batches,public.gift_reward_rolls from anon,authenticated;
drop policy if exists gift_sends_participants on public.gift_send_batches;
drop policy if exists gift_rolls_participants on public.gift_reward_rolls;

create function public.gift_admin_update_visual(p_actor uuid,p_gift_id text,p_tier text,p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_before jsonb; v_after jsonb;
begin
  if p_actor is null or not exists(select 1 from public.support_admins where user_id=p_actor) then
    raise exception 'Administration réservée.' using errcode='42501';
  end if;
  if p_tier not in ('small','medium','prestige') or p_message is null or char_length(p_message)>240 then
    raise exception 'Présentation invalide.' using errcode='22023';
  end if;
  select to_jsonb(g) into v_before from public.gift_catalog g where id=p_gift_id for update;
  if not found then raise exception 'Cadeau introuvable.' using errcode='22023'; end if;
  update public.gift_catalog set animation_tier=p_tier,celebration_message=p_message,updated_at=now()
    where id=p_gift_id returning to_jsonb(gift_catalog.*) into v_after;
  insert into public.gift_admin_audit(actor_id,action,target,before_value,after_value)
    values(p_actor,'visual', 'gift:'||p_gift_id, v_before, v_after);
  return v_after;
end;
$$;
revoke all on function public.gift_admin_update_visual(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.gift_admin_update_visual(uuid,text,text,text) to service_role;
