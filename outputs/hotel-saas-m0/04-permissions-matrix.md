# Permissions and Authorization Matrix

## 1. Effective permission algorithm

```text
authentication-mode ceiling
→ active tenant lifecycle and active membership
→ applicable organization/property scope
→ collect role and override permissions
→ applicable explicit deny wins permanently
→ remaining role/override allows
→ minimum applicable financial limit
→ subscription/lifecycle entitlement
= effective permission
```

All checks are server/database enforced. Role labels are conveniences; permission keys are the authorization contract. Explicit allow never overrides an applicable deny. Authentication-mode ceiling remains above every role and override. The executable cases in `14-permission-truth-table.md` are M1 acceptance criteria.

## 2. Authentication strength

| Mode | Allowed ceiling |
|---|---|
| Google-authenticated management session | Role/limit dependent |
| Recent Google re-auth | Ownership, high-risk finance, export, billing and sensitive membership changes |
| Manager-established shared-device + staff PIN | Reception/housekeeping/maintenance operational subset only |
| Guest portal session | Current verified stay and explicitly allowed private actions |
| Public QR | Public property/city content and safe request initiation only |

## 3. Permission families by role

Legend: **A** administer/approve, **W** operational write, **R** read, **L** limited/scoped, **—** denied by default.

| Permission family | Org Owner | Partner Owner | Org Admin | Group Manager | Group Accountant | Property Manager | Reception | Property Accountant | Housekeeping | Maintenance | Concierge | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Organization settings/ownership | A | L | W | R | R | R | — | — | — | — | — | R |
| Properties/configuration | A | L | A | W | R | A | R | R | R | R | R | R |
| Members/roles/invitations | A | L | A | L | — | L | — | — | — | — | — | R |
| Rooms/beds/rates | A | L | A | W | R | A | W | R | R | R | R | R |
| Reservations/stays | A | L | R | A | R | A | W | R | L | R | R | R |
| Guest profiles/KYC | A | L | R | A | L | A | W | L | — | — | — | L |
| Payments/refunds/discounts | A | L | R | A/L | A/L | A/L | L | W/L | — | — | — | R/L |
| Expenses/approvals | A | L | R | A/L | A/L | A/L | L | W/L | — | L | — | R |
| Cash shifts/closing | A | L | R | A/L | A | A/L | W/L | A | — | — | — | R |
| Housekeeping/maintenance | A | L | R | A | R | A | W | R | W | W | R | R |
| Guest requests | A | L | R | A | R | A | W | R | W/L | W/L | W/L | R |
| WhatsApp inbox/templates | A | L | A | A | R | A | W | R | L | L | W | R/L |
| Concierge/vendors/commissions | A | L | A | A | R | A | L | R | — | — | W | R |
| Reports/exports | A | L | A | A | A | A | L | A | L | L | L | R/L |
| Subscription/billing | A | L | L | R | R | — | — | — | — | — | — | R/L |
| Audit/security events | A | L | R | R | R | R | — | — | — | — | — | R/L |

This is the default bundle proposal. Final permission keys and sensitive-field masking must be approved with the pilot hotel.

## 4. Platform roles

| Capability | Super Admin | Platform Support | Platform Finance |
|---|---:|---:|---:|
| Organizations/plans/system health | A | R/L | R |
| Consent-based tenant diagnostics | A | L, time-bound | — |
| Tenant operational finance | Break-glass only | — | — |
| Tenant KYC | Break-glass only, audited | — | — |
| SaaS invoices/payments | A | R | A |
| Feature flags/entitlements | A | — | R |

Platform access never bypasses consent/audit as a routine support mechanism.

## 5. Financial controls

| Action | Required controls |
|---|---|
| Discount | Permission + maximum percentage/amount + reason |
| Refund | Permission + maximum minor units + original payment + idempotency + reason |
| Expense approval | Permission + property scope + amount ceiling + separation from submitter where configured |
| Cash adjustment | Permission + ceiling + reason + shift state |
| Ownership/payment-setting change | Recent Google re-auth or owner approval |

Limits use property currency and server-calculated totals. Client modifications cannot increase authorization.

## 6. Mandatory negative rules

- A property ID in a URL/body never grants access.
- A manager cannot access an unassigned property.
- A PIN session cannot call owner, finance approval, export, billing or membership endpoints.
- Revoked/suspended memberships deny access even with an unexpired JWT.
- A guest session cannot enumerate another stay, room or bed occupant.
- Support roles cannot routinely read KYC or tenant finances.
- Read-only/auditor roles cannot trigger actions through alternate endpoints.
- Realtime channels and storage policies follow the same tenant rules as table reads.

## 7. Read-only lifecycle exceptions

| Operation in tenant `read_only` | Result |
|---|---|
| Existing stay checkout | Allowed with normal permission |
| Existing folio reconciliation | Allowed with normal permission |
| Refund/reversal | Allowed only with approval/limit controls |
| New booking | Denied |
| New check-in | Denied unless grace-period policy explicitly allows it |
| Owner data export | Always available to authorized owner |
| Emergency/public QR information | Available |
| Configuration/member change | Denied |

Lifecycle entitlement is evaluated after actor authorization; it can restrict an otherwise permitted action or expose only the explicit recovery/continuity exceptions above.

Security `suspended` is not billing `read_only`. A suspended tenant cannot use ordinary checkout/reconciliation exceptions; only explicitly platform-controlled emergency or recovery procedures apply. Export requests do not modify access permissions, while an active legal hold prevents deletion workflow progression.
