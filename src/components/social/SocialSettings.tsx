"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Eye, EyeOff, UserPlus } from "lucide-react";
import { useSocial } from "./SocialProvider";
import { updatePrivacy } from "@/lib/social/api";
import {
  isIosWithoutStandalone,
  readPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "@/lib/push-client";

/**
 * Réglages du socle social : notifications push et confidentialité.
 *
 * Sur les notifications, trois règles tenues ici :
 *  • l'autorisation n'est demandée qu'au clic sur le bouton — jamais à
 *    l'ouverture du site, et jamais réessayée en boucle après un refus ;
 *  • l'intérêt est expliqué avant de demander ;
 *  • un refus n'empêche rien : les mêmes notifications restent consultables
 *    dans la cloche de la plateforme.
 */
export function SocialSettings() {
  const { me } = useSocial();

  const [pushState, setPushState] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  // Les préférences font autorité côté profil ; `override` ne porte que le
  // basculement optimiste local, le temps que l'écriture aboutisse. Dérivées
  // plutôt que recopiées par un effet.
  const [override, setOverride] = useState<{ share?: boolean; requests?: boolean }>({});
  const [privacyBusy, setPrivacyBusy] = useState(false);

  // Lecture de l'état réel du navigateur (jamais supposé).
  useEffect(() => {
    let cancelled = false;
    readPushState().then((state) => {
      if (!cancelled) setPushState(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!me) return null;

  const shareActivity = override.share ?? me.shareActivity;
  const allowRequests = override.requests ?? me.allowFriendRequests;

  async function togglePush() {
    setPushBusy(true);
    setPushError("");

    if (pushState === "subscribed") {
      await unsubscribeFromPush();
      setPushState(await readPushState());
      setPushBusy(false);
      return;
    }

    const result = await subscribeToPush();
    if (!result.ok) setPushError(result.error ?? "Activation impossible.");
    setPushState(await readPushState());
    setPushBusy(false);
  }

  async function togglePrivacy(patch: { share_activity?: boolean; allow_friend_requests?: boolean }) {
    setPrivacyBusy(true);
    // Optimiste : le réglage bascule tout de suite…
    setOverride((previous) => ({
      ...previous,
      ...(patch.share_activity !== undefined ? { share: patch.share_activity } : {}),
      ...(patch.allow_friend_requests !== undefined ? { requests: patch.allow_friend_requests } : {}),
    }));

    const result = await updatePrivacy(patch);
    setPrivacyBusy(false);

    // …et on retire le basculement si l'écriture a échoué : la valeur du
    // profil reprend alors la main toute seule.
    if (!result.ok) {
      setOverride((previous) => {
        const next = { ...previous };
        if (patch.share_activity !== undefined) delete next.share;
        if (patch.allow_friend_requests !== undefined) delete next.requests;
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
        Amis et notifications
      </h2>

      {/* ---- Notifications push ---- */}
      <Row
        icon={pushState === "subscribed" ? Bell : BellOff}
        title="Notifications sur cet appareil"
        description={pushDescription(pushState)}
        action={
          pushState === "unsupported" || pushState === "denied" ? null : (
            <button
              type="button"
              disabled={pushBusy || pushState === null}
              onClick={togglePush}
              className={`shrink-0 rounded-lg px-3 py-1.5 font-display text-xs font-semibold disabled:opacity-50 ${
                pushState === "subscribed"
                  ? "border border-border-soft text-text-dim"
                  : "bg-gradient-to-r from-cyan to-violet text-void"
              }`}
            >
              {pushBusy ? "…" : pushState === "subscribed" ? "Désactiver" : "Activer"}
            </button>
          )
        }
      />
      {pushError && <p className="font-body text-xs text-violet-soft">{pushError}</p>}
      <p className="font-body text-xs text-text-faint">
        Même sans notifications système, les demandes d&apos;ami et les invitations restent
        visibles dans la cloche en haut de l&apos;écran.
      </p>

      {/* ---- Confidentialité ---- */}
      <Row
        icon={shareActivity ? Eye : EyeOff}
        title="Montrer à quoi je joue"
        description="Tes amis voient le jeu de ta partie en cours. Désactivé, tu apparais seulement « en ligne »."
        action={
          <Toggle
            checked={shareActivity}
            disabled={privacyBusy}
            label="Montrer à quoi je joue"
            onChange={(value) => togglePrivacy({ share_activity: value })}
          />
        }
      />

      <Row
        icon={UserPlus}
        title="Accepter les demandes d'ami"
        description="Désactivé, personne ne peut plus t'envoyer de demande. Tes amis actuels restent inchangés."
        action={
          <Toggle
            checked={allowRequests}
            disabled={privacyBusy}
            label="Accepter les demandes d'ami"
            onChange={(value) => togglePrivacy({ allow_friend_requests: value })}
          />
        }
      />
    </div>
  );
}

function pushDescription(state: PushState | null): string {
  if (state === null) return "Vérification…";
  switch (state) {
    case "subscribed":
      return "Activées : tu seras prévenu d'une invitation même si l'onglet est fermé.";
    case "denied":
      return "Refusées pour ce site. Pour les réactiver, autorise les notifications dans les réglages de ton navigateur.";
    case "unsupported":
      return isIosWithoutStandalone()
        ? "Sur iPhone, les notifications ne fonctionnent qu'après avoir ajouté Revanche Games à l'écran d'accueil (Partager → Sur l'écran d'accueil)."
        : "Ce navigateur ne prend pas en charge les notifications web.";
    case "idle":
      return "Être prévenu quand un ami t'invite à jouer, même quand la plateforme est fermée.";
  }
}

function Row({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-soft bg-surface px-4 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised">
        <Icon className="h-4 w-4 text-cyan" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-text">{title}</p>
        <p className="mt-0.5 font-body text-xs text-text-faint">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-gradient-to-r from-cyan to-violet" : "bg-surface-raised"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-void transition-transform ${
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
