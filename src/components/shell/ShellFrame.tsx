"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { AuthHashErrorRedirect } from "@/components/auth/AuthHashErrorRedirect";
import { GameViewport } from "@/components/game/GameViewport";
import { ResumeGamePill } from "@/components/game/ResumeGamePill";
import { useGameSession } from "@/components/game/GameSessionProvider";
import { ChatDock } from "@/components/chat/ChatDock";
import { InvitationToast } from "@/components/social/InvitationToast";

/**
 * La coquille de la plateforme, et l'arbitre de ce qui s'affiche autour du
 * contenu.
 *
 * Deux modes :
 *
 *  • Mode plateforme — en-tête avec recherche, barre latérale sur ordinateur,
 *    barre d'onglets sur mobile. Inchangé.
 *  • Mode immersif, sur /play/<slug> — toute cette chrome est masquée au
 *    profit de la seule barre de jeu de <GameViewport />. Sur mobile, cela
 *    rend au jeu la hauteur de l'en-tête et celle de la barre d'onglets
 *    (~120 px) ; sur ordinateur, les 240 px de la barre latérale.
 *
 * <GameViewport />, <ResumeGamePill /> et <ChatDock /> sont montés ici, hors
 * de l'arbre des routes, donc jamais démontés quand le joueur change de
 * section : c'est ce qui permet à une partie et à un chat de survivre à la
 * navigation.
 */
export function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { active } = useGameSession();

  const immersive = pathname.startsWith("/play/");
  // La page /chat tient son propre abonnement sur le même salon : le chat
  // flottant s'y met en retrait pour ne pas doubler messages et connexion.
  const onChatPage = pathname === "/chat";

  return (
    <div className="flex min-h-dvh bg-void">
      <div className="rg-grain" />
      <AuthHashErrorRedirect />

      {!immersive && <Sidebar />}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {!immersive && (
          <Suspense
            fallback={
              <div
                className="shrink-0 border-b border-border-soft bg-void/80"
                style={{ height: "var(--rg-header-h)" }}
              />
            }
          >
            <Header />
          </Suspense>
        )}

        <main
          className="min-w-0 flex-1"
          // Place réservée à la barre d'onglets du bas, mesurée et non estimée.
          // `--rg-bottom-nav-h` vaut 56 px + la zone de sécurité de l'appareil,
          // et tombe à 0 en lg où la barre latérale prend le relais. L'ancien
          // `pb-20` (80 px fixes) était trop court sur un iPhone à indicateur
          // d'accueil (56 + 34 = 90 px) : le bas des pages passait dessous.
          style={immersive ? undefined : { paddingBottom: "var(--rg-bottom-nav-h)" }}
        >
          {children}
        </main>
      </div>

      {!immersive && <BottomNav />}

      {/* Le jeu en cours : visible sur sa route, maintenu en vie ailleurs. */}
      <GameViewport />

      {/* Retour à la partie — seulement quand on l'a quittée des yeux. */}
      {active && !immersive && <ResumeGamePill />}

      {/* Chat accessible pendant toute la partie, y compris en naviguant. */}
      {active && <ChatDock suspended={onChatPage} onGameScreen={immersive} />}

      {/* Invitation reçue : par-dessus tout, y compris l'écran de jeu, où
          l'en-tête et sa cloche sont masqués. Une invitation est périssable. */}
      <InvitationToast />
    </div>
  );
}
