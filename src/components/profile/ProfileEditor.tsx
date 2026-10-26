"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Copy, Lock, Pencil, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarCropper } from "./AvatarCropper";
import { setPlayerTag, updateSignature, SIGNATURE_MAX_LENGTH } from "@/lib/social/api";
import { formatPlayerTag } from "@/lib/player-tag";

const AVATAR_CHOICES = [
  "🦊", "🐼", "🦁", "🐸", "🐙", "🦉", "🐝", "🦋",
  "🦄", "🐯", "🐨", "🦖", "🐬", "🦅", "🐺", "🐧",
  "🎮", "👑", "🃏", "🎲",
];

export function ProfileEditor({
  userId,
  initialUsername,
  initialAvatarUrl,
  initialPlayerTag,
  initialSignature,
}: {
  userId: string;
  initialUsername: string;
  initialAvatarUrl: string | null;
  /** Phrase de présentation affichée sous le pseudonyme. */
  initialSignature: string | null;
  /** `null` : pas encore choisi. Une fois défini, ne peut plus changer. */
  initialPlayerTag: string | null;
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
  // Photo choisie, en attente de recadrage. Tant qu'elle est posée, le
  // recadreur est à l'écran et rien n'a encore été envoyé.
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

  const [signature, setSignature] = useState(initialSignature ?? "");
  const [signatureDraft, setSignatureDraft] = useState(initialSignature ?? "");
  const [editingSignature, setEditingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);
  const [copied, setCopied] = useState(false);

  const [playerTag, setPlayerTagValue] = useState(initialPlayerTag);
  const [choosingTag, setChoosingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagError, setTagError] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  async function handleCopyTag() {
    if (!playerTag) return;
    try {
      await navigator.clipboard.writeText(formatPlayerTag(playerTag));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible — rien à faire, le texte reste sélectionnable à la main */
    }
  }

  async function handleChooseTag(event: FormEvent) {
    event.preventDefault();
    setTagError("");

    const trimmed = tagDraft.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setTagError("L'identifiant doit contenir entre 3 et 20 caractères.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setTagError("L'identifiant ne peut contenir que des lettres, des chiffres et des _.");
      return;
    }

    setSavingTag(true);
    const result = await setPlayerTag(trimmed);
    setSavingTag(false);

    if (!result.ok) {
      setTagError(result.error);
      return;
    }

    setPlayerTagValue(trimmed);
    setChoosingTag(false);
    router.refresh();
  }

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

  async function handleSaveSignature() {
    setSavingSignature(true);
    setSignatureError("");
    const result = await updateSignature(signatureDraft);
    setSavingSignature(false);
    if (!result.ok) {
      setSignatureError(result.error);
      return;
    }
    setSignature(signatureDraft.trim());
    setEditingSignature(false);
    router.refresh();
  }

  /**
   * Première étape : on ne fait que retenir le fichier. L'envoi n'a lieu
   * qu'après recadrage, pour que le joueur voie exactement ce qui part.
   */
  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Choisis un fichier image.");
      return;
    }
    // Garde-fou de confort : le serveur refait la vérification, et accepte
    // jusqu'à 5 Mo — ici on évite surtout de charger un fichier énorme en
    // mémoire pour le recadrage.
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("Cette image est trop lourde (10 Mo maximum).");
      return;
    }

    setPendingPhoto(file);
  }

  /**
   * Deuxième étape : envoi du carré recadré à `/api/avatar`.
   *
   * L'envoi direct au stockage a été retiré (voir la route et la migration
   * 20261026140000) : le serveur est désormais le seul à pouvoir écrire, ce
   * qui lui permet de refuser une image non conforme avant publication.
   */
  async function handleCropped(blob: Blob) {
    setUploading(true);
    setAvatarError("");

    const form = new FormData();
    form.append("file", blob, "avatar.webp");

    let response: Response;
    try {
      response = await fetch("/api/avatar", { method: "POST", body: form });
    } catch {
      setUploading(false);
      setAvatarError("Envoi impossible — vérifie ta connexion.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null;

    setUploading(false);

    if (!response.ok || !payload?.url) {
      setAvatarError(payload?.error ?? "L'envoi de la photo a échoué. Réessaie.");
      return;
    }

    setAvatarUrl(payload.url);
    setPendingPhoto(null);
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

          {/* Contrairement au pseudonyme ci-dessus, modifiable à volonté :
              cet identifiant se choisit une seule fois (voir set_player_tag,
              qui refuse toute écriture si la colonne n'est déjà plus vide). */}
          {playerTag ? (
            <button
              type="button"
              onClick={handleCopyTag}
              aria-label={`Copier l'identifiant fixe ${formatPlayerTag(playerTag)}`}
              title="Fixe — choisi une seule fois, ne change jamais même si tu changes de pseudo. Donne-le à un ami pour qu'il te retrouve."
              className="group mt-1 flex items-center gap-1.5 font-body text-xs text-text-faint transition-colors hover:text-text-dim"
            >
              <span className="tabular-nums tracking-wide">{formatPlayerTag(playerTag)}</span>
              <Copy className="h-3 w-3 text-text-faint transition-colors group-hover:text-cyan" />
              {copied && <span className="font-display text-[10px] font-semibold text-cyan">Copié</span>}
            </button>
          ) : choosingTag ? (
            <form onSubmit={handleChooseTag} className="mt-1.5 flex min-w-0 flex-col gap-1.5">
              {/* min-w-0 sur la ligne ET sur le champ : sans ça, un <input>
                  dans un flex-row garde sa largeur intrinsèque par défaut
                  (`min-width: auto`) et refuse de rétrécir — il poussait toute
                  la ligne (et le bouton Déconnexion, plus loin dans l'en-tête)
                  hors de l'écran sur mobile au lieu de tenir dans la carte. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 font-body text-xs text-text-faint">RG-</span>
                <input
                  autoFocus
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  maxLength={20}
                  placeholder="Ex. MikeFR"
                  // min-w-[5rem], pas min-w-0 : un <input> dans un flex-row
                  // rétrécit par défaut jusqu'à devenir fonctionnellement
                  // invisible si l'espace manque — ici, le reste de la ligne
                  // passe plutôt à l'écran suivant (flex-wrap) avant d'en
                  // arriver là.
                  className="min-w-[5rem] flex-1 rounded-lg border border-border-soft bg-void px-2.5 py-1 font-body text-xs text-text focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20"
                />
                <button
                  type="submit"
                  disabled={savingTag || !tagDraft.trim()}
                  className="shrink-0 rounded-lg bg-gradient-to-r from-cyan to-violet px-2.5 py-1 font-display text-[11px] font-semibold text-void disabled:opacity-50"
                >
                  {savingTag ? "…" : "Valider"}
                </button>
                <button
                  type="button"
                  onClick={() => setChoosingTag(false)}
                  className="shrink-0 font-body text-[11px] text-text-faint hover:text-text-dim"
                >
                  Annuler
                </button>
              </div>
              <p className="font-body text-[11px] text-text-faint">
                Définitif : impossible à changer une fois validé.
              </p>
              {tagError && <p className="font-body text-xs text-violet-soft">{tagError}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTagDraft("");
                setTagError("");
                setChoosingTag(true);
              }}
              className="group mt-1 flex items-center gap-1.5 font-body text-xs text-text-faint transition-colors hover:text-cyan"
            >
              <Lock className="h-3 w-3" />
              Choisir mon identifiant fixe
            </button>
          )}
        </div>
      </div>

      {/* ---- Signature ---- */}
      <div className="rounded-xl border border-border-soft bg-surface px-4 py-3.5">
        {editingSignature ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                Ta signature
              </span>
              <textarea
                value={signatureDraft}
                onChange={(event) =>
                  setSignatureDraft(event.target.value.slice(0, SIGNATURE_MAX_LENGTH))
                }
                rows={2}
                placeholder="Une phrase qui te résume — visible par les autres joueurs."
                // text-base sous sm : en dessous de 16 px, iOS Safari zoome au
                // focus et sort le champ de l'écran.
                className="w-full resize-none rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <span className="font-body text-[11px] text-text-faint">
                {signatureDraft.length} / {SIGNATURE_MAX_LENGTH}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingSignature}
                  onClick={handleSaveSignature}
                  className="rounded-lg bg-gradient-to-r from-cyan to-violet px-3 py-1.5 font-display text-xs font-semibold text-void disabled:opacity-50"
                >
                  {savingSignature ? "…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  disabled={savingSignature}
                  onClick={() => {
                    setSignatureDraft(signature);
                    setSignatureError("");
                    setEditingSignature(false);
                  }}
                  className="rounded-lg border border-border-soft px-3 py-1.5 font-display text-xs font-semibold text-text-dim disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
            {signatureError && (
              <p className="font-body text-xs text-violet-soft">{signatureError}</p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-cyan" strokeWidth={2} />
            <p
              className={`min-w-0 flex-1 font-body text-sm ${
                signature ? "text-text-dim" : "text-text-faint"
              }`}
              style={{ overflowWrap: "anywhere" }}
            >
              {signature || "Aucune signature — ajoute une phrase qui te résume."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSignatureDraft(signature);
                setEditingSignature(true);
              }}
              aria-label="Modifier ma signature"
              className="shrink-0 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text-dim"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          {avatarError && <p className="mt-2 font-body text-xs text-violet-soft">{avatarError}</p>}
        </div>
      )}

      {pendingPhoto && (
        <AvatarCropper
          file={pendingPhoto}
          busy={uploading}
          error={avatarError}
          onCancel={() => {
            setPendingPhoto(null);
            setAvatarError("");
          }}
          onCropped={handleCropped}
        />
      )}
    </div>
  );
}
