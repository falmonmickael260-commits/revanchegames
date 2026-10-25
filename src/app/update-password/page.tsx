"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, Field, SubmitButton, FormError } from "@/components/auth/AuthCard";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <AuthCard eyebrow="Revanche Game" title="Choisir un nouveau mot de passe">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Nouveau mot de passe"
          inputProps={{
            type: "password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            autoComplete: "new-password",
            minLength: 8,
            required: true,
          }}
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Enregistrer</SubmitButton>
      </form>
    </AuthCard>
  );
}
