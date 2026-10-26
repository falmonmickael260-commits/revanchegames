"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, SubmitButton, FormError, FormNote } from "@/components/auth/AuthCard";

export function ResendConfirmation() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/confirmed` },
    });

    setPending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <FormNote>
        Si un compte existe pour <strong className="text-text">{email}</strong>, un nouveau lien de
        confirmation vient de lui être envoyé.
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
      <SubmitButton pending={pending}>Renvoyer l&apos;e-mail de confirmation</SubmitButton>
    </form>
  );
}
