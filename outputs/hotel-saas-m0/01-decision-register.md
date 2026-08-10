# Architecture Decision Register

| ID | Decision | Status | Rationale | Main consequence |
|---|---|---|---|---|
| ADR-001 | Shared multi-tenant Supabase database per environment | Accepted | Lowest operational complexity while RLS and tenant keys provide isolation | RLS tests become release-blocking |
| ADR-002 | Scoped memberships, additive roles, explicit deny and limits | Accepted | Supports one person in multiple organizations/properties and multiple roles | Authorization resolver must be deterministic and audited |
| ADR-003 | Canonical inventory resources with database overlap exclusion | Proposed for approval | A room and bed need one collision model that works under concurrency | Allocation is transaction-only; frontend availability is advisory |
| ADR-004 | Google management auth plus subordinate shared-device PIN | Accepted | Meets low-friction staff needs without elevating PIN identity | Sensitive actions require full user session/re-auth |
| ADR-005 | Provider-adapted asynchronous WhatsApp boundary | Proposed for approval | Meta failures and API evolution must not block PMS | Outbox/inbox, idempotency and dead-letter operations are required |
| ADR-006 | Risk-tiered offline policy | Proposed for approval | Low connectivity matters, but booking and money conflicts are unsafe offline | Only drafts/checklists/notes queue locally |
| ADR-007 | Next.js modular monolith with server-first boundaries | Accepted | Keeps one deployable unit while preserving domain ownership | External integrations use Route Handlers; internal writes use services/actions |
| ADR-008 | Immutable financial ledger semantics | Proposed for approval | Auditable corrections and tamper resistance | Posted records reverse; they are not edited/deleted silently |
| ADR-009 | Unified actors with scoped operational/guest identity | Accepted | Management and local staff require separate credentials but one audit vocabulary | Guest actors remain stay/session scoped, not permanent principals |
| ADR-010 | Static UI catalogs plus typed content translations | Accepted | Multilingual launch without polymorphic translation/RLS ambiguity | Locale coverage and English fallback become release gates |
| ADR-011 | Tenant lifecycle and safe read-only operations | Accepted | Billing state must not strand active guests | New sales can stop while checkout/reconciliation/export remain safe |
| ADR-012 | Secure invitations and identity recovery cases | Accepted | Forwarded links and sole-owner recovery are high-risk elevation paths | High-privilege activation requires approval/re-auth/cooling controls |
| ADR-013 | Command receipts, transaction-bound audit and outbox | Accepted | Retries must be safe without making audit depend on workers | M1 includes generic receipts/audit/outbox foundation |
| ADR-014 | Property business date and night audit | Proposed before M2/M3 | Hotel operations cross midnight and property timezones | Calendar instant and operational business date remain distinct |

## Decision hierarchy

1. Master specification and approved business constraints.
2. Accepted ADRs.
3. Data model and permission matrix.
4. Milestone implementation details.

Any conflict must be recorded rather than silently resolved. A material change requires a new ADR that supersedes the earlier decision and includes migration/rollback impact.

## Decisions intentionally deferred

- Exact payment gateway.
- Exact job/queue provider beyond a provider-neutral contract.
- Vercel vs portable container production topology after load/cost evidence.
- Retention periods for KYC and operational media pending legal review.
- Subscription prices and WhatsApp pass-through pricing pending commercial validation.
- Visual design direction pending a separate product-design selection pass.
