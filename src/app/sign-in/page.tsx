"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, Field, SubmitButton, FormError } from "@/components/auth/AuthCard";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou mot de passe incorrect."
          : signInError.message,
      );
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <AuthCard eyebrow="Revanche Game" title="Se connecter">
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
        <Field
          label="Mot de passe"
          inputProps={{
            type: "password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            autoComplete: "current-password",
            required: true,
          }}
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Se connecter</SubmitButton>
      </form>
      <div className="mt-5 flex flex-col items-center gap-2 font-body text-sm text-text-faint">
        <Link href="/reset-password" className="text-cyan hover:text-cyan-soft">
          Mot de passe oublié ?
        </Link>
        <p>
          Pas encore de compte ?{" "}
          <Link href="/sign-up" className="text-cyan hover:text-cyan-soft">
            Créer un compte
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
