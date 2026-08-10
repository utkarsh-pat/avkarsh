# Core Screen Functional Blueprints

These are low-fidelity content and interaction contracts—not a visual direction. Spacing, palette, typography and component styling are selected in the later three-option product-design gate.

## 1. Auth and property selection

| Region | Required content/action |
|---|---|
| Context | Product identity, environment indicator outside production |
| Primary | Official Google sign-in control |
| Recovery | Auth error, retry, support path |
| Selection | Authorized organizations/properties with role summary |
| Security | Never expose inaccessible tenant names through search/error |

## 2. Operational home

| Region | Required content/action |
|---|---|
| Header | Organization/property switcher, locale, connectivity/sync |
| Priority strip | Arrivals, departures, room readiness, urgent requests |
| Main list | Persona-specific exceptions ordered by urgency |
| Primary action | Reception: booking/check-in; housekeeping: scan/start; manager: resolve |
| Footer | Fixed five-item navigation; visible QR scan when allowed |

## 3. Availability and new booking

| Region | Required content/action |
|---|---|
| Search | Check-in/out, guests, room/bed mode |
| Results | Resource card, capacity, restrictions, canonical price |
| Selection | Multi-unit summary with conflict-safe totals |
| Guest | Name + WhatsApp/mobile; no guest email requirement |
| Confirm | Source, hold/confirm, discount reason/limit, amount |
| Recovery | Typed inventory-changed state returns to refreshed results |

## 4. Booking detail

Summary first: status, guest, dates, assigned room/beds, balance and next action. Secondary sections: party, timeline/audit, folio, notes, WhatsApp status and allowed transitions. Internal and guest-visible notes are visually/semantically distinct. Destructive transitions require reason and consequence confirmation.

## 5. Check-in

Stepper: verify booking → guest/co-guests → KYC/camera → allocation readiness → deposit/payment → consent/signature → activate stay. The sticky action reflects the exact next state. A dirty/maintenance unit blocks activation with an actionable resolution.

## 6. Checkout and folio

Top summary shows property, stay, balance and checkout effect. Folio groups immutable charges, payments and reversals. Adjustment is an explicit action with reason/approval—not inline editing. Final confirmation shows amount, payment split, invoice destination (download/print/WhatsApp), private-session expiry and dirty-room transition.

## 7. Shared inbox

| Region | Required content/action |
|---|---|
| Filter | All Hotels/authorized property, unassigned/mine, unread/urgent |
| Conversation list | Guest, property, last message, assignment, bot/human state |
| Thread | Message/status timeline and safe media treatment |
| Context | Booking/stay/request summary without leaking other tenants |
| Composer | Session/template state, usage/cost warning, handover controls |

## 8. Tasks

Unified open work list with property, room/bed, category, priority, SLA clock, assignee and status. Role filters remove irrelevant tasks. Bulk mutation is avoided on mobile where it could hide per-item consequence.

## 9. Housekeeping

One task per screen. Large room identity → staff identity/PIN → Start → icon checklist → issue evidence → Complete. Timer and connectivity are visible; other navigation is minimized. Pending sync is never confused with completion confirmed by the server.

## 10. Guest QR portal

Branded property identity and language switch precede large intent choices. Public and private areas have a hard semantic boundary. Stay verification is requested only when needed. Emergency/reception remain easy to reach. Shared-room users never see co-guest identity or bed occupancy.

## 11. Finance approval and cash close

Approval list emphasizes property, submitter, amount, category, limit and evidence. Cash close shows opening cash, receipts, refunds, expenses, expected, actual and variance. Approval/reopen requires reason and appropriate authentication strength.

## 12. Required state variants

Each blueprint is incomplete until it has realistic loading, empty, denied, recoverable error, stale/conflict, offline/pending-sync and success states in Hindi, English, French, Spanish, German and Russian at 320/360/390/430 px. Optional Japanese, Thai, Sinhala and Korean packs require the same verification before enablement.
