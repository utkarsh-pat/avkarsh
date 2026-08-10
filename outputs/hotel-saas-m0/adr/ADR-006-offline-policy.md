# ADR-006: Risk-Tiered Offline Policy

Status: Proposed  
Date: 2026-08-10

## Context

Properties may have unreliable connectivity, but offline booking, finance and permissions create unsafe conflicts.

## Decision

Allow offline queueing only for housekeeping checklist progress, maintenance media drafts and non-financial notes. Never finalize booking/allocation, check-in/out, payment/refund, approval or membership/permission changes offline. Queue entries have local UUID, property, staff identity, timestamp, retry state and idempotency key.

## Consequences

Users see clear pending-sync state and may need explicit conflict resolution. The app does not pretend that a local draft is hotel-confirmed.

## Rejected alternatives

- Full offline-first PMS: conflict/financial risk and excessive MVP complexity.
- No offline support: harms the core housekeeping workflow.
- Silent last-writer-wins: loses accountable work.

## Acceptance

Safe drafts survive restart and sync idempotently; conflicts are visible; high-risk actions are disabled with a clear connectivity explanation.

