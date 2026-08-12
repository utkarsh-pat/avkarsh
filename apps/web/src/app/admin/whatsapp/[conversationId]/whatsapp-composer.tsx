"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Template = { id: string; name: string; language: string; status: string };

export function WhatsAppComposer({ conversationId, templates }: { conversationId: string; templates: Template[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<"text" | "template">("text");
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const template = templates.find((item) => item.id === templateId);
    if (mode === "template" && !template) return;
    if (mode === "text" && !message.trim()) return;
    setBusy(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-send", {
      body: mode === "template"
        ? { conversationId, type: "template", templateName: template?.name, templateLanguage: template?.language, requestId: crypto.randomUUID() }
        : { conversationId, type: "text", text: message.trim(), requestId: crypto.randomUUID() },
    });
    const providerError = (data as { error?: string } | null)?.error;
    if (invokeError || providerError) {
      setError(providerError || invokeError?.message || "Message could not be sent.");
      setBusy(false);
      return;
    }
    setMessage("");
    window.location.reload();
  }

  return <form className="whatsapp-composer" onSubmit={submit}>
    <div className="whatsapp-mode-tabs"><button type="button" data-active={mode === "text"} onClick={() => setMode("text")}>Free-form reply</button><button type="button" data-active={mode === "template"} onClick={() => setMode("template")} disabled={!templates.length}>Approved template</button></div>
    {mode === "text" ? <textarea aria-label="WhatsApp message" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={4096} placeholder="Write a guest reply…" /> : <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} aria-label="Approved template">{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.language}</option>)}</select>}
    <div><span>{error || (mode === "text" ? `${message.length}/4096` : "Use templates to initiate or resume conversations outside the service window.")}</span><button className="control-primary-button" disabled={busy || (mode === "text" ? !message.trim() : !templateId)}>{busy ? <LoaderCircle className="spin" /> : <Send />} Send</button></div>
  </form>;
}
