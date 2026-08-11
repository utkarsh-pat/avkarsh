"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClaimInvitationState = { status: "idle" | "success" | "error"; message?: string };

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export async function claimStaffInvitation(
  _state: ClaimInvitationState,
  formData: FormData,
): Promise<ClaimInvitationState> {
  const parsed = tokenSchema.safeParse(String(formData.get("token") ?? ""));
  if (!parsed.success) return { status: "error", message: "This invitation link is invalid." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("claim_property_staff_invitation", { raw_token: parsed.data });
  if (error?.code === "42501") return { status: "error", message: "This invitation belongs to a different Google email, or your identity is not Google-verified." };
  if (error?.code === "23514") return { status: "error", message: "This invitation has expired." };
  if (error) return { status: "error", message: "This invitation is no longer claimable." };

  return {
    status: "success",
    message: "Identity claimed successfully. Your property administrator must now approve it before access becomes active.",
  };
}
