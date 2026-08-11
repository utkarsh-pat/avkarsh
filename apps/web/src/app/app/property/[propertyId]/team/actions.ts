"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { propertyStaffPermissions } from "@/lib/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeamActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  invitePath?: string;
};

const initialPermissionKeys = propertyStaffPermissions.map(([key]) => key);

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function teamError(error: { code?: string; message?: string }) {
  if (error.code === "42501") return "You do not have permission for this team action.";
  if (["23514", "23505"].includes(error.code ?? "")) return error.message ?? "The team action is not valid.";
  return "The team action could not be completed. Refresh and try again.";
}

const createInvitationSchema = z.object({
  propertyId: z.uuid(),
  email: z.email().trim().toLowerCase(),
  permissions: z.array(z.enum(initialPermissionKeys)).min(1),
  expiryDays: z.coerce.number().int().min(1).max(30),
});

export async function createStaffInvitation(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const parsed = createInvitationSchema.safeParse({
    propertyId: value(formData, "propertyId"),
    email: value(formData, "email"),
    permissions: formData.getAll("permissions").map(String),
    expiryDays: value(formData, "expiryDays") || "7",
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email, expiry, and at least one staff permission." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_property_staff_invitation", {
    target_property_id: parsed.data.propertyId,
    intended_email: parsed.data.email,
    selected_permissions: parsed.data.permissions,
    expiry_days: parsed.data.expiryDays,
  });

  if (error) return { status: "error", message: teamError(error) };
  const invitation = Array.isArray(data) ? data[0] as { raw_token?: string } | undefined : undefined;
  if (!invitation?.raw_token) return { status: "error", message: "The invitation token was not returned." };

  revalidatePath(`/app/property/${parsed.data.propertyId}/team`);
  return {
    status: "success",
    message: "Invitation created. Copy this link now; the raw token is never stored and cannot be shown again.",
    invitePath: `/invite/${invitation.raw_token}`,
  };
}

const reviewInvitationSchema = z.object({
  propertyId: z.uuid(),
  invitationId: z.uuid(),
  decision: z.enum(["approve", "revoke"]),
  reason: z.string().trim().min(3).max(500),
});

export async function reviewStaffInvitation(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const parsed = reviewInvitationSchema.safeParse({
    propertyId: value(formData, "propertyId"),
    invitationId: value(formData, "invitationId"),
    decision: value(formData, "decision"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", message: "A clear review reason is required." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_property_staff_invitation", {
    target_invitation_id: parsed.data.invitationId,
    review_decision: parsed.data.decision,
    reason_text: parsed.data.reason,
  });
  if (error) return { status: "error", message: teamError(error) };

  revalidatePath(`/app/property/${parsed.data.propertyId}/team`);
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  return {
    status: "success",
    message: parsed.data.decision === "approve"
      ? "Claimed identity approved and property access activated."
      : "Invitation revoked before access activation.",
  };
}

const memberAccessSchema = z.object({
  propertyId: z.uuid(),
  profileId: z.uuid(),
  action: z.enum(["suspend", "restore"]),
  reason: z.string().trim().min(3).max(500),
});

export async function changeTeamMemberAccess(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const parsed = memberAccessSchema.safeParse({
    propertyId: value(formData, "propertyId"),
    profileId: value(formData, "profileId"),
    action: value(formData, "action"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", message: "A clear access-change reason is required." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_property_team_member_access", {
    target_property_id: parsed.data.propertyId,
    target_profile_id: parsed.data.profileId,
    requested_action: parsed.data.action,
    reason_text: parsed.data.reason,
  });
  if (error) return { status: "error", message: teamError(error) };

  revalidatePath(`/app/property/${parsed.data.propertyId}/team`);
  revalidatePath(`/app/property/${parsed.data.propertyId}`);
  return {
    status: "success",
    message: parsed.data.action === "suspend" ? "Property access suspended immediately." : "Property access restored.",
  };
}
