import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, graphRequest, json, serviceClient, userClient } from "../_shared/supabase.ts";

type Prepared = { message_id: string; config_id: string; recipient: string; phone_number_id: string; graph_api_version: string };
type ServiceConfig = Prepared & { access_token: string };

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  const authorization = request.headers.get("authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401, cors);
  try {
    const body = await request.json() as {
      conversationId?: string;
      text?: string;
      type?: "text" | "template";
      templateName?: string;
      templateLanguage?: string;
      components?: unknown[];
      requestId?: string;
    };
    const client = userClient(authorization);
    const service = serviceClient();
    const requestId = body.requestId ?? crypto.randomUUID();
    const { data: preparedData, error: prepareError } = await client.rpc("prepare_whatsapp_outbound", {
      target_conversation_id: body.conversationId,
      message_body: body.text ?? "",
      requested_type: body.type ?? "text",
      requested_template_name: body.templateName ?? null,
      requested_template_language: body.templateLanguage ?? null,
      request_id: requestId,
    }).single();
    if (prepareError || !preparedData) return json({ error: prepareError?.message ?? "Could not prepare message." }, 403, cors);
    const prepared = preparedData as Prepared;
    try {
      const { data: configData, error: configError } = await service.rpc("get_whatsapp_service_config", {
        target_config_id: prepared.config_id,
        target_phone_number_id: null,
      }).single();
      if (configError || !configData) throw new Error("WhatsApp credentials are unavailable.");
      const config = configData as ServiceConfig;
      const payload = body.type === "template"
        ? {
          messaging_product: "whatsapp",
          to: prepared.recipient,
          type: "template",
          template: {
            name: body.templateName,
            language: { code: body.templateLanguage ?? "en_US" },
            ...(body.components?.length ? { components: body.components } : {}),
          },
          }
        : { messaging_product: "whatsapp", to: prepared.recipient, type: "text", text: { preview_url: false, body: body.text } };
      const result = await graphRequest<{ messages?: Array<{ id?: string }> }>(
        `https://graph.facebook.com/${prepared.graph_api_version}/${prepared.phone_number_id}/messages`,
        config.access_token,
        { method: "POST", body: JSON.stringify(payload) },
      );
      const providerId = result.messages?.[0]?.id;
      if (!providerId) throw new Error("Meta accepted the request without a message ID.");
      await service.from("whatsapp_messages").update({ provider_message_id: providerId, delivery_status: "sent", provider_error: null }).eq("id", prepared.message_id);
      await service.from("whatsapp_conversations").update({
        state: "direct_chat",
        unread_count: 0,
        last_message_preview: (body.text || `Template: ${body.templateName}`).slice(0, 400),
        last_message_at: new Date().toISOString(),
        direct_chat_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq("id", body.conversationId);
      const { data: conversation } = await service.from("whatsapp_conversations").select("guest_profile_id,property_id").eq("id", body.conversationId).single();
      if (conversation?.guest_profile_id) {
        await service.from("operational_cases").update({ first_response_at: new Date().toISOString(), status: "in_progress" })
          .eq("guest_profile_id", conversation.guest_profile_id).eq("property_id", conversation.property_id)
          .eq("status", "open").is("first_response_at", null);
      }
      return json({ ok: true, messageId: prepared.message_id, providerMessageId: providerId }, 200, cors);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta send failed.";
      await service.from("whatsapp_messages").update({ delivery_status: "failed", provider_error: message.slice(0, 2000) }).eq("id", prepared.message_id);
      return json({ error: message }, 502, cors);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request." }, 400, cors);
  }
});
