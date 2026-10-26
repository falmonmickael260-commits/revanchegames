-- Revanche Game — identifiant fixe choisi par le joueur, une seule fois.
--
-- Remplace l'approche précédente (identifiant dérivé de `profiles.id`) par
-- un vrai choix du joueur, mémorisé une fois pour toutes. Contrairement au
-- pseudonyme, modifiable à volonté par simple `update` depuis le navigateur
-- (RLS "update own"), cet identifiant ne peut être écrit qu'au travers de
-- `set_player_tag` — et seulement si la colonne est encore vide.

alter table public.profiles add column if not exists player_tag text;

-- Unicité insensible à la casse : "Mike" et "mike" prêteraient à confusion
-- pour un identifiant pensé comme fixe et partageable.
create unique index if not exists profiles_player_tag_lower_idx
  on public.profiles (lower(player_tag))
  where player_tag is not null;

create or replace function public.set_player_tag(p_tag text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_tag text := trim(coalesce(p_tag, ''));
  v_rows int;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if char_length(v_tag) < 3 or char_length(v_tag) > 20 then
    raise exception 'l''identifiant doit contenir entre 3 et 20 caractères' using errcode = '22023';
  end if;
  if v_tag !~ '^[A-Za-z0-9_]+$' then
    raise exception 'l''identifiant ne peut contenir que des lettres, des chiffres et des _' using errcode = '22023';
  end if;

  begin
    -- Le `where player_tag is null` fait tout le travail d'atomicité : deux
    -- tentatives simultanées (deux onglets) ne peuvent pas toutes les deux
    -- réussir, sans qu'il faille verrouiller la ligne à la main.
    update public.profiles set player_tag = v_tag where id = v_me and player_tag is null;
  exception when unique_violation then
    raise exception 'cet identifiant est déjà pris' using errcode = '23505';
  end;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'identifiant déjà choisi — il ne peut être défini qu''une seule fois' using errcode = '42501';
  end if;

  return true;
end;
$$;

grant execute on function public.set_player_tag(text) to authenticated;

-- La recherche de joueur accepte maintenant aussi cet identifiant (en plus
-- du pseudonyme) — tout l'intérêt d'en avoir un qui ne change jamais.
create or replace function public.search_players(p_query text, p_limit int default 10)
returns table (
  id uuid,
  username text,
  avatar_url text,
  relationship text,
  accepts_requests boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_needle text := lower(trim(coalesce(p_query, '')));
  -- Le préfixe "rg-" est décoratif à l'affichage ; accepté en entrée, mais la
  -- comparaison se fait sur l'identifiant tel qu'enregistré, sans préfixe.
  v_tag_needle text := regexp_replace(v_needle, '^rg-', '');
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if char_length(v_needle) < 2 then
    return;
  end if;

  return query
  select
    pr.id,
    pr.username,
    pr.avatar_url,
    coalesce(
      case
        when f.status = 'accepted' then 'friend'
        when f.status = 'pending' and f.requester_id = v_me then 'request_sent'
        when f.status = 'pending' then 'request_received'
      end,
      'none'
    ) as relationship,
    pr.allow_friend_requests as accepts_requests
  from public.profiles pr
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(pr.id, v_me)
   and greatest(f.requester_id, f.addressee_id) = greatest(pr.id, v_me)
  where pr.id <> v_me
    and (
      lower(pr.username) like v_needle || '%'
      or (pr.player_tag is not null and lower(pr.player_tag) like v_tag_needle || '%')
    )
    and coalesce(f.status, '') <> 'blocked'
  order by pr.username
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
end;
$$;
