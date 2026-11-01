# Invitations directes — intégration

## Comportement

Un compte crée ou rejoint un salon dans un jeu. Le pont d'iframe transmet sa
session native uniquement à l'origine de la plateforme. Le serveur plateforme
vérifie cette session auprès du serveur du jeu avant de publier le salon et la
présence dans `room_registry`. La sélection d'un ami réutilise `friendships` et
les invitations Supabase Realtime existantes.

« Accepter » appelle une route authentifiée. Elle vérifie le destinataire,
l'amitié, le blocage, l'expiration et l'état de l'invitation, puis demande au jeu
une admission dans l'instance exacte du salon. Le moteur natif garde le dernier
mot sur la capacité et le démarrage. L'adaptateur retrouve une session existante
pour le même compte plutôt que de créer un second siège. La réponse native est
chiffrée dans une table privée, puis transmise à la bonne iframe par `postMessage`
avec contrôle de `origin`, `source` et de l'identifiant de lancement.

L'acceptation n'est confirmée qu'après obtention d'une session du jeu. Une lease
SQL empêche les acceptations simultanées ; une reprise réutilise le résultat.
Les sessions ne passent pas dans l'URL d'invitation. L'ancien jeton d'identité de
lancement `rg_token` reste compatible avec les jeux ; aucune clé serveur ne
passe dans le navigateur. Les commandes backend sont signées avec un préfixe
distinct, une audience de jeu et une validité de 30 secondes.

Le pont suit les changements de salon sans recharger l'iframe. La page Amis
reprend ce salon sans demander de code. Les jeux ouverts seuls proposent aussi
un bouton qui crée un contexte opaque, chiffré, valable deux minutes ; la
plateforme vérifie le compte avant d'afficher la sélection des amis. Le retour
après connexion conserve le contexte. Une preuve de siège reste obligatoire.

Les formulaires de code invités, protocoles de jeu et règles restent présents.
10000 reçoit en plus un jeton de siège et une reprise WebSocket : une nouvelle
connexion peut retrouver un joueur existant après démarrage, mais un nouveau
joueur reste refusé. Une coupure non volontaire dispose d'un délai de reprise
de 60 secondes ; un départ explicite conserve le comportement natif de départ.

## Fichiers et configuration

- Source commune : `vendor/game-connector/` ; distribution aux cinq copies de
  travail par `node scripts/sync-game-connector.mjs <répertoire-parent>`.
- Plateforme : `src/lib/game-connector/`, routes `/api/game/rooms/current`,
  `/api/game/invitations`, `/api/game/invitations/[id]/accept`, page `/invite`.
- Jeux : `/api/platform/connector` (commandes backend signées) et
  `/api/platform/context` (preuve de siège du joueur ouvrant une invitation).
- Variables existantes : `PLATFORM_SHARED_SECRET` doit correspondre entre la
  plateforme et le serveur du jeu. Les secrets restent côté serveur.
- La plateforme réutilise `GAME_URL_<SLUG>` ou les URL du catalogue.
  `GAME_CONNECTOR_URL_<SLUG>` peut préciser le backend quand le client est servi
  séparément. Il doit viser **le serveur qui possède les vrais salons**.
- Origine du pont : plateforme Railway canonique ; `platform` est configurable
  dans l'initialisation du connecteur. En développement local, les jeux sur
  `localhost` utilisent la plateforme de test sur le port 3100.

Migrations centrales additives appliquées :

```text
20261101020000_direct_game_invitations.sql
20261101030000_private_game_registry.sql
```

Les sessions natives sont stockées chiffrées par AES-256-GCM dans des tables sans
lecture navigateur. Les codes du registre ne sont consultables que par les
comptes impliqués dans le salon ou l'invitation, pas par les visiteurs anonymes.

**Kilomax : configuration distante encore requise.** Sa base de salons est le
projet distinct `wcdoavbmexzgjhmmrsvj`, non accessible dans la session Supabase
actuelle. La migration `Enroute/supabase/migrations/20261101000000_platform_admission.sql`
ajoute une identité centrale aux membres et une RPC d'admission réservée au
service serveur. Elle a été testée localement et doit être appliquée à cette
base, puis sa clé serveur propre configurée dans Vercel sous
`GAME_SUPABASE_SERVICE_ROLE_KEY`. Ne pas utiliser la clé du Supabase central à
sa place. Le code est préparé sans remplacer les RPC manuelles invitées.

## Vérifications exécutées

- Plateforme : suite existante réussie, 16 contrôles portefeuille conservés ;
  nouveaux tests de signature, audience, expiration, intégrité, chiffrement,
  droits du destinataire, registre, confidentialité, lease et idempotence.
- Président : 63 tests réussis, dont admission native idempotente et dernière
  place disputée entre deux comptes ; build Next.js réussi.
- Quiz Master : 22 tests réussis, dont identité et capacité de l'admission ;
  build Next.js réussi.
- La Meute : 150 tests existants réussis, test d'admission ajouté et réussi ;
  typecheck réussi. Les corrections récentes du portefeuille sont conservées.
- 10000 : cinq tests protocole/admission réussis, dont reprise après démarrage
  sur le même siège et maintien du refus des nouveaux entrants.
- Kilomax : build réussi ; migrations natives exécutées sur PostgreSQL PGlite,
  admission, invité, identité, capacité, idempotence, instance et droits vérifiés.

Recette navigateur **réellement exécutée** avec Chrome, quatre serveurs de jeu
locaux isolés et deux vrais comptes Supabase Auth temporaires :

| Jeu | Realtime et accepter sans code | Même salon et identité | Rechargement sans second siège | Invité sans compte par code, fenêtre mobile tactile |
| --- | --- | --- | --- | --- |
| Président | Réussi | Réussi | Réussi | Réussi |
| La Meute | Réussi | Réussi | Réussi | Réussi |
| Quiz Master | Réussi | Réussi | Réussi | Réussi |
| 10000 | Réussi | Réussi | Réussi | Réussi |
| Kilomax | Non exécuté à distance | SQL local vérifié | SQL local vérifié | RPC historique conservée ; E2E restant |

Commande explicite pour reproduire la recette à deux comptes :

```sh
RUN_INVITATION_E2E=1 node scripts/test-direct-invitations-browser.mjs
```

Le script utilise des copies de jeux dans `/private/tmp/revanche-invitations-audit`,
Playwright temporaire et Chrome installé. Il crée deux utilisateurs Auth dédiés,
les connecte dans des contextes navigateur distincts et nettoie les comptes et
les seules données créées pour le test. Les serveurs locaux ne reçoivent aucune
clé Stripe active, les requêtes navigateur Stripe sont bloquées et aucune
partie n'est démarrée pour ces tests. Aucun débit ni remboursement effectué.

La fenêtre mobile est une émulation tactile Chrome 390×844 : elle ne remplace
pas une recette Safari/iPhone, Android physique ou PWA installée. Le push en
arrière-plan et le parcours autonome complet restent à vérifier sur appareils.

## Déploiement

Les cinq branches `codex/direct-invitations` sont publiées dans leurs dépôts.
Les services existants Président, La Meute et Quiz Master ont été reliés à ces
branches, sans modification des règles, domaines, volumes ou autres variables.

| Jeu | Commit de l'adaptateur | Déploiement |
| --- | --- | --- |
| Président | `9f33b06` | Railway, `dad9f8bd-5f1d-43ef-bd8d-a099084b06a0` |
| La Meute | `50db19a` | Railway SUCCESS, `d167497d-cbde-479f-a7da-3b28527fdc85` |
| Quiz Master | `1f4c1c4` | Railway SUCCESS, `8f8fc878-aa0a-4879-831c-3b3be20cb11b` |
| 10000 | `1954a26` | Publié également sur `main` ; connecteur Render confirmé par une sonde signée HTTP 409 sur salon fictif |
| Kilomax | `5fcd56e` | Branche publiée ; configuration Supabase distante manquante, pas de déploiement Vercel de l'adaptateur |

Les sondes sur un salon volontairement inexistant vérifient l'authentification
backend sans créer de partie ni connecter un joueur. Le serveur doit répondre
409 après reconnaissance de la signature, et 403 sans signature. Elles ne
remplacent pas les parcours navigateur de recette.

Les résultats navigateur ci-dessus portent sur les serveurs locaux, pas une
preuve de parcours entre deux joueurs de production. Déployer les adaptateurs
avant la plateforme, vérifier les signatures avec des sondes sans salon, puis
contrôler le commit GitHub actif et la réponse des endpoints réels.

Conserver les origines et volumes existants, en particulier Render pour 10000
tant que le catalogue l'utilise. Kilomax ne doit pas être annoncé comme validé
avant accès à sa base et configuration de sa RPC serveur.
