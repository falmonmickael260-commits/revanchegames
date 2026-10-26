"use client";

import { createClient } from "@/lib/supabase/client";
import type { SearchResult } from "./types";

/**
 * Les mutations du socle social, côté navigateur.
 *
 * Chacune n'est qu'un appel à une fonction `security definer` : toutes les
 * vérifications (identité, amitié, blocage, expiration, propriété de
 * l'invitation) sont refaites côté base, jamais ici. Ce fichier n'est qu'une
 * façade typée — en contourner une ligne ne donnerait aucun privilège.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Traduit une erreur Postgres en message affichable.
 *
 * Les fonctions SQL lèvent déjà leurs messages en français ; on les reprend
 * telles quelles plutôt que d'en réécrire une seconde version ici, qui
 * finirait par diverger. Seules les erreurs techniques (réseau, contrainte
 * d'unicité) sont reformulées.
 */
function toMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505" || error.code === "23P01") {
    return "Action déjà effectuée.";
  }
  if (error.code === "PGRST301" || error.code === "401") {
    return "Session expirée — reconnecte-toi.";
  }
  if (!error.message || /fetch|network|failed to/i.test(error.message)) {
    return "Problème de connexion — réessaie.";
  }
  // Message déjà rédigé par la fonction SQL, première lettre en majuscule.
  return error.message.charAt(0).toUpperCase() + error.message.slice(1);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: toMessage(error) };
  return { ok: true, data: data as T };
}

export async function searchPlayers(query: string): Promise<ActionResult<SearchResult[]>> {
  const result = await rpc<
    { id: string; username: string; avatar_url: string | null; relationship: string; accepts_requests: boolean }[]
  >("search_players", { p_query: query });
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url,
      relationship: row.relationship as SearchResult["relationship"],
      acceptsRequests: row.accepts_requests,
    })),
  };
}

export function sendFriendRequest(targetId: string) {
  return rpc<string>("send_friend_request", { p_target_id: targetId });
}

export function respondToFriendRequest(friendshipId: string, accept: boolean) {
  return rpc<string>("respond_to_friend_request", {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
}

export function removeFriend(otherId: string) {
  return rpc<boolean>("remove_friend", { p_other_id: otherId });
}

export function blockPlayer(otherId: string) {
  return rpc<boolean>("block_player", { p_other_id: otherId });
}

export function unblockPlayer(otherId: string) {
  return rpc<boolean>("unblock_player", { p_other_id: otherId });
}

export function sendGameInvitation(toUserId: string, gameSlug: string, roomCode?: string | null) {
  return rpc<string>("send_game_invitation", {
    p_to_user_id: toUserId,
    p_game_slug: gameSlug,
    p_room_code: roomCode ?? null,
  });
}

export type InvitationOutcome = { status: string; game_slug: string; room_code: string | null };

export async function respondToGameInvitation(
  invitationId: string,
  accept: boolean,
): Promise<ActionResult<InvitationOutcome | null>> {
  const result = await rpc<InvitationOutcome[]>("respond_to_game_invitation", {
    p_invitation_id: invitationId,
    p_accept: accept,
  });
  if (!result.ok) return result;
  // La fonction renvoie `returns table`, donc un tableau d'une ligne.
  return { ok: true, data: result.data?.[0] ?? null };
}

export function markNotificationsRead(ids?: string[]) {
  return rpc<number>("mark_notifications_read", { p_ids: ids ?? null });
}

/** Préférences de confidentialité — écriture directe, protégée par RLS (update own). */
export async function updatePrivacy(patch: {
  share_activity?: boolean;
  allow_friend_requests?: boolean;
}): Promise<ActionResult> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Session expirée — reconnecte-toi." };
  const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) return { ok: false, error: toMessage(error) };
  return { ok: true, data: undefined };
}
