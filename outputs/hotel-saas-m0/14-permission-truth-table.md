# Executable Permission Truth Table

Status: required M1 specification. Each row becomes a database/service test before M0 receives final approval.

## Evaluation order

```text
authentication ceiling
→ active tenant and membership
→ applicable scope
→ collect role and override permissions
→ any applicable explicit deny = denied
→ remaining allows
→ minimum applicable financial limit
→ subscription/lifecycle entitlement
```

Explicit allow cannot override applicable deny. Broader and narrower denies both remain effective wherever their scopes apply. Actor mode may only reduce permissions.

| Case | Inputs | Expected |
|---|---|---|
| P-01 | Org role allows reports; Property A explicit deny | Property A denied |
| P-02 | Org explicit deny; Property A explicit allow | Denied |
| P-03 | Org role allows reports; Property A no override | Allowed in assigned Property A |
| P-04 | Property A role allow; request Property B | Denied |
| P-05 | Owner role allow; shared-device PIN mode | Sensitive action denied by ceiling |
| P-06 | Refund role limit ₹5,000; override limit ₹2,000 | Effective limit ₹2,000 |
| P-07 | Two roles limit ₹5,000 and ₹10,000 | Effective limit ₹5,000 unless approved policy explicitly aggregates otherwise |
| P-08 | Explicit refund deny plus refund limit | Denied; limit irrelevant |
| P-09 | Membership suspended; valid JWT | Denied |
| P-10 | Tenant read-only; new booking permission allowed by role | Denied by lifecycle |
| P-11 | Tenant read-only; existing stay checkout allowed by role | Allowed |
| P-12 | Tenant read-only; owner export | Allowed |
| P-13 | Tenant read-only; member update | Denied |
| P-14 | Grace tenant; new check-in and policy enabled | Allowed with normal permission |
| P-15 | Grace tenant; new check-in and policy disabled | Denied |
| P-16 | Guest actor bound to Stay A requests Stay B | Denied without metadata leakage |
| P-17 | Local staff actor on Device A requests another property | Denied |
| P-18 | Device session revoked; correct PIN | Denied |
| P-19 | Management actor has applicable allow; recent re-auth required but stale | Step-up required, not allowed |
| P-20 | High-privilege invite claimed by forwarded Google account | Pending inviter approval; no membership activation |
| P-21 | Sole-owner recovery case unapproved/in cooling period | Ownership/billing mutation denied |
| P-22 | Platform support without active consent grant | Tenant data denied |
| P-23 | Platform support consent expired | Tenant data denied |
| P-24 | Auditor tries alternate mutation endpoint | Denied |
| P-25 | Realtime/storage access with UI access but failed RLS/scope | Denied |
| P-26 | Security-suspended tenant attempts existing checkout | Denied through ordinary tenant path; platform emergency procedure only |
| P-27 | Billing read-only tenant attempts existing checkout | Allowed with normal checkout permission |
| P-28 | Active legal hold and approved deletion request | Deletion processing blocked; access state unchanged |
| P-29 | Export request enters processing/ready | Tenant permissions remain determined only by access lifecycle |
| P-30 | Operational staff has two permissive roles in PIN mode | Combined permissions remain below the PIN authentication ceiling |

## Test contract

Every case is exercised at domain-service and database/RLS level where applicable. Tests assert both denial and non-disclosure: inaccessible tenant/property/resource existence must not be revealed through error text, counts, timing-sensitive alternate paths or realtime/storage channels.
