# Revanche Games — paiements et assistance : intégration et audit

## Déploiement effectué le 1er novembre 2026

Cette section remplace les constats précédents pour l'état actuel de production.
À la demande du propriétaire, le contenu de travail de `codex/stripe-checkout`,
y compris les modifications existantes non commitées, a été envoyé directement
au service Railway `revanchegames` du projet `prolific-victory`.

- Déploiement `3bc998bf-e915-48e5-816c-e89b79372937` : **SUCCESS**, instance
  **RUNNING**. Build Turbopack réussi sur Railway. Aucun push ou merge GitHub
  effectué ; la source GitHub du service reste configurée séparément et un futur
  déploiement de `main` pourrait remplacer ce code si la branche n'y est pas intégrée.
- Mode Railway vérifié **live**, clé API live et secret `whsec_` présents.
  `STRIPE_SITE_URL` corrigée en
  `https://revanchegames-production.up.railway.app` avant le déploiement.
- Projet Supabase vérifié : `wrsmtdtzilpckfcjmyri` (`revanche-game-platform`).
  Historique distant contrôlé jusqu'à `20261031080000`, simulation confirmant
  exactement les deux nouvelles migrations. Répétition des deux migrations dans
  une transaction annulée réussie, puis application via `supabase db push`.
  Historique final : `20261101000000` et `20261101010000` enregistrées.
- RLS active sur les huit nouvelles tables ; création des achats réservée à
  `service_role` ; bucket des captures privé. Aucun administrateur ajouté.
- Un dump PostgreSQL complet du schéma n'a pas été possible faute de Docker.
  Un instantané des définitions/métadonnées du schéma et de l'historique, sans
  données joueurs, a été enregistré dans
  `/private/tmp/revanche-before-stripe-schema-metadata.json` avant application.
- Destination Stripe `we_1UWxK34nrWPuGt9KIv44Ub4p` inspectée : URL correcte,
  mode live, active, version `2026-10-28.endive`. Les événements manquants ont
  été ajoutés avec succès, en conservant les sélections existantes : 14 événements
  au total, dont les 13 requis ci-dessous et `payment_intent.succeeded` préexistant.
- Lectures API Stripe Checkout Sessions, Payment Intents, Charges, Refunds et
  Disputes : toutes **HTTP 200**, sans afficher les données retournées. La création
  d'une session live n'a pas été sondée ; sa permission d'écriture reste à vérifier.
- Boutique distante : **HTTP 200**. Webhook distant : requête non signée **400**,
  événement synthétique `customer.created` signé avec le secret configuré **200**,
  signature expirée **400**, événement de test refusé en mode live **400**.
  Les sondes synthétiques hors périmètre n'accèdent pas au portefeuille et ne
  constituent pas une livraison émise par Stripe ni une preuve de paiement complet.

**Aucun débit, remboursement ou paiement de vérification n'a été effectué.**
Le propriétaire a demandé l'activation des paiements réels, mais n'a pas autorisé
un débit de recette. Le parcours Checkout payé, le crédit après une livraison
Stripe réelle et les wallets restent non validés de bout en bout.

## Reprise vérifiée le 1er novembre 2026

Cette section actualise les constats historiques ci-dessous. Branche confirmée :
`codex/stripe-checkout` ; toutes les modifications existantes ont été conservées.

- Accès Railway authentifié confirmé par le CLI. Projet `prolific-victory`
  (`3e5dd7a9-6200-4fe2-a752-88aa2875bbc7`), service `revanchegames`
  (`9ace6bc2-6623-47b9-9325-d7df0ba017d9`), environnement `production` accessible.
  Aucun environnement de préproduction n'est retourné dans la liste du projet.
- Déploiement actif réussi sur `main`, commit
  `6f48eae26d05184e12f1a451b2f685e6047f2c30`, domaine confirmé :
  `revanchegames-production.up.railway.app`.
- Configuration lue avec sortie expurgée : `STRIPE_SECRET_KEY` présente avec
  préfixe **live** ; `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`, `STRIPE_SITE_URL`
  absentes. Les trois variables Supabase requises sont présentes ; cela ne
  valide ni leurs permissions ni les migrations distantes. Aucun secret affiché.
- POST HTTPS distant avec corps `{}` non signé : **404**, sans redirection.
  La route Stripe de cette branche n'est donc pas validée sur ce déploiement.
- Test HTTP réel sur Next.js local, secret factice et `STRIPE_MODE=test` :
  signature absente **400**, signature falsifiée **400**, événement signé
  `customer.created` hors périmètre **200** avec `{"received":true}`.
  Aucun accès financier nécessaire pour ces sondes ; ce test ne constitue pas
  une livraison signée par Stripe ni un paiement de bout en bout.
- `npm test` : **37 tests + 16 contrôles PostgreSQL réussis**.
  `npx tsc --noEmit` et `git diff --check` réussis.
- `npm run build` reste bloqué par Turbopack (`Operation not permitted`, port),
  y compris après relance avec permissions étendues. En revanche,
  **`npx next build --webpack` réussit**, avec génération des 37 pages et de
  `/api/stripe/webhook`.

Aucun déploiement, push, changement de variable, migration distante, débit ou
remboursement effectué pendant cette reprise. La clé live n'a pas été utilisée
pour appeler Stripe. Avant une recette financière distante : préparer un
environnement isolé avec Supabase de test, clé Stripe de test, origine canonique
et secret du webhook de cet environnement. Le paiement sandbox et le crédit
de bout en bout restent à vérifier avant une mise en production.

## État réel de la livraison

Préparation locale dans `/Users/miick/code/revanche-games-web`, branche
`codex/stripe-checkout`. Aucun déploiement, push GitHub, migration distante,
débit réel ni remboursement réel exécuté. La connexion GitHub → Railway pour
l’autodéploiement ne donne pas à cette session l’accès aux comptes de ces services.
Le terminal ne résout pas github.com et son authentification `gh` échoue.
Les outils GitHub/Railway/Stripe ne sont pas accessibles dans cette session.
La clé ajoutée dans Railway n’a donc pas été inspectée.

Ne pas considérer l’environnement de production validé. Les tests automatiques
utilisent un PostgreSQL local PGlite et des réponses Stripe simulées. Les ports
locaux sont également restreints : aucun test navigateur n’a été validé ici.

## Changements réalisés

- Boutique : seuls 1 000 pièces à 119 centimes et 2 000 pièces à 200 centimes
  deviennent achetables une fois la configuration disponible. Les deux anciens
  packs supplémentaires restent affichés mais indisponibles.
- Stripe Checkout hébergé : redirection vers checkout.stripe.com ; aucune saisie
  bancaire dans l’application. Sélection dynamique des méthodes activées dans
  Stripe. Le code n’affiche pas de faux boutons Apple Pay/Google Pay/PayPal.
- Authentification Supabase vérifiée sur le serveur, comptes anonymes refusés,
  adresse e-mail confirmée exigée. Le navigateur n’envoie que le pack et un UUID
  de demande ; ni le prix, ni la quantité, ni le bénéficiaire ne lui font autorité.
- Session Checkout liée à une commande créée AVANT l’appel Stripe ; clé
  d’idempotence persistante et paramètres stables pour les reprises réseau.
  Une nouvelle demande volontaire avec un autre UUID constitue un nouvel achat.
- Limite SQL persistante de cinq nouvelles demandes par joueur et dix minutes.
- Webhook sur corps brut : HMAC-SHA256, comparaison en temps constant, tolérance
  de cinq minutes, prise en charge de plusieurs signatures pendant une rotation.
- Contrôle test/live et recoupement avec les objets actuels Stripe : session,
  PaymentIntent réussi, charge encaissée, EUR, montant, compte et pack.
- Crédit par transaction SQL, verrou de commande avec jeton et expiration,
  verrou du portefeuille, unicité des sessions, PaymentIntents, événements et
  mouvements. Un événement échoué reçoit HTTP 500 pour permettre sa relivraison.
- Les notifications de remboursement/litige relisent leur état actuel dans Stripe,
  plutôt que d’appliquer aveuglément un ancien événement reçu en retard.
- Journal technique `stripe_events` : référence, type, statut, montant remboursé,
  droit aux pièces, variation du portefeuille et variation de dette par événement.
  Pas de suppression silencieuse de transactions et pas de copie du payload Stripe.
- « Mes achats » dans le profil et la boutique : date, pièces du pack, prix,
  moyen de paiement disponible, référence, statut, reçu Stripe, lien d’assistance.
- Paramètres : rubrique « Nous contacter / Assistance et litiges », neuf catégories,
  formulaire, référence facultative, capture, suivi des tickets et réponses privées.
- Administration : `/settings/support/admin`, lecture des dossiers autorisés,
  réponses, statuts reçue/en cours/résolue et historique des changements.
- Notifications internes persistantes de réception, réponse et changement de statut,
  badge dans les paramètres et marquage comme lu. Pas d’e-mail ni de notification
  push d’assistance envoyés par cette implémentation.

Les fichiers des jeux, le protocole multijoueur, les profils, les soldes existants,
les réservations de rôles et leurs triggers ne sont pas modifiés. Les interfaces
ajoutées réutilisent les classes, couleurs et composants de la plateforme.

## Contrôles de sécurité et limites

| Risque | Mesure implémentée |
| --- | --- |
| Prix/bénéficiaire falsifié | Catalogue serveur + contraintes SQL + authentification `getUser()` + recoupement Stripe |
| Faux crédit via l’URL de retour | Le retour affiche un message ; seul le webhook serveur crédite |
| Doubles crédits | Transaction SQL + identifiants uniques + droit net par commande + événements idempotents |
| Événements concurrents ou anciens | Verrou avec jeton couvrant les lectures Stripe et l’écriture atomique |
| CSRF | Origine canonique explicite pour chaque POST de paiement/assistance ; webhook authentifié par signature |
| Injections SQL | Paramètres Supabase/RPC ; aucune construction SQL avec des données utilisateur |
| XSS | Textes rendus par React ; aucune insertion de HTML utilisateur ; SVG et fichiers actifs refusés |
| Capture falsifiée | MIME autorisé + décodage Sharp + limite pixels + réencodage WebP sans métadonnées |
| Fuite d’une capture | Bucket privé, aucun accès direct navigateur, téléchargement authentifié contrôlé par RLS, no-store |
| Consultation de demandes tierces | RLS propriétaire/admin sur tickets/messages/historique ; notifications propres à leur destinataire |
| Auto-promotion admin | Table d’administrateurs distincte, sans écriture navigateur ; métadonnées utilisateur ignorées |
| Spam | Limites SQL tickets/réponses/achats et taille du flux HTTP bornée avant parsing |
| Secrets | Variables serveur uniquement ; pas de secret dans les réponses ni les journaux ; clé réelle refusée par l’auditeur de test |

Les champs bancaires ne sont pas stockés : seul le libellé du moyen de paiement
est conservé, sans numéro de carte, cryptogramme, empreinte ni coordonnées de
facturation. Les utilisateurs doivent masquer les données sensibles des captures.
La réencodage d’image ne remplace pas une détection OCR de données bancaires.

Le contrôle de fraude n’est pas une garantie d’absence de fraude : activer et
contrôler Radar et les règles de risque dans Stripe ; la demande 3D Secure utilise
le mode automatique de Stripe. Les restrictions actuelles empêchent ici la
vérification des réglages du compte, des restrictions IP et de ses permissions.
Une protection réseau anti-abus/WAF reste à configurer selon le trafic réel.

## Variables Railway

| Variable | Rôle et valeur attendue |
| --- | --- |
| `STRIPE_SECRET_KEY` | Clé restreinte **de test** `rk_test_…` pendant la recette ; ajoutée par le propriétaire sur Railway, mais non vérifiée ici |
| `STRIPE_WEBHOOK_SECRET` | Secret `whsec_…` de CET endpoint et du bon mode ; distinct de la clé API |
| `STRIPE_MODE` | `test` pendant la recette. Valeur par défaut : test. Passage à `live` uniquement après validation et autorisation |
| `STRIPE_SITE_URL` | Origine canonique HTTPS, sans chemin, p. ex. `https://revanchegames-production.up.railway.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase ciblé |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique correspondante |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret serveur correspondant, nécessaire au webhook et aux captures privées |

`NEXT_PUBLIC_SITE_URL` déjà utilisé par la plateforme peut servir de repli pour
la protection CSRF de l’assistance ; définir `STRIPE_SITE_URL` pour Checkout.
Aucune clé Stripe publiable ni aucun Price ID n’est nécessaire pour cette
redirection Checkout avec prix serveur inline.

Leur présence effective dans Railway n’a pas pu être lue : la liste ci-dessus
indique les variables requises, pas une liste de manquants prétendument vérifiés.
Ne jamais préfixer une clé Stripe secrète ou de service Supabase par `NEXT_PUBLIC_`.
Ne jamais copier les valeurs dans GitHub, un ticket, un journal ou une conversation.

**Recette isolée obligatoire :** environnement Railway de préproduction + projet
Supabase de test + sandbox Stripe. Mettre Stripe en test sur le portefeuille de
production créditerait des pièces de test dans les vrais comptes. Cette séparation
est un prérequis opérationnel ; le code ne peut pas deviner quel projet contient
les vrais comptes.

## URL et événements du webhook

Chemin implémenté : `POST /api/stripe/webhook`.

Si le domaine Railway documenté dans le dépôt est toujours le domaine canonique,
l’URL exacte est :

```text
https://revanchegames-production.up.railway.app/api/stripe/webhook
```

L’activité actuelle de ce domaine n’a pas pu être confirmée. Si Railway utilise
un autre domaine, prendre **la valeur de STRIPE_SITE_URL** et lui ajouter
`/api/stripe/webhook`. Ne pas enregistrer un endpoint sur une route non déployée.

Créer dans Stripe Workbench une destination pour **Votre compte**, événements
**Snapshot**, version API `2026-10-28.endive`, avec :

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
payment_intent.payment_failed
payment_intent.canceled
charge.refunded
refund.created
refund.updated
refund.failed
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
```

Enregistrer le secret dans `STRIPE_WEBHOOK_SECRET` puis redéployer. Le secret de
`stripe listen` pour un test local n’est pas celui du webhook du Dashboard.
Vérifier TLS, absence de redirection, réponse 400 à une fausse signature, réponse
2xx après une vraie livraison traitée et reprise après une erreur transitoire.
Ne pas protéger CET endpoint par un écran de connexion ou une authentification HTTP.

## Permissions de la clé Stripe

Les permissions **actuelles** sont inconnues. Pour les appels explicites du code :

| Ressource | Permission requise |
| --- | --- |
| Checkout Sessions | Écriture, incluant lecture, création et expiration de la session de validation |
| Payment Intents | Lecture |
| Charges | Lecture |
| Refunds | Lecture |
| Disputes | Lecture |

Les produits/prix sont créés inline par Checkout : le test de création de session
ci-dessous vérifie aussi ce chemin avec la clé restreinte. Si Stripe refuse une
permission dépendante, identifier la ressource dans Workbench et n’accorder que
celle-ci. Les permissions dépendantes n’ont pas été vérifiées avec la clé réelle.
Ne pas accorder tout Stripe pour contourner un HTTP 403.

Les remboursements sont exécutés **dans le Dashboard Stripe par un opérateur**,
puis synchronisés automatiquement. Aucune permission d’écriture Refunds n’est
nécessaire à l’application pour ce parcours. Elle le deviendrait si une API de
remboursement serveur était ajoutée ultérieurement. La création manuelle du webhook
dans le Dashboard n’exige pas Webhook Endpoints Write pour la clé de l’application.
Ne pas accorder Payouts, Transfers, Balance ou gestion des clés.

Audit sans affichage de données clients, depuis un environnement disposant de la
clé de test dans son gestionnaire de secrets :

```sh
node scripts/check-stripe-permissions.mjs
node scripts/check-stripe-permissions.mjs --create-test-session
```

Le deuxième crée puis expire une session **de test non payée**, sans confirmer de
PaymentIntent ni effectuer de débit. Il ne crédite aucune pièce et n’intègre pas
de `order_id` exploitable par le webhook. Le script refuse toute clé live.
Un HTTP 403 indique une permission insuffisante ; une réussite de lecture seule
ne prouve pas les autorisations d’écriture.

## Mise en place de Supabase et de l’administration

Vérifier les migrations déjà appliquées au projet existant, sauvegarder et tester
sur une copie avant toute migration de production. Les deux nouvelles migrations :

```text
20261101000000_stripe_shop.sql
20261101010000_support_tickets.sql
```

La première dépend du portefeuille et de la migration des réservations différées
déjà présents dans le dépôt. La seconde crée aussi le bucket privé des captures.
Ne pas appliquer aveuglément toutes les anciennes migrations en attente à un
projet dont l’historique n’a pas été contrôlé.

Un opérateur de confiance doit autoriser les administrateurs existants via le SQL
Editor, avec leur vrai UUID de compte (aucun administrateur inventé ou promu ici) :

```sql
insert into public.support_admins(user_id)
values ('UUID_DU_COMPTE_ADMIN_CONFIRME') on conflict do nothing;
```

Se connecter ensuite avec ce compte et ouvrir `/settings/support/admin`. Les
notifications sont persistées dans `support_notifications`, visibles dans les
paramètres et la page d’assistance. Vérifier les opérations Storage avec un vrai
fichier et deux comptes distincts. Un contrôle Supabase de stockage distant n’a
pas été réalisé dans cette session.

## Remboursements, contestations et comptabilité

1. Vérifier le ticket, le compte, le mode test/live et le PaymentIntent dans Stripe.
2. Émettre le remboursement total ou partiel depuis le Dashboard du bon mode.
3. Attendre le webhook et vérifier le statut dans Mes achats et le journal.
4. Répondre au joueur et changer le statut du ticket. Cette action ne rembourse rien.

Seuls les remboursements `succeeded` réduisent les droits. Les montants cumulés
sont convertis en retrait proportionnel, arrondi vers le haut. Les remboursements
pending/failed ne retirent pas de pièces. Un litige ouvert/perdu suspend le droit
au pack ; un litige gagné restaure le droit net des remboursements déjà réussis.
Un doublon ne déduit ni ne restitue deux fois.

Si des pièces ont déjà été dépensées, le serveur retire les pièces disponibles
sans toucher aux pièces réservées par un jeu. Le reliquat est inscrit dans
`stripe_wallet_debts`, sans solde négatif, et absorbé par les futurs crédits
d’achats Stripe. Mes achats le signale au joueur. Les récompenses de jeu et les
codes promotionnels ne sont pas modifiés ni automatiquement saisis pour apurer
cette dette. Une intervention de l’équipe peut rester nécessaire ; ne pas
présenter le reliquat comme déjà récupéré. Chaque variation est journalisée.

Pour les échecs définitifs de livraison, surveiller Workbench et relivrer les
événements après correction. Pas de tâche automatique de réconciliation périodique
ni de collecte de dette sur les autres fonctionnalités dans cette livraison.

## Vérification des moyens de paiement et HTTPS

Checkout est hébergé sur Stripe. Le domaine marchand sert aux retours et au
webhook et doit disposer d’un certificat HTTPS valide. La procédure
d’enregistrement de domaines Stripe concerne Elements et Checkout embarqué ; ne
pas ajouter une route de vérification Apple Pay à l’aveugle pour ce Checkout hébergé.

Activer les cartes, Apple Pay/Google Pay et PayPal admissible dans les paramètres
des moyens de paiement du bon compte et de la bonne sandbox. Stripe décide de
leur affichage selon le client, l’appareil, le navigateur, la devise et l’éligibilité.
L’absence d’un wallet dans un navigateur incompatible est normale. Un affichage
correct ne prouve pas à lui seul qu’un paiement complet fonctionne.

Apple Pay, Google Pay, PayPal, le certificat du domaine réel et les réglages du
compte Stripe sont **non vérifiés**. Réaliser chaque parcours en environnement de
test compatible puis vérifier la charge, le webhook et le crédit. Ne pas faire
de débit live pour démontrer un wallet sans autorisation distincte.

## Recette : preuves et opérations restantes

Commandes locales : `npm test`, `npx tsc --noEmit`, lint ciblé des fichiers ajoutés,
`npm run lint` pour connaître aussi l’état antérieur du dépôt, `npm run build`.

Résultat effectivement constaté le 1er novembre 2026 :

- `npm test` : **37 tests réussis, aucun échec**, puis **16 contrôles du portefeuille réussis**.
  Cela inclut cinq tests du gestionnaire de requêtes webhook : corps brut UTF-8,
  signature absente/falsifiée/expirée, modes test/live, schéma, taille, événement
  ignoré et réponse 500 réessayable si le traitement financier échoue. Ces tests
  ne constituent pas une livraison Stripe distante ni une requête HTTPS à Railway.
- `npx tsc --noEmit` : réussi.
- ESLint ciblé sur les fichiers ajoutés/modifiés de paiement et assistance : réussi.
- `git diff --check` : réussi.
- `npm run lint` global : échoue sur une erreur préexistante de mise à jour d’état
  dans `src/lib/use-chat-feed.ts:88`, avec deux avertissements préexistants
  (dépendances du même hook et rechargement volontaire dans les paramètres).
  Le chat n’a pas été modifié pour contourner cette règle.
- `npm run build` : les déclarations de runtime incompatibles avec Cache Components
  ont été corrigées. Le build reste bloqué par Turbopack qui tente d’ouvrir un port
  interdit dans cet environnement (`Operation not permitted`).
- Essai alternatif `next build --webpack` : bloqué par l’accès réseau aux polices
  existantes `Chakra Petch` et `Manrope` sur fonts.googleapis.com (`ENOTFOUND`).
  Les polices et le design ne sont pas remplacés pour masquer cette limitation.
- Audit de la vraie clé Stripe : non exécuté ; le script refuse de fonctionner
  sans clé de test. Son comportement et son refus des clés live sont testés avec
  des réponses simulées, pas avec le compte Stripe de production.

Le build complet et les parcours HTTP/navigateur restent donc à valider dans un
environnement autorisant les ports et les domaines requis avant déploiement.

| Scénario demandé | État de validation |
| --- | --- |
| Paiement réussi | Réponses Stripe simulées + transaction PostgreSQL réelle ; Checkout distant restant |
| Refus / paiement échoué | Aucun crédit sans `paid` + `succeeded` ; carte refusée réelle en sandbox restante |
| Annulation / session expirée | Session non payée sans crédit ; parcours navigateur restant |
| Interruption réseau | Erreur Stripe sans acquittement ni crédit ; reprise testée ; navigateur restant |
| Retour après paiement | Retour sans crédit côté client ; affichage réel non testé |
| Webhook répété/concurrent | Testé localement ; doublons sans double crédit |
| Modification du montant | Tests serveur et contraintes SQL réussis |
| Achat pour un tiers | Compte, métadonnées et ownership vérifiés par les tests |
| Remboursement partiel/total, pending/failed | Testé localement, y compris pièces dépensées |
| Litige gagné | Retrait puis restitution du droit net testés localement |
| Apple Pay compatible | Non testé sur appareil compatible |
| Google Pay compatible | Non testé sur appareil compatible |
| PayPal éligible | Non vérifié sur le compte et non testé de bout en bout |
| Mobile/tablette/ordinateur | Composants adaptatifs ajoutés ; parcours visuels réels non testés |
| Tickets privés/admin et notifications | RLS/RPC testées en PostgreSQL ; service distant restant |
| Capture falsifiée/active/volumineuse | Tests décodage, formats, taille et métadonnées réussis |

Pour la recette Stripe distante, utiliser les cartes officielles de test (Visa et
Mastercard, refus, 3D Secure), deux comptes de test et un portefeuille isolé.
Payer une vraie session créée depuis la boutique ; un événement CLI générique
sans commande ne constitue pas un test de crédit de bout en bout.

## Références officielles consultées

- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/keys/restricted-api-keys
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout/payment-methods
- https://docs.stripe.com/payments/payment-methods/pmd-registration
- https://docs.stripe.com/payments/paypal
- https://docs.stripe.com/testing
- https://docs.stripe.com/refunds
