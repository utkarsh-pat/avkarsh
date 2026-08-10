# ADR-005: WhatsApp Provider Abstraction and Async Processing

Status: Proposed  
Date: 2026-08-10

## Context

Meta WhatsApp Cloud API is core communication, but versions, approvals, pricing and availability evolve. Messaging must not block hotel operations.

## Decision

Define a provider adapter for number connection, webhook verification, templates/session messages, media, read status and event parsing. Verify signatures on raw requests, deduplicate provider events, acknowledge quickly and process asynchronously. Outbound sends use an outbox, idempotency, caps, bounded retries and dead letters.

## Consequences

Additional operational components are required, but the PMS remains available during Meta outage and provider details do not leak through domain code.

## Rejected alternatives

- Direct Meta calls throughout UI/domain modules: brittle and untestable.
- Synchronous send inside booking/finance transactions: lock/availability coupling.
- Unlimited retry: cost/spam loop risk.

## Acceptance

Forged/replayed events have no effect; routing is tenant-safe; duplicates do not duplicate messages/requests; bot pauses during human ownership; outage queues/communicates status without blocking PMS.

