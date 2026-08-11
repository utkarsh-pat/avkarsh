import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateInvitationForm, InvitationReviewForm, MemberAccessForm } from "./team-controls";

type PageProps = { params: Promise<{ propertyId: string }> };
type Invitation = {
  invitation_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  claimed_display_name: string | null;
  permissions: string[];
};
type TeamMember = {
  profile_id: string;
  display_name: string;
  membership_status: string;
  joined_at: string | null;
  role_names: string[];
};

const invitationDateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function pretty(value: string) {
  return value.replaceAll("_", " ").replaceAll(".", " · ").replace(/^./, (letter) => letter.toUpperCase());
}

export default async function PropertyTeamPage({ params }: PageProps) {
  if (!getSupabasePublicConfig()) redirect("/app");
  const { propertyId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/sign-in?next=/app/property/${propertyId}/team`);

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, name, code")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) throw new Error("Property team context could not be loaded.");
  if (!property) notFound();

  const [membersResult, invitationsResult] = await Promise.all([
    supabase.rpc("get_property_team_members", { target_property_id: propertyId }),
    supabase.rpc("get_property_staff_invitations", { target_property_id: propertyId }),
  ]);
  if (membersResult.error?.code === "42501" || invitationsResult.error?.code === "42501") redirect(`/app/property/${propertyId}`);

  const members = (membersResult.data ?? []) as TeamMember[];
  const invitations = (invitationsResult.data ?? []) as Invitation[];
  const currentProfileId = typeof claimsData.claims.sub === "string" ? claimsData.claims.sub : "";

  return (
    <main className="property-shell">
      <header className="property-topbar"><Link className="brand" href="/">Avkarsh</Link><div className="property-identity"><span>{property.code}</span><p>Team access</p></div></header>
      <section className="property-dashboard team-dashboard" aria-labelledby="team-title">
        <Link className="back-link" href={`/app/property/${propertyId}`}>← Back to workspace</Link>
        <div className="property-hero"><div><p className="eyebrow">PROPERTY RBAC</p><h1 id="team-title">{property.name} team</h1><p className="property-organization">Invite, verify, approve, suspend, and restore property-scoped access.</p></div><span className="lifecycle-badge">{members.length} members</span></div>

        {(membersResult.error || invitationsResult.error) ? <p className="form-message" role="alert">Some team access data could not be loaded.</p> : null}

        <section className="team-panel" aria-labelledby="invite-title">
          <div className="admin-section-heading"><div><p className="eyebrow">SECURE INVITATION</p><h2 id="invite-title">Invite property staff</h2></div><p>The link can only be claimed by the matching Google email. Claiming still requires your approval.</p></div>
          <CreateInvitationForm propertyId={propertyId} />
        </section>

        <section className="team-panel" aria-labelledby="invitations-title">
          <div className="admin-section-heading"><div><p className="eyebrow">IDENTITY REVIEW</p><h2 id="invitations-title">Invitations</h2></div><p>{invitations.length} invitation records</p></div>
          {invitations.length === 0 ? <div className="admin-empty"><h3>No invitations yet.</h3></div> : (
            <div className="team-record-list">
              {invitations.map((invitation) => (
                <article className="team-record" key={invitation.invitation_id}>
                  <div className="team-record-heading"><div><strong>{invitation.claimed_display_name ?? "Unclaimed invitation"}</strong><small>Expires {invitationDateTime.format(new Date(invitation.expires_at))}</small></div><span className={`status-pill ${invitation.status}`}>{pretty(invitation.status)}</span></div>
                  <div className="approved-permissions">{invitation.permissions.map((permission) => <span key={permission}>{pretty(permission)}</span>)}</div>
                  <InvitationReviewForm propertyId={propertyId} invitationId={invitation.invitation_id} status={invitation.status} />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="team-panel" aria-labelledby="members-title">
          <div className="admin-section-heading"><div><p className="eyebrow">ACTIVE ACCESS</p><h2 id="members-title">Property members</h2></div><p>Suspension takes effect on the next database authorization check.</p></div>
          <div className="team-record-list">
            {members.map((member) => (
              <article className="team-record" key={member.profile_id}>
                <div className="team-record-heading"><div><strong>{member.display_name}</strong><small>{member.role_names.length ? member.role_names.join(" · ") : "Organization-level access"}</small></div><span className={`status-pill ${member.membership_status}`}>{pretty(member.membership_status)}</span></div>
                {member.profile_id !== currentProfileId ? <MemberAccessForm propertyId={propertyId} profileId={member.profile_id} status={member.membership_status} /> : <small className="team-self-note">This is your own session. Self-access changes are blocked.</small>}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
