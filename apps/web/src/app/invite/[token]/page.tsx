import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClaimInvitationCard } from "./claim-card";

type PageProps = { params: Promise<{ token: string }> };

export default async function InvitationClaimPage({ params }: PageProps) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  if (!getSupabasePublicConfig()) {
    return <main className="auth-shell"><Link className="brand auth-brand" href="/">Avkarsh</Link><section className="auth-card"><h1>Supabase configuration required.</h1><p>This invitation cannot be verified until the application is connected.</p></section></main>;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
  const email = typeof data.claims.email === "string" ? data.claims.email : "Google account";

  return <main className="auth-shell"><Link className="brand auth-brand" href="/">Avkarsh</Link><ClaimInvitationCard token={token} email={email} /></main>;
}
