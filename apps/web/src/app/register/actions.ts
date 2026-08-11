"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  onboardingSubmissionSchema,
  type OnboardingActionState,
} from "@/lib/onboarding";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function submitOnboardingRequest(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = onboardingSubmissionSchema.safeParse({
    requesterKind: field(formData, "requesterKind"),
    contactName: field(formData, "contactName"),
    contactEmail: field(formData, "contactEmail"),
    contactPhone: field(formData, "contactPhone"),
    whatsappPhone: field(formData, "whatsappPhone"),
    organizationName: field(formData, "organizationName"),
    propertyName: field(formData, "propertyName"),
    propertyType: field(formData, "propertyType"),
    roomCount: field(formData, "roomCount"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    stateRegion: field(formData, "stateRegion"),
    countryCode: field(formData, "countryCode"),
    timezone: field(formData, "timezone"),
    currencyCode: field(formData, "currencyCode"),
    requestedPlan: "pending_admin_review",
    requestedPermissions: [],
    notes: field(formData, "notes"),
    termsAccepted: field(formData, "termsAccepted"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted details and complete every required field.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const profileId = typeof claims?.sub === "string" ? claims.sub : null;
  const verifiedEmail = typeof claims?.email === "string" ? claims.email.toLowerCase() : null;
  const requestId = randomUUID();
  const data = parsed.data;

  const { error } = await supabase.from("onboarding_requests").insert({
    id: requestId,
    requester_profile_id: profileId,
    requester_kind: data.requesterKind,
    contact_name: data.contactName,
    contact_email: verifiedEmail ?? data.contactEmail,
    contact_phone: data.contactPhone,
    whatsapp_phone: data.whatsappPhone || null,
    organization_name: data.organizationName,
    property_name: data.propertyName,
    property_type: data.propertyType,
    room_count: data.roomCount,
    address_line: data.addressLine,
    city: data.city,
    state_region: data.stateRegion,
    country_code: data.countryCode,
    timezone: data.timezone,
    currency_code: data.currencyCode,
    requested_plan: data.requestedPlan,
    requested_permissions: data.requestedPermissions,
    notes: data.notes || null,
    status: "pending",
  });

  if (error) {
    const duplicate = error.code === "23505";
    return {
      status: "error",
      message: duplicate
        ? "An open request already exists for this email. Sign in to see its status or wait for review."
        : "We could not submit the request. Please try again in a moment.",
    };
  }

  revalidatePath("/register");
  return {
    status: "success",
    requestId,
    message: "Your request is in the Avkarsh approval queue. We will not create access until a platform administrator reviews it.",
  };
}
