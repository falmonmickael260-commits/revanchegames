import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Lock, Trophy, Target, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/library/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { toFriendProfile, type FriendProfileRow } from "@/lib/social/friend-profile";
import { ReportPlayerButton } from "@/components/social/ReportPlayerButton";

// `id` est un identifiant de compte quelconque, impossible à énumérer à
// l'avance via `generateStaticParams` (contrairement à /play/<slug>, dont la
// liste de jeux est connue) : la coquille lit `usePathname()` pour savoir si
// elle est en mode immersif, ce qui bloquerait sinon le rendu statique de
// cette route précise. Documenté dans migrating-to-cache-components.md.
export const instant = false;

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <FriendProfileContent paramsPromise={params} />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Communauté" title="Profil" />
      <div className="h-24 animate-pulse rounded-2xl border border-border-soft bg-surface" />
    </div>
  );
}

async function FriendProfileContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  // Le jeton de session vient des cookies, connus seulement à la requête —
  // voir docs/PLATFORM.md / Next.js 16 Cache Components.
  await connection();
  const { id } = await paramsPromise;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <Shell>
        <EmptyState
          icon={Users}
          title="Connecte-toi pour voir ce profil"
          message="Les profils des amis ne sont visibles qu'entre comptes Revanche Games."
        />
      </Shell>
    );
  }

  if (auth.user.id === id) {
    return (
      <Shell>
        <EmptyState
          icon={Users}
          title="C'est ton propre profil"
          message="Retrouve tes statistiques et tes réglages sur ta page de profil."
          action={
            <Link
              href="/profile"
              className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void"
            >
              Aller à mon profil
            </Link>
          }
        />
      </Shell>
    );
  }

  const { data: catalog } = await supabase
    .from("game_catalog")
    .select("slug, display_name, sort_order")
    .order("sort_order");

  const { data: rows, error } = await supabase.rpc("get_friend_profile", { p_user_id: id });

  if (error || !rows?.[0]) {
    return (
      <Shell>
        <EmptyState
          icon={Lock}
          title="Profil inaccessible"
          message={
            error?.message.includes("amis")
              ? "Ce profil n'est visible qu'entre amis — vous ne vous êtes pas encore ajoutés."
              : (error?.message ?? "Profil introuvable.")
          }
          action={
            <Link
              href="/friends"
              className="rounded-lg border border-border-soft px-4 py-2 font-display text-sm font-semibold text-text-dim"
            >
              Retour à mes amis
            </Link>
          }
        />
      </Shell>
    );
  }

  const profile = toFriendProfile(rows[0] as FriendProfileRow);
  const memberSince = new Date(profile.memberSince).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
  });
  const perGameBySlug = new Map((profile.perGame ?? []).map((g) => [g.gameSlug, g]));

  return (
    <Shell>
      <div className="flex items-start gap-4 rounded-2xl border border-border-soft bg-surface p-5">
        <Avatar username={profile.username} avatarUrl={profile.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-text">{profile.username}</p>
          {profile.playerTag && (
            <p className="font-body text-xs tracking-wide text-text-faint">RG-{profile.playerTag}</p>
          )}
          {/* La signature reste affichée même si le profil est masqué : c'est
              une présentation écrite pour être lue, pas une statistique. */}
          {profile.signature && (
            <p
              className="mt-1.5 font-body text-sm italic text-text-dim"
              style={{ overflowWrap: "anywhere" }}
            >
              « {profile.signature} »
            </p>
          )}
          <p className="mt-1 font-body text-sm text-text-faint">Membre depuis {memberSince}</p>
        </div>

        <ReportPlayerButton targetId={id} username={profile.username} />
      </div>

      {!profile.profileVisible ? (
        <EmptyState
          icon={Lock}
          title="Profil privé"
          message={`${profile.username} n'a pas rendu ses statistiques et sa liste d'amis visibles.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile icon={Gamepad2} label="Parties jouées" value={profile.gamesPlayed ?? 0} />
            <StatTile icon={Trophy} label="Victoires" value={profile.wins ?? 0} />
            <StatTile
              icon={Target}
              label="Taux de victoire"
              value={profile.winRate != null ? `${profile.winRate}%` : "—"}
            />
          </div>

          <div>
            <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-violet">
              Statistiques par jeu
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border-soft">
              <table className="w-full min-w-[480px] border-collapse font-body text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-surface-raised text-left">
                    <th className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                      Jeu
                    </th>
                    <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                      Parties
                    </th>
                    <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                      Victoires
                    </th>
                    <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                      Taux
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(catalog ?? []).map((game) => {
                    const row = perGameBySlug.get(game.slug);
                    return (
                      <tr key={game.slug} className="border-b border-border-soft bg-surface last:border-0">
                        <td className="px-4 py-3 font-display font-semibold text-text">
                          {game.display_name}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-dim">
                          {row?.gamesPlayed ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-cyan">{row?.wins ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-dim">
                          {row?.winRate != null ? `${row.winRate}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-violet">
              Amis ({profile.friends?.length ?? 0})
            </p>
            {!profile.friends || profile.friends.length === 0 ? (
              <p className="font-body text-sm text-text-faint">Pas encore d&apos;amis sur la plateforme.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.friends.map((friend) => (
                  <li
                    key={friend.id}
                    className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5"
                  >
                    <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">
                      {friend.username}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/friends"
          aria-label="Retour à mes amis"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-soft text-text-dim transition-colors hover:border-border hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader eyebrow="Communauté" title="Profil" />
      </div>
      {children}
    </div>
  );
}
