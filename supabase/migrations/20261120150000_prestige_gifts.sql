insert into public.gift_catalog (id, name, price_coins, image_url, animation_type, rarity, animation_tier, celebration_message)
values
('supercar-neon', 'Supercar néon', 1000, '/gifts/supercar-neon.svg', 'supercar-neon', 'legendary', 'prestige', 'La piste s’illumine pour toi.'),
('paon-cristal', 'Paon de cristal', 1000, '/gifts/paon-cristal.svg', 'paon-cristal', 'legendary', 'prestige', 'Ses plumes de cristal se déploient pour toi.'),
('fusee-cosmique', 'Fusée cosmique', 1000, '/gifts/fusee-cosmique.svg', 'fusee-cosmique', 'legendary', 'prestige', 'Décollage vers les étoiles !'),
('loup-foudre', 'Loup de foudre', 1000, '/gifts/loup-foudre.svg', 'loup-foudre', 'legendary', 'prestige', 'Son hurlement fait vibrer le ciel.'),
('dragon-imperial', 'Dragon impérial', 5000, '/gifts/dragon-imperial.svg', 'dragon-imperial', 'legendary', 'prestige', 'Le dragon impérial s’incline devant toi.'),
('palais-celeste', 'Palais céleste', 5000, '/gifts/palais-celeste.svg', 'palais-celeste', 'legendary', 'prestige', 'Les portes du palais s’ouvrent pour toi.'),
('phenix-solaire', 'Phénix solaire', 5000, '/gifts/phenix-solaire.svg', 'phenix-solaire', 'legendary', 'prestige', 'Le phénix renaît dans une pluie d’or.'),
('galaxie-revanche', 'Galaxie Revanche', 5000, '/gifts/galaxie-revanche.svg', 'galaxie-revanche', 'legendary', 'prestige', 'Toute une galaxie brille pour toi.')
on conflict (id) do nothing;
