import {
  ArrowDownToLine, ArrowUpFromLine, BarChart3, BedDouble, IndianRupee,
  MessageCircleMore, Percent,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PropertyDashboardCharts } from "../dashboard-charts";

type Props = { params: Promise<{ propertyId: string }> };
type Allocation = {
  stay_period: string;
  status: string;
  reservations: { status: string; booked_amount_minor: number } | null;
};

function parseStay(period: string) {
  const dates = period.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return { checkIn: dates[0] ?? "", checkOut: dates[1] ?? "" };
}

function localIso(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function PropertyAnalyticsPage({ params }: Props) {
  if (!getSupabasePublicConfig()) redirect("/app");
  const { propertyId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/sign-in?next=/app/property/${propertyId}/analytics`);

  const [propertyResult, accessResult] = await Promise.all([
    supabase.from("properties").select("id,name,code,inventory_unit,currency_code").eq("id", propertyId).maybeSingle(),
    supabase.rpc("get_property_workspace_access", { target_property_id: propertyId }),
  ]);
  if (!propertyResult.data) notFound();
  const allowed = (accessResult.data ?? []).some((row: { permission_key: string; allowed: boolean }) => row.permission_key === "reports.read" && row.allowed);
  if (accessResult.error || !allowed) redirect(`/app/property/${propertyId}`);

  const property = propertyResult.data;
  const [unitsResult, allocationsResult, whatsappResult] = await Promise.all([
    supabase.from("inventory_units").select("id,status").eq("property_id", propertyId),
    supabase.from("reservation_allocations").select("stay_period,status,reservations(status,booked_amount_minor)").eq("property_id", propertyId).limit(4000),
    supabase.from("whatsapp_conversations").select("unread_count").eq("property_id", propertyId).eq("status", "active"),
  ]);
  if ([unitsResult, allocationsResult, whatsappResult].some((result) => result.error)) throw new Error("Property analytics could not be loaded.");

  const units = unitsResult.data ?? [];
  const allocations = (allocationsResult.data ?? []) as unknown as Allocation[];
  const activeAllocations = allocations.filter((item) => ["confirmed", "checked_in"].includes(item.status) && !["cancelled", "no_show"].includes(item.reservations?.status ?? ""));
  const todayIso = localIso(new Date());
  const occupiedToday = activeAllocations.filter((item) => { const stay = parseStay(item.stay_period); return stay.checkIn <= todayIso && stay.checkOut > todayIso; });
  const arrivalsToday = activeAllocations.filter((item) => parseStay(item.stay_period).checkIn === todayIso).length;
  const departuresToday = activeAllocations.filter((item) => parseStay(item.stay_period).checkOut === todayIso).length;
  const operationalUnits = units.filter((item) => item.status === "available").length;
  const occupancy = operationalUnits ? Math.round((occupiedToday.length / operationalUnits) * 100) : 0;
  const unreadWhatsApp = (whatsappResult.data ?? []).reduce((total, row) => total + Number(row.unread_count ?? 0), 0);
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return localIso(date); });
  const chartData = days.map((date) => {
    const daily = activeAllocations.filter((item) => { const stay = parseStay(item.stay_period); return stay.checkIn <= date && stay.checkOut > date; });
    const revenueMinor = allocations.filter((item) => parseStay(item.stay_period).checkIn === date && !["cancelled", "no_show"].includes(item.reservations?.status ?? "")).reduce((sum, item) => sum + Number(item.reservations?.booked_amount_minor ?? 0), 0);
    return { label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(`${date}T12:00:00`)), revenue: revenueMinor / 100, occupancy: operationalUnits ? Math.round((daily.length / operationalUnits) * 100) : 0 };
  });
  const sevenDayRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: property.currency_code, maximumFractionDigits: 0 });
  const metrics = [
    { label: "Occupancy today", value: `${occupancy}%`, copy: `${occupiedToday.length} of ${operationalUnits} ${property.inventory_unit}`, Icon: Percent, tone: "blue" },
    { label: "In-house", value: occupiedToday.length, copy: `Occupied ${property.inventory_unit}`, Icon: BedDouble, tone: "green" },
    { label: "Arrivals today", value: arrivalsToday, copy: "Expected check-ins", Icon: ArrowDownToLine, tone: "blue" },
    { label: "Departures today", value: departuresToday, copy: "Expected check-outs", Icon: ArrowUpFromLine, tone: "amber" },
    { label: "7-day revenue", value: money.format(sevenDayRevenue), copy: "Gross booked room value", Icon: IndianRupee, tone: "green" },
    { label: "Unread WhatsApp", value: unreadWhatsApp, copy: "Direct guest messages", Icon: MessageCircleMore, tone: "green" },
  ];
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;

  return <AppShell email={email} property={{ id: property.id, code: property.code, name: property.name }}>
    <main className="property-module-page property-analytics-page">
      <header><div><p className="eyebrow">PROPERTY SIGNALS</p><h1>Analytics</h1><p>Occupancy, revenue and guest communication trends calculated from live property records.</p></div><span><BarChart3 /></span></header>
      <section className="owner-metrics" aria-label="Property analytics overview">
        {metrics.map(({ label, value, copy, Icon, tone }) => <article key={label} data-tone={tone}><span><Icon aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{copy}</p></div></article>)}
      </section>
      <PropertyDashboardCharts data={chartData} currencyCode={property.currency_code} />
      <div className="module-notice analytics-data-note"><BarChart3 /><div><strong>Live operational analytics</strong><p>Revenue is gross booked room value, not collected payment. Payment, refund and expense analytics remain disabled until the finance ledger is implemented.</p></div></div>
    </main>
  </AppShell>;
}
