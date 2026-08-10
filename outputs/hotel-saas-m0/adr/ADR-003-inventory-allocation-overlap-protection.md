# ADR-003: Inventory Allocation and Overlap Protection

Status: Proposed  
Date: 2026-08-10

## Context

The product sells whole rooms and individual beds. Concurrent requests must not overlap either the same unit or a room with one of its beds.

## Decision

Represent every allocatable room/bed as an inventory resource and maintain room↔bed conflict relationships. Use half-open stay-date ranges. Enforce active allocation overlap inside PostgreSQL with an exclusion-compatible conflict-slot design when feasible; otherwise use one reviewed transaction that locks every conflicting resource in stable UUID order, rechecks and inserts atomically.

## Consequences

Availability reads remain fast/advisory; writes may return a typed conflict and require UI recovery. Locks are short and external calls occur after commit through an outbox.

## Rejected alternatives

- Room status as availability: stale and incapable of date-range/group allocation.
- Frontend “check then insert”: race-prone.
- Separate unrelated room/bed checks: misses cross-kind collision.

## Acceptance

Parallel attempts produce exactly one winner for same bed, same room and room-versus-contained-bed. Cancellation/hold-expiry changes availability transactionally and safely.

