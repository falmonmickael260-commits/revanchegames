import { GameSessionProvider } from "@/components/game/GameSessionProvider";
import { SocialProvider } from "@/components/social/SocialProvider";
import { ShellFrame } from "./ShellFrame";

/**
 * Les deux fournisseurs enveloppent la coquille entière, et non la seule page
 * /play/<slug> : c'est ce qui permet à une partie de continuer de tourner, et
 * à la présence et aux invitations de survivre, pendant que le joueur consulte
 * une autre section.
 *
 * L'ordre compte : <SocialProvider> lit la partie en cours (pour publier
 * « en partie sur… » à ses amis), il doit donc être *à l'intérieur* de
 * <GameSessionProvider>.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GameSessionProvider>
      <SocialProvider>
        <ShellFrame>{children}</ShellFrame>
      </SocialProvider>
    </GameSessionProvider>
  );
}
