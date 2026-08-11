# ServiZephyr → Avkarsh reuse analysis

Date: 2026-08-11

## Scope reviewed

The restaurant SaaS at `S:\ServiZephyrTheRealBot` was reviewed across its landing and authentication entry points, role selection, self-onboarding, admin onboarding queue, owner dashboard shell, API authorization helpers, feature/page permission maps, subscription-adjacent access locks, WhatsApp routes, audit helpers, and revoke/impersonation support.

Representative source paths:

- `src/app/page.js`, `src/app/login/page.js`, `src/app/select-role/page.js`
- `src/app/onboard/page.js`, `src/app/api/public/onboard-request/route.js`
- `src/app/admin-dashboard/onboarding/page.js`, `src/app/api/admin/onboard-request/route.js`
- `src/app/admin-dashboard/layout.js`, `src/app/owner-dashboard/layout.js`
- `src/lib/verify-access-rbac.js`, `src/lib/permissions.js`
- `src/app/owner-dashboard/whatsapp-direct/page.js` and owner/admin WhatsApp API routes

## Reused product patterns

| ServiZephyr pattern | Avkarsh adaptation |
|---|---|
| Ask the unauthenticated visitor which role/context they represent | `/register` starts with property owner, company operator, implementation partner, or property staff. Staff are directed to invitation-based access. |
| Detailed self-onboarding request before tenant creation | Typed hotel/property request captures identity, property class, rooms/beds, address, operating timezone/currency, plan preference, and requested modules. |
| Admin onboarding inbox with request status tabs/cards | `/admin/onboarding` is a platform-protected review queue with pending, approved, rejected, and revoked lifecycle presentation. |
| Admin edits final business details before approval | Avkarsh admin chooses final permission set, plan, billing cycle, amount, trial, property limit, and staff limit before provisioning. |
| Owner dashboard feature locks | Avkarsh permissions are database keys resolved through tenant roles and overrides; the approved set is persisted in `role_permissions`. |
| Immediate employee/outlet revocation | Avkarsh revoke/restore synchronizes organization lifecycle, organization memberships, property memberships, and subscription state. |
| WhatsApp as an owner/admin module | `whatsapp.manage` is part of the approval model now; transport and bot workflows remain a later bounded module. |
| Admin and owner shells share visual conventions | Avkarsh keeps the same clear SaaS hierarchy—sticky shell, concise status badges, KPI strip, expandable review cards—using the existing Avkarsh design tokens and hotel terminology. |

## Deliberate non-reuse

The following implementation details were not copied because they would weaken Avkarsh's existing guarantees:

- **Client `localStorage` as role authority:** ServiZephyr caches role, business type, outlet, and employee permissions client-side. Avkarsh treats the URL and browser state only as navigation hints; Supabase RLS and the database authorization resolver remain authoritative.
- **Separate collections per business type:** Restaurant/store/street-vendor collection branching is replaced by typed organization/property rows and scoped memberships.
- **Denormalized `linkedOutlets` authorization:** Avkarsh uses relational memberships, tenant-safe composite foreign keys, scoped roles, explicit deny precedence, and financial limits.
- **Multi-step non-transactional approval:** Avkarsh provisions request, organization, property, tenant role, exact permissions, subscription, owner membership, and audit event inside one PostgreSQL transaction.
- **Short reusable claim codes:** Anonymous ownership is claimable only after Google verifies the exact request email. There is no six-digit ownership token to leak or brute-force.
- **Admin impersonation through query parameters:** No equivalent was introduced. Platform operations use a separate platform RBAC boundary and are audited.
- **Offline admin mutation queue:** Sensitive approve/reject/revoke actions require live authorization and database state. A stale cached admin page must never process a high-privilege action.
- **Firebase/Firestore core persistence:** Firebase remains a possible future choice for FCM/Crashlytics/Remote Config, not the tenant system of record.

## Implemented Avkarsh flow

1. A logged-in user enters `/register` with their verified Google identity prefilled; an anonymous user first selects who they are.
2. The request is inserted with a strict column grant and RLS policy. Anonymous users cannot read the approval queue; authenticated users see only their own requests.
3. A platform admin—not a tenant owner—opens `/admin/onboarding` and selects the exact modules and subscription limits.
4. Approval creates every tenant artifact atomically. Rejection creates no organization or property.
5. A logged-in applicant is attached immediately. An anonymous applicant must later sign in with the exact approved email, and the OAuth callback performs the safe claim.
6. Revocation suspends tenant visibility and memberships immediately; restoration returns the previous safe lifecycle and subscription state.
7. After approval, the platform admin can replace the exact permission set and edit subscription terms without leaving a revoked tenant active by accident.
8. The property workspace asks the database resolver for every module; route knowledge or client state cannot make an unapproved card active.
9. Approval, rejection, control changes, revocation, and restoration write append-only audit events without credential or payment-secret payloads.

## Remaining reuse candidates

- WhatsApp template management, webhook idempotency, delivery retries, and owner/admin conversation UI can be adapted after the core guest/reservation domain exists.
- The owner dashboard sidebar and module badge conventions can be reused when functional reservation, front-desk, folio, staff, and reporting pages replace the current workspace placeholders.
- ServiZephyr's operational telemetry and incident surfaces are useful references for a later platform operations milestone, but must write into Avkarsh's typed audit/outbox contracts.
