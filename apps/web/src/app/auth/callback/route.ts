import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/app";
  const configured = getSupabasePublicConfig();

  if (!configured) {
    return NextResponse.redirect(new URL("/sign-in?error=configuration", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=callback", requestUrl.origin));
  }

  const response = NextResponse.redirect(new URL(safeNext, requestUrl.origin));
  const supabase = createServerClient(configured.url, configured.publishableKey, {
    cookies: {
      getAll() {
        return request.headers
          .get("cookie")
          ?.split(";")
          .flatMap((cookie) => {
            const [name, ...value] = cookie.trim().split("=");
            return name ? [{ name, value: value.join("=") }] : [];
          }) ?? [];
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=exchange", requestUrl.origin));
  }

  // An anonymous owner request is claimable only after Supabase has verified the
  // same email through OAuth. A claim failure must not invalidate sign-in.
  await supabase.rpc("claim_approved_onboarding_requests");

  return response;
}
