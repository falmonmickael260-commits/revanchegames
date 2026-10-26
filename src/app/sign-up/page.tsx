"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, Field, SubmitButton, FormError, FormNote } from "@/components/auth/AuthCard";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 24) {
      setError("Le pseudonyme doit contenir entre 3 et 24 caractères.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Le pseudonyme ne peut contenir que des lettres, des chiffres et des _.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPending(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .maybeSingle();

    if (existing) {
      setPending(false);
      setError("Ce pseudonyme est déjà pris.");
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: trimmed },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/confirmed`,
      },
    });

    setPending(false);

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "Un compte existe déjà avec cette adresse e-mail."
          : signUpError.message,
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard eyebrow="Revanche Game" title="Vérifie ta boîte mail">
        <FormNote>
          Un lien de confirmation a été envoyé à <strong className="text-text">{email}</strong>.
          Clique-le pour activer ton compte — ton pseudonyme <strong className="text-text">{username}</strong>{" "}
          et tes statistiques seront alors les mêmes sur les cinq jeux.
        </FormNote>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Revanche Game"
      title="Créer un compte"
      subtitle="Un seul compte pour Kilomax, Président, Quiz Master, La Meute et 10000."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Pseudonyme"
          inputProps={{
            value: username,
            onChange: (e) => setUsername(e.target.value),
            placeholder: "ex. nexoo26",
            autoComplete: "username",
            maxLength: 24,
            required: true,
          }}
        />
        <Field
          label="Adresse e-mail"
          inputProps={{
            type: "email",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            placeholder: "toi@exemple.com",
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
            placeholder: "8 caractères minimum",
            autoComplete: "new-password",
            minLength: 8,
            required: true,
          }}
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Créer mon compte</SubmitButton>
      </form>
      <p className="mt-5 text-center font-body text-sm text-text-faint">
        Déjà un compte ?{" "}
        <Link href="/sign-in" className="text-cyan hover:text-cyan-soft">
          Se connecter
        </Link>
      </p>
    </AuthCard>
  );
}
