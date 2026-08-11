"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

  const links = [
    { href: "/app", label: "Workspace", mark: "W" },
    ...(property ? [{ href: `/app/property/${property.id}`, label: property.name, mark: property.code.slice(0, 2) }] : []),
    ...(property ? [{ href: `/app/property/${property.id}/team`, label: "Team access", mark: "T" }] : []),
    { href: "/register", label: "New property", mark: "+" },
    ...(isPlatformAdmin ? [{ href: "/admin/onboarding", label: "SaaS control", mark: "A" }] : []),
  ];

  return (
    <div className="app-frame">
      <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} data-open={open} />
      <aside className="app-sidebar" data-open={open} aria-label="Application navigation">
        <Link className="sidebar-brand" href="/app"><span>AV</span><strong>Avkarsh</strong></Link>
        <nav className="sidebar-nav">
          {links.map((link) => {
            const propertyHome = property ? `/app/property/${property.id}` : undefined;
            const active = link.href === "/app" || link.href === propertyHome
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><span>{link.mark}</span>{link.label}</Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <p>{email ?? "Secure workspace"}</p>
          <Link href="/">View public site</Link>
        </div>
      </aside>
      <div className="app-stage">
        <header className="mobile-appbar">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}>☰</button>
          <Link className="brand" href="/app">Avkarsh</Link>
          {property ? <span>{property.code}</span> : <span>AV</span>}
        </header>
        {children}
      </div>
    </div>
  );
}
