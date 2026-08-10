# Operational SLOs and Performance Budgets

Status: registered production deliverable. Values below are provisional engineering targets; M7 approves final numbers using load tests, pilot traffic, provider limits and commercial support commitments.

## Service objectives

| Surface | Provisional target | Measurement | Owner | Approval gate |
|---|---|---|---|---|
| Booking mutation availability | 99.9% monthly excluding approved maintenance | Successful eligible commands / total eligible commands | Application/DB lead | Pilot/M7 |
| Booking mutation p95 | ≤ 800 ms server time excluding external messaging | Server trace from validated command to DB commit | Application/DB lead | M2 load test |
| QR help-page availability | 99.9% monthly | Synthetic public check by region | Web/operations | M4/M7 |
| QR public-page p95 | ≤ 1.5 s server response under expected pilot load | Synthetic and real-user telemetry | Web lead | M4 |
| WhatsApp webhook acknowledgement p95 | ≤ 2 s | Provider ingress to 2xx response | Integration lead | M5 |
| WhatsApp processing lag p95 | ≤ 30 s under normal load | Persisted receipt to processed state | Integration lead | M5 |
| Maximum actionable dead-letter age | ≤ 4 business hours; urgent security/payment classes ≤ 30 min | Oldest unowned actionable dead letter | Integration/operations | M5/M7 |
| Production backup RPO | ≤ 15 min for database; object-storage policy documented separately | Recovery evidence | Operations/DB lead | M7 |
| Production restore RTO | ≤ 4 hours for critical PMS service | Timed restoration exercise | Operations | M7 |
| Restore drill frequency | Quarterly and before first production launch | Signed drill report | Operations/security | M7 |

## Low-end Android performance budget

Test on the agreed pilot low-cost Android hardware and constrained mobile network, not desktop emulation alone.

| Metric | Provisional target |
|---|---|
| LCP | ≤ 2.5 s at p75 for primary operational routes |
| INP | ≤ 200 ms at p75 |
| CLS | ≤ 0.1 at p75 |
| Initial route JavaScript | ≤ 200 KB gzip unless an approved exception proves better task performance |
| Interaction readiness | Primary action usable without waiting for non-critical analytics/integration code |
| Offline shell | Clear cached-shell/pending-sync state; never represent draft as server-confirmed |

## Reliability ownership and evidence

- Every SLO has a dashboard/query, alert threshold, named operational owner and runbook response before production.
- Error-budget policy determines whether feature work pauses for reliability remediation.
- Provider outage is measured separately from internal processing, but user-visible availability remains reported honestly.
- SLOs never weaken booking collision, tenant isolation, money integrity or audit guarantees to meet latency.
- Final M7 approval records tested load profile, dataset size, concurrency, device/network profile and accepted exceptions.

