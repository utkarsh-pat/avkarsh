# Avkarsh

Multi-tenant hotel operations platform. The approved M0 architecture pack is in `outputs/hotel-saas-m0`; implementation starts with the M1 identity, tenancy, authorization, audit, and delivery foundations.

## Product delivery

- Web: responsive Next.js App Router application.
- Installable app: PWA from the same codebase.
- Distribution: web app and installable PWA only; no APK or native wrapper.
- Backend: Supabase Auth and PostgreSQL with Row Level Security.

Read `DESIGN.md` before implementing UI.

## Local commands

```powershell
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and provide the local or hosted Supabase values before running authenticated flows.

Local Docker is optional. For hosted delivery, link the Supabase CLI to the approved cloud project, deploy migrations with `pnpm db:push`, and deploy the Next.js/PWA application to Vercel. The CI workflow still uses an isolated Docker runner to test database migrations before release.

## Hotel Owner OS delivery status

The owner workspace is being delivered in dependency-safe vertical slices. Payment and subscription collection remain intentionally out of scope until the finance ledger is approved.

- Complete: permission-aware desktop/mobile application shell, property switcher, quick actions, SVG navigation, responsive dark/light theme.
- Complete: default Super View with room/bed cards, independent occupancy/readiness states, floor/type/search filters, live card/timeline/calendar modes, real reservation context, and unit drawer.
- Complete foundation: property-scoped housekeeping, guest request, maintenance, inspection, lost-and-found, and general tasks with RLS and realtime publication.
- Connected routes: Guests, Operations, Finance, Analytics, Reports, QR & Guest Portal, Property Setup, Integrations, and Settings. Incomplete ledgers and public portal security are labelled as not configured instead of showing invented data.
- Next: stay lifecycle and assignment, folios/night audit, secure QR guest portal, unified inbox, finance ledger, and export-grade reports.
