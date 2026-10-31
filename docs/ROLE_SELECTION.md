# Pièces et rôles de La Meute Noire

## Fonctionnement

Les comptes Revanche Games sont reconnus à partir d'un jeton signé par la
plateforme. Un jeton de lancement invalide produit un message de reconnexion,
pas un passage silencieux en invité. Une session déjà authentifiée reste
jouable après expiration de ce jeton ; le secret de session protège sa reprise.
Un compte ne peut pas occuper deux places dans le même salon.

Pendant les dix secondes de distribution, un compte peut demander un des sept
rôles présents dans la composition. Tarifs : Villageois 50, Loup-Garou 100,
Sorcière 150, Voyante 150, Loup Noir 200, Loup Blanc 100, Chasseur 100.
Le montant reste dans le solde et est réservé contre les autres dépenses.
À la fermeture, le serveur mélange les demandes et échange les cartes sans
modifier la composition ni les pouvoirs. Les invités reçoivent un rôle gratuit.
Seules les demandes honorées sont débitées. Les autres montants sont libérés.

Les règlements, annulations et résultats sont enregistrés dans `platformJobs`,
une file privée persistée avec la partie avant tout appel financier. Une panne
conserve la tâche, avec des nouvelles tentatives espacées jusqu'à 60 secondes.
Les identifiants stables et les contraintes SQL empêchent les doubles débits
et récompenses. Les tâches survivent au retour au lobby et au redémarrage.
Un salon avec une tâche en attente n'est pas supprimé par le nettoyage.

`REVANCHE1500` et l'ancien nom `RG1500` correspondent au même bonus de 1 500
pièces : utiliser l'un empêche de récupérer le bonus avec l'autre. L'historique
des utilisations est conservé, y compris celui de l'ancien code.

Chaque gagnant authentifié de La Meute reçoit 50 pièces, une seule fois par
résultat enregistré. Défaites, égalités et invités ne sont pas crédités. Le
navigateur ne peut plus déclarer de résultat pour La Meute via `/api/report-result`.
Le serveur utilise `record_la_meute_result`, réservée à `service_role` ;
l'ancienne RPC `record_game_result` refuse ce jeu. Les autres jeux conservent leur chemin existant ; le bonus de 50 pièces ne
s'applique qu'à La Meute. Pas de récompense rétroactive des anciennes parties.

Les quatre packs sont affichés sans encaissement. Stripe et PayPal sont
explicitement différés ; aucun moyen de paiement n'est activé.

Les quantités de fleurs et de tomates sont égales au nombre total de
participants de la partie, par joueur, et se rechargent uniquement à chaque
nouvelle partie. Aucun rechargement au changement de journée ou à la reconnexion.
Les éliminations ne diminuent pas cette quantité.

## Déploiement, dans cet ordre

Guide opérateur et commandes exactes : [MISE_EN_PRODUCTION.md](MISE_EN_PRODUCTION.md).

1. Déployer d'abord la plateforme avec le refus de `la-meute` dans
   `/api/report-result`. Ne pas activer les récompenses avant cette protection.
2. Vérifier l'historique réel des migrations Supabase. Le socle, les codes promo,
   les réservations initiales et `20261031030000_wallet_trigger_fix.sql` sont
   prérequis. Le correctif du renommage `20261031010000_promo_code_rename.sql`
   conserve désormais les utilisations historiques si cette migration n'avait
   pas encore été appliquée. Ne pas rejouer une migration déjà appliquée.
3. Appliquer les nouvelles migrations, dans cet ordre :
   - `20261031040000_role_selection_deferred_charge.sql`
   - `20261031050000_promo_alias_and_win_rewards.sql`
   - `20261031060000_trusted_meute_results.sql`
   L'ancien fichier local `20261031030000_role_selection_deferred_charge.sql`
   n'a jamais été appliqué par cette intervention ; il a été renuméroté pour
   supprimer le conflit avec `wallet_trigger_fix`.
4. Sur Railway, monter un volume persistant sur `/data`, conserver une seule
   instance du serveur de jeu et utiliser `DATA_DIR=/data/games` (Dockerfile).
   La reprise de la file nécessite la conservation de ces fichiers.
5. Vérifier `PLATFORM_SHARED_SECRET` identique sur plateforme et jeu. Sur le
   jeu : `PLATFORM_SUPABASE_URL` doit viser le projet central et
   `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` doit être sa clé de service. Ces clés
   ne doivent jamais être publiées dans le navigateur ou Git.
6. Déployer le jeu puis vérifier avec un vrai compte : reconnaissance du
   compte, premier code promo accepté, seconde tentative refusée, achat du
   Chasseur, compétition entre deux demandeurs, solde avant/après, victoire,
   nouvelle manche, puis redémarrage avec un règlement en attente.

## Validation locale

Plateforme : `npm test` exécute les tests de signature/refus des faux résultats,
puis `npm run test:wallet` exécute les migrations et transactions dans PostgreSQL
embarqué (PGlite). Il couvre les sept prix, le solde, les montants réservés,
les annulations tardives, les demandes idempotentes, le bonus unique, les
récompenses et les privilèges des fonctions. Cette base locale ne prouve pas
l'état de Supabase en production ni la concurrence entre serveurs PostgreSQL.

Jeu : typecheck, tests des règles et tests des handlers réels avec transport
simulé, panne réseau, sauvegarde sur disque et reprise après redémarrage.
Les suites HTTP nécessitent un environnement autorisant l'ouverture d'un port.

Aucun accès de production n'a été validé : DNS réseau indisponible dans
l'environnement de travail, authentification GitHub signalée invalide et
CLI retrouvées en cache mais sessions et accès distants non validés. Les clés
locales ont été comparées sans être affichées ; cela ne prouve pas les
variables réellement configurées chez les hébergeurs.
