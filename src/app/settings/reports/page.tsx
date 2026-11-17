import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return (
      <p className="p-8 text-text">
        <Link href="/sign-in">
          Connecte-toi pour consulter tes signalements.
        </Link>
      </p>
    );
  const page = Math.max(
    0,
    Math.min(2000, Number((await searchParams).page) || 0),
  );
  const { data, error } = await db
    .from("reports")
    .select("id,kind,context,status,created_at,resolved_at")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * 50, page * 50 + 49);
  const statuses: Record<string, string> = {
    open: "Nouveau",
    reviewing: "En cours",
    resolved: "Traité",
    dismissed: "Classé",
  };
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-5 text-text">
      <h1 className="font-display text-2xl">Mes signalements</h1>
      <p className="text-text-dim">
        Retrouve ici l’avancement de tes signalements.
      </p>
      {error ? (
        <p role="alert">Impossible de charger les signalements.</p>
      ) : !data?.length ? (
        <p>Aucun signalement sur cette page.</p>
      ) : (
        data.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="font-semibold">{statuses[r.status] || r.status}</p>
            <p>{r.context || "Revanche Games"}</p>
            <p className="text-xs text-text-dim">
              {new Date(r.created_at).toLocaleString("fr-FR")} · {r.id}
            </p>
          </article>
        ))
      )}
      <div className="flex gap-5">
        {page > 0 && <Link href={`?page=${page - 1}`}>Précédent</Link>}
        {data?.length === 50 && <Link href={`?page=${page + 1}`}>Suivant</Link>}
      </div>
      <Link href="/settings/support">Contacter l’équipe</Link>
    </main>
  );
}
export default function Page(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-text-dim">Chargement…</p>}>
      <Reports {...props} />
    </Suspense>
  );
}
