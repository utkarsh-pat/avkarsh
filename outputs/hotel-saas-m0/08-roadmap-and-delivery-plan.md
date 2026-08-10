# Roadmap and Delivery Plan

## 1. Planning basis

The master specification estimates approximately 6–9 months for a focused team. This remains a directional range, not a commitment, until pilot workflows, team composition, payment/WhatsApp onboarding constraints and M0 open decisions are resolved.

## 2. Dependency-aware roadmap

| Stage | Indicative effort | Critical dependency | Exit proof |
|---|---:|---|---|
| M0 Architecture | Current | Owner/pilot decisions | Approved decision pack |
| M1 Identity/tenancy | 3–5 weeks | Google project, Supabase local baseline | Cross-tenant RLS matrix |
| M2 Inventory/bookings | 5–8 weeks | Approved collision model | Concurrent allocation proof |
| M3 Stay/finance | 5–8 weeks | Tax/invoice/payment decisions | Mobile stay lifecycle + tamper tests |
| M4 QR operations | 3–5 weeks | QR privacy and offline decisions | Isolation + staff usability |
| M5 WhatsApp | 4–7 weeks + approval | Meta business/number readiness | Sandbox/pilot E2E + replay proof |
| M6 Concierge | 3–4 weeks | Content ownership/commission process | Staff-managed content workflow |
| M7 Billing/production | 4–6 weeks | Pricing/legal/hosting | Signed production checklist |

Meta approval work can start in parallel after architecture approval, but its timing cannot be promised.

## 3. First 30 implementation days after approval

### Week 1 — foundation

Repository, pinned toolchain, Next.js/Supabase local environment, copied ADRs, CI skeleton, environment contracts, logging/correlation baseline and deterministic seeds.

### Week 2 — tenancy database

Actors, management profiles, operational staff, organizations, properties, memberships, roles/permissions schema, tenant lifecycle, explicit grants, RLS helpers and database test harness.

### Week 3 — Google identity and navigation

Google OAuth PKCE/SSR, callback/error handling, organization/property selector, membership suspension/revocation behavior and basic mobile shell.

### Week 4 — invitations/shared device and M1 hardening

High-privilege invitation approval, recovery cases, manager-established device session, staff PIN restrictions/revocation, command receipts, transaction-bound audit, outbox, required-width/locale E2E and security review.

### Parallel commercial track from M1

Start Meta Business portfolio/verification, WABA/test number, real-number strategy, app review/permissions, template approval, webhook domain, direct Cloud API vs BSP and multi-customer Embedded Signup eligibility. M5 coding remains later, but external approval risk begins immediately.

## 4. Milestone workflow

1. Written outcome and acceptance mapping.
2. Small design/data/security review.
3. Migration/domain contract first.
4. Thin UI vertical slice.
5. Unit/database/integration/E2E evidence.
6. Security diff review and mobile verification.
7. Milestone report in the required format.
8. Owner approval before widening scope.

## 5. Reporting template

```text
Outcome
Implemented
Database migrations
Authorization/RLS
Tests run and results
Mobile verification
Security findings
Known limitations
Next milestone
```

## 6. Change management

Any request that adds OTA, SMS/email, AI bot, microservices, automated vendor settlement or another excluded feature is placed in a post-MVP backlog and requires impact analysis. “Small UI change” requests that alter money, authorization, booking or guest privacy are treated as architecture changes.
