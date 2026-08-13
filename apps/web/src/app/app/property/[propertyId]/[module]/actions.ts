"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const taskSchema = z.object({
  propertyId: z.string().uuid(),
  inventoryUnitId: z.union([z.string().uuid(), z.literal("")]),
  taskType: z.enum(["housekeeping", "guest_request", "maintenance", "inspection", "lost_found", "general"]),
  title: z.string().trim().min(2).max(180),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  assignedToLabel: z.string().trim().max(120),
});

export async function createPropertyTask(formData: FormData) {
  const parsed = taskSchema.safeParse({
    propertyId: formData.get("propertyId"), inventoryUnitId: formData.get("inventoryUnitId") ?? "",
    taskType: formData.get("taskType"), title: formData.get("title"), priority: formData.get("priority"),
    assignedToLabel: formData.get("assignedToLabel") ?? "",
  });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!profileId) return;
  const { data: property } = await supabase.from("properties").select("organization_id").eq("id", parsed.data.propertyId).maybeSingle();
  if (!property) return;
  const { error } = await supabase.from("property_tasks").insert({
    organization_id: property.organization_id, property_id: parsed.data.propertyId,
    inventory_unit_id: parsed.data.inventoryUnitId || null, task_type: parsed.data.taskType,
    title: parsed.data.title, priority: parsed.data.priority, assigned_to_label: parsed.data.assignedToLabel || null,
    created_by_profile_id: profileId,
  });
  if (error) throw new Error("Task could not be created.");
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  revalidatePath(`/app/property/${parsed.data.propertyId}/operations`);
}

const updateSchema = z.object({ propertyId: z.string().uuid(), taskId: z.string().uuid(), status: z.enum(["assigned", "in_progress", "waiting", "completed", "cancelled"]) });

export async function updatePropertyTask(formData: FormData) {
  const parsed = updateSchema.safeParse({ propertyId: formData.get("propertyId"), taskId: formData.get("taskId"), status: formData.get("status") });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  const completedAt = parsed.data.status === "completed" ? new Date().toISOString() : null;
  const { error } = await supabase.from("property_tasks").update({ status: parsed.data.status, completed_at: completedAt }).eq("id", parsed.data.taskId).eq("property_id", parsed.data.propertyId);
  if (error) throw new Error("Task could not be updated.");
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  revalidatePath(`/app/property/${parsed.data.propertyId}/operations`);
}
