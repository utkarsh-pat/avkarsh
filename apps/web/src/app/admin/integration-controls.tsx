"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Property = { id: string; name: string; code: string };
type Config = {
  id: string;
  property_id: string;
  business_name: string | null;
  display_phone_number: string;
  phone_number_id: string;
  waba_id: string;
  graph_api_version: string;
  status: string;
  subscribed_at: string | null;
  templates_synced_at: string | null;
  last_error: string | null;
};
type Integration = {
  meta_app_id?: string | null;
  meta_credentials_configured?: boolean;
  webhook_verify_token_configured?: boolean;
  resend_credentials_configured?: boolean;
  resend_from_email?: string | null;
  resend_from_name?: string | null;
};

export function IntegrationControls({
  settings,
  integration,
  properties,
  configs,
  webhookUrl,
  deliveryCounts,
}: {
  settings: { support_email?: string | null; default_timezone?: string; default_currency_code?: string; whatsapp_enabled?: boolean; incident_email_enabled?: boolean; maintenance_mode?: boolean; data_retention_days?: number };
  integration: Integration;
  properties: Property[];
  configs: Config[];
  webhookUrl: string;
  deliveryCounts: Record<string, number>;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selectedConfig, setSelectedConfig] = useState(configs[0]?.id ?? "");

  async function invoke(action: string, payload: Record<string, unknown>, label = action) {
    setBusy(label);
    setNotice(null);
    const { data, error } = await supabase.functions.invoke("whatsapp-config", { body: { action, ...payload } });
    setBusy("");
    const message = error?.message || (data as { error?: string } | null)?.error;
    if (message) {
      setNotice({ tone: "error", text: message });
      return false;
    }
    setNotice({ tone: "success", text: `${label} completed successfully.` });
    window.setTimeout(() => window.location.reload(), 700);
    return true;
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("Platform defaults");
    setNotice(null);
    const { error } = await supabase.from("platform_settings").update({
      support_email: String(form.get("supportEmail") || "").trim().toLowerCase() || null,
      default_timezone: String(form.get("timezone") || "Asia/Kolkata"),
      default_currency_code: String(form.get("currency") || "INR").toUpperCase(),
      data_retention_days: Number(form.get("retention") || 365),
      whatsapp_enabled: form.get("whatsappEnabled") === "on",
      incident_email_enabled: form.get("incidentEmailEnabled") === "on",
      maintenance_mode: form.get("maintenanceMode") === "on",
    }).eq("singleton", true);
    setBusy("");
    if (error) return setNotice({ tone: "error", text: error.message });
    setNotice({ tone: "success", text: "Platform defaults saved." });
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="integration-console">
      {notice ? <p className={`control-alert ${notice.tone}`}>{notice.text}</p> : null}

      <section className="integration-overview">
        <div><ShieldCheck aria-hidden="true" /><span><strong>Webhook endpoint</strong><small>Paste this URL in Meta App Dashboard. Secrets are encrypted in Supabase Vault.</small></span></div>
        <code>{webhookUrl}</code>
        <div className="integration-health">
          <span className={integration.meta_credentials_configured ? "ready" : "pending"}>Meta secret</span>
          <span className={integration.webhook_verify_token_configured ? "ready" : "pending"}>Verify token</span>
          <span className={integration.resend_credentials_configured ? "ready" : "pending"}>Email provider</span>
          <span>{deliveryCounts.sent ?? 0} sent</span>
          <span>{(deliveryCounts.queued ?? 0) + (deliveryCounts.retry ?? 0)} queued</span>
          <span className={(deliveryCounts.dead_letter ?? 0) > 0 ? "failed" : "ready"}>{deliveryCounts.dead_letter ?? 0} dead letter</span>
        </div>
      </section>

      <form className="integration-card" onSubmit={saveSettings}>
        <header><div><h2>Operational defaults</h2><p>Platform-wide controls for guest channels and reliability notifications.</p></div></header>
        <div className="integration-fields-three"><label>Support email<input name="supportEmail" type="email" defaultValue={settings.support_email ?? ""} /></label><label>Timezone<input name="timezone" defaultValue={settings.default_timezone ?? "Asia/Kolkata"} required /></label><label>Currency<input name="currency" defaultValue={settings.default_currency_code ?? "INR"} pattern="[A-Z]{3}" required /></label></div>
        <label>Data retention (days)<input name="retention" type="number" min={30} max={3650} defaultValue={settings.data_retention_days ?? 365} required /></label>
        <div className="integration-switches"><label><input name="whatsappEnabled" type="checkbox" defaultChecked={settings.whatsapp_enabled} /> WhatsApp Direct enabled</label><label><input name="incidentEmailEnabled" type="checkbox" defaultChecked={settings.incident_email_enabled} /> Incident emails enabled</label><label><input name="maintenanceMode" type="checkbox" defaultChecked={settings.maintenance_mode} /> Maintenance mode</label></div>
        <button className="control-primary-button" disabled={Boolean(busy)}>Save operational defaults</button>
      </form>

      <div className="integration-grid">
        <form className="integration-card" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void invoke("save-platform", {
            metaAppId: form.get("metaAppId"),
            metaAppSecret: form.get("metaAppSecret"),
            webhookVerifyToken: form.get("webhookVerifyToken"),
            resendApiKey: form.get("resendApiKey"),
            resendFromEmail: form.get("resendFromEmail"),
            resendFromName: form.get("resendFromName"),
            edgeFunctionsBaseUrl: webhookUrl.replace(/\/whatsapp-webhook$/, ""),
          }, "Platform integration");
        }}>
          <header><div><h2>Platform providers</h2><p>Meta verification and operations email delivery.</p></div><CheckCircle2 aria-hidden="true" /></header>
          <label>Meta app ID<input name="metaAppId" inputMode="numeric" defaultValue={integration.meta_app_id ?? ""} placeholder="123456789012345" required /></label>
          <label>Meta app secret<input name="metaAppSecret" type="password" autoComplete="new-password" placeholder={integration.meta_credentials_configured ? "Leave blank to retain current secret" : "Required"} /></label>
          <label>Webhook verify token<input name="webhookVerifyToken" type="password" autoComplete="new-password" placeholder={integration.webhook_verify_token_configured ? "Leave blank to retain current token" : "Choose a strong token"} /></label>
          <div className="integration-fields-two"><label>Resend API key<input name="resendApiKey" type="password" autoComplete="new-password" placeholder={integration.resend_credentials_configured ? "Leave blank to retain current key" : "re_..."} /></label><label>From email<input name="resendFromEmail" type="email" defaultValue={integration.resend_from_email ?? ""} placeholder="ops@yourdomain.com" /></label></div>
          <label>From name<input name="resendFromName" defaultValue={integration.resend_from_name ?? "Avkarsh Operations"} /></label>
          <button className="control-primary-button" disabled={Boolean(busy)}>{busy === "Platform integration" ? <LoaderCircle className="spin" /> : null} Save securely</button>
        </form>

        <form className="integration-card" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void invoke("save-property", {
            propertyId: form.get("propertyId"), wabaId: form.get("wabaId"), phoneNumberId: form.get("phoneNumberId"),
            displayPhoneNumber: form.get("displayPhoneNumber"), businessName: form.get("businessName"),
            accessToken: form.get("accessToken"), graphApiVersion: form.get("graphApiVersion"),
          }, "WhatsApp number");
        }}>
          <header><div><h2>Connect hotel number</h2><p>One Meta Cloud API number per hotel property.</p></div><Send aria-hidden="true" /></header>
          <label>Hotel property<select name="propertyId" required defaultValue=""><option value="" disabled>Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} ({property.code})</option>)}</select></label>
          <div className="integration-fields-two"><label>WABA ID<input name="wabaId" inputMode="numeric" required /></label><label>Phone number ID<input name="phoneNumberId" inputMode="numeric" required /></label></div>
          <div className="integration-fields-two"><label>Display phone<input name="displayPhoneNumber" required placeholder="+91 98765 43210" /></label><label>Graph version<input name="graphApiVersion" defaultValue="v25.0" required /></label></div>
          <label>Business display name<input name="businessName" required /></label>
          <label>Permanent access token<input name="accessToken" type="password" autoComplete="new-password" required /></label>
          <button className="control-primary-button" disabled={Boolean(busy)}>{busy === "WhatsApp number" ? <LoaderCircle className="spin" /> : null} Save number</button>
        </form>
      </div>

      <section className="integration-card integration-actions">
        <header><div><h2>Connection actions</h2><p>Validate the phone, subscribe its WABA once, then sync approved templates.</p></div><RefreshCw aria-hidden="true" /></header>
        {configs.length ? <><label>Connected configuration<select value={selectedConfig} onChange={(event) => setSelectedConfig(event.target.value)}>{configs.map((config) => <option key={config.id} value={config.id}>{config.business_name || config.display_phone_number} · {config.status}</option>)}</select></label><div className="integration-button-row"><button type="button" onClick={() => void invoke("validate", { configId: selectedConfig }, "Validation")} disabled={Boolean(busy)}>Validate</button><button type="button" onClick={() => void invoke("subscribe", { configId: selectedConfig }, "Webhook subscription")} disabled={Boolean(busy)}>Subscribe webhook</button><button type="button" onClick={() => void invoke("sync-templates", { configId: selectedConfig }, "Template sync")} disabled={Boolean(busy)}>Sync templates</button></div></> : <p className="integration-empty">Connect a hotel number first.</p>}
      </section>

      <form className="integration-card" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void invoke("create-template", { configId: form.get("configId"), name: form.get("name"), language: form.get("language"), category: form.get("category"), templateBody: form.get("templateBody") }, "Template submission");
      }}>
        <header><div><h2>Submit message template</h2><p>Meta reviews templates before they can start conversations outside the 24-hour service window.</p></div></header>
        <div className="integration-fields-three"><label>Hotel number<select name="configId" required defaultValue=""><option value="" disabled>Select configuration</option>{configs.map((config) => <option key={config.id} value={config.id}>{config.business_name || config.display_phone_number}</option>)}</select></label><label>Template name<input name="name" pattern="[a-z0-9_]+" required placeholder="booking_confirmation" /></label><label>Category<select name="category" defaultValue="UTILITY"><option>UTILITY</option><option>MARKETING</option><option>AUTHENTICATION</option></select></label></div>
        <label>Language<input name="language" defaultValue="en_US" required /></label>
        <label>Body<textarea name="templateBody" rows={4} maxLength={1024} required placeholder="Hello {{1}}, your booking at {{2}} is confirmed." /></label>
        <button className="control-primary-button" disabled={!configs.length || Boolean(busy)}>Submit to Meta</button>
      </form>
    </div>
  );
}
