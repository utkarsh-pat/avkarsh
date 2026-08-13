import Link from "next/link";
import { BedDouble, CalendarCheck2, CalendarClock, DoorOpen, Hotel, IndianRupee, MapPin, Search, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReservationCreationControls, ReservationStatusActions } from "./reservation-controls";

type PageProps = { params: Promise<{ propertyId: string }>; searchParams: Promise<{ status?: string; q?: string }> };
type Unit = { id: string; unit_code: string; display_name: string; unit_kind: string; category: string | null; floor_label: string | null; max_occupancy: number; status: string; nightly_rate_minor: number };
type Allocation = { stay_period: string; status: string; inventory_units: { unit_code: string; display_name: string; unit_kind: string } | null };
type Reservation = { id: string; booking_reference: string; primary_guest_name: string; primary_guest_phone: string; adults: number; children: number; source: string; status: string; created_at: string; reservation_allocations: Allocation[] };
type UnitAllocation = { inventory_unit_id: string; stay_period: string; status: string; reservations: { id: string; booking_reference: string; primary_guest_name: string; primary_guest_phone: string; adults: number; children: number; status: string; booked_amount_minor: number } | null };

const statusFilters = ["all", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"] as const;

function pretty(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function parseStay(period: string) {
  const dates = period.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return { checkIn: dates[0] ?? "", checkOut: dates[1] ?? "" };
}
function displayDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default async function PropertyReservationsPage({ params, searchParams }: PageProps) {
  if (!getSupabasePublicConfig()) redirect("/app");
  const { propertyId } = await params;
  const requested = await searchParams;
  const status = statusFilters.includes(requested.status as typeof statusFilters[number]) ? requested.status! : "all";
  const query = requested.q?.trim().slice(0, 80).replace(/[,%()]/g, " ") ?? "";
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/sign-in?next=/app/property/${propertyId}/reservations`);

  const { data: property, error: propertyError } = await supabase.from("properties")
    .select("id, organization_id, name, code, property_type, inventory_unit").eq("id", propertyId).maybeSingle();
  if (propertyError) throw new Error("Reservation workspace could not be loaded.");
  if (!property) notFound();

  const accessResult = await supabase.rpc("get_property_workspace_access", { target_property_id: propertyId });
  const reservationAccess = (accessResult.data ?? []).find((row: { permission_key: string; allowed: boolean }) => row.permission_key === "reservation.manage");
  if (accessResult.error || !reservationAccess?.allowed) redirect(`/app/property/${propertyId}`);

  let reservationQuery = supabase.from("reservations")
    .select("id, booking_reference, primary_guest_name, primary_guest_phone, adults, children, source, status, created_at, reservation_allocations(stay_period,status,inventory_units(unit_code,display_name,unit_kind))")
    .eq("property_id", propertyId).order("created_at", { ascending: false }).limit(100);
  if (status !== "all") reservationQuery = reservationQuery.eq("status", status);
  if (query) reservationQuery = reservationQuery.or(`booking_reference.ilike.%${query}%,primary_guest_name.ilike.%${query}%,primary_guest_phone.ilike.%${query}%`);

  const [unitsResult, reservationsResult, activeAllocationsResult, unitAllocationsResult] = await Promise.all([
    supabase.from("inventory_units").select("id,unit_code,display_name,unit_kind,category,floor_label,max_occupancy,status,nightly_rate_minor").eq("property_id", propertyId).order("unit_code"),
    reservationQuery,
    supabase.from("reservation_allocations").select("id,status").eq("property_id", propertyId).in("status", ["confirmed", "checked_in"]),
    supabase.from("reservation_allocations").select("inventory_unit_id,stay_period,status,reservations(id,booking_reference,primary_guest_name,primary_guest_phone,adults,children,status,booked_amount_minor)").eq("property_id", propertyId).in("status", ["confirmed", "checked_in"]).limit(500),
  ]);
  if (unitsResult.error || reservationsResult.error || activeAllocationsResult.error || unitAllocationsResult.error) throw new Error("Reservation data could not be loaded.");
  const units = (unitsResult.data ?? []) as Unit[];
  const reservations = (reservationsResult.data ?? []) as unknown as Reservation[];
  const unitAllocations = (unitAllocationsResult.data ?? []) as unknown as UnitAllocation[];
  const noun = property.inventory_unit === "beds" ? "bed" : "room";
  const activeStays = reservations.filter((reservation) => reservation.status === "checked_in").length;
  const confirmed = reservations.filter((reservation) => reservation.status === "confirmed").length;
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <AppShell email={email} property={{ id: property.id, code: property.code, name: property.name }}>
      <main className="reservation-page">
        <header className="reservation-page-heading"><div><p className="eyebrow">INVENTORY &amp; STAYS</p><h1>Reservations</h1><p>Manage {property.inventory_unit === "beds" ? "bed-wise dormitory allotment" : "room-wise hotel bookings"} for {property.name}.</p></div><span><Hotel aria-hidden="true" /> {pretty(property.property_type)}</span></header>

        <section className="reservation-kpis" aria-label="Reservation summary">
          <article><span><BedDouble /></span><div><small>Total {property.inventory_unit}</small><strong>{units.length}</strong><p>{units.filter((unit) => unit.status === "available").length} available</p></div></article>
          <article><span><CalendarCheck2 /></span><div><small>Confirmed</small><strong>{confirmed}</strong><p>Upcoming bookings</p></div></article>
          <article><span><UsersRound /></span><div><small>In-house</small><strong>{activeStays}</strong><p>Currently checked in</p></div></article>
          <article><span><CalendarClock /></span><div><small>Active allocations</small><strong>{activeAllocationsResult.data?.length ?? 0}</strong><p>Confirmed + occupied</p></div></article>
        </section>

        <section className="room-board" aria-labelledby="room-board-title">
          <header><div><p className="eyebrow">LIVE FLOOR BOARD</p><h2 id="room-board-title">{property.inventory_unit === "beds" ? "Bed" : "Room"} status</h2><p>One card for identity, occupancy, guest context, stay dates and revenue.</p></div><span>{units.length} total</span></header>
          {units.length ? <div className="room-card-grid">{units.map((unit) => {
            const allocations = unitAllocations.filter((item) => item.inventory_unit_id === unit.id).map((item) => ({ ...item, stay: parseStay(item.stay_period) }));
            const current = allocations.find((item) => item.stay.checkIn <= todayIso && item.stay.checkOut > todayIso);
            const next = allocations.filter((item) => item.stay.checkIn > todayIso).sort((a, b) => a.stay.checkIn.localeCompare(b.stay.checkIn))[0];
            const state = unit.status !== "available" ? unit.status : current ? "occupied" : "available";
            return <article className="room-card" key={unit.id} data-state={state}>
              <header><div><span><DoorOpen /></span><div><small>{unit.category || pretty(unit.unit_kind)}</small><h3>{unit.unit_code}</h3><p>{unit.display_name}</p></div></div><b>{pretty(state)}</b></header>
              <dl><div><dt><MapPin /> Floor / zone</dt><dd>{unit.floor_label || "Not set"}</dd></div><div><dt><UsersRound /> Capacity</dt><dd>{unit.max_occupancy} guest{unit.max_occupancy === 1 ? "" : "s"}</dd></div><div><dt><IndianRupee /> Nightly rate</dt><dd>₹{(unit.nightly_rate_minor / 100).toLocaleString("en-IN")}</dd></div></dl>
              {current?.reservations ? <div className="room-current-guest"><small><UserRoundCheck /> CURRENT STAY</small><strong>{current.reservations.primary_guest_name}</strong><p>{displayDate(current.stay.checkIn)} → {displayDate(current.stay.checkOut)} · {current.reservations.adults + current.reservations.children} guest{current.reservations.adults + current.reservations.children === 1 ? "" : "s"}</p><footer><span>{current.reservations.booking_reference}</span><ReservationStatusActions propertyId={propertyId} reservationId={current.reservations.id} status={current.reservations.status} /></footer></div> : <div className="room-vacant"><Sparkles /><div><strong>{state === "available" ? "Ready for booking" : pretty(state)}</strong><p>{state === "available" ? "No guest is occupying this unit today." : "This unit cannot be allocated right now."}</p></div></div>}
              <footer><div><small>NEXT ARRIVAL</small>{next?.reservations ? <><strong>{next.reservations.primary_guest_name}</strong><p>{displayDate(next.stay.checkIn)} · {next.reservations.booking_reference}</p></> : <p>No upcoming reservation</p>}</div><Link href={`?q=${encodeURIComponent(unit.unit_code)}`} aria-label={`View reservations for ${unit.unit_code}`}>View stays</Link></footer>
            </article>;
          })}</div> : <div className="reservation-empty"><BedDouble /><h3>No inventory yet</h3><p>Add the first {noun} below to build your live floor board.</p></div>}
        </section>

        <ReservationCreationControls propertyId={propertyId} inventoryUnit={property.inventory_unit} units={units} />

        <section className="reservation-list-panel">
          <header><div><p className="eyebrow">BOOKING REGISTER</p><h2>Guest reservations</h2></div><span>{reservations.length} records</span></header>
          <div className="reservation-toolbar">
            <nav aria-label="Reservation status filters">{statusFilters.map((item) => <Link key={item} href={`?status=${item}${query ? `&q=${encodeURIComponent(query)}` : ""}`} aria-current={status === item ? "page" : undefined}>{pretty(item)}</Link>)}</nav>
            <form><input type="hidden" name="status" value={status} /><label><Search aria-hidden="true" /><input name="q" defaultValue={query} placeholder="Reference, guest or phone" /></label><button className="button primary">Search</button></form>
          </div>

          {reservations.length ? <div className="reservation-list">{reservations.map((reservation) => {
            const allocation = reservation.reservation_allocations[0];
            const stay = parseStay(allocation?.stay_period ?? "");
            return <article key={reservation.id}>
              <div className="reservation-unit-icon"><DoorOpen aria-hidden="true" /></div>
              <div className="reservation-guest"><small>{reservation.booking_reference}</small><strong>{reservation.primary_guest_name}</strong><p>{reservation.primary_guest_phone} · {reservation.adults + reservation.children} guest{reservation.adults + reservation.children === 1 ? "" : "s"}</p></div>
              <div className="reservation-unit"><small>{noun}</small><strong>{allocation?.inventory_units?.unit_code ?? "Unassigned"}</strong><p>{allocation?.inventory_units?.display_name}</p></div>
              <div className="reservation-dates"><small>Stay</small><strong>{displayDate(stay.checkIn)} → {displayDate(stay.checkOut)}</strong><p>{pretty(reservation.source)}</p></div>
              <div className="reservation-state"><span className={`status-pill ${reservation.status}`}>{pretty(reservation.status)}</span><ReservationStatusActions propertyId={propertyId} reservationId={reservation.id} status={reservation.status} /><Link className="reservation-open-link" href={`/app/property/${propertyId}/reservations/${reservation.id}`}>Open stay</Link></div>
            </article>;
          })}</div> : <div className="reservation-empty"><BedDouble aria-hidden="true" /><h3>No reservations found</h3><p>{units.length ? "Create the first guest reservation from the form above." : `Add your first ${noun} to start taking bookings.`}</p></div>}
        </section>
      </main>
    </AppShell>
  );
}
