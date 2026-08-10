# Test and Milestone Acceptance Plan

## 1. Test layers

| Layer | Proves |
|---|---|
| Unit | Money, dates, permissions, transitions, parsers and pure rules |
| Database | Constraints, transactions, RLS, grants, functions and storage policies |
| Integration | Auth/membership, booking lifecycle, QR, WhatsApp and entitlements |
| E2E mobile | Real persona journeys at 320/360/390/430 px |
| Security | Tenant tampering, replay, brute force, file access and parameter manipulation |
| Operational | Backup/restore, dead-letter recovery, monitoring and deployment rollback |

## 2. Required personas

Platform admin; organization owner/group manager; partner owner with one property; manager with two selected properties; receptionist and housekeeper on shared device; private-room guest; shared-room bed guest; and one user belonging to two unrelated organizations.

## 3. Milestone acceptance map

### M0 — architecture

- ADRs, logical ERD, permission matrix, mobile IA, repository plan, threat model and acceptance map reviewed.
- Material open decisions have owners.
- No application implementation has started.

### M1 — identity and tenancy

- Google PKCE/SSR login creates/links a profile.
- One user can access multiple organizations and multiple roles without role data in editable metadata.
- Property switching rejects unassigned properties server-side and through RLS.
- Invitation tokens are one-time, expiring and auditable.
- Forwarded owner/partner/manager invitation cannot activate until inviter approval of the claimed Google identity.
- Management and operational staff identities create correct scoped actor audit records; guest actors remain stay/session scoped.
- Permission truth-table cases pass, including permanent deny, mode ceiling and minimum applicable financial limits.
- Shared-device PIN cannot enter owner/finance/export/member routes.
- Revoked membership loses sensitive access despite an old session.
- Revoked device session rejects correct PIN; sole-owner recovery requires approved case/cooling controls.
- Tenant lifecycle/read-only exception matrix is server enforced.
- Same command key + different request hash returns conflict; same key/hash returns the original safe result.
- Critical audit event commits atomically with the mutation even when outbox delivery fails.
- Exit: complete positive/negative RLS matrix passes.

### M2 — inventory and bookings

- Room, bed, whole-room and individual-bed inventory supported.
- Two concurrent clients attempting the same bed/room yield exactly one allocation.
- Whole-room allocation conflicts with every contained bed and vice versa.
- Dates follow property timezone and half-open stay ranges.
- Modified client price/discount is rejected/recomputed.
- Exit: database concurrency proof and mobile booking lifecycle pass.

### M3 — stay and finance

- Check-in/out moves resources through correct operational states.
- KYC files are private and signed URLs expire.
- Folio totals, taxes, discounts, payment/refund idempotency and reversals are server-controlled.
- Cash close difference requires reason/approval and posted history cannot silently change.
- Exit: complete stay lifecycle and finance tamper suite pass.

### M4 — QR operations

- Random tokens reveal public content only until stay verification.
- A guest cannot access another room/stay, especially in shared inventory.
- Housekeeping PIN flow is property-bound, rate-limited and completes target task within usability goal.
- Offline safe drafts visibly sync; booking/finance actions cannot finalize offline.
- Exit: QR isolation tests and staff usability evidence pass.

### M5 — WhatsApp

- Webhook verification/signature and replay dedupe pass.
- Ingest acknowledges quickly; processing is retryable/idempotent.
- Phone number routing isolates organizations/properties.
- Bot state persists explicitly and pauses during human handover.
- Usage caps prevent automation loops; PMS continues when Meta is unavailable.
- Exit: sandbox/pilot E2E plus dead-letter recovery pass.

### M6 — concierge

- Platform template inheritance and property override do not overwrite local changes silently.
- Service enquiries/bookings and manual commissions remain property scoped.
- Vendor payable and commission are distinct and auditable.
- Exit: property staff updates content without developer support.

### M7 — billing/production

- Plans/limits/trial/grace/read-only behavior is server enforced.
- Support access is consent-based/time-bound/audited.
- Backup restore, incident runbook, commercial hosting terms and retention/legal review complete.
- Deep security and performance tests have zero open critical findings.
- Exit: production-readiness checklist signed.

## 4. Mandatory adversarial scenarios

| Attack/test | Expected result |
|---|---|
| Change organization/property ID in request | Denied by server and RLS; audited where sensitive |
| Manager requests unassigned property | Not found/forbidden without data leakage |
| Staff PIN calls owner route | Denied regardless of frontend navigation |
| Simultaneous booking of same resource | One commit; one typed conflict |
| Guest QR changes stay/resource identifier | Denied; no occupant metadata leaked |
| Replay WhatsApp webhook | Duplicate ignored/idempotently acknowledged |
| Modify price/discount/refund client payload | Canonical server result or denial |
| Public client reads private Storage path | Denied; no long-lived public URL |
| Revoked member reuses old token | Sensitive access denied by current membership state |

## 5. Mobile evidence

For each core E2E, archive viewport, browser/device, locale, persona, seed state, screenshots/video where useful and result. Launch-locale coverage includes Hindi, English, French, Spanish, German and Russian; layout stress covers long translations and Devanagari glyphs. Test loading, empty, error, offline and conflict states—not only the happy path.

## 6. Defect gates

- Critical/high security or tenant-isolation defect: milestone cannot exit.
- Booking collision or unbalanced/unaudited financial mutation: milestone cannot exit.
- Required mobile flow unusable at 320 px: milestone cannot exit.
- Medium defect: owner, remediation date and explicit risk acceptance required.
