import Link from "next/link";
import { ArrowLeft, CalendarDays, CircleAlert, DoorOpen, IndianRupee, Phone, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StayControls } from "./stay-controls";

type Props = { params: Promise<{ propertyId: string; reservationId: string }> };
type Allocation = { id: string; inventory_unit_id: string; stay_period: string; status: string; inventory_units: { unit_code: string; display_name: string; category: string | null; floor_label: string | null; operational_state: string; nightly_rate_minor: number } | null };
function pretty(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function stay(period: string) { const dates = period.match(/\d{4}-\d{2}-\d{2}/g) ?? []; return { checkIn: dates[0] ?? "", checkOut: dates[1] ?? "" }; }
function date(value: string) { return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—"; }

export default async function ReservationDetailPage({ params }: Props) {
  if (!getSupabasePublicConfig()) redirect("/app");
  const { propertyId, reservationId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/sign-in?next=/app/property/${propertyId}/reservations/${reservationId}`);
  const [{ data: property }, accessResult, reservationResult, unitsResult] = await Promise.all([
    supabase.from("properties").select("id,name,code,currency_code,inventory_unit").eq("id", propertyId).maybeSingle(),
    supabase.rpc("get_property_workspace_access", { target_property_id: propertyId }),
    supabase.from("reservations").select("id,booking_reference,external_booking_id,primary_guest_name,primary_guest_phone,adults,children,source,status,notes,booked_amount_minor,checked_in_at,checked_out_at,created_at,reservation_allocations(id,inventory_unit_id,stay_period,status,inventory_units(unit_code,display_name,category,floor_label,operational_state,nightly_rate_minor))").eq("id", reservationId).eq("property_id", propertyId).maybeSingle(),
    supabase.from("inventory_units").select("id,unit_code,display_name,nightly_rate_minor,operational_state,status").eq("property_id", propertyId).eq("status", "available").order("unit_code"),
  ]);
  if (!property || !reservationResult.data) notFound();
  const allowed = (accessResult.data ?? []).some((row: { permission_key: string; allowed: boolean }) => row.allowed && ["reservation.manage", "stay.manage"].includes(row.permission_key));
  if (accessResult.error || !allowed) redirect(`/app/property/${propertyId}`);
  const reservation = reservationResult.data;
  const allocation = (reservation.reservation_allocations as unknown as Allocation[])[0];
  if (!allocation?.inventory_units) notFound();
  const period = stay(allocation.stay_period);
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;
  const currency = property.currency_code;
  const booked = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(reservation.booked_amount_minor) / 100);

  return <AppShell email={email} property={{ id: property.id, code: property.code, name: property.name }}><main className="stay-detail-page"><Link className="stay-back-link" href={`/app/property/${propertyId}/reservations`}><ArrowLeft /> Back to reservations</Link><header><div><p className="eyebrow">{reservation.booking_reference}</p><h1>{reservation.primary_guest_name}</h1><p>{pretty(reservation.source)} booking · {reservation.adults + reservation.children} guest{reservation.adults + reservation.children === 1 ? "" : "s"}</p></div><span className={`status-pill ${reservation.status}`}>{pretty(reservation.status)}</span></header>
    <section className="stay-context-strip"><article><DoorOpen /><div><small>{property.inventory_unit === "beds" ? "BED" : "ROOM"}</small><strong>{allocation.inventory_units.unit_code} · {allocation.inventory_units.display_name}</strong><p>{allocation.inventory_units.floor_label || "Floor not set"} · {pretty(allocation.inventory_units.operational_state)}</p></div></article><article><CalendarDays /><div><small>STAY</small><strong>{date(period.checkIn)} → {date(period.checkOut)}</strong><p>{allocation.status.replaceAll("_", " ")}</p></div></article><article><UserRound /><div><small>GUEST</small><strong>{reservation.primary_guest_name}</strong><p><Phone /> {reservation.primary_guest_phone}</p></div></article><article><IndianRupee /><div><small>BOOKED ROOM VALUE</small><strong>{booked}</strong><p>Payment ledger not configured</p></div></article></section>
    {reservation.external_booking_id ? <div className="stay-alert"><CircleAlert /><p><strong>External reference</strong>{reservation.external_booking_id}</p></div> : null}
    <StayControls propertyId={propertyId} reservationId={reservationId} status={reservation.status} currentUnitId={allocation.inventory_unit_id} currentCheckOut={period.checkOut} units={(unitsResult.data ?? []).map((unit) => ({ id: unit.id, unit_code: unit.unit_code, display_name: unit.display_name, nightly_rate_minor: Number(unit.nightly_rate_minor), operational_state: unit.operational_state }))} currencyCode={currency} />
    <section className="stay-folio-panel"><header><div><p className="eyebrow">FOLIO FOUNDATION</p><h2>Room charges</h2></div><strong>{booked}</strong></header><div><span>Accommodation · {date(period.checkIn)} to {date(period.checkOut)}</span><b>{booked}</b></div><aside><CircleAlert /><p>Paid, due, refund and settlement amounts are not inferred. Payment collection remains deferred until the append-only finance ledger is implemented.</p></aside></section>
  </main></AppShell>;
}
