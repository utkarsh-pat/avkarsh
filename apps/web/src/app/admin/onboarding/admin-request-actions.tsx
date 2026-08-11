"use client";

import { useActionState } from "react";
import { onboardingPermissions } from "@/lib/onboarding";
import {
  changeOrganizationAccess,
  reviewOnboardingRequest,
  updateProvisionedTenantControls,
  type AdminActionState,
} from "./actions";

const initialState: AdminActionState = { status: "idle" };

export function PendingRequestActions({
  requestId,
  requestedPermissions,
  requestedPlan,
  currencyCode,
}: {
  requestId: string;
  requestedPermissions: string[];
  requestedPlan: string;
  currencyCode: string;
}) {
  const [state, action, pending] = useActionState(reviewOnboardingRequest, initialState);

  return (
    <form action={action} className="admin-review-form">
      <input type="hidden" name="requestId" value={requestId} />
      <section>
        <h4>Final permissions</h4>
        <div className="admin-permission-grid">
          {onboardingPermissions.map(([key, label]) => (
            <label key={key}><input type="checkbox" name="permissions" value={key} defaultChecked={requestedPermissions.includes(key)} /><span>{label}</span></label>
          ))}
        </div>
      </section>
      <section>
        <h4>Subscription and limits</h4>
        <div className="admin-form-grid">
          <label>Plan<select name="plan" defaultValue={requestedPlan}><option value="trial">Trial</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select></label>
          <label>Billing<select name="billingCycle" defaultValue="monthly"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></label>
          <label>Amount <small>major units</small><input name="amountRupees" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <label>Currency<input name="currencyCode" maxLength={3} defaultValue={currencyCode} /></label>
          <label>Trial days<input name="trialDays" type="number" min="0" max="365" defaultValue="14" /></label>
          <label>Property limit<input name="propertyLimit" type="number" min="1" defaultValue="1" /></label>
          <label>Staff limit<input name="staffLimit" type="number" min="1" defaultValue="10" /></label>
        </div>
      </section>
      <label>Review reason or internal note<textarea name="reason" rows={3} maxLength={500} placeholder="Why this permission and plan set is appropriate…" /></label>
      {state.message ? <p className={`admin-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      <div className="admin-action-row">
        <button className="button danger" name="decision" value="reject" disabled={pending}>Reject request</button>
        <button className="button primary" name="decision" value="approve" disabled={pending}>{pending ? "Processing…" : "Approve and provision"}</button>
      </div>
    </form>
  );
}

export function ProvisionedRequestActions({ requestId, status }: { requestId: string; status: string }) {
  const [state, action, pending] = useActionState(changeOrganizationAccess, initialState);
  const isRevoked = status === "revoked";

  return (
    <form action={action} className="access-action-form">
      <input type="hidden" name="requestId" value={requestId} />
      <label>{isRevoked ? "Restore reason" : "Revocation reason"}<input name="reason" required minLength={3} maxLength={500} placeholder={isRevoked ? "Issue resolved and access verified" : "Payment, risk, or policy reason"} /></label>
      {state.message ? <p className={`admin-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      <button className={`button ${isRevoked ? "primary" : "danger"}`} name="action" value={isRevoked ? "restore" : "revoke"} disabled={pending}>
        {pending ? "Applying…" : isRevoked ? "Restore access" : "Revoke access"}
      </button>
    </form>
  );
}

export function ProvisionedSettingsActions({
  requestId,
  approvedPermissions,
  plan,
  billingCycle,
  amountMinor,
  currencyCode,
  trialDays,
  propertyLimit,
  staffLimit,
}: {
  requestId: string;
  approvedPermissions: string[];
  plan: string;
  billingCycle: string;
  amountMinor: number;
  currencyCode: string;
  trialDays: number;
  propertyLimit: number;
  staffLimit: number;
}) {
  const [state, action, pending] = useActionState(updateProvisionedTenantControls, initialState);

  return (
    <details className="admin-control-editor">
      <summary>Edit permissions and subscription</summary>
      <form action={action} className="admin-review-form provisioned-control-form">
        <input type="hidden" name="requestId" value={requestId} />
        <section>
          <h4>Effective role permissions</h4>
          <div className="admin-permission-grid">
            {onboardingPermissions.map(([key, label]) => (
              <label key={key}><input type="checkbox" name="permissions" value={key} defaultChecked={approvedPermissions.includes(key)} /><span>{label}</span></label>
            ))}
          </div>
        </section>
        <section>
          <h4>Commercial controls</h4>
          <div className="admin-form-grid">
            <label>Plan<select name="plan" defaultValue={plan}><option value="trial">Trial</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select></label>
            <label>Billing<select name="billingCycle" defaultValue={billingCycle}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></label>
            <label>Amount <small>major units</small><input name="amountRupees" type="number" min="0" step="0.01" defaultValue={(amountMinor / 100).toFixed(2)} /></label>
            <label>Currency<input name="currencyCode" maxLength={3} defaultValue={currencyCode} /></label>
            <label>Trial days from now<input name="trialDays" type="number" min="0" max="365" defaultValue={trialDays} /></label>
            <label>Property limit<input name="propertyLimit" type="number" min="1" defaultValue={propertyLimit} /></label>
            <label>Staff limit<input name="staffLimit" type="number" min="1" defaultValue={staffLimit} /></label>
          </div>
        </section>
        <label>Required change reason<textarea name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Customer request, plan upgrade, risk reduction, or corrected access scope…" /></label>
        {state.message ? <p className={`admin-action-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
        <div className="admin-action-row"><button className="button primary" disabled={pending}>{pending ? "Saving controls…" : "Save control changes"}</button></div>
      </form>
    </details>
  );
}
