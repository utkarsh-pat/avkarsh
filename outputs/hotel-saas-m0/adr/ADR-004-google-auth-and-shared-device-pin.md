# ADR-004: Google Authentication and Shared-Device PIN

Status: Accepted  
Date: 2026-08-10

## Context

Management users require accountable Google identity. Reception/housekeeping may share low-cost property devices and need rapid selection without creating owner-level PIN sessions.

## Decision

Use Supabase Auth Google OAuth with PKCE/cookie SSR for management. A manager creates a property-bound, expiring shared-device session. A staff PIN selects a limited accountable sub-user within that session; it is not standalone authentication and can never authorize ownership, billing, export, membership or sensitive finance.

## Consequences

Device theft remains a risk but impact is bounded. PINs require slow hashing, rate limiting, lockout, revocation and audit. Sensitive actions require a normal management session and sometimes recent re-auth/approval.

## Rejected alternatives

- PIN-only global accounts: weak identity and privilege-escalation risk.
- Shared manager credentials: no accountability.
- SMS/email OTP: explicitly excluded.

## Acceptance

PIN brute-force controls work; device/property scope cannot be changed by request; owner/finance/export/member actions fail in PIN mode; manager revocation terminates the device session.
