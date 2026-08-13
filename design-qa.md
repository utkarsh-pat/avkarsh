**Source visual truth**

- `C:\Users\utkar\AppData\Local\Temp\codex-clipboard-fb69d39a-a8b8-4cf4-8a38-5e6767ca77d6.png`
- Source pixels: 734 × 635.
- Selected state: desktop light-theme Floor Command Board; room context opens only after a unit selection.

**Implementation evidence**

- Route: `/app/property/[propertyId]`
- Intended desktop viewport: 1440 × 1000 CSS px at device scale factor 1.
- Browser-rendered screenshot: unavailable. The in-app browser screenshot command timed out and the connected Chrome surface was unavailable.
- Build evidence: `pnpm verify:web` passed, including lint, TypeScript, tests, and production build.
- Primary interactions represented in code: status filters, floor/type/search filters, card/timeline/calendar views, new-booking link, unit selection, selected-unit drawer close, create-task and view-stays links.
- Console errors: not checked because browser rendering was unavailable.

**Full-view comparison evidence**

- Source was opened and inspected at original resolution.
- Implementation could not be captured in the same authenticated property state, so a normalized visual comparison is blocked.

**Focused region comparison evidence**

- Source regions inspected: compact command-board header, filter row, four-column floor grid, semantic state rails, and selection-only right context panel.
- Matching implementation regions could not be browser-captured.

**Findings**

- [P1] Visual fidelity cannot be confirmed without an authenticated browser render.
  - Location: complete Super View route.
  - Evidence: source is available; implementation screenshot is not.
  - Impact: density, wrapping, responsive behavior, and selected drawer proportions cannot be judged reliably from source code alone.
  - Fix: open the authenticated property route, capture desktop and mobile screenshots, compare them with the selected source, and correct any P1/P2 drift.

**Required fidelity surfaces**

- Fonts and typography: code uses the existing Avkarsh font system; visual match is unverified.
- Spacing and layout rhythm: compact dimensions and four-column grid implemented; visual match is unverified.
- Colors and visual tokens: existing royal-blue tokens plus semantic state colors retained; visual match is unverified.
- Image quality and asset fidelity: the target contains no raster assets; Lucide library icons are used consistently.
- Copy and content: Floor Command Board, date, filters, live unit data, and selection-only context match the intended product behavior.

**Comparison history**

- Initial implementation moved analytics signals out of Super View and compacted the operational board.
- Selected reference then refined the target to a denser four-column floor board with a selection-only context panel.
- Code was updated to this target, but post-fix visual evidence remains unavailable.

**Implementation checklist**

- Capture authenticated desktop board with no selected unit.
- Select one room and capture the context drawer state.
- Capture mobile board and drawer/sheet state.
- Fix all resulting P1/P2 layout differences before marking the visual QA passed.

final result: blocked
