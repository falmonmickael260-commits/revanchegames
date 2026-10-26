"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Maximize2, Minimize2, PowerOff } from "lucide-react";
import { useGameSession } from "./GameSessionProvider";

/**
 * L'écran de jeu immersif, et le seul endroit où l'iframe du jeu est rendue.
 *
 * Monté dans la coquille, donc jamais démonté d'une route à l'autre : quand le
 * joueur quitte /play/<slug> pour son profil, la scène est seulement mise en
 * arrière-plan (cf. `.rg-game-stage[data-backgrounded]` dans globals.css) et
 * le moteur du jeu continue de tourner, connexion temps réel comprise.
 */
export function GameViewport() {
  const { active, stop } = useGameSession();
  const pathname = usePathname();
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);

  // Quel jeu a fini de charger. Dérivé plutôt que remis à zéro par un effet :
  // changer de partie suffit à faire repasser `loaded` à faux, sans rendu
  // intermédiaire ni effet en cascade.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const activeKey = active ? `${active.slug}:${active.roomCode ?? ""}` : null;
  const loaded = activeKey !== null && loadedKey === activeKey;

  // État du plein écran, lu directement de l'API du navigateur.
  // `useSyncExternalStore` est l'outil prévu pour ça — c'est aussi ce
  // qu'utilise `createLocalStore` dans ce dépôt — et il évite le couple
  // « état React + effet de synchronisation », qui rend deux fois et peut
  // afficher brièvement une valeur fausse.
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  // Le plein écran par élément n'existe pas sur Safari iPhone : on ne propose
  // le bouton que là où il fonctionne vraiment, plutôt qu'un bouton mort.
  const canFullscreen = useSyncExternalStore(
    subscribeNever,
    () => document.fullscreenEnabled === true,
    () => false,
  );

  const toggleFullscreen = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      // Refus du navigateur (geste utilisateur manquant, politique de la page) :
      // sans conséquence, le jeu reste jouable dans la scène.
    }
  }, []);

  function minimize() {
    // Volontairement une navigation, pas un arrêt : la partie continue de
    // tourner en arrière-plan et <ResumeGamePill /> ramène dessus.
    router.push("/");
  }

  function quit() {
    stop();
    router.push("/");
  }

  if (!active) return null;

  const onThisGame = pathname === `/play/${active.slug}`;

  return (
    <>
      {/* Barre de jeu — volontairement plus fine que l'en-tête de la
          plateforme, et seule chrome affichée pendant une partie : l'en-tête
          avec sa recherche, la barre latérale et la barre d'onglets du bas sont
          masquées sur cette route, ce qui rend au jeu environ 120 px de
          hauteur sur mobile et 240 px de largeur sur ordinateur. */}
      {onThisGame && (
        <div
          className="fixed inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-border-soft bg-void/85 px-2 backdrop-blur-lg sm:px-3"
          style={{
            height: "var(--rg-game-bar-h)",
            paddingTop: "var(--rg-safe-top)",
          }}
        >
          <button
            type="button"
            onClick={minimize}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 font-display text-xs font-semibold text-text-dim transition-colors hover:bg-surface hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Plateforme</span>
          </button>

          <p className="min-w-0 flex-1 truncate text-center font-display text-sm font-semibold text-text">
            {active.name}
          </p>

          <div className="flex shrink-0 items-center gap-0.5">
            {canFullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                className="rounded-lg p-2 text-text-faint transition-colors hover:bg-surface hover:text-text"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={quit}
              aria-label="Quitter la partie"
              className="rounded-lg p-2 text-text-faint transition-colors hover:bg-violet/15 hover:text-violet-soft"
            >
              <PowerOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={stageRef}
        className="rg-game-stage"
        data-backgrounded={onThisGame ? "false" : "true"}
        // En arrière-plan, la scène est retirée de l'ordre de tabulation :
        // sans cela, Tab enverrait le focus dans un jeu invisible.
        aria-hidden={!onThisGame}
        style={onThisGame ? undefined : { top: "var(--rg-game-bar-h)" }}
      >
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-void">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-cyan" />
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-text-faint">
              Chargement de {active.name}
            </p>
          </div>
        )}

        {/* `key` sur le jeu ET le salon : changer de l'un ou de l'autre crée
            bien une iframe neuve, alors que revenir sur la même partie la
            conserve telle quelle — `src` est figée par le fournisseur de
            session (voir son commentaire). */}
        <iframe
          key={`${active.slug}:${active.roomCode ?? ""}`}
          src={active.src}
          title={active.name}
          className="rg-game-frame"
          onLoad={() => setLoadedKey(`${active.slug}:${active.roomCode ?? ""}`)}
          allow="fullscreen; autoplay; clipboard-write; gamepad; microphone"
        />
      </div>
    </>
  );
}

/** Abonnement aux changements de plein écran, pour useSyncExternalStore. */
function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/**
 * Abonnement vide : la prise en charge du plein écran est une capacité du
 * navigateur, elle ne change pas en cours de vie de la page. On la lit quand
 * même via useSyncExternalStore pour que le rendu serveur parte d'un `false`
 * franc, sans divergence d'hydratation.
 */
function subscribeNever(): () => void {
  return () => {};
}
