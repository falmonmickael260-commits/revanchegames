"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { browserDb } from "../lib/browser";

type Row = Record<string, unknown>;
type Session = {
  userId: string;
  role: "owner" | "admin" | "moderator" | "support";
  canCredit: boolean;
};
type Data = Record<string, unknown> & { rows?: Row[]; total?: number };
const titles: Record<string, string> = {
  dashboard: "Vue d’ensemble",
  players: "Joueurs",
  rooms: "Salons & parties",
  reports: "Signalements",
  tickets: "Assistance",
  wallet: "Mouvements de pièces",
  payments: "Achats & paiements",
  gifts: "Cadeaux",
  rev: "Classement REV",
  games: "Jeux & maintenance",
  results: "Résultats des parties",
  announcements: "Communication",
  audit: "Journal des actions",
  members: "Équipe & permissions",
  sanctions: "Sanctions",
  player: "Fiche joueur",
  ticket: "Dossier d’assistance",
  report: "Dossier de signalement",
  promos: "Codes promotionnels",
};
const labels: Record<string, string> = {
  id: "Identifiant",
  user_id: "Joueur",
  username: "Pseudo",
  created_at: "Création",
  last_seen_at: "Dernière activité",
  role: "Rôle",
  can_credit: "Crédit autorisé",
  enabled: "Actif",
  subject: "Objet",
  status: "Statut",
  state: "État",
  kind: "Type",
  reason: "Motif",
  actor_id: "Responsable",
  expires_at: "Expiration",
  revoked_at: "Levée",
  delta_coins: "Variation",
  balance_coins: "Solde de pièces",
  reference: "Référence",
  game_slug: "Jeu",
  room_code: "Salon",
  slug: "Jeu",
  display_name: "Nom",
  maintenance: "Maintenance",
  message: "Message",
  body: "Message",
  reporter_id: "Auteur",
  target_user_id: "Joueur signalé",
  category: "Catégorie",
  context: "Contexte",
  pack_id: "Offre",
  coins: "Pièces",
  amount: "Montant (centimes)",
  currency: "Devise",
  livemode: "Paiement réel",
  entitled_coins: "Pièces attribuées",
  refunded_amount: "Remboursé (centimes)",
  sender_id: "Expéditeur",
  recipient_id: "Destinataire",
  gift_id: "Cadeau",
  quantity: "Quantité",
  total_price: "Coût",
  total_rev: "REV",
  total_reward: "Récompense",
  action: "Action",
  target: "Cible",
  before_value: "Avant",
  after_value: "Après",
  finished_at: "Fin de partie",
  player_count: "Participants",
  capacity: "Places",
  refreshed_at: "Dernière vérification",
  updated_at: "Modification",
  outcome: "Résultat",
  score: "Score",
  position: "Position",
  result_id: "Partie",
  from_admin: "Équipe",
  description: "Description",
  details: "Explication",
  resolved_at: "Résolution",
  transaction_reference: "Référence de paiement",
  attachment_path: "Pièce jointe",
  code: "Code",
  reward_coins: "Pièces",
  active: "Actif",
  max_redemptions: "Limite",
  redemptions_count: "Utilisations",
};
const values: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  moderator: "Modérateur",
  support: "Assistance",
  open: "Nouveau",
  reviewing: "En cours",
  resolved: "Traité",
  dismissed: "Classé",
  received: "Reçu",
  in_progress: "En cours",
  paid: "Payé",
  pending: "En attente",
  failed: "Échoué",
  expired: "Expiré",
  refunded: "Remboursé",
  partially_refunded: "Remboursé en partie",
  disputed: "Contesté",
  mute: "Tchat restreint",
  suspend: "Suspension",
  ban: "Bannissement",
  warning: "Avertissement",
  started: "En cours",
  closed: "Fermé",
  full: "Complet",
};
const modSections = ["reports", "sanctions"];
const economySections = ["wallet", "payments", "gifts", "rev", "promos"];
function permitted(session: Session, section: string) {
  if (session.role === "owner") return true;
  if (section === "members") return false;
  if (modSections.includes(section)) return session.role !== "support";
  if (section === "tickets") return session.role !== "moderator";
  if ([...economySections, "audit"].includes(section))
    return session.role === "admin";
  return true;
}
function display(value: unknown, key = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.map((v) => display(v)).join(", ");
  if (typeof value === "object")
    return Object.entries(value as Row)
      .map(([k, v]) => `${labels[k] || k} : ${display(v, k)}`)
      .join(" · ");
  if (key.endsWith("_at") && !Number.isNaN(Date.parse(String(value))))
    return new Date(String(value)).toLocaleString("fr-FR");
  return values[String(value)] || String(value);
}
async function getData(
  section: string,
  search = "",
  target = "",
  offset = 0,
): Promise<Data> {
  const response = await fetch(
    `/api/data?${new URLSearchParams({ section, search, target, offset: String(offset) })}`,
    { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Lecture impossible.");
  return data;
}

function Login({ onReady }: { onReady: () => void }) {
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function prepareMfa() {
    const db = browserDb();
    const membership = await db
      .from("admin_members")
      .select("enabled")
      .maybeSingle();
    if (membership.error || !membership.data?.enabled)
      throw new Error(
        "Ce compte ne dispose pas d’un accès administrateur actif.",
      );
    const factors = await db.auth.mfa.listFactors();
    if (factors.error) throw new Error("Vérification des facteurs impossible.");
    const verified = factors.data.totp.find((f) => f.status === "verified");
    if (verified) {
      setFactor(verified.id);
      setQr("");
    } else {
      // Reuse by removing abandoned, unverified enrollments before retrying.
      for (const f of factors.data.all.filter((f) => f.status === "unverified"))
        await db.auth.mfa.unenroll({ factorId: f.id });
      const enrolled = await db.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Revanche Games Administration",
      });
      if (enrolled.error)
        throw new Error("Activation de la double authentification impossible.");
      setFactor(enrolled.data.id);
      setQr(enrolled.data.totp.qr_code);
    }
    setStep("mfa");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (step === "login") {
        const { error } = await browserDb().auth.signInWithPassword({
          email: String(form.get("email")),
          password: String(form.get("password")),
        });
        if (error) throw new Error("Adresse ou mot de passe incorrect.");
        await prepareMfa();
      } else {
        const { error } = await browserDb().auth.mfa.challengeAndVerify({
          factorId: factor,
          code: String(form.get("code")),
        });
        if (error) throw new Error("Code incorrect ou expiré.");
        onReady();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="brand">
        <span className="brandmark">R</span> Revanche Games
      </div>
      <div className="login-card">
        <span className="eyebrow">ESPACE ÉQUIPE</span>
        <h1>Administration</h1>
        <p>Un accès sécurisé à toute la plateforme.</p>
        <form onSubmit={submit}>
          {step === "login" ? (
            <>
              <label>
                Adresse e-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Mot de passe
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            </>
          ) : (
            <>
              {qr && (
                <>
                  <p>
                    Scannez ce QR code avec votre application
                    d’authentification, puis saisissez le code à six chiffres.
                  </p>
                  {/* QR data generated by Supabase Auth. */}
                  <Image
                    unoptimized
                    width={200}
                    height={200}
                    className="qr"
                    src={qr}
                    alt="QR code pour activer la double authentification"
                  />
                </>
              )}
              <label>
                Code de double authentification
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Vérification…"
              : step === "login"
                ? "Se connecter"
                : "Valider le code"}
          </button>
        </form>
        <p className="small">
          Utilisez votre compte Revanche Games autorisé par le propriétaire.
        </p>
      </div>
    </main>
  );
}

type ActionForm = {
  action: string;
  target?: string;
  type?: string;
  slug?: string;
};
const actionNames: Record<string, string> = {
  wallet: "Ajuster les pièces",
  sanction: "Appliquer une sanction",
  revoke: "Lever une sanction",
  note: "Ajouter une note interne",
  report: "Traiter le signalement",
  ticket: "Répondre au joueur",
  game: "Configurer la maintenance",
  announce: "Publier une annonce",
  member: "Gérer un membre",
  assign: "Attribuer le dossier",
  reconcile: "Vérifier et réconcilier le paiement",
  spectate: "Ouvrir la vue spectateur",
  promo: "Configurer un code promotionnel",
};
function ActionDialog({
  form,
  onClose,
  onDone,
}: {
  form: ActionForm;
  onClose: () => void;
  onDone: (result: unknown, id: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Row | null>(null);
  const operation = useRef<{ id: string; payload: Row } | null>(null);
  function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const payload: Row = { ...raw };
    if (form.action === "wallet") payload.delta = Number(raw.delta);
    if (form.action === "member") {
      payload.enabled = raw.enabled === "true";
      payload.canCredit = raw.canCredit === "true";
    }
    if (form.action === "game")
      payload.maintenance = raw.maintenance === "true";
    if (form.action === "promo") {
      payload.active = raw.active === "true";
      payload.coins = Number(raw.coins);
      payload.limit = raw.limit ? Number(raw.limit) : null;
    }
    if (raw.expires)
      payload.expires = new Date(String(raw.expires)).toISOString();
    if (
      !operation.current ||
      JSON.stringify(operation.current.payload) !== JSON.stringify(payload)
    )
      operation.current = { id: crypto.randomUUID(), payload };
    setReview(payload);
    setError("");
  }
  async function commit() {
    if (!operation.current) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: operation.current.id,
          action: form.action,
          payload: operation.current.payload,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onDone(data.result, operation.current.id);
      onClose();
    } catch (e) {
      setError(
        (e as Error).message || "Connexion interrompue. Vous pouvez réessayer.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-title"
        className="dialog"
      >
        <button
          className="close"
          onClick={onClose}
          disabled={busy}
          aria-label="Fermer"
        >
          ×
        </button>
        <h2 id="action-title">{actionNames[form.action]}</h2>
        {review ? (
          <>
            <p>Vérifiez les informations avant de confirmer.</p>
            <Fields data={review} />
            <div className="actions">
              <button onClick={() => setReview(null)} disabled={busy}>
                Modifier
              </button>
              <button className="primary" onClick={commit} disabled={busy}>
                {busy ? "Enregistrement…" : "Confirmer l’action"}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={prepare}>
            {!["game", "announce", "promo"].includes(form.action) && (
              <label>
                {form.action === "revoke"
                  ? "Identifiant de la sanction"
                  : "Identifiant de la cible"}
                <input name="target" defaultValue={form.target} required />
              </label>
            )}
            {form.action === "announce" && (
              <label>
                Joueur destinataire (vide pour tous)
                <input name="target" />
              </label>
            )}
            {["note", "assign"].includes(form.action) && (
              <label>
                Type de dossier
                <select name="type" defaultValue={form.type || "player"}>
                  {(form.action === "note"
                    ? ["player", "report", "ticket"]
                    : ["report", "ticket"]
                  ).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            )}
            {form.action === "wallet" && (
              <label>
                Variation de pièces (négative pour retirer)
                <input
                  name="delta"
                  type="number"
                  min={-1000000}
                  max={1000000}
                  step={1}
                  required
                />
              </label>
            )}
            {form.action === "sanction" && (
              <label>
                Sanction
                <select name="kind">
                  {["warning", "mute", "suspend", "ban"].map((v) => (
                    <option value={v} key={v}>
                      {values[v]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {["sanction", "announce", "promo"].includes(form.action) && (
              <label>
                Expiration (obligatoire pour restriction ou suspension)
                <input name="expires" type="datetime-local" />
              </label>
            )}
            {["note", "ticket", "announce"].includes(form.action) && (
              <label>
                {form.action === "note"
                  ? "Note réservée à l’équipe"
                  : "Message visible par le joueur"}
                <textarea
                  name="body"
                  maxLength={form.action === "announce" ? 2000 : 5000}
                  required
                />
              </label>
            )}
            {["report", "ticket"].includes(form.action) && (
              <label>
                Statut
                <select name="status">
                  {(form.action === "report"
                    ? ["open", "reviewing", "resolved", "dismissed"]
                    : ["received", "in_progress", "resolved"]
                  ).map((v) => (
                    <option value={v} key={v}>
                      {values[v]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.action === "game" && (
              <>
                <label>
                  Jeu
                  <input name="slug" defaultValue={form.slug} required />
                </label>
                <label>
                  État
                  <select name="maintenance">
                    <option value="true">Mettre en maintenance</option>
                    <option value="false">Ouvrir les accès</option>
                  </select>
                </label>
                <label>
                  Message aux joueurs
                  <textarea name="message" maxLength={1000} />
                </label>
              </>
            )}
            {form.action === "member" && (
              <>
                <label>
                  Rôle
                  <select name="role">
                    {["support", "moderator", "admin", "owner"].map((v) => (
                      <option value={v} key={v}>
                        {values[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Accès
                  <select name="enabled">
                    <option value="true">Activé</option>
                    <option value="false">Désactivé</option>
                  </select>
                </label>
                <label>
                  Autorisation de crédit (administrateur)
                  <select name="canCredit">
                    <option value="false">Non</option>
                    <option value="true">Oui</option>
                  </select>
                </label>
              </>
            )}
            {form.action === "assign" && (
              <label>
                Identifiant du responsable (vide pour libérer)
                <input name="assignee" />
              </label>
            )}
            {form.action === "promo" && (
              <>
                <label>
                  Code
                  <input name="code" required maxLength={60} />
                </label>
                <label>
                  Pièces
                  <input
                    name="coins"
                    type="number"
                    min={1}
                    max={1000000}
                    required
                  />
                </label>
                <label>
                  Nombre maximum d’utilisations
                  <input name="limit" type="number" min={1} />
                </label>
                <label>
                  Actif
                  <select name="active">
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Motif de l’opération
              <textarea name="reason" minLength={3} maxLength={1000} required />
            </label>
            <button className="primary">Vérifier l’action</button>
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
function Fields({ data }: { data: Row }) {
  return (
    <dl>
      {Object.entries(data)
        .filter(([k]) => k !== "attachment_path")
        .map(([k, v]) => (
          <div key={k}>
            <dt>{labels[k] || k}</dt>
            <dd>{display(v, k)}</dd>
          </div>
        ))}
    </dl>
  );
}

function Observer({
  room,
  access,
  onClose,
}: {
  room: string;
  access: string;
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false,
      pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(
          `/api/spectate?${new URLSearchParams({ room, access })}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) {
          setSnapshot(data);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setSnapshot(null);
          setError((e as Error).message);
        }
      } finally {
        pending = false;
      }
    }
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [room, access]);
  return (
    <div className="overlay">
      <section
        className="dialog observer"
        role="dialog"
        aria-modal="true"
        aria-label="Spectateur administrateur"
      >
        <button className="close" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="eyebrow">LECTURE SEULE · AUCUNE PLACE JOUEUR</span>
        <h2>Vue spectateur</h2>
        <p>
          Informations publiques · Actualisation toutes les 2 secondes · Accès
          valable 30 minutes
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {snapshot ? (
          <>
            <p>
              {String(snapshot.game)} · Salon {String(snapshot.room)} ·{" "}
              {new Date(String(snapshot.observedAt)).toLocaleTimeString(
                "fr-FR",
              )}
            </p>
            {Object.entries(snapshot.publicState as Row).map(([key, value]) => (
              <section key={key} className="entry">
                <h3>{labels[key] || key}</h3>
                {Array.isArray(value) ? (
                  value.map((item, i) => (
                    <div className="entry" key={i}>
                      {item && typeof item === "object" ? (
                        <Fields data={item} />
                      ) : (
                        display(item)
                      )}
                    </div>
                  ))
                ) : value && typeof value === "object" ? (
                  <Fields data={value as Row} />
                ) : (
                  <p>{display(value, key)}</p>
                )}
              </section>
            ))}
          </>
        ) : (
          !error && <p>Connexion au serveur du jeu…</p>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [boot, setBoot] = useState(true);
  const [section, setSection] = useState("dashboard");
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ActionForm | null>(null);
  const [observer, setObserver] = useState<{
    room: string;
    access: string;
  } | null>(null);
  const sequence = useRef(0);
  const connect = useCallback(async () => {
    try {
      const s = await getData("session");
      setSession(s as unknown as Session);
      setError("");
    } catch (e) {
      setSession(null);
      setError((e as Error).message);
    } finally {
      setBoot(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void connect(), 0);
    return () => clearTimeout(timer);
  }, [connect]);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const next = await getData(section, search, target, offset);
      if (current === sequence.current) setData(next);
    } catch (e) {
      if (current === sequence.current) {
        setError((e as Error).message);
        setData(null);
      }
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }, [section, search, target, offset]);
  useEffect(() => {
    if (!session) return;
    const start = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 30000);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [session, load]);
  function navigate(next: string, id = "") {
    setData(null);
    setSection(next);
    setTarget(id);
    setOffset(0);
    setSearch("");
  }
  if (boot)
    return (
      <main className="login">
        <p>Vérification de l’accès…</p>
      </main>
    );
  if (!session)
    return (
      <>
        <Login onReady={() => void connect()} />
        {error && (
          <p className="login-error" role="status">
            {error}
          </p>
        )}
      </>
    );
  const manage = ["owner", "admin"].includes(session.role);
  const mod = ["owner", "admin", "moderator"].includes(session.role);
  const support = ["owner", "admin", "support"].includes(session.role);
  const rows = data?.rows || [];
  function openRow(row: Row) {
    if (section === "players") navigate("player", String(row.id));
    if (section === "reports") navigate("report", String(row.id));
    if (section === "tickets") navigate("ticket", String(row.id));
  }
  const rawDetail =
    section === "player"
      ? data?.profile
      : section === "report"
        ? data?.report
        : section === "ticket"
          ? data?.ticket
          : null;
  const detail =
    rawDetail && typeof rawDetail === "object" ? (rawDetail as Row) : null;
  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brandmark">R</span>
          <span>
            Revanche
            <br />
            <b>Games</b>
          </span>
        </Link>
        <span className="eyebrow">ADMINISTRATION</span>
        <nav aria-label="Administration">
          {Object.entries(titles)
            .filter(
              ([key]) =>
                !["player", "report", "ticket"].includes(key) &&
                permitted(session, key),
            )
            .map(([key, title]) => (
              <button
                aria-current={section === key ? "page" : undefined}
                className={section === key ? "selected" : ""}
                onClick={() => navigate(key)}
                key={key}
              >
                {title}
              </button>
            ))}
        </nav>
        <div className="identity">
          <span className="dot" />
          {values[session.role]}
          <small>Double authentification active</small>
          <button
            onClick={async () => {
              await browserDb().auth.signOut();
              setSession(null);
              setData(null);
            }}
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <span className="eyebrow">REVANCHE GAMES / ESPACE ÉQUIPE</span>
            <h1>{titles[section]}</h1>
          </div>
          <button onClick={() => void load()} disabled={busy}>
            {busy ? "Actualisation…" : "Actualiser"}
          </button>
        </header>
        <div className="statusline">
          <span className="dot" />
          Base commune Revanche Games{" "}
          <span>• Actualisation toutes les 30 secondes</span>
        </div>
        <div className="toolbar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = String(
                new FormData(e.currentTarget).get("search") || "",
              );
              setSearch(v);
              setOffset(0);
            }}
          >
            <input
              name="search"
              aria-label="Rechercher ou filtrer"
              placeholder="Rechercher un pseudo, identifiant ou statut…"
              maxLength={120}
            />
            <button>Rechercher</button>
          </form>
          {section === "members" && session.role === "owner" && (
            <button
              className="primary"
              onClick={() => setForm({ action: "member" })}
            >
              Gérer un membre
            </button>
          )}
          {section === "announcements" && manage && (
            <button
              className="primary"
              onClick={() => setForm({ action: "announce" })}
            >
              Publier une annonce
            </button>
          )}
          {section === "promos" && manage && (
            <button
              className="primary"
              onClick={() => setForm({ action: "promo" })}
            >
              Configurer un code
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {section === "dashboard" && data && (
          <>
            <div className="stats">
              {[
                ["players", "Joueurs inscrits"],
                ["registrations24h", "Inscriptions sur 24 h"],
                ["activeLast2m", "Actifs sur les 2 dernières minutes"],
                ["reports", "Signalements en attente"],
                ["tickets", "Tickets en attente"],
                ["purchases24h", "Achats créés sur 24 h"],
              ].map(([key, title]) => (
                <article className="stat" key={key}>
                  <span>{title}</span>
                  <strong>
                    {data[key] === null
                      ? "Accès restreint"
                      : display(data[key])}
                  </strong>
                </article>
              ))}
            </div>
            <section className="panel">
              <h2>Couverture des données</h2>
              {["presenceNote", "incidentsNote", "spectatorNote"].map((key) => (
                <p key={key}>{String(data[key] || "")}</p>
              ))}
            </section>
          </>
        )}
        {section === "rooms" && (
          <p className="notice">
            Le registre est un miroir des jeux. Vérifiez la date de mise à jour.
            Le mode spectateur affiche uniquement les informations publiques
            fournies par le serveur. L’exclusion et la fermeture ne sont pas
            encore raccordées.
          </p>
        )}
        {section === "payments" && (
          <p className="notice">
            Les paiements affichés proviennent de la boutique existante. Le
            bouton Vérifier relit le paiement auprès de Stripe et applique les
            droits confirmés avec la protection existante contre les doublons.
          </p>
        )}
        {detail && typeof detail === "object" && (
          <section className="panel">
            <h2>
              {section === "player"
                ? String((detail as Row).username)
                : "Informations du dossier"}
            </h2>
            <Fields data={detail as Row} />
            <div className="actions">
              {section === "player" && (
                <>
                  {session.canCredit && (
                    <button
                      onClick={() => setForm({ action: "wallet", target })}
                    >
                      Ajuster les pièces
                    </button>
                  )}
                  {mod && (
                    <button
                      onClick={() => setForm({ action: "sanction", target })}
                    >
                      Sanctionner
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setForm({ action: "note", target, type: "player" })
                    }
                  >
                    Note interne
                  </button>
                  {[
                    "wallet",
                    "payments",
                    "gifts",
                    "rev",
                    "sanctions",
                    "tickets",
                    "reports",
                  ]
                    .filter((key) => permitted(session, key))
                    .map((key) => (
                      <button key={key} onClick={() => navigate(key, target)}>
                        {titles[key]}
                      </button>
                    ))}
                </>
              )}
              {section === "report" && mod && (
                <>
                  <button onClick={() => setForm({ action: "report", target })}>
                    Changer le statut
                  </button>
                  <button
                    onClick={() =>
                      setForm({ action: "note", target, type: "report" })
                    }
                  >
                    Note interne
                  </button>
                  <button
                    onClick={() =>
                      setForm({ action: "assign", target, type: "report" })
                    }
                  >
                    Attribuer
                  </button>
                  {Boolean((detail as Row).target_user_id) && (
                    <button
                      onClick={() =>
                        navigate(
                          "player",
                          String((detail as Row).target_user_id),
                        )
                      }
                    >
                      Ouvrir le joueur signalé
                    </button>
                  )}
                </>
              )}
              {section === "ticket" && support && (
                <>
                  <button onClick={() => setForm({ action: "ticket", target })}>
                    Répondre au joueur
                  </button>
                  <button
                    onClick={() =>
                      setForm({ action: "note", target, type: "ticket" })
                    }
                  >
                    Note interne
                  </button>
                  <button
                    onClick={() =>
                      setForm({ action: "assign", target, type: "ticket" })
                    }
                  >
                    Attribuer
                  </button>
                </>
              )}
              {["report", "ticket"].includes(section) && (
                <a
                  className="button"
                  href={`/api/attachment?type=${section}&id=${target}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir la pièce jointe
                </a>
              )}
            </div>
          </section>
        )}
        {["player", "ticket", "report"].includes(section) &&
          data &&
          Object.entries(data)
            .filter(([key]) => !["profile", "ticket", "report"].includes(key))
            .map(([key, value]) => (
              <section className="panel" key={key}>
                <h2>
                  {{
                    notes: "Notes internes — réservées à l’équipe",
                    messages: "Échanges avec le joueur",
                    results: "Historique des parties",
                    sanctions: "Sanctions",
                    evidence: "Preuves conservées",
                    assignment: "Attribution",
                  }[key] || key}
                </h2>
                {Array.isArray(value) ? (
                  value.length ? (
                    value.map((row, i) => (
                      <div className="entry" key={String(row.id || i)}>
                        <Fields data={row} />
                      </div>
                    ))
                  ) : (
                    <p>Aucun élément.</p>
                  )
                ) : value && typeof value === "object" ? (
                  <Fields data={value as Row} />
                ) : (
                  <p>Aucun élément disponible.</p>
                )}
              </section>
            ))}
        {data?.rows && (
          <section className="panel table-panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0] || {}).map((key) => (
                      <th key={key}>{labels[key] || key}</th>
                    ))}
                    {rows.length > 0 && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={String(row.id || row.user_id || row.slug || index)}
                    >
                      {Object.entries(row).map(([key, value]) => (
                        <td key={key} title={display(value, key)}>
                          <span
                            className={
                              ["status", "state", "kind"].includes(key)
                                ? "badge"
                                : ""
                            }
                          >
                            {display(value, key)}
                          </span>
                        </td>
                      ))}
                      <td>
                        <div className="row-actions">
                          {["players", "reports", "tickets"].includes(
                            section,
                          ) && (
                            <button onClick={() => openRow(row)}>Ouvrir</button>
                          )}
                          {section === "payments" && session.canCredit && (
                            <button
                              onClick={() =>
                                setForm({
                                  action: "reconcile",
                                  target: String(row.id),
                                })
                              }
                            >
                              Vérifier
                            </button>
                          )}
                          {section === "rooms" && mod && (
                            <button
                              onClick={() =>
                                setForm({
                                  action: "spectate",
                                  target: String(row.id),
                                })
                              }
                            >
                              Observer
                            </button>
                          )}
                          {section === "sanctions" &&
                            mod &&
                            !row.revoked_at && (
                              <button
                                onClick={() =>
                                  setForm({
                                    action: "revoke",
                                    target: String(row.id),
                                  })
                                }
                              >
                                Lever
                              </button>
                            )}
                          {section === "games" && manage && (
                            <button
                              onClick={() =>
                                setForm({
                                  action: "game",
                                  slug: String(row.slug),
                                })
                              }
                            >
                              Configurer
                            </button>
                          )}
                          {section === "members" &&
                            session.role === "owner" && (
                              <button
                                onClick={() =>
                                  setForm({
                                    action: "member",
                                    target: String(row.user_id),
                                  })
                                }
                              >
                                Gérer
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="empty">
                  <h2>Aucun résultat</h2>
                  <p>Aucune donnée ne correspond à cette recherche.</p>
                </div>
              )}
            </div>
          </section>
        )}
        {section !== "dashboard" && (
          <footer>
            <span>
              {data?.total !== undefined ? `${data.total} résultat(s) · ` : ""}
              Page {Math.floor(offset / 50) + 1}
            </span>
            <div className="actions">
              <button
                disabled={offset === 0 || busy}
                onClick={() => setOffset((v) => Math.max(0, v - 50))}
              >
                Précédent
              </button>
              <button
                disabled={busy || (data?.rows ? rows.length < 50 : false)}
                onClick={() => setOffset((v) => v + 50)}
              >
                Suivant
              </button>
            </div>
          </footer>
        )}
      </main>
      {observer && (
        <Observer
          room={observer.room}
          access={observer.access}
          onClose={() => setObserver(null)}
        />
      )}{" "}
      {form && (
        <ActionDialog
          form={form}
          onClose={() => setForm(null)}
          onDone={(_result, id) => {
            if (form.action === "spectate" && form.target)
              setObserver({ room: form.target, access: id });
            void load();
          }}
        />
      )}
    </div>
  );
}
