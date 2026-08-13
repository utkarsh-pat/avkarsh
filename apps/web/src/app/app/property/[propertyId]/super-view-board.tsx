import Link from "next/link";
import {
  CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Clock3, DoorOpen, IndianRupee,
  ListFilter, MessageSquareText, Plus, Search, Sparkles, UsersRound, Wrench, X,
} from "lucide-react";

export type SuperViewUnit = {
  id: string; unit_code: string; display_name: string; unit_kind: string; category: string | null;
  floor_label: string | null; max_occupancy: number; status: string; operational_state: string;
  housekeeping_assignee: string | null; nightly_rate_minor: number;
};
export type SuperViewAllocation = {
  inventory_unit_id: string; stay_period: string; status: string;
  reservations: { id: string; booking_reference: string; primary_guest_name: string; primary_guest_phone: string; adults: number; children: number; source: string; status: string; booked_amount_minor: number } | null;
};
export type SuperViewTask = { id: string; inventory_unit_id: string | null; title: string; task_type: string; status: string; priority: string; assigned_to_label: string | null };

type Props = {
  propertyId: string; inventoryMode: string; currencyCode: string; units: SuperViewUnit[];
  allocations: SuperViewAllocation[]; tasks: SuperViewTask[]; todayIso: string;
  requested: { view?: string; filter?: string; floor?: string; type?: string; q?: string; unit?: string };
};

const filters = [
  ["all", "All"], ["arriving", "Arriving"], ["occupied", "Occupied"], ["checkout_due", "Checkout due"],
  ["ready", "Vacant ready"], ["dirty", "Dirty"], ["cleaning", "Cleaning"],
  ["inspection_pending", "Inspection"], ["maintenance", "Maintenance"], ["blocked", "Blocked"],
] as const;

function parseStay(period: string) {
  const dates = period.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return { checkIn: dates[0] ?? "", checkOut: dates[1] ?? "" };
}
function pretty(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function date(value: string) { return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)) : "—"; }
function money(value: number, currency: string) { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100); }
function href(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  return `?${query.toString()}`;
}

export function SuperViewBoard({ propertyId, inventoryMode, currencyCode, units, allocations, tasks, todayIso, requested }: Props) {
  const view = ["cards", "timeline", "calendar"].includes(requested.view ?? "") ? requested.view! : "cards";
  const filter = filters.some(([value]) => value === requested.filter) ? requested.filter! : "all";
  const q = requested.q?.trim().toLowerCase() ?? "";
  const unitContexts = units.map((unit) => {
    const unitAllocations = allocations.filter((item) => item.inventory_unit_id === unit.id).map((item) => ({ ...item, stay: parseStay(item.stay_period) }));
    const current = unitAllocations.find((item) => item.stay.checkIn <= todayIso && item.stay.checkOut > todayIso && item.status !== "cancelled");
    const arriving = unitAllocations.find((item) => item.stay.checkIn === todayIso && item.status !== "cancelled");
    const checkoutDue = current?.stay.checkOut === todayIso;
    const next = unitAllocations.filter((item) => item.stay.checkIn > todayIso && item.status !== "cancelled").sort((a, b) => a.stay.checkIn.localeCompare(b.stay.checkIn))[0];
    const openTasks = tasks.filter((task) => task.inventory_unit_id === unit.id && !["completed", "closed", "cancelled"].includes(task.status));
    const occupancyState = current ? "occupied" : arriving ? "arriving" : "vacant";
    return { unit, current, arriving, checkoutDue, next, openTasks, occupancyState };
  });
  const floors = [...new Set(units.map((unit) => unit.floor_label || "Unassigned"))].sort();
  const types = [...new Set(units.map((unit) => unit.category || pretty(unit.unit_kind)))].sort();
  const visible = unitContexts.filter(({ unit, current, arriving, checkoutDue, occupancyState }) => {
    const matchesFilter = filter === "all" || (filter === "occupied" && occupancyState === "occupied") || (filter === "arriving" && Boolean(arriving)) || (filter === "checkout_due" && checkoutDue) || (filter === "ready" && occupancyState === "vacant" && unit.operational_state === "ready") || unit.operational_state === filter;
    const matchesFloor = !requested.floor || (unit.floor_label || "Unassigned") === requested.floor;
    const matchesType = !requested.type || (unit.category || pretty(unit.unit_kind)) === requested.type;
    const haystack = `${unit.unit_code} ${unit.display_name} ${current?.reservations?.primary_guest_name ?? ""}`.toLowerCase();
    return matchesFilter && matchesFloor && matchesType && (!q || haystack.includes(q));
  });
  const selected = unitContexts.find(({ unit }) => unit.id === requested.unit);
  const groups = floors.map((floor) => ({ floor, items: visible.filter(({ unit }) => (unit.floor_label || "Unassigned") === floor) })).filter((group) => group.items.length);

  return <section className="super-view" aria-labelledby="super-view-title">
    <header className="super-view-heading"><div><p className="eyebrow">FLOOR COMMAND BOARD</p><h1 id="super-view-title">Super View</h1><p>{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${todayIso}T12:00:00`))}</p></div><div className="super-view-heading-actions"><nav aria-label="Super View mode">{[["cards", "Cards"], ["timeline", "Timeline"], ["calendar", "Calendar"]].map(([value, label]) => <Link key={value} href={href({ ...requested, view: value })} aria-current={view === value ? "page" : undefined}>{label}</Link>)}</nav><Link className="button primary" href={`/app/property/${propertyId}/reservations?action=new`}><Plus /> New booking</Link></div></header>
    <div className="super-view-filters">
      <nav aria-label="Operational filters">{filters.map(([value, label]) => <Link key={value} href={href({ view, filter: value, floor: requested.floor, type: requested.type, q: requested.q })} aria-current={filter === value ? "page" : undefined}>{label}<b>{unitContexts.filter(({ unit, arriving, checkoutDue, occupancyState }) => value === "all" || (value === "occupied" && occupancyState === "occupied") || (value === "arriving" && Boolean(arriving)) || (value === "checkout_due" && checkoutDue) || (value === "ready" && occupancyState === "vacant" && unit.operational_state === "ready") || unit.operational_state === value).length}</b></Link>)}</nav>
      <form><input type="hidden" name="view" value={view} /><input type="hidden" name="filter" value={filter} /><label><Search /><input name="q" defaultValue={requested.q} placeholder="Room, bed or guest" /></label><select name="floor" defaultValue={requested.floor ?? ""} aria-label="Floor or zone"><option value="">All floors / zones</option>{floors.map((floor) => <option key={floor}>{floor}</option>)}</select><select name="type" defaultValue={requested.type ?? ""} aria-label="Room or bed type"><option value="">All types</option>{types.map((type) => <option key={type}>{type}</option>)}</select><button className="button primary"><ListFilter /> Apply</button>{requested.floor || requested.type || requested.q ? <Link href={href({ view, filter })} aria-label="Clear filters"><X /></Link> : null}</form>
    </div>

    {!visible.length ? <div className="super-view-empty"><Search /><h3>No units match these filters</h3><p>Clear the filters to return to the live property board.</p><Link className="button primary" href="?view=cards&filter=all">Clear filters</Link></div> : view === "cards" ? <div className="super-view-groups">{groups.map((group) => <section key={group.floor}><header><div><strong>{group.floor}</strong><span>{group.items.length} {inventoryMode}</span></div><span>{group.items.filter((item) => item.occupancyState === "occupied").length} occupied</span></header><div className="super-view-card-grid">{group.items.map(({ unit, current, next, openTasks, occupancyState }) => <article className="super-view-card" key={unit.id} data-occupancy={occupancyState} data-operation={unit.operational_state}>
      <header><div><span><DoorOpen /></span><div><small>{unit.category || pretty(unit.unit_kind)}</small><h3>{unit.unit_code}</h3><p>{unit.display_name}</p></div></div><div className="unit-state-stack"><b>{pretty(occupancyState)}</b><span>{unit.operational_state === "ready" ? <Sparkles /> : unit.operational_state === "maintenance" ? <Wrench /> : <Clock3 />}{pretty(unit.operational_state)}</span></div><Link href={href({ ...requested, unit: unit.id })} aria-label={`Open ${unit.unit_code}`}><ChevronRight /></Link></header>
      <div className="super-view-guest">{current?.reservations ? <><small>CURRENT GUEST</small><strong>{current.reservations.primary_guest_name}</strong><p>{date(current.stay.checkIn)} → {date(current.stay.checkOut)} · {pretty(current.reservations.source)}</p></> : <><small>AVAILABILITY</small><strong>{unit.operational_state === "ready" ? "Ready to sell" : `Vacant · ${pretty(unit.operational_state)}`}</strong><p>No guest currently checked in.</p></>}</div>
      <dl><div><dt><UsersRound /> Capacity</dt><dd>{unit.max_occupancy}</dd></div><div><dt><IndianRupee /> Booked total</dt><dd>{current?.reservations ? money(current.reservations.booked_amount_minor, currencyCode) : "—"}</dd></div><div><dt><CircleAlert /> Open tasks</dt><dd>{openTasks.length}</dd></div></dl>
      <footer><div><small>NEXT ARRIVAL</small>{next?.reservations ? <><strong>{next.reservations.primary_guest_name}</strong><p>{date(next.stay.checkIn)} · {next.reservations.booking_reference}</p></> : <p>No upcoming stay</p>}</div><Link href={href({ ...requested, unit: unit.id })}>Open context</Link></footer>
    </article>)}</div></section>)}</div> : <div className={`super-view-${view}`}><header><span>Unit</span>{Array.from({ length: view === "timeline" ? 7 : 14 }, (_, index) => { const value = new Date(`${todayIso}T12:00:00`); value.setDate(value.getDate() + index); return <span key={index}>{new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric" }).format(value)}</span>; })}</header>{visible.map(({ unit }) => <div key={unit.id}><strong>{unit.unit_code}</strong>{Array.from({ length: view === "timeline" ? 7 : 14 }, (_, index) => { const value = new Date(`${todayIso}T12:00:00`); value.setDate(value.getDate() + index); const iso = value.toISOString().slice(0, 10); const stay = allocations.find((item) => item.inventory_unit_id === unit.id && (() => { const period = parseStay(item.stay_period); return period.checkIn <= iso && period.checkOut > iso; })()); return <span key={index} data-booked={Boolean(stay)} title={stay?.reservations?.primary_guest_name ?? "Available"}>{stay ? stay.reservations?.primary_guest_name?.slice(0, 1) ?? "•" : ""}</span>; })}</div>)}</div>}

    {selected ? <aside className="unit-context-drawer" aria-label={`${selected.unit.unit_code} context`}><header><div><p className="eyebrow">UNIT CONTEXT</p><h2>{selected.unit.unit_code} · {selected.unit.display_name}</h2></div><Link href={href({ ...requested, unit: undefined })} aria-label="Close unit context"><X /></Link></header><nav><span>Overview</span><span>Guest</span><span>Folio</span><span>Requests</span><span>Housekeeping</span><span>Activity</span></nav><section><div className="context-status-pair"><span><small>OCCUPANCY</small><b>{pretty(selected.occupancyState)}</b></span><span><small>READINESS</small><b>{pretty(selected.unit.operational_state)}</b></span></div>{selected.current?.reservations ? <article><UsersRound /><div><small>Current guest</small><strong>{selected.current.reservations.primary_guest_name}</strong><p>{selected.current.reservations.primary_guest_phone} · {selected.current.reservations.booking_reference}</p></div></article> : <article><CheckCircle2 /><div><small>Current guest</small><strong>No in-house guest</strong><p>This unit has no active allocation today.</p></div></article>}<article><IndianRupee /><div><small>Folio</small><strong>{selected.current?.reservations ? money(selected.current.reservations.booked_amount_minor, currencyCode) : "No active folio"}</strong><p>Payment ledger is not configured yet; no paid/due amount is inferred.</p></div></article><article><MessageSquareText /><div><small>Requests &amp; tasks</small><strong>{selected.openTasks.length} open</strong>{selected.openTasks.length ? <ul>{selected.openTasks.map((task) => <li key={task.id}>{task.title} · {pretty(task.priority)}</li>)}</ul> : <p>No open operational task for this unit.</p>}</div></article><div className="unit-context-actions"><Link className="button primary" href={`/app/property/${propertyId}/operations?action=new&unit=${selected.unit.id}`}>Create task</Link><Link className="button secondary" href={`/app/property/${propertyId}/reservations?q=${encodeURIComponent(selected.unit.unit_code)}`}><CalendarDays /> View stays</Link></div></section></aside> : null}
  </section>;
}
