"use client";

import Link from "next/link";
import { useActionState } from "react";
import { claimStaffInvitation, type ClaimInvitationState } from "./actions";

const initialState: ClaimInvitationState = { status: "idle" };

export function ClaimInvitationCard({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(claimStaffInvitation, initialState);

  return (
    <section className="auth-card invite-claim-card" aria-labelledby="claim-title">
      <p className="eyebrow">PROPERTY INVITATION</p>
      <h1 id="claim-title">Confirm your staff identity.</h1>
      <p>Signed in as <strong>{email}</strong>. The invitation will only match the exact Google email selected by the property administrator.</p>
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        {state.message ? <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
        {state.status !== "success" ? <button className="button primary full-width" disabled={pending}>{pending ? "Verifying identity…" : "Claim invitation"}</button> : <Link className="button primary full-width" href="/app">Check workspace access</Link>}
      </form>
      <p className="auth-footnote">Token possession never activates access by itself. After a successful claim, the inviter must approve your verified identity.</p>
    </section>
  );
}
