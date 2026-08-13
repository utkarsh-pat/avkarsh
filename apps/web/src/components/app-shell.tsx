"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, BedDouble, BookOpenCheck, Building2, CalendarDays, ChevronDown, CircleDollarSign,
  ClipboardCheck, FileBarChart, Grid2X2, Hotel, LayoutDashboard, LogOut, Menu, PlugZap,
  MessageCircleMore, Moon, MoreHorizontal, Plus, QrCode, ReceiptIndianRupee, Settings,
  ShieldCheck, Sun, UserRound, UsersRound, WalletCards, X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AppShellProps = {
  children: React.ReactNode;
  email?: string;
  isPlatformAdmin?: boolean;
  property?: { id: string; code: string; name: string };
};

export function AppShell({ children, email, isPlatformAdmin, property }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [propertyOptions, setPropertyOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  const closeNavigationRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => closeNavigationRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!property) return;
    const supabase = createSupabaseBrowserClient();
    void Promise.all([
      supabase.from("properties").select("id,name").order("name"),
      supabase.rpc("get_property_workspace_access", { target_property_id: property.id }),
    ]).then(([propertiesResult, accessResult]) => {
      if (!propertiesResult.error) setPropertyOptions(propertiesResult.data ?? []);
      if (!accessResult.error) setPermissions(new Set((accessResult.data ?? []).filter((row: { allowed: boolean }) => row.allowed).map((row: { permission_key: string }) => row.permission_key)));
    });
  }, [property]);

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    localStorage.setItem("avkarsh-theme", next);
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/sign-in");
  }

  const can = (permission: string) => permissions === null || permissions.has(permission);
  const primaryLinks = [
    ...(!property ? [{ href: "/app", label: "Workspace", icon: Building2 }] : []),
    ...(property && can("dashboard.view") ? [{ href: `/app/property/${property.id}`, label: "Super View", icon: Grid2X2 }] : []),
    ...(property && can("reservation.manage") ? [{ href: `/app/property/${property.id}/reservations`, label: "Reservations", icon: CalendarDays }] : []),
    ...(property && can("guest.manage") ? [{ href: `/app/property/${property.id}/guests`, label: "Guests", icon: UsersRound }] : []),
    ...(property && (can("stay.manage") || can("guest.manage")) ? [{ href: `/app/property/${property.id}/operations`, label: "Operations", icon: ClipboardCheck }] : []),
    ...(property && can("whatsapp.manage") ? [{ href: `/app/property/${property.id}/whatsapp`, label: "Inbox", icon: MessageCircleMore }] : []),
    ...(property && (can("folio.manage") || can("payment.manage")) ? [{ href: `/app/property/${property.id}/finance`, label: "Finance", icon: WalletCards }] : []),
    ...(property && can("reports.read") ? [{ href: `/app/property/${property.id}/analytics`, label: "Analytics", icon: BarChart3 }, { href: `/app/property/${property.id}/reports`, label: "Reports", icon: FileBarChart }] : []),
  ];
  const adminLinks = [
    ...(property && can("property.settings") ? [{ href: `/app/property/${property.id}/qr`, label: "QR & Guest Portal", icon: QrCode }] : []),
    ...(property && can("staff.manage") ? [{ href: `/app/property/${property.id}/team`, label: "Team & Access", icon: ShieldCheck }] : []),
    ...(property && can("property.settings") ? [{ href: `/app/property/${property.id}/setup`, label: "Property Setup", icon: Hotel }, { href: `/app/property/${property.id}/integrations`, label: "Integrations", icon: PlugZap }, { href: `/app/property/${property.id}/settings`, label: "Settings", icon: Settings }] : []),
    ...(!property ? [{ href: "/register", label: "New property", icon: Plus }] : []),
    ...(isPlatformAdmin ? [{ href: "/admin/onboarding", label: "SaaS control", icon: ShieldCheck }] : []),
  ];
  const initials = email?.slice(0, 2).toUpperCase() ?? "AV";

  return (
    <div className="app-frame">
      <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} data-open={open} />
      <aside className="app-sidebar" data-open={open} aria-label="Application navigation">
        <div className="sidebar-brand-row"><Link className="sidebar-brand" href="/app"><span>AV</span><strong>Avkarsh</strong></Link><button ref={closeNavigationRef} type="button" className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button></div>
        {property ? <label className="sidebar-property-switcher"><span>Current property</span><select value={property.id} onChange={(event) => window.location.assign(`/app/property/${event.target.value}`)} aria-label="Switch property">{propertyOptions.length ? propertyOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value={property.id}>{property.name}</option>}</select></label> : null}
        <nav className="sidebar-nav">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const propertyHome = property ? `/app/property/${property.id}` : undefined;
            const active = link.href === "/app" || link.href === propertyHome
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><Icon aria-hidden="true" /><span>{link.label}</span></Link>;
          })}
          {adminLinks.length ? <span className="sidebar-nav-heading">Administration</span> : null}
          {adminLinks.map((link) => { const Icon = link.icon; const active = pathname.startsWith(link.href); return <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><Icon aria-hidden="true" /><span>{link.label}</span></Link>; })}
        </nav>
        <div className="sidebar-footer">
          {property ? <><Link href={`/app/property/${property.id}/qr`}><QrCode /> Guest Portal Preview</Link><a href="https://wa.me/918922035716" target="_blank" rel="noreferrer"><CircleDollarSign /> Help &amp; Support</a></> : null}
          <p>{email ?? "Secure workspace"}</p>
          <Link href="/">View public site</Link>
        </div>
      </aside>
      <div className="app-stage">
        <header className="owner-topbar">
          <div><strong>{property?.name ?? "Property workspace"}</strong><small>{property ? "Hotel operations" : "Choose your property"}</small></div>
          <nav aria-label="Workspace controls">
            <button type="button" onClick={toggleTheme} aria-label="Toggle light and dark mode"><Sun className="light-mode-icon" aria-hidden="true" /><Moon className="dark-mode-icon" aria-hidden="true" /></button>
            <details className="owner-profile-menu"><summary aria-label="Open user profile menu"><span className="owner-avatar">{initials}</span><ChevronDown aria-hidden="true" /></summary><div><span><UserRound aria-hidden="true" /></span><strong>{email ?? "Property owner"}</strong><button type="button" onClick={logout}><LogOut aria-hidden="true" /> Log out</button></div></details>
          </nav>
        </header>
        <header className="mobile-appbar">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu aria-hidden="true" /></button>
          <Link className="brand" href="/app">{property?.name ?? "Avkarsh"}</Link>
          <div className="mobile-appbar-actions"><button type="button" onClick={toggleTheme} aria-label="Toggle light and dark mode"><Sun className="light-mode-icon" aria-hidden="true" /><Moon className="dark-mode-icon" aria-hidden="true" /></button><details className="owner-profile-menu"><summary aria-label="Open user profile menu"><span className="owner-avatar">{initials}</span></summary><div><span><UserRound aria-hidden="true" /></span><strong>{email ?? "Property owner"}</strong><button type="button" onClick={logout}><LogOut aria-hidden="true" /> Log out</button></div></details></div>
        </header>
        {children}
        {property ? <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation"><Link href={`/app/property/${property.id}`} aria-current={pathname === `/app/property/${property.id}` ? "page" : undefined}><LayoutDashboard /><span>Super View</span></Link><Link href={`/app/property/${property.id}/reservations`} aria-current={pathname.includes("/reservations") ? "page" : undefined}><BookOpenCheck /><span>Bookings</span></Link><button type="button" className="mobile-quick-action" onClick={() => setQuickOpen(true)} aria-label="Open quick actions"><Plus /></button><Link href={`/app/property/${property.id}/analytics`} aria-current={pathname.includes("/analytics") ? "page" : undefined}><BarChart3 /><span>Analytics</span></Link><button type="button" onClick={() => setOpen(true)}><MoreHorizontal /><span>More</span></button></nav> : null}
        {property && quickOpen ? <div className="mobile-action-backdrop" role="presentation" onMouseDown={() => setQuickOpen(false)}><section className="mobile-action-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-actions-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">QUICK ACTION</p><h2 id="quick-actions-title">What do you need to do?</h2></div><button type="button" onClick={() => setQuickOpen(false)} aria-label="Close quick actions"><X /></button></header><div><Link href={`/app/property/${property.id}/reservations?action=new`}><CalendarDays /> New booking</Link><Link href={`/app/property/${property.id}/reservations?action=walk-in`}><BedDouble /> Walk-in check-in</Link><Link href={`/app/property/${property.id}/finance?action=payment`}><ReceiptIndianRupee /> Record payment</Link><Link href={`/app/property/${property.id}/finance?action=expense`}><CircleDollarSign /> Add expense</Link><Link href={`/app/property/${property.id}/operations?action=new`}><ClipboardCheck /> Create task</Link></div></section></div> : null}
      </div>
    </div>
  );
}
