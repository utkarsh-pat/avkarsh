# Avkarsh setup status

Date: 2026-08-11

## Scope

- Responsive web application
- Installable Progressive Web App (PWA)
- No APK, native application, or Android wrapper

## Completed

- Git repository initialized on `main`.
- pnpm workspace and Next.js App Router application scaffolded.
- Next.js, React, TypeScript, Tailwind CSS, Supabase clients, Zod, Vitest, ESLint, and Geist are pinned.
- `getdesign` 0.6.24 and Supabase CLI 2.110.0 are pinned as development tools and verified executable.
- Standard SaaS `DESIGN.md` tailored for hotel operations, multilingual expansion, accessibility, low-end mobile performance, and 44px minimum touch targets.
- PWA manifest, install icons, viewport metadata, and a privacy-safe service worker registration added.
- Service worker deliberately does not cache authenticated pages or API responses.
- Google OAuth sign-in screen and Supabase SSR callback route added. They fail closed when public Supabase configuration is missing.
- Authenticated `/app` workspace and accessible property switcher added. It queries only the properties returned through Supabase RLS; no mock tenant data is shown.
- Property selection now opens a server-rendered `/app/property/[propertyId]` context. The URL never grants access: inaccessible and nonexistent property IDs produce the same not-found boundary, while assigned properties render a mobile-first command-centre shell with organization lifecycle, timezone and currency context.
- Next.js 16 session-refresh proxy added for configured Supabase environments.
- Role-first `/register` flow added. Anonymous applicants identify their relationship before entering details; authenticated Google users reuse their verified identity. Property staff are routed to invitation-based access and cannot self-provision an owner role.
- Platform-protected `/admin/onboarding` control plane added for reviewing requests, choosing the final least-privilege module set, configuring plan/billing/trial/property/staff limits, approving or rejecting, and revoking or restoring provisioned tenants.
- Provisioned tenants can now be edited after approval. Permission replacement and commercial controls remain one audited database transaction, and editing a revoked tenant never silently restores access.
- Property workspaces are permission-aware: RLS first scopes the property, then the database authorization resolver decides each visible module. Missing or failed decisions are fail-closed and appear only as locked modules.
- Property owners with `staff.manage` now have a team-access workspace. Invitations store only SHA-256 token/email hashes, can be claimed only by the exact Google identity, require a separate owner approval before membership activation, and support immediate property-level suspension/restoration.
- Anonymous approvals remain unclaimed until the applicant signs in with the exact verified Google email. Approval provisions the organization, first property, tenant role, permission grants, subscription, and audit record in one database transaction.
- `mobile-app-ui-design` Codex skill verified as already installed and byte-identical to the current GitHub source checked on 2026-08-10.
- ServiZephyr reuse analysis documents which login/onboarding/admin/owner/RBAC/WhatsApp patterns were adapted and which Firebase/client-authority patterns were deliberately rejected.

## Web verification

- `pnpm-lock.yaml` exists and passes pnpm supply-chain policy checks.
- Native build scripts are restricted to Tailwind oxide, esbuild, Sharp, and unrs-resolver.
- Production dependency audit found no known vulnerabilities after patched `sharp` and `postcss` overrides.
- Lint passed with zero warnings.
- Strict TypeScript check passed.
- PWA, owner-onboarding, staff-boundary, and permission-catalogue contract tests passed: 8/8.
- Next.js 16.2.11 production build passed after the sign-in and callback routes were added.

## M1 database foundation

- Supabase workspace initialized.
- Identity, actor, organization, property, membership, scoped role, staff-device credential, lifecycle, grants, and RLS foundation migration authored.
- M1 hardening migration now adds server-owned high-privilege invitation and sole-owner recovery workflows; an invitation claim remains pending until an independent approval step.
- Generic command receipts enforce the idempotency-key/request-hash contract; append-only audit envelopes and lease/retry/dead-letter outbox records are isolated from browser clients and constrained to their organization/property scope.
- The deterministic management authorization resolver now enforces active actor/membership/property scope, permanent explicit-deny precedence, authentication ceilings, recent-Google step-up requirements, tenant lifecycle restrictions, and minimum applicable typed financial limits.
- Platform-admin RBAC is isolated from tenant RBAC. The onboarding migration adds typed requests and subscriptions, verified-email claims, transactional admin review, synchronized revoke/restore, and append-only audit events.
- Dedicated pgTAP contract tests cover the hardening tables, RLS, browser privilege boundary, validation constraints, and audit immutability trigger.
- 90 pgTAP structure, privilege, cross-tenant, identity-spoofing, invitation forwarding, claim-without-activation, assignment, transactional approval, exact permission replacement, workspace resolution, suspension, revocation-state preservation, lifecycle, M1 hardening, and authorization-resolver tests pass locally.
- Database tests are split across identity/tenancy, M1 hardening, authorization-resolver, owner-onboarding control-plane, post-approval workspace-control, and staff-invitation/access-management suites.
- Docker Desktop, its WSL 2 backend, and the local Supabase stack are installed and verified on this machine.
- `pnpm db:reset` applied all migrations successfully; `pnpm db:test` passed all 90 pgTAP tests; `pnpm db:lint` reported no schema errors; local security and performance advisors found no issues.
- Hosted deployment path: link the Supabase CLI to the approved cloud project, run `pnpm db:push`, configure Auth, then deploy the Next.js/PWA app to Vercel.
- GitHub Actions CI runs web verification plus isolated Supabase reset, pgTAP, and database lint on a Docker-capable runner; actions are pinned to reviewed commit SHAs.

Optional local/CI database verification on a Docker-capable environment:

```powershell
$pnpm = 'C:\Users\utkar\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
& $pnpm install --frozen-lockfile
& $pnpm db:start
& $pnpm db:reset
& $pnpm db:test
& $pnpm db:lint
```

For the direct hosted path, apply the migration only to the approved Supabase cloud project after a database review. Do not apply it to production before the CI database job has passed.

For OAuth, configure the Supabase Google provider and add the deployed app callback URL in Supabase Auth redirect URLs before using the sign-in button in a real environment.

## First platform super admin

The app deliberately never promotes the first ordinary user automatically. After the intended SaaS administrator has signed in once, run the following in the approved Supabase SQL editor with their exact verified email:

```sql
insert into public.platform_admins (
  profile_id, admin_role, permissions, assigned_by_actor_id
)
select profiles.id, 'super_admin', '{}'::text[], profiles.actor_id
from public.profiles
join auth.users on users.id = profiles.id
where lower(users.email) = lower('replace-with-admin@example.com')
on conflict (profile_id) do update
set admin_role = 'super_admin', status = 'active', permissions = '{}'::text[];
```

The statement must affect exactly one row. The promoted identity will then see **Admin control plane** in `/app`; no tenant owner or employee role can open it.
