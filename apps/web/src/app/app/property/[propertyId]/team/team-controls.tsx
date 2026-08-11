"use client";

import { useActionState, useState } from "react";
import { propertyStaffPermissions } from "@/lib/onboarding";
import {
  changeTeamMemberAccess,
  createStaffInvitation,
  reviewStaffInvitation,
  type TeamActionState,
} from "./actions";

const initialState: TeamActionState = { status: "idle" };

function Feedback({ state }: { state: TeamActionState }) {
  return state.message
    ? <p className={`admin-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>
    : null;
}

export function CreateInvitationForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(createStaffInvitation, initialState);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyInvitation() {
    if (!state.invitePath) return;
    try {
      await navigator.clipboard.writeText(new URL(state.invitePath, window.location.origin).toString());
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <form action={action} className="team-invite-form">
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="team-form-row">
        <label>Staff Google email<input type="email" name="email" required autoComplete="email" placeholder="staff@example.com" /></label>
        <label>Link expires<select name="expiryDays" defaultValue="7"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>
      </div>
      <fieldset className="team-permission-fieldset">
        <legend>Property permissions</legend>
        <div className="admin-permission-grid">
          {propertyStaffPermissions.map(([key, label]) => (
            <label key={key}><input type="checkbox" name="permissions" value={key} defaultChecked={["dashboard.view", "reservation.manage", "guest.manage", "stay.manage"].includes(key)} /><span>{label}</span></label>
          ))}
        </div>
      </fieldset>
      <Feedback state={state} />
      {state.invitePath ? (
        <div className="invite-link-result">
          <code>{state.invitePath}</code>
          <button className="button secondary" type="button" onClick={copyInvitation}>{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy full link"}</button>
        </div>
      ) : null}
      <button className="button primary" disabled={pending}>{pending ? "Creating secure link…" : "Create invitation"}</button>
    </form>
  );
}

export function InvitationReviewForm({
  propertyId,
  invitationId,
  status,
}: {
  propertyId: string;
  invitationId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(reviewStaffInvitation, initialState);
  const canApprove = status === "claimed";
  const canRevoke = ["pending", "claimed"].includes(status);
  if (!canApprove && !canRevoke) return null;

  return (
    <form action={action} className="team-inline-action">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <input name="reason" required minLength={3} maxLength={500} placeholder="Identity verification or revocation reason" />
      <Feedback state={state} />
      <div className="admin-action-row">
        {canRevoke ? <button className="button danger" name="decision" value="revoke" disabled={pending}>Revoke</button> : null}
        {canApprove ? <button className="button primary" name="decision" value="approve" disabled={pending}>{pending ? "Applying…" : "Approve identity"}</button> : null}
      </div>
    </form>
  );
}

export function MemberAccessForm({
  propertyId,
  profileId,
  status,
}: {
  propertyId: string;
  profileId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(changeTeamMemberAccess, initialState);
  const restoring = status === "suspended";

  return (
    <form action={action} className="team-inline-action">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="profileId" value={profileId} />
      <input name="reason" required minLength={3} maxLength={500} placeholder={restoring ? "Why access is safe to restore" : "Why access is being suspended"} />
      <Feedback state={state} />
      <button className={`button ${restoring ? "primary" : "danger"}`} name="action" value={restoring ? "restore" : "suspend"} disabled={pending}>
        {pending ? "Applying…" : restoring ? "Restore property access" : "Suspend property access"}
      </button>
    </form>
  );
}
