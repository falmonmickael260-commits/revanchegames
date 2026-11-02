"use client";

import { useState } from "react";
import { type LucideIcon, Trash2, Volume2, Accessibility, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SocialSettings } from "@/components/social/SocialSettings";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useFavorites } from "@/lib/use-favorites";
import { SupportLink } from "@/components/support/SupportLink";
import Link from "next/link";

function SettingRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border-soft bg-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised">
          <Icon className="h-4 w-4 text-cyan" strokeWidth={2} />
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-text">{title}</p>
          <p className="font-body text-xs text-text-faint">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export default function SettingsPage() {
  const reducedMotion = useReducedMotion();
  const { clearFavorites: resetFavorites } = useFavorites();
  const [cleared, setCleared] = useState(false);

  function clearFavorites() {
    resetFavorites();
    setCleared(true);
    setTimeout(() => setCleared(false), 1600);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Préférences" title="Paramètres" />

      <SupportLink />
      <Link href="/profile#mes-achats" className="rounded-xl border border-border-soft bg-surface p-4 font-display text-sm font-semibold text-cyan">Mes achats et reçus de paiement</Link>

      <SocialSettings />

      <div className="flex flex-col gap-3">
        <SettingRow
          icon={Trash2}
          title="Réinitialiser les favoris"
          description="Vide votre liste de favoris sur cet appareil."
          action={
            <button
              type="button"
              onClick={clearFavorites}
              className="rounded-full border border-border-soft bg-surface-raised px-3.5 py-1.5 font-body text-xs text-text-dim transition-colors hover:border-border hover:text-text"
            >
              {cleared ? "Fait" : "Réinitialiser"}
            </button>
          }
        />

        <SettingRow
          icon={Accessibility}
          title="Mouvement réduit"
          description={
            reducedMotion
              ? "Activé au niveau système — les animations sont réduites automatiquement."
              : "Non activé au niveau système. Activez « Réduire les animations » dans les réglages de votre appareil pour une expérience plus sobre."
          }
          action={
            <span
              className={`rounded-full px-3 py-1 font-body text-xs ${
                reducedMotion ? "bg-cyan/10 text-cyan" : "bg-surface-raised text-text-faint"
              }`}
            >
              {reducedMotion ? "Actif" : "Inactif"}
            </span>
          }
        />

        <SettingRow
          icon={Volume2}
          title="Son de l'application"
          description="Aucun son n'est encore intégré à Revanche Games. Cette bascule s'activera avec les premiers effets sonores."
          action={
            <span className="rounded-full bg-surface-raised px-3 py-1 font-body text-xs text-text-faint">
              Bientôt
            </span>
          }
        />

        <SettingRow
          icon={Download}
          title="Installer l'application"
          description="Sur mobile : menu du navigateur → « Ajouter à l'écran d'accueil ». Sur ordinateur : icône d'installation dans la barre d'adresse."
          action={null}
        />
      </div>
    </div>
  );
}
