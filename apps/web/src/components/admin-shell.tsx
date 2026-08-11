"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  MessageCircleMore,
  MessageSquareWarning,
  Moon,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/listings", label: "Listings", icon: Building2 },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardList },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/guests", label: "Guests", icon: UserRoundCheck },
  { href: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning },
  { href: "/admin/enquiries", label: "Enquiries", icon: CircleHelp },
  { href: "/admin/whatsapp", label: "WhatsApp Direct", icon: MessageCircleMore },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/admin/audit", label: "Audit logs", icon: FileText },
  { href: "/admin/activity", label: "Activity logs", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

type AdminShellProps = {
  children: React.ReactNode;
  email: string;
  role: string;
};

export function AdminShell({ children, email, role }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    localStorage.setItem("avkarsh-theme", next);
  }

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="control-frame" data-collapsed={collapsed}>
      <button
        className="control-scrim"
        type="button"
        aria-label="Close admin navigation"
        data-open={mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
      <aside className="control-sidebar" data-open={mobileOpen} aria-label="Platform admin navigation">
        <div className="control-brand-row">
          <Link href="/admin" className="control-brand" aria-label="Avkarsh admin dashboard">
            <span>AV</span><strong>Avkarsh</strong>
          </Link>
          <button className="control-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button className="control-mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close sidebar"><X aria-hidden="true" /></button>
        </div>

        <nav className="control-nav">
          {navigation.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="control-sidebar-footer">
          <span className="control-avatar" aria-hidden="true">{initials}</span>
          <div><strong>{role.replaceAll("_", " ")}</strong><small>{email}</small></div>
        </div>
      </aside>

      <div className="control-stage">
        <header className="control-topbar">
          <div className="control-topbar-title">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open admin navigation"><Menu aria-hidden="true" /></button>
            <div><strong>Admin Panel</strong><small>Hotel SaaS control plane</small></div>
          </div>
          <div className="control-topbar-actions">
            <Link href="/admin/listings" aria-label="Search listings"><Search aria-hidden="true" /></Link>
            <button type="button" onClick={toggleTheme} aria-label="Toggle light and dark mode"><Sun className="light-mode-icon" aria-hidden="true" /><Moon className="dark-mode-icon" aria-hidden="true" /></button>
            <Link href="/admin/activity" aria-label="Notifications"><Bell aria-hidden="true" /></Link>
            <span className="control-avatar" title={email}>{initials}</span>
          </div>
        </header>
        <div className="control-content">{children}</div>
      </div>
    </div>
  );
}
