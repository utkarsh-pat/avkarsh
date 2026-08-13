"use client";

import { useActionState, useRef } from "react";
import { BedDouble, CalendarPlus, DoorOpen, Plus, UsersRound } from "lucide-react";
import { changeReservationStatus, createInventoryUnit, createReservation, type ReservationActionState } from "./actions";

const initialState: ReservationActionState = { status: "idle" };

type UnitOption = { id: string; unit_code: string; display_name: string; max_occupancy: number; status: string };

function ActionMessage({ state }: { state: ReservationActionState }) {
  return state.message ? <p className={`reservation-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null;
}

export function ReservationCreationControls({ propertyId, inventoryUnit, units }: { propertyId: string; inventoryUnit: "rooms" | "beds"; units: UnitOption[] }) {
  const [inventoryState, inventoryAction, inventoryPending] = useActionState(createInventoryUnit, initialState);
  const [reservationState, reservationAction, reservationPending] = useActionState(createReservation, initialState);
  const inventoryDetails = useRef<HTMLDetailsElement>(null);
  const bookingDetails = useRef<HTMLDetailsElement>(null);
  const noun = inventoryUnit === "beds" ? "bed" : "room";
  const availableUnits = units.filter((unit) => unit.status === "available");

  return (
    <div className="reservation-create-grid">
      <details ref={inventoryDetails} className="reservation-form-card">
        <summary><span><DoorOpen aria-hidden="true" /></span><div><small>INVENTORY</small><strong>Add {noun}</strong><p>Create an individually allocatable {noun}.</p></div><Plus aria-hidden="true" /></summary>
        <form action={inventoryAction}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <div className="reservation-form-grid">
            <label>{noun === "bed" ? "Bed code" : "Room number"}<input name="unitCode" placeholder={noun === "bed" ? "D1-B01" : "101"} required /></label>
            <label>Display name<input name="displayName" placeholder={noun === "bed" ? "Dorm 1 · Bed 01" : "Room 101"} required /></label>
            <label>Category<input name="category" placeholder={noun === "bed" ? "Mixed dorm" : "Deluxe"} /></label>
            <label>Floor / zone<input name="floorLabel" placeholder={noun === "bed" ? "Dorm 1" : "First floor"} /></label>
            <label>Max guests<input name="maxOccupancy" type="number" min="1" max="50" defaultValue={noun === "bed" ? 1 : 2} required /></label>
            <label>Nightly rate (₹)<input name="nightlyRate" type="number" min="0" max="1000000" step="0.01" defaultValue="0" required /></label>
          </div>
          <ActionMessage state={inventoryState} />
          <div className="reservation-form-actions"><button type="button" className="button secondary" onClick={() => inventoryDetails.current?.removeAttribute("open")}>Close</button><button className="button primary" disabled={inventoryPending}>{inventoryPending ? "Adding…" : `Add ${noun}`}</button></div>
        </form>
      </details>

      <details ref={bookingDetails} className="reservation-form-card reservation-booking-form">
        <summary><span><CalendarPlus aria-hidden="true" /></span><div><small>NEW BOOKING</small><strong>Create reservation</strong><p>Allocate one available {noun} to a guest.</p></div><Plus aria-hidden="true" /></summary>
        <form action={reservationAction}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <div className="reservation-form-grid">
            <label className="full-span">Select {noun}<select name="inventoryUnitId" required defaultValue=""><option value="" disabled>{availableUnits.length ? `Choose an available ${noun}` : `Add an available ${noun} first`}</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_code} · {unit.display_name} · up to {unit.max_occupancy}</option>)}</select></label>
            <label>Guest name<input name="guestName" autoComplete="name" required /></label>
            <label>Phone number<input name="guestPhone" inputMode="tel" autoComplete="tel" placeholder="9876543210" required /></label>
            <label>Check-in<input name="checkInDate" type="date" required /></label>
            <label>Check-out<input name="checkOutDate" type="date" required /></label>
            <label>Adults<input name="adults" type="number" min="1" max="50" defaultValue="1" required /></label>
            <label>Children<input name="children" type="number" min="0" max="50" defaultValue="0" required /></label>
            <label>Booking source<select name="source" defaultValue="front_desk"><option value="front_desk">Front desk</option><option value="walk_in">Walk-in</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="web">Website</option><option value="other">Other</option></select></label>
            <label className="full-span">Internal note<textarea name="notes" rows={3} placeholder="Arrival time or special request" /></label>
          </div>
          <ActionMessage state={reservationState} />
          <div className="reservation-form-actions"><button type="button" className="button secondary" onClick={() => bookingDetails.current?.removeAttribute("open")}>Close</button><button className="button primary" disabled={reservationPending || !availableUnits.length}>{reservationPending ? "Confirming…" : "Confirm reservation"}</button></div>
        </form>
      </details>
    </div>
  );
}

export function ReservationStatusActions({ propertyId, reservationId, status }: { propertyId: string; reservationId: string; status: string }) {
  const [state, action, pending] = useActionState(changeReservationStatus, initialState);
  const actions = status === "confirmed"
    ? [{ value: "checked_in", label: "Check in", Icon: UsersRound }, { value: "no_show", label: "No-show", Icon: BedDouble }, { value: "cancel", label: "Cancel", Icon: DoorOpen }]
    : status === "checked_in" ? [{ value: "checked_out", label: "Check out", Icon: DoorOpen }] : [];
  if (!actions.length) return null;
  return <form className="reservation-row-actions" action={action}><input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="reservationId" value={reservationId} />{actions.map(({ value, label, Icon }) => <button key={value} name="action" value={value} disabled={pending} title={label}><Icon aria-hidden="true" /><span>{label}</span></button>)}<ActionMessage state={state} /></form>;
}
