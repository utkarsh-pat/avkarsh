# Repository Threat Model

## Overview

This repository will contain a multi-tenant hotel SaaS used by owners, managers, accountants, receptionists, housekeeping/maintenance staff, guests, concierge operators and platform staff. It processes tenant configuration, room/bed allocations, guest identity/KYC, stays, payments/refunds/expenses/cash, QR sessions, WhatsApp messages and SaaS billing.

The highest-value invariants are: a tenant cannot access another tenant; the same inventory cannot be allocated twice; money cannot be altered or fabricated by clients; private guest/KYC data remains private; low-assurance PIN/QR identities cannot become privileged users; external webhook/retry behavior cannot duplicate effects; and sensitive history remains auditable.

At M0 the repository has no runtime code. The controls below are required architecture, not claims that implementations already exist.

## Threat Model, Trust Boundaries, and Assumptions

### Assets and privileges

- Organization/property data and membership/permission assignments.
- Availability, reservations and room/bed allocations.
- Guest profiles, stay context, KYC documents and private media.
- Folios, payments, refunds, expenses, cash shifts, invoices and audit records.
- QR/stay tokens, shared-device sessions, PIN verifiers and Google/Supabase sessions.
- Invitation claims, recovery cases, actor links and tenant lifecycle/continuity permissions.
- WhatsApp app secrets, access tokens, message content, templates and usage ledger.
- Supabase secret/service credentials, Storage signing ability and deployment secrets.
- Platform support/billing privileges, subscription entitlements and tenant exports.

### Trust boundaries

1. Public internet ↔ Next.js public/QR/webhook endpoints.
2. Browser/PWA ↔ server actions, route handlers, Supabase Data API, Realtime and Storage.
3. Management Google identity ↔ Supabase Auth ↔ current database membership state.
4. Manager-established shared device ↔ low-assurance staff PIN identity.
5. Public QR token ↔ verified guest stay session/scoped guest actor ↔ private stay data.
6. Next.js/server jobs ↔ Supabase database/private schemas/Storage.
7. Meta WhatsApp ↔ signature-verified webhook ↔ asynchronous message processor.
8. Tenant operators ↔ platform support/admin break-glass capabilities.
9. Local/staging/CI ↔ production secrets and data.

### Attacker-controlled inputs

- Every URL slug/UUID, form field, cookie, header, query parameter, uploaded file and client-computed amount.
- Organization/property/member/resource IDs and role/limit claims submitted by the client.
- QR tokens, stay PIN attempts and shared-device PIN attempts.
- Guest/WhatsApp message text, media metadata, webhook body and replay timing.
- OAuth callback parameters and redirect targets.
- Filenames, MIME types, image/audio documents and invoice fields.
- Realtime subscriptions and Storage object paths.
- Idempotency keys, dates/timezones, discount/refund inputs and concurrent booking attempts.

### Operator-controlled inputs

Rates, room/bed configuration, roles, approval limits, staff invitations, tax/invoice settings, templates, vendors, city content, retention policies and platform entitlements. These may be mistaken or malicious within an authorized scope and therefore require validation, audit and separation of duties where material.

### Developer-controlled inputs

Migrations, RLS/grants, dependency versions, environment configuration, CI workflows, feature flags and deployment scripts. A compromised dependency or overly privileged migration can bypass application controls.

### Assumptions

- Supabase and hosting providers meet their published security commitments; project configuration is still our responsibility.
- Google authenticates management identity but does not provide application authorization.
- Meta webhook authenticity does not imply payload authorization for a tenant until phone-number routing is resolved.
- Device compromise cannot be fully prevented; shared-device permissions and session lifetime limit impact.
- Legal/tax/KYC retention requirements are externally reviewed before production.

## Attack Surface, Mitigations, and Attacker Stories

### Tenant authorization and IDOR/BOLA

Story: an authenticated manager changes `property_id` or guesses a UUID to read another property. Mitigation: active scoped membership, RLS on every exposed table, explicit grants, indexed policy columns, server authorization and negative CI tests. `TO authenticated` alone is forbidden. Views are security-invoker/private; privileged functions are narrow and non-exposed.

Story: a revoked member reuses an unexpired JWT. Mitigation: sensitive policies/actions consult current membership status; authorization does not rely solely on stale token metadata; sensitive operations can validate session state.

### Booking concurrency

Story: two reception devices allocate the same bed at the same time. Mitigation: canonical inventory resources, database range exclusion or reviewed stable-order locks, short transactions and a race test that produces one winner. Availability UI is advisory.

Story: one actor books a whole room while another books a contained bed. Mitigation: conflict closure between room and bed resources participates in the same database protection.

### Money and business logic

Story: a client changes price, discount, refund or property/currency. Mitigation: server recomputation from canonical rates/taxes, typed approval limits, integer minor units, idempotency and immutable reversal records.

Story: an authorized accountant silently deletes evidence. Mitigation: least-privilege grants, no ordinary hard delete for posted business records, append-only audit and reason/approval workflow.

### Auth, sessions and redirects

Story: OAuth callback is abused for an open redirect or session fixation. Mitigation: PKCE, exact allow lists, relative `next` validation, server code exchange and state/nonce controls per current provider guidance.

Story: a cached authenticated response gives one user's cookie/session to another. Mitigation: no ISR/public caching where session refresh may occur; propagate private/no-store cache headers.

### Shared-device PIN

Story: stolen property phone/PIN attempts owner actions. Mitigation: PIN only operates inside a manager-established, property-bound, expiring device session with a hard permission ceiling; sensitive routes re-check actor mode. Slow hashing, rate limits, lockout and audit address brute force.

Management and operational staff use distinct credentials under one auditable actor model. Guest actors are stay/session scoped so they cannot become reusable cross-stay principals.

### Invitations and recovery

Story: a high-privilege WhatsApp invitation is forwarded and claimed by the wrong Google identity. Mitigation: claim remains pending until inviter/required approver confirms identity; token possession never activates owner/partner/manager membership alone.

Story: attacker socially engineers support to replace a sole owner. Mitigation: explicit recovery case, business-verification evidence references, independent approval, cooling period, notices, ownership/billing lock and revocation of prior user/device sessions.

### Tenant lifecycle, export and deletion

Story: billing enforcement strands an active guest or blocks owner export. Mitigation: billing `read_only` has explicit continuity exceptions for existing checkout/reconciliation, approved reversals and owner export.

Story: security suspension is mistaken for billing read-only and ordinary tenant access remains available. Mitigation: `suspended` blocks tenant management paths and permits only platform-controlled emergency/recovery procedures.

Story: an export/deletion request accidentally changes authorization or bypasses retention. Mitigation: export and deletion use separate state machines; export never changes access; active legal hold blocks deletion processing; every transition is approved/audited.

### QR and guest privacy

Story: token guessing or parameter modification reveals another guest in a shared room. Mitigation: high-entropy token hashes, rate limiting, public/private separation, short-lived stay sessions and stay/resource-bound policies that never return co-occupant data.

### Storage and uploads

Story: public client alters a path or abuses a signed URL to retrieve KYC. Mitigation: private buckets, row-backed ownership, server-authorized short-lived signed URLs, object-size/type scanning/limits and no raw path trust.

Story: malicious document/media attacks processors. Mitigation: treat MIME/filename as untrusted, isolate processing, set limits/timeouts, avoid active content and keep renderers patched.

### WhatsApp/webhooks

Story: attacker forges or replays a webhook to create duplicate requests/messages. Mitigation: raw-body signature verification, unique provider event identity/hash, fast acknowledgement, idempotent processing and bounded retry.

Story: incorrect number routing crosses tenant boundaries. Mitigation: one active routing owner, explicit connection→organization/property mapping and quarantine of ambiguous events.

Story: automation loops cause cost or guest spam. Mitigation: state machine, human-handover pause, message caps, category/policy checks, circuit breakers and dead-letter visibility.

### Platform/support and supply chain

Story: support user becomes a hidden omnipotent tenant reader. Mitigation: consent/time-bound elevation, narrow diagnostic views, break-glass approval and immutable audit.

Story: compromised dependency/CI leaks secrets. Mitigation: pinned dependencies/lockfile, least-privilege CI tokens, secret scanning, protected environments and dependency/security updates.

### Out-of-scope attacker stories

Breaking Google, Meta, Supabase or hosting provider cryptography is out of repository scope; insecure configuration or misuse of those providers is in scope. Physical coercion/fraud by hotel staff is not fully preventable, but least privilege, approval limits and auditability remain in scope. Native-app vulnerabilities are out of scope because MVP is a PWA.

## Severity Calibration (Critical, High, Medium, Low)

### Critical

- Unauthenticated or ordinary tenant access to broad cross-tenant KYC/financial data.
- Reliable service/secret key disclosure enabling unrestricted production access.
- Systemic booking protection failure allowing routine double allocation across properties.
- Broad unaudited mutation of posted financial history.

### High

- Cross-property IDOR exposing one or more guests/bookings.
- PIN/QR escalation into management/finance/export privileges.
- Forged/replayed payment or WhatsApp events with material duplicate effects.
- Public retrieval of private KYC/receipt media.
- Client-controlled refund/discount bypass with financial impact.

### Medium

- Same-tenant overreach without highly sensitive data, such as concierge user editing unrelated operational content.
- Rate-limit weakness enabling nuisance PIN/QR probing without demonstrated privilege escalation.
- Persistent stored content injection requiring an authenticated limited role and constrained impact.
- Missing audit detail that impairs investigation but does not itself alter data.

### Low

- Minor information disclosure without personal/tenant-sensitive data.
- Low-impact availability/usability issue with simple recovery and no integrity loss.
- Developer-only tooling weakness with no production credential/data path.
- Best-practice gap requiring significant unrealistic preconditions.

Repository: ye-sab-install-krlo-taaki-ek
Version: snapshot-BBCAAD00CF279495-B1B898C6E6FC3D1A
