# Salons vocaux éphémères

La page `/voice` permet à un compte Revanche Games de créer une salle et d’en
devenir l’hôte. Elle est accessible dans la barre latérale et par l’onglet
**Salons**, placé après Accueil et Jeux dans la barre du bas. Amis, Chat et Profil
restent accessibles. Les six libellés mobiles sont courts.

Les nouvelles salles sont publiques par défaut : tous les membres inscrits
peuvent les découvrir et les rejoindre sans code. Le créateur peut choisir
**Mes amis uniquement** avant la création. Les anciennes salles restent privées.
Les comptes anonymes sont refusés et un blocage avec l’hôte interdit l’accès.

Les salles accueillent huit personnes. Le micro est coupé à l’entrée ; son
activation nécessite une action et l’autorisation du navigateur. Les participants
voient leurs photos de profil, les places libres, la couronne de l’hôte, les
micros coupés et un halo autour des personnes qui parlent. Les contrôles flottants
restent accessibles pendant la navigation et les jeux. Quitter coupe le micro
et déconnecte l’audio. Une actualisation complète nécessite de rejoindre à nouveau.

Dans une salle, la vue est bornée à la hauteur disponible entre l’en-tête et
la navigation mobile. Le chat et les commandes restent visibles ; seul l’historique
des messages défile. **Participants · N** ouvre un panneau compact avec les
photos, noms, hôte et état du micro : les huit personnes tiennent dans une grille
de deux colonnes. Les invitations et les autres salons ont leurs propres panneaux,
sans allonger la page. Les panneaux gardent le focus, se ferment avec Échap et
rendent le focus au bouton d’ouverture. Le clavier mobile est pris en compte via
`visualViewport` par le hook existant `useKeyboardInset`.

Pendant un jeu, le vocal est réduit par défaut dans la barre de jeu existante,
en haut : il n’occupe aucune place dans la zone de jeu. Son bouton affiche le
nombre de participants et l’état du micro. Un appui ouvre les commandes sous
la barre ; Réduire ou Échap les replie sans déconnecter l’audio. Le retour au
salon et Quitter restent disponibles dans ces commandes. Sur les autres pages,
le panneau flottant conserve aussi un bouton de réduction.

Une salle sans participant disparaît après 60 secondes : ce délai permet une
reconnexion après une coupure. Le créateur reste identifié comme hôte tant que
la salle existe ; son départ ne coupe pas la conversation des autres membres.
Cette première version ne propose ni enregistrement ni modération par l’hôte.

Chaque salle possède son propre chat éphémère : seuls ses participants présents
reçoivent les messages. Il conserve les 100 derniers messages reçus pendant la
connexion, y compris pendant la navigation. Quitter ou actualiser efface cet
historique local ; les personnes qui rejoignent ne récupèrent pas les anciens
messages. Aucun historique du chat vocal n’est stocké dans le chat général.

**Inviter des amis** envoie un véritable message privé avec un bouton Rejoindre,
également proposé dans une notification interne en temps réel. Les invitations
expirent après 15 minutes et sont liées au SID de la salle, pour éviter de rejoindre
une nouvelle instance à partir d’une ancienne invitation. Dans une salle privée,
seul l’hôte invite ; dans une salle publique, chaque participant peut inviter ses
propres amis. Les invitations sont limitées à une par destinataire/instance toutes
les 30 secondes et 20 par minute par expéditeur.

## Configuration

Variables **serveur uniquement** sur le service plateforme :

```
LIVEKIT_URL=wss://<serveur>
LIVEKIT_API_KEY=<clé serveur>
LIVEKIT_API_SECRET=<secret serveur>
```

Le serveur LiveKit déjà utilisé par La Meute peut être partagé. Les nouvelles
salles utilisent exclusivement `rg-social-<uuid hôte>` et une métadonnée de type
`rg-social-voice-v1`. Les salles vocales des jeux ne sont ni listées, ni modifiées,
ni accessibles par cette API. Aucun changement des dépôts de jeux ou de leurs
règles n’est nécessaire. Aucun abonnement externe supplémentaire n’est créé.

## Sécurité

`GET /api/voice` et `POST /api/voice` vérifient Supabase Auth et le profil.
Les relations d’amitié sont lues avec le client de session soumis à RLS.
Chaque admission vérifie à nouveau la visibilité, les blocages et la capacité ; LiveKit impose
également la limite de huit participants. Un seul salon par créateur peut
exister simultanément, grâce à son identifiant déterministe.

Le jeton est signé sur le serveur, dure 60 secondes pour l’admission et ne
permet la publication du microphone, l’écoute et les données du chat de cette salle précise.
Il n’autorise pas les caméras, l’administration, la création ou
l’énumération des salles. Les clés serveur ne sont jamais envoyées au navigateur.
Les requêtes d’admission sont protégées contre le CSRF et leur corps est borné.
Retirer un ami empêche de nouvelles admissions à une salle privée ; cela ne coupe pas une connexion
vocale déjà établie. L’audio est transporté par LiveKit et son infrastructure
WebRTC/TURN, indépendamment de Supabase Realtime.

Le chat utilise les paquets fiables LiveKit sur un topic dédié. Le pseudo et
l’avatar sont tirés du participant authentifié et des métadonnées signées par
le serveur, jamais du texte reçu. Les messages sont bornés à 500 caractères,
les paquets à 4096 octets et leur réception à deux par seconde par participant.
Les métadonnées des participants ne sont pas modifiables par les clients.

La migration `20261101050000_voice_private_invitations.sql` ajoute trois champs
optionnels aux MP et une fonction réservée au service serveur. L’API vérifie
la présence effective de l’expéditeur dans LiveKit avant de l’appeler. La RLS
des MP continue à limiter la lecture aux deux participants. L’admission par
invitation vérifie le destinataire, l’amitié actuelle, l’expiration, le SID,
la visibilité et les places disponibles ; une copie du texte ne crée aucun bouton.

Références : [jetons et permissions LiveKit](https://docs.livekit.io/frontends/reference/tokens-grants/),
[SDK serveur officiel](https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk),
[paquets de données LiveKit](https://docs.livekit.io/transport/data/packets/).

## Validation

`npm test` vérifie notamment l’isolation des espaces vocaux et la restriction
aux amis. TypeScript et ESLint vérifient les nouveaux composants et routes.

Le test navigateur opt-in `RUN_VOICE_E2E=1 node scripts/test-voice-browser.mjs`
utilise des comptes Supabase temporaires et le serveur vocal existant. Il teste
l’hôte, un ami en viewport tactile, le refus d’un tiers et d’un anonyme, le CSRF,
les permissions du jeton, les microphones synthétiques dans les deux sens, le
mute, la navigation, la reprise et la suppression automatique de la salle vide.
Il vérifie également les photos réelles, les MP et le bouton rejoindre, les
restrictions des invitations, le chat bidirectionnel, l’isolation entre deux
salles, la découverte publique et l’absence de débordement sur un écran de 320 px.
Il nettoie ses propres comptes et ses seules salles en fin de test et bloque les
requêtes Stripe. Le journal local est dans `/private/tmp/revanche-voice-e2e`.
Cette émulation Chrome ne remplace pas une validation sur iPhone/Safari et
Android physiques ; le maintien du micro en arrière-plan dépend du système.
