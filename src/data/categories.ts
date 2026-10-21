import type { GameCategory } from "@/types/game";

export type CategoryDef = {
  id: GameCategory | "tous";
  label: string;
  /** Bold, saturated tag color — broadcast-style color-coding per category. */
  color: string;
};

export const CATEGORIES: CategoryDef[] = [
  { id: "tous", label: "Tous les jeux", color: "#2fe6ff" },
  { id: "cartes", label: "Cartes", color: "#2fe6ff" },
  { id: "plateau", label: "Plateau", color: "#d9a440" },
  { id: "quiz", label: "Quiz & culture", color: "#22d6a3" },
  { id: "ambiance", label: "Ambiance & bluff", color: "#e34fd6" },
  { id: "strategie", label: "Stratégie", color: "#a855f7" },
  { id: "action", label: "Action", color: "#ff5c3d" },
  { id: "des", label: "Dés", color: "#f2c94c" },
  { id: "sport", label: "Sport & adresse", color: "#38c4ff" },
];
