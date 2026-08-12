"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, Link2 } from "lucide-react";
import { useActionState, useState } from "react";
import { InternationalPhoneField } from "@/components/international-phone-field";
import {
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

const requesterIcons = {
  property_owner: Building2,
  company_operator: BriefcaseBusiness,
} as const;

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function RegistrationForm({ identity, existingRequests }: RegistrationFormProps) {
  const [requesterKind, setRequesterKind] = useState("");
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
        <h1 id="identity-step-title">First, tell us who you are.</h1>
        <p className="registration-lede">Start a new property request as its owner or company operator. All other roles are assigned through a secure invitation.</p>
        {identity ? (
          <div className="role-identity" aria-label="Signed-in identity">
            <span aria-hidden="true">✓</span>
            <div><strong>{identity.name || "Signed-in user"}</strong><small>{identity.email}</small></div>
          </div>
        ) : null}
        {existingRequests.length > 0 ? (
          <aside className="existing-requests role-step-requests" aria-label="Your existing requests">
            <strong>Your recent requests</strong>
            {existingRequests.map((request) => (
              <span key={request.id}>{request.property_name} · {formatStatus(request.status)}{request.approved_plan ? ` · ${request.approved_plan}` : ""}</span>
            ))}
          </aside>
        ) : null}
        <div className="identity-grid">
          {requesterKinds.map((kind) => {
            const RoleIcon = requesterIcons[kind.value];
            return (
              <button className="identity-option" type="button" key={kind.value} onClick={() => setRequesterKind(kind.value)}>
                <span className="identity-option-icon" aria-hidden="true"><RoleIcon size={22} strokeWidth={1.8} /></span>
                <span className="identity-option-label">{kind.label}</span>
                <small>{kind.copy}</small>
                <ArrowRight className="identity-option-arrow" size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <aside className="invitation-only-note" aria-label="Invitation-only access">
          <span className="identity-option-icon" aria-hidden="true"><Link2 size={21} strokeWidth={1.8} /></span>
          <div>
            <strong>Joining as staff, partner, or another role?</strong>
            <p>Open the invitation link sent by your property administrator. Your role, property, and permissions are already attached to that link.</p>
          </div>
        </aside>
        <p className="existing-user-copy">Already approved? <Link href="/sign-in?next=/app">Sign in to your workspace</Link></p>
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
            <InternationalPhoneField label="Phone number" name="contactPhone" />
            <InternationalPhoneField label="WhatsApp number" name="whatsappPhone" optional />
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
          </div>
        </fieldset>

        <fieldset>
          <legend><span>03</span> Final context</legend>
          <label>Anything the review team should know? <small>optional</small><textarea name="notes" rows={4} maxLength={1000} placeholder="Opening date, multiple properties, migration requirements, or WhatsApp workflow…" /></label>
          <label className="terms-check"><input type="checkbox" name="termsAccepted" required /><span>I confirm these details are accurate and understand that access starts only after platform review.</span></label>
        </fieldset>

        {state.status === "error" ? <p className="form-message" role="alert">{state.message}</p> : null}
        <div className="registration-submit-row">
          <p>Our team will discuss your needs, then configure the right access and commercial terms before approval.</p>
          <button className="button primary" disabled={isPending}>{isPending ? "Submitting securely…" : "Submit for review"}</button>
        </div>
      </form>
    </section>
  );
}
