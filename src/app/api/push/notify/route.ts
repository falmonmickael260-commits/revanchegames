import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/data/games";

// `web-push` a besoin des API de chiffrement de Node, pas du runtime Edge.
// Aucun `export const runtime` ici : c'est déjà le runtime par défaut des
// routes de l'App Router, et `nextConfig.cacheComponents` refuse cette option
// de segment (le build échoue avec « not compatible with cacheComponents »).

/**
 * Envoie la notification push correspondant à une action sociale.
 *
 * Modèle de sécurité — c'est tout l'intérêt de passer par une route serveur :
 *
 *  1. Le client n'indique **jamais** le destinataire. Il envoie seulement
 *     l'identifiant de l'objet qu'il vient de créer (demande d'ami,
 *     invitation). Impossible donc de se servir de cette route pour envoyer
 *     une notification à un joueur arbitraire.
 *  2. L'identité de l'appelant est relue depuis ses cookies de session, côté
 *     serveur, et la ligne est lue avec *ses* droits (RLS) : il doit vraiment
 *     être partie à cette relation.
 *  3. On revérifie ensuite qu'il est bien du bon côté (l'expéditeur de la
 *     demande, ou celui qui accepte), puis le destinataire est **déduit de la
 *     base**, jamais du corps de la requête.
 *  4. Les abonnements du destinataire ne sont lus qu'avec la clé service_role,
 *     côté serveur. La clé privée VAPID ne quitte jamais ce processus.
 *
 * Le contenu reste volontairement sobre : un pseudonyme (déjà public) et un
 * nom de jeu. Aucune adresse e-mail, aucun message de chat, rien qui n'ait pas
 * à s'afficher sur un écran verrouillé.
 */

type Body =
  | { type: "friend_request"; friendshipId: string }
  | { type: "friend_accepted"; friendshipId: string }
  | { type: "game_invitation"; invitationId: string }
  | { type: "platform_invite"; toUserId: string }
  | { type: "direct_message"; messageId: string };

/**
 * Deux messages envoyés coup sur coup ne font sonner le téléphone qu'une
 * fois : au-delà du premier, la conversation parle d'elle-même.
 */
const DIRECT_MESSAGE_THROTTLE_SECONDS = 60;

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function gameName(slug: string | null): string | null {
  if (!slug) return null;
  return GAMES.find((game) => game.id === slug)?.name ?? slug;
}

export async function POST(request: NextRequest) {
  // Lu à l'intérieur de la fonction, jamais au chargement du module : voir le
  // piège n°1 de docs/PLATFORM.md.
  if (!vapidConfigured()) {
    // Les notifications dans la plateforme fonctionnent déjà ; l'absence de
    // configuration push n'est pas une erreur côté client.
    return NextResponse.json({ sent: 0, reason: "push_not_configured" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user;
  if (!me) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  let recipientId: string | null = null;
  let title = "Revanche Games";
  let message_ = "";
  let url = "/friends";
  let tag = "rg-social";

  const actorName = await readUsername(supabase, me.id);

  if (body.type === "friend_request" || body.type === "friend_accepted") {
    if (typeof body.friendshipId !== "string") {
      return NextResponse.json({ error: "identifiant manquant" }, { status: 400 });
    }

    // Lecture avec les droits de l'appelant : RLS garantit qu'il est partie
    // à cette relation, sinon `data` est nul.
    const { data: friendship } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .eq("id", body.friendshipId)
      .maybeSingle();

    if (!friendship) return NextResponse.json({ error: "introuvable" }, { status: 404 });

    if (body.type === "friend_request") {
      // Seul le demandeur peut provoquer cette notification.
      if (friendship.requester_id !== me.id) {
        return NextResponse.json({ error: "interdit" }, { status: 403 });
      }
      recipientId = friendship.addressee_id;
      title = "Nouvelle demande d'ami";
      message_ = `${actorName} veut devenir ton ami.`;
      tag = "rg-friend-request";
    } else {
      // Seul celui qui accepte peut prévenir le demandeur.
      if (friendship.addressee_id !== me.id || friendship.status !== "accepted") {
        return NextResponse.json({ error: "interdit" }, { status: 403 });
      }
      recipientId = friendship.requester_id;
      title = "Demande d'ami acceptée";
      message_ = `${actorName} a accepté ta demande d'ami.`;
      tag = "rg-friend-accepted";
    }
  } else if (body.type === "game_invitation") {
    if (typeof body.invitationId !== "string") {
      return NextResponse.json({ error: "identifiant manquant" }, { status: 400 });
    }

    const { data: invitation } = await supabase
      .from("game_invitations")
      .select("from_user_id, to_user_id, game_slug, status")
      .eq("id", body.invitationId)
      .maybeSingle();

    if (!invitation) return NextResponse.json({ error: "introuvable" }, { status: 404 });
    if (invitation.from_user_id !== me.id || invitation.status !== "pending") {
      return NextResponse.json({ error: "interdit" }, { status: 403 });
    }

    recipientId = invitation.to_user_id;
    const label = gameName(invitation.game_slug);
    title = "Invitation à jouer";
    message_ = `${actorName} t'invite à jouer${label ? ` à ${label}` : ""}.`;
    // Ouvre directement le jeu concerné ; la validité de l'invitation est
    // revérifiée à l'arrivée par la bannière d'invitation.
    url = `/play/${invitation.game_slug}`;
    tag = `rg-invitation-${invitation.game_slug}`;
  } else if (body.type === "platform_invite") {
    if (typeof body.toUserId !== "string") {
      return NextResponse.json({ error: "identifiant manquant" }, { status: 400 });
    }

    // Pas de ligne à relire par id ici (une notification n'a pas d'« auteur
    // vérifiable » après coup) : on revérifie directement l'amitié, avec les
    // droits de l'appelant — RLS ne renvoie une ligne que si l'un des deux
    // est bien lui, donc ce select ne peut pas confirmer une amitié à
    // laquelle il n'est pas partie.
    const { data: friendship } = await supabase
      .from("friendships")
      .select("id")
      .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)
      .or(`requester_id.eq.${body.toUserId},addressee_id.eq.${body.toUserId}`)
      .eq("status", "accepted")
      .maybeSingle();

    if (!friendship) return NextResponse.json({ error: "interdit" }, { status: 403 });

    recipientId = body.toUserId;
    title = "Un ami te fait signe";
    message_ = `${actorName} t'invite à le/la retrouver sur Revanche Games.`;
    url = "/friends";
    tag = "rg-platform-invite";
  } else if (body.type === "direct_message") {
    if (typeof body.messageId !== "string") {
      return NextResponse.json({ error: "identifiant manquant" }, { status: 400 });
    }

    // Lu avec les droits de l'appelant : RLS garantit qu'il est partie à
    // cette conversation, sinon `data` est nul.
    const { data: message } = await supabase
      .from("direct_messages")
      .select("from_user_id, to_user_id, created_at")
      .eq("id", body.messageId)
      .maybeSingle();

    if (!message) return NextResponse.json({ error: "introuvable" }, { status: 404 });
    // Seul l'expéditeur peut provoquer cette notification — sans quoi le
    // destinataire pourrait se faire re-sonner lui-même indéfiniment.
    if (message.from_user_id !== me.id) {
      return NextResponse.json({ error: "interdit" }, { status: 403 });
    }

    // Anti-rafale : si un message a déjà été envoyé à cette personne dans la
    // dernière minute, le téléphone a déjà sonné.
    const since = new Date(
      new Date(message.created_at).getTime() - DIRECT_MESSAGE_THROTTLE_SECONDS * 1000,
    ).toISOString();

    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("from_user_id", me.id)
      .eq("to_user_id", message.to_user_id)
      .gte("created_at", since)
      .lt("created_at", message.created_at);

    if ((count ?? 0) > 0) {
      return NextResponse.json({ sent: 0, reason: "throttled" });
    }

    recipientId = message.to_user_id;
    title = `Message de ${actorName}`;
    // Volontairement sans le contenu du message : il s'afficherait sur un
    // écran verrouillé, à la vue de n'importe qui.
    message_ = "Tu as reçu un message privé.";
    url = "/friends";
    tag = `rg-dm-${me.id}`;
  } else {
    return NextResponse.json({ error: "type inconnu" }, { status: 400 });
  }

  if (!recipientId) return NextResponse.json({ error: "destinataire introuvable" }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ sent: 0, reason: "service_key_missing" });
  }

  // Les abonnements d'un autre joueur ne sont pas lisibles avec les droits de
  // l'appelant (RLS « select own ») : cette lecture précise exige la clé de
  // service, qui reste côté serveur.
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", recipientId);

  const rows = (subscriptions ?? []) as PushRow[];
  if (rows.length === 0) {
    // Destinataire sans appareil abonné : la notification dans la plateforme
    // l'attendra à sa prochaine connexion. Ce n'est pas une erreur.
    return NextResponse.json({ sent: 0, reason: "no_subscription" });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const payload = JSON.stringify({ title, body: message_, url, tag });
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          { TTL: 900 }, // 15 min : la durée de vie d'une invitation.
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404/410 : l'abonnement n'existe plus côté service de push
        // (application désinstallée, notifications révoquées). On le purge.
        if (statusCode === 404 || statusCode === 410) dead.push(row.id);
      }
    }),
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  // `touch` des abonnements encore valides — les morts viennent d'être
  // supprimés, donc il ne reste que ceux-là.
  if (sent > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", recipientId);
  }

  return NextResponse.json({ sent, removed: dead.length });
}

async function readUsername(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).single();
  return data?.username ?? "Un joueur";
}
