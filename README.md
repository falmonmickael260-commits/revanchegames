This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Signalements depuis le profil

Profil → Paramètres → Signaler un joueur ouvre la recherche par pseudo, identifiant public RG ou UUID. Le joueur sélectionne le profil, décrit les faits et peut joindre trois captures de 5 Mo maximum chacune. Les JPEG, PNG et WebP sont décodés et normalisés en WebP sans métadonnées ; les preuves restent dans un bucket privé, accessible à la modération avec MFA. Le compte signalé ne reçoit pas les captures.

La recherche `report_player_lookup` ne renvoie que UUID, pseudo et identifiant public à des comptes confirmés. Les profils masqués ne sont pas proposés par recherche partielle ; un identifiant connu reste utilisable pour un signalement. Aucun e-mail n’est exposé. L’[avertissement Supabase sur les fonctions SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) est intentionnel pour cette API limitée : accès anonyme révoqué, compte confirmé obligatoire, résultats bornés.

Le signalement et les fichiers gardent leurs identifiants lors d’une nouvelle tentative après interruption. Le panneau administrateur propose un lien privé pour chaque capture, avec vérification du rôle et de la MFA à chaque téléchargement. Les anciens signalements avec une seule capture restent compatibles.
