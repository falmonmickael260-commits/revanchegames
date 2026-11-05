# Activation de BacRush

BacRush est ajouté au catalogue Revanche Games depuis son dépôt séparé
`falmonmickael260-commits/bacrush`. L'URL répond HTTP 200 et son endpoint de
santé `/api/health` répond `{"ok":true,"rooms":0}`. Le service actuellement
vérifié est hébergé sur Render à `https://bacrush.onrender.com/` ; le dépôt
contient aussi une configuration Railway, mais aucun domaine Railway n'a été
fourni ou vérifié pour ce jeu.

Les salons et codes à quatre caractères restent gérés par BacRush. Le connecteur
d'invitations directes Revanche Games n'est pas encore implémenté dans ce jeu ;
son bouton d'invitation plateforme est donc masqué, sans désactiver les salons,
le jeu multijoueur ni ses codes de salon.

La migration `20261106020000_activate_bacrush.sql` ajoute le slug au catalogue
central utilisé par les résultats et les invitations.
