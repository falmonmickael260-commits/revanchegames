# Salons vocaux éphémères

La page `/voice` permet à un compte Revanche Games de créer une salle et d’en
devenir l’hôte. Elle est accessible dans la barre latérale et depuis **Amis**
sur mobile. Par défaut, les amis actuels de l’hôte voient la salle et peuvent
la rejoindre sans code. Un compte invité ou un autre membre ne peut pas y entrer.

Les salles accueillent huit personnes. Le micro est coupé à l’entrée ; son
activation nécessite une action et l’autorisation du navigateur. Les participants
voient les micros coupés et les personnes qui parlent. Les contrôles flottants
restent accessibles pendant la navigation et les jeux. Quitter coupe le micro
et déconnecte l’audio. Une actualisation complète nécessite de rejoindre à nouveau.

Une salle sans participant disparaît après 60 secondes : ce délai permet une
reconnexion après une coupure. Le créateur reste identifié comme hôte tant que
la salle existe ; son départ ne coupe pas la conversation des autres membres.
Cette première version ne propose ni enregistrement ni modération par l’hôte.

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
Chaque admission vérifie à nouveau l’amitié et la capacité ; LiveKit impose
également la limite de huit participants. Un seul salon par créateur peut
exister simultanément, grâce à son identifiant déterministe.

Le jeton est signé sur le serveur, dure 60 secondes pour l’admission et ne
permet que la publication du microphone et l’écoute de cette salle précise.
Il n’autorise pas les caméras, les données, l’administration, la création ou
l’énumération des salles. Les clés serveur ne sont jamais envoyées au navigateur.
Les requêtes d’admission sont protégées contre le CSRF et leur corps est borné.
Retirer un ami empêche de nouvelles admissions ; cela ne coupe pas une connexion
vocale déjà établie. L’audio est transporté par LiveKit et son infrastructure
WebRTC/TURN, indépendamment de Supabase Realtime.

Références : [jetons et permissions LiveKit](https://docs.livekit.io/frontends/reference/tokens-grants/),
[SDK serveur officiel](https://github.com/livekit/node-sdks/tree/main/packages/livekit-server-sdk).

## Validation

`npm test` vérifie notamment l’isolation des espaces vocaux et la restriction
aux amis. TypeScript et ESLint vérifient les nouveaux composants et routes.

Le test navigateur opt-in `RUN_VOICE_E2E=1 node scripts/test-voice-browser.mjs`
utilise des comptes Supabase temporaires et le serveur vocal existant. Il teste
l’hôte, un ami en viewport tactile, le refus d’un tiers et d’un anonyme, le CSRF,
les permissions du jeton, les microphones synthétiques dans les deux sens, le
mute, la navigation, la reprise et la suppression automatique de la salle vide.
Il nettoie ses propres comptes et sa seule salle en fin de test et bloque les
requêtes Stripe. Le journal local est dans `/private/tmp/revanche-voice-e2e`.
Cette émulation Chrome ne remplace pas une validation sur iPhone/Safari et
Android physiques ; le maintien du micro en arrière-plan dépend du système.
