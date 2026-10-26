"use client";

import { createClient } from "./supabase/client";

/**
 * Abonnement aux notifications push, côté navigateur.
 *
 * Ce que ce fichier ne fait pas, volontairement :
 *  • il ne demande jamais l'autorisation tout seul — seul un clic explicite
 *    du joueur sur le réglage déclenche `subscribe()` ;
 *  • il ne contient aucune clé privée. Seule la clé VAPID *publique* est
 *    exposée au navigateur (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), ce qui est son
 *    rôle ; la privée ne quitte jamais le serveur.
 *
 * Un refus n'est jamais réessayé en boucle : `Notification.permission` reste
 * à "denied" et l'interface le dit, au lieu de relancer la demande.
 */

export type PushState =
  | "unsupported" // navigateur sans Web Push, ou iOS hors écran d'accueil
  | "denied" // le joueur a refusé — seul lui peut revenir en arrière
  | "subscribed"
  | "idle"; // pris en charge, pas encore activé

function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

/**
 * La clé VAPID voyage en base64url ; `applicationServerKey` attend des octets.
 *
 * Le tableau est construit sur un `ArrayBuffer` explicite, et non via
 * `new Uint8Array(longueur)` : `BufferSource` exclut les vues adossées à un
 * `SharedArrayBuffer`, et c'est la seule façon de le dire au typage.
 */
function decodeKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    vapidPublicKey() !== null
  );
}

/**
 * Sur iPhone et iPad, le Web Push n'existe qu'à partir d'iOS 16.4 **et**
 * seulement quand le site a été ajouté à l'écran d'accueil. Dans un onglet
 * Safari ordinaire, `PushManager` est absent — d'où ce test, qui sert à
 * afficher la bonne explication plutôt qu'un échec incompréhensible.
 */
export function isIosWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
  return !standalone;
}

export async function readPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.getRegistration();
  const existing = await registration?.pushManager.getSubscription();
  return existing ? "subscribed" : "idle";
}

/**
 * Demande l'autorisation, crée l'abonnement et l'enregistre.
 *
 * À n'appeler que depuis un geste utilisateur : les navigateurs refusent
 * `requestPermission()` autrement, et c'est de toute façon le comportement
 * qu'on veut.
 */
export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return {
      ok: false,
      error: isIosWithoutStandalone()
        ? "Sur iPhone, ajoute d'abord Revanche Games à ton écran d'accueil (Partager → Sur l'écran d'accueil)."
        : "Ce navigateur ne prend pas en charge les notifications.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notifications refusées. Tu peux les réautoriser dans les réglages de ton navigateur."
          : "Autorisation non accordée.",
    };
  }

  // En développement, le service worker n'est pas enregistré (voir
  // ServiceWorkerRegister) : sans lui, pas de push possible.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return { ok: false, error: "Service worker indisponible — les notifications ne peuvent pas être activées ici." };
  }

  let subscription: PushSubscription;
  try {
    // `userVisibleOnly` est obligatoire : chaque push doit produire une
    // notification visible, pas de traitement silencieux en arrière-plan.
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(vapidPublicKey()!),
    });
  } catch {
    return { ok: false, error: "Impossible de créer l'abonnement push." };
  }

  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  if (!json.endpoint || !keys.p256dh || !keys.auth) {
    return { ok: false, error: "Abonnement push incomplet." };
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Session expirée — reconnecte-toi." };

  // `endpoint` est unique : un même appareil qui se réabonne met à jour sa
  // ligne au lieu d'en créer une seconde.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    // On ne garde pas un abonnement navigateur que le serveur ne connaît pas.
    await subscription.unsubscribe().catch(() => {});
    return { ok: false, error: "Enregistrement impossible — réessaie." };
  }

  return { ok: true };
}

/** Désactive les notifications sur cet appareil uniquement. */
export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});

  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

/**
 * Demande au serveur d'envoyer la notification push correspondant à une
 * action qu'on vient d'effectuer.
 *
 * Le navigateur ne dit jamais *à qui* envoyer : il ne transmet que
 * l'identifiant de l'objet (demande d'ami, invitation). Le serveur revérifie
 * qu'on en est bien l'auteur, puis en déduit le destinataire lui-même.
 *
 * L'échec est volontairement silencieux : la notification dans la plateforme,
 * elle, est déjà enregistrée en base. Le push n'est qu'un supplément.
 */
export async function requestPushDelivery(
  payload:
    | { type: "friend_request"; friendshipId: string }
    | { type: "friend_accepted"; friendshipId: string }
    | { type: "game_invitation"; invitationId: string },
): Promise<void> {
  try {
    await fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Hors ligne, route indisponible : sans conséquence.
  }
}
