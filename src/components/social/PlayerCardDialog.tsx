"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, UserCheck, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import { sendFriendRequest } from "@/lib/social/api";
import { requestPushDelivery } from "@/lib/push-client";
import { formatPlayerTag } from "@/lib/player-tag";
import { ReportDialog } from "./ReportDialog";
import { useSocial } from "./SocialProvider";

type PublicProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  player_tag: string | null;
  signature: string | null;
  relationship: "none" | "self" | "friend" | "request_sent" | "request_received" | "blocked";
  accepts_requests: boolean;
};

/**
 * La fiche rapide d'un joueur, ouverte en touchant son pseudonyme ou son
 * avatar dans le chat général.
 *
 * Pourquoi elle existe plutôt qu'un simple lien vers `/profile/<id>` : la
 * fiche complète n'est visible qu'entre amis, et c'est voulu — elle expose
 * statistiques et liste d'amis. Or c'est précisément *avant* d'être amis
 * qu'on a besoin de regarder quelqu'un croisé dans le chat pour l'ajouter.
 *
 * Cette fiche ne montre donc que ce qui est déjà public (pseudonyme, avatar,
 * identifiant, signature) et propose la bonne action selon la relation. Quand
 * on est déjà amis, un lien mène à la fiche complète.
 */
export function PlayerCardDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { refresh } = useSocial();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: loadError } = await supabase.rpc("get_public_profile", {
        p_user_id: userId,
      });
      if (cancelled) return;
      if (loadError || !data?.[0]) {
        setError("Profil indisponible.");
        setLoading(false);
        return;
      }
      setProfile(data[0] as PublicProfile);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function add() {
    if (!profile) return;
    setBusy(true);
    setError("");
    const result = await sendFriendRequest(profile.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data) {
      void requestPushDelivery({ type: "friend_request", friendshipId: result.data });
    }
    setProfile({ ...profile, relationship: "request_sent" });
    await refresh();
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fiche du joueur"
        className="fixed inset-0 z-[65] flex items-end justify-center bg-void/75 p-3 backdrop-blur-sm sm:items-center"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-xs rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_48px_rgba(0,0,0,0.6)]">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-lg p-1 text-text-faint hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 pb-4">
              <div className="h-16 w-16 animate-pulse rounded-full bg-surface-raised" />
              <div className="h-4 w-28 animate-pulse rounded bg-surface-raised" />
            </div>
          ) : !profile ? (
            <p className="pb-4 text-center font-body text-sm text-violet-soft">{error}</p>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar username={profile.username} avatarUrl={profile.avatar_url} />

              <p className="mt-3 font-display text-base font-semibold text-text">
                {profile.username}
              </p>
              {profile.player_tag && (
                <p className="font-body text-xs tracking-wide text-text-faint">
                  {formatPlayerTag(profile.player_tag)}
                </p>
              )}
              {profile.signature && (
                <p
                  className="mt-2 font-body text-sm italic text-text-dim"
                  style={{ overflowWrap: "anywhere" }}
                >
                  « {profile.signature} »
                </p>
              )}

              {error && <p className="mt-3 font-body text-xs text-violet-soft">{error}</p>}

              <div className="mt-4 flex w-full flex-col gap-2">
                {profile.relationship === "none" &&
                  (profile.accepts_requests ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={add}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      {busy ? "…" : "Ajouter en ami"}
                    </button>
                  ) : (
                    <p className="font-body text-xs text-text-faint">
                      Ce joueur n&apos;accepte pas les demandes d&apos;ami.
                    </p>
                  ))}

                {profile.relationship === "request_sent" && (
                  <p className="flex items-center justify-center gap-1.5 rounded-lg border border-border-soft px-4 py-2.5 font-display text-sm font-semibold text-text-faint">
                    <UserCheck className="h-4 w-4" />
                    Demande envoyée
                  </p>
                )}

                {profile.relationship === "request_received" && (
                  <Link
                    href="/friends"
                    onClick={onClose}
                    className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void"
                  >
                    Répondre à sa demande
                  </Link>
                )}

                {profile.relationship === "friend" && (
                  <Link
                    href={`/profile/${profile.id}`}
                    onClick={onClose}
                    className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void"
                  >
                    Voir son profil
                  </Link>
                )}

                {profile.relationship === "self" && (
                  <Link
                    href="/profile"
                    onClick={onClose}
                    className="rounded-lg border border-border-soft px-4 py-2.5 font-display text-sm font-semibold text-text-dim"
                  >
                    C&apos;est toi — voir ton profil
                  </Link>
                )}

                {profile.relationship !== "self" && (
                  <button
                    type="button"
                    onClick={() => setReporting(true)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border-soft px-4 py-2 font-display text-xs font-semibold text-text-faint transition-colors hover:border-violet/40 hover:text-violet-soft"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Signaler
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {reporting && profile && (
        <ReportDialog
          target={{ id: profile.id, username: profile.username }}
          context="chat-general"
          onClose={() => setReporting(false)}
        />
      )}
    </>
  );
}
