# Activation de BombShift

Le catalogue active `/play/bombshift` vers le service Railway déjà existant :
`https://bombshift-production-81b4.up.railway.app/`.

Ce service du projet `heartfelt-gratitude` correspond au dépôt
`falmonmickael260-commits/bombshift`, branche `main`, commit `20cb8e8`.
Le jeu déployé propose neuf niveaux et trois boss en **solo**. La fiche indique
donc « 1 joueur » et `supportsRooms: false` masque les invitations à un salon
multijoueur pendant ce jeu. Les invitations génériques à ouvrir le même jeu
restent possibles. Les autres jeux conservent leur comportement.

La migration `20261102000000_activate_bombshift.sql` ajoute son nom au catalogue
central. La sauvegarde de progression liée au compte est ajoutée séparément par
`20261106010000_bombshift_account_progress.sql` et la route
`/api/bombshift/progress`. Le jeu conserve aussi sa sauvegarde locale : à
l'ouverture depuis un compte Revanche Games, la progression locale et celle du
compte sont fusionnées sans perte, puis les changements sont synchronisés via
la page hôte. Les données ne donnent ni XP ni pièces. La table n'est accessible
qu'au serveur avec le rôle service, et la route utilise la session Supabase de
l'utilisateur.

Pour activer cette synchronisation, appliquer la migration
`20261106010000_bombshift_account_progress.sql` à Supabase, puis déployer la
plateforme et le dépôt BombShift modifié sur Railway. Si la migration n'est pas
encore appliquée, le jeu continue à sauvegarder localement et affiche que la
synchronisation du compte est indisponible.

Validation : service HTTP 200 sans blocage d’iframe, compilation plateforme,
TypeScript et ESLint ; ouverture depuis la bibliothèque, menu, neuf cartes,
démarrage du premier niveau et rendu Phaser dans l’iframe sur ordinateur et
viewport tactile 390 × 844. Aucun paiement effectué. Captures de contrôle dans
`/private/tmp/revanche-bombshift-test`.
