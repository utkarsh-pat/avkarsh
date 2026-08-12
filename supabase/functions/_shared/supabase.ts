import { createClient } from "npm:@supabase/supabase-js@2.110.8";

function keyFromDictionary(name: "SUPABASE_SECRET_KEYS" | "SUPABASE_PUBLISHABLE_KEYS") {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = keyFromDictionary("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service credentials are unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function userClient(authorization: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = keyFromDictionary("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Supabase publishable credentials are unavailable.");
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const jsonHeaders = { "content-type": "application/json" };

export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extraHeaders } });
}

export function corsHeaders(origin: string | null) {
  const allowed = origin && (/^https:\/\/([a-z0-9-]+\.)?avkarsh\.vercel\.app$/i.test(origin) || /^http:\/\/localhost:\d+$/i.test(origin))
    ? origin
    : "https://avkarsh.vercel.app";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

export function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyMetaSignature(rawBody: string, signature: string, appSecret: string) {
  if (!signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return constantTimeEqual(signature, expected);
}

export async function graphRequest<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string; code?: number } };
  if (!response.ok) throw new Error(data.error?.message ?? `Meta Graph API returned ${response.status}.`);
  return data;
}
