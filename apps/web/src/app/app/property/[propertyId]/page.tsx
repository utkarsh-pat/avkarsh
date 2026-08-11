import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { workspaceModules } from "@/lib/workspace-modules";
import { AppShell } from "@/components/app-shell";

type PropertyContextPageProps = {
  params: Promise<{ propertyId: string }>;
};

type PropertyContext = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  timezone: string;
  currency_code: string;
};

type OrganizationContext = {
  name: string;
  lifecycle_state: string;
};

type WorkspaceAccess = {
  permission_key: string;
  allowed: boolean;
  decision: string;
};

type SubscriptionContext = {
  plan_code: string;
  status: string;
  property_limit: number;
  staff_limit: number;
  trial_ends_at: string | null;
};

function formatState(state: string) {
  return state.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default async function PropertyContextPage({ params }: PropertyContextPageProps) {
  if (!getSupabasePublicConfig()) redirect("/app");

  const { propertyId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) redirect("/sign-in");

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, organization_id, name, code, timezone, currency_code")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError) throw new Error("Property context could not be loaded.");
  if (!property) notFound();

  const propertyContext = property as PropertyContext;
  const [organizationResult, subscriptionResult, accessResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, lifecycle_state")
      .eq("id", propertyContext.organization_id)
      .maybeSingle(),
    supabase
      .from("organization_subscriptions")
      .select("plan_code, status, property_limit, staff_limit, trial_ends_at")
      .eq("organization_id", propertyContext.organization_id)
      .maybeSingle(),
    supabase.rpc("get_property_workspace_access", { target_property_id: propertyId }),
  ]);

  if (organizationResult.error) throw new Error("Organization context could not be loaded.");
  if (!organizationResult.data) notFound();

  const organization = organizationResult.data as OrganizationContext;
  const subscription = subscriptionResult.data as SubscriptionContext | null;
  const accessDecisions = (accessResult.data ?? []) as WorkspaceAccess[];
  const accessByPermission = new Map(accessDecisions.map((access) => [access.permission_key, access]));
  const enabledModules = workspaceModules.filter((module) => accessByPermission.get(module.permission)?.allowed);
  const lockedModules = workspaceModules.filter((module) => !accessByPermission.get(module.permission)?.allowed);
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : "Management user";

  return (
    <AppShell email={email} property={{ id: propertyContext.id, code: propertyContext.code, name: propertyContext.name }}>
    <main className="property-shell">
      <section className="property-dashboard" aria-labelledby="property-title">
        <Link className="back-link" href="/app">← Switch property</Link>

        <div className="property-hero">
          <div><p className="eyebrow">ACTIVE PROPERTY</p><h1 id="property-title">{propertyContext.name}</h1><p className="property-organization">{organization.name}</p></div>
          <span className="lifecycle-badge">{formatState(organization.lifecycle_state)}</span>
        </div>

        <dl className="context-strip four-column" aria-label="Property context">
          <div><dt>Timezone</dt><dd>{propertyContext.timezone}</dd></div>
          <div><dt>Currency</dt><dd>{propertyContext.currency_code}</dd></div>
          <div><dt>Access</dt><dd>{enabledModules.length} modules enabled</dd></div>
          <div><dt>Subscription</dt><dd>{subscription ? `${formatState(subscription.plan_code)} · ${formatState(subscription.status)}` : "Not available"}</dd></div>
        </dl>

        <section className="workspace-section" aria-labelledby="modules-title">
          <div className="workspace-section-heading">
            <div><p className="eyebrow">YOUR WORKSPACE</p><h2 id="modules-title">Permission-aware command centre.</h2></div>
            <p>Every module is resolved against this property, your active membership, authentication strength, explicit denies, and the tenant lifecycle.</p>
          </div>

          {accessResult.error ? <p className="form-message" role="alert">Effective permissions could not be resolved. Workspace modules are fail-closed.</p> : null}

          <div className="module-grid">
            {enabledModules.map((module) => (
              <article className="module-card" key={module.code}>
                <div className="module-card-topline"><span className="module-code" aria-hidden="true">{module.code}</span><span className="module-status enabled">Enabled</span></div>
                <h3>{module.title}</h3><p>{module.description}</p>
                {module.permission === "staff.manage" ? <Link className="module-card-link" href={`/app/property/${propertyId}/team`}>Manage team →</Link> : null}
              </article>
            ))}
          </div>

          {enabledModules.length === 0 && !accessResult.error ? (
            <div className="module-empty"><h3>No modules are enabled.</h3><p>Ask your platform administrator to review this tenant&apos;s permission set.</p></div>
          ) : null}

          {lockedModules.length > 0 ? (
            <details className="locked-modules">
              <summary>{lockedModules.length} modules not included in your access</summary>
              <div>{lockedModules.map((module) => <span key={module.permission}>{module.title}</span>)}</div>
            </details>
          ) : null}
        </section>

        <aside className="security-note" aria-labelledby="security-note-title">
          <span className="security-note-mark" aria-hidden="true">✓</span>
          <div><h2 id="security-note-title">Property and modules verified</h2><p>Opening this URL did not grant access. Property visibility came from RLS, and every module above was independently resolved from the active role.</p></div>
        </aside>
      </section>
    </main>
    </AppShell>
  );
}
