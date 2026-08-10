# Owner and Pilot-Hotel Decisions Required

These are the only material blockers before irreversible architecture or workflow implementation. Recommended defaults allow planning to continue, but explicit approval is required before the affected milestone.

## Formal M1 approval record

Approved on 10 August 2026 from the supplied final architecture review:

- O-01 through O-05.
- O-20 through O-24.

These defaults are binding for M1 unless superseded by a new approved ADR. O-06 onward may be approved before its dependent milestone; O-25 is mandatory before M2/M3.

| ID | Decision | Recommended default | Needed by |
|---|---|---|---|
| O-01 | Pilot property type and size | One mixed hotel/hostel capable of room + bed validation | Before M1 UX detail |
| O-02 | Organization/property ownership semantics | Organization owns subscription/data; property is operating unit | Before M1 schema |
| O-03 | Explicit deny semantics | Any applicable deny permanently overrides all role/override allows; mode ceiling is absolute | Before M1 |
| O-04 | Shared-device eligible roles | Reception, housekeeping, maintenance only | Before M1 PIN work |
| O-05 | Re-auth thresholds | Ownership/export/billing always; finance above configured limits | Before M1/M3 |
| O-06 | Inventory sale rule | A room may be sold whole or by beds, never overlapping | Before M2 |
| O-07 | Hold behavior | Holds allocate inventory and expire automatically | Before M2 |
| O-08 | India tax/invoice rules | Configurable baseline; legal/accounting review before M3 | Before M3 |
| O-09 | KYC retention/deletion | Configurable, private, documented; no indefinite default | Before M3 |
| O-10 | Checkout/dirty transition | All vacated units become dirty automatically | Before M3 |
| O-11 | Guest stay verification | Stay PIN plus booking context/rate limit | Before M4 |
| O-12 | QR rotation | Per room/bed stable public token with revocation/rotation; stay secrets separate | Before M4 |
| O-13 | Offline conflict policy | Last writer never silently wins; user resolves conflict | Before M4 |
| O-14 | WhatsApp number topology | One number/property recommended; org-level routing supported later | Before M5 |
| O-15 | WhatsApp Tech Provider/BSP path | Direct Cloud API first for pilot unless onboarding scale requires BSP | Before M5 |
| O-16 | Commission recognition | Manual expected/received states; no automated settlement | Before M6 |
| O-17 | Plans/entitlements | Property/room/user caps + add-ons, no unlimited WhatsApp | Before M7 |
| O-18 | Production region/data residency | Select after provider availability, latency and legal review | Before staging |
| O-19 | Brand and visual direction | Separate three-option mobile design selection | Before UI build |
| O-20 | Customer languages | Launch: Hindi, English, French, Spanish, German, Russian; optional packs: Japanese, Thai, Sinhala, Korean; static approved translations only | Before M1 localization schema |
| O-21 | Staff identity model | Google-auth management profiles; property-local staff members + staff PIN credential + authorized device session | Before M1 schema |
| O-22 | Management invite security | Owner/partner/manager activation requires Google claim plus inviter approval; operational staff use supervised enrollment | Before M1 invites |
| O-23 | Tenant lifecycle/read-only policy | Approve documented lifecycle and continuity exception matrix | Before M1 schema |
| O-24 | Sole-owner recovery | Case-based business verification, independent approval, cooling period, notices and session/device revoke | Before M1 recovery |
| O-25 | Property business date/night audit | Separate operational business date from timestamps/calendar date | Before M2/M3 |

## Approval format

For each row record: `Approved default`, `Approved alternative`, or `Deferred`, with owner, date and notes. A deferred item must have a latest decision date and may block its dependent milestone.
