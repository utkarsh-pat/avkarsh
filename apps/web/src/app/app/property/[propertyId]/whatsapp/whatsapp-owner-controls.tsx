"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCheck, LoaderCircle, Paperclip, Save, Send, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { saveGuestDetails, updateConversation, type WhatsAppActionState } from "./actions";

const initialState: WhatsAppActionState = { status: "idle" };
type Template = { id: string; name: string; language: string; status: string };

export function WhatsAppReadReceipt({ propertyId, conversationId, unreadCount }: { propertyId: string; conversationId: string; unreadCount: number }) {
  useEffect(() => {
    if (!unreadCount) return;
    const data = new FormData(); data.set("propertyId", propertyId); data.set("conversationId", conversationId); data.set("action", "mark_read");
    void updateConversation(initialState, data);
  }, [propertyId, conversationId, unreadCount]);
  return null;
}

export function WhatsAppRealtime({ propertyId, conversationId }: { propertyId: string; conversationId: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  useEffect(() => {
    const channel = supabase.channel(`owner-whatsapp-${propertyId}-${conversationId ?? "inbox"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `property_id=eq.${propertyId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: conversationId ? `conversation_id=eq.${conversationId}` : `property_id=eq.${propertyId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, propertyId, router, supabase]);
  return null;
}

function mediaType(file: File): "image" | "document" | "audio" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"].includes(file.type)) return "document";
  return null;
}

export function OwnerWhatsAppComposer({ propertyId, conversationId, directChatExpiresAt, templates }: { propertyId: string; conversationId: string; directChatExpiresAt: string | null; templates: Template[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [canReply, setCanReply] = useState(false);
  const [mode, setMode] = useState<"text" | "template">("template");
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initializedReplyWindow = useRef(false);
  useEffect(() => {
    const refreshWindow = () => {
      const open = Boolean(directChatExpiresAt && new Date(directChatExpiresAt).getTime() > Date.now());
      setCanReply(open);
      if (!initializedReplyWindow.current) {
        setMode(open ? "text" : "template");
        initializedReplyWindow.current = true;
      }
    };
    const initialTimer = window.setTimeout(refreshWindow, 0);
    const timer = window.setInterval(refreshWindow, 30_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, [directChatExpiresAt, templates.length]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const template = templates.find((item) => item.id === templateId);
    if ((mode === "text" && !message.trim() && !file) || (mode === "template" && !template)) return;
    setBusy(true); setError("");
    let uploadedPath = "";
    let requestBody: Record<string, unknown> = mode === "template"
      ? { conversationId, type: "template", templateName: template?.name, templateLanguage: template?.language, requestId: crypto.randomUUID() }
      : { conversationId, type: "text", text: message.trim(), requestId: crypto.randomUUID() };
    if (mode === "text" && file) {
      const kind = mediaType(file);
      if (!kind) { setError("This file type is not supported."); setBusy(false); return; }
      if (file.size > 25 * 1024 * 1024) { setError("Attachments must be 25 MB or smaller."); setBusy(false); return; }
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "-").slice(-120) || "attachment";
      uploadedPath = `${propertyId}/${conversationId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("whatsapp-media").upload(uploadedPath, file, { contentType: file.type, upsert: false });
      if (uploadError) { setError(uploadError.message || "Attachment could not be uploaded."); setBusy(false); return; }
      requestBody = { conversationId, type: kind, mediaType: kind, mediaPath: uploadedPath, fileName: file.name.slice(0, 180), text: message.trim(), requestId: crypto.randomUUID() };
    }
    const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-send", { body: requestBody });
    const providerError = (data as { error?: string } | null)?.error;
    if (invokeError || providerError) {
      if (uploadedPath) await supabase.storage.from("whatsapp-media").remove([uploadedPath]);
      setError(providerError || invokeError?.message || "Message could not be sent."); setBusy(false); return;
    }
    setMessage(""); setFile(null); window.location.reload();
  }
  return <form className="owner-wa-composer" onSubmit={submit}><div className="owner-wa-compose-tabs"><button type="button" data-active={mode === "text"} onClick={() => setMode("text")} disabled={!canReply}>Reply</button><button type="button" data-active={mode === "template"} onClick={() => { setMode("template"); setFile(null); }} disabled={!templates.length}>Template</button><span>{canReply ? "24-hour reply window active" : "Reply window closed — use a template"}</span></div>{mode === "text" ? <><div className="owner-wa-compose-field"><label className="owner-wa-attach" aria-label="Attach a file"><Paperclip /><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} accept="image/*,video/mp4,video/3gpp,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" /></label><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} maxLength={4096} placeholder="Type a message" aria-label="WhatsApp message" /></div>{file ? <div className="owner-wa-file"><Paperclip /><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" onClick={() => setFile(null)} aria-label="Remove attachment"><X /></button></div> : null}</> : templates.length ? <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} aria-label="Approved template">{templates.map((template) => <option value={template.id} key={template.id}>{template.name} · {template.language}</option>)}</select> : <p className="owner-wa-template-empty">No approved template is available for this property.</p>}<footer><span className={error ? "error" : ""}>{error || (mode === "text" ? `${message.length}/4096` : "Approved Meta template")}</span><button disabled={busy || (mode === "text" ? !message.trim() && !file : !templateId)}>{busy ? <LoaderCircle className="spin" /> : <Send />} Send</button></footer></form>;
}

export function ConversationActions({ propertyId, conversationId, currentTag }: { propertyId: string; conversationId: string; currentTag: string | null }) {
  const [state, action, pending] = useActionState(updateConversation, initialState);
  return <form className="owner-wa-conversation-actions" action={action}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="conversationId" value={conversationId} /><label><Tag /><select name="tag" defaultValue={currentTag ?? "none"}><option value="none">No tag</option><option value="urgent">Urgent</option><option value="complaint">Complaint</option><option value="enquiry">Enquiry</option><option value="feedback">Feedback</option><option value="resolved">Resolved</option></select></label><button name="action" value="tag" disabled={pending}><CheckCheck /> Save tag</button><button name="action" value="archive" disabled={pending}><Archive /> End chat</button>{state.message ? <small className={state.status}>{state.message}</small> : null}</form>;
}

export function GuestDetailsForm({ propertyId, guest }: { propertyId: string; guest: { id: string; full_name: string; notes: string | null } }) {
  const [state, action, pending] = useActionState(saveGuestDetails, initialState);
  return <form className="owner-wa-guest-form" action={action}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="guestProfileId" value={guest.id} /><label>Guest name<input name="fullName" defaultValue={guest.full_name} /></label><label>Private notes<textarea name="notes" rows={6} defaultValue={guest.notes ?? ""} placeholder="Preferences, allergies or service context" /></label><button disabled={pending}><Save /> {pending ? "Saving…" : "Save details"}</button>{state.message ? <small className={state.status}>{state.message}</small> : null}</form>;
}
