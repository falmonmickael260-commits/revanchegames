# Loto Revanche

Le [projet Godot Loto Revanche](https://github.com/falmonmickael260-commits/Lotorevanche) tourne dans un service Web séparé. Le catalogue utilise sa vignette 1 200 × 750 et propose le jeu dès que `NEXT_PUBLIC_GAME_URL_LOTO` est défini au build.

## Intégration

1. Appliquer `20261119162500_loto_wallet.sql` sur l’environnement à valider.
2. Définir un secret `LOTO_WALLET_SECRET` côté plateforme et le même côté serveur Loto. Il reste exclusivement côté serveur.
3. Démarrer le conteneur Loto avec `LOTO_REQUIRE_WALLET=1` et `LOTO_WALLET_URL=https://<plateforme>/api/game/loto/wallet`. Utiliser une instance par environnement. Le conteneur expose le client Web et le WebSocket sur le même domaine HTTPS.
4. Définir `NEXT_PUBLIC_GAME_URL_LOTO=https://<service-loto>/` puis reconstruire la plateforme de l’environnement. Le lancement utilise le jeton de compte Revanche Games standard.

## Validation

`node scripts/test-loto-wallet.mjs` vérifie la migration sur une base locale isolée. Pour le test d’intégration, utiliser deux comptes autorisés dans l’environnement de test. Vérifier le prix choisi par l’hôte, l’achat de plusieurs cartons, leur débit dans le journal, un départ avec remboursement et le règlement après la dernière réclamation.

Les débits, crédits et remboursements ont une référence unique dans `wallet_ledger`. La retenue de la plateforme est enregistrée dans `loto_rounds.retained_coins`. Le serveur récupère les manches ouvertes ou lancées qui expirent après un redémarrage. Garder le service actif pour exécuter ce remboursement régulièrement.
