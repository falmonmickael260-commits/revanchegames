# Revanche Game — socle commun (Phases 3-4)

Référence technique pour connecter un jeu existant (Président, Quiz Master,
La Meute, 10000, Kilomax) au compte unique et aux statistiques centrales.
Aucun jeu n'a besoin d'être réécrit : chaque serveur garde son moteur de
règles, sa propre logique de salon, et ajoute seulement un appel au moment
où une partie se termine.

**Les quatre jeux web sont tous intégrés** (Président, Quiz Master, La Meute,
10000) : identité transmise, résultat réel déclaré, testé. Kilomax
(Unity/WebGL) est en cours — cas à part, documenté en bas de page.

### Pièges rencontrés en les construisant — à vérifier sur chaque nouveau jeu

1. **Lire les variables d'environnement au chargement du module, pas à
   l'usage, les rend invisibles.** Un serveur Node custom qui charge
   lui-même son `.env.local` (`loadEnvConfig()` pour Quiz Master/La Meute,
   `process.loadEnvFile()` pour 10000) le fait **après** que ses propres
   imports se soient déjà évalués — contrairement à un simple `next dev`
   (Président), qui charge l'environnement avant tout code applicatif. Une
   constante top-level du genre
   `const key = process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY` y verra
   toujours `undefined`, silencieusement (aucune erreur — juste un résultat
   jamais déclaré, un appel réseau qui ne part jamais). Toujours lire ces
   variables **à l'intérieur d'une fonction**, appelée au moment réel de
   l'usage (voir `platform.ts` dans n'importe lequel des quatre jeux).
   10000 et La Meute n'avaient **aucun** chargement de `.env.local` du tout
   avant cette intégration (ils ne lisaient que les vraies variables
   d'environnement, fournies par l'hébergeur en production) — il a fallu
   l'ajouter.
2. **Un en-tête `Content-Security-Policy: frame-ancestors 'self'` bloque
   l'iframe silencieusement** (pas d'erreur réseau visible, juste une page
   blanche + une ligne dans la console du navigateur). Rencontré sur Quiz
   Master uniquement. Si un jeu a déjà une politique de sécurité de ce
   type, ajouter une variable `PLATFORM_SHELL_ORIGIN` qui, quand elle est
   définie, ajoute l'origine de la coquille à `frame-ancestors` (voir
   `server/limits.ts` dans QuizzMaster). Sans cette variable, le
   comportement par défaut (aucun cadrage externe) reste inchangé.
3. **La correspondance entre l'identifiant interne du jeu et le joueur
   réel n'est pas toujours celle qu'on croit.** Dans Président, `position`
   dans `standings` est indexé à partir de 0 (0 = gagnant), pas 1 — un
   premier essai attribuait la victoire au mauvais joueur. Vérifier
   toujours sur une vraie partie jouée, pas seulement en lisant le code.

## Projet Supabase central

- Projet : `revanche-game-platform` (ref `wrsmtdtzilpckfcjmyri`, région `eu-west-1`)
- Schéma : `supabase/migrations/20261025000000_platform_core.sql` dans ce repo
- Un seul compte joueur pour les cinq jeux : `auth.users` + `public.profiles`

Chaque jeu a besoin de deux variables d'environnement server-only pour parler
à ce projet (jamais exposées au navigateur, jamais dans le chat) :

```
PLATFORM_SUPABASE_URL=https://wrsmtdtzilpckfcjmyri.supabase.co
PLATFORM_SUPABASE_SERVICE_ROLE_KEY=<à demander — jamais commité>
```

Noms volontairement préfixés `PLATFORM_` pour ne jamais entrer en collision
avec un éventuel projet Supabase déjà utilisé par le jeu pour autre chose
(Président et Quiz Master en ont chacun un, distinct de celui-ci). Sans ces
deux variables, un jeu continue de fonctionner exactement comme avant —
l'intégration est strictement additive.

## 1. Identité du joueur à l'ouverture d'une partie

La coquille affiche chaque jeu dans `/play/<slug>` (iframe). Si un compte est
connecté, elle signe un jeton et l'ajoute en paramètre d'URL `rg_token` sur
l'iframe :

- Format : `<payload base64url>.<signature base64url>`
- Payload : `{ uid, username, iat, exp }` (120 s de validité)
- Signature : HMAC-SHA256 avec `PLATFORM_SHARED_SECRET` (même valeur des deux
  côtés) — aucune librairie JWT nécessaire, `node:crypto` suffit.
- Implémentation de référence : `src/lib/platform-token.ts` (signature, ici)
  et `presidente/src/server/platform-token.ts` (vérification, à copier).

Le jeu lit `rg_token` dans l'URL à l'ouverture, le transmet dans ses propres
appels de création/connexion à un salon, et le serveur du jeu le vérifie
(signature + expiration) avant de lui faire confiance.

**Un jeton absent, invalide ou expiré n'empêche jamais de jouer** : le joueur
reste autorisé, simplement en invité — `user_id = null`, `guest_label` = son
pseudo saisi dans le jeu. Rien n'alimente alors son profil, puisqu'il n'y a
pas de profil à alimenter.

## 2. Déclarer le résultat d'une partie

Une seule fois par partie terminée, le serveur du jeu POST directement vers
le PostgREST du projet central (pas besoin d'ajouter `@supabase/supabase-js`
comme dépendance — un simple `fetch`, voir `presidente/src/server/platform.ts`) :

```ts
await fetch(`${PLATFORM_SUPABASE_URL}/rest/v1/rpc/record_game_result`, {
  method: "POST",
  headers: {
    apikey: PLATFORM_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${PLATFORM_SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    p_game_slug: "president",        // voir la liste des slugs ci-dessous
    p_idempotency_key: `president:${roomCode}:${finishedAt}`,
    p_room_code: roomCode,           // facultatif, pour le débogage
    p_raw_payload: { /* ce que le jeu veut garder, libre */ },
    p_players: [
      { user_id: "...", guest_label: null, outcome: "win",  score: 42, position: 1 },
      { user_id: null,  guest_label: "Bob", outcome: "loss", score: 10, position: 2 },
    ],
  }),
});
```

- `outcome` : `"win" | "loss" | "draw"` — exactement ce que le moteur de
  règles du jeu a déjà calculé. Rien n'est recalculé côté plateforme.
- `score` et `position` : facultatifs, selon ce que le jeu peut fournir.
- **Slugs valides** (table `game_catalog`) : `kilomax`, `president`,
  `quiz-master`, `la-meute`, `10000`.

### Idempotence — très important

`p_idempotency_key` doit être **stable pour une partie donnée**, y compris en
cas de retry réseau ou de double appel après une reconnexion, mais changer
d'une partie à l'autre dans le même salon (un salon peut être rejoué). Dans
Président, c'est `game_slug:room_code:horodatage_de_l'événement_game_over` —
cet horodatage est capturé une seule fois, au moment où l'événement est
produit, donc stable pour cette partie précise et différent de la suivante.

Un deuxième appel avec la même clé ne crée rien de plus et renvoie l'id déjà
enregistré. **Testé et vérifié** : un appel en double ne fausse pas les
statistiques (voir statut plus bas).

## 3. Statistiques — rien à calculer soi-même

Les statistiques par jeu et le total agrégé sont deux vues SQL
(`game_stats`, `game_stats_totals`) calculées à la lecture à partir de
`game_results`/`game_result_players`. Aucun jeu n'a besoin de maintenir un
compteur : il suffit d'appeler `record_game_result` correctement, la page
profil de la coquille s'occupe du reste.

## Ce qui est vérifié à ce stade

- Inscription, confirmation e-mail, connexion, déconnexion, mot de passe oublié
- Un compte = un profil = les mêmes statistiques sur l'ensemble des jeux
- `record_game_result` appelé pour les 5 jeux avec un compte de test réel,
  relu depuis `/profile` et vérifié identique aux données en base
- Un appel en double (même `idempotency_key`) ne recrée pas de ligne et ne
  fausse pas les statistiques
- **Président, bout en bout** : `/play/president` signe un jeton, Président
  le vérifie, l'attribue au joueur qui rejoint un salon, et déclare le
  résultat réel (calculé par son propre moteur de règles) à la fin de la
  manche — testé en local avec un salon réel (avec et sans ex æquo).
- **Quiz Master, bout en bout** : même chose via son protocole WebSocket
  (jeton dans les messages `create`/`join`, résultat déclaré dans
  `showFinal()`) — testé avec deux parties réelles, dont une avec deux
  candidats ex æquo en tête (tous deux correctement comptés "win").
- **La Meute** : identité attachée via `game:create`/`game:join`, résultat
  déclaré dans `recordResults()` (qui appelait déjà son propre système de
  profils — le nôtre s'ajoute à côté, sans y toucher) — testé : attachement
  d'identité sur une vraie connexion socket, jeton invalide retombant bien
  sur invité, et un résultat réel envoyé et relu en base.
- **10000** : identité attachée via les messages `create`/`join`, résultat
  déclaré à l'événement `victory` du `GameController` — même niveau de
  test que La Meute.

## La coquille : écran de jeu, partie persistante, chat flottant

Trois choix structurants, à connaître avant de toucher à `/play/<slug>` ou à
la coquille.

### 1. L'iframe du jeu ne vit pas dans la route

`/play/[slug]/page.tsx` ne rend plus le jeu : il calcule la cible (slug +
jeton d'identité signé, les deux seulement possibles côté serveur) et la
déclare via `<GameMount />`. L'iframe est rendue par `<GameViewport />`, monté
dans `<ShellFrame />` — c'est-à-dire dans le layout racine, qui n'est jamais
démonté d'une route à l'autre.

Pourquoi : tant que l'iframe vivait dans la route, ouvrir son profil ou le
chat la démontait, donc tuait le moteur du jeu et sa connexion temps réel. En
la sortant de l'arbre des routes, changer de section ne fait que la *masquer*
(`.rg-game-stage[data-backgrounded]`), et la partie continue.

Deux détails à ne pas « simplifier » par erreur :

- `GameSessionProvider.start()` **renvoie l'état précédent à l'identique** si
  le slug est déjà actif. Revenir sur `/play/<slug>` re-rend la page côté
  serveur, qui re-signe un jeton et produit donc une `src` différente ; si on
  l'appliquait, l'attribut `src` changerait et le navigateur **rechargerait le
  jeu**. C'est tout l'intérêt du mécanisme.
- La mise en arrière-plan utilise `visibility: hidden`, **pas**
  `display: none`. Un iframe passé en `display: none` est redimensionné à 0×0,
  ce qui envoie au jeu un `resize` vers une taille nulle (canvas replié, mise
  en page cassée au retour). `visibility: hidden` conserve la boîte, donc les
  dimensions.

L'état de la partie vit **en mémoire seulement**, jamais dans localStorage :
une partie ne survit pas à la fermeture de l'onglet, et il ne faut pas
proposer de reprendre une partie que le serveur du jeu a déjà abandonnée.

### 2. Les hauteurs de la coquille sont des variables, pas des estimations

`globals.css` expose `--rg-header-h`, `--rg-bottom-nav-h`, `--rg-sidebar-w`,
`--rg-game-bar-h` et les `--rg-safe-*` (zones de sécurité iPhone). Les
composants concernés portent ces hauteurs, et les pages qui réservent de la
place lisent les mêmes variables.

Ce que ça corrige : chaque page refaisait le calcul en `calc(100vh - 64px)`.
Le 64 px était une approximation de l'en-tête, et `100vh` vaut sur mobile la
hauteur du viewport *large* (barre d'adresse masquée). Sur l'écran de jeu, on
cumulait donc en-tête + `100vh - 64px` + `pb-20` (80 px réservés à la barre
d'onglets) = **`100vh` + 80 px** : le joueur devait défiler pour voir sa
partie. Au passage, `pb-20` était aussi trop court sur un iPhone à indicateur
d'accueil (56 + 34 = 90 px > 80 px), et le bas des pages passait sous la barre.

La scène de jeu, elle, n'utilise aucune hauteur : elle est calée par des
*insets* `position: fixed` (`top`/`bottom`/`left`/`right`). Un élément fixe
ainsi calé est dimensionné par le navigateur contre le viewport réellement
affiché, et re-dimensionné tout seul quand la barre d'adresse se replie, quand
l'appareil tourne ou quand le clavier s'ouvre. `overflow: hidden` est porté par
cette scène seule — jamais par `<html>` ou `<body>`, pour ne pas bloquer le
défilement du reste de la plateforme.

### 3. Un seul moteur de chat, deux présentations

`useChatFeed` (historique, temps réel, envoi, déduplication) et
`<ChatMessageList>` / `<ChatComposer>` sont partagés par la page `/chat` et le
chat flottant `<ChatDock />`. Un message envoyé d'un côté apparaît de l'autre.

- Ce qui est *partageable entre serveur et navigateur* vit dans
  `lib/chat-shared.ts`, **sans** directive `"use client"` : la page `/chat`
  rend son historique initial côté serveur et doit pouvoir appeler
  `rowsToMessages`, ce qu'un module client lui interdit (« Attempted to call
  rowsToMessages() from the server »).
- Le dock n'est monté que **pendant une partie**, et il se met en retrait
  (`suspended`) sur `/chat`, qui tient déjà son propre abonnement : pas de
  double canal Realtime sur la même table.
- Les permissions ne sont pas réimplémentées : RLS sur `chat_messages`
  (lecture pour tous, insertion de ses seuls messages) reste la seule
  autorité.
- L'état de lecture (`rg:chat-last-read`) passe par `createLocalStore`, comme
  les favoris et le profil.

## Confirmation d'e-mail — la panne « Safari ne peut pas ouvrir la page »

**Cause.** En production (Railway), `request.nextUrl.origin` ne renvoie pas le
domaine public mais l'adresse interne du conteneur, `https://localhost:8080`
(schéma pris dans `x-forwarded-proto`, hôte dans l'adresse d'écoute).
`/auth/callback` construisait toutes ses redirections dessus. Constaté avant
correction :

```
GET https://revanchegames-production.up.railway.app/auth/callback
  → 307 Location: https://localhost:8080/sign-in
```

Le lien de confirmation arrivait donc bien jusqu'à la plateforme, puis la
renvoyait vers une adresse qui n'existe que dans le conteneur — d'où l'erreur
de connexion sur iPhone et Android. **La réinitialisation de mot de passe
passait par la même route et était cassée de la même façon**, sans que ça ait
été remarqué.

**Correction.** `lib/site-url.ts` n'essaie pas de deviner le domaine public :
il ne l'écrit pas du tout. Un en-tête `Location` relatif est autorisé
(RFC 7231 §7.1.2) et chaque navigateur le résout contre l'URL qu'il a
réellement demandée. Aucune variable d'environnement n'est nécessaire, sur
n'importe quel hébergeur et n'importe quel domaine.
`NEXT_PUBLIC_SITE_URL` reste un réglage optionnel pour forcer un domaine
canonique.

**Deux formats de lien acceptés**, parce qu'ils ne se valident pas pareil et
qu'il ne faut pas les mélanger :

| Lien | Méthode | Multi-appareils |
| --- | --- | --- |
| `?token_hash=…&type=signup` | `verifyOtp` | oui |
| `?code=…` (`{{ .ConfirmationURL }}` par défaut) | `exchangeCodeForSession` | non |

Le code PKCE ne peut être échangé que par le navigateur qui a lancé
l'inscription (le vérificateur y est en cookie) — s'inscrire sur l'ordinateur
puis relever ses e-mails sur le téléphone échouait. `confirmation.html` utilise
donc maintenant `{{ .TokenHash }}`, et `/auth/callback` gère les deux formats.

### Le modèle d'e-mail est bloqué par le palier gratuit

**En l'état, `confirmation.html` n'est pas déployable** — et ne l'a jamais été.
Tentative réelle (CLI 2.122.0, projet lié) :

```
$ npx supabase config push
auth.email.template.confirmation.subject [update]
  local:  "Bienvenue sur Revanche Game — Confirme ton compte !"
  remote: "Confirm your email address"
→ 400 Email template modification is not available for free tier projects
  using the default email provider. Please upgrade your plan or configure
  a custom SMTP provider.
```

Le sujet distant est `"Confirm your email address"` : c'est le **défaut de
Supabase**. La production envoie donc l'e-mail standard, pas celui de ce
dépôt, et le lien reçu est un `{{ .ConfirmationURL }}` au format `?code=`.

Conséquences à garder en tête :

- **La correction du « Safari ne peut pas ouvrir la page » ne dépend pas de
  ça.** Elle est dans le code applicatif (`lib/site-url.ts`), déployé par
  l'hébergeur de la coquille, et `/auth/callback` gère le format `?code=`.
- **Le passage à `token_hash` est en sommeil** : il prendra effet tout seul le
  jour où le modèle sera déployable. D'ici là, la confirmation reste limitée
  au navigateur d'origine, et `/auth/confirmed?status=other_browser` est
  justement l'écran qui explique ce cas au joueur.

Pour débloquer : configurer un SMTP personnalisé (Resend, Brevo, SendGrid ont
des paliers gratuits) dans `[auth.email.smtp]` + le tableau de bord, puis
relancer `npx supabase config push`.

### Avant tout `config push` — vérifier le diff

`config push` envoie **tout** `config.toml`, pas seulement ce qu'on vient de
changer. Toujours lancer `npx supabase config diff` d'abord.

Cas réellement rencontré : `[auth.sms.twilio]` portait `enabled = true` avec un
commentaire affirmant que ce champ « n'est pas comparé/poussé par la CLI ». Le
diff disait le contraire — `update`, local `true` → distant `false`, plus deux
`unmanaged-placeholder` en `local_only`. Un push aurait activé un fournisseur
SMS avec des identifiants factices en production. Remis à `false`, qui est la
valeur correcte (la plateforme n'envoie aucun SMS) et celle déjà en place.

Noter aussi que `auth.rate_limit.email_sent` est listé comme **non comparé** :
la valeur déclarée ici (`2`) ne reflète pas forcément celle du projet. Le
fournisseur d'e-mail intégré de Supabase est par ailleurs fortement limité en
débit — à vérifier dans le tableau de bord si des joueurs ne reçoivent rien.

## Kilomax (Unity/WebGL) — cas à part

Contrairement aux quatre jeux web, Kilomax n'a **aucun serveur à nous** : le
client Unity WebGL parle directement à un projet Supabase externe (pas celui
de la plateforme) via des fonctions RPC (`create_room`, `commit_state`…),
partagé avec un client web « En Route » qui existe par ailleurs. Deux
conséquences :

1. **Pas question d'y mettre la clé `service_role` du projet central** — un
   build WebGL est du code public, lisible par n'importe qui. Au lieu d'un
   appel direct à Supabase comme les autres jeux, Kilomax appelle une
   nouvelle route de la coquille elle-même : `POST /api/report-result`
   (`src/app/api/report-result/route.ts`). Cette route vérifie la signature
   du jeton puis appelle `record_game_result` avec la clé secrète,
   **côté serveur, jamais exposée au client**. CORS ouvert sur cette route
   précise : la vraie protection est la signature du jeton, pas l'origine
   (un jeu client-only n'a pas de domaine fixe connu à l'avance).
2. **Chaque appareil ne connaît de façon fiable que son propre résultat** —
   il n'y a pas de serveur autoritaire qui voit tous les joueurs à la fois.
   Chaque client Unity déclare donc sa propre ligne (une par partie, idempotent
   sur `kilomax:<code>:<playerId>`) dès que `GameState.Phase` passe à
   `GameOver` — voir `OnlineRoomController.ReportResultOnce()`. Plusieurs
   lignes `game_results` peuvent donc exister pour une même partie (une par
   joueur relié à un compte), ce qui est normal et ne fausse rien : chaque
   ligne ne compte qu'une fois, pour un joueur différent.

**Risque résidant assumé, pas corrigé** : identité ET résultat sont tous les
deux affirmés par le client (contre seulement l'identité pour les quatre
autres jeux, où un serveur calcule le résultat). Un client modifié pourrait
s'auto-déclarer vainqueur. Déjà documenté dans le dossier d'audit Phase 1 ;
le corriger demanderait un serveur de validation des règles, hors scope ici.

**Statut** : le point d'entrée serveur (`/api/report-result`) est écrit et
testé (appel réel, idempotence vérifiée, jeton invalide neutralisé sans
erreur). Le code C# (`PlatformSession.cs`, `PlatformApi.cs`, le crochet dans
`OnlineRoomController`) est écrit. Compilation et test en conditions réelles
(build WebGL, partie jouée dans un navigateur) en cours — Unity n'était pas
installé sur cette machine, l'éditeur est en cours de téléchargement.

## Ce qui reste à faire

- La Meute a déjà un appel Supabase équivalent (`platform_game_results`,
  projet Supabase différent, toujours actif) : les deux coexistent pour
  l'instant ; à terme, migrer vers `PLATFORM_SUPABASE_URL` plutôt que
  garder deux systèmes de profils en parallèle
- Déployer les variables d'environnement (`PLATFORM_SUPABASE_URL`,
  `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_SHARED_SECRET`,
  `PLATFORM_SHELL_ORIGIN` pour Quiz Master) sur l'hébergement de production
  de chaque jeu — pour l'instant uniquement testé en local
- Aucune bannière "Connecté en tant que…" ajoutée côté interface pour La
  Meute et 10000 (contrairement à Président/Quiz Master) — purement
  cosmétique, l'attribution du compte fonctionne déjà sans elle
