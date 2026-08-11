import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PendingRequestActions, ProvisionedRequestActions, ProvisionedSettingsActions } from "./admin-request-actions";
import { AppShell } from "@/components/app-shell";

type OnboardingRequest = {
  id: string;
  requester_kind: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_phone: string | null;
  organization_name: string;
  property_name: string;
  property_type: string;
  room_count: number;
  address_line: string;
  city: string;
  state_region: string;
  country_code: string;
  timezone: string;
  currency_code: string;
  requested_plan: string;
  requested_permissions: string[];
  approved_permissions: string[] | null;
  approved_plan: string | null;
  approved_amount_minor: number | null;
  approved_currency_code: string | null;
  approved_billing_cycle: string | null;
  approved_trial_days: number | null;
  notes: string | null;
  review_reason: string | null;
  status: string;
  organization_id: string | null;
  property_id: string | null;
  claimed_at: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type SubscriptionSummary = {
  organization_id: string;
  property_limit: number;
  staff_limit: number;
};

function humanize(value: string) {
  return value.replaceAll("_", " ").replaceAll(".", " · ").replace(/^./, (letter) => letter.toUpperCase());
}

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default async function AdminOnboardingPage() {
  if (!getSupabasePublicConfig()) redirect("/");
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/sign-in?next=/admin/onboarding");

  const { data: platformAdmin } = await supabase
    .from("platform_admins")
    .select("admin_role, permissions")
    .maybeSingle();
  if (!platformAdmin) redirect("/app");

  const [requestsResult, subscriptionsResult] = await Promise.all([
    supabase.from("onboarding_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("organization_subscriptions").select("organization_id, property_limit, staff_limit"),
  ]);
  const requests = (requestsResult.data ?? []) as OnboardingRequest[];
  const subscriptions = new Map(
    ((subscriptionsResult.data ?? []) as SubscriptionSummary[])
      .map((subscription) => [subscription.organization_id, subscription]),
  );
  const pendingCount = requests.filter((request) => ["pending", "under_review"].includes(request.status)).length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;
  const revokedCount = requests.filter((request) => request.status === "revoked").length;
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : "Platform administrator";

  return (
    <AppShell email={email} isPlatformAdmin>
    <main className="admin-shell">
      <section className="admin-dashboard" aria-labelledby="admin-title">
        <div className="admin-heading"><div><p className="eyebrow">SAAS CONTROL PLANE</p><h1 id="admin-title">Owner onboarding</h1><p>Review identity context, grant least-privilege modules, set commercial terms, and control access lifecycle.</p></div><span className="live-admin-badge"><i aria-hidden="true" />Platform protected</span></div>
        <dl className="admin-stats"><div><dt>Awaiting review</dt><dd>{pendingCount}</dd></div><div><dt>Active approvals</dt><dd>{approvedCount}</dd></div><div><dt>Revoked</dt><dd>{revokedCount}</dd></div><div><dt>Total requests</dt><dd>{requests.length}</dd></div></dl>

        {requestsResult.error || subscriptionsResult.error ? <p className="form-message" role="alert">Some control-plane data could not be loaded.</p> : null}
        <section className="admin-queue" aria-labelledby="queue-title">
          <div className="admin-section-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h2 id="queue-title">Requests and provisioned tenants</h2></div><p>Approval is one transaction; failure cannot leave a half-created organization.</p></div>
          {requests.length === 0 ? <div className="admin-empty"><h3>No requests yet.</h3><p>New owner registrations will appear here automatically.</p></div> : (
            <div className="request-list">
              {requests.map((request) => {
                const subscription = request.organization_id ? subscriptions.get(request.organization_id) : undefined;
                return (
                <details className={`admin-request-card status-${request.status}`} key={request.id} open={request.status === "pending"}>
                  <summary>
                    <div className="request-identity"><span className="request-avatar" aria-hidden="true">{request.contact_name.slice(0, 1).toUpperCase()}</span><div><strong>{request.property_name}</strong><small>{request.organization_name} · {request.city}</small></div></div>
                    <div className="request-summary-meta"><span className={`status-pill ${request.status}`}>{humanize(request.status)}</span><time>{dateTime(request.created_at)}</time><b aria-hidden="true">⌄</b></div>
                  </summary>
                  <div className="request-detail-body">
                    <dl className="request-detail-grid">
                      <div><dt>Applicant</dt><dd>{request.contact_name}<small>{humanize(request.requester_kind)}</small></dd></div>
                      <div><dt>Contact</dt><dd>{request.contact_email}<small>{request.contact_phone}{request.whatsapp_phone ? ` · WA ${request.whatsapp_phone}` : ""}</small></dd></div>
                      <div><dt>Property</dt><dd>{humanize(request.property_type)} · {request.room_count} rooms/beds<small>{request.address_line}, {request.city}, {request.state_region}, {request.country_code}</small></dd></div>
                      <div><dt>Operating context</dt><dd>{request.timezone}<small>{request.currency_code} · requested {request.requested_plan}</small></dd></div>
                    </dl>
                    {request.notes ? <aside className="request-note"><strong>Applicant note</strong><p>{request.notes}</p></aside> : null}
                    <div className="requested-module-list"><strong>Requested modules</strong><div>{request.requested_permissions.map((permission) => <span key={permission}>{humanize(permission)}</span>)}</div></div>

                    {["pending", "under_review"].includes(request.status) ? (
                      <PendingRequestActions requestId={request.id} requestedPermissions={request.requested_permissions} requestedPlan={request.requested_plan} currencyCode={request.currency_code} />
                    ) : null}

                    {["approved", "revoked"].includes(request.status) ? (
                      <section className="provisioned-summary">
                        <div><h4>Provisioned control</h4><p>{request.approved_plan} · {request.approved_billing_cycle} · {request.approved_currency_code} {((request.approved_amount_minor ?? 0) / 100).toLocaleString("en-IN")}</p><small>{request.claimed_at ? "Owner identity claimed" : "Waiting for matching verified Google identity"}</small></div>
                        <div className="approved-permissions">{request.approved_permissions?.map((permission) => <span key={permission}>{humanize(permission)}</span>)}</div>
                        <ProvisionedSettingsActions
                          requestId={request.id}
                          approvedPermissions={request.approved_permissions ?? []}
                          plan={request.approved_plan ?? "trial"}
                          billingCycle={request.approved_billing_cycle ?? "monthly"}
                          amountMinor={request.approved_amount_minor ?? 0}
                          currencyCode={request.approved_currency_code ?? request.currency_code}
                          trialDays={request.approved_trial_days ?? 0}
                          propertyLimit={subscription?.property_limit ?? 1}
                          staffLimit={subscription?.staff_limit ?? 10}
                        />
                        <ProvisionedRequestActions requestId={request.id} status={request.status} />
                      </section>
                    ) : null}

                    {request.status === "rejected" ? <p className="rejection-summary"><strong>Rejected:</strong> {request.review_reason}</p> : null}
                  </div>
                </details>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
    </AppShell>
  );
}
