import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, CheckCheck, CircleUserRound, MessageCircleMore, Phone, Search, Star, ThumbsUp } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConversationActions, GuestDetailsForm, OwnerWhatsAppComposer, WhatsAppReadReceipt, WhatsAppRealtime } from "./whatsapp-owner-controls";

type PageProps = { params: Promise<{ propertyId: string }>; searchParams: Promise<{ conversation?: string; q?: string; tag?: string; status?: string }> };
type Conversation = { id: string; guest_profile_id: string | null; guest_name: string; whatsapp_phone: string; state: string; tag: string | null; unread_count: number; last_message_preview: string | null; last_message_at: string | null; direct_chat_expires_at: string | null; status: string };

function initials(value: string) { return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function dateTime(value: string | null) { if (!value) return ""; const date = new Date(value); return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date); }
function tagIcon(tag: string | null) { if (tag === "urgent" || tag === "complaint") return AlertTriangle; if (tag === "feedback") return Star; if (tag === "resolved") return ThumbsUp; return MessageCircleMore; }

export default async function OwnerWhatsAppPage({ params, searchParams }: PageProps) {
  if (!getSupabasePublicConfig()) redirect("/app");
  const { propertyId } = await params; const requested = await searchParams; const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims(); if (!claimsData?.claims) redirect(`/sign-in?next=/app/property/${propertyId}/whatsapp`);
  const { data: property, error: propertyError } = await supabase.from("properties").select("id,name,code").eq("id", propertyId).maybeSingle();
  if (propertyError) throw new Error("WhatsApp workspace could not be loaded."); if (!property) notFound();
  const accessResult = await supabase.rpc("get_property_workspace_access", { target_property_id: propertyId });
  const allowed = (accessResult.data ?? []).some((row: { permission_key: string; allowed: boolean }) => row.permission_key === "whatsapp.manage" && row.allowed);
  if (accessResult.error || !allowed) redirect(`/app/property/${propertyId}`);

  const allowedTags = new Set(["urgent", "complaint", "enquiry", "feedback", "resolved"]);
  const selectedTag = requested.tag && allowedTags.has(requested.tag) ? requested.tag : "all";
  const selectedStatus = requested.status === "archived" || requested.status === "all" ? requested.status : "active";
  const searchQuery = requested.q?.trim().slice(0, 80).replace(/[,%()]/g, " ") ?? "";
  let conversationQuery = supabase.from("whatsapp_conversations").select("id,guest_profile_id,guest_name,whatsapp_phone,state,tag,unread_count,last_message_preview,last_message_at,direct_chat_expires_at,status").eq("property_id", propertyId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(200);
  if (selectedTag !== "all") conversationQuery = conversationQuery.eq("tag", selectedTag);
  if (selectedStatus !== "all") conversationQuery = conversationQuery.eq("status", selectedStatus);
  if (searchQuery) conversationQuery = conversationQuery.or(`guest_name.ilike.%${searchQuery}%,whatsapp_phone.ilike.%${searchQuery}%`);
  const { data: conversationData, error: conversationsError } = await conversationQuery;
  if (conversationsError) throw new Error("WhatsApp conversations could not be loaded.");
  const conversations = (conversationData ?? []) as Conversation[];
  const selected = conversations.find((item) => item.id === requested.conversation) ?? conversations[0] ?? null;

  const [messagesResult, templatesResult, guestResult] = selected ? await Promise.all([
    supabase.from("whatsapp_messages").select("id,direction,sender_type,message_type,body,media_url,file_name,delivery_status,provider_error,sent_at").eq("conversation_id", selected.id).order("sent_at").limit(500),
    supabase.from("whatsapp_templates").select("id,name,language,status").eq("property_id", propertyId).eq("status", "APPROVED").order("name"),
    selected.guest_profile_id ? supabase.from("guest_profiles").select("id,full_name,phone,email,vip_tier,total_stays,last_stay_at,notes").eq("id", selected.guest_profile_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: null, error: null }];
  if (messagesResult.error || templatesResult.error) throw new Error("WhatsApp thread could not be loaded.");
  const messages = await Promise.all((messagesResult.data ?? []).map(async (message) => {
    if (!message.media_url?.startsWith("storage:")) return { ...message, display_media_url: message.media_url };
    const { data } = await supabase.storage.from("whatsapp-media").createSignedUrl(message.media_url.slice("storage:".length), 60 * 60);
    return { ...message, display_media_url: data?.signedUrl ?? null };
  }));
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;

  return <AppShell email={email} property={{ id: property.id, name: property.name, code: property.code }}><main className="owner-wa-page"><WhatsAppRealtime propertyId={propertyId} conversationId={selected?.id ?? null} />
    <section className={`owner-wa-list ${selected ? "has-selection" : ""}`}><header><div><p className="eyebrow">DIRECT CHANNEL</p><h1>WhatsApp</h1></div><span>{conversations.reduce((sum, item) => sum + item.unread_count, 0)} unread</span></header><form className="owner-wa-search"><label><Search /><input name="q" defaultValue={requested.q ?? ""} placeholder="Search guest or phone" /></label><select name="status" defaultValue={selectedStatus}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All status</option></select><select name="tag" defaultValue={selectedTag}><option value="all">All tags</option><option value="urgent">Urgent</option><option value="complaint">Complaints</option><option value="enquiry">Enquiries</option><option value="feedback">Feedback</option><option value="resolved">Resolved</option></select><button>Apply</button></form><div className="owner-wa-conversations">{conversations.map((conversation) => { const Icon = tagIcon(conversation.tag); return <Link key={conversation.id} href={`?conversation=${conversation.id}${requested.q ? `&q=${encodeURIComponent(requested.q)}` : ""}&tag=${selectedTag}&status=${selectedStatus}`} aria-current={selected?.id === conversation.id ? "page" : undefined}><span className="owner-wa-avatar">{initials(conversation.guest_name)}</span><div><div><strong>{conversation.guest_name}</strong><time>{dateTime(conversation.last_message_at)}</time></div><p>{conversation.last_message_preview || "No messages yet"}</p><small><span className={`owner-wa-state ${conversation.state}`}>{conversation.state.replaceAll("_", " ")}</span>{conversation.tag ? <span className={`owner-wa-tag ${conversation.tag}`}><Icon />{conversation.tag}</span> : null}</small></div>{conversation.unread_count ? <b>{conversation.unread_count}</b> : null}</Link>; })}{!conversations.length ? <div className="owner-wa-empty"><MessageCircleMore /><strong>No conversations</strong><p>Incoming guest chats will appear here.</p></div> : null}</div></section>

    <section className={`owner-wa-thread ${selected ? "active" : ""}`}>{selected ? <><WhatsAppReadReceipt propertyId={propertyId} conversationId={selected.id} unreadCount={selected.unread_count} /><header><Link href={`/app/property/${propertyId}/whatsapp`} className="owner-wa-mobile-back"><ArrowLeft /></Link><span className="owner-wa-avatar">{initials(selected.guest_name)}</span><div><strong>{selected.guest_name}</strong><p><Phone /> {selected.whatsapp_phone}</p></div><span className={`owner-wa-state ${selected.state}`}>{selected.state.replaceAll("_", " ")}</span></header><ConversationActions propertyId={propertyId} conversationId={selected.id} currentTag={selected.tag} /><div className="owner-wa-messages">{messages.map((message) => <article key={message.id} data-direction={message.direction}><div>{message.display_media_url ? <a href={message.display_media_url} target="_blank" rel="noreferrer">{message.file_name || `${message.message_type} attachment`}</a> : null}{message.body ? <p>{message.body}</p> : null}<footer><time>{dateTime(message.sent_at)}</time>{message.delivery_status === "read" || message.delivery_status === "delivered" ? <CheckCheck /> : <Check />}<span>{message.delivery_status}</span></footer>{message.provider_error ? <small>{message.provider_error}</small> : null}</div></article>)}{!messages.length ? <div className="owner-wa-empty"><MessageCircleMore /><strong>No messages yet</strong></div> : null}</div><OwnerWhatsAppComposer propertyId={propertyId} conversationId={selected.id} directChatExpiresAt={selected.direct_chat_expires_at} templates={templatesResult.data ?? []} /></> : <div className="owner-wa-empty large"><MessageCircleMore /><h2>WhatsApp Direct</h2><p>Select a guest conversation to start chatting.</p></div>}</section>

    <aside className={`owner-wa-profile ${selected ? "active" : ""}`}>{selected ? <><header><span className="owner-wa-avatar large">{initials(selected.guest_name)}</span><h2>{selected.guest_name}</h2><p>{selected.whatsapp_phone}</p></header>{guestResult.data ? <><dl><div><dt>VIP tier</dt><dd>{guestResult.data.vip_tier}</dd></div><div><dt>Total stays</dt><dd>{guestResult.data.total_stays}</dd></div><div><dt>Email</dt><dd>{guestResult.data.email || "Not added"}</dd></div></dl><GuestDetailsForm propertyId={propertyId} guest={guestResult.data} /></> : <div className="owner-wa-empty"><CircleUserRound /><strong>Guest profile not linked</strong></div>}</> : null}</aside>
  </main></AppShell>;
}
