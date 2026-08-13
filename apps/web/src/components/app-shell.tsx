"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2, LayoutDashboard, Menu, Moon, Plus, ShieldCheck, Sun, UsersRound,
} from "lucide-react";

type AppShellProps = {
  children: React.ReactNode;
  email?: string;
  isPlatformAdmin?: boolean;
  property?: { id: string; code: string; name: string };
};

export function AppShell({ children, email, isPlatformAdmin, property }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    localStorage.setItem("avkarsh-theme", next);
  }

  const links = [
    ...(!property ? [{ href: "/app", label: "Workspace", icon: Building2 }] : []),
    ...(property ? [{ href: `/app/property/${property.id}`, label: "Dashboard", icon: LayoutDashboard }] : []),
    ...(property ? [{ href: `/app/property/${property.id}/team`, label: "Team access", icon: UsersRound }] : []),
    ...(!property ? [{ href: "/register", label: "New property", icon: Plus }] : []),
    ...(isPlatformAdmin ? [{ href: "/admin/onboarding", label: "SaaS control", icon: ShieldCheck }] : []),
  ];
  const initials = email?.slice(0, 2).toUpperCase() ?? "AV";

  return (
    <div className="app-frame">
      <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} data-open={open} />
      <aside className="app-sidebar" data-open={open} aria-label="Application navigation">
        <Link className="sidebar-brand" href="/app"><span>AV</span><strong>Avkarsh</strong></Link>
        <nav className="sidebar-nav">
          {links.map((link) => {
            const Icon = link.icon;
            const propertyHome = property ? `/app/property/${property.id}` : undefined;
            const active = link.href === "/app" || link.href === propertyHome
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><Icon aria-hidden="true" /><span>{link.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <p>{email ?? "Secure workspace"}</p>
          <Link href="/">View public site</Link>
        </div>
      </aside>
      <div className="app-stage">
        <header className="owner-topbar">
          <div><strong>{property?.name ?? "Property workspace"}</strong><small>{property ? "Hotel operations" : "Choose your property"}</small></div>
          <nav aria-label="Workspace controls">
            <button type="button" onClick={toggleTheme} aria-label="Toggle light and dark mode"><Sun className="light-mode-icon" aria-hidden="true" /><Moon className="dark-mode-icon" aria-hidden="true" /></button>
            <span className="owner-avatar" title={email}>{initials}</span>
          </nav>
        </header>
        <header className="mobile-appbar">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu aria-hidden="true" /></button>
          <Link className="brand" href="/app">Avkarsh</Link>
          <span className="owner-avatar">{initials}</span>
        </header>
        {children}
      </div>
    </div>
  );
}
