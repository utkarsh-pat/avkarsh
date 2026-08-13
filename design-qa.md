# Design QA

- Source visual truth: `C:/Users/utkar/AppData/Local/Temp/codex-clipboard-e8a3539a-f755-428d-b75f-3131a7686849.png` and `C:/Users/utkar/AppData/Local/Temp/codex-clipboard-8b697fee-c650-40f1-a8bc-f098833d295a.png`.
- Target: approved property-owner dashboard, desktop and responsive mobile states.
- Design language: existing Avkarsh royal-dark-blue tokens, Geist typography, compact ServiZephyr-style operational cards, and Lucide SVG icons.

## Implementation review

- Sidebar links now use semantic Lucide SVG icons; text initials remain only in identity/avatar marks.
- The dashboard hierarchy is property status, four live operating metrics, open guest requests, WhatsApp Direct inbox, team access, and support.
- Desktop uses four-column metrics and two-column operational feeds. It collapses to two metric columns below 760 px and one column below 480 px.
- Long subjects and previews truncate safely. Case metadata rearranges below 480 px without horizontal overflow.
- Light and dark mode share existing theme tokens; status accents have explicit dark-mode variants.
- The duplicate floating theme control is suppressed throughout `/app`; the functional theme control lives in the owner topbar.
- Only implemented destinations are exposed in the owner sidebar. Future modules will be added one at a time with working routes.

## Functional and data checks

- Dashboard queries remain scoped to the current property and authenticated RLS policies.
- Counts use exact head queries; WhatsApp unread totals are calculated across all active conversations, independently of the five-row inbox preview.
- Support phone and WhatsApp actions use `+91 89220 35716` / `918922035716`.
- Full lint, TypeScript, 16 unit tests, and Next.js production build passed.

## Visual verification status

Authenticated Chrome capture is pending because the ChatGPT browser extension is not installed in Chrome's currently selected `Profile 1`. The extension is available in other profiles, but Product Design policy does not permit silently switching the user's chosen browser/profile. No alternate browser or temporary preview route was used.

final result: implementation passed; authenticated visual capture pending
