export const SUPPORT_CATEGORIES = {
  missing_coins: "Paiement débité sans réception des pièces",
  payment_error: "Erreur de paiement",
  double_charge: "Double débit",
  refund: "Demande de remboursement",
  unrecognized_purchase: "Achat non reconnu",
  game_issue: "Problème technique sur un jeu",
  account_issue: "Problème de compte",
  player_report: "Signalement d’un joueur",
  other: "Autre demande",
} as const;
export const SUPPORT_STATUS = { received: "Reçue", in_progress: "En cours", resolved: "Résolue" } as const;
export type SupportTicket = {
  id: string; user_id: string; category: keyof typeof SUPPORT_CATEGORIES; subject: string;
  description: string; transaction_reference: string | null; attachment_path: string | null;
  status: keyof typeof SUPPORT_STATUS; created_at: string; updated_at: string;
};
export type SupportMessage = { id: string; author_id: string; from_admin: boolean; body: string; created_at: string };
