# ADR-002: Multiple-Role Scoped Authorization

Status: Accepted  
Date: 2026-08-10

## Context

A person may simultaneously be owner, manager or accountant at different scopes. Financial actions also require limits and stronger authentication.

## Decision

Model reusable permission keys, role bundles and many-to-many membership role assignments at organization/property scope. Evaluate the authentication ceiling first, then active tenant/membership and applicable scope. Collect role/override permissions; any applicable explicit deny permanently wins and cannot be overridden by explicit allow. Apply the minimum applicable typed financial limit, then subscription/lifecycle entitlement. Actor mode (Google session, shared-device PIN, guest) can only reduce permissions.

## Consequences

Permission evaluation is more complex than a single role column but accurately represents the product. The resolver must be deterministic, testable and used consistently by server code and RLS helpers.

## Rejected alternatives

- One role on `users`: cannot represent multiple organizations/roles.
- Authorization in editable JWT user metadata: stale and user-controlled.
- UI-only route hiding: not authorization.

## Acceptance

All cases in `14-permission-truth-table.md` pass at service and database/RLS levels, including role union, permanent deny, property scope, minimum approval limit, revoked membership, lifecycle entitlement and shared-device ceiling.
