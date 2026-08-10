# Hotel SaaS — Phase M0 Documentation Pack

Status: **M0 Approved — M1 may begin as the documented identity-and-tenancy vertical slice; application implementation has not yet started**  
Prepared: 10 August 2026  
Authority: `HOTEL_SAAS_MASTER_SPEC-1.md` overrides this pack if a conflict is discovered.

## Executive position

Build a mobile-first, multi-tenant hotel operating system as a **modular monolith** on Next.js and Supabase. The MVP must make tenant isolation, inventory collision prevention, money correctness and shared-device safety database-enforced concerns—not UI conventions.

No production code, cloud project, paid service, OAuth client or Meta asset has been created in M0. Architecture approval is complete; the next authorized step is the narrow M1 identity-and-tenancy vertical slice.

## Document map

| Document | Purpose |
|---|---|
| [00-master-plan.md](00-master-plan.md) | Product/engineering charter, governance, stages and gates |
| [01-decision-register.md](01-decision-register.md) | Consolidated architecture decisions and approval status |
| [02-system-architecture.md](02-system-architecture.md) | Runtime architecture, module boundaries and data flows |
| [03-data-model.md](03-data-model.md) | Schema proposal, ERD, invariants, indexes and lifecycle rules |
| [04-permissions-matrix.md](04-permissions-matrix.md) | Roles, scopes, permission semantics and financial controls |
| [05-mobile-information-architecture.md](05-mobile-information-architecture.md) | Navigation, persona journeys, screen inventory and UX states |
| [06-repository-plan.md](06-repository-plan.md) | Planned repository structure, environments, CI and conventions |
| [07-test-and-acceptance-plan.md](07-test-and-acceptance-plan.md) | Milestone acceptance map and adversarial tests |
| [08-roadmap-and-delivery-plan.md](08-roadmap-and-delivery-plan.md) | Work breakdown, dependencies, stage gates and reporting |
| [09-risk-register.md](09-risk-register.md) | Delivery, product, security and external-dependency risks |
| [10-open-decisions.md](10-open-decisions.md) | Decisions requiring owner/pilot-hotel approval |
| [11-source-verification.md](11-source-verification.md) | Current official-documentation review and recheck policy |
| [12-core-screen-blueprints.md](12-core-screen-blueprints.md) | Functional low-fidelity screen anatomy before visual design |
| [13-spec-traceability.md](13-spec-traceability.md) | Master-spec coverage and implementation ownership map |
| [14-permission-truth-table.md](14-permission-truth-table.md) | Executable authorization precedence and required test cases |
| [15-audit-event-catalogue.md](15-audit-event-catalogue.md) | Canonical audit contract and safe event payloads |
| [16-operational-slos.md](16-operational-slos.md) | Provisional production reliability/performance objectives and ownership |
| [security/threat-model.md](security/threat-model.md) | Repository-scoped threat model and severity calibration |
| [adr/](adr/) | Detailed architecture decision records |

## M1 authorization

Architecture amendments are incorporated. O-01–O-05 and O-20–O-24 are formally approved for M1. The following approved decisions govern implementation:

1. One Supabase project per environment, with shared multi-tenant tables protected by RLS.
2. Organization and property membership scopes with additive roles, explicit deny overrides and approval limits.
3. Database-enforced room/bed overlap prevention using a canonical inventory-resource allocation model.
4. Google OAuth for management users; shared-device PIN is subordinate identification, never independent privileged authentication.
5. WhatsApp is asynchronous and provider-adapted; the core PMS must operate during Meta outage.
6. Management users and local operational staff use distinct identity records under one auditable actor abstraction; guest actors remain short-lived and stay-scoped.
7. Applicable explicit deny always wins and cannot be overridden by explicit allow; authentication mode is the upper permission ceiling.
8. Multilingual UI/content uses static application catalogs plus typed translation tables and deterministic English fallback.
9. Tenant lifecycle/read-only behavior, high-privilege invitation approval and sole-owner recovery are fixed before M1 schema work.

## M0 approval record

- Architecture, data and permission models are documented and architecture amendments are incorporated.
- Mobile IA covers owner, manager, reception, housekeeping and guest QR flows.
- Threat model identifies assets, boundaries, attacker inputs and severity.
- Every milestone has measurable exit criteria and adversarial tests.
- Open commercial/legal/pilot decisions are isolated and do not masquerade as technical facts.
- No irreversible implementation has occurred.

Current disposition: **M0 Approved**. O-06 onward remains milestone-gated; O-25 is required before M2/M3. The permission truth table and updated traceability check are part of the approved M1 contract.
