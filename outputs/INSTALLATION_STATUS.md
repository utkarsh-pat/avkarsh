# Avkarsh setup status

Date: 2026-08-10

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
- Next.js 16 session-refresh proxy added for configured Supabase environments.
- `mobile-app-ui-design` Codex skill verified as already installed and byte-identical to the current GitHub source checked on 2026-08-10.

## Web verification

- `pnpm-lock.yaml` exists and passes pnpm supply-chain policy checks.
- Native build scripts are restricted to Tailwind oxide, esbuild, Sharp, and unrs-resolver.
- Production dependency audit found no known vulnerabilities after patched `sharp` and `postcss` overrides.
- Lint passed with zero warnings.
- Strict TypeScript check passed.
- PWA manifest tests passed: 2/2.
- Next.js 16.2.11 production build passed after the sign-in and callback routes were added.

## M1 database foundation

- Supabase workspace initialized.
- Identity, actor, organization, property, membership, scoped role, staff-device credential, lifecycle, grants, and RLS foundation migration authored.
- 14 pgTAP structure, privilege, cross-tenant, assignment, revocation, and lifecycle tests authored.
- Local database execution is optional and pending because Docker is not installed/available on this machine; `pnpm db:start` timed out without starting a stack.
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
