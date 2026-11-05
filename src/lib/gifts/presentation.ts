export type GiftPresentation = { tier: "small" | "medium" | "prestige"; message: string };

const messages: Record<string, string> = {
  "rose-rouge": "Un petit éclat de couleur pour illuminer ta journée.",
  "petit-coeur": "Un petit cœur pour te rappeler que tu comptes.",
  "bonbon-sucre": "Une douceur rien que pour toi.",
  bisou: "Un bisou envoyé avec toute mon affection.",
  "ourson-calin": "Un câlin tout doux, même à distance.",
  "bouquet-tulipes": "Un bouquet pour faire fleurir ton sourire.",
  "chocolats-gourmands": "Quelques chocolats pour rendre ce moment plus doux.",
  "coup-de-foudre": "Un éclair de bonne humeur rien que pour toi.",
  "papillon-nacre": "Que cette petite merveille t'apporte un peu de magie.",
  "macarons-colores": "Un assortiment de couleurs et de douceur.",
  "bague-doree": "Un petit bijou pour une personne précieuse.",
  "fleur-cristal": "Une fleur rare pour quelqu'un d'unique.",
  "ourson-royal": "Un salut royal et un grand sourire pour toi.",
  "bouquet-lumineux": "Que ces fleurs illuminent ta journée.",
  "coffret-parfum": "Une attention délicate, choisie pour toi.",
  "licorne-celeste": "Un peu de magie pour accompagner ta route.",
  "coeur-rubis": "Un cœur précieux pour te dire merci.",
  "coffre-surprise": "Une surprise pour rendre cet instant inoubliable.",
  "diamant-violet": "Une lumière rare pour une personne exceptionnelle.",
  "couronne-fleurie": "Aujourd'hui, la couronne est pour toi.",
  "chat-imperial": "Sa Majesté est venue te saluer.",
  "etoile-filante": "Fais un vœu, cette étoile est pour toi.",
  "feu-artifice": "Certaines personnes méritent bien plus que des étoiles… Elles méritent un ciel entier illuminé pour elles.",
  "cygne-blanc": "Une pensée délicate glisse jusqu'à toi.",
};

export function giftPresentation(gift: { id: string; price_coins?: number; rarity?: string }): GiftPresentation {
  const tier = gift.price_coins && gift.price_coins >= 500 || gift.rarity === "legendary"
    ? "prestige"
    : gift.price_coins && gift.price_coins >= 100 || gift.rarity === "epic" || gift.rarity === "rare"
      ? "medium" : "small";
  return { tier, message: messages[gift.id] ?? "Une attention offerte avec le sourire." };
}

export const FIREWORK_DEMO_EVENT_ID = "gift-firework-admin-preview";
