import { describe, expect, it } from "vitest";
import {
  onboardingPermissions,
  onboardingSubmissionSchema,
  propertyStaffPermissions,
} from "./onboarding";

const validSubmission = {
  requesterKind: "property_owner",
  contactName: "Asha Sharma",
  contactEmail: "ASHA@EXAMPLE.COM",
  contactPhone: "+91 98765 43210",
  whatsappPhone: "",
  organizationName: "Asha Hotels",
  propertyName: "Asha Residency",
  propertyType: "hotel",
  roomCount: "24",
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

  it("defers commercial decisions while rejecting implausible inventory", () => {
    expect(onboardingSubmissionSchema.safeParse(validSubmission).success).toBe(true);
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      roomCount: 0,
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
