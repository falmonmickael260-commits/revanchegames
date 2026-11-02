# Refonte de l’interface Revanche Games

## Audit et invariants

Base : `26b806b` (BombShift activé, sièges vocaux publiés). Le code des jeux
et leurs hébergements restent distincts de la plateforme.

| Fonction existante | Source conservée |
| --- | --- |
| Comptes, photos et identifiant définitif | Supabase Auth, ProfileEditor, profils et RLS |
| Pièces, Stripe, codes promotionnels, achats | wallet, routes Stripe et règles serveur |
| Invitations directes et invités par code | connecteurs et game_invitations |
| MP et invitations dans les messages | direct_messages, useDirectMessages |
| Groupes et discussions | friend_groups, GroupChatDialog |
| Chat général et notifications | chat_messages, SocialProvider, NotificationCenter |
| Vocal, sièges, microphone et chat de salle | VoiceProvider, LiveKit, ActiveVoiceRoom |
| Jeux persistants et reprise | GameSessionProvider, iframe unique GameViewport |
| Statistiques, matchs et classement | game_stats, recent_matches, leaderboard |
| Paramètres, signalements et assistance | routes et formulaires existants |
| Installation PWA | manifeste, ServiceWorkerRegister et service worker |

L’introduction est retirée de la composition racine. Les cinq entrées mobiles
sont Accueil, Jeux, Communauté, Messages et Profil. Les anciennes routes restent
accessibles depuis ces espaces et depuis la navigation desktop.

## Données

Aucun profil, classement, nombre de joueurs, avis ou promotion inventé.
La popularité repose sur l’agrégat des participations réellement enregistrées ;
sans données, la section est présentée comme une découverte du catalogue.
Les jeux récemment ouverts proviennent uniquement des ouvertures réelles sur
l’appareil. Les matchs et statistiques du compte restent issus de Supabase.
Les packs achetables et leurs prix restent ceux du catalogue Stripe serveur.

## Validation attendue

Compilation, TypeScript, ESLint, tests existants de sécurité/paiements sans
paiement réel, parcours invité/connecté, navigation 320/390/desktop, recherche,
MP/invitations, vocal et jeu, clavier, retour d’arrière-plan et persistance de
l’iframe. Émulation navigateur distinguée des appareils physiques.

## Réalisation

- Accueil autonome : vraie sélection jouable, popularité agrégée, historique local
  et matchs du compte, amis réellement présents, communauté et nouveautés datées.
- Bibliothèque : recherche sans dépendance à la casse ou aux accents, filtres,
  images, favoris, descriptions dépliables et modes factuels. Jeux futurs conservés.
- Navigation desktop dédiée ; cinq destinations mobiles avec non-lus réels.
- Messages : boîte de réception sur les MP existants, groupes conservés, ouverture
  d’une conversation dans l’URL pour le bouton retour, présentation plein écran
  mobile et adaptation au clavier. Le profil du contact reste accessible.
- Profils : identité existante et identifiant inchangés, pièces/amitiés/non-lus,
  statistiques en cartes sans table débordante, historique et achats conservés.
- Boutique : nouvelle présentation des packs, mêmes identifiants/prix/contrôles
  Stripe et portefeuille. Les offres non activées restent explicitement à venir.
- Reprise : relecture sociale, du solde et des MP manqués sans toucher au cycle de
  vie des iframes. Les sources des jeux ne sont pas modifiées.
- Vocal : sièges et contrôles préservés ; recherche ciblée de la salle et attente
  bornée de ses métadonnées, avec les mêmes contrôles d’accès et de SID.
- Retrait de la composition racine de l’introduction et de sa relance dans les
  paramètres ; moins d’animations d’apparition, une seule famille typographique.

## Vérifications effectuées

- 69 tests applicatifs et 16 vérifications PostgreSQL du portefeuille : succès.
- Compilation, TypeScript et ESLint : succès.
- `RUN_PREMIUM_E2E=1 node scripts/test-premium-browser.mjs` : succès sur
  320×568, 390×844, 768×1024 et 1440×960. Parcours invité/connecté, cinq onglets,
  recherche, filtres, MP bidirectionnels, non-lus, groupes, profil, bouton retour,
  champ d’écriture à 430 px, coupure réseau et réconciliation des MP.
- Gel et reprise via CDP : jeu utilisable, même iframe, aucune navigation de
  l’iframe pendant la reprise ; historique fondé sur le jeu réellement ouvert.
- Parcours vocal : huit connexions, sièges/photos, chat isolé, invitation en MP,
  microphones synthétiques, réduction en jeu, retour et expiration : succès.
- Les paiements sont vérifiés avec les tests existants et bloqués dans le
  navigateur de contrôle ; aucune transaction Stripe réelle n’est exécutée.

Captures avant/après : `/private/tmp/revanche-premium-e2e` ; parcours vocal :
`/private/tmp/revanche-voice-e2e`. Les comptes et messages de test sont supprimés
par les scripts dans `finally`. Les données des comptes existants sont conservées.

Les écrans mobiles et le clavier sont validés par émulation Chrome. Aucun test
sur iPhone/Safari ou Android physiques n’est prétendu. Une suppression du processus
par le système n’est pas assimilée à une simple mise en arrière-plan ; la reprise
réseau reste assurée par les mécanismes propres des jeux existants.
