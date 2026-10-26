import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { PartyPopper, AlertCircle, MailQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuccessBadge } from "@/components/auth/SuccessBadge";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";

export default function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-64px)] items-center justify-center" />}>
      <ConfirmedContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}

async function ConfirmedContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ status?: string }>;
}) {
  await connection();
  const { status } = await searchParamsPromise;

  // The success message is never shown on the strength of a query param alone
  // — only a real, server-verified session (set by /auth/callback after a
  // successful exchangeCodeForSession) counts as "really confirmed".
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
          Ton compte est confirmé. Tu peux maintenant retrouver tes amis et commencer à jouer.
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

  if (status === "expired") {
    return (
      <Shell>
        <IconBadge icon={MailQuestion} />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Ce lien n&apos;est plus valide
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          Il a peut-être expiré, ou déjà été utilisé — ton compte est alors sans doute déjà confirmé.
          Essaie de te connecter, ou demande un nouveau lien ci-dessous.
        </p>
        <Link href="/sign-in" className="mt-5 font-display text-sm font-semibold text-cyan hover:text-cyan-soft">
          J&apos;ai déjà un compte confirmé — me connecter
        </Link>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <IconBadge icon={AlertCircle} tone="error" />
        <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">
          Un problème est survenu
        </h1>
        <p className="mt-2 max-w-sm font-body text-sm text-text-dim">
          La confirmation n&apos;a pas pu aboutir. Réessaie en cliquant à nouveau sur le lien reçu par
          e-mail, ou demande un nouveau lien ci-dessous.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ResendConfirmation />
        </div>
        <Link href="/sign-in" className="mt-4 font-display text-sm font-semibold text-text-dim hover:text-text">
          Se connecter
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <IconBadge icon={PartyPopper} />
      <h1 className="mt-5 font-display text-xl font-semibold text-text sm:text-2xl">Pas encore connecté</h1>
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
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-4 py-12 text-center">
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
      <Icon className={`h-7 w-7 ${tone === "error" ? "text-violet-soft" : "text-text-faint"}`} strokeWidth={1.8} />
    </span>
  );
}
