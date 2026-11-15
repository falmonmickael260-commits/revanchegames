# BombShift sans publicité — achat unique 0,99 €

Le produit `bombshift_no_ads` utilise le compte Stripe déjà configuré sur
Revanche Games, le Checkout hébergé et le webhook existants. Aucun nouveau
secret Stripe dans le jeu, aucun abonnement. Le prix est fixé à 99 centimes
côté serveur et vérifié à nouveau lors du webhook.

L’option appartient au compte Supabase du joueur. Seule une commande `paid`,
sans remboursement, dans le mode Stripe courant donne le droit. Le retour de
Checkout et les sauvegardes locales ne l’accordent jamais. Les remboursements
(même partiels) et les litiges suspendent le droit ; un litige gagné le restaure
si aucun remboursement n’a réussi. Le produit ne crédite aucune pièce.
Les demandes concurrentes réutilisent une commande récente et le serveur refuse
un nouvel achat quand le droit est déjà payé. Les anciens packs restent inchangés.

## Mise en service

1. Appliquer uniquement `supabase/migrations/20261115000000_bombshift_no_ads.sql`
   dans le projet Supabase existant, après vérification de l’historique.
2. Déployer cette version de Revanche Games.
3. Déployer la branche correspondante de `falmonmickael260-commits/bombshift`.
4. En environnement Stripe de test, vérifier paiement, annulation, webhook
   retardé, reconnexion/autre appareil, remboursement et litige. Aucun paiement
   réel de recette n’est requis pour appliquer ce changement.

La clé et le webhook existants sont utilisés, avec les mêmes permissions.
Aucun produit/prix à créer manuellement : Checkout transmet le prix inline.
Les migrations et le mode live de production ne sont pas vérifiés par les tests
locaux. Le connecteur Railway permet ici de voir les noms des variables, pas
leurs valeurs ni un accès SQL Supabase.

## Validation locale

- `node --import tsx --test test/stripe.test.ts test/stripe-webhook.test.ts`
- `npx next typegen && npx tsc --noEmit`
- BombShift : `npm test` et `npm run build`.

Le test PostgreSQL couvre la migration, le prix, la reprise de commande, le
refus d’un double achat payé, le retrait/restauration des droits et l’absence
de mouvement de pièces. Les tests Stripe utilisent des réponses simulées.
