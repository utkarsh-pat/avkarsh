**Comparison Target**

- Source visual truth: `C:\Users\utkar\AppData\Local\Temp\codex-clipboard-0b279d0c-8aff-4277-9e78-9116938f15a2.png`
- Rendered implementation: `S:\avkarsh-main\.codex-artifacts\dark-registration-viewport.png`
- Lower-form evidence: `S:\avkarsh-main\.codex-artifacts\dark-registration-lower.png`
- Side-by-side comparison: `S:\avkarsh-main\.codex-artifacts\dark-mode-comparison.png`
- Route/state: `/register`, anonymous visitor, Property owner selected, dark theme.
- Source pixels: 1917 x 881. Implementation pixels and CSS viewport: 1280 x 720 at 1x density.
- Normalization: the source was center-cropped to the implementation's 16:9 viewport and resized to 1280 x 720; the implementation remained at native 1280 x 720. The source is the reported failure state, not a content target: the customer module-selection region was intentionally removed by the clarified product requirement.

**Findings**

- No actionable P0/P1/P2 findings remain. The old near-white selected module cards are absent from the customer journey, all remaining form surfaces use dark-theme tokens, and labels, placeholders, borders, primary action, and explanatory copy remain readable.

**Required Fidelity Surfaces**

- Fonts and typography: the existing Avkarsh type family, weight hierarchy, line height, and letter spacing are preserved. Headline, legends, labels, optional hints, and CTA text remain visually distinct without clipping in the inspected desktop viewport.
- Spacing and layout rhythm: the existing centered content width, two-column field grids, section gaps, padding, borders, and radii remain consistent. Removing commercial/module questions produces a shorter three-step enquiry without leaving an empty region.
- Colors and visual tokens: canvas, fieldsets, inputs, borders, muted text, accent text, and CTA use the existing dark palette. The light-theme fills that caused the reported low-contrast state no longer appear in this journey; semantic admin/status surfaces also have explicit dark-theme overrides.
- Image quality and asset fidelity: this screen contains no photography, illustrations, or raster product assets. The Avkarsh wordmark remains text-based as in the existing product; no source asset was replaced or approximated.
- Copy and content: customer-facing copy now asks only for identity, property details, and optional context. It explicitly explains that access and commercial terms are configured after discussion. Plan preference and workspace module selection are not exposed to the applicant.

**Interaction and Runtime Checks**

- Tested relationship selection and return-to-relationship affordance.
- Tested light-to-dark theme switching and confirmed `data-theme="dark"`.
- Confirmed the rendered form contains exactly three sections and no plan or module controls.
- Inspected both the upper and lower form regions, including terms and the submit action.
- Did not submit the form, avoiding creation of a fake hosted onboarding request.
- No console entries originated from the Avkarsh preview deployment during the inspected flow.

**Focused Region Evidence**

- The upper viewport capture is sufficient for headline, section legends, labels, inputs, borders, and two-column rhythm at readable scale.
- `dark-registration-lower.png` separately verifies readonly/default fields, textarea, terms checkbox, explanatory copy, and primary submit treatment. No additional crop was needed.

**Comparison History**

1. Earlier P1: selected workspace-module cards inherited near-white light-theme fills in dark mode, making their pale labels effectively unreadable. The form also required hotel owners to make plan and RBAC decisions during a first enquiry.
2. Fix: removed plan preference and module selection from the applicant form; stored `pending_admin_review` with an empty requested-permission set; moved explicit plan/permission choice to admin approval; added explicit dark-theme styles for remaining semantic surfaces.
3. Post-fix evidence: the side-by-side comparison shows the problematic module grid is gone and the replacement three-step property enquiry renders on consistent dark surfaces. Upper and lower browser captures show no remaining contrast or layout regression.

**Implementation Checklist**

- [x] Keep the owner enquiry limited to contact, property, and optional context.
- [x] Defer plan, pricing, limits, and RBAC permissions to platform-admin review.
- [x] Require an explicit plan and at least one permission before approval.
- [x] Preserve rejection without requiring commercial fields.
- [x] Verify dark-theme upper and lower form regions in the deployed preview.

**Follow-up Polish**

- None required for this change. Mobile/browser-specific visual regression coverage can be added later as automated screenshot testing.

final result: passed
