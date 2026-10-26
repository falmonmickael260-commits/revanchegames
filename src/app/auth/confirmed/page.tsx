import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { PartyPopper, AlertCircle, MailQuestion, Smartphone, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuccessBadge } from "@/components/auth/SuccessBadge";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";

export default function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<ConfirmedSkeleton />}>
      <ConfirmedContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}

// Le temps que la session soit vérifiée côté serveur, on affiche un état de
// chargement explicite — jamais un message de réussite ni d'échec, puisqu'à
// cet instant on ne sait pas encore lequel des deux est vrai.
function ConfirmedSkeleton() {
  return (
    <Shell>
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border-soft bg-surface">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-cyan" />
      </span>
      <p className="mt-5 font-display text-sm font-semibold text-text-dim">
        Vérification de ton adresse e-mail…
      </p>
    </Shell>
  );
}

async function ConfirmedContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ status?: string }>;
}) {
  await connection();
  const { status } = await searchParamsPromise;

  // Le message de réussite n'est jamais affiché sur la foi d'un paramètre
  // d'URL : seule une session réelle, vérifiée côté serveur (posée par
  // /auth/callback après une validation réussie du jeton), compte comme
  // « vraiment confirmé ».
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (auth.user) {
    return (
      <Shell>
        <SuccessBadge />
        <h1 className="mt-5 font-display text-2xl font-semibold text-text sm:text-3xl">
          Bienvenue sur Revanche Game !
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Ton adresse e-mail est confirmée. Tu peux maintenant retrouver tes amis et commencer à
          jouer.
        </p>
        <Link
          href="/"
          className="mt-7 rounded-lg bg-gradient-to-r from-cyan to-violet px-6 py-3 font-display text-sm font-semibold text-void"
        >
          Commencer à jouer
        </Link>
      </Shell>
    );
  }

  // Lien ouvert dans un navigateur différent de celui de l'inscription : le
  // vérificateur PKCE n'y est pas. Rien n'est cassé côté compte — il suffit
  // d'un lien qui ne dépende pas du navigateur, ou de se connecter.
  if (status === "other_browser") {
    return (
      <Shell>
        <IconBadge icon={Smartphone} />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Ouvre le lien sur l&apos;appareil de ton inscription
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Ce lien a été ouvert dans un autre navigateur que celui utilisé pour créer le compte.
          Réessaie depuis cet appareil-là, ou demande un nouveau lien ci-dessous : le nouveau
          fonctionnera partout.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
        <Link
          href="/sign-in"
          className="mt-4 font-display text-sm font-semibold text-text-dim hover:text-text"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  // Jeton déjà consommé — second clic, ou pré-chargement du lien par le client
  // de messagerie. Le compte est très probablement déjà confirmé.
  if (status === "used") {
    return (
      <Shell>
        <IconBadge icon={PartyPopper} />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Cette adresse est déjà confirmée
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Ce lien avait déjà été utilisé — il n&apos;est valable qu&apos;une fois. Tu peux te
          connecter directement.
        </p>
        <Link
          href="/sign-in"
          className="mt-7 rounded-lg bg-gradient-to-r from-cyan to-violet px-6 py-3 font-display text-sm font-semibold text-void"
        >
          Se connecter
        </Link>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
      </Shell>
    );
  }

  if (status === "expired") {
    return (
      <Shell>
        <IconBadge icon={MailQuestion} />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Ce lien a expiré
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Demande un nouvel e-mail de confirmation ci-dessous. Si ton compte était déjà confirmé,
          tu peux simplement te connecter.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
        <Link
          href="/sign-in"
          className="mt-4 font-display text-sm font-semibold text-text-dim hover:text-text"
        >
          J&apos;ai déjà un compte confirmé — me connecter
        </Link>
      </Shell>
    );
  }

  if (status === "invalid") {
    return (
      <Shell>
        <IconBadge icon={AlertCircle} tone="error" />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Ce lien est incomplet
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Certains clients de messagerie coupent les liens trop longs. Essaie de copier le lien
          entier depuis l&apos;e-mail, ou demande-en un nouveau ci-dessous.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
        <Link
          href="/sign-in"
          className="mt-4 font-display text-sm font-semibold text-text-dim hover:text-text"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <IconBadge icon={WifiOff} tone="error" />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Impossible de vérifier ton adresse pour le moment
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Vérifie ta connexion et réessaie en cliquant à nouveau sur le lien reçu par e-mail. Si
          cela persiste, demande un nouveau lien ci-dessous.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
        <Link
          href="/sign-in"
          className="mt-4 font-display text-sm font-semibold text-text-dim hover:text-text"
        >
          Se connecter
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <IconBadge icon={PartyPopper} />
      <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
        Pas encore connecté
      </h1>
      <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
        Connecte-toi pour accéder à ton espace joueur Revanche Game.
      </p>
      <Link
        href="/sign-in"
        className="mt-5 rounded-lg bg-gradient-to-r from-cyan to-violet px-6 py-3 font-display text-sm font-semibold text-void"
      >
        Se connecter
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  // min-h-dvh (et non 100vh) : sur mobile, dvh suit la hauteur réellement
  // visible, barre d'adresse comprise — le contenu reste centré sans déborder.
  return (
    <div className="flex min-h-[calc(100dvh-var(--rg-header-h))] flex-col items-center justify-center px-4 py-12 text-center">
      {children}
    </div>
  );
}

function IconBadge({
  icon: Icon,
  tone = "neutral",
}: {
  icon: typeof AlertCircle;
  tone?: "neutral" | "error";
}) {
  return (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-full border ${
        tone === "error" ? "border-violet/40 bg-violet/10" : "border-border-soft bg-surface"
      }`}
    >
      <Icon
        className={`h-7 w-7 ${tone === "error" ? "text-violet-soft" : "text-text-faint"}`}
        strokeWidth={1.8}
      />
    </span>
  );
}
