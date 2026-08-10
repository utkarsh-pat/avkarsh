# ADR-013: Command Receipts, Transaction-Bound Audit and Outbox

Status: Accepted  
Date: 2026-08-10

## Decision

Use scoped `command_receipts` with operation, idempotency key, canonical request hash, status, safe result/response and expiry. Same key/hash returns the original result; same key/different hash returns conflict.

Critical audit events commit in the same transaction as the business mutation and use approved safe summaries. External notifications and retryable integration work use `outbox_events`; audit never depends on an outbox worker.

Workers lease ready rows using a short transaction and `FOR UPDATE SKIP LOCKED`, recording lease owner and expiry. Processing occurs outside the lease-acquisition transaction. A crashed worker's expired lease is recoverable. Retries use bounded exponential backoff with jitter and a configured maximum attempt count; exhausted/poison events transition to dead letter with a safe reason. Event type and schema version are immutable routing fields, and consumers explicitly reject/quarantine unsupported versions.

## Acceptance

Concurrent/retried commands are safe, changed-payload reuse conflicts, mutation rolls back if required audit insert fails, and outbox failure leaves the committed mutation/audit intact and observable. Tests cover worker competition, lease expiry, crash recovery, backoff, maximum attempts, poison events, dead-letter transition and schema-version handling.
