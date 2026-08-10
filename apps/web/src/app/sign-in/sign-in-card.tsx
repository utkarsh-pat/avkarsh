"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const errorCopy: Record<string, string> = {
  callback: "The sign-in callback was incomplete. Please try again.",
  configuration: "Sign-in is not configured for this environment yet.",
  exchange: "We could not complete your sign-in. Please try again.",
};

export function SignInCard({ error }: { error?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(error ? errorCopy[error] : undefined);

  async function signInWithGoogle() {
    setIsLoading(true);
    setMessage(undefined);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) setMessage("We could not start Google sign-in. Please try again.");
    } catch {
      setMessage("Sign-in is not configured for this environment yet.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="sign-in-shell">
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <Link className="brand" href="/">Hotel SaaS</Link>
        <p className="eyebrow">MANAGEMENT ACCESS</p>
        <h1 id="sign-in-title">Start your shift with a secure identity.</h1>
        <p className="sign-in-copy">
          Management access uses your approved Google account. Property staff PIN access
          is deliberately handled on managed hotel devices, not here.
        </p>
        {message ? <p className="form-message" role="alert">{message}</p> : null}
        <button className="google-button" onClick={signInWithGoogle} disabled={isLoading}>
          <span aria-hidden="true">G</span>
          {isLoading ? "Opening Google…" : "Continue with Google"}
        </button>
        <p className="sign-in-meta">
          By continuing, you acknowledge that access is limited by your active organization,
          property assignment, role, and tenant lifecycle.
        </p>
      </section>
    </main>
  );
}
