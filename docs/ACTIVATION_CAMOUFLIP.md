# Camouflip dans Revanche Games

L'intégration réutilise les comptes Supabase, les amis, les invitations et notifications existantes, le registre de salons et la RPC `record_game_result`. Le serveur Camouflip vérifie le jeton du joueur, protège les 7 places et transmet seul les résultats.

## Essai local

1. Utiliser une base Supabase **de test** avec les migrations de `supabase/migrations/`, dont `20261109000000_camouflip_catalog_stats.sql`. Ne pas appliquer cette migration à la production avant validation.
2. Dans Revanche Games, renseigner `.env.local` pour cette base, ainsi que `PLATFORM_SHARED_SECRET` (la même valeur dans le processus Camouflip). En développement, le catalogue vise `http://localhost:8788`.
3. Dans le dépôt Camouflip :

   ```sh
   npm install
   npm run build
   PLATFORM_SHARED_SECRET='secret-local-identique' REVANCHE_GAMES_URL='http://localhost:3100' npm run server:once
   ```

4. Dans le dépôt Revanche Games, dans un second terminal :

   ```sh
   npm install
   npm run dev -- -p 3100
   ```

5. Ouvrir `http://localhost:3100`, se connecter avec deux comptes amis de la base de test, puis ouvrir Camouflip, créer un salon, inviter depuis le jeu ou le profil d'un ami, accepter et vérifier l'arrivée directe. La partie et le profil affichent ensuite les résultats enregistrés.

Les tests sans base distante se lancent avec `npm run test:platform` dans Camouflip et `npm test` ici. Le test Camouflip exerce le jeton signé, le connecteur, l'admission, le plafond de 7, la reconnexion et le refus après lancement. Les tests de la plateforme exercent les invitations, les expirations, la concurrence et l'isolation des comptes dans PostgreSQL local.

## Activation ultérieure

L'adresse officielle fournie est `https://camouflip-production.up.railway.app/` et répond en HTTP 200. Lors de l'audit du 9 novembre 2026, `HEAD /api/platform/connector` répondait 404 : le serveur Railway présent ne contient pas encore cette intégration. Les invitations directes nécessitent donc la mise en ligne ultérieure du serveur Camouflip modifié. Configurer `GAME_CONNECTOR_URL_CAMOUFLIP` si son serveur d'API diffère de cette adresse, et le même `PLATFORM_SHARED_SECRET` des deux côtés ; `REVANCHE_GAMES_URL` sur Camouflip doit viser la plateforme. `NEXT_PUBLIC_GAME_URL_CAMOUFLIP` peut remplacer l'adresse officielle. Les deux URL de jeu doivent être en HTTPS en production. Garder **une seule instance** du serveur Camouflip actuel : ses salons et réservations sont en mémoire. Le résultat est mis en attente et réessayé en mémoire si la plateforme est temporairement indisponible ; une sauvegarde durable des résultats et un stockage partagé des salons seront nécessaires avant une mise à l'échelle ou pour garantir les résultats à travers un redémarrage.

Le badge `NEW` se retire en passant `newBadge` à `false` sur l'entrée Camouflip dans `src/data/games.ts`.
