# Activation de BombShift

Le catalogue active `/play/bombshift` vers le service Railway déjà existant :
`https://bombshift-production-81b4.up.railway.app/`.

Ce service du projet `heartfelt-gratitude` correspond au dépôt
`falmonmickael260-commits/bombshift`, branche `main`, commit `20cb8e8`.
Le jeu déployé propose neuf niveaux et trois boss en **solo**. La fiche indique
donc « 1 joueur » et `supportsRooms: false` masque les invitations à un salon
multijoueur pendant ce jeu. Les invitations génériques à ouvrir le même jeu
restent possibles. Les autres jeux conservent leur comportement.

La migration `20261102000000_activate_bombshift.sql` ajoute uniquement son nom
au catalogue central, pour la présence et les profils. Aucun code de BombShift,
serveur existant ou mécanisme de portefeuille n’a été modifié.

Validation : service HTTP 200 sans blocage d’iframe, compilation plateforme,
TypeScript et ESLint ; ouverture depuis la bibliothèque, menu, neuf cartes,
démarrage du premier niveau et rendu Phaser dans l’iframe sur ordinateur et
viewport tactile 390 × 844. Aucun paiement effectué. Captures de contrôle dans
`/private/tmp/revanche-bombshift-test`.
