import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin(next = "/admin") {
  if (!getSupabasePublicConfig()) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  const { data: platformAdmin } = await supabase
    .from("platform_admins")
    .select("admin_role, permissions, status")
    .maybeSingle();

  if (!platformAdmin || platformAdmin.status !== "active") redirect("/app");

  return {
    supabase,
    adminRole: platformAdmin.admin_role as string,
    permissions: (platformAdmin.permissions ?? []) as string[],
    email: typeof claimsData.claims.email === "string"
      ? claimsData.claims.email
      : "Platform administrator",
  };
}
