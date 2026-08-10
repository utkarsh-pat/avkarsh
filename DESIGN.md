---
name: avkarsh-standard-saas-ui
version: 1.1.0
design_system: standard-saas
---

# Avkarsh design direction

Use a familiar, restrained SaaS interface: system typography, clear navigation, readable cards, conventional form controls, and a single accessible blue primary action. Prioritize fast hotel workflows, multilingual readability, accessibility, and low-end Android performance.

## Principles

1. Operational clarity beats decoration. The next action, property context, business date, and status must be unmistakable.
2. Mobile is a first-class staff surface. Design from 375px upward; no desktop-only workflow.
3. Never communicate booking, payment, room, or safety status through color alone.
4. Destructive and financial actions require explicit labels, consequence copy, and confirmation.
5. Motion is functional and subtle. Respect `prefers-reduced-motion`; avoid blur-heavy or continuous animation.
6. Hindi and English copy may expand. Components must tolerate at least 40% text expansion.

## Typography

- UI: Geist Sans, then system sans-serif.
- Numbers, folio amounts, booking references, timestamps, and audit metadata: Geist Mono with tabular numerals.
- Display weight ceiling: 600. Body: 400. Controls: 500.
- Page title: clamp(1.75rem, 4vw, 3rem), line-height 1.05, tight tracking.
- Section title: 1.25rem/1.75rem. Body: 1rem/1.5rem. Dense metadata: 0.75rem/1rem.

## Color tokens

Light is the default operational theme. Dark mode may follow after contrast verification.

```css
--canvas: #f8fafc;
--surface: #ffffff;
--surface-subtle: #f1f5f9;
--ink: #0f172a;
--body: #475569;
--muted: #64748b;
--hairline: #dbe3ee;
--primary: #2563eb;
--primary-hover: #1d4ed8;
--primary-on: #ffffff;
--focus: #2563eb;
--info: #2563eb;
--success: #15803d;
--warning: #a16207;
--danger: #b91c1c;
```

Semantic status treatments combine icon + label + tinted surface. Minimum text contrast is WCAG AA. Focus rings must remain visible on every surface.

## Spacing and shape

- Base grid: 4px; preferred rhythm: 8px.
- Page gutters: 16px mobile, 24px tablet, 32px desktop.
- Content width: 1440px maximum.
- Radius: 8px controls, 12px cards, full radius only for compact status chips.
- Touch targets: 44x44px minimum; primary mobile actions prefer 48px height.
- Use hairline borders, white surfaces, and subtle elevation. No glassmorphism, grids, oversized display type, or decorative technical motifs in operational screens.

## App shell

- Mobile: compact top bar plus bottom navigation for the highest-frequency areas; secondary areas live in More.
- Desktop: left navigation rail plus top property/business-date context bar.
- Preserve one obvious primary action per view.
- Lists become stacked cards only when a table would force horizontal scrolling; do not hide critical columns silently.

## Core components

- Buttons: clear verb labels; loading preserves width; disabled state must explain itself nearby when non-obvious.
- Forms: persistent labels, inline error text, appropriate input modes, and server-side validation.
- Status chips: icon + text; never color-only.
- Financial values: right-aligned, monospaced, tabular numerals; negative and reversed values explicitly labelled.
- Dialogs: use only for focused confirmation or short forms. Complex workflows get a full page or sheet.
- Empty states: explain why the list is empty and provide the safe next action.
- Skeletons: match final geometry and never animate indefinitely when reduced motion is requested.

## Responsive and PWA rules

- Support 320px as a hard minimum and optimize at 375px, 768px, 1024px, and 1440px.
- Respect safe-area insets in installed PWA mode across supported mobile browsers.
- Critical guest and staff flows must remain understandable on slow connections and after a refresh.
- Do not cache authenticated HTML or sensitive API responses in the service worker.
- Distribution is web-only: responsive browser experience plus an installable PWA. Do not introduce a native or Android-wrapper codebase.

## Accessibility gate

- Keyboard reachable and visibly focused.
- Semantic landmarks and heading order.
- Inputs have programmatic names and errors.
- 200% zoom without lost actions or clipped content.
- Screen-reader announcements for async success/error states.
- Contrast, reduced motion, touch size, and language switching are release checks.
