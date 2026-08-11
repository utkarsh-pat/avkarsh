import Link from "next/link";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RegistrationForm } from "./registration-form";

type ExistingRequest = {
  id: string;
  property_name: string;
  status: string;
  created_at: string;
  approved_plan: string | null;
};

export default async function RegisterPage() {
  if (!getSupabasePublicConfig()) {
    return (
      <main className="setup-shell"><section className="setup-card"><p className="eyebrow">CONFIGURATION REQUIRED</p><h1>Connect Supabase before accepting requests.</h1><Link className="button primary" href="/">Back home</Link></section></main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const identity = typeof claims?.email === "string"
    ? {
        email: claims.email,
        name: typeof claims.user_metadata === "object" && claims.user_metadata && "full_name" in claims.user_metadata
          ? String(claims.user_metadata.full_name ?? "")
          : "",
      }
    : undefined;

  let existingRequests: ExistingRequest[] = [];
  if (identity) {
    const { data } = await supabase
      .from("onboarding_requests")
      .select("id, property_name, status, created_at, approved_plan")
      .order("created_at", { ascending: false })
      .limit(5);
    existingRequests = (data ?? []) as ExistingRequest[];
  }

  return (
    <main className="registration-shell">
      <header className="registration-topbar"><Link className="brand" href="/">Avkarsh</Link><Link href={identity ? "/app" : "/sign-in?next=/register"}>{identity ? "Workspace" : "Sign in"}</Link></header>
      <RegistrationForm identity={identity} existingRequests={existingRequests} />
    </main>
  );
}

