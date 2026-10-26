import { GameSessionProvider } from "@/components/game/GameSessionProvider";
import { ShellFrame } from "./ShellFrame";

/**
 * Le fournisseur de session de jeu enveloppe la coquille entière, et non la
 * seule page /play/<slug> : c'est ce qui permet à une partie de continuer de
 * tourner pendant que le joueur consulte une autre section (cf.
 * GameSessionProvider et ShellFrame).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GameSessionProvider>
      <ShellFrame>{children}</ShellFrame>
    </GameSessionProvider>
  );
}
