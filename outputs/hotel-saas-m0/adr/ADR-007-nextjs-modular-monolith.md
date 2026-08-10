# ADR-007: Next.js Modular Monolith and Server-First Boundaries

Status: Accepted  
Date: 2026-08-10

## Context

The product has many domains but an early team should not operate distributed services. Next.js App Router supports server-first UI and external HTTP handlers in one deployable unit.

## Decision

Use a pnpm workspace with one Next.js web app plus domain/UI/validation/config packages. Server Components perform reads; Server Actions accept first-party mutations; Route Handlers serve webhooks/external APIs. Client Components are interaction islands. Node.js is the default runtime.

## Consequences

Domain ownership must be enforced by conventions/tests rather than network boundaries. This keeps deployment and transactions simple. Service extraction requires evidence and a new ADR.

## Rejected alternatives

- Microservices: operational and transaction complexity without current need.
- Client-heavy SPA: larger bundles and weaker secret/data boundaries.
- Route Handler layer for every internal read: unnecessary round trips/contract duplication.

## Acceptance

No async Client Components, no server secrets in client bundles, no UI-only business invariant, and no external calls inside critical DB transactions.
