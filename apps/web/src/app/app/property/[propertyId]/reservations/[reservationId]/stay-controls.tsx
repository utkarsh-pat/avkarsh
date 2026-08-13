"use client";

import { useActionState, useState } from "react";
import { ArrowRightLeft, CalendarPlus, DoorOpen, LogIn, LogOut } from "lucide-react";
import { changeReservationStatus, type ReservationActionState } from "../actions";
import { extendReservation, moveReservation } from "./actions";

const initial: ReservationActionState = { status: "idle" };
type Unit = { id: string; unit_code: string; display_name: string; nightly_rate_minor: number; operational_state: string };
function Result({ state }: { state: ReservationActionState }) { return state.message ? <p className={`reservation-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null; }

export function StayControls({ propertyId, reservationId, status, currentUnitId, currentCheckOut, units, currencyCode }: { propertyId: string; reservationId: string; status: string; currentUnitId: string; currentCheckOut: string; units: Unit[]; currencyCode: string }) {
  const [transitionState, transitionAction, transitionPending] = useActionState(changeReservationStatus, initial);
  const [moveState, moveAction, movePending] = useActionState(moveReservation, initial);
  const [extendState, extendAction, extendPending] = useActionState(extendReservation, initial);
  const [transitionKey] = useState(() => crypto.randomUUID());
  const [moveKey] = useState(() => crypto.randomUUID());
  const [extendKey] = useState(() => crypto.randomUUID());
  const alternatives = units.filter((unit) => unit.id !== currentUnitId);

  return <section className="stay-action-grid" aria-label="Stay actions">
    <article><header><span>{status === "confirmed" ? <LogIn /> : <LogOut />}</span><div><small>LIFECYCLE</small><h2>{status === "confirmed" ? "Guest arrival" : "Guest departure"}</h2></div></header>{status === "confirmed" || status === "checked_in" ? <form action={transitionAction}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="reservationId" value={reservationId} /><input type="hidden" name="commandKey" value={transitionState.commandKey ?? transitionKey} /><p>{status === "confirmed" ? "Check-in requires a ready room or bed." : "Checkout will mark the unit dirty and create a housekeeping task."}</p><button className="button primary" name="action" value={status === "confirmed" ? "checked_in" : "checked_out"} disabled={transitionPending}>{status === "confirmed" ? <><LogIn /> Confirm check-in</> : <><DoorOpen /> Confirm checkout</>}</button><Result state={transitionState} /></form> : <div className="module-empty"><DoorOpen /><strong>Stay lifecycle complete</strong></div>}</article>

    <article><header><span><ArrowRightLeft /></span><div><small>ALLOCATION</small><h2>Move room / bed</h2></div></header><form action={moveAction}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="reservationId" value={reservationId} /><input type="hidden" name="commandKey" value={moveState.commandKey ?? moveKey} /><label>Target room / bed<select name="inventoryUnitId" required defaultValue=""><option value="" disabled>Select available inventory</option>{alternatives.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_code} · {unit.display_name} · {new Intl.NumberFormat("en-IN", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(unit.nightly_rate_minor / 100)} · {unit.operational_state}</option>)}</select></label><label>Reason<input name="reason" required minLength={3} maxLength={500} placeholder="Guest request, maintenance…" /></label><p>Current booked value is preserved; no silent rate adjustment is posted.</p><button className="button secondary" disabled={movePending || !alternatives.length}><ArrowRightLeft /> Confirm move</button><Result state={moveState} /></form></article>

    <article><header><span><CalendarPlus /></span><div><small>STAY DATES</small><h2>Extend stay</h2></div></header><form action={extendAction}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="reservationId" value={reservationId} /><input type="hidden" name="commandKey" value={extendState.commandKey ?? extendKey} /><label>New checkout<input name="newCheckOutDate" type="date" min={currentCheckOut} required /></label><label>Reason<input name="reason" required minLength={3} maxLength={500} placeholder="Guest requested extension" /></label><p>Availability is checked atomically and extra nights use the unit&apos;s active nightly rate.</p><button className="button secondary" disabled={extendPending}><CalendarPlus /> Check and extend</button><Result state={extendState} /></form></article>
  </section>;
}
