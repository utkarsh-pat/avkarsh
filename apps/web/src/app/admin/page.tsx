import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CircleHelp,
  MessageCircleMore,
  ShieldAlert,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-admin";

type DashboardStats = {
  authorized?: boolean;
  pendingApprovals?: number;
  totalListings?: number;
  totalUsers?: number;
  totalGuests?: number;
  openCases?: number;
  unreadWhatsApp?: number;
  openIncidents?: number;
  auditEventsToday?: number;
};

type RequestSummary = {
  id: string;
  property_name: string;
  organization_name: string;
  city: string;
  status: string;
  created_at: string;
};

type CaseSummary = {
  id: string;
  case_type: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
};

function number(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-IN");
}

function relativeDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const { supabase } = await requirePlatformAdmin("/admin");
  const [statsResult, requestsResult, casesResult] = await Promise.all([
    supabase.rpc("get_platform_dashboard_stats"),
    supabase.from("onboarding_requests").select("id, property_name, organization_name, city, status, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("operational_cases").select("id, case_type, subject, priority, status, created_at").in("status", ["open", "in_progress", "waiting"]).order("created_at", { ascending: false }).limit(5),
  ]);

  const stats = (statsResult.data ?? {}) as DashboardStats;
  const requests = (requestsResult.data ?? []) as RequestSummary[];
  const cases = (casesResult.data ?? []) as CaseSummary[];
  const statCards = [
    { label: "Pending approvals", value: stats.pendingApprovals, href: "/admin/onboarding", icon: AlertCircle, attention: true },
    { label: "Total listings", value: stats.totalListings, href: "/admin/listings", icon: Building2 },
    { label: "Platform users", value: stats.totalUsers, href: "/admin/users", icon: Users },
    { label: "Guest profiles", value: stats.totalGuests, href: "/admin/guests", icon: UserRoundCheck },
    { label: "Open cases", value: stats.openCases, href: "/admin/complaints", icon: CircleHelp },
    { label: "Unread WhatsApp", value: stats.unreadWhatsApp, href: "/admin/whatsapp", icon: MessageCircleMore },
  ];

  return (
    <main className="control-page">
      <section className="control-page-heading">
        <div><p className="control-kicker">PLATFORM OVERVIEW</p><h1>Hotel operations at a glance</h1><p>Approvals, properties, guests, conversations and production health across Avkarsh.</p></div>
        <span className="control-protected"><i /> Live control plane</span>
      </section>

      {statsResult.error ? <p className="control-alert error">Dashboard metrics could not be loaded.</p> : null}

      <section className="control-kpi-grid" aria-label="Platform metrics">
        {statCards.map(({ label, value, href, icon: Icon, attention }) => (
          <Link className="control-kpi-card" data-attention={attention || undefined} href={href} key={label}>
            <span><small>{label}</small><Icon aria-hidden="true" /></span>
            <strong>{number(value)}</strong>
            <em>Open details →</em>
          </Link>
        ))}
      </section>

      <section className="control-dashboard-grid">
        <article className="control-panel">
          <header><div><p className="control-kicker">LATEST DEMAND</p><h2>Owner requests</h2></div><Link href="/admin/onboarding">View queue</Link></header>
          {requests.length ? <div className="control-feed">{requests.map((request) => (
            <Link href="/admin/onboarding" key={request.id}>
              <span className="control-row-avatar">{request.property_name.slice(0, 1).toUpperCase()}</span>
              <span><strong>{request.property_name}</strong><small>{request.organization_name} · {request.city}</small></span>
              <span className={`control-status ${request.status}`}>{request.status.replaceAll("_", " ")}</span>
              <time>{relativeDate(request.created_at)}</time>
            </Link>
          ))}</div> : <div className="control-empty"><ClipboardEmpty /><p>No owner requests in the queue.</p></div>}
        </article>

        <article className="control-panel">
          <header><div><p className="control-kicker">SERVICE DESK</p><h2>Cases needing attention</h2></div><Link href="/admin/complaints">View cases</Link></header>
          {cases.length ? <div className="control-feed compact">{cases.map((item) => (
            <Link href={item.case_type === "complaint" ? "/admin/complaints" : "/admin/enquiries"} key={item.id}>
              <span className={`control-priority ${item.priority}`} aria-label={`${item.priority} priority`} />
              <span><strong>{item.subject}</strong><small>{item.case_type} · {item.status.replaceAll("_", " ")}</small></span>
              <time>{relativeDate(item.created_at)}</time>
            </Link>
          ))}</div> : <div className="control-empty"><CircleHelp aria-hidden="true" /><p>No open guest cases yet.</p></div>}
        </article>
      </section>

      <section className="control-health-strip">
        <div><ShieldAlert aria-hidden="true" /><span><strong>{number(stats.openIncidents)} open incidents</strong><small>Production triage queue</small></span></div>
        <Link href="/admin/incidents">Open incident feed</Link>
        <div><span><strong>{number(stats.auditEventsToday)} audit events today</strong><small>Append-only activity history</small></span></div>
        <Link href="/admin/audit">Review audit log</Link>
      </section>
    </main>
  );
}

function ClipboardEmpty() {
  return <Building2 aria-hidden="true" />;
}
