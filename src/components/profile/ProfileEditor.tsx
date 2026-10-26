"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";

const AVATAR_CHOICES = [
  "🦊", "🐼", "🦁", "🐸", "🐙", "🦉", "🐝", "🦋",
  "🦄", "🐯", "🐨", "🦖", "🐬", "🦅", "🐺", "🐧",
  "🎮", "👑", "🃏", "🎲",
];

export function ProfileEditor({
  userId,
  initialUsername,
  initialAvatarUrl,
}: {
  userId: string;
  initialUsername: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialUsername);
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    setNameError("");

    const trimmed = nameDraft.trim();
    if (trimmed === username) {
      setEditingName(false);
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 24) {
      setNameError("Le pseudonyme doit contenir entre 3 et 24 caractères.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setNameError("Le pseudonyme ne peut contenir que des lettres, des chiffres et des _.");
      return;
    }

    setSavingName(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .neq("id", userId)
      .maybeSingle();

    if (existing) {
      setSavingName(false);
      setNameError("Ce pseudonyme est déjà pris.");
      return;
    }

    const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", userId);
    setSavingName(false);

    if (error) {
      setNameError("Impossible d'enregistrer ce pseudonyme. Réessaie.");
      return;
    }

    setUsername(trimmed);
    setEditingName(false);
    router.refresh();
  }

  async function handlePickEmoji(emoji: string) {
    setAvatarError("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ avatar_url: emoji }).eq("id", userId);
    if (error) {
      setAvatarError("Impossible d'enregistrer cet avatar. Réessaie.");
      return;
    }
    setAvatarUrl(emoji);
    setPickerOpen(false);
    router.refresh();
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarError("");

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("Formats acceptés : PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("La photo doit faire moins de 3 Mo.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      setAvatarError("L'envoi de la photo a échoué. Réessaie.");
      return;
    }

    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl.publicUrl })
      .eq("id", userId);

    setUploading(false);

    if (updateError) {
      setAvatarError("Impossible d'enregistrer cette photo. Réessaie.");
      return;
    }

    setAvatarUrl(publicUrl.publicUrl);
    setPickerOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar username={username} avatarUrl={avatarUrl} />
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Changer d'avatar"
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border-soft bg-surface-raised text-text-dim transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={24}
                className="w-full max-w-[220px] rounded-lg border border-border-soft bg-void px-3 py-1.5 font-display text-sm font-semibold text-text focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20"
              />
              <button
                type="submit"
                disabled={savingName}
                aria-label="Enregistrer le pseudonyme"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan to-violet text-void disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(username);
                setNameError("");
                setEditingName(true);
              }}
              className="group flex items-center gap-1.5"
            >
              <p className="font-display text-lg font-semibold text-text">{username}</p>
              <Pencil className="h-3.5 w-3.5 text-text-faint transition-colors group-hover:text-cyan" />
            </button>
          )}
          {nameError && <p className="mt-1 font-body text-xs text-violet-soft">{nameError}</p>}
        </div>
      </div>

      {pickerOpen && (
        <div className="rounded-xl border border-border-soft bg-surface-raised p-4">
          <p className="mb-2.5 font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
            Choisir un avatar
          </p>
          <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
            {AVATAR_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handlePickEmoji(emoji)}
                className="flex aspect-square items-center justify-center rounded-lg border border-border-soft bg-surface text-lg transition-colors hover:border-cyan/50"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider text-cyan hover:text-cyan-soft disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
              {uploading ? "Envoi…" : "Importer une photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          {avatarError && <p className="mt-2 font-body text-xs text-violet-soft">{avatarError}</p>}
        </div>
      )}
    </div>
  );
}
