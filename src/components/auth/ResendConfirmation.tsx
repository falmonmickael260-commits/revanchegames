"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, SubmitButton, FormError, FormNote } from "@/components/auth/AuthCard";

/** Délai imposé côté client entre deux demandes, en secondes. */
const COOLDOWN_SECONDS = 60;

export function ResendConfirmation() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || cooldown > 0) return;
    setError("");
    setPending(true);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      // Le lien renvoyé suit le même parcours que celui de l'inscription.
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/confirmed` },
    });

    setPending(false);
    setCooldown(COOLDOWN_SECONDS);

    if (resendError) {
      const code = `${resendError.code ?? ""} ${resendError.message}`.toLowerCase();

      // Le plafond d'envoi est la seule erreur qu'on nomme : elle concerne la
      // demande elle-même, pas l'existence du compte.
      if (code.includes("rate") || code.includes("too many") || resendError.status === 429) {
        setError("Trop de demandes. Patiente quelques minutes avant de réessayer.");
        return;
      }

      // Panne réseau ou serveur : on le dit, sans rien affirmer sur l'adresse.
      if (resendError.status && resendError.status >= 500) {
        setError("Service momentanément indisponible. Vérifie ta connexion et réessaie.");
        return;
      }

      // Tout le reste — adresse inconnue, adresse déjà confirmée — reçoit la
      // même réponse neutre que la réussite : savoir laquelle des deux
      // s'applique renseignerait un tiers sur qui est inscrit ici.
      setSent(true);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <FormNote>
        Si un compte en attente de confirmation existe pour{" "}
        <strong className="text-text">{email}</strong>, un nouveau lien vient de lui être envoyé.
        Pense à regarder dans les indésirables.
      </FormNote>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field
        label="Ton adresse e-mail"
        inputProps={{
          type: "email",
          value: email,
          onChange: (e) => setEmail(e.target.value),
          autoComplete: "email",
          placeholder: "toi@exemple.com",
          required: true,
        }}
      />
      <FormError message={error} />
      <SubmitButton pending={pending} disabled={cooldown > 0}>
        {cooldown > 0
          ? `Réessayer dans ${cooldown} s`
          : "Renvoyer l'e-mail de confirmation"}
      </SubmitButton>
    </form>
  );
}
