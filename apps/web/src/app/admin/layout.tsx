import { AdminShell } from "@/components/admin-shell";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, adminRole } = await requirePlatformAdmin();
  return <AdminShell email={email} role={adminRole}>{children}</AdminShell>;
}
