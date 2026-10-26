"use client";

import { useMemo, useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "./SocialProvider";
import { createFriendGroup, GROUP_NAME_MAX } from "@/lib/social/groups";

/**
 * Créer un groupe : un nom, des amis cochés, c'est tout.
 *
 * La recherche filtre la liste d'amis déjà chargée par <SocialProvider> —
 * pas d'appel réseau à la frappe.
 *
 * On ne propose que ses amis : la fonction SQL refuse de toute façon
 * quelqu'un d'autre, autant ne pas l'afficher.
 */
export function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (groupId: string) => void;
}) {
  const { friends } = useSocial();

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return friends;
    // Filtre sur le pseudonyme seul : la liste d'amis chargée par
    // <SocialProvider> ne porte pas l'identifiant permanent, et aller le
    // chercher pour un simple filtre local ne vaut pas la requête.
    return friends.filter((friend) => friend.username.toLowerCase().includes(needle));
  }, [friends, query]);

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setPending(true);
    setError("");
    const result = await createFriendGroup(name, [...selected]);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Créer un groupe"
      className="fixed inset-0 z-[65] flex items-end justify-center bg-void/80 p-3 backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_48px_rgba(0,0,0,0.6)]">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-text">
            <Users className="h-4 w-4 text-cyan" />
            Créer un groupe
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1 text-text-faint hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
              Nom du groupe
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, GROUP_NAME_MAX))}
              placeholder="Team Revanche, Soirées gaming…"
              // text-base sous sm : en dessous de 16 px, iOS Safari zoome au
              // focus et sort le champ de l'écran.
              className="w-full rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
            />
            <span className="text-right font-body text-[11px] text-text-faint">
              {name.length} / {GROUP_NAME_MAX}
            </span>
          </label>

          <p className="mt-3 font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
            Qui en fait partie ? ({selected.size})
          </p>

          {friends.length === 0 ? (
            <p className="mt-2 font-body text-sm text-text-faint">
              Tu n&apos;as pas encore d&apos;amis à ajouter. Le groupe peut être créé vide, tu
              ajouteras du monde plus tard.
            </p>
          ) : (
            <>
              <div className="relative mt-2 flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-text-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrer mes amis…"
                  aria-label="Filtrer mes amis"
                  className="w-full rounded-full border border-border-soft bg-void py-2 pl-9 pr-3 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
                />
              </div>

              <ul className="mt-2 flex flex-col gap-1.5">
                {visible.map((friend) => {
                  const checked = selected.has(friend.id);
                  return (
                    <li key={friend.id}>
                      <button
                        type="button"
                        onClick={() => toggle(friend.id)}
                        aria-pressed={checked}
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                          checked
                            ? "border-cyan/50 bg-cyan/[0.07]"
                            : "border-border-soft bg-void hover:border-border"
                        }`}
                      >
                        <Avatar
                          username={friend.username}
                          avatarUrl={friend.avatarUrl}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">
                          {friend.username}
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            checked ? "border-cyan bg-cyan text-void" : "border-border-soft"
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {visible.length === 0 && (
                  <li className="font-body text-xs text-text-faint">Aucun ami à ce nom.</li>
                )}
              </ul>
            </>
          )}

          {error && <p className="mt-3 font-body text-xs text-violet-soft">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border-soft p-4">
          <button
            type="button"
            disabled={pending || name.trim().length === 0}
            onClick={submit}
            className="flex-1 rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
          >
            {pending ? "Création…" : "Créer le groupe"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg border border-border-soft px-4 py-2.5 font-display text-sm font-semibold text-text-dim disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
