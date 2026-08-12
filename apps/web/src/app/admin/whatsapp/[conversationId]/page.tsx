import Link from "next/link";
import { ArrowLeft, MessageCircleMore, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { WhatsAppComposer } from "./whatsapp-composer";

type PageProps = { params: Promise<{ conversationId: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function WhatsAppConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const { supabase } = await requirePlatformAdmin(`/admin/whatsapp/${conversationId}`);
  const { data: conversation, error } = await supabase.from("whatsapp_conversations")
    .select("id,property_id,guest_name,whatsapp_phone,state,tag,unread_count,direct_chat_expires_at,status,properties(name,code)")
    .eq("id", conversationId).single();
  if (error || !conversation) notFound();

  const [messagesResult, templatesResult] = await Promise.all([
    supabase.from("whatsapp_messages").select("id,direction,sender_type,message_type,body,file_name,delivery_status,provider_error,sent_at").eq("conversation_id", conversationId).order("sent_at").limit(500),
    supabase.from("whatsapp_templates").select("id,name,language,status").eq("property_id", conversation.property_id).eq("status", "APPROVED").order("name"),
  ]);
  const property = Array.isArray(conversation.properties) ? conversation.properties[0] : conversation.properties;

  return <main className="control-page whatsapp-thread-page">
    <Link className="whatsapp-back" href="/admin/whatsapp"><ArrowLeft /> All conversations</Link>
    <section className="whatsapp-thread-header">
      <span className="control-row-avatar whatsapp">{conversation.guest_name.slice(0, 1).toUpperCase()}</span>
      <div><p className="control-kicker">DIRECT CHANNEL</p><h1>{conversation.guest_name}</h1><p><Phone /> {conversation.whatsapp_phone} · {property?.name ?? "Hotel property"}</p></div>
      <div><span className={`control-status ${conversation.state}`}>{conversation.state.replaceAll("_", " ")}</span>{conversation.tag ? <span className={`control-status ${conversation.tag}`}>{conversation.tag}</span> : null}</div>
    </section>
    <section className="control-panel whatsapp-thread">
      <div className="whatsapp-message-list">
        {(messagesResult.data ?? []).length ? (messagesResult.data ?? []).map((message) => <article key={message.id} data-direction={message.direction}>
          <div><p>{message.body || `${message.message_type} attachment`}</p><footer><time>{formatDate(message.sent_at)}</time><span className={`control-status ${message.delivery_status}`}>{message.delivery_status}</span></footer>{message.provider_error ? <small>{message.provider_error}</small> : null}</div>
        </article>) : <div className="control-empty large"><MessageCircleMore /><h2>No messages yet</h2><p>Incoming webhook messages and sent replies will appear here.</p></div>}
      </div>
      <WhatsAppComposer conversationId={conversationId} templates={templatesResult.data ?? []} />
    </section>
  </main>;
}
