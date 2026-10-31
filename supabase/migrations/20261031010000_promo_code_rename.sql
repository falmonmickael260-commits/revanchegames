-- Renomme le code promotionnel REVANCHE1500 en RG1500 (même préfixe que
-- rg_token, rg_room, et l'identifiant de profil RG-xxxx — un seul nom plus
-- court, cohérent avec le reste de la plateforme). Même récompense (1 500
-- pièces), même règle (une fois par compte).
--
-- Aucune rédemption n'existe encore en production au moment de cette
-- migration : un simple update de la clé primaire suffit, sans avoir à
-- migrer de lignes dans `promo_redemptions`.
update public.promo_codes set code = 'RG1500' where code = 'REVANCHE1500';

-- Si cette migration est rejouée après que REVANCHE1500 ait déjà été
-- renommé (ou sur une base qui ne l'a jamais eu), s'assurer que RG1500
-- existe bien.
insert into public.promo_codes (code, reward_coins, active, max_redemptions, expires_at)
values ('RG1500', 1500, true, null, null)
on conflict (code) do nothing;
