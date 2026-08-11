"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  defaultRequestedPermissions,
  onboardingPermissions,
  propertyTypes,
  requesterKinds,
  type OnboardingActionState,
} from "@/lib/onboarding";
import { submitOnboardingRequest } from "./actions";

type ExistingRequest = {
  id: string;
  property_name: string;
  status: string;
  created_at: string;
  approved_plan: string | null;
};

type RegistrationFormProps = {
  identity?: { name: string; email: string };
  existingRequests: ExistingRequest[];
};

const initialState: OnboardingActionState = { status: "idle" };

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function RegistrationForm({ identity, existingRequests }: RegistrationFormProps) {
  const [requesterKind, setRequesterKind] = useState(identity ? "property_owner" : "");
  const [state, formAction, isPending] = useActionState(submitOnboardingRequest, initialState);

  if (state.status === "success") {
    return (
      <section className="registration-success" aria-labelledby="request-received-title">
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">REQUEST RECEIVED</p>
        <h1 id="request-received-title">Your property is in the review queue.</h1>
        <p>{state.message}</p>
        <dl className="request-receipt">
          <div><dt>Request reference</dt><dd>{state.requestId}</dd></div>
          <div><dt>Next step</dt><dd>Admin review, permissions, and subscription setup</dd></div>
        </dl>
        <div className="actions">
          {identity ? <Link className="button primary" href="/app">Open workspace</Link> : (
            <Link className="button primary" href="/sign-in?next=/register">Sign in with the same email</Link>
          )}
          <Link className="button secondary" href="/">Back home</Link>
        </div>
      </section>
    );
  }

  if (!requesterKind) {
    return (
      <section className="identity-step" aria-labelledby="identity-step-title">
        <p className="eyebrow">BEFORE WE BEGIN</p>
        <h1 id="identity-step-title">How are you connected to the property?</h1>
        <p className="registration-lede">Choose your relationship first. We will ask only for the details needed for that access request.</p>
        <div className="identity-grid">
          {requesterKinds.map((kind) => (
            <button className="identity-option" key={kind.value} onClick={() => setRequesterKind(kind.value)}>
              <span>{kind.label}</span>
              <small>{kind.copy}</small>
              <strong aria-hidden="true">→</strong>
            </button>
          ))}
        </div>
        <p className="existing-user-copy">Already approved? <Link href="/sign-in?next=/app">Sign in to your workspace</Link></p>
      </section>
    );
  }

  if (requesterKind === "property_staff") {
    return (
      <section className="registration-success" aria-labelledby="staff-access-title">
        <span className="success-mark staff" aria-hidden="true">ID</span>
        <p className="eyebrow">PROPERTY STAFF ACCESS</p>
        <h1 id="staff-access-title">Your property administrator must invite you.</h1>
        <p>Staff cannot create or claim an organization through the owner registration flow. Ask the owner or manager for a property-scoped invitation with the role and permissions you need.</p>
        <div className="actions">
          <Link className="button primary" href="/sign-in?next=/app">I already have an invitation</Link>
          <button className="button secondary" type="button" onClick={() => setRequesterKind("")}>Choose another relationship</button>
        </div>
      </section>
    );
  }

  return (
    <section className="registration-panel" aria-labelledby="registration-title">
      <div className="registration-heading">
        <div>
          <p className="eyebrow">NEW PROPERTY REQUEST</p>
          <h1 id="registration-title">Tell us what you operate.</h1>
        </div>
        {identity ? (
          <div className="verified-identity"><span aria-hidden="true">✓</span><div><strong>Signed in</strong><small>{identity.email}</small></div></div>
        ) : (
          <button className="text-button" type="button" onClick={() => setRequesterKind("")}>← Change relationship</button>
        )}
      </div>

      {existingRequests.length > 0 ? (
        <aside className="existing-requests" aria-label="Your existing requests">
          <strong>Your recent requests</strong>
          {existingRequests.map((request) => (
            <span key={request.id}>{request.property_name} · {formatStatus(request.status)}{request.approved_plan ? ` · ${request.approved_plan}` : ""}</span>
          ))}
        </aside>
      ) : null}

      <form action={formAction} className="registration-form">
        <input type="hidden" name="requesterKind" value={requesterKind} />

        <fieldset>
          <legend><span>01</span> Your details</legend>
          <div className="form-grid two-column">
            <label>Full name<input name="contactName" defaultValue={identity?.name} required minLength={2} maxLength={120} autoComplete="name" /></label>
            <label>Email address<input name="contactEmail" type="email" defaultValue={identity?.email} readOnly={Boolean(identity)} required autoComplete="email" /></label>
            <label>Phone number<input name="contactPhone" type="tel" placeholder="+91 98765 43210" required autoComplete="tel" /></label>
            <label>WhatsApp number <small>optional</small><input name="whatsappPhone" type="tel" placeholder="Same or another number" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>02</span> Organization and property</legend>
          <div className="form-grid two-column">
            <label>Organization or group name<input name="organizationName" required minLength={2} maxLength={160} /></label>
            <label>Property name<input name="propertyName" required minLength={2} maxLength={160} /></label>
            <label>Property type<select name="propertyType" defaultValue="hotel">{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Rooms or beds<input name="roomCount" type="number" min={1} max={10000} defaultValue={20} required /></label>
            <label className="full-span">Street address<input name="addressLine" required minLength={5} maxLength={300} autoComplete="street-address" /></label>
            <label>City<input name="city" required autoComplete="address-level2" /></label>
            <label>State or region<input name="stateRegion" required autoComplete="address-level1" /></label>
            <label>Country code<input name="countryCode" defaultValue="IN" maxLength={2} required /></label>
            <label>Timezone<input name="timezone" defaultValue="Asia/Kolkata" required /></label>
            <label>Currency<input name="currencyCode" defaultValue="INR" maxLength={3} required /></label>
            <label>Plan preference<select name="requestedPlan" defaultValue="trial"><option value="trial">Start with trial</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>03</span> Workspace modules</legend>
          <p className="fieldset-copy">Request what you expect to use. The platform admin will confirm the final least-privilege set before approval.</p>
          <div className="permission-check-grid">
            {onboardingPermissions.map(([key, label, copy]) => (
              <label className="permission-check" key={key}>
                <input type="checkbox" name="requestedPermissions" value={key} defaultChecked={defaultRequestedPermissions.includes(key)} />
                <span><strong>{label}</strong><small>{copy}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend><span>04</span> Final context</legend>
          <label>Anything the review team should know? <small>optional</small><textarea name="notes" rows={4} maxLength={1000} placeholder="Opening date, multiple properties, migration requirements, or WhatsApp workflow…" /></label>
          <label className="terms-check"><input type="checkbox" name="termsAccepted" required /><span>I confirm these details are accurate and understand that access starts only after platform review.</span></label>
        </fieldset>

        {state.status === "error" ? <p className="form-message" role="alert">{state.message}</p> : null}
        <div className="registration-submit-row">
          <p>Approval creates the organization, first property, owner role, permissions, and subscription together.</p>
          <button className="button primary" disabled={isPending}>{isPending ? "Submitting securely…" : "Submit for review"}</button>
        </div>
      </form>
    </section>
  );
}
