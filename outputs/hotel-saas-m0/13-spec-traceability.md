# Master Specification Traceability

| Master-spec area | M0 authority | Implementation milestone |
|---|---|---|
| Product priorities/non-negotiables | `00-master-plan.md` | All |
| Organization/multi-property model | ADR-001, `03-data-model.md` | M1 |
| Multiple roles/limits | ADR-002, `04-permissions-matrix.md` | M1 |
| Actor identity and shared-device staff | ADR-009, `03-data-model.md` | M1 |
| Multilingual UI/content | ADR-010, mobile IA, screen blueprints | M1–M7 |
| Owner onboarding/invitations | `05-mobile-information-architecture.md` | M1 |
| Secure invitations/account recovery | ADR-012, audit catalogue | M1 |
| Tenant lifecycle/read-only continuity | ADR-011, permissions matrix | M1/M7 |
| Room/bed availability | ADR-003, `03-data-model.md` | M2 |
| Reservations/rates | `03-data-model.md`, `12-core-screen-blueprints.md` | M2 |
| Guests/KYC/stays | `02-system-architecture.md`, threat model | M3 |
| Payments/invoices/expenses/cash | ADR-008, permission matrix | M3 |
| Guest QR/security | mobile IA, threat model | M4 |
| Housekeeping/maintenance/offline | ADR-006, mobile IA | M4 |
| WhatsApp bot/inbox/webhooks | ADR-005, system architecture | M5 |
| Concierge/services/commissions | data model, permission matrix | M6 |
| SaaS billing/platform admin | data model, permission matrix | M7 |
| Mobile targets/design rules | mobile IA, screen blueprints | M1–M7 |
| Supabase/RLS/storage | data model, threat model, source verification | M1–M7 |
| Testing/adversarial cases | `07-test-and-acceptance-plan.md` | All |
| Permission precedence | `14-permission-truth-table.md` | M1 |
| Command idempotency/audit/outbox | ADR-013, `15-audit-event-catalogue.md` | M1 foundation |
| Business date/night audit | ADR-014 | M2/M3 |
| Observability/backup/operations | system architecture, roadmap | M1–M7 |
| Operational SLOs/performance budgets | `16-operational-slos.md` | M2/M4/M5/M7 validation |
| Repository structure | `06-repository-plan.md` | M1 foundation |
| Production checklist | acceptance plan, risk register | M7 |

## Coverage disposition

- **Covered in M0:** architecture, actor/data/lifecycle models, permissions and executable truth table, multilingual model, functional IA/blueprints, audit/idempotency/outbox contracts, threat model, repository/CI plan, risks and milestone acceptance.
- **Intentionally deferred:** selected visual design, executable migrations, package scaffold, live integrations, provider accounts, pricing, legal/tax/retention decisions and production runbook details that require an implemented system.
- **Not silently omitted:** every deferred item is linked to an open decision or milestone gate.

## M0 audit result

The documentation covers the requested M0 artifacts and all master-spec product domains at planning level, including the lifecycle separation, SLO registration and architecture amendments. It does not claim implementation evidence. Current status is **M0 Approved**: O-01–O-05 and O-20–O-24 are accepted, the 30-case permission contract is approved and traceability has been rerun. O-06 onward remains milestone-gated; O-25 is required before M2/M3. M1 must copy approved documents into the repository and update them to reflect actual code/migrations rather than allowing planning documents to drift.
