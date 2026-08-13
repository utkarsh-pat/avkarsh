"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationActionState } from "../actions";

function field(formData: FormData, name: string) { return String(formData.get(name) ?? ""); }
function message(error: { code?: string; message?: string }) {
  if (error.code === "23P01") return "That room or bed is already allocated during this stay.";
  if (error.code === "42501") return "You do not have stay-management access.";
  if (["23514", "22023", "55P03"].includes(error.code ?? "")) return error.message || "The stay could not be changed.";
  return "The stay change could not be completed. Refresh and try again.";
}
function refresh(propertyId: string, reservationId: string) {
  revalidatePath(`/app/property/${propertyId}`);
  revalidatePath(`/app/property/${propertyId}/reservations`);
  revalidatePath(`/app/property/${propertyId}/reservations/${reservationId}`);
}

const moveSchema = z.object({
  propertyId: z.uuid(), reservationId: z.uuid(), inventoryUnitId: z.uuid(), commandKey: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});
export async function moveReservation(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const parsed = moveSchema.safeParse({ propertyId: field(formData, "propertyId"), reservationId: field(formData, "reservationId"), inventoryUnitId: field(formData, "inventoryUnitId"), commandKey: field(formData, "commandKey"), reason: field(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message || "Choose a target unit and enter a reason." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("move_property_reservation", { target_property_id: parsed.data.propertyId, target_reservation_id: parsed.data.reservationId, target_inventory_unit_id: parsed.data.inventoryUnitId, command_key: parsed.data.commandKey, move_reason: parsed.data.reason });
  if (error) return { status: "error", message: message(error) };
  refresh(parsed.data.propertyId, parsed.data.reservationId);
  return { status: "success", message: "Room or bed moved. Booked value was preserved.", commandKey: crypto.randomUUID() };
}

const extendSchema = z.object({
  propertyId: z.uuid(), reservationId: z.uuid(), commandKey: z.uuid(),
  newCheckOutDate: z.iso.date(), reason: z.string().trim().min(3).max(500),
});
export async function extendReservation(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const parsed = extendSchema.safeParse({ propertyId: field(formData, "propertyId"), reservationId: field(formData, "reservationId"), commandKey: field(formData, "commandKey"), newCheckOutDate: field(formData, "newCheckOutDate"), reason: field(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message || "Enter a later checkout date and reason." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("extend_property_reservation", { target_property_id: parsed.data.propertyId, target_reservation_id: parsed.data.reservationId, new_check_out_date: parsed.data.newCheckOutDate, command_key: parsed.data.commandKey, extension_reason: parsed.data.reason });
  if (error) return { status: "error", message: message(error) };
  refresh(parsed.data.propertyId, parsed.data.reservationId);
  return { status: "success", message: "Stay extended and booked room value recalculated.", commandKey: crypto.randomUUID() };
}
