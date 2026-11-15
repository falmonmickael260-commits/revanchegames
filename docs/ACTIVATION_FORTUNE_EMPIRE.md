# Fortune Empire

Le catalogue active Fortune Empire à l’adresse https://atlasroyal-production.up.railway.app/ avec le badge éditorial NEW, la couverture existante et 2 à 8 joueurs. Les tarifs, cartes et règles économiques du jeu ne changent pas.

Le jeu conserve ses salons à code et ses joueurs invités. Le compte reçu dans `rg_token` est vérifié par la plateforme via une requête serveur signée ; sa clé de signature globale ne quitte pas la plateforme. Une place native possède un secret aléatoire distinct de l’identifiant du pion. La même place et sa preuve sont conservées sur l’appareil pour la reprise. Les preuves de salon voyagent uniquement entre les origines autorisées et la plateforme, jamais dans les liens publics.

Le connecteur suit le protocole existant : inspection de la place de l’expéditeur, admission signée dans l’instance exacte, confirmation du siège par l’hôte et réutilisation du même siège lors d’une nouvelle acceptation ou d’un rechargement. Un nouveau joueur ne rejoint pas une partie déjà démarrée ; un joueur déjà inscrit peut la reprendre. L’hôte doit toujours garder sa page ouverte.

Les résultats sont vérifiés par une copie du même moteur sur le serveur du jeu : graine de lancement, commandes émises par chaque connexion et états successifs. Les tarifs et les règles ont une source unique, `src/engine`. Un état falsifié ne donne pas de statistiques. À la fin, le serveur signe le résultat ; la plateforme appelle sa fonction `record_game_result` avec une clé stable liée à l’instance du salon. Les vues existantes alimentent le profil et les totaux. Les invités restent sans `user_id` et n’alimentent aucun profil. Les transmissions réseau échouées sont réessayées en mémoire ; il n’y a pas de sauvegarde durable de la partie ni de la file après redémarrage du service.

## Configuration

- Plateforme : `GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE`, clé dédiée, serveur seulement.
- Jeu : `PLATFORM_SHARED_SECRET`, la même clé dédiée ; `PLATFORM_SHELL_ORIGIN` vise l’origine Railway canonique de la plateforme.
- La clé globale `PLATFORM_SHARED_SECRET` de la plateforme et les clés Supabase existantes ne sont pas modifiées.
- Développement : `VITE_PLATFORM_ORIGIN=http://localhost:3100` et origine serveur configurée sur la plateforme locale.

La migration `20261115010000_fortune_empire_catalog.sql` ajoute seulement la ligne du catalogue. Les points d’entrée signés et le connecteur assurent également cette insertion idempotente avec le client serveur existant ; aucune modification de table ou de permission n’est nécessaire.

## Validation

Les tests couvrent les signatures, leur audience et expiration, le classement, l’attribution au compte, l’invité sans compte, l’idempotence SQL et les vues du profil. Une partie complète simulée vérifie chaque état du moteur du navigateur contre celui du serveur avant d’attribuer la victoire. La recette navigateur locale utilise les véritables clients et salons, une identité centrale simulée et le rendu 3D simulé : invitation, rechargement sans doublon, invité par code, retour du même navigateur, lancement, lancer et refus d’un nouvel entrant après démarrage. Elle ne constitue pas un parcours de production entre deux comptes Auth réels.
