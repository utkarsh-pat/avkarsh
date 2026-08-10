# ADR-001: Multi-Tenant Organization and Property Model

Status: Accepted  
Date: 2026-08-10

## Context

One user may belong to unrelated organizations; an organization contains multiple properties; access and billing have different scopes. Operational cost and team size favor a single database per environment.

## Decision

Use shared tenant tables in one Supabase project per environment. `organization_id` is the tenant root and `property_id` scopes operating records. Membership tables—not user records/JWT-editable metadata—grant access. Every exposed tenant table has explicit API grants and RLS; application filters are defense in depth.

## Consequences

Positive: simple operations, cross-property reporting and centralized migrations. Negative: an RLS defect can have wide impact, so negative cross-tenant tests are release-blocking. Enterprise database-per-tenant isolation is deferred until commercial evidence justifies it.

## Rejected alternatives

- Database/project per property: excessive cost and reporting/migration complexity for MVP.
- Frontend/server filtering only: fails under missed filters/direct API use.
- Single `tenant_id` without organization/property distinction: cannot express group vs property scope.

## Acceptance

An authenticated user in Org A cannot discover/read/write Org B through UI, server action, Data API, Realtime, Storage or functions. One user can switch between authorized unrelated organizations without merged permissions.
