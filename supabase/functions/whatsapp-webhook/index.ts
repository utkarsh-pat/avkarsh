import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { constantTimeEqual, graphRequest, json, serviceClient, sha256, verifyMetaSignature } from "../_shared/supabase.ts";

type ServiceCredential = {
  meta_app_secret: string | null;
  webhook_verify_token: string | null;
};

type WhatsAppConfig = {
  config_id: string;
  property_id: string;
  organization_id: string;
  phone_number_id: string;
  graph_api_version: string;
  access_token: string;
};

type MetaMessage = Record<string, unknown> & { id?: string; from?: string; timestamp?: string; type?: string };

function messageText(message: MetaMessage) {
  const type = String(message.type ?? "unknown");
  if (type === "text") return String((message.text as { body?: string } | undefined)?.body ?? "");
  if (type === "button") return String((message.button as { text?: string } | undefined)?.text ?? "Button response");
  if (type === "interactive") {
    const interactive = message.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
    return String(interactive?.button_reply?.title ?? interactive?.list_reply?.title ?? "Interactive response");
  }
  const media = message[type] as { id?: string; filename?: string } | undefined;
  return media?.filename ? `${type}: ${media.filename}` : `${type} message${media?.id ? ` (${media.id})` : ""}`;
}

function messageMedia(message: MetaMessage) {
  const type = String(message.type ?? "unknown");
  const media = message[type] as { id?: string } | undefined;
  return media?.id ? `meta-media:${media.id}` : null;
}

function classifyCase(body: string) {
  const normalized = body.toLowerCase();
  const complaintWords = ["complaint", "bad", "dirty", "broken", "not working", "refund", "angry", "problem", "issue", "bekar", "ganda", "kharab", "nahi chal"];
  const requestWords = ["please", "need", "send", "bring", "arrange", "request", "chahiye", "bhej", "kar do"];
  if (complaintWords.some((word) => normalized.includes(word))) return { type: "complaint", tag: "complaint", priority: "high" };
  if (requestWords.some((word) => normalized.includes(word))) return { type: "request", tag: "enquiry", priority: "normal" };
  return { type: "enquiry", tag: "enquiry", priority: "normal" };
}

async function credentials(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase.rpc("get_platform_service_credentials").single();
  if (error) throw error;
  return data as ServiceCredential;
}

Deno.serve(async (request) => {
  const supabase = serviceClient();
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") ?? "";
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const configured = await credentials(supabase);
    if (mode === "subscribe" && configured.webhook_verify_token && constantTimeEqual(token, configured.webhook_verify_token)) {
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    }
    return new Response("Verification failed", { status: 403 });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const configured = await credentials(supabase);
  if (!configured.meta_app_secret || !(await verifyMetaSignature(rawBody, signature, configured.meta_app_secret))) {
    return new Response("Invalid signature", { status: 403 });
  }

  const payloadHash = await sha256(rawBody);
  const deliveryId = request.headers.get("x-hub-delivery") || payloadHash;
  const payload = JSON.parse(rawBody) as { object?: string; entry?: Array<Record<string, unknown>> };
  if (payload.object !== "whatsapp_business_account") return json({ received: true, ignored: true });

  const { error: receiptError } = await supabase.from("whatsapp_webhook_receipts").insert({ delivery_id: deliveryId, payload_hash: payloadHash });
  if (receiptError?.code === "23505") return json({ received: true, duplicate: true });
  if (receiptError) return json({ error: "Could not reserve webhook delivery." }, 500);

  let phoneNumberId: string | null = null;
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of (entry.changes as Array<Record<string, unknown>> | undefined) ?? []) {
        const value = (change.value ?? {}) as Record<string, unknown>;
        const metadata = (value.metadata ?? {}) as { phone_number_id?: string };
        phoneNumberId = metadata.phone_number_id ?? null;
        if (!phoneNumberId) continue;
        const { data: configData, error: configError } = await supabase.rpc("get_whatsapp_service_config", {
          target_config_id: null,
          target_phone_number_id: phoneNumberId,
        }).single();
        if (configError || !configData) continue;
        const config = configData as WhatsAppConfig;
        const contactName = String(((value.contacts as Array<{ profile?: { name?: string } }> | undefined)?.[0]?.profile?.name) ?? "WhatsApp guest");

        for (const message of (value.messages as MetaMessage[] | undefined) ?? []) {
          if (!message.id || !message.from) continue;
          const phone = String(message.from).replace(/\D/g, "");
          const sentAt = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();
          const { data: guest, error: guestError } = await supabase.from("guest_profiles").upsert({
            organization_id: config.organization_id,
            property_id: config.property_id,
            full_name: contactName.slice(0, 160),
            phone,
            whatsapp_phone: phone,
            status: "active",
          }, { onConflict: "property_id,phone" }).select("id").single();
          if (guestError) throw guestError;

          const { data: existingConversation } = await supabase.from("whatsapp_conversations")
            .select("id,unread_count").eq("property_id", config.property_id).eq("whatsapp_phone", phone).maybeSingle();
          let conversationId = existingConversation?.id as string | undefined;
          let createdConversation = false;
          const preview = messageText(message).slice(0, 400);
          const classification = classifyCase(preview);
          if (conversationId) {
            const { error } = await supabase.from("whatsapp_conversations").update({
              guest_profile_id: guest.id,
              guest_name: contactName.slice(0, 160),
              state: "waiting",
              unread_count: Number(existingConversation.unread_count ?? 0) + 1,
              last_message_preview: preview,
              last_message_at: sentAt,
              status: "active",
            }).eq("id", conversationId);
            if (error) throw error;
          } else {
            const { data: created, error } = await supabase.from("whatsapp_conversations").insert({
              organization_id: config.organization_id,
              property_id: config.property_id,
              guest_profile_id: guest.id,
              whatsapp_phone: phone,
              guest_name: contactName.slice(0, 160),
              state: "waiting",
              tag: classification.tag,
              unread_count: 1,
              last_message_preview: preview,
              last_message_at: sentAt,
            }).select("id").single();
            if (error) throw error;
            conversationId = created.id;
            createdConversation = true;
          }
          const type = ["text", "image", "document", "audio", "video"].includes(String(message.type)) ? String(message.type) : "system";
          const { error: messageError } = await supabase.from("whatsapp_messages").insert({
            conversation_id: conversationId,
            organization_id: config.organization_id,
            property_id: config.property_id,
            direction: "inbound",
            sender_type: "guest",
            message_type: type,
            body: preview || null,
            media_url: messageMedia(message),
            provider_message_id: message.id,
            delivery_status: "delivered",
            sent_at: sentAt,
          });
          if (messageError && messageError.code !== "23505") throw messageError;
          if (!messageError && createdConversation && preview.length >= 3) {
            const { error: caseError } = await supabase.from("operational_cases").insert({
              organization_id: config.organization_id,
              property_id: config.property_id,
              guest_profile_id: guest.id,
              case_type: classification.type,
              source: "whatsapp",
              subject: `${classification.type === "complaint" ? "WhatsApp complaint" : "WhatsApp enquiry"}: ${contactName}`.slice(0, 200),
              description: preview.slice(0, 5000),
              priority: classification.priority,
              status: "open",
            });
            if (caseError) throw caseError;
          }
          await graphRequest(`https://graph.facebook.com/${config.graph_api_version}/${config.phone_number_id}/messages`, config.access_token, {
            method: "POST",
            body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: message.id }),
          }).catch(() => undefined);
        }

        for (const status of (value.statuses as Array<{ id?: string; status?: string }> | undefined) ?? []) {
          if (!status.id || !status.status) continue;
          const mapped = ["sent", "delivered", "read", "failed"].includes(status.status) ? status.status : null;
          if (mapped) await supabase.from("whatsapp_messages").update({ delivery_status: mapped }).eq("provider_message_id", status.id);
        }
        await supabase.from("property_whatsapp_configs").update({ status: "connected", last_webhook_at: new Date().toISOString(), last_error: null }).eq("id", config.config_id);
      }
    }
    await supabase.from("whatsapp_webhook_receipts").update({ phone_number_id: phoneNumberId, processed_at: new Date().toISOString(), outcome: "processed" }).eq("delivery_id", deliveryId);
    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    // Let Meta retry failed processing. The receipt is removed so the retry is not
    // incorrectly treated as an already-processed duplicate.
    await supabase.from("whatsapp_webhook_receipts").delete().eq("delivery_id", deliveryId);
    return json({ error: message }, 500);
  }
});
