import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  CircleHelp,
  FileText,
  MessageCircleMore,
  MessageSquareWarning,
  Search,
  Settings,
  ShieldAlert,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { IntegrationControls } from "../integration-controls";

type PageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

const pageMeta = {
  listings: { eyebrow: "PROPERTY NETWORK", title: "Listings management", description: "Approved hotel properties, tenant lifecycle and operating context.", icon: Building2 },
  users: { eyebrow: "IDENTITY & ACCESS", title: "User management", description: "Verified management identities and their platform activity.", icon: Users },
  guests: { eyebrow: "GUEST CRM", title: "Guest profiles", description: "Property-scoped guest details, visit history, preferences and service context.", icon: UserRoundCheck },
  complaints: { eyebrow: "SERVICE RECOVERY", title: "Complaint queue", description: "Guest complaints prioritized for acknowledgement, ownership and resolution.", icon: MessageSquareWarning },
  enquiries: { eyebrow: "GUEST SERVICE", title: "Enquiries and requests", description: "Questions and service requests received across front desk, web and WhatsApp.", icon: CircleHelp },
  whatsapp: { eyebrow: "DIRECT CHANNEL", title: "WhatsApp Direct", description: "Cross-property conversation listing, unread demand, assignment and escalation tags.", icon: MessageCircleMore },
  analytics: { eyebrow: "PLATFORM INTELLIGENCE", title: "Operational analytics", description: "Live workload, adoption and risk signals across the hotel network.", icon: BarChart3 },
  incidents: { eyebrow: "RELIABILITY OPERATIONS", title: "System incidents", description: "Production errors, backend failures and operational triage state.", icon: ShieldAlert },
  audit: { eyebrow: "SECURITY HISTORY", title: "Audit logs", description: "Append-only sensitive actions with actor, target and correlation context.", icon: FileText },
  activity: { eyebrow: "PLATFORM ACTIVITY", title: "Activity logs", description: "Recent control-plane and tenant lifecycle events in chronological order.", icon: Activity },
  settings: { eyebrow: "PLATFORM CONFIGURATION", title: "Settings", description: "Support, WhatsApp, incident alerting and data-retention defaults.", icon: Settings },
} as const;

type Section = keyof typeof pageMeta;
type Row = Record<string, unknown>;
type SettingsExtras = {
  integration: { meta_app_id?: string | null; meta_credentials_configured?: boolean; webhook_verify_token_configured?: boolean; resend_credentials_configured?: boolean; resend_from_email?: string | null; resend_from_name?: string | null };
  properties: Array<{ id: string; name: string; code: string }>;
  configs: Array<{ id: string; property_id: string; business_name: string | null; display_phone_number: string; phone_number_id: string; waba_id: string; graph_api_version: string; status: string; subscribed_at: string | null; templates_synced_at: string | null; last_error: string | null }>;
  deliveryCounts: Record<string, number>;
};

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function dateTime(value: unknown) {
  if (typeof value !== "string") return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function humanize(value: unknown) {
  return text(value).replaceAll("_", " ").replaceAll(".", " · ");
}

function nestedName(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  return text((value as Row)[key]);
}

export default async function AdminSectionPage({ params, searchParams }: PageProps) {
  const [{ section }, filters] = await Promise.all([params, searchParams]);
  if (!(section in pageMeta)) notFound();
  const currentSection = section as Section;
  const meta = pageMeta[currentSection];
  const query = filters.q?.trim() ?? "";
  const { supabase } = await requirePlatformAdmin(`/admin/${section}`);
  let rows: Row[] = [];
  let errorMessage = "";
  let metrics: Array<{ label: string; value: string | number; tone?: string }> = [];
  let settingsExtras: SettingsExtras = { integration: {}, properties: [], configs: [], deliveryCounts: {} };

  if (currentSection === "listings") {
    let request = supabase.from("properties").select("id, name, code, status, timezone, currency_code, created_at, organizations(name, lifecycle_state)").order("created_at", { ascending: false }).limit(200);
    if (query) request = request.ilike("name", `%${query}%`);
    const result = await request;
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    metrics = [
      { label: "Total listings", value: rows.length },
      { label: "Active", value: rows.filter((row) => row.status === "active").length, tone: "success" },
      { label: "Inactive / closed", value: rows.filter((row) => row.status !== "active").length, tone: "warning" },
    ];
  } else if (currentSection === "users") {
    const result = await supabase.rpc("get_platform_users", { search_text: query || null, result_limit: 200 });
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    metrics = [
      { label: "Visible users", value: rows.length },
      { label: "Active actors", value: rows.filter((row) => row.actor_status === "active").length, tone: "success" },
      { label: "Signed in", value: rows.filter((row) => typeof row.last_sign_in_at === "string").length },
    ];
  } else if (currentSection === "guests") {
    let request = supabase.from("guest_profiles").select("id, full_name, phone, email, whatsapp_phone, vip_tier, total_stays, last_stay_at, status, created_at, properties(name, code)").order("created_at", { ascending: false }).limit(200);
    if (query) request = request.ilike("full_name", `%${query}%`);
    const result = await request;
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    metrics = [
      { label: "Guest profiles", value: rows.length },
      { label: "VIP guests", value: rows.filter((row) => row.vip_tier !== "standard").length },
      { label: "Active", value: rows.filter((row) => row.status === "active").length, tone: "success" },
    ];
  } else if (currentSection === "complaints" || currentSection === "enquiries") {
    const types = currentSection === "complaints" ? ["complaint"] : ["enquiry", "request", "feedback"];
    let request = supabase.from("operational_cases").select("id, case_type, source, subject, description, priority, status, created_at, first_response_at, resolved_at, guest_profiles(full_name, phone), properties(name, code)").in("case_type", types).order("created_at", { ascending: false }).limit(200);
    if (query) request = request.ilike("subject", `%${query}%`);
    if (filters.status) request = request.eq("status", filters.status);
    const result = await request;
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    metrics = [
      { label: "Total visible", value: rows.length },
      { label: "Open", value: rows.filter((row) => ["open", "in_progress", "waiting"].includes(String(row.status))).length, tone: "warning" },
      { label: "Urgent", value: rows.filter((row) => row.priority === "urgent").length, tone: "danger" },
      { label: "Resolved", value: rows.filter((row) => ["resolved", "closed"].includes(String(row.status))).length, tone: "success" },
    ];
  } else if (currentSection === "whatsapp") {
    let request = supabase.from("whatsapp_conversations").select("id, guest_name, whatsapp_phone, state, tag, unread_count, last_message_preview, last_message_at, status, properties(name, code)").order("last_message_at", { ascending: false, nullsFirst: false }).limit(200);
    if (query) request = request.ilike("guest_name", `%${query}%`);
    const result = await request;
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    metrics = [
      { label: "Conversations", value: rows.length },
      { label: "Unread", value: rows.reduce((sum, row) => sum + Number(row.unread_count ?? 0), 0), tone: "warning" },
      { label: "Direct chats", value: rows.filter((row) => row.state === "direct_chat").length, tone: "success" },
      { label: "Complaints", value: rows.filter((row) => row.tag === "complaint").length, tone: "danger" },
    ];
  } else if (currentSection === "incidents") {
    let request = supabase.from("ops_incidents").select("id, fingerprint, severity, status, source, route, title, message, occurrence_count, first_seen_at, last_seen_at, admin_note").order("last_seen_at", { ascending: false }).limit(200);
    if (query) request = request.ilike("title", `%${query}%`);
    if (filters.status) request = request.eq("status", filters.status);
    const result = await request;
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    metrics = [
      { label: "Tracked incidents", value: rows.length },
      { label: "Open", value: rows.filter((row) => !["resolved", "muted"].includes(String(row.status))).length, tone: "warning" },
      { label: "Critical", value: rows.filter((row) => row.severity === "critical").length, tone: "danger" },
      { label: "Occurrences", value: rows.reduce((sum, row) => sum + Number(row.occurrence_count ?? 0), 0) },
    ];
  } else if (currentSection === "audit" || currentSection === "activity") {
    const result = await supabase.rpc("get_platform_audit_events", { result_limit: 200 });
    rows = (result.data ?? []) as unknown as Row[];
    errorMessage = result.error?.message ?? "";
    if (query) rows = rows.filter((row) => text(row.event_name, "").toLowerCase().includes(query.toLowerCase()));
    metrics = [
      { label: "Recent events", value: rows.length },
      { label: "Platform actions", value: rows.filter((row) => row.actor_type === "platform").length },
      { label: "System events", value: rows.filter((row) => row.actor_type === "system").length },
    ];
  } else if (currentSection === "analytics") {
    const result = await supabase.rpc("get_platform_dashboard_stats");
    const stats = (result.data ?? {}) as Row;
    errorMessage = result.error?.message ?? "";
    rows = [stats];
    metrics = [
      { label: "Listings", value: Number(stats.totalListings ?? 0) },
      { label: "Users", value: Number(stats.totalUsers ?? 0) },
      { label: "Guests", value: Number(stats.totalGuests ?? 0) },
      { label: "Open cases", value: Number(stats.openCases ?? 0), tone: "warning" },
      { label: "Unread WhatsApp", value: Number(stats.unreadWhatsApp ?? 0) },
      { label: "Open incidents", value: Number(stats.openIncidents ?? 0), tone: "danger" },
    ];
  } else if (currentSection === "settings") {
    const [settingsResult, integrationResult, propertiesResult, configsResult, deliveriesResult] = await Promise.all([
      supabase.from("platform_settings").select("*").single(),
      supabase.from("platform_integrations").select("*").single(),
      supabase.from("properties").select("id,name,code").eq("status", "active").order("name"),
      supabase.from("property_whatsapp_configs").select("id,property_id,business_name,display_phone_number,phone_number_id,waba_id,graph_api_version,status,subscribed_at,templates_synced_at,last_error").order("created_at"),
      supabase.from("notification_deliveries").select("status").limit(1000),
    ]);
    rows = settingsResult.data ? [settingsResult.data as Row] : [];
    errorMessage = [settingsResult.error, integrationResult.error, propertiesResult.error, configsResult.error, deliveriesResult.error].find(Boolean)?.message ?? "";
    const deliveryCounts = (deliveriesResult.data ?? []).reduce<Record<string, number>>((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {});
    settingsExtras = {
      integration: integrationResult.data ?? {},
      properties: propertiesResult.data ?? [],
      configs: configsResult.data ?? [],
      deliveryCounts,
    };
    metrics = [
      { label: "WhatsApp", value: rows[0]?.whatsapp_enabled ? "Enabled" : "Disabled", tone: rows[0]?.whatsapp_enabled ? "success" : "warning" },
      { label: "Incident email", value: rows[0]?.incident_email_enabled ? "Enabled" : "Disabled", tone: rows[0]?.incident_email_enabled ? "success" : "warning" },
      { label: "Maintenance", value: rows[0]?.maintenance_mode ? "On" : "Off", tone: rows[0]?.maintenance_mode ? "danger" : "success" },
      { label: "Retention", value: `${Number(rows[0]?.data_retention_days ?? 0)} days` },
    ];
  }

  return (
    <main className="control-page">
      <section className="control-page-heading">
        <div><p className="control-kicker">{meta.eyebrow}</p><h1>{meta.title}</h1><p>{meta.description}</p></div>
        <span className="control-heading-icon"><meta.icon aria-hidden="true" /></span>
      </section>

      <section className="control-metric-row" aria-label={`${meta.title} summary`}>
        {metrics.map((metric) => <div key={metric.label} data-tone={metric.tone}><small>{metric.label}</small><strong>{typeof metric.value === "number" ? metric.value.toLocaleString("en-IN") : metric.value}</strong></div>)}
      </section>

      {currentSection !== "analytics" && currentSection !== "settings" ? (
        <form className="control-filterbar" method="get">
          <label><Search aria-hidden="true" /><input name="q" defaultValue={query} placeholder={`Search ${meta.title.toLowerCase()}…`} /></label>
          {["complaints", "enquiries", "incidents"].includes(currentSection) ? <select name="status" defaultValue={filters.status ?? ""} aria-label="Filter by status"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option></select> : null}
          <button className="control-primary-button" type="submit">Apply</button>
          {query || filters.status ? <Link href={`/admin/${currentSection}`}>Clear</Link> : null}
        </form>
      ) : null}

      {errorMessage ? <p className="control-alert error">This module could not load its protected data.</p> : null}
      <section className="control-panel control-table-panel">
        {currentSection === "listings" ? <ListingsTable rows={rows} /> : null}
        {currentSection === "users" ? <UsersTable rows={rows} /> : null}
        {currentSection === "guests" ? <GuestsTable rows={rows} /> : null}
        {currentSection === "complaints" || currentSection === "enquiries" ? <CasesTable rows={rows} /> : null}
        {currentSection === "whatsapp" ? <WhatsAppTable rows={rows} /> : null}
        {currentSection === "incidents" ? <IncidentsFeed rows={rows} /> : null}
        {currentSection === "audit" || currentSection === "activity" ? <AuditTable rows={rows} /> : null}
        {currentSection === "analytics" ? <AnalyticsPanel stats={rows[0] ?? {}} /> : null}
        {currentSection === "settings" ? <SettingsPanel settings={rows[0] ?? {}} extras={settingsExtras} /> : null}
      </section>
    </main>
  );
}

function EmptyRows({ copy }: { copy: string }) {
  return <div className="control-empty large"><Search aria-hidden="true" /><h2>No records yet</h2><p>{copy}</p></div>;
}

function ListingsTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="Approved hotel properties will appear here after onboarding." />;
  return <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Property</th><th>Organization</th><th>Code</th><th>Timezone</th><th>Currency</th><th>Status</th><th>Created</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td><strong>{text(row.name)}</strong></td><td>{nestedName(row.organizations, "name")}</td><td className="mono">{text(row.code)}</td><td>{text(row.timezone)}</td><td>{text(row.currency_code)}</td><td><span className={`control-status ${text(row.status, "unknown")}`}>{humanize(row.status)}</span></td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></table></div>;
}

function UsersTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="Verified management users will appear after their first successful sign-in." />;
  return <div className="control-table-wrap"><table className="control-table"><thead><tr><th>User</th><th>Email</th><th>Actor type</th><th>Status</th><th>Joined</th><th>Last activity</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td><span className="control-person"><i>{text(row.display_name, text(row.email)).slice(0, 1).toUpperCase()}</i><strong>{text(row.display_name, "Unnamed user")}</strong></span></td><td>{text(row.email)}</td><td>{humanize(row.actor_type)}</td><td><span className={`control-status ${text(row.actor_status, "unknown")}`}>{humanize(row.actor_status)}</span></td><td>{dateTime(row.joined_at)}</td><td>{dateTime(row.last_sign_in_at)}</td></tr>)}</tbody></table></div>;
}

function GuestsTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="Guest profiles will build automatically from stays, enquiries and WhatsApp conversations." />;
  return <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Guest</th><th>Contact</th><th>Property</th><th>VIP</th><th>Stays</th><th>Last stay</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td><strong>{text(row.full_name)}</strong></td><td>{text(row.phone)}<small>{text(row.email, "No email")}</small></td><td>{nestedName(row.properties, "name")}</td><td><span className={`control-status ${text(row.vip_tier, "standard")}`}>{humanize(row.vip_tier)}</span></td><td className="mono">{Number(row.total_stays ?? 0)}</td><td>{dateTime(row.last_stay_at)}</td><td><span className={`control-status ${text(row.status, "unknown")}`}>{humanize(row.status)}</span></td></tr>)}</tbody></table></div>;
}

function CasesTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="New complaints, enquiries, requests and feedback will be routed into this queue." />;
  return <div className="control-case-list">{rows.map((row) => <article key={String(row.id)}><span className={`control-priority ${text(row.priority, "normal")}`} /><div><div className="control-case-tags"><span>{humanize(row.case_type)}</span><span>{humanize(row.source)}</span><span className={`control-status ${text(row.status, "unknown")}`}>{humanize(row.status)}</span></div><h2>{text(row.subject)}</h2><p>{text(row.description)}</p><small>{nestedName(row.guest_profiles, "full_name")} · {nestedName(row.properties, "name")} · {dateTime(row.created_at)}</small></div><strong className="control-priority-copy">{humanize(row.priority)}</strong></article>)}</div>;
}

function WhatsAppTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="WhatsApp conversations will appear after a property connects its Meta Cloud API number." />;
  return <div className="control-conversation-list">{rows.map((row) => <Link href={`/admin/whatsapp/${String(row.id)}`} key={String(row.id)}><span className="control-row-avatar whatsapp">{text(row.guest_name).slice(0, 1).toUpperCase()}</span><div><h2>{text(row.guest_name)}</h2><p>{text(row.last_message_preview, "No messages yet")}</p><small>{text(row.whatsapp_phone)} · {nestedName(row.properties, "name")}</small></div><div><span className={`control-status ${text(row.state, "bot")}`}>{humanize(row.state)}</span>{row.tag ? <span className={`control-status ${text(row.tag)}`}>{humanize(row.tag)}</span> : null}</div><strong>{Number(row.unread_count ?? 0)} unread</strong><time>{dateTime(row.last_message_at)}</time></Link>)}</div>;
}

function IncidentsFeed({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="No production incidents match the current filter." />;
  return <div className="control-incident-list">{rows.map((row) => <details key={String(row.id)}><summary><span><i className={`severity-${text(row.severity, "error")}`} />{humanize(row.severity)}<b className={`control-status ${text(row.status, "new")}`}>{humanize(row.status)}</b></span><div><strong>{text(row.title)}</strong><small>{text(row.source)} · {text(row.route, "unknown route")}</small></div><span><strong>{Number(row.occurrence_count ?? 0)}</strong><small>occurrences</small></span><time>{dateTime(row.last_seen_at)}</time></summary><div className="control-incident-detail"><p>{text(row.message)}</p><code>{text(row.fingerprint)}</code>{row.admin_note ? <aside>{text(row.admin_note)}</aside> : null}</div></details>)}</div>;
}

function AuditTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyRows copy="Audit events are append-only and will appear as protected actions occur." />;
  return <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Event</th><th>Actor</th><th>Target</th><th>Reason</th><th>Occurred</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td><strong>{humanize(row.event_name)}</strong><small className="mono">{text(row.id)}</small></td><td>{humanize(row.actor_type)}</td><td>{humanize(row.target_type)}<small className="mono">{text(row.target_id)}</small></td><td>{text(row.reason_text)}</td><td>{dateTime(row.occurred_at)}</td></tr>)}</tbody></table></div>;
}

function AnalyticsPanel({ stats }: { stats: Row }) {
  const signals = [
    ["Owner conversion queue", stats.pendingApprovals, "Requests awaiting a commercial and RBAC decision"],
    ["Guest service workload", stats.openCases, "Complaints, enquiries and requests still open"],
    ["WhatsApp attention", stats.unreadWhatsApp, "Unread direct conversations across properties"],
    ["Reliability risk", stats.openIncidents, "Incidents that are not resolved or muted"],
  ];
  return <div className="control-analytics-grid">{signals.map(([label, value, copy]) => <article key={String(label)}><span>{String(label)}</span><strong>{Number(value ?? 0).toLocaleString("en-IN")}</strong><p>{String(copy)}</p></article>)}</div>;
}

function SettingsPanel({ settings, extras }: { settings: Row; extras: SettingsExtras }) {
  if (!Object.keys(settings).length) return <EmptyRows copy="Platform settings are not available." />;
  const publicConfig = getSupabasePublicConfig();
  const webhookUrl = `${publicConfig?.url ?? "https://oopllioyzufglaedbwuz.supabase.co"}/functions/v1/whatsapp-webhook`;
  const operationalSettings = { support_email: typeof settings.support_email === "string" ? settings.support_email : null, default_timezone: text(settings.default_timezone, "Asia/Kolkata"), default_currency_code: text(settings.default_currency_code, "INR"), whatsapp_enabled: Boolean(settings.whatsapp_enabled), incident_email_enabled: Boolean(settings.incident_email_enabled), maintenance_mode: Boolean(settings.maintenance_mode), data_retention_days: Number(settings.data_retention_days ?? 365) };
  return <><div className="control-settings-grid"><section><h2>Platform defaults</h2><dl><div><dt>Support email</dt><dd>{text(settings.support_email, "Not configured")}</dd></div><div><dt>Timezone</dt><dd>{text(settings.default_timezone)}</dd></div><div><dt>Currency</dt><dd>{text(settings.default_currency_code)}</dd></div><div><dt>Data retention</dt><dd>{Number(settings.data_retention_days ?? 0)} days</dd></div></dl></section><section><h2>Service switches</h2><dl><div><dt>WhatsApp provider</dt><dd>{humanize(settings.whatsapp_provider)}</dd></div><div><dt>WhatsApp Direct</dt><dd><span className={`control-status ${settings.whatsapp_enabled ? "active" : "inactive"}`}>{settings.whatsapp_enabled ? "Enabled" : "Disabled"}</span></dd></div><div><dt>Incident emails</dt><dd><span className={`control-status ${settings.incident_email_enabled ? "active" : "inactive"}`}>{settings.incident_email_enabled ? "Enabled" : "Disabled"}</span></dd></div><div><dt>Maintenance mode</dt><dd><span className={`control-status ${settings.maintenance_mode ? "critical" : "active"}`}>{settings.maintenance_mode ? "On" : "Off"}</span></dd></div></dl></section></div><IntegrationControls settings={operationalSettings} integration={extras.integration} properties={extras.properties} configs={extras.configs} webhookUrl={webhookUrl} deliveryCounts={extras.deliveryCounts} /></>;
}
