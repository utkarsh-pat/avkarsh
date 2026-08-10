# Canonical Audit Event Catalogue

Status: M1 foundation contract. Critical events are written in the same transaction as the business mutation.

## Required envelope

```text
event_id
event_name
event_version
occurred_at
actor_id / scoped_guest_actor_id
actor_type
authentication_mode
organization_id
property_id
target_type
target_id
reason_code / reason_text where required
request_id
correlation_id
safe_before_summary
safe_after_summary
source_ip/device metadata under retention policy
```

Safe summaries contain only approved fields necessary to investigate the change. Never record KYC images/data, access or refresh tokens, PIN hashes, full WhatsApp payloads, card/payment secrets, provider app secrets or signed URLs.

## Identity, membership and recovery

| Event | Required safe detail |
|---|---|
| `identity.google_linked` | profile/actor ID, provider identity reference hash |
| `membership.invited` | inviter, intended role/scope, expiry |
| `membership.claimed` | claimed management actor, pending approval state |
| `membership.approved` | approver and final scope |
| `membership.suspended` | reason and effective time |
| `membership.revoked` | reason and revoked sessions count |
| `permission.changed` | permission keys/scope and safe before/after |
| `device_session.created` | property, establishing manager, expiry |
| `device_session.revoked` | revoker, reason, affected device |
| `staff_pin.locked` | staff actor, attempts/lock expiry; never PIN data |
| `recovery_case.opened` | case type, claimant and safe evidence references |
| `recovery_case.approved` | independent approver, cooling period |
| `recovery_case.completed` | ownership change and revoked session count |

## Reservations and stays

`reservation.created`, `reservation.hold_expired`, `reservation.allocation_changed`, `reservation.cancelled`, `stay.checked_in`, `stay.resource_shifted`, `stay.checked_out` and `guest_portal_session.revoked`.

Allocation events record resource IDs, stay dates and reason but no unnecessary guest PII. Collision failures are operational/security telemetry; repeated suspicious attempts may also generate an audit/security event.

## Finance

`folio_item.posted`, `folio_item.reversed`, `payment.recorded`, `payment.reversed`, `refund.recorded`, `discount.approved`, `expense.submitted`, `expense.approved`, `cash_shift.opened`, `cash_shift.closed`, `cash_shift.reopened` and `invoice.issued`.

Financial events record integer minor units, currency, source/result IDs, approval limit used and reason. They never record full provider payloads or payment secrets.

## QR, operations and WhatsApp

`qr_token.rotated`, `guest_request.created`, `guest_request.status_changed`, `housekeeping.started`, `housekeeping.completed`, `maintenance.room_blocked`, `whatsapp.connection_changed`, `whatsapp.webhook_replay_rejected`, `whatsapp.handover_started`, `whatsapp.template_sent` and `whatsapp.usage_cap_hit`.

## Platform and lifecycle

`tenant.access_state_changed`, `tenant.read_only_exception_used`, `tenant.security_suspended`, `tenant.security_restored`, `export.requested`, `export.ready`, `export.downloaded`, `export.failed`, `deletion.requested`, `deletion.cooling_started`, `deletion.approved`, `deletion.blocked_by_legal_hold`, `deletion.completed`, `legal_hold.applied`, `legal_hold.released`, `support_access.granted`, `support_access.started` and `support_access.expired`.

Support-access events include consenting owner, approved scope, expiry and case reference. Break-glass access is separately named and reviewed.

Tenant access, export, deletion and legal-hold transitions are distinct event families. No export/deletion event implies or mutates access permissions without a separate `tenant.access_state_changed` event in the responsible transaction.

## Transaction and delivery rules

- Critical audit insert failure aborts the business transaction.
- Audit rows are append-only; corrections create a correcting audit event.
- Outbox failure does not roll back an already committed business transaction/audit.
- `command_receipts` and audit events share request/correlation identifiers without duplicating secret payloads.
- Access to audit data is itself permission-controlled and sensitive audit reads/exports are audited.
