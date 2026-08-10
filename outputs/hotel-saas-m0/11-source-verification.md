# Current Official Documentation Review

Reviewed 10 August 2026. Implementation must re-check the same sources immediately before installing packages or configuring providers.

## Next.js

- The official security release page lists Next.js **16.2.11** as Active LTS on 20 July 2026; use at least the current patched Active LTS at implementation time.
- App Router has built-in `manifest.ts/json` support. PWA service-worker/offline behavior still needs an explicit implementation and HTTPS/security review.
- Next.js 16 uses `proxy.ts` terminology. Proxy can refresh/route sessions but is not the tenant authorization boundary.

Sources:

- https://nextjs.org/blog
- https://nextjs.org/docs/app/guides/progressive-web-apps
- https://nextjs.org/docs/app

## Supabase

- Cookie-based Next.js sessions use `@supabase/ssr`; current docs still mark it beta/subject to change, so versions must be pinned and implementation checked against current examples.
- Use PKCE for SSR. Authenticated/session-refreshing responses must not be cached across users.
- Current guidance distinguishes publishable browser keys from server secret/service credentials.
- A 2026 breaking change makes new public-schema tables not automatically exposed to the Data API. Explicit grants are separate from—and required alongside—RLS.
- Views, functions, user-editable metadata and stale sessions require specific review; authorization remains in database membership state.

Sources:

- https://supabase.com/changelog?types=breaking-change
- https://supabase.com/docs/guides/auth/server-side
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api

## Google Identity

- Google Identity Services separates authentication (ID token) from authorization to Google APIs; this product needs authentication only for management login unless later scope is separately approved.
- Supabase's Google integration requires Google Cloud client configuration, approved redirect URLs and `openid`, email and profile scopes.
- Server-side session establishment uses PKCE/code exchange. Relative redirect validation is required to prevent open redirects.
- Use Google's rendered button/approved UX rather than a fabricated branded button. Brand verification/custom auth domain should be planned for trust.

Sources:

- https://developers.google.com/identity/gsi/web/guides/overview
- https://developers.google.com/identity/gsi/web/guides/integrate
- https://developers.google.com/identity/openid-connect/openid-connect
- https://supabase.com/docs/guides/auth/social-login/auth-google

## Meta WhatsApp

- Meta's developer documentation endpoint was not reliably fetchable from this environment during M0. No version-specific Graph endpoint, pricing or approval promise is therefore frozen in this pack.
- Meta-hosted official SDK/reference materials confirm webhook challenge verification and `X-Hub-Signature-256` authenticity checks using the app secret. The architecture also requires event idempotency, fast acknowledgement and asynchronous processing.
- Before M5, re-check Cloud API version, webhook fields/signature rules, template/session policies, Embedded Signup/Tech Provider requirements, number coexistence behavior, pricing and retention directly in the Meta developer dashboard/docs.

Official/Meta-hosted sources:

- https://developers.facebook.com/docs/whatsapp/cloud-api/
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/
- https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/
- https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

## Verification policy

Every integration milestone records source URL, review date, relevant version, material change, implementation decision and responsible engineer. Prices and plan limits are never copied into product logic without effective dates and configurable entitlements.

