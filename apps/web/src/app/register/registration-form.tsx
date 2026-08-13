"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight, Ban, BriefcaseBusiness, Building2, Check, CheckCircle2,
  Clock3, Copy, Home, Link2, Mail, MessageCircleMore, Phone, ShieldCheck, XCircle,
} from "lucide-react";
import { useActionState, useState } from "react";
import {
  emptyInternationalPhone,
  InternationalPhoneField,
  type InternationalPhoneValue,
} from "@/components/international-phone-field";
import {
  propertyTypes,
  requesterKinds,
  type OnboardingActionState,
} from "@/lib/onboarding";
import { submitOnboardingRequest } from "./actions";
import type { PropertyLocation } from "@/components/property-location-picker";

const PropertyLocationPicker = dynamic(() => import("@/components/property-location-picker"), { ssr: false });

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
const supportEmail = "ceoutkarshpatel@gmail.com";
const supportPhoneDisplay = "+91 89220 35716";
const supportPhoneDigits = "918922035716";

const requesterIcons = {
  property_owner: Building2,
  company_operator: BriefcaseBusiness,
} as const;

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatRequestDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function requestStatusMeta(status: string) {
  if (status === "approved") return { label: "Approved", Icon: CheckCircle2, tone: "approved", copy: "Access is ready." };
  if (status === "rejected") return { label: "Rejected", Icon: XCircle, tone: "rejected", copy: "Review is complete." };
  if (status === "revoked") return { label: "Revoked", Icon: Ban, tone: "revoked", copy: "Access has been withdrawn." };
  if (status === "under_review") return { label: "Under review", Icon: ShieldCheck, tone: "under-review", copy: "The team is checking your details." };
  return { label: formatStatus(status), Icon: Clock3, tone: "pending", copy: "Waiting for the review team." };
}

function ExistingRequestsPanel({ requests, className = "" }: { requests: ExistingRequest[]; className?: string }) {
  return (
    <aside className={`existing-requests ${className}`.trim()} aria-label="Your existing requests">
      <div className="existing-requests-heading"><strong>Your recent requests</strong><small>Live application status</small></div>
      <div className="existing-request-list">
        {requests.map((request) => {
          const status = requestStatusMeta(request.status);
          const StatusIcon = status.Icon;
          return (
            <div className="existing-request-row" key={request.id}>
              <span className={`request-status-icon ${status.tone}`} aria-hidden="true"><StatusIcon size={18} /></span>
              <div className="existing-request-copy"><strong>{request.property_name}</strong><small>{status.copy} · {formatRequestDate(request.created_at)}</small></div>
              <span className={`request-status-pill ${status.tone}`}><StatusIcon size={13} />{status.label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ActiveRequestStatus({ request }: { request: ExistingRequest }) {
  const status = requestStatusMeta(request.status);
  const StatusIcon = status.Icon;
  const whatsappMessage = encodeURIComponent(`Hi Avkarsh, I need help with my ${request.property_name} onboarding request (${request.id}).`);

  return (
    <section className="request-waiting-screen" aria-labelledby="request-waiting-title">
      <div className="request-waiting-hero">
        <span className={`request-status-pill ${status.tone}`}><StatusIcon size={15} />{status.label}</span>
        <p className="eyebrow">PROPERTY ONBOARDING</p>
        <h1 id="request-waiting-title">Your request is {request.status === "under_review" ? "being reviewed." : "in the review queue."}</h1>
        <p>We have your details for <strong>{request.property_name}</strong>. You do not need to fill the form again. We will contact you if anything else is needed.</p>
      </div>

      <div className="request-waiting-card">
        <div className="request-waiting-summary">
          <div><small>Property</small><strong>{request.property_name}</strong></div>
          <div><small>Submitted</small><strong>{formatRequestDate(request.created_at)}</strong></div>
          <div><small>Request reference</small><code>{request.id}</code></div>
        </div>

        <div className="request-contact-panel">
          <div><p className="eyebrow">NEED HELP?</p><h2>Talk to the Avkarsh team.</h2><p>For corrections, verification questions, or an urgent update, reach us directly.</p></div>
          <div className="request-contact-actions">
            <a className="button primary" href={`https://wa.me/${supportPhoneDigits}?text=${whatsappMessage}`} target="_blank" rel="noreferrer"><MessageCircleMore size={18} /> WhatsApp us</a>
            <a className="button secondary" href={`tel:+${supportPhoneDigits}`}><Phone size={18} /> {supportPhoneDisplay}</a>
            <a className="button secondary" href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Avkarsh onboarding · ${request.property_name}`)}`}><Mail size={18} /> Email us</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RegistrationForm({ identity, existingRequests }: RegistrationFormProps) {
  const [requesterKind, setRequesterKind] = useState("");
  const [contactPhone, setContactPhone] = useState<InternationalPhoneValue>(emptyInternationalPhone);
  const [whatsappPhone, setWhatsappPhone] = useState<InternationalPhoneValue>(emptyInternationalPhone);
  const [sameWhatsappNumber, setSameWhatsappNumber] = useState(false);
  const [propertyLocation, setPropertyLocation] = useState<PropertyLocation | null>(null);
  const [propertyType, setPropertyType] = useState("hotel");
  const [copiedReference, setCopiedReference] = useState(false);
  const inventoryUnit = ["hostel", "dormitory"].includes(propertyType) ? "beds" : "rooms";
  const [state, formAction, isPending] = useActionState(submitOnboardingRequest, initialState);
  const activeRequest = existingRequests.find((request) => request.status === "pending" || request.status === "under_review");

  if (activeRequest && state.status !== "success") {
    return <ActiveRequestStatus request={activeRequest} />;
  }

  if (state.status === "success") {
    return (
      <section className="registration-success" aria-labelledby="request-received-title">
        <div className="success-hero">
          <span className="success-mark" aria-hidden="true"><Check size={28} strokeWidth={2.6} /></span>
          <p className="eyebrow">REQUEST RECEIVED</p>
          <h1 id="request-received-title">Your property is now in review.</h1>
          <p>{state.message}</p>
          <div className="success-current-status">
            <span aria-hidden="true"><Clock3 size={20} /></span>
            <div><small>Current status</small><strong>Pending review</strong></div>
          </div>
        </div>

        <div className="success-summary-card">
          <div className="success-summary-heading">
            <span aria-hidden="true"><ShieldCheck size={21} /></span>
            <div><strong>Request saved securely</strong><small>Keep this reference for future communication.</small></div>
          </div>
          <div className="request-reference">
            <div><small>Request reference</small><code>{state.requestId}</code></div>
            <button
              type="button"
              aria-label="Copy request reference"
              onClick={async () => {
                if (!state.requestId) return;
                try {
                  await navigator.clipboard.writeText(state.requestId);
                  setCopiedReference(true);
                  window.setTimeout(() => setCopiedReference(false), 1800);
                } catch {
                  setCopiedReference(false);
                }
              }}
            >
              {copiedReference ? <Check size={18} /> : <Copy size={18} />}
              <span>{copiedReference ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <div className="review-timeline" aria-label="What happens next">
            <div className="complete"><span><Check size={14} /></span><div><strong>Request received</strong><small>Your details are safely recorded.</small></div></div>
            <div className="active"><span>2</span><div><strong>Admin review</strong><small>We verify the property and discuss requirements.</small></div></div>
            <div><span>3</span><div><strong>Access decision</strong><small>You will see approved or rejected status here.</small></div></div>
          </div>
          <p className="success-note">No further action is needed right now. We will contact you if any detail needs clarification.</p>
          <div className="success-actions">
            {identity ? <Link className="button primary" href="/app">View request status <ArrowRight size={17} /></Link> : (
              <Link className="button primary" href="/sign-in?next=/register">Sign in to track status <ArrowRight size={17} /></Link>
            )}
            <Link className="button secondary" href="/"><Home size={17} /> Back home</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!requesterKind) {
    const revokedRequests = existingRequests.filter((request) => request.status === "revoked");
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
        {revokedRequests.length > 0 ? <ExistingRequestsPanel requests={revokedRequests} /> : null}
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

      <form action={formAction} className="registration-form">
        <input type="hidden" name="requesterKind" value={requesterKind} />
        <input type="hidden" name="latitude" value={propertyLocation?.lat ?? ""} />
        <input type="hidden" name="longitude" value={propertyLocation?.lng ?? ""} />
        <input type="hidden" name="addressLine" value={propertyLocation?.addressLine ?? ""} />
        <input type="hidden" name="city" value={propertyLocation?.city ?? ""} />
        <input type="hidden" name="stateRegion" value={propertyLocation?.stateRegion ?? ""} />
        <input type="hidden" name="countryCode" value={propertyLocation?.countryCode ?? ""} />
        <input type="hidden" name="timezone" value={propertyLocation?.timezone ?? ""} />
        <input type="hidden" name="currencyCode" value="XXX" />
        <input type="hidden" name="inventoryUnit" value={inventoryUnit} />

        <fieldset>
          <legend><span>01</span> Your details</legend>
          <div className="form-grid two-column">
            <label>Full name<input name="contactName" defaultValue={identity?.name} required minLength={2} maxLength={120} autoComplete="name" /></label>
            <label>Email address<input name="contactEmail" type="email" defaultValue={identity?.email} readOnly={Boolean(identity)} required autoComplete="email" /></label>
            <InternationalPhoneField label="Phone number" name="contactPhone" value={contactPhone} onValueChange={setContactPhone} />
            <div className="phone-with-copy">
              <InternationalPhoneField
                label="WhatsApp number"
                name="whatsappPhone"
                optional
                disabled={sameWhatsappNumber}
                value={sameWhatsappNumber ? contactPhone : whatsappPhone}
                onValueChange={setWhatsappPhone}
              />
              <label className="same-phone-check">
                <input
                  type="checkbox"
                  checked={sameWhatsappNumber}
                  onChange={(event) => setSameWhatsappNumber(event.target.checked)}
                />
                <span>Same as phone number</span>
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>02</span> Organization and property</legend>
          <div className="form-grid two-column">
            <label>Organization or group name<input name="organizationName" required minLength={2} maxLength={160} /></label>
            <label>Property name<input name="propertyName" required minLength={2} maxLength={160} /></label>
            <label>Property type<select name="propertyType" value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>{propertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>
              Total {inventoryUnit}
              <small>{inventoryUnit === "beds" ? "Count beds that can be allotted separately." : "Count independently bookable rooms."}</small>
              <input name="roomCount" type="number" min={1} max={10000} defaultValue={20} required />
            </label>
            <div className="full-span"><PropertyLocationPicker value={propertyLocation} onChange={setPropertyLocation} /></div>
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
