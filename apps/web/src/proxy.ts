import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const configured = getSupabasePublicConfig();

  if (!configured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(configured.url, configured.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|app-icon.svg|app-icon-maskable.svg|sw.js).*)"],
};
