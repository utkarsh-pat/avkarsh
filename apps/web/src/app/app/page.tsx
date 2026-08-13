import { redirect } from "next/navigation";
import { shouldStartOnboarding } from "@/lib/app-entry";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PropertyWorkspace } from "./property-workspace";

type PropertyScope = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  currency_code: string;
};

export default async function AppPage() {
  if (!getSupabasePublicConfig()) {
    return (
      <main className="setup-shell">
        <section className="setup-card" aria-labelledby="setup-title">
          <p className="eyebrow">M1 CONFIGURATION REQUIRED</p>
          <h1 id="setup-title">Connect this app to Supabase.</h1>
          <p>
            Add the public Supabase URL and publishable key to `apps/web/.env.local`, then
            configure Google OAuth and apply the M1 database migration.
          </p>
          <a className="button primary" href="/sign-in">Back to sign-in</a>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) redirect("/sign-in");

  const [propertiesResult, platformAdminResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, code, timezone, currency_code")
      .order("name", { ascending: true }),
    supabase
      .from("platform_admins")
      .select("profile_id")
      .maybeSingle(),
  ]);

  const email = typeof claimsData.claims.email === "string"
    ? claimsData.claims.email
    : "Management user";

  const properties = (propertiesResult.data ?? []) as PropertyScope[];
  const isPlatformAdmin = Boolean(platformAdminResult.data);

  if (shouldStartOnboarding({
    propertyCount: properties.length,
    isPlatformAdmin,
    propertyAccessFailed: Boolean(propertiesResult.error),
  })) {
    redirect("/register");
  }

  const firstProperty = properties.at(0);
  if (!isPlatformAdmin && firstProperty) {
    redirect(`/app/property/${firstProperty.id}`);
  }

  return (
    <PropertyWorkspace
      email={email}
      properties={properties}
      loadError={propertiesResult.error ? "Property access could not be loaded. Please try again." : undefined}
      isPlatformAdmin={isPlatformAdmin}
    />
  );
}
