import { describe, expect, it } from "vitest";
import {
  defaultRequestedPermissions,
  onboardingPermissions,
  onboardingSubmissionSchema,
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
  requestedPlan: "trial",
  requestedPermissions: defaultRequestedPermissions,
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

  it("rejects empty permissions and implausible inventory", () => {
    expect(onboardingSubmissionSchema.safeParse({
      ...validSubmission,
      requestedPermissions: [],
      roomCount: 0,
    }).success).toBe(false);
  });
});

