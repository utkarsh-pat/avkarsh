import { z } from "zod";

export const requesterKinds = [
  { value: "property_owner", label: "Property owner", copy: "I own or directly operate this property." },
  { value: "company_operator", label: "Company operator", copy: "I manage properties for a hotel group or company." },
  { value: "implementation_partner", label: "Implementation partner", copy: "I am onboarding this property for a client." },
  { value: "property_staff", label: "Property staff", copy: "I work at the property and need the right access path." },
] as const;

export const propertyTypes = [
  ["hotel", "Hotel"],
  ["hostel", "Hostel"],
  ["resort", "Resort"],
  ["guest_house", "Guest house"],
  ["serviced_apartment", "Serviced apartment"],
  ["homestay", "Homestay"],
  ["other", "Other"],
] as const;

export const onboardingPermissions = [
  ["dashboard.view", "Dashboard", "Daily property overview"],
  ["reservation.manage", "Reservations", "Create and manage bookings"],
  ["guest.manage", "Guests", "Guest profiles and requests"],
  ["stay.manage", "Front desk", "Arrivals, stays, and departures"],
  ["folio.manage", "Folios", "Charges and settlement state"],
  ["payment.manage", "Payments", "Collection, adjustments, and refunds"],
  ["reports.read", "Reports", "Operational and financial reporting"],
  ["staff.manage", "Team access", "Invite and manage staff"],
  ["property.settings", "Property settings", "Configure the property"],
  ["whatsapp.manage", "WhatsApp", "Guest messaging and automation"],
  ["audit.read", "Audit log", "Security and operational history"],
  ["organization.manage", "Organization", "Organization-wide settings"],
  ["subscription.read", "Subscription", "Plan and usage visibility"],
] as const;

export const defaultRequestedPermissions = onboardingPermissions
  .map(([key]) => key)
  .filter((key) => !["payment.manage", "audit.read", "organization.manage"].includes(key));

const phoneSchema = z.string().trim().min(8).max(24).regex(/^[+0-9][0-9 ()-]+$/);

export const onboardingSubmissionSchema = z.object({
  requesterKind: z.enum(requesterKinds.map(({ value }) => value)),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.email().trim().toLowerCase(),
  contactPhone: phoneSchema,
  whatsappPhone: z.union([phoneSchema, z.literal("")]).optional(),
  organizationName: z.string().trim().min(2).max(160),
  propertyName: z.string().trim().min(2).max(160),
  propertyType: z.enum(propertyTypes.map(([value]) => value)),
  roomCount: z.coerce.number().int().min(1).max(10000),
  addressLine: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(120),
  stateRegion: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  timezone: z.string().trim().min(3).max(64),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  requestedPlan: z.enum(["trial", "starter", "growth", "enterprise"]),
  requestedPermissions: z.array(z.enum(onboardingPermissions.map(([key]) => key))).min(1),
  notes: z.union([z.string().trim().min(3).max(1000), z.literal("")]).optional(),
  termsAccepted: z.literal("on"),
});

export type OnboardingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  requestId?: string;
};

