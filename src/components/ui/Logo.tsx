import Link from "next/link";
import { Crown } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`rg-logo ${compact ? "is-compact" : ""}`} aria-label="Revanche Games — Accueil">
      <span className="rg-logo-crown"><Crown aria-hidden="true" /></span>
      {!compact && <span className="rg-logo-wordmark"><strong>REVANCHE</strong><small>GAMES</small></span>}
    </Link>
  );
}
