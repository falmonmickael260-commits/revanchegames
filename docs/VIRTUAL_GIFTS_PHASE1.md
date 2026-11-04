# Cadeaux virtuels — phase 1

## État de livraison

La branche locale `codex/virtual-gifts-phase1` contient le catalogue de 24 cadeaux, les illustrations WebP transparentes, 24 animations CSS, la progression REV, le mur à cadeaux, l'envoi depuis les messages privés et les salles vocales communautaires, ainsi que l'administration. Les migrations sont `20261105000000_virtual_gifts_schema.sql`, `20261105010000_virtual_gifts_transactions.sql` et `20261105020000_virtual_gifts_admin.sql` dans `supabase/migrations/`.

**Aucune migration n'a été appliquée au projet Supabase distant et aucun déploiement n'a été fait.** Les cadeaux et la renta sont désactivés par défaut en base. La route d'envoi exige en plus `GIFT_FINANCIAL_APPROVED=1` côté serveur. Cette variable ne doit être définie qu'après validation juridique, économique et de Stripe. Les tests n'utilisent aucun achat réel.

## Flux financier

`POST /api/gifts` authentifie un compte confirmé et vérifie l'origine de la requête. Pour un MP, la fonction PostgreSQL exige une amitié actuelle et aucun blocage. Pour une salle vocale, la route vérifie dans LiveKit que les deux comptes sont présents dans la même instance de salle. La fonction `send_virtual_gift`, réservée à `service_role`, verrouille les deux portefeuilles dans un ordre stable puis effectue dans **une transaction PostgreSQL** : débit de l'expéditeur, tirages indépendants, crédit de renta du destinataire, ajout des REV et de la collection, message privé éventuel et notification. Une clé d'idempotence propre à l'expéditeur empêche un second débit lors d'un retry. Le trigger du portefeuille existant protège également les montants réservés aux rôles. Les dettes de remboursement Stripe bloquent l'envoi.

Le cadeau à 10 pièces donne 5 REV et aucune pièce. Celui à 30 pièces donne 15 REV et un tirage de 1 à 30 pièces. Dès 50 pièces, la récompense est comprise entre 30 et 150 % du prix, pour chaque exemplaire. Tous les REV et toutes les pièces de renta vont **uniquement au destinataire**. Les REV ne sont pas dépensables et restent indépendants de l'XP.

Les limites initiales modifiables sont : 20 exemplaires par envoi, 5 000 pièces dépensées sur 24 h, 1 500 pièces vers un même joueur sur 24 h, 5 secondes entre envois et comptes âgés d'au moins 24 h. Les cadeaux à vendre peuvent être désactivés sans disparaître des collections déjà constituées.

## Probabilités initiales

Le serveur tire d'abord une bande selon son poids, puis un **entier uniforme dans cette bande**. Les poids sont identiques pour tous les comptes et modifiables dans l'administration. Les plages et poids initiaux sont provisoires :

| Prix | Bande 1 | Poids | Bande 2 | Poids | Bande 3 | Poids | Espérance de pièces reçues |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: |
| 10 | aucune | — | — | — | — | — | 0 |
| 30 | 1–10 pièces | 70 | 11–20 pièces | 25 | 21–30 pièces | 5 | 9 (30 %) |
| 50 | 15–24 pièces | 65 | 25–49 pièces | 30 | 50–75 pièces | 5 | 26,9 (53,8 %) |
| 100 | 30–49 pièces | 65 | 50–99 pièces | 30 | 100–150 pièces | 5 | 54,275 (54,275 %) |
| 250 | 75–124 pièces | 65 | 125–249 pièces | 30 | 250–375 pièces | 5 | 136,4 (54,56 %) |
| 500 | 150–249 pièces | 65 | 250–499 pièces | 30 | 500–750 pièces | 5 | 273,275 (54,655 %) |
| 520 | 156–259 pièces | 65 | 260–519 pièces | 30 | 520–780 pièces | 5 | 284,225 (54,659 %) |

L'espérance est la moyenne mathématique par cadeau, **pas** une récompense garantie. Un aperçu recalculé avec les poids courants figure dans l'administration. Le barème REV initial des niveaux 1 à 10 est distinct dans la migration et modifiable par un administrateur.

## Validation effectuée

- `npm test` : tests de l'application, du portefeuille, de Stripe et des cadeaux réussis.
- `npm run test:gifts` : migrations exécutées dans PGlite, catalogue exact, bornes de renta, quantité ×5, absence de récompense pour l'expéditeur, idempotence, refus de soi-même et d'un non-ami, solde insuffisant, conservation de l'XP, réservation de rôle, dette Stripe, permissions du client et audit administrateur transactionnel vérifiés.
- `npm run build` et ESLint ciblé : réussis.
- 24 visuels inspectés en planche contact ; fichiers 256 × 256 WebP.

## Vérifications nécessaires avant activation

1. Faire valider le mécanisme de transfert entre joueurs et de récompense aléatoire par un conseil juridique compétent en France, ainsi que son acceptation explicite par Stripe. Les [restrictions Stripe](https://stripe.com/legal/restricted-businesses) et les [informations de l'ANJ pour les professionnels](https://anj.fr/faq-professionnels) motivent cette revue ; ce document ne conclut pas à la qualification juridique du produit.
2. Dans un **environnement de test isolé**, appliquer les migrations, créer deux comptes confirmés, tester MP, salle vocale, appareils mobiles, retour d'arrière-plan, reconnexion et notifications. Vérifier l'interface avec de vrais profils et la politique RLS sur Supabase hébergé. Les tests PGlite ne remplacent pas ces essais.
3. Faire un test de concurrence sur PostgreSQL hébergé avec plusieurs connexions et mesurer le rendement réel d'un grand échantillon de tirages. Examiner les comptes complices, les limites et le risque d'inflation. Le rendement initial reste positif pour le **destinataire**, même si le total des pièces décroît en moyenne à chaque transfert.
4. Revoir les textes présentés aux joueurs : prix, tirages, limites et probabilités avant toute ouverture. Les poids peuvent changer ; publier leur état réellement actif.
5. Vérifier en environnement Supabase hébergé le journal d'administration et les droits des comptes administrateurs. Les modifications de configuration et leur audit sont atomiques dans la fonction `gift_admin_apply`.

Après ces validations seulement : déployer la branche approuvée, appliquer les migrations, définir `GIFT_FINANCIAL_APPROVED=1` sur le serveur, puis activer `gifts_enabled` et `renta_enabled` depuis l'administration. Aucun secret serveur ne doit être ajouté au dépôt.
