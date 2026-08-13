import Link from "next/link";
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, BedDouble, Building2, CircleHelp,
  IndianRupee, MessageCircleMore, MessageSquareWarning, Percent, Phone, UsersRound,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PropertyDashboardCharts } from "./dashboard-charts";
import { SuperViewBoard, type SuperViewAllocation, type SuperViewTask, type SuperViewUnit } from "./super-view-board";

type PropertyContextPageProps = { params: Promise<{ propertyId: string }>; searchParams: Promise<{ view?: string; filter?: string; floor?: string; type?: string; q?: string; unit?: string }> };
type PropertyContext = { id: string; organization_id: string; name: string; code: string; inventory_unit: string; currency_code: string };
type OrganizationContext = { name: string; lifecycle_state: string };
type OperationalCase = {
  id: string;
  case_type: string;
  subject: string;
  priority: string;
  status: string;
  source: string;
  created_at: string;
};
type WhatsAppConversation = {
  id: string;
  guest_name: string;
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
};
type DashboardAllocation = { stay_period: string; status: string; reservations: { status: string; booked_amount_minor: number } | null };

function parseStay(period: string) {
  const dates = period.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return { checkIn: dates[0] ?? "", checkOut: dates[1] ?? "" };
}

function localIso(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function PropertyContextPage({ params, searchParams }: PropertyContextPageProps) {
  if (!getSupabasePublicConfig()) redirect("/app");

  const { propertyId } = await params;
  const requested = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/sign-in");

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, organization_id, name, code, inventory_unit, currency_code")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) throw new Error("Property dashboard could not be loaded.");
  if (!property) notFound();

  const propertyContext = property as PropertyContext;
  const [organizationResult, inventoryResult, allocationsResult, tasksResult, complaintsResult, enquiriesResult, casesResult, whatsappResult, whatsappUnreadResult] = await Promise.all([
    supabase.from("organizations").select("name, lifecycle_state").eq("id", propertyContext.organization_id).maybeSingle(),
    supabase.from("inventory_units").select("id,unit_code,display_name,unit_kind,category,floor_label,max_occupancy,status,operational_state,housekeeping_assignee,nightly_rate_minor").eq("property_id", propertyId).order("unit_code"),
    supabase.from("reservation_allocations").select("inventory_unit_id,stay_period,status,reservations(id,booking_reference,primary_guest_name,primary_guest_phone,adults,children,source,status,booked_amount_minor)").eq("property_id", propertyId).limit(2000),
    supabase.from("property_tasks").select("id,inventory_unit_id,title,task_type,status,priority,assigned_to_label").eq("property_id", propertyId).not("status", "in", "(completed,closed,cancelled)").limit(1000),
    supabase.from("operational_cases").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("case_type", "complaint").in("status", ["open", "in_progress", "waiting"]),
    supabase.from("operational_cases").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("case_type", "enquiry").in("status", ["open", "in_progress", "waiting"]),
    supabase.from("operational_cases").select("id, case_type, subject, priority, status, source, created_at").eq("property_id", propertyId).in("status", ["open", "in_progress", "waiting"]).order("created_at", { ascending: false }).limit(5),
    supabase.from("whatsapp_conversations").select("id, guest_name, unread_count, last_message_preview, last_message_at").eq("property_id", propertyId).eq("status", "active").order("last_message_at", { ascending: false, nullsFirst: false }).limit(8),
    supabase.from("whatsapp_conversations").select("unread_count").eq("property_id", propertyId).eq("status", "active"),
  ]);
  if ([organizationResult, inventoryResult, allocationsResult, tasksResult, complaintsResult, enquiriesResult, casesResult, whatsappResult, whatsappUnreadResult].some((result) => result.error)) {
    throw new Error("Property dashboard could not be loaded.");
  }
  if (!organizationResult.data) notFound();

  const organization = organizationResult.data as OrganizationContext;
  const recentCases = (casesResult.data ?? []) as OperationalCase[];
  const conversations = (whatsappResult.data ?? []) as WhatsAppConversation[];
  const unreadWhatsApp = (whatsappUnreadResult.data ?? []).reduce((total, row) => total + Number(row.unread_count ?? 0), 0);
  const units = (inventoryResult.data ?? []) as SuperViewUnit[];
  const superViewAllocations = (allocationsResult.data ?? []) as unknown as SuperViewAllocation[];
  const tasks = (tasksResult.data ?? []) as SuperViewTask[];
  const allocations = superViewAllocations as unknown as DashboardAllocation[];
  const activeAllocations = allocations.filter((item) => ["confirmed", "checked_in"].includes(item.status) && !["cancelled", "no_show"].includes(item.reservations?.status ?? ""));
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : "Property owner";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const todayIso = localIso(new Date());
  const occupiedToday = activeAllocations.filter((item) => { const stay = parseStay(item.stay_period); return stay.checkIn <= todayIso && stay.checkOut > todayIso; });
  const arrivalsToday = activeAllocations.filter((item) => parseStay(item.stay_period).checkIn === todayIso).length;
  const departuresToday = activeAllocations.filter((item) => parseStay(item.stay_period).checkOut === todayIso).length;
  const operationalUnits = units.filter((item) => item.status === "available").length;
  const occupancy = operationalUnits ? Math.round((occupiedToday.length / operationalUnits) * 100) : 0;
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return localIso(date); });
  const chartData = days.map((date) => {
    const daily = activeAllocations.filter((item) => { const stay = parseStay(item.stay_period); return stay.checkIn <= date && stay.checkOut > date; });
    const revenueMinor = allocations.filter((item) => parseStay(item.stay_period).checkIn === date && !["cancelled", "no_show"].includes(item.reservations?.status ?? "")).reduce((sum, item) => sum + Number(item.reservations?.booked_amount_minor ?? 0), 0);
    return { label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(`${date}T12:00:00`)), revenue: revenueMinor / 100, occupancy: operationalUnits ? Math.round((daily.length / operationalUnits) * 100) : 0 };
  });
  const sevenDayRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const metrics = [
    { label: "Occupancy today", value: `${occupancy}%`, copy: `${occupiedToday.length} of ${operationalUnits} ${propertyContext.inventory_unit}`, Icon: Percent, tone: "blue" },
    { label: "In-house", value: occupiedToday.length, copy: `Occupied ${propertyContext.inventory_unit}`, Icon: BedDouble, tone: "green" },
    { label: "Arrivals today", value: arrivalsToday, copy: "Expected check-ins", Icon: ArrowDownToLine, tone: "blue" },
    { label: "Departures today", value: departuresToday, copy: "Expected check-outs", Icon: ArrowUpFromLine, tone: "amber" },
    { label: "7-day revenue", value: `₹${sevenDayRevenue.toLocaleString("en-IN")}`, copy: "Gross booked room value", Icon: IndianRupee, tone: "green" },
    { label: "Unread WhatsApp", value: unreadWhatsApp, copy: "Direct messages", Icon: MessageCircleMore, tone: "green" },
  ];

  return (
    <AppShell email={email} property={{ id: propertyContext.id, code: propertyContext.code, name: propertyContext.name }}>
      <main className="owner-dashboard-shell">
        <section className="owner-dashboard" aria-labelledby="property-title">
          <header className="owner-dashboard-header">
            <div><p className="eyebrow">{today.toUpperCase()}</p><h1 id="property-title">Good to see you.</h1><p>Here&apos;s what is happening at <strong>{propertyContext.name}</strong> today.</p></div>
            <span className="owner-property-status" data-paused={organization.lifecycle_state === "suspended"}><span /> {organization.lifecycle_state === "suspended" ? "Access paused" : "Property active"}</span>
          </header>

          <section className="owner-metrics" aria-label="Property overview">
            {metrics.map(({ label, value, copy, Icon, tone }) => (
              <article key={label} data-tone={tone}><span><Icon aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{copy}</p></div></article>
            ))}
          </section>

          <SuperViewBoard propertyId={propertyId} inventoryMode={propertyContext.inventory_unit} currencyCode={propertyContext.currency_code} units={units} allocations={superViewAllocations} tasks={tasks} todayIso={todayIso} requested={requested} />

          <PropertyDashboardCharts data={chartData} />

          <section className="owner-operations-grid">
            <article className="owner-panel">
              <header><div><p className="eyebrow">GUEST SERVICE</p><h2>Open requests</h2></div><span>{recentCases.length} recent</span></header>
              {recentCases.length ? (
                <div className="owner-case-feed">
                  {recentCases.map((item) => {
                    const CaseIcon = item.case_type === "complaint" ? MessageSquareWarning : CircleHelp;
                    return (
                      <div key={item.id}>
                        <span data-type={item.case_type}><CaseIcon aria-hidden="true" /></span>
                        <div><strong>{item.subject}</strong><p>{item.case_type} · {item.source.replaceAll("_", " ")}</p></div>
                        <div><small className={`owner-priority ${item.priority}`}>{item.priority}</small><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="owner-panel-empty"><CircleHelp aria-hidden="true" /><strong>No open guest requests</strong><p>New complaints and enquiries will appear here.</p></div>}
            </article>

            <article className="owner-panel">
              <header><div><p className="eyebrow">WHATSAPP DIRECT</p><h2>Guest inbox</h2></div><span>{unreadWhatsApp} unread</span></header>
              {conversations.length ? (
                <div className="owner-whatsapp-feed">
                  {conversations.slice(0, 5).map((conversation) => (
                    <Link key={conversation.id} href={`/app/property/${propertyId}/whatsapp?conversation=${conversation.id}`}>
                      <span><MessageCircleMore aria-hidden="true" /></span>
                      <div><strong>{conversation.guest_name}</strong><p>{conversation.last_message_preview || "Conversation started"}</p></div>
                      {conversation.unread_count > 0 ? <b>{conversation.unread_count}</b> : null}
                    </Link>
                  ))}
                </div>
              ) : <div className="owner-panel-empty"><MessageCircleMore aria-hidden="true" /><strong>Inbox is clear</strong><p>Guest WhatsApp conversations will appear here.</p></div>}
            </article>
          </section>

          <section className="owner-dashboard-bottom">
            <Link className="owner-team-card" href={`/app/property/${propertyId}/team`}><span><UsersRound aria-hidden="true" /></span><div><small>PROPERTY TEAM</small><strong>Manage team access</strong><p>Invite staff and control who can work in this property.</p></div><ArrowRight aria-hidden="true" /></Link>
            <aside className="owner-help-card"><Building2 aria-hidden="true" /><div><p className="eyebrow">AVKARSH SUPPORT</p><h2>Need help?</h2><p>Call or WhatsApp our team for onboarding and operations support.</p></div><div><a className="button primary" href="https://wa.me/918922035716?text=Hi%20Avkarsh%2C%20I%20need%20help%20with%20my%20property." target="_blank" rel="noreferrer"><MessageCircleMore size={18} /> WhatsApp</a><a href="tel:+918922035716"><Phone size={16} /> +91 89220 35716</a></div></aside>
          </section>
        </section>
      </main>
    </AppShell>
  );
}
