# ADR-008: Financial Ledger and Audit Semantics

Status: Proposed  
Date: 2026-08-10

## Context

Hotels require corrections, refunds, discounts, expenses and cash adjustments without destroying financial history.

## Decision

Store amounts as integer minor units and currency codes. Recompute totals server-side. Posted folio/payment/refund/expense/cash records are immutable in economic meaning; corrections reference and reverse/adjust prior entries. Sensitive changes require reason, actor, scope, correlation and audit event. Provider callbacks are idempotent.

## Consequences

Reports must understand reversals rather than simply reading the latest editable total. History is more trustworthy and incidents are investigable.

## Rejected alternatives

- Floating point money: precision risk.
- Editing/deleting posted rows: destroys traceability.
- Trusting client totals: tampering risk.

## Acceptance

Tampered totals fail; duplicate callbacks do not duplicate money; every reversal balances and references its source; unauthorized/higher-than-limit actions fail server-side.

