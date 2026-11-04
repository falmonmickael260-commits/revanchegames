# Refonte premium — branche `codex/premium-refonte`

## Référence inspectée

Le chemin fourni `~/Downloads/Revanche_Games_Refonte_Reference.png` n'existe pas sur ce Mac. La maquette présente dans Téléchargements est `Refonte complète de Revanche Games.png`. Elle a été ouverte et analysée : six écrans montrent l'accueil, les jeux, les salons vocaux, la communauté, les messages et le profil. Sa direction repose sur un fond bleu nuit, des accents rouges mesurés, des touches dorées, de grandes illustrations et une navigation mobile compacte.

## Fonctionnalités constatées dans le dépôt

- Accueil : niveau et XP réels, jeux récents, popularité réelle, amis en ligne, solde, notifications.
- Jeux : catalogue, filtres, favoris, sessions conservées et ouverture immersive hors navigation mobile.
- Social : amis, groupes, invitations, messages privés, présence et profils d'amis.
- Vocal : création, salons publics ou réservés aux amis, code à quatre chiffres, invitations, participants et chat de salle.
- Profil : avatar, pseudo, identifiant fixe, signature, statistiques, historique et réglages.
- Autres : Stripe, portefeuille, PWA, support et pages d'administration restent dans les circuits existants.
- Aucun fil de publications ni événement actif n'a été identifié : aucun contenu fictif n'a été ajouté.

## Implémentation sur cette branche

- Thème sombre bleu nuit, rouge et or, avec le choix clair/foncé conservé.
- Bannière d'accueil issue d'une véritable jaquette de jeu, et trois jeux mis à l'honneur dans la bibliothèque.
- Présentation distincte des six espaces, y compris navigation mobile et salons existants.
- Page profil reconstruite autour d'une couverture illustrée, d'un grand avatar superposé, d'un bilan de joueur, d'un niveau intégré, de raccourcis et d'une liste de jeux avec progression réelle. Couverture indépendante de l'avatar, avec recadrage en aperçu, modération et publication côté serveur ; affichage sur le profil personnel et celui des amis.
- Migration Supabase pour la colonne `banner_url`, le bucket de couvertures et la lecture réservée aux amis.

## Vérifications et limites

Le build de production, ESLint, les 69 tests applicatifs et les 16 tests PostgreSQL du portefeuille passent. Le scénario navigateur passe sur 320, 390, 768 et 1440 px, avec deux comptes temporaires, messages, clavier réduit, retour réseau, jeu BombShift repris après gel et vérification du recadrage de bannière avec envoi simulé. Le vocal a été vérifié avec huit participants, chat, micros synthétiques, invitation privée, barre réduite en jeu et suppression de la salle vide. Les invitations sans code et l'accès invité par code ont été contrôlés pour Président, La Meute, Quiz Master et 10000. Aucun checkout Stripe n'a été appelé.

La migration de couverture doit être appliquée dans l'environnement cible avant qu'un utilisateur puisse enregistrer une bannière réelle. L'envoi réel a donc été simulé dans le contrôle navigateur. Les appareils iOS et Android physiques n'ont pas été testés ; les tailles et gestes mobiles ont été émulés dans Chrome.

La branche n'est pas déployée en production. Une validation visuelle de la maquette et des parcours sur appareil est requise avant fusion et déploiement.
