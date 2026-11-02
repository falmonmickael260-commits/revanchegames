import { GameSessionProvider } from "@/components/game/GameSessionProvider";
import { SocialProvider } from "@/components/social/SocialProvider";
import { ShellFrame } from "./ShellFrame";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { VoiceInviteToast } from "@/components/voice/VoiceInviteToast";
import { ThemePreferenceSync } from "@/components/theme/ThemePreference";

/**
 * Les fournisseurs enveloppent la coquille entière, et non la seule page
 * /play/<slug> : c'est ce qui permet à une partie de continuer de tourner, et
 * à la présence et aux invitations de survivre, pendant que le joueur consulte
 * une autre section.
 *
 * L'ordre compte : <SocialProvider> lit la partie en cours (pour publier
 * « en partie sur… » à ses amis), il doit donc être *à l'intérieur* de
 * <GameSessionProvider>.
 * Le vocal utilise l’identité sociale et reste connecté pendant la navigation.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GameSessionProvider>
      <SocialProvider>
        <VoiceProvider><ThemePreferenceSync /><ShellFrame>{children}</ShellFrame><VoiceInviteToast /></VoiceProvider>
      </SocialProvider>
    </GameSessionProvider>
  );
}
