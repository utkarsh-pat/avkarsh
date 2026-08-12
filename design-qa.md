# Design QA — New-user role-first onboarding

## Evidence

- Source visual truth: `C:\Users\utkar\AppData\Local\Temp\codex-clipboard-c84fe06e-b18b-42e4-8864-e6a8275a4f2b.png`
- Source intent: the supplied screenshot documents the incorrect authenticated-new-user state (`/app` empty workspace). The requested target is an intentional state replacement based on ServiZephyr's role-first onboarding pattern, not a pixel clone of that empty workspace.
- ServiZephyr flow references: `S:\ServiZephyrTheRealBot\src\app\complete-profile\page.js` and `S:\ServiZephyrTheRealBot\src\app\select-role\page.js`
- Implementation screenshot: `S:\avkarsh-main\.codex-artifacts\deployed-new-user-role-selection.jpg`
- Preview: `https://avkarsh-git-codex-new-user-role-onboarding-vybnet.vercel.app/register`
- Source pixels: 1917 × 1020.
- Implementation pixels: 1520 × 833 JPEG; browser CSS viewport 1536 × 730 at device scale 1.
- Density normalization: both captures were inspected at original density. Exact overlay comparison is not applicable because the source is the reported wrong route/state; relative layout, palette, typography, and app-shell continuity were compared.
- State: light theme, unauthenticated rendering of the same first-step role chooser used for authenticated new users. Authenticated redirect selection is covered by server logic and four unit cases because preview-domain auth cookies are isolated from production.

## Full-view comparison evidence

- The incorrect property-workspace shell is replaced by a focused first-step onboarding surface before property details.
- Avkarsh's royal-blue palette, Geist typography, spacing rhythm, top bar, rounded cards, and light/dark theme behavior remain consistent with the existing product.
- Four hotel-relevant choices are visible without scrolling at the tested desktop viewport.
- The preview measured 1521 px document width inside a 1536 px viewport with no horizontal overflow.
- The Vercel preview toolbar visible at the far-right edge of the capture is preview infrastructure, not application UI.

## Focused interaction evidence

- `Property owner` opens the complete owner/property request form.
- `Change relationship` returns to the role chooser.
- `Property staff` opens the invitation-only guidance path and does not expose owner registration.
- The light/dark control changes theme without affecting role selection.
- No visible runtime-error overlay or broken control was observed during these interactions.

## Required fidelity surfaces

- Fonts and typography: passed — existing Geist hierarchy and weights are preserved; the role heading and card labels remain readable with clean wrapping.
- Spacing and layout rhythm: passed — balanced two-column role grid, consistent 14–24 px internal spacing, and no desktop overflow.
- Colors and visual tokens: passed — role cards use the established royal-blue canvas, surface, border, primary, and dark-mode tokens.
- Image quality and asset fidelity: passed — no raster assets are required; role symbols use the project's installed Lucide icon system rather than placeholders or handcrafted SVGs.
- Copy and content: passed — hotel-specific roles are clear and property details are deferred until after selection.

## Findings

- No actionable P0, P1, or P2 visual or interaction findings remain.

## Comparison history

- Initial reported finding (P1): a fresh authenticated account landed directly on an empty property workspace and never saw the role question.
- Root cause: `/app` lacked a new-user entry decision, while the registration form automatically selected `property_owner` whenever an authenticated identity existed.
- Fix: route users with zero accessible properties and no platform-admin role to `/register`; initialize every registration at the role chooser; retain approved property-member and platform-admin entry behavior.
- Post-fix evidence: deployed role chooser capture plus successful owner-form and staff-invitation interaction tests.

## Implementation checklist

- [x] New unaffiliated login enters role-first onboarding.
- [x] Approved property members remain in the workspace.
- [x] Platform admins remain in the workspace/admin entry path.
- [x] Property owners/operators/partners continue to property details.
- [x] Property staff are directed to invitation-based RBAC access.
- [x] Automated web verification passes.

## Follow-up polish

- P3: capture the same flow with a brand-new production auth identity after merge as an additional end-to-end evidence artifact.

final result: passed
