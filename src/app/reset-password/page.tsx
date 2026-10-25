"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, Field, SubmitButton, FormError, FormNote } from "@/components/auth/AuthCard";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    setPending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard eyebrow="Revanche Game" title="Vérifie ta boîte mail">
        <FormNote>
          Si un compte existe pour <strong className="text-text">{email}</strong>, un lien de
          réinitialisation vient de lui être envoyé.
        </FormNote>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Revanche Game"
      title="Mot de passe oublié"
      subtitle="On t'envoie un lien pour en choisir un nouveau."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Adresse e-mail"
          inputProps={{
            type: "email",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            autoComplete: "email",
            required: true,
          }}
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Envoyer le lien</SubmitButton>
      </form>
    </AuthCard>
  );
}
