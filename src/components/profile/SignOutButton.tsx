"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="flex items-center gap-2 rounded-lg border border-border-soft px-3.5 py-2 font-display text-xs font-semibold uppercase tracking-wider text-text-faint transition-colors hover:border-violet/40 hover:text-violet-soft disabled:opacity-60"
    >
      <LogOut className="h-3.5 w-3.5" />
      Déconnexion
    </button>
  );
}
