# Panneau administrateur Revanche Games

Adresse : `/admin`. Chaque associé utilise son propre compte habituel et confirmé.
Les deux comptes disposent des mêmes droits. Aucun mot de passe partagé ni nouvelle
clé publique ne sont nécessaires. Le lien figure dans Paramètres pour les administrateurs.

## Fonctions

- Vue d’ensemble : profils inscrits (y compris les profils invités), parties enregistrées,
  demandes d’assistance non résolues, nombre d’administrateurs.
- Recherche paginée des joueurs par pseudonyme, état du compte et lien vers le profil.
- Suspension et réactivation avec confirmation et motif obligatoire. Les comptes
  administrateurs, y compris celui de l’opérateur, sont protégés.
- Modération des 50 plus anciens signalements ouverts/en cours : examiner, résoudre,
  classer sans suite. Une fois traités, les suivants deviennent visibles à l’actualisation.
- Journal des 20 dernières actions sur les comptes et les signalements : auteur, cible,
  motif, date. L’action et l’écriture du journal s’exécutent dans une transaction.
- Accès aux outils existants : assistance, pièces jointes, suivi des demandes de paiement,
  catalogue et visuels des cadeaux, économie et historique de cadeaux.

Les remboursements bancaires se réalisent dans Stripe ; le panneau existant suit les
litiges et demandes, il ne déclenche pas de remboursement. Ce changement n’ajoute pas
la modification des soldes, des résultats ou du code des jeux.

## Installation sur la plateforme existante

1. Appliquer les migrations du dépôt, notamment
   `supabase/migrations/20261114100000_platform_admin.sql`, à la base Supabase utilisée
   par la plateforme. Ne pas appliquer uniquement cette migration à une base vide.
2. Vérifier que les deux associés ont créé et confirmé leur compte Revanche Games.
3. Dans l’éditeur SQL Supabase, exécuter `scripts/admin/provision-two-admins.sql`
   après remplacement des deux adresses. Le script échoue sans changement si un compte
   est introuvable, si les deux comptes sont identiques ou si un autre administrateur
   existe déjà. Aucun accès n’est accordé automatiquement par le nom ou l’adresse.
4. Conserver les variables serveur déjà utilisées : `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` et
   `NEXT_PUBLIC_SITE_URL` (ou `STRIPE_SITE_URL`) correspondant à l’origine réelle.
   La clé service doit rester uniquement côté serveur.
5. Intégrer le changement à la branche de production et laisser l’hébergement habituel
   construire le site. Ouvrir `/admin` et vérifier les accès avec chaque compte.

Les membres sont stockés dans `support_admins`, la même liste de confiance que les
outils d’assistance et de cadeaux. Les utilisateurs ne peuvent ni écrire dans cette
liste ni appeler la fonction d’administration. La fonction d’action, réservée au rôle
serveur, revérifie les droits et protège les comptes administrateurs.

La suspension interdit les nouvelles connexions et supprime les sessions de renouvellement
Supabase. Un jeton d’accès déjà émis peut conserver ses droits jusqu’à son expiration,
notamment auprès des jeux/services externes ; la suspension ne ferme pas une partie ou
une connexion vocale déjà ouverte. La réactivation nécessite une nouvelle connexion.
Les opérations sur `auth.users` et `auth.sessions` utilisent le schéma Supabase Auth
standard : valider d’abord la migration en préproduction si ce schéma a été personnalisé.

## Vérifications

```sh
npm ci
npx next typegen
npx tsc --noEmit
node --import tsx --test test/platform-admin.test.ts
npm test
```

Le test PostgreSQL vérifie les droits des rôles, la protection des deux administrateurs,
la suspension, la suppression des sessions, la réactivation, le traitement des signalements
et l’annulation complète de l’action si le journal ne peut pas être écrit.
