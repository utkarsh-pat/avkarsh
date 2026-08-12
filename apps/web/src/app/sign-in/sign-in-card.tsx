"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
  ?? "850600134378-phk6foskmdebd12003mj3nfr9c9trpi0.apps.googleusercontent.com";

type GoogleCredentialResponse = { credential?: string };

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        use_fedcm_for_button?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with";
          shape: "rectangular";
          logo_alignment: "left";
          width: number;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const errorCopy: Record<string, string> = {
  callback: "The sign-in callback was incomplete. Please try again.",
  configuration: "Sign-in is not configured for this environment yet.",
  exchange: "We could not complete your sign-in. Please try again.",
};

export function SignInCard({ error, next = "/app" }: { error?: string; next?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [message, setMessage] = useState(error ? errorCopy[error] : undefined);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const completeGoogleSignIn = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential) {
      setMessage("Google did not return a valid identity. Please try again.");
      return;
    }

    setIsLoading(true);
    setMessage(undefined);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });

      if (signInError) {
        setMessage("We could not complete Google sign-in. Please try again.");
        return;
      }

      await supabase.rpc("claim_approved_onboarding_requests");
      window.location.assign(next);
    } catch {
      setMessage("Sign-in is not configured for this environment yet.");
    } finally {
      setIsLoading(false);
    }
  }, [next]);

  const renderGoogleButton = useCallback(() => {
    if (!window.google || !googleButtonRef.current) {
      setMessage("Google sign-in could not load. Please refresh and try again.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: completeGoogleSignIn,
      use_fedcm_for_button: true,
    });
    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: Math.min(400, googleButtonRef.current.clientWidth || 400),
    });
    setIsGoogleReady(true);
  }, [completeGoogleSignIn]);

  return (
    <main className="sign-in-shell">
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <Link className="brand" href="/">Avkarsh</Link>
        <p className="eyebrow">MANAGEMENT ACCESS</p>
        <h1 id="sign-in-title">Start your shift with a secure identity.</h1>
        <p className="sign-in-copy">
          Management access uses your approved Google account. Property staff PIN access
          is deliberately handled on managed hotel devices, not here.
        </p>
        {message ? <p className="form-message" role="alert">{message}</p> : null}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={renderGoogleButton}
          onError={() => setMessage("Google sign-in could not load. Please refresh and try again.")}
        />
        <div className="google-identity-wrap" aria-busy={isLoading}>
          <div ref={googleButtonRef} className="google-identity-button" />
          {!isGoogleReady || isLoading ? (
            <div className="google-identity-status" role="status">
              {isLoading ? "Verifying your account…" : "Loading secure Google sign-in…"}
            </div>
          ) : null}
        </div>
        <p className="sign-in-meta">
          By continuing, you acknowledge that access is limited by your active organization,
          property assignment, role, and tenant lifecycle.
        </p>
        <div className="sign-in-divider"><span>New to Avkarsh?</span></div>
        <Link className="button secondary sign-in-register" href="/register">Register a property</Link>
      </section>
    </main>
  );
}
