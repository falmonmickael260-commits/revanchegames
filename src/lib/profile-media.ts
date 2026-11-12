// Pause temporaire : réactiver ici les imports et l’affichage des photos.
export const PROFILE_MEDIA_ENABLED = false;
export const PROFILE_MEDIA_PAUSED_MESSAGE =
  "Les photos de profil et les bannières sont temporairement désactivées.";

export function visibleAvatar(value: string | null | undefined): string | null {
  if (!PROFILE_MEDIA_ENABLED && value && /^https?:\/\//i.test(value)) return null;
  return value ?? null;
}
