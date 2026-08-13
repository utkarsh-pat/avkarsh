"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WhatsAppActionState = { status: "idle" | "success" | "error"; message?: string };
const tagValues = ["urgent", "complaint", "enquiry", "feedback", "resolved", "none"] as const;
function field(formData: FormData, name: string) { return String(formData.get(name) ?? ""); }
function failure(error: { code?: string }) { return error.code === "42501" ? "You do not have permission for this WhatsApp action." : "The WhatsApp action could not be completed."; }

const conversationSchema = z.object({ propertyId: z.uuid(), conversationId: z.uuid(), action: z.enum(["tag", "archive", "mark_read"]), tag: z.enum(tagValues).optional() });
export async function updateConversation(_state: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  const parsed = conversationSchema.safeParse({ propertyId: field(formData, "propertyId"), conversationId: field(formData, "conversationId"), action: field(formData, "action"), tag: field(formData, "tag") || undefined });
  if (!parsed.success) return { status: "error", message: "Conversation action is not valid." };
  const supabase = await createSupabaseServerClient();
  const values = parsed.data.action === "archive" ? { state: "closed", status: "archived", unread_count: 0 }
    : parsed.data.action === "mark_read" ? { unread_count: 0 }
      : { tag: parsed.data.tag === "none" ? null : parsed.data.tag };
  const { error } = await supabase.from("whatsapp_conversations").update(values).eq("id", parsed.data.conversationId).eq("property_id", parsed.data.propertyId);
  if (error) return { status: "error", message: failure(error) };
  revalidatePath(`/app/property/${parsed.data.propertyId}/whatsapp`);
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  return { status: "success", message: parsed.data.action === "archive" ? "Conversation archived." : "Conversation updated." };
}

const guestSchema = z.object({ propertyId: z.uuid(), guestProfileId: z.uuid(), fullName: z.string().trim().min(2).max(160), notes: z.string().trim().max(2000) });
export async function saveGuestDetails(_state: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  const parsed = guestSchema.safeParse({ propertyId: field(formData, "propertyId"), guestProfileId: field(formData, "guestProfileId"), fullName: field(formData, "fullName"), notes: field(formData, "notes") });
  if (!parsed.success) return { status: "error", message: "Enter a valid guest name and note." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("guest_profiles").update({ full_name: parsed.data.fullName, notes: parsed.data.notes || null }).eq("id", parsed.data.guestProfileId).eq("property_id", parsed.data.propertyId);
  if (error) return { status: "error", message: failure(error) };
  revalidatePath(`/app/property/${parsed.data.propertyId}/whatsapp`);
  return { status: "success", message: "Guest details saved." };
}
