"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReservationActionState = { status: "idle" | "success" | "error"; message?: string };

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function actionError(error: { code?: string; message?: string }) {
  if (error.code === "42501") return "You do not have reservation access for this property.";
  if (error.code === "23P01") return "That room or bed is already allocated for these dates.";
  if (error.code === "23505") return "That unit code already exists in this property.";
  if (["23514", "22007"].includes(error.code ?? "")) return error.message || "The submitted details are not valid.";
  return "The action could not be completed. Refresh and try again.";
}

const inventorySchema = z.object({
  propertyId: z.uuid(),
  unitCode: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/),
  displayName: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80),
  floorLabel: z.string().trim().max(40),
  maxOccupancy: z.coerce.number().int().min(1).max(50),
  nightlyRate: z.coerce.number().min(0).max(1000000),
});

export async function createInventoryUnit(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const parsed = inventorySchema.safeParse({
    propertyId: field(formData, "propertyId"), unitCode: field(formData, "unitCode"),
    displayName: field(formData, "displayName"), category: field(formData, "category"),
    floorLabel: field(formData, "floorLabel"), maxOccupancy: field(formData, "maxOccupancy"),
    nightlyRate: field(formData, "nightlyRate") || "0",
  });
  if (!parsed.success) return { status: "error", message: "Enter a valid unit code, name, and capacity." };

  const supabase = await createSupabaseServerClient();
  const { data: property, error: propertyError } = await supabase.from("properties")
    .select("organization_id, inventory_unit").eq("id", parsed.data.propertyId).maybeSingle();
  if (propertyError || !property) return { status: "error", message: "Property context could not be verified." };

  const { error } = await supabase.from("inventory_units").insert({
    organization_id: property.organization_id,
    property_id: parsed.data.propertyId,
    unit_code: parsed.data.unitCode,
    display_name: parsed.data.displayName,
    unit_kind: property.inventory_unit === "beds" ? "bed" : "room",
    category: parsed.data.category || null,
    floor_label: parsed.data.floorLabel || null,
    max_occupancy: parsed.data.maxOccupancy,
    nightly_rate_minor: Math.round(parsed.data.nightlyRate * 100),
  });
  if (error) return { status: "error", message: actionError(error) };
  revalidatePath(`/app/property/${parsed.data.propertyId}/reservations`);
  return { status: "success", message: `${property.inventory_unit === "beds" ? "Bed" : "Room"} added to inventory.` };
}

const reservationSchema = z.object({
  propertyId: z.uuid(), inventoryUnitId: z.uuid(),
  guestName: z.string().trim().min(2).max(160),
  guestPhone: z.string().trim().regex(/^[+]?[0-9 ()-]{8,24}$/),
  checkInDate: z.iso.date(), checkOutDate: z.iso.date(),
  adults: z.coerce.number().int().min(1).max(50),
  children: z.coerce.number().int().min(0).max(50),
  source: z.enum(["front_desk", "phone", "whatsapp", "web", "walk_in", "other"]),
  notes: z.string().trim().max(2000),
}).refine((data) => data.checkOutDate > data.checkInDate, { message: "Check-out must be after check-in." });

export async function createReservation(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const parsed = reservationSchema.safeParse({
    propertyId: field(formData, "propertyId"), inventoryUnitId: field(formData, "inventoryUnitId"),
    guestName: field(formData, "guestName"), guestPhone: field(formData, "guestPhone"),
    checkInDate: field(formData, "checkInDate"), checkOutDate: field(formData, "checkOutDate"),
    adults: field(formData, "adults"), children: field(formData, "children") || "0",
    source: field(formData, "source"), notes: field(formData, "notes"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message || "Check the booking details." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_property_reservation", {
    target_property_id: parsed.data.propertyId, target_inventory_unit_id: parsed.data.inventoryUnitId,
    guest_name: parsed.data.guestName, guest_phone: parsed.data.guestPhone,
    check_in_date: parsed.data.checkInDate, check_out_date: parsed.data.checkOutDate,
    adult_count: parsed.data.adults, child_count: parsed.data.children,
    booking_source: parsed.data.source, reservation_notes: parsed.data.notes || null,
  });
  if (error) return { status: "error", message: actionError(error) };
  const reference = Array.isArray(data) ? (data[0] as { booking_reference?: string } | undefined)?.booking_reference : undefined;
  revalidatePath(`/app/property/${parsed.data.propertyId}/reservations`);
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  return { status: "success", message: reference ? `Reservation ${reference} confirmed.` : "Reservation confirmed." };
}

const transitionSchema = z.object({ propertyId: z.uuid(), reservationId: z.uuid(), action: z.enum(["cancel", "checked_in", "checked_out", "no_show"]) });

export async function changeReservationStatus(_state: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const parsed = transitionSchema.safeParse({ propertyId: field(formData, "propertyId"), reservationId: field(formData, "reservationId"), action: field(formData, "action") });
  if (!parsed.success) return { status: "error", message: "Reservation action is not valid." };
  const supabase = await createSupabaseServerClient();
  const { error } = parsed.data.action === "cancel"
    ? await supabase.rpc("cancel_property_reservation", { target_property_id: parsed.data.propertyId, target_reservation_id: parsed.data.reservationId })
    : await supabase.rpc("transition_property_reservation", { target_property_id: parsed.data.propertyId, target_reservation_id: parsed.data.reservationId, next_status: parsed.data.action });
  if (error) return { status: "error", message: actionError(error) };
  revalidatePath(`/app/property/${parsed.data.propertyId}/reservations`);
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  return { status: "success", message: `Reservation marked ${parsed.data.action.replaceAll("_", " ")}.` };
}
