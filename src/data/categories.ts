import type { GameCategory } from "@/types/game";

export type CategoryDef = {
  id: GameCategory | "tous";
  label: string;
};

export const CATEGORIES: CategoryDef[] = [
  { id: "tous", label: "Tous les jeux" },
  { id: "cartes", label: "Cartes" },
  { id: "plateau", label: "Plateau" },
  { id: "quiz", label: "Quiz & culture" },
  { id: "ambiance", label: "Ambiance & bluff" },
  { id: "strategie", label: "Stratégie" },
  { id: "action", label: "Action" },
  { id: "des", label: "Dés" },
  { id: "sport", label: "Sport & adresse" },
];
