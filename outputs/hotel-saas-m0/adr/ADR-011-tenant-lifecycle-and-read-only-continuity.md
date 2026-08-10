# ADR-011: Tenant Lifecycle and Read-Only Continuity

Status: Accepted  
Date: 2026-08-10

## Decision

Tenant access lifecycle: `trial`, `active`, `past_due`, `grace`, `read_only`, `suspended`, `closed`, with the explicit transition matrix in `03-data-model.md`.

In `read_only`: existing checkout, existing folio reconciliation, approved refund/reversal, owner export and emergency/public QR remain available; new booking is blocked; new check-in requires explicit grace configuration; configuration/member changes are blocked.

`suspended` is a security/policy state, not billing read-only. Ordinary tenant management access is blocked; platform-controlled emergency/recovery rules apply. Restoration requires platform approval and revalidation of the recorded previous safe state.

Export request (`requested`, `processing`, `ready`, `downloaded`, `expired`, `failed`), deletion request (`requested`, `cooling_period`, `approved`, `blocked_by_legal_hold`, `processing`, `completed`, `cancelled`) and legal hold (`inactive`, `active`, `released`) are separate workflows. Export never changes access; active legal hold blocks deletion processing.

## Rationale

Commercial enforcement must not strand current guests, prevent financial correction or hold tenant data hostage. Lifecycle entitlement may restrict authorization but exposes only documented continuity/recovery exceptions.

## Acceptance

Every access/workflow transition and exception is server/RLS tested. Owners retain export access. Security suspension, lifecycle transition, deletion/legal-hold and exception use are independently audited.
