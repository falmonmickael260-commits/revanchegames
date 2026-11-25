# Revanche Games — sécurité HTTP

## Protections ajoutées
- HSTS sur la plateforme en production (sans includeSubDomains ni preload).
- Protection anti-clickjacking par frame-ancestors et X-Frame-Options.
- Protection MIME nosniff, restriction des fonctions matérielles inutilisées.
- CSP de base appliquée : base-uri, object-src, frame-ancestors et mise à niveau HTTPS.
- CSP plus stricte en observation locale (Report-Only), pas encore appliquée aux scripts.
- Désactivation de X-Powered-By.

## Vérifications avant mise en production
- Lancer npm run build et npm test.
- Vérifier les en-têtes sur accueil, catalogue, API, robots.txt et sitemap.xml.
- Tester connexion/inscription, chaque jeu embarqué, microphone LiveKit, invitations, plein écran, partage, PWA et paiement Stripe en mode test.
- Vérifier le navigateur DevTools pour les violations CSP. Inventorier les domaines et scripts nécessaires avant d'appliquer une CSP restrictive. Les scripts Next.js intégrés et le rendu statique nécessitent une stratégie de nonces ou de hachages compatible.
- Ne pas activer COEP/COOP stricts sans tester les iframes et les fenêtres OAuth/paiement.

Ces changements ne modifient pas les règles RLS, les clés, les cookies Supabase, les autorisations API ni les protections des serveurs de jeux indépendants. Ils ne constituent pas un audit complet. Les étapes suivantes comprennent revue des accès, RLS, CSRF, limites de débit, secrets, dépendances et tests anti-fraude.
