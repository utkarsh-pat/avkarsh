# Design QA

- Source visual truth: `C:/Users/utkar/AppData/Local/Temp/codex-clipboard-dedfb380-654f-4594-ad40-8f91c095ffeb.png`, `C:/Users/utkar/AppData/Local/Temp/codex-clipboard-8f6c573c-989f-4550-bcfd-aed914916d0c.png`, and the WhatsApp Direct implementation in `S:/ServiZephyrTheRealBot/src/app/owner-dashboard/whatsapp-direct/page.js`.
- Target: Avkarsh property-owner dashboard header, responsive navigation, reservations/inventory workspace, and WhatsApp Direct.
- Design language: existing royal-dark-blue Avkarsh tokens with the compact operational density and three-pane chat structure of ServiZephyr.

## Implementation review

- The mobile app bar uses a centered 40 px hamburger target, an absolutely centered property title, and right-aligned theme/profile controls without overlap.
- Desktop and mobile profile menus expose the authenticated email and a working logout action.
- Theme switching lives in the header; no duplicate floating control is rendered inside authenticated app routes.
- WhatsApp Direct uses a responsive inbox/thread/profile layout with active/archive and tag filters, unread state, message delivery state, guest notes, and archive controls.
- The WhatsApp thread becomes a single focused surface on narrow screens and provides an explicit back action to the inbox.
- Reservations use room terminology for hotels and bed terminology for dormitory inventory.

## Functional and data checks

- Inventory, reservations, allocations, WhatsApp conversations, messages, guest details, and media objects remain property-scoped through RLS permission checks.
- Reservation overlap prevention is enforced by a PostgreSQL exclusion constraint, not only in the UI.
- WhatsApp supports live inbox refresh, Meta's 24-hour reply window, approved templates, and image/video/audio/document attachments up to 25 MB in a private Supabase Storage bucket.
- Full web verification passed: lint, TypeScript, 16 unit tests, and Next.js production build.
- Database migrations and pgTAP tests are delegated to the GitHub CI Supabase job because Docker is unavailable on this workstation.

## Visual verification status

The required authenticated Chrome visual capture is blocked because the selected Chrome profile is not currently available to the Codex browser connection. Product Design policy prevents switching to another browser/profile or creating a temporary bypass route.

final result: blocked
