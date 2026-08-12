import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { constantTimeEqual, json, serviceClient } from "../_shared/supabase.ts";

type Credentials = { resend_api_key: string | null; dispatch_token: string; resend_from_email: string | null; resend_from_name: string };
type Delivery = { id: string; recipient: string; subject: string; payload: Record<string, unknown>; attempts: number; max_attempts: number };

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function emailHtml(delivery: Delivery) {
  const rows = Object.entries(delivery.payload).map(([key, value]) => `<tr><td style="padding:8px;color:#6b7280">${escapeHtml(key)}</td><td style="padding:8px">${escapeHtml(typeof value === "object" ? JSON.stringify(value) : value)}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#171728"><h1 style="color:#6d5dfc">Avkarsh Operations</h1><h2>${escapeHtml(delivery.subject)}</h2><table style="width:100%;border-collapse:collapse">${rows}</table><p style="color:#6b7280">Generated automatically by the Avkarsh SaaS control plane.</p></div>`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const service = serviceClient();
  const { data: credentialData, error: credentialError } = await service.rpc("get_platform_service_credentials").single();
  if (credentialError || !credentialData) return json({ error: "Dispatcher credentials unavailable." }, 503);
  const credentials = credentialData as Credentials;
  if (!constantTimeEqual(request.headers.get("x-avkarsh-dispatch-token") ?? "", credentials.dispatch_token)) return new Response("Forbidden", { status: 403 });
  if (!credentials.resend_api_key || !credentials.resend_from_email) return json({ error: "Email provider is not configured." }, 503);

  const { data: deliveries, error } = await service.from("notification_deliveries").select("id,recipient,subject,payload,attempts,max_attempts")
    .in("status", ["queued", "retry"]).lte("available_at", new Date().toISOString()).order("created_at").limit(10);
  if (error) return json({ error: error.message }, 500);
  let sent = 0;
  let failed = 0;
  for (const item of (deliveries ?? []) as Delivery[]) {
    const attempts = item.attempts + 1;
    const claimed = await service.from("notification_deliveries").update({ status: "processing", attempts, last_attempt_at: new Date().toISOString() })
      .eq("id", item.id).in("status", ["queued", "retry"]).select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.resend_api_key}`, "content-type": "application/json", "Idempotency-Key": item.id },
        body: JSON.stringify({ from: `${credentials.resend_from_name} <${credentials.resend_from_email}>`, to: [item.recipient], subject: item.subject, html: emailHtml(item) }),
      });
      const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
      if (!response.ok || !result.id) throw new Error(result.message ?? `Resend returned ${response.status}.`);
      await service.from("notification_deliveries").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.id, last_error: null }).eq("id", item.id);
      sent += 1;
    } catch (dispatchError) {
      const dead = attempts >= item.max_attempts;
      const delayMinutes = Math.min(60, 2 ** attempts);
      await service.from("notification_deliveries").update({
        status: dead ? "dead_letter" : "retry",
        available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: (dispatchError instanceof Error ? dispatchError.message : "Email dispatch failed.").slice(0, 2000),
      }).eq("id", item.id);
      failed += 1;
    }
  }
  return json({ ok: true, sent, failed });
});
