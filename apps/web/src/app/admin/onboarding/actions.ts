"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { onboardingPermissions } from "@/lib/onboarding";

export type AdminActionState = { status: "idle" | "success" | "error"; message?: string };

const reviewSchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500),
  permissions: z.array(z.enum(onboardingPermissions.map(([key]) => key))),
  plan: z.enum(["trial", "starter", "growth", "enterprise"]),
  billingCycle: z.enum(["monthly", "quarterly", "annual", "custom"]),
  amountRupees: z.coerce.number().min(0).max(100000000),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  trialDays: z.coerce.number().int().min(0).max(365),
  propertyLimit: z.coerce.number().int().min(1).max(10000),
  staffLimit: z.coerce.number().int().min(1).max(100000),
});

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function adminErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "42501") return "Your platform role does not permit this action.";
  if (error.code === "23514") return error.message ?? "This request is no longer reviewable.";
  return "The admin action could not be completed. Refresh and try again.";
}

export async function reviewOnboardingRequest(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const decision = value(formData, "decision");
  const parsed = reviewSchema.safeParse({
    requestId: value(formData, "requestId"),
    decision,
    reason: value(formData, "reason"),
    permissions: formData.getAll("permissions").map(String),
    plan: value(formData, "plan") || (decision === "reject" ? "trial" : ""),
    billingCycle: value(formData, "billingCycle") || "monthly",
    amountRupees: value(formData, "amountRupees") || "0",
    currencyCode: value(formData, "currencyCode") || "INR",
    trialDays: value(formData, "trialDays") || "14",
    propertyLimit: value(formData, "propertyLimit") || "1",
    staffLimit: value(formData, "staffLimit") || "10",
  });

  if (!parsed.success || (parsed.data.decision === "reject" && parsed.data.reason.length < 3)) {
    return { status: "error", message: "Complete the review fields and provide a reason when rejecting." };
  }

  if (parsed.data.decision === "approve" && parsed.data.permissions.length === 0) {
    return { status: "error", message: "Select at least one permission before approval." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_onboarding_request", {
    target_request_id: parsed.data.requestId,
    review_decision: parsed.data.decision,
    review_payload: {
      reason: parsed.data.reason || null,
      permissions: parsed.data.permissions,
      plan: parsed.data.plan,
      billing_cycle: parsed.data.billingCycle,
      amount_minor: Math.round(parsed.data.amountRupees * 100),
      currency_code: parsed.data.currencyCode,
      trial_days: parsed.data.trialDays,
      property_limit: parsed.data.propertyLimit,
      staff_limit: parsed.data.staffLimit,
    },
  });

  if (error) return { status: "error", message: adminErrorMessage(error) };

  revalidatePath("/admin/onboarding");
  return {
    status: "success",
    message: parsed.data.decision === "approve"
      ? "Organization, property, owner access, permissions, and subscription were provisioned together."
      : "The request was rejected and no tenant data was created.",
  };
}

const accessSchema = z.object({
  requestId: z.uuid(),
  action: z.enum(["revoke", "restore"]),
  reason: z.string().trim().min(3).max(500),
});

export async function changeOrganizationAccess(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = accessSchema.safeParse({
    requestId: value(formData, "requestId"),
    action: value(formData, "action"),
    reason: value(formData, "reason"),
  });

  if (!parsed.success) return { status: "error", message: "A clear reason is required for this access change." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_onboarding_organization_access", {
    target_request_id: parsed.data.requestId,
    requested_action: parsed.data.action,
    reason_text: parsed.data.reason,
  });

  if (error) return { status: "error", message: adminErrorMessage(error) };

  revalidatePath("/admin/onboarding");
  return {
    status: "success",
    message: parsed.data.action === "revoke"
      ? "Organization access and subscription were revoked immediately."
      : "Organization access, memberships, and subscription were restored.",
  };
}

const controlUpdateSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  permissions: z.array(z.enum(onboardingPermissions.map(([key]) => key))).min(1),
  plan: z.enum(["trial", "starter", "growth", "enterprise"]),
  billingCycle: z.enum(["monthly", "quarterly", "annual", "custom"]),
  amountRupees: z.coerce.number().min(0).max(100000000),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  trialDays: z.coerce.number().int().min(0).max(365),
  propertyLimit: z.coerce.number().int().min(1).max(10000),
  staffLimit: z.coerce.number().int().min(1).max(100000),
});

export async function updateProvisionedTenantControls(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = controlUpdateSchema.safeParse({
    requestId: value(formData, "requestId"),
    reason: value(formData, "reason"),
    permissions: formData.getAll("permissions").map(String),
    plan: value(formData, "plan"),
    billingCycle: value(formData, "billingCycle"),
    amountRupees: value(formData, "amountRupees"),
    currencyCode: value(formData, "currencyCode"),
    trialDays: value(formData, "trialDays"),
    propertyLimit: value(formData, "propertyLimit"),
    staffLimit: value(formData, "staffLimit"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Select at least one permission and complete every subscription control." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_provisioned_tenant_controls", {
    target_request_id: parsed.data.requestId,
    control_payload: {
      reason: parsed.data.reason,
      permissions: parsed.data.permissions,
      plan: parsed.data.plan,
      billing_cycle: parsed.data.billingCycle,
      amount_minor: Math.round(parsed.data.amountRupees * 100),
      currency_code: parsed.data.currencyCode,
      trial_days: parsed.data.trialDays,
      property_limit: parsed.data.propertyLimit,
      staff_limit: parsed.data.staffLimit,
    },
  });

  if (error) return { status: "error", message: adminErrorMessage(error) };

  revalidatePath("/admin/onboarding");
  revalidatePath("/app");
  return {
    status: "success",
    message: "Permissions, subscription terms, and tenant lifecycle were updated atomically.",
  };
}
