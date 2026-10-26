import { Suspense } from "react";
import { connection } from "next/server";
import { Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnlineCount } from "./OnlineCount";

/**
 * Les chiffres réels de la plateforme, en tête de l'accueil.
 *
 * `registered_players` est un `count(*)` sur `profiles`, calculé à chaque
 * requête par la fonction `platform_stats()` :
 *
 *  • il suit immédiatement les créations et suppressions de comptes ;
 *  • chaque compte n'est compté qu'une fois (c'est la clé primaire) ;
 *  • aucun visiteur anonyme n'y entre — un visiteur n'a pas de profil ;
 *  • aucune donnée privée n'intervient : `profiles` ne contient pas d'e-mail.
 *
 * Rien n'est arrondi, inventé ni gonflé. Si la base est injoignable, le bloc
 * ne s'affiche pas — plutôt qu'un chiffre faux.
 */
export function PlatformPulse() {
  return (
    <Suspense fallback={<PulseSkeleton />}>
      <PulseContent />
    </Suspense>
  );
}

function PulseSkeleton() {
  return <div className="h-[30px] w-56 animate-pulse rounded-full bg-surface" />;
}

async function PulseContent() {
  // Un vrai comptage à l'instant de la requête : `connection()` marque ce
  // sous-arbre comme dépendant de la requête, ce qui laisse la coquille de
  // l'accueil statique (Next.js 16 Cache Components).
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_stats");
  const stats = (data as { registered_players: number; games_recorded: number }[] | null)?.[0];

  if (error || !stats) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-body text-xs text-text-dim">
      <span className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-cyan" strokeWidth={2} />
        <strong className="font-display font-semibold text-text">
          {stats.registered_players.toLocaleString("fr-FR")}
        </strong>
        {stats.registered_players === 1 ? "joueur inscrit" : "joueurs inscrits"}
      </span>

      <OnlineCount />

      {stats.games_recorded > 0 && (
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber" strokeWidth={2} />
          <strong className="font-display font-semibold text-text">
            {stats.games_recorded.toLocaleString("fr-FR")}
          </strong>
          {stats.games_recorded === 1 ? "partie jouée" : "parties jouées"}
        </span>
      )}
    </div>
  );
}
