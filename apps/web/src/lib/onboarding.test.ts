import { describe, expect, it } from "vitest";
import {
  onboardingPermissions,
  onboardingSubmissionSchema,
  propertyStaffPermissions,
} from "./onboarding";
import { buildE164Phone, isPossiblePhone, sanitizeNationalPhone } from "./phone";

const validSubmission = {
  requesterKind: "property_owner",
  contactName: "Asha Sharma",
  contactEmail: "ASHA@EXAMPLE.COM",
  contactPhone: "+919876543210",
  whatsappPhone: "",
  organizationName: "Asha Hotels",
  propertyName: "Asha Residency",
  propertyType: "hotel",
  roomCount: "24",
  latitude: "26.9124",
  longitude: "75.7873",
  addressLine: "12 Station Road",
  city: "Jaipur",
  stateRegion: "Rajasthan",
  countryCode: "in",
  timezone: "Asia/Kolkata",
  currencyCode: "inr",
  requestedPlan: "pending_admin_review",
  requestedPermissions: [],
  notes: "Opening next month",
  termsAccepted: "on",
};

describe("owner onboarding contract", () => {
  it("keeps permission keys unique", () => {
    const keys = onboardingPermissions.map(([key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("normalizes identity and commercial context", () => {
    const parsed = onboardingSubmissionSchema.parse(validSubmission);
    expect(parsed.contactEmail).toBe("asha@example.com");
    expect(parsed.countryCode).toBe("IN");
    expect(parsed.currencyCode).toBe("INR");
    expect(parsed.roomCount).toBe(24);
  });

  it("composes country-aware E.164 phone numbers", () => {
    expect(sanitizeNationalPhone("98call765-43210")).toBe("9876543210");
    expect(isPossiblePhone("IN", "9876543210")).toBe(true);
    expect(buildE164Phone("IN", "9876543210")).toBe("+919876543210");
    expect(buildE164Phone("US", "2025550123")).toBe("+12025550123");
  });

  it("rejects alphabetic phone values at the server boundary", () => {
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      contactPhone: "call-me-now",
    }).success).toBe(false);
  });

  it("defers commercial decisions while rejecting implausible inventory", () => {
    expect(onboardingSubmissionSchema.safeParse(validSubmission).success).toBe(true);
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      roomCount: 0,
    }).success).toBe(false);
  });

  it("allows only owners and company operators to submit public onboarding", () => {
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      requesterKind: "company_operator",
    }).success).toBe(true);
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      requesterKind: "implementation_partner",
    }).success).toBe(false);
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      requesterKind: "property_staff",
    }).success).toBe(false);
  });

  it("keeps property staff grants inside the operational permission boundary", () => {
    const keys = propertyStaffPermissions.map(([key]) => key);
    expect(keys).not.toContain("staff.manage");
    expect(keys).not.toContain("organization.manage");
    expect(keys).not.toContain("subscription.read");
    expect(keys).not.toContain("property.settings");
  });
});
