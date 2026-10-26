/**
 * Ce que le chat partage entre le serveur et le navigateur.
 *
 * Volontairement SANS directive "use client" : la page /chat rend son
 * historique initial côté serveur et a besoin d'appeler `rowsToMessages` —
 * ce qu'un module client lui interdirait (« Attempted to call
 * rowsToMessages() from the server but rowsToMessages is on the client »).
 * Les hooks, eux, vivent dans `use-chat-feed.ts`, qui est bien un module
 * client et réutilise ce fichier.
 */

export const CHAT_MAX_LENGTH = 500;
/** Taille de l'historique chargé — la même des deux côtés. */
export const CHAT_HISTORY_LIMIT = 50;

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
};

export type ChatIdentity = { id: string; username: string; avatarUrl: string | null };

/** Une ligne de `chat_messages` jointe à son profil, telle que Supabase la rend. */
export type ChatHistoryRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

/**
 * Convertit les lignes de la base en messages affichables, du plus ancien au
 * plus récent. La requête les demande en ordre décroissant (pour que `limit`
 * prenne les *derniers*), d'où le `reverse`.
 */
export function rowsToMessages(rows: ChatHistoryRow[] | null | undefined): ChatMessage[] {
  return (rows ?? [])
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      userId: row.user_id,
      username: row.profiles?.username ?? "Joueur",
      avatarUrl: row.profiles?.avatar_url ?? null,
    }))
    .reverse();
}

export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
