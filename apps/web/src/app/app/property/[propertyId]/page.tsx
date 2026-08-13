import { CheckCircle2, CircleHelp, ClipboardList, MessageCircleMore, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PropertyContextPageProps = { params: Promise<{ propertyId: string }> };
type PropertyContext = { id: string; organization_id: string; name: string; code: string };
type OrganizationContext = { name: string; lifecycle_state: string };

export default async function PropertyContextPage({ params }: PropertyContextPageProps) {
  if (!getSupabasePublicConfig()) redirect("/app");

  const { propertyId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/sign-in");

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, organization_id, name, code")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) throw new Error("Property dashboard could not be loaded.");
  if (!property) notFound();

  const propertyContext = property as PropertyContext;
  const [organizationResult, guestsResult, casesResult, whatsappResult] = await Promise.all([
    supabase.from("organizations").select("name, lifecycle_state").eq("id", propertyContext.organization_id).maybeSingle(),
    supabase.from("guest_profiles").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "active"),
    supabase.from("operational_cases").select("id", { count: "exact", head: true }).eq("property_id", propertyId).in("status", ["open", "in_progress", "waiting"]),
    supabase.from("whatsapp_conversations").select("unread_count").eq("property_id", propertyId).eq("status", "active"),
  ]);
  if (organizationResult.error) throw new Error("Property dashboard could not be loaded.");
  if (!organizationResult.data) notFound();

  const organization = organizationResult.data as OrganizationContext;
  const unreadWhatsApp = (whatsappResult.data ?? []).reduce((total, row) => total + Number(row.unread_count ?? 0), 0);
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : "Property owner";
  const metrics = [
    { label: "Active guests", value: guestsResult.count ?? 0, Icon: UsersRound },
    { label: "Open requests", value: casesResult.count ?? 0, Icon: ClipboardList },
    { label: "Unread WhatsApp", value: unreadWhatsApp, Icon: MessageCircleMore },
  ];

  return (
    <AppShell email={email} property={{ id: propertyContext.id, code: propertyContext.code, name: propertyContext.name }}>
      <main className="owner-dashboard-shell">
        <section className="owner-dashboard" aria-labelledby="property-title">
          <header className="owner-dashboard-header">
            <div><p className="eyebrow">PROPERTY DASHBOARD</p><h1 id="property-title">Welcome to {propertyContext.name}</h1><p>{organization.name}</p></div>
            <span className="owner-property-status"><span /> {organization.lifecycle_state === "suspended" ? "Access paused" : "Property active"}</span>
          </header>

          <section className="owner-metrics" aria-label="Property overview">
            {metrics.map(({ label, value, Icon }) => <article key={label}><span><Icon size={21} /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}
          </section>

          <section className="owner-dashboard-grid">
            <article className="owner-today-card">
              <div className="owner-section-heading"><div><p className="eyebrow">TODAY</p><h2>What needs your attention</h2></div><CircleHelp size={22} /></div>
              {(casesResult.count ?? 0) > 0 || unreadWhatsApp > 0 ? (
                <div className="owner-attention-list">
                  {(casesResult.count ?? 0) > 0 ? <div><span>{casesResult.count}</span><p><strong>Open guest requests</strong><small>Complaints, enquiries, and service requests waiting for the team.</small></p></div> : null}
                  {unreadWhatsApp > 0 ? <div><span>{unreadWhatsApp}</span><p><strong>Unread WhatsApp messages</strong><small>Guests are waiting for a reply.</small></p></div> : null}
                </div>
              ) : (
                <div className="owner-empty-state"><CheckCircle2 size={34} /><h3>You&apos;re all caught up.</h3><p>New guest requests and messages will appear here.</p></div>
              )}
            </article>

            <aside className="owner-help-card">
              <p className="eyebrow">AVKARSH SUPPORT</p><h2>Need help running the property?</h2><p>Call or message our team whenever you need onboarding or operational support.</p>
              <a className="button primary" href="https://wa.me/919027872803?text=Hi%20Avkarsh%2C%20I%20need%20help%20with%20my%20property." target="_blank" rel="noreferrer"><MessageCircleMore size={18} /> WhatsApp support</a>
              <a className="owner-support-phone" href="tel:+919027872803">+91 90278 72803</a>
            </aside>
          </section>
        </section>
      </main>
    </AppShell>
  );
}
