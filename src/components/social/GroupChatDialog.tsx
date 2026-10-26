"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Crown,
  Gamepad2,
  LogOut,
  Send,
  Shield,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "./SocialProvider";
import { PresenceDot, presenceLabel } from "./PresenceDot";
import { useGroupMessages } from "@/lib/use-group-messages";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { GAMES } from "@/data/games";
import { useGameSession } from "@/components/game/GameSessionProvider";
import {
  addGroupMembers,
  inviteGroupToPlay,
  listGroupMembers,
  removeGroupMember,
  setGroupMuted,
  GROUP_MESSAGE_MAX,
  type FriendGroup,
  type GroupMember,
} from "@/lib/social/groups";
import type { PresenceStatus } from "@/lib/social/types";

const PLAYABLE = GAMES.filter((game) => game.enabled);

type Tab = "chat" | "members" | "play";

/**
 * Un groupe ouvert : sa conversation, ses membres, et l'invitation à jouer.
 *
 * Choix d'interface important : **l'onglet « Discussion » est celui qui
 * s'ouvre**, déjà positionné sur les derniers messages, champ de saisie
 * visible. Sur un téléphone, devoir remonter tout l'historique avant de
 * pouvoir écrire serait le défaut le plus pénible de cet écran.
 *
 * Le clavier virtuel est compensé par `useKeyboardInset` — sans quoi, sur
 * iOS, le champ de saisie passerait derrière le clavier.
 */
export function GroupChatDialog({
  group,
  onClose,
  onChanged,
}: {
  group: FriendGroup;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { me, friends, presence } = useSocial();
  const { active } = useGameSession();
  const keyboardInset = useKeyboardInset();

  const [tab, setTab] = useState<Tab>("chat");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(group.muted);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [gameSlug, setGameSlug] = useState(() => active?.slug ?? PLAYABLE[0]?.id ?? "");
  const [roomCode, setRoomCode] = useState(() => active?.roomCode ?? "");

  const listRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sending, error: chatError, send, markRead } = useGroupMessages({
    groupId: group.id,
  });

  // Les membres servent aux trois onglets : chargés une fois à l'ouverture.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listGroupMembers(group.id);
      if (cancelled) return;
      if (result.ok) setMembers(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // Ouvrir le groupe vaut lecture.
  useEffect(() => {
    void markRead();
  }, [markRead]);

  // Les derniers messages, tout de suite — pas de défilement à faire.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, tab]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const addable = useMemo(
    () => friends.filter((friend) => !memberIds.has(friend.id)),
    [friends, memberIds],
  );

  const canManage = group.myRole === "owner" || group.myRole === "admin";
  const onlineCount = members.filter(
    (m) => m.userId !== me?.id && (presence.get(m.userId)?.status ?? "offline") !== "offline",
  ).length;

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Action impossible.");
      return false;
    }
    if (success) setNotice(success);
    const refreshed = await listGroupMembers(group.id);
    if (refreshed.ok) setMembers(refreshed.data);
    onChanged();
    return true;
  }

  async function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    const ok = await send(draft);
    if (ok) setDraft("");
  }

  async function leave() {
    const result = await removeGroupMember(group.id, me!.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
    onClose();
  }

  async function invite() {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await inviteGroupToPlay(group.id, gameSlug, roomCode.trim() || null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      result.data === 0
        ? "Personne à inviter pour le moment."
        : `${result.data} invitation${result.data > 1 ? "s" : ""} envoyée${result.data > 1 ? "s" : ""}. Chacun rejoindra la même partie sans code à saisir.`,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Groupe ${group.name}`}
      className="fixed inset-0 z-[65] flex items-end justify-center bg-void/80 p-2 backdrop-blur-sm sm:items-center sm:p-3"
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
        style={{
          // La hauteur suit le clavier virtuel : sans ça, sur iOS, la zone de
          // saisie se retrouve dessous (cf. useKeyboardInset).
          height: `min(82dvh, calc(100dvh - 2rem - ${keyboardInset}px))`,
        }}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border-soft px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
            <Users className="h-4 w-4 text-cyan" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text">{group.name}</p>
            <p className="font-body text-[11px] text-text-faint">
              {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
              {onlineCount > 0 && ` · ${onlineCount} en ligne`}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                const next = !muted;
                const result = await setGroupMuted(group.id, next);
                if (result.ok) setMuted(next);
                return result;
              })
            }
            aria-label={muted ? "Réactiver les notifications du groupe" : "Couper les notifications du groupe"}
            title={muted ? "Notifications coupées" : "Notifications actives"}
            className="shrink-0 rounded-lg p-1.5 text-text-faint hover:text-text"
          >
            {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1.5 text-text-faint hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex shrink-0 border-b border-border-soft">
          {([
            ["chat", "Discussion"],
            ["members", "Membres"],
            ["play", "Jouer"],
          ] as [Tab, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-current={tab === value}
              className={`flex-1 border-b-2 px-3 py-2 font-display text-xs font-semibold transition-colors ${
                tab === value
                  ? "border-cyan text-text"
                  : "border-transparent text-text-faint hover:text-text-dim"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {(error || notice) && (
          <p
            className={`shrink-0 px-3 py-2 font-body text-xs ${
              error ? "bg-violet/10 text-violet-soft" : "bg-cyan/10 text-cyan"
            }`}
          >
            {error || notice}
          </p>
        )}

        {/* ---- Discussion ---- */}
        {tab === "chat" && (
          <>
            <div
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
            >
              {loading ? (
                <p className="py-10 text-center font-body text-sm text-text-faint">
                  Chargement…
                </p>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center font-body text-sm text-text-faint">
                  Personne n&apos;a encore écrit. Lance la conversation !
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const own = message.userId === me?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-2 ${own ? "flex-row-reverse text-right" : ""}`}
                      >
                        <Avatar
                          username={message.username}
                          avatarUrl={message.avatarUrl}
                          size="sm"
                        />
                        <div
                          className={`flex min-w-0 max-w-[80%] flex-col gap-0.5 ${own ? "items-end" : "items-start"}`}
                        >
                          <span className="truncate font-display text-xs font-semibold text-text-dim">
                            {message.username}
                          </span>
                          <p
                            className={`min-w-0 break-words rounded-xl px-3 py-1.5 font-body text-sm text-text ${
                              own
                                ? "bg-gradient-to-r from-cyan/20 to-violet/20"
                                : "bg-surface-raised"
                            }`}
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {message.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              onSubmit={submitMessage}
              className="flex shrink-0 items-end gap-2 border-t border-border-soft p-2.5"
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, GROUP_MESSAGE_MAX))}
                placeholder="Écris au groupe…"
                aria-label="Message au groupe"
                // text-base sous sm : évite le zoom automatique d'iOS Safari.
                className="min-w-0 flex-1 rounded-lg border border-border-soft bg-void px-3.5 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Envoyer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan to-violet text-void disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {chatError && (
              <p className="shrink-0 px-3 pb-2 font-body text-xs text-violet-soft">{chatError}</p>
            )}
          </>
        )}

        {/* ---- Membres ---- */}
        {tab === "members" && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <ul className="flex flex-col gap-1.5">
              {members.map((member) => {
                const status: PresenceStatus =
                  member.userId === me?.id
                    ? "online"
                    : (presence.get(member.userId)?.status ?? "offline");
                return (
                  <li
                    key={member.userId}
                    className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-void px-3 py-2"
                  >
                    <Avatar username={member.username} avatarUrl={member.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-display text-sm font-semibold text-text">
                        {member.username}
                        {member.role === "owner" && (
                          <Crown className="h-3.5 w-3.5 shrink-0 text-amber" />
                        )}
                        {member.role === "admin" && (
                          <Shield className="h-3.5 w-3.5 shrink-0 text-cyan" />
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 font-body text-[11px] text-text-faint">
                        <PresenceDot status={status} />
                        {presenceLabel(status)}
                      </p>
                    </div>
                    {canManage && member.userId !== me?.id && member.role !== "owner" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() => removeGroupMember(group.id, member.userId), "Membre retiré.")
                        }
                        aria-label={`Retirer ${member.username}`}
                        className="shrink-0 rounded-lg p-1.5 text-text-faint hover:text-violet-soft disabled:opacity-50"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {canManage && addable.length > 0 && (
              <>
                <p className="mt-4 font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                  Ajouter des amis
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {addable.map((friend) => {
                    const chosen = adding.has(friend.id);
                    return (
                      <li key={friend.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setAdding((previous) => {
                              const next = new Set(previous);
                              if (next.has(friend.id)) next.delete(friend.id);
                              else next.add(friend.id);
                              return next;
                            })
                          }
                          aria-pressed={chosen}
                          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                            chosen ? "border-cyan/50 bg-cyan/[0.07]" : "border-border-soft bg-void"
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
                          <UserPlus
                            className={`h-4 w-4 shrink-0 ${chosen ? "text-cyan" : "text-text-faint"}`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={busy || adding.size === 0}
                  onClick={async () => {
                    const ok = await run(
                      () => addGroupMembers(group.id, [...adding]),
                      "Membres ajoutés.",
                    );
                    if (ok) setAdding(new Set());
                  }}
                  className="mt-3 w-full rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
                >
                  Ajouter {adding.size > 0 ? `(${adding.size})` : ""}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={leave}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-soft px-4 py-2.5 font-display text-sm font-semibold text-text-dim transition-colors hover:border-violet/40 hover:text-violet-soft disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Quitter le groupe
            </button>
            {group.myRole === "owner" && (
              <p className="mt-2 font-body text-[11px] text-text-faint">
                Tu es le créateur : en partant, le groupe passera au plus ancien administrateur,
                ou au plus ancien membre. S&apos;il n&apos;y a personne d&apos;autre, il sera
                supprimé.
              </p>
            )}
          </div>
        )}

        {/* ---- Inviter à jouer ---- */}
        {tab === "play" && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <p className="font-body text-sm text-text-dim">
              Chaque membre reçoit une invitation. Ceux qui acceptent rejoignent{" "}
              <strong className="text-text">la même partie</strong>, sans code à taper.
            </p>

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                Jeu
              </span>
              <select
                value={gameSlug}
                onChange={(event) => {
                  setGameSlug(event.target.value);
                  setRoomCode(active?.slug === event.target.value ? (active?.roomCode ?? "") : "");
                }}
                className="w-full rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text focus:border-cyan/50 focus:outline-none sm:text-sm"
              >
                {PLAYABLE.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                    {active?.slug === game.id ? " — ta partie en cours" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                Code de salon (facultatif)
              </span>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                maxLength={32}
                placeholder="Laisse vide pour inviter sur le jeu"
                className="w-full rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
              />
              <span className="font-body text-[11px] text-text-faint">
                Le code reste utile pour quelqu&apos;un d&apos;extérieur au groupe.
              </span>
            </label>

            <button
              type="button"
              disabled={busy || !gameSlug}
              onClick={invite}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
            >
              <Gamepad2 className="h-4 w-4" />
              {busy ? "Envoi…" : "Inviter le groupe à jouer"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
