-- Corrige `set_player_tag` : le message "cet identifiant est déjà pris"
-- utilisait le code d'erreur 23505, que la façade cliente (src/lib/social/
-- api.ts, `toMessage`) réécrit volontairement en "Action déjà effectuée."
-- pour les vraies contraintes d'unicité ailleurs sur la plateforme — ce qui
-- masquait ici un message pourtant plus utile. Sans `errcode` explicite, le
-- message rédigé par la fonction s'affiche tel quel.

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
    update public.profiles set player_tag = v_tag where id = v_me and player_tag is null;
  exception when unique_violation then
    raise exception 'cet identifiant est déjà pris';
  end;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'identifiant déjà choisi — il ne peut être défini qu''une seule fois';
  end if;

  return true;
end;
$$;
