"use client";

import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "./api";

/**
 * Groupes d'amis — appels côté navigateur.
 *
 * Comme pour le reste du socle social, ce fichier n'est qu'une façade typée :
 * toutes les règles (être ami pour être ajouté, rôle requis pour gérer,
 * appartenance pour lire ou écrire) sont appliquées par les fonctions SQL
 * `security definer`. En contourner une ligne ici ne donnerait aucun droit.
 */

export const GROUP_NAME_MAX = 40;
export const GROUP_MESSAGE_MAX = 1000;

export type GroupRole = "owner" | "admin" | "member";

export type FriendGroup = {
  id: string;
  name: string;
  avatarUrl: string | null;
  ownerId: string;
  myRole: GroupRole;
  muted: boolean;
  memberCount: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  memberIds: string[];
};

type GroupRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  owner_id: string;
  my_role: GroupRole;
  muted: boolean;
  member_count: number;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  member_ids: string[] | null;
};

export type GroupMember = {
  userId: string;
  role: GroupRole;
  username: string;
  avatarUrl: string | null;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  userId: string;
  body: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
};

function toMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Action déjà effectuée.";
  if (!error.message || /fetch|network|failed to/i.test(error.message)) {
    return "Problème de connexion — réessaie.";
  }
  return error.message.charAt(0).toUpperCase() + error.message.slice(1);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: toMessage(error) };
  return { ok: true, data: data as T };
}

export async function listMyGroups(): Promise<ActionResult<FriendGroup[]>> {
  const result = await rpc<GroupRow[]>("my_friend_groups", {});
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      ownerId: row.owner_id,
      myRole: row.my_role,
      muted: row.muted,
      memberCount: Number(row.member_count),
      unreadCount: Number(row.unread_count),
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      memberIds: row.member_ids ?? [],
    })),
  };
}

export function createFriendGroup(name: string, memberIds: string[]) {
  return rpc<string>("create_friend_group", { p_name: name, p_member_ids: memberIds });
}

export function addGroupMembers(groupId: string, memberIds: string[]) {
  return rpc<number>("add_group_members", { p_group_id: groupId, p_member_ids: memberIds });
}

export function removeGroupMember(groupId: string, userId: string) {
  return rpc<"removed" | "transferred" | "deleted">("remove_group_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
}

export function renameGroup(groupId: string, name: string) {
  return rpc<boolean>("update_friend_group", { p_group_id: groupId, p_name: name });
}

export function setGroupRole(groupId: string, userId: string, role: "admin" | "member") {
  return rpc<boolean>("update_friend_group", {
    p_group_id: groupId,
    p_promote_user_id: userId,
    p_promote_role: role,
  });
}

export function setGroupMuted(groupId: string, muted: boolean) {
  return rpc<boolean>("set_group_muted", { p_group_id: groupId, p_muted: muted });
}

export function markGroupRead(groupId: string) {
  return rpc<boolean>("mark_group_read", { p_group_id: groupId });
}

export function inviteGroupToPlay(groupId: string, gameSlug: string, roomCode?: string | null) {
  return rpc<number>("invite_group_to_play", {
    p_group_id: groupId,
    p_game_slug: gameSlug,
    p_room_code: roomCode ?? null,
  });
}

/**
 * Les membres d'un groupe, avec leur profil.
 *
 * Lecture directe plutôt qu'une fonction : RLS limite déjà `friend_group_members`
 * aux groupes dont on fait partie, et `profiles` est publiquement lisible.
 */
export async function listGroupMembers(groupId: string): Promise<ActionResult<GroupMember[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("friend_group_members")
    .select("user_id, role, profiles!friend_group_members_user_id_fkey(username, avatar_url)")
    .eq("group_id", groupId);

  if (error) return { ok: false, error: toMessage(error) };

  type Row = {
    user_id: string;
    role: GroupRole;
    profiles: { username: string; avatar_url: string | null } | null;
  };

  const members = ((data ?? []) as unknown as Row[]).map((row) => ({
    userId: row.user_id,
    role: row.role,
    username: row.profiles?.username ?? "Joueur",
    avatarUrl: row.profiles?.avatar_url ?? null,
  }));

  // Créateur en tête, puis administrateurs, puis par pseudonyme.
  const rank: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };
  members.sort(
    (a, b) => rank[a.role] - rank[b.role] || a.username.localeCompare(b.username, "fr"),
  );

  return { ok: true, data: members };
}

export function sendGroupMessage(groupId: string, body: string) {
  return rpc<{ id: string; group_id: string; user_id: string; body: string; created_at: string }>(
    "send_group_message",
    { p_group_id: groupId, p_body: body },
  );
}
