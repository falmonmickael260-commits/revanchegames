"use client";

import { useState } from "react";
import { Gamepad2, Heart, Trophy, Users, Pencil, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/library/EmptyState";
import { useProfile } from "@/lib/use-profile";
import { useFavorites } from "@/lib/use-favorites";

export default function ProfilePage() {
  const { name, updateName } = useProfile();
  const { favorites } = useFavorites();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(name);
    setEditing(true);
  }

  function save() {
    updateName(draft);
    setEditing(false);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Compte" title="Profil" />

      <div className="flex items-center gap-4 rounded-2xl border border-border-soft bg-surface p-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-violet font-display text-2xl font-bold text-void">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                maxLength={24}
                className="w-full max-w-[220px] rounded-lg border border-border-soft bg-void px-3 py-1.5 font-display text-lg font-semibold text-text focus:border-cyan/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={save}
                aria-label="Enregistrer le pseudo"
                className="rounded-lg bg-surface-raised p-2 text-cyan hover:text-cyan-soft"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="group flex items-center gap-2 font-display text-lg font-semibold text-text"
            >
              {name}
              <Pencil className="h-3.5 w-3.5 text-text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <p className="font-body text-sm text-text-faint">Pseudonyme local — visible uniquement sur cet appareil.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Heart} label="Favoris" value={favorites.length} />
        <StatTile icon={Gamepad2} label="Parties jouées" value={0} />
        <StatTile icon={Trophy} label="Victoires" value={0} />
        <StatTile icon={Users} label="Amis" value={0} />
      </div>

      <div>
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-violet">
          Bientôt
        </p>
        <EmptyState
          icon={Users}
          title="Amis & invitations"
          message="L'ajout d'amis, les invitations et les salons multijoueurs arriveront avec les premiers jeux activés."
        />
      </div>
    </div>
  );
}
