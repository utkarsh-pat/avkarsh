import Link from "next/link";
import {
  BarChart3, Building2, CheckCircle2, ClipboardCheck, FileBarChart, IndianRupee, MessageCircleMore,
  PlugZap, QrCode, Settings, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPropertyTask, updatePropertyTask } from "./actions";

const modules = {
  guests: { title: "Guests", eyebrow: "GUEST CRM", icon: UsersRound, permission: "guest.manage", copy: "Guest profiles, stay history and service context." },
  operations: { title: "Operations", eyebrow: "DAILY WORK QUEUE", icon: ClipboardCheck, permission: "stay.manage", copy: "Housekeeping, guest requests, maintenance and inspections." },
  finance: { title: "Finance", eyebrow: "REVENUE CONTROL", icon: IndianRupee, permission: "payment.manage", copy: "Booked room value today, with payment ledger status kept explicit." },
  analytics: { title: "Analytics", eyebrow: "PROPERTY SIGNALS", icon: BarChart3, permission: "reports.read", copy: "Real occupancy, reservation and operations signals." },
  reports: { title: "Reports", eyebrow: "EXPORT CENTRE", icon: FileBarChart, permission: "reports.read", copy: "Operational reports generated from property records." },
  qr: { title: "QR & Guest Portal", eyebrow: "SELF-SERVICE", icon: QrCode, permission: "property.settings", copy: "Guest-facing access and QR distribution controls." },
  setup: { title: "Property Setup", eyebrow: "INVENTORY CONFIGURATION", icon: Building2, permission: "property.settings", copy: "Property identity, allocation model and physical inventory." },
  integrations: { title: "Integrations", eyebrow: "CONNECTED SERVICES", icon: PlugZap, permission: "property.settings", copy: "WhatsApp and operational service connections." },
  settings: { title: "Settings", eyebrow: "PROPERTY ADMINISTRATION", icon: Settings, permission: "property.settings", copy: "Property preferences and access-sensitive configuration." },
} as const;

type Props = { params: Promise<{ propertyId: string; module: string }>; searchParams: Promise<{ action?: string; unit?: string; status?: string }> };
type Guest = { id: string; full_name: string; phone: string; email: string | null; vip_tier: string; total_stays: number; last_stay_at: string | null; status: string };
type Task = { id: string; inventory_unit_id: string | null; task_type: string; title: string; status: string; priority: string; assigned_to_label: string | null; created_at: string; inventory_units: { unit_code: string } | null };
function pretty(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }

export default async function PropertyModulePage({ params, searchParams }: Props) {
  if (!getSupabasePublicConfig()) redirect("/app");
  const { propertyId, module } = await params;
  const requested = await searchParams;
  const definition = modules[module as keyof typeof modules];
  if (!definition) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/sign-in?next=/app/property/${propertyId}/${module}`);
  const [{ data: property }, accessResult] = await Promise.all([
    supabase.from("properties").select("id,organization_id,name,code,property_type,inventory_unit,currency_code,address_line,city,state,country_code").eq("id", propertyId).maybeSingle(),
    supabase.rpc("get_property_workspace_access", { target_property_id: propertyId }),
  ]);
  if (!property) notFound();
  const acceptedPermissions = module === "operations" ? ["stay.manage", "guest.manage"] : module === "finance" ? ["folio.manage", "payment.manage"] : [definition.permission];
  const allowed = (accessResult.data ?? []).some((row: { permission_key: string; allowed: boolean }) => acceptedPermissions.includes(row.permission_key) && row.allowed);
  if (accessResult.error || !allowed) redirect(`/app/property/${propertyId}`);

  const [unitsResult, guestsResult, tasksResult, reservationsResult, allocationsResult, whatsappResult] = await Promise.all([
    supabase.from("inventory_units").select("id,unit_code,display_name,status,operational_state").eq("property_id", propertyId).order("unit_code"),
    module === "guests" ? supabase.from("guest_profiles").select("id,full_name,phone,email,vip_tier,total_stays,last_stay_at,status").eq("property_id", propertyId).order("last_stay_at", { ascending: false, nullsFirst: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    module === "operations" ? supabase.from("property_tasks").select("id,inventory_unit_id,task_type,title,status,priority,assigned_to_label,created_at,inventory_units(unit_code)").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    ["finance", "analytics", "reports"].includes(module) ? supabase.from("reservations").select("id,status,booked_amount_minor,created_at").eq("property_id", propertyId).limit(2000) : Promise.resolve({ data: [], error: null }),
    ["analytics", "reports"].includes(module) ? supabase.from("reservation_allocations").select("id,status,stay_period").eq("property_id", propertyId).limit(2000) : Promise.resolve({ data: [], error: null }),
    module === "integrations" ? supabase.from("property_whatsapp_configs").select("id,status,display_phone_number,business_name").eq("property_id", propertyId).limit(10) : Promise.resolve({ data: [], error: null }),
  ]);
  if ([unitsResult, guestsResult, tasksResult, reservationsResult, allocationsResult, whatsappResult].some((result) => result.error)) throw new Error(`${definition.title} could not be loaded.`);
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;
  const Icon = definition.icon;
  const units = unitsResult.data ?? [];
  const guests = (guestsResult.data ?? []) as Guest[];
  const tasks = (tasksResult.data ?? []) as unknown as Task[];
  const reservations = reservationsResult.data ?? [];
  const allocations = allocationsResult.data ?? [];
  const bookedMinor = reservations.filter((item) => !["cancelled", "no_show"].includes(String(item.status))).reduce((sum, item) => sum + Number(item.booked_amount_minor ?? 0), 0);

  return <AppShell email={email} property={{ id: property.id, code: property.code, name: property.name }}><main className="property-module-page"><header><div><p className="eyebrow">{definition.eyebrow}</p><h1>{definition.title}</h1><p>{definition.copy}</p></div><span><Icon /></span></header>
    {module === "operations" ? <><section className="module-kpis"><article><small>Open tasks</small><strong>{tasks.filter((task) => !["completed", "closed", "cancelled"].includes(task.status)).length}</strong></article><article><small>Urgent / high</small><strong>{tasks.filter((task) => ["urgent", "high"].includes(task.priority) && !["completed", "closed"].includes(task.status)).length}</strong></article><article><small>Dirty / cleaning</small><strong>{units.filter((unit) => ["dirty", "cleaning", "inspection_pending"].includes(String(unit.operational_state))).length}</strong></article></section><section className="module-split"><form action={createPropertyTask} className="module-form"><p className="eyebrow">CREATE TASK</p><h2>New operational task</h2><input type="hidden" name="propertyId" value={propertyId} /><label>Task type<select name="taskType" defaultValue="housekeeping"><option value="housekeeping">Housekeeping</option><option value="guest_request">Guest request</option><option value="maintenance">Maintenance</option><option value="inspection">Inspection</option><option value="lost_found">Lost &amp; found</option><option value="general">General</option></select></label><label>Room / bed<select name="inventoryUnitId" defaultValue={requested.unit ?? ""}><option value="">Property-wide</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_code} · {unit.display_name}</option>)}</select></label><label>Task<input name="title" minLength={2} maxLength={180} required placeholder="What needs to be done?" /></label><div><label>Priority<select name="priority" defaultValue="normal"><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label><label>Assign to<input name="assignedToLabel" maxLength={120} placeholder="Name or shift" /></label></div><button className="button primary"><ClipboardCheck /> Create task</button></form><section className="module-records"><header><div><p className="eyebrow">LIVE QUEUE</p><h2>Operations board</h2></div><span>{tasks.length} records</span></header>{tasks.length ? tasks.map((task) => <article key={task.id} data-priority={task.priority}><div><small>{pretty(task.task_type)} · {task.inventory_units?.unit_code ?? "Property"}</small><strong>{task.title}</strong><p>{task.assigned_to_label ? `Assigned to ${task.assigned_to_label}` : "Unassigned"}</p></div><form action={updatePropertyTask}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="taskId" value={task.id} /><select name="status" defaultValue={task.status}><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button>Save</button></form></article>) : <div className="module-empty"><CheckCircle2 /><strong>No operational tasks yet</strong><p>Create the first task from this page or a Super View unit.</p></div>}</section></section></> : null}
    {module === "guests" ? <section className="module-records module-wide"><header><div><p className="eyebrow">GUEST DIRECTORY</p><h2>{guests.length} profiles</h2></div></header>{guests.length ? guests.map((guest) => <article key={guest.id}><div><small>{pretty(guest.vip_tier)} · {guest.total_stays} stays</small><strong>{guest.full_name}</strong><p>{guest.phone}{guest.email ? ` · ${guest.email}` : ""}</p></div><span className={`status-pill ${guest.status}`}>{pretty(guest.status)}</span></article>) : <div className="module-empty"><UsersRound /><strong>No guest profiles yet</strong><p>Guest profiles will be linked as reservations are created.</p></div>}</section> : null}
    {module === "finance" ? <><section className="module-kpis"><article><small>Gross booked value</small><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: property.currency_code, maximumFractionDigits: 0 }).format(bookedMinor / 100)}</strong></article><article><small>Payment ledger</small><strong>Not configured</strong></article><article><small>Expenses</small><strong>Not configured</strong></article></section><div className="module-notice"><IndianRupee /><div><strong>No fake paid or due totals</strong><p>Reservation value is live. Payment collection, refunds, expenses and cash closing require the next finance-ledger migration before they can be recorded safely.</p></div></div></> : null}
    {module === "analytics" || module === "reports" ? <><section className="module-kpis"><article><small>Inventory</small><strong>{units.length}</strong></article><article><small>Reservations</small><strong>{reservations.length}</strong></article><article><small>Allocations</small><strong>{allocations.length}</strong></article></section><div className="module-notice"><FileBarChart /><div><strong>{module === "reports" ? "Report foundation is live" : "Property signals are live"}</strong><p>These totals come from property-scoped records. Revenue exports will be enabled after the payment ledger exists.</p></div></div></> : null}
    {module === "qr" ? <div className="module-notice"><QrCode /><div><strong>Guest portal is not published yet</strong><p>The secure portal token, QR lifecycle and public guest actions need a dedicated RLS migration. No insecure public link has been generated.</p></div></div> : null}
    {module === "setup" || module === "settings" ? <section className="module-detail-grid"><article><small>Property</small><strong>{property.name}</strong><p>{pretty(property.property_type)} · Allocated by {property.inventory_unit}</p></article><article><small>Location</small><strong>{[property.city, property.state].filter(Boolean).join(", ") || "Map location on file"}</strong><p>{property.address_line || "No formatted address"}</p></article><article><small>Inventory</small><strong>{units.length} {property.inventory_unit}</strong><p>{units.filter((unit) => unit.status === "available").length} enabled</p></article></section> : null}
    {module === "integrations" ? <div className="module-notice"><MessageCircleMore /><div><strong>{whatsappResult.data?.length ? "WhatsApp account connected" : "WhatsApp is not connected"}</strong><p>{whatsappResult.data?.length ? "Connected account details are available to authorized property administrators." : "Connect the WhatsApp business account before inbox messages can be received."}</p><Link className="button secondary" href={`/app/property/${propertyId}/whatsapp`}>Open Inbox</Link></div></div> : null}
    {module === "settings" ? <div className="module-notice"><ShieldCheck /><div><strong>Permission-aware settings</strong><p>Only members with property settings permission can open this route. Team roles remain managed separately.</p><Link className="button secondary" href={`/app/property/${propertyId}/team`}>Manage team access</Link></div></div> : null}
    {module === "setup" && !units.length ? <div className="module-notice"><Sparkles /><div><strong>Inventory setup is incomplete</strong><p>Add the property&apos;s first {property.inventory_unit === "beds" ? "bed" : "room"} from Reservations to activate the live board.</p><Link className="button primary" href={`/app/property/${propertyId}/reservations`}>Open Reservations</Link></div></div> : null}
  </main></AppShell>;
}
