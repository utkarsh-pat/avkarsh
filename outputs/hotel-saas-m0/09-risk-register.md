# Risk Register

Scale: probability and impact are Low/Medium/High. Owners are roles until named people are assigned.

| ID | Risk | P | I | Mitigation / trigger | Owner |
|---|---|---:|---:|---|---|
| R-01 | Cross-tenant data exposure through incomplete RLS/grants | M | H | Explicit grants, RLS on exposed tables, negative matrix in CI | Security/DB lead |
| R-02 | Room/bed double booking under concurrency | M | H | DB exclusion/locked transaction, stable lock order, race tests | DB lead |
| R-03 | Shared-device PIN privilege escalation | M | H | Manager-established session, hard permission ceiling, rate limits | Security lead |
| R-04 | Financial tampering or history mutation | M | H | Server totals, integer minor units, idempotency, reversal ledger | Tech lead |
| R-05 | Auth session response cached across users | L | H | Dynamic authenticated routes; apply no-store headers on refresh | Web lead |
| R-06 | Meta approval/API/policy delay | H | M | Start external readiness early; provider adapter; PMS independence | Product owner |
| R-07 | WhatsApp retry loop/cost overrun | M | M | Usage caps, idempotency, bounded retries, alerts/dead letters | Integration lead |
| R-08 | KYC/privacy non-compliance or excessive retention | M | H | Legal review, private storage, retention/delete workflows | Product/legal |
| R-09 | Low-end Android performance/usability failure | M | H | 320 px and device testing, server-first rendering, small bundles | Design/web lead |
| R-10 | Offline queue causes duplicated/unsafe mutation | M | H | Queue only low-risk drafts; idempotency; no offline booking/finance | Tech lead |
| R-11 | Supabase/Next breaking change | M | M | Pin dependencies, changelog review, upgrade PRs, lockfile | Tech lead |
| R-12 | Tenant-support access becomes hidden super-admin bypass | L | H | Consent, time-bound grants, audit and break-glass review | Platform owner |
| R-13 | Scope growth prevents vertical-slice completion | H | M | Locked exclusions and milestone gates | Product owner |
| R-14 | Free-tier assumptions fail commercial pilot | M | M | Cost model, spend alerts, commercial plan before paid workload | Product owner |
| R-15 | Backups exist but cannot restore | M | H | Scheduled restore drills before production | Operations |
| R-16 | Multilingual/localization introduced too late | M | H | Versioned UI catalogs, typed translation tables, fallback and layout tests from M1 | Design/web lead |
| R-17 | Actor model conflates Google users, local staff and guests | M | H | Unified auditable actor with distinct credentials and scoped guest actors | Security/DB lead |
| R-18 | Applicable deny is accidentally overridden | M | H | Fixed evaluation order and executable truth-table at service/RLS levels | Security lead |
| R-19 | Read-only subscription state strands active guests | M | H | Explicit lifecycle exception matrix for checkout/reconciliation/export | Product/tech lead |
| R-20 | Forwarded invite or recovery case hijacks ownership | M | H | Inviter approval, business verification, cooling, notices and session revoke | Security/product |
| R-21 | Audit depends on async worker and is lost | L | H | Critical audit committed with business transaction; outbox only for external work | Tech lead |
| R-22 | Idempotency key reused with changed payload | M | H | Canonical request hash conflict and scoped command receipts | Tech lead |

## Risk acceptance rule

High-impact risks cannot be silently accepted as “known limitations.” They require named owner, mitigation evidence, expiry/review date and product/technical approval. Tenant isolation, booking collision and financial integrity risks are never acceptable for production.
