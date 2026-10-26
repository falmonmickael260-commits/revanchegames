"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When a signup-confirmation token fails outright (expired, already used),
 * Supabase's own /auth/v1/verify sometimes can't trust the link's intended
 * destination and falls back to the bare Site URL instead — landing the
 * visitor on "/" with the error in a URL *hash* fragment (never sent to the
 * server, so /auth/callback never sees it). Catch that here and send them to
 * the same friendly result page as every other failure.
 */
export function AuthHashErrorRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!window.location.hash) return;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const errorCode = hashParams.get("error_code") ?? hashParams.get("error");
    if (!errorCode) return;

    window.history.replaceState({}, "", window.location.pathname);
    const status = errorCode === "otp_expired" ? "expired" : "error";
    router.replace(`/auth/confirmed?status=${status}`);
  }, [router]);

  return null;
}
