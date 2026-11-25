import type { Metadata } from "next";
import { LibraryView } from "@/components/library/LibraryView";

export const metadata: Metadata = { title: "Bibliothèque de jeux en ligne", description: "Retrouve le catalogue Revanche Games : jeux de cartes, quiz, stratégie et jeux multijoueurs.", alternates: { canonical: "/library" }, robots: { index: true, follow: true } };
export default function LibraryPage() {
  return <LibraryView />;
}
