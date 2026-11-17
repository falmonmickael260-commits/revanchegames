# Revanche Games — administration séparée

## État de la livraison

Application Next.js séparée dans `apps/admin`, avec ses propres routes serveur,
cookies de session, interface et adresse de déploiement. Elle réutilise les
comptes et tables du projet central `wrsmtdtzilpckfcjmyri`. Aucune base joueur ni
économie parallèle, aucun jeu de données fictives dans l'interface.

**Le code et les tests locaux ne constituent pas une mise en service distante.**
Les migrations centrales, le propriétaire et les déploiements des adaptateurs de
jeu doivent être vérifiés avant d'annoncer un panneau opérationnel. La connexion
au Dashboard Supabase est demandée dans cette session : aucun SQL n'a été exécuté
sur la production. Les clés Railway sont masquées par la connexion OAuth.

## Architecture examinée

- `revanchegames`, branche Railway `codex/salons-publics`, base de cette livraison.
- Railway : projet `prolific-victory`, environnement `production`, service
  `revanchegames`. Les déploiements GitHub montrent également Vercel ; sa production
  et les previews ne suivent pas nécessairement le même commit que Railway.
- Supabase : comptes `auth.users` / `profiles`, pièces `wallet_accounts` /
  `wallet_ledger`, réservations de rôles, Stripe, REV, cadeaux, résultats,
  signalements, assistance, registre des salons et admissions déjà présents.
- Le client Expo du dépôt `revanche-games` est une autre application. Il n'a pas
  été remplacé ni raccordé artificiellement à ces modifications web.

## Ce qui est implémenté

| Fonction | Comportement du code | Limite de validation |
|---|---|---|
| Connexion équipe | Supabase Auth existant, TOTP et contrôle `aal2` en SQL à chaque lecture/action | Parcours réel avec compte autorisé restant |
| Rôles | Propriétaire, administrateur, modérateur, assistance ; crédit explicitement autorisé | Premier propriétaire à désigner |
| Joueurs | Recherche pseudo/UUID, pagination, fiche, activité, historique, notes et accès aux dossiers liés | Schéma distant à comparer aux migrations |
| Pièces | Ajustement par le ledger existant, motif, verrou du portefeuille, idempotence et audit dans la même transaction | Test avec deux vrais comptes restant |
| Paiements | Lecture des achats ; réconciliation par `fulfillStripeEvent`, relisant Stripe, remboursement et litige inclus | Aucun paiement ni appel Stripe live exécuté |
| Cadeaux / REV | Lecture des transferts, récompenses et classement REV ; économie existante préservée | Configuration complète de la boutique non ajoutée |
| Codes promo | Configuration auditée des paramètres déjà supportés | Les offres Stripe à prix fixes restent définies dans le catalogue existant |
| Modération | Avertissement, restriction tchat, suspension, bannissement et levée ; motif/durée/auteur conservés | Déconnexion et contrôle dans les serveurs natifs encore à compléter |
| Tchat plateforme | Restriction vérifiée par RLS et triggers, y compris les RPC `security definer` | Le tchat propre à chaque jeu est distinct |
| Suspension web | Refus dans le proxy/API/accès au jeu ; iframe ouverte arrêtée lors du contrôle périodique | Ce contrôle navigateur ne remplace pas un contrôle dans chaque serveur de jeu |
| Signalements | Profil/comportement et message du tchat général ; contexte du message copié côté serveur ; capture normalisée en bucket privé ; traitement, attribution, notes | Les messages privés et tchats natifs ne sont pas automatiquement capturés |
| Suivi joueur | `/settings/reports` expose seulement ses dossiers et statuts | Aucune note interne ni preuve d'un tiers exposée |
| Assistance | Tickets existants réutilisés ; réponse publique, statut, attribution et notes privées séparées | Parcours distant joueur/équipe restant |
| Maintenance | Réglage par jeu, vérifié avant ouverture de l'iframe | L'accès direct au site d'un jeu reste sous la responsabilité du serveur natif |
| Communication | Annonces globales ou individuelles réellement lues dans la plateforme | Pas de promesse d'envoi push ou e-mail : ces annonces utilisent le canal interne ajouté |
| Activité | Horodatage serveur via heartbeat authentifié, estimation sur deux minutes | Pas un décompte exact des connexions ; collecte à partir de cette installation |
| Spectateur | Gateway serveur signée, MFA, permission modération et accès audité valable 30 minutes ; vues publiques des moteurs | Adaptateurs à déployer et recette distante à jouer |
| Diagnostic | Registre et date de fraîcheur des salons | Aucun collecteur central d'erreurs raccordé ; indiqué dans le tableau de bord |

La fermeture d'un salon, l'exclusion native d'un participant, l'application des
sanctions aux connexions déjà ouvertes des sept moteurs, l'analyse automatique
des résultats suspects et un outil de distribution hebdomadaire ne sont **pas
terminés**. Aucun bouton ne prétend les effectuer. Les récompenses et leur
idempotence existantes ne sont pas remplacées.

## Sécurité

`admin_query` et `admin_execute` relisent l'identité signée, l'adresse confirmée,
le rôle actif et `aal2`. Aucune autorité ne vient des métadonnées modifiables par
un joueur. Les écritures directes des tables d'administration sont révoquées.
Une révocation de rôle prend effet à la requête suivante sans attendre l'expiration
du jeton. Les méthodes serveur emploient le même JWT utilisateur pour les RPC.

L'ancienne liste `support_admins` est reprise avec le rôle **assistance**,
sans attribuer de droit financier ni de propriété. Les changements d'équipe
synchronisent la liste historique pour les notifications et fonctionnalités
existantes, mais `is_support_admin()` exige désormais le rôle courant et MFA.
Le dernier propriétaire actif ne peut pas être supprimé par le panneau.

Les opérations SQL enregistrent auteur, cible, motif, avant/après et date.
Les requêtes répétées avec le même UUID et les mêmes paramètres n'appliquent
pas deux fois l'action ; un UUID réutilisé avec d'autres paramètres est refusé.
Une réconciliation externe commence avec un audit `pending` puis enregistre
l'état vérifié en base ; un échec reste réessayable. Le ledger Stripe existant
et son calcul d'entitlement empêchent le double crédit même lors de cette reprise.

Les captures sont décodées par Sharp, limitées à 5 Mo et 20 millions de pixels,
réencodées en WebP sans métadonnées et stockées en privé. La preuve d'un message
est copiée dans une table distincte avant son éventuelle suppression. Le reporter
ne lit pas cette table ; les notes et attributions ne sont pas ajoutées aux
tables dont il possède déjà une politique de lecture. Un échec d'upload est
signalé et le même formulaire peut être réessayé sans créer un autre dossier.

Les clés service, Stripe et signatures des jeux restent dans le serveur existant
de la plateforme. Le nouveau service administrateur n'en reçoit aucune copie :
il appelle les routes de contrôle de la plateforme avec le JWT de l'administrateur,
revérifié côté plateforme (compte confirmé, rôle courant et MFA). `server-only`
empêche l'import des modules sensibles dans les clients. Les journaux et
réponses d'erreur n'incluent pas les exceptions Stripe/Supabase ni les requêtes
contenant des secrets. Le panneau refuse les mutations si `ADMIN_SITE_URL` est
absent ou si l'origine ne correspond pas exactement. HTTPS est fourni par
l'hébergeur ; l'adresse séparée ne remplace aucun contrôle d'autorisation.

## Déploiement sans remplacer la plateforme

1. Examiner l'historique des migrations distant et comparer les colonnes attendues.
   Ne pas lancer un `db push --include-all` sur des migrations anciennes inconnues.
2. Appliquer uniquement les quatre migrations centrales de cette livraison, dans
   l'ordre : `20261117000000`, `20261117010000`, `20261117020000`,
   `20261117030000`. Le fichier complet fait autorité pour chaque migration.
3. Dans une session SQL de confiance, initialiser le compte propriétaire **réel** :

   ```sql
   insert into public.admin_members(user_id,role,can_credit,enabled)
   values ('UUID_DU_COMPTE_CONFIRME','owner',true,true)
   on conflict(user_id) do update set role='owner',can_credit=true,enabled=true;
   ```

   Ne pas sélectionner un utilisateur au hasard ou créer un compte joueur en double.
4. Déployer le panneau comme un **nouveau service**, avec le dépôt complet comme
   contexte (le helper de sécurité est partagé depuis `src/lib`).
   Build : `npm ci && npm run build:admin`. Démarrage :
   `npm run start:admin -- --port $PORT`. Ne pas limiter la racine à `apps/admin`.
5. Fournir les variables de `apps/admin/.env.example`, sans inscrire de valeurs
   secrètes dans Git. Sur Railway, seules les références aux deux variables publiques Supabase
   sont nécessaires. Ne pas accorder les clés service-role, Stripe ou des jeux
   au nouveau service : les opérations privilégiées passent par le serveur existant
   indiqué dans `ADMIN_PLATFORM_ORIGIN`.
   `ADMIN_SITE_URL` doit être l'origine HTTPS publique exacte du panneau.
6. Déployer la branche plateforme seulement après les migrations : son proxy
   et ses écrans de jeu refusent l'accès lorsque la vérification n'est pas
   disponible, plutôt que de contourner les contrôles de modération.
7. Déployer les adaptateurs de chaque moteur, ainsi que la migration du projet
   Supabase propre à Kilomax. Ne pas confondre son stockage de parties avec
   le projet central qui conserve les identifiants des joueurs.
8. Faire la recette avec un propriétaire et des comptes de test distincts,
   puis inviter l'équipe depuis le panneau et vérifier chaque rôle avec MFA.

## Dépôts des adaptateurs spectateur

| Jeu | Dépôt | Branche source examinée |
|---|---|---|
| Président | `falmonmickael260-commits/presidente` | `codex/salons-publics` |
| Quiz Master | `falmonmickael260-commits/QuizzMaster` | `codex/direct-invitations` |
| La Meute | `falmonmickael260-commits/Leloupbo` | `codex/godot-prototype` |
| 10000 | `falmonmickael260-commits/lewisdee` | `main` |
| Camouflip | `falmonmickael260-commits/camouflip` | `main` |
| Fortune Empire | `falmonmickael260-commits/Atlasroyal` | `feat/godot-grand-tour` |
| Kilomax | `falmonmickael260-commits/Enroute` | `codex/salons-publics` |

Les jeux solo et les titres dont les salons/comptes ne sont pas encore intégrés
ne sont pas présentés comme compatibles avec ce protocole. Le catalogue réel
reste celui de la plateforme.

Les observateurs ne fournissent jamais une preuve de siège : ils utilisent un
protocole distinct et des messages signés serveur. Ils ne peuvent ni rejoindre
comme joueur, ni envoyer une commande de jeu, ni accéder aux sessions scellées.
Les vues n'incluent pas les mains de Président/Kilomax, rôles et votes privés de
La Meute, options privées du Quiz, positions et déguisements des objets cachés de
Camouflip, ni les secrets/RNG/pioches de Fortune Empire. L'interface restitue les
informations publiques en lecture seule ; elle ne reproduit pas le rendu 3D des jeux.

## Vérifications et recette distante restante

Les tests de cette livraison exécutent de vraies politiques RLS et fonctions
PostgreSQL dans PGlite, avec des données de test isolées. Ils n'utilisent aucun
compte, paiement ou portefeuille de production. Exécuter :

```sh
npm test
npm run typecheck:admin
npm exec -- tsc --noEmit
npm run build
npm run build:admin
git diff --check
```

Le lint global contient un problème antérieur dans `src/lib/use-chat-feed.ts`
(mise à jour synchrone d'état dans un effet) ; ce hook n'a pas été réécrit pour
cette livraison. Un lint ciblé des fichiers administrateur est aussi requis.

À vérifier à distance avant de marquer la livraison terminée : accès non-admin
refusé, rôle retiré en cours de session, MFA et récupération du compte propriétaire,
crédit/réessai visible dans la plateforme, réservations préservées, capture privée
et preuve conservée, réponse d'assistance avec deux utilisateurs, chaque jeu en
observation réelle sans changement du nombre de participants, paiement de test
Stripe avec webhook et réconciliation concurrents, contrôle du bundle navigateur.

Les sauvegardes, la politique de conservation des preuves et la procédure de
récupération TOTP doivent être établies par l'équipe avant une exploitation courante.

## Ressources de revue créées

- Panneau et plateforme : https://github.com/falmonmickael260-commits/revanchegames/pull/7
- Président : https://github.com/falmonmickael260-commits/presidente/pull/1
- Quiz Master : https://github.com/falmonmickael260-commits/QuizzMaster/pull/1
- La Meute : https://github.com/falmonmickael260-commits/Leloupbo/pull/3
- 10000 : https://github.com/falmonmickael260-commits/lewisdee/pull/1
- Camouflip : https://github.com/falmonmickael260-commits/camouflip/pull/1
- Fortune Empire : https://github.com/falmonmickael260-commits/Atlasroyal/pull/4
- Kilomax : https://github.com/falmonmickael260-commits/Enroute/pull/14

Un nouveau service Railway `revanche-admin` est créé dans le projet existant,
avec l'adresse provisoire `https://revanche-admin-production.up.railway.app`.
Les PR restent en brouillon et ne changent pas les branches de production des jeux.

Le contrôle automatique a refusé le transfert des secrets au nouveau service.
L'architecture a ensuite été adaptée pour **ne pas effectuer ce transfert** :
les routes `/api/admin/reconcile` et `/api/admin/observer` restent sur la plateforme
qui possède déjà les secrets. La configuration du panneau n'utilise que les clés
publiques Supabase et les origines des deux applications. Aucune approbation pour
copier des secrets n'est nécessaire avec cette architecture.
