export const workspaceModules = [
  { permission: "dashboard.view", code: "DB", title: "Overview", description: "Property health, arrivals, occupancy, and shift handover at a glance." },
  { permission: "reservation.manage", code: "RS", title: "Reservations", description: "Create and manage room or bed bookings inside this property scope." },
  { permission: "guest.manage", code: "GS", title: "Guests", description: "Guest profiles, preferences, requests, and communication context." },
  { permission: "stay.manage", code: "FD", title: "Front desk", description: "Arrivals, in-house stays, room moves, and departures." },
  { permission: "folio.manage", code: "FL", title: "Folios", description: "Charges, adjustments, settlement state, and reconciliation." },
  { permission: "payment.manage", code: "PY", title: "Payments", description: "Collections, adjustments, refunds, and payment controls." },
  { permission: "reports.read", code: "RP", title: "Reports", description: "Permission-filtered operational and financial reporting." },
  { permission: "staff.manage", code: "TM", title: "Team access", description: "Invite, suspend, and scope property staff permissions." },
  { permission: "property.settings", code: "ST", title: "Property settings", description: "Operating timezone, currency, inventory, and property configuration." },
  { permission: "whatsapp.manage", code: "WA", title: "WhatsApp", description: "Guest messaging, templates, automation, and delivery state." },
  { permission: "audit.read", code: "AU", title: "Audit log", description: "Security-sensitive and operational activity history." },
  { permission: "organization.manage", code: "OR", title: "Organization", description: "Organization-wide access and configuration controls." },
  { permission: "subscription.read", code: "SB", title: "Plan and usage", description: "Subscription status, limits, and current commercial context." },
] as const;

