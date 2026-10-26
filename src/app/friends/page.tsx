import { FriendsView } from "@/components/social/FriendsView";

/**
 * La page Amis est entièrement client : la liste, la présence et les demandes
 * vivent déjà dans <SocialProvider> (monté dans la coquille), qui les tient à
 * jour en temps réel. Les re-lire côté serveur n'apporterait qu'un premier
 * rendu redondant, aussitôt remplacé.
 */
export default function FriendsPage() {
  return <FriendsView />;
}
