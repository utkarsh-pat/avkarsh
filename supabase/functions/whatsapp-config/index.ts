import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, graphRequest, json, serviceClient, userClient } from "../_shared/supabase.ts";

type ServiceConfig = { config_id: string; property_id: string; organization_id: string; waba_id: string; phone_number_id: string; graph_api_version: string; access_token: string };

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  const authorization = request.headers.get("authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401, cors);
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const client = userClient(authorization);
    const service = serviceClient();
    if (action === "save-platform") {
      const { data, error } = await client.rpc("configure_platform_integrations", {
        p_meta_app_id: String(body.metaAppId ?? ""),
        p_meta_app_secret: String(body.metaAppSecret ?? ""),
        p_webhook_verify_token: String(body.webhookVerifyToken ?? ""),
        p_resend_api_key: String(body.resendApiKey ?? ""),
        p_resend_from_email: String(body.resendFromEmail ?? ""),
        p_resend_from_name: String(body.resendFromName ?? ""),
        p_edge_functions_base_url: String(body.edgeFunctionsBaseUrl ?? ""),
      });
      if (error) return json({ error: error.message }, 403, cors);
      return json({ ok: true, integration: data }, 200, cors);
    }
    if (action === "save-property") {
      const { data, error } = await client.rpc("configure_property_whatsapp", {
        target_property_id: body.propertyId,
        p_waba_id: String(body.wabaId ?? ""),
        p_phone_number_id: String(body.phoneNumberId ?? ""),
        p_display_phone_number: String(body.displayPhoneNumber ?? ""),
        p_business_name: String(body.businessName ?? ""),
        p_access_token: String(body.accessToken ?? ""),
        p_graph_api_version: String(body.graphApiVersion ?? "v25.0"),
      });
      if (error) return json({ error: error.message }, 403, cors);
      return json({ ok: true, config: data }, 200, cors);
    }
    const configId = String(body.configId ?? "");
    const { data: visibleConfig, error: visibilityError } = await client.from("property_whatsapp_configs").select("id").eq("id", configId).single();
    if (visibilityError || !visibleConfig) return json({ error: "WhatsApp configuration is not accessible." }, 403, cors);
    const { data: secretData, error: secretError } = await service.rpc("get_whatsapp_service_config", {
      target_config_id: configId,
      target_phone_number_id: null,
    }).single();
    if (secretError || !secretData) throw new Error("WhatsApp credentials are unavailable.");
    const config = secretData as ServiceConfig;
    if (action === "validate") {
      const phone = await graphRequest<Record<string, unknown>>(
        `https://graph.facebook.com/${config.graph_api_version}/${config.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
        config.access_token,
      );
      await service.from("property_whatsapp_configs").update({ status: "connected", last_error: null }).eq("id", config.config_id);
      return json({ ok: true, phone }, 200, cors);
    }
    if (action === "subscribe") {
      await graphRequest(`https://graph.facebook.com/${config.graph_api_version}/${config.waba_id}/subscribed_apps`, config.access_token, { method: "POST", body: "{}" });
      await service.from("property_whatsapp_configs").update({ status: "connected", subscribed_at: new Date().toISOString(), last_error: null }).eq("id", config.config_id);
      return json({ ok: true }, 200, cors);
    }
    if (action === "create-template") {
      const name = String(body.name ?? "").trim().toLowerCase();
      const language = String(body.language ?? "en_US");
      const category = String(body.category ?? "UTILITY").toUpperCase();
      const templateBody = String(body.templateBody ?? "").trim();
      if (!/^[a-z0-9_]{1,512}$/.test(name)) return json({ error: "Template name must use lowercase letters, numbers and underscores." }, 400, cors);
      if (!templateBody || templateBody.length > 1024) return json({ error: "Template body must be between 1 and 1024 characters." }, 400, cors);
      const created = await graphRequest<Record<string, unknown>>(
        `https://graph.facebook.com/${config.graph_api_version}/${config.waba_id}/message_templates`,
        config.access_token,
        {
          method: "POST",
          body: JSON.stringify({ name, language, category, components: [{ type: "BODY", text: templateBody }] }),
        },
      );
      await service.from("property_whatsapp_configs").update({ last_error: null }).eq("id", config.config_id);
      return json({ ok: true, template: created }, 200, cors);
    }
    if (action === "sync-templates") {
      const response = await graphRequest<{ data?: Array<Record<string, unknown>> }>(
        `https://graph.facebook.com/${config.graph_api_version}/${config.waba_id}/message_templates?fields=id,name,status,category,language,components,quality_score&limit=250`,
        config.access_token,
      );
      const templates = (response.data ?? []).map((template) => ({
        config_id: config.config_id,
        organization_id: config.organization_id,
        property_id: config.property_id,
        provider_template_id: template.id ? String(template.id) : null,
        name: String(template.name ?? ""),
        language: String(template.language ?? "en_US"),
        category: String(template.category ?? "UTILITY"),
        status: String(template.status ?? "UNKNOWN"),
        components: Array.isArray(template.components) ? template.components : [],
        quality_score: template.quality_score ? JSON.stringify(template.quality_score) : null,
        last_synced_at: new Date().toISOString(),
      }));
      if (templates.length) {
        const { error } = await service.from("whatsapp_templates").upsert(templates, { onConflict: "config_id,name,language" });
        if (error) throw error;
      }
      await service.from("property_whatsapp_configs").update({ templates_synced_at: new Date().toISOString(), last_error: null }).eq("id", config.config_id);
      return json({ ok: true, count: templates.length }, 200, cors);
    }
    return json({ error: "Unsupported action." }, 400, cors);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Configuration request failed." }, 400, cors);
  }
});
