# Mise en production contrôlée — Revanche Games et La Meute Noire

Le projet reste NON VALIDÉ EN PRODUCTION. Ce guide ne constitue pas une preuve
de déploiement. Ne passer à une étape que si la précédente est réussie.

## 0. État constaté et interventions indispensables

- Les deux branches locales s'appellent `codex/meute-wallet-reliability`.
- Elles contiennent respectivement `132ae6e` (plateforme) et `3727987` (jeu),
  puis les commits de préparation produits après ces deux commits.
- Les nouveaux essais de push échouent : DNS `github.com` inaccessible.
- `gh auth status` signale l'authentification GitHub invalide.
- Vercel : une connexion locale existe, mais `whoami` échoue et ce dossier
  n'est pas lié à un projet `.vercel`.
- Railway : la connexion locale ne peut pas être rafraîchie ; aucun projet
  n'est lié au dossier du jeu. L'état du volume distant est inconnu.
- Supabase : le projet local est lié à `wrsmtdtzilpckfcjmyri`, mais aucun jeton
  CLI n'est disponible ; l'historique distant n'a pas pu être consulté.
- Aucun déploiement et aucune migration distante n'ont été exécutés.

Il faut une intervention humaine pour les connexions OAuth, la sélection des
projets EXISTANTS, le contrôle du volume, les variables de production et les
connexions des vrais comptes de test. Ne pas transmettre de mot de passe ou
clé secrète dans une conversation, une URL ou l'historique du Terminal.

## 1. GitHub : publier sans perdre les commits

Vérifier dans Railway que le nouveau jeu ne sera pas déployé automatiquement
lors du push de sa branche. Suspendre temporairement son autodeploy si nécessaire.
Ne pas fusionner la branche du jeu dans sa branche de production à cette étape.
Les commandes ci-dessous n'utilisent ni force-push ni reset.

```zsh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status

cd /Users/miick/code/revanche-games-web
git switch codex/meute-wallet-reliability
git status --short
git branch "sauvegarde/meute-$(date +%Y%m%d-%H%M%S)"
git push --set-upstream origin codex/meute-wallet-reliability

cd /Users/miick/code/leloupbo
git switch codex/meute-wallet-reliability
git status --short
git branch "sauvegarde/meute-$(date +%Y%m%d-%H%M%S)"
git push --set-upstream origin codex/meute-wallet-reliability
```

`git status --short` doit être vide. S'il y a des changements non commités,
les conserver : ne pas utiliser `reset --hard`, `clean` ni `push --force`.
Un rejet non-fast-forward nécessite l'examen des modifications distantes,
pas leur écrasement. Le nom de la branche de production Railway est à lire
sur le service existant ; il n'est pas déduit de `main` (le dépôt local du jeu
suit actuellement une branche `claude/...`).

## 2. Déployer la plateforme, puis prouver la protection

Depuis le projet plateforme, les commandes suivantes utilisent la CLI Vercel
60.1.3 vérifiée pendant la préparation. À `link`, sélectionner le projet et
le compte EXISTANTS de Revanche Games ; ne pas créer un autre projet.

```zsh
cd /Users/miick/code/revanche-games-web
npx --yes vercel@60.1.3 login
npx --yes vercel@60.1.3 link
npx --yes vercel@60.1.3 whoami
npm ci
npm test
npm run lint
npx --yes vercel@60.1.3 deploy --prod
```

Avant `deploy`, vérifier dans Vercel > Settings > Environment Variables,
uniquement dans l'environnement Production : `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` et
`PLATFORM_SHARED_SECRET`. Le projet Supabase doit être le projet central.
Conserver la valeur existante du secret partagé et la comparer au jeu sans
l'afficher. `GAME_URL_LA_MEUTE`, s'il existe, doit viser le vrai service de jeu.

Attendre le statut Ready/production dans Vercel. Vérifier le domaine canonique
et toutes les autres origines encore actives qui utilisent la même clé de
service, y compris une éventuelle ancienne plateforme Railway et les anciennes
prévisualisations accessibles. Les protéger aussi ou restreindre leur accès
avant d'activer des récompenses. Une seule URL protégée ne prouve pas que
les autres le sont.

```zsh
node scripts/check-public-result-guard.mjs https://revanchegames.vercel.app
```

Si l'ancienne plateforme Railway est encore publique et active, la déployer
avec la même protection, puis contrôler également cette origine :

```zsh
node scripts/check-public-result-guard.mjs https://revanchegames.vercel.app https://revanchegames-production.up.railway.app
```

Remplacer/compléter ces origines si les domaines de production réels sont
différents. La sonde envoie un jeton volontairement invalide et n'invente
aucune victoire. Elle exige HTTP 400 et `gameSlug inconnu.`. HTTP 200, page
de connexion, 404, réponse WAF générique ou erreur réseau ne valident pas
cette étape. Ne pas poursuivre tant que les origines actives ne sont pas sûres.

## 3. Supabase : historique et contrôles avant toute écriture

La version CLI locale inspectée est 2.122.0. Connexion humaine nécessaire.
Les commandes `--linked` ciblent explicitement le projet distant.

```zsh
cd /Users/miick/code/revanche-games-web
npx --yes supabase@2.122.0 login
npx --yes supabase@2.122.0 link --project-ref wrsmtdtzilpckfcjmyri
npx --yes supabase@2.122.0 migration list --linked
npx --yes supabase@2.122.0 db push --linked --skip-vault --dry-run
```

**Arrêt si l'historique est incohérent.** Si des migrations déjà réalisées à
la main sont annoncées comme absentes, ne pas les rejouer et ne pas lancer
un `migration repair` aveugle. Examiner l'historique et le schéma avant de
marquer quoi que ce soit appliqué. Ne jamais exécuter `db reset --linked`.

Prérequis à vérifier : socle `20261025000000`, codes promo `20261031000000`,
renommage `20261031010000`, réservations `20261031020000` et correctif du
portefeuille `20261031030000`. Le socle social antérieur ne doit pas être
réappliqué. Les versions locales ne comportent aucun doublon.

Si les nouvelles migrations ne sont PAS encore appliquées :

```zsh
npx --yes supabase@2.122.0 db query --linked --file scripts/sql/production-preflight.sql
```

Ce contrôle en lecture seule vérifie tables, anciennes signatures, RLS,
contraintes d'unicité et trigger du portefeuille. Conserver les nombres de
lignes avant/après. Examiner les réservations `pending` existantes et laisser
les parties concernées finir normalement ; ne pas annuler globalement leurs
achats et ne pas inventer de remboursements.

Dans Supabase Dashboard, vérifier qu'une sauvegarde récente est disponible
avant la migration. Si les deux premières migrations sont déjà appliquées,
ne pas les rejouer : le preflight s'arrête volontairement sur ce cas.
Contrôler ce qui manque avec l'historique et le postflight.

## 4. Appliquer uniquement les migrations attendues, puis contrôler

Prévoir une fenêtre de maintenance après la fin des parties de l'ancien jeu,
sans nouveaux salons pendant la bascule. L'ancien serveur n'utilise pas la
nouvelle RPC ; il ne doit pas produire de nouveaux résultats après son
verrouillage en base. Conserver ses fichiers et le volume existant.

L'ordre d'un projet à jour sur les prérequis est :

1. `20261031040000_role_selection_deferred_charge.sql`
2. `20261031050000_promo_alias_and_win_rewards.sql`
3. `20261031060000_trusted_meute_results.sql`

La troisième migration est un durcissement supplémentaire : l'ancienne RPC
`record_game_result` refuse La Meute ; seul le serveur du jeu appelle
`record_la_meute_result`, réservée à `service_role`. Une ancienne API publique
ne pourra donc plus créer de victoire La Meute, même avec un vrai jeton.
Cette migration ne supprime aucun compte, solde ou résultat.

**Si et seulement si** la protection réelle est validée et le dry-run annonce
uniquement les migrations attendues encore manquantes :

```zsh
node scripts/check-public-result-guard.mjs https://revanchegames.vercel.app
npx --yes supabase@2.122.0 db push --linked --skip-vault
npx --yes supabase@2.122.0 migration list --linked
npx --yes supabase@2.122.0 db query --linked --file scripts/sql/production-postflight.sql
```

Ajouter les autres origines actives à la sonde, comme à l'étape 2. Ne pas
utiliser `--include-all` pour contourner un historique incorrect. Le postflight
vérifie les trois migrations, le contrôle des montants réservés, la RPC dédiée,
les privilèges serveur, la RLS, le bonus et le trigger de victoire. Une erreur
bloque le déploiement du jeu. Il ne modifie aucune donnée.

## 5. Railway : stockage existant, variables, puis déploiement du jeu

```zsh
cd /Users/miick/code/leloupbo
npx --yes @railway/cli@5.71.0 login
npx --yes @railway/cli@5.71.0 link
npx --yes @railway/cli@5.71.0 status
npx --yes @railway/cli@5.71.0 volume list
```

À `link`, sélectionner le projet, l'environnement Production et le service
EXISTANTS de La Meute. Vérifier dans le dashboard : une seule réplique, volume
persistant monté sur `/data`, `DATA_DIR=/data/games` et sauvegarde du volume.
`railway.json` configure déjà une seule réplique et la santé via `/health`.
Le Dockerfile définit déjà `DATA_DIR=/data/games`, mais ne crée pas le volume.

Si le volume existe, le réutiliser sans le supprimer ni le remplacer. Si le
service utilise actuellement un dossier éphémère, **arrêter ici** pour en
sauvegarder/migrer les fichiers avant de monter un volume vide ou redéployer :
le montage cacherait les fichiers existants. Cette opération nécessite
l'inspection du service réel et ne peut pas être validée depuis ce poste.
Uniquement pour un service neuf sans données à conserver et sans volume :

```zsh
npx --yes @railway/cli@5.71.0 volume add --mount-path /data
```

Vérifier dans les variables du service : `PLATFORM_SHARED_SECRET` identique à
la plateforme, `PLATFORM_SUPABASE_URL` visant le projet central et
`PLATFORM_SUPABASE_SERVICE_ROLE_KEY` de ce même projet. Les variables
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` propres aux profils du jeu ne les
remplacent pas. Conserver les réglages LiveKit existants. Aucun secret local
ne doit être envoyé dans l'image : `.dockerignore` exclut désormais `.env*`.

Après validation des étapes 2, 3 et 4 et du stockage :

```zsh
npm ci
npm run typecheck
npm test
npx --yes @railway/cli@5.71.0 up
curl --fail --silent --show-error https://www.lameutenoire.fr/health
```

`up` déploie le dossier courant vers le service lié ; ne pas utiliser `--new`
ni sélectionner un autre environnement. Attendre le déploiement Healthy.
Si `npm test` ne peut pas ouvrir de ports dans Codex, l'exécuter dans le vrai
Terminal du Mac, où les tests HTTP pourront démarrer.

Avant de réactiver l'autodeploy du jeu, configurer la bonne branche GitHub
sur le service et vérifier qu'elle contient bien les mêmes commits. Ne pas
laisser une ancienne branche remplacer cette version au prochain push.

## 6. Tests réels : compte rendu à remplir, pas des tests déjà effectués

Créer/utiliser deux comptes de test A et B dans deux profils de navigateur.
Ouvrir le jeu DEPUIS Revanche Games, pas seulement par son URL directe.
Le salon peut être complété par des bots pour atteindre le minimum de joueurs.

| Essai | Résultat attendu | Preuve à noter |
|---|---|---|
| Identité A et B | Comptes reconnus, pas besoin du mode invité | Pseudos et accès à la sélection payante |
| REVANCHE1500, compte neuf | Solde +1 500 | Solde avant/après et ligne `promo:` |
| Deuxième tentative et alias RG1500 | Refus, aucun crédit supplémentaire | Message et journal inchangé |
| Sélection | Exactement 10 s ; uniquement rôles présents | Composition et compteur |
| Chasseur unique demandé | Chasseur attribué, débit de 100 | Carte et réservation `granted`/`charged=true` |
| A et B demandent un seul Chasseur | Un gagnant ; perdant sans débit | Deux réservations et mouvements correspondants |
| Invité | Rôle attribué gratuitement | Aucun achat associé à un compte |
| Victoire authentifiée | +50 par gagnant, pas par perdant/nul/invité | Ligne `la-meute-win:` |
| Reconnexion | Même identité, rôle et solde ; pas de double crédit | Comparaison avant/après et journal |
| Fleurs/tomates, N participants | N de chaque au début | Quantité initiale |
| Journée suivante et reconnexion | Quantité restante conservée, aucun rechargement | Dépenser puis comparer au jour suivant |
| Nouvelle partie du même salon | N de chaque renouvelés | Comparaison après retour au lobby |

Consulter les preuves SQL en lecture seule, dans le dépôt plateforme :

```zsh
cd /Users/miick/code/revanche-games-web
npx --yes supabase@2.122.0 db query --linked --file scripts/sql/production-observations.sql
```

Distinguer les dépenses de rôle et les gains de victoire : une différence
finale de solde peut combiner -100 et +50. La réussite du healthcheck n'est
pas une preuve de paiement. Aucun accès de production, compte réel, solde,
achat ou victoire n'a été vérifié pendant la préparation locale.

Ne pas revenir à une ancienne API publique ou à un ancien serveur du jeu après
la migration : le jeu doit utiliser la RPC dédiée et préserver sa file de
transactions. En cas d'incident, garder les protections et les données,
inspecter les tâches/transactions et corriger en avant.

## Références des commandes

- https://cli.github.com/manual/gh_auth_login
- https://vercel.com/docs/cli/deploy
- https://supabase.com/docs/reference/cli/supabase-db-push
- https://docs.railway.com/cli/volume
- https://docs.railway.com/cli/up
