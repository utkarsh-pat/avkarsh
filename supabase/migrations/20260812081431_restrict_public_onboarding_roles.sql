-- Public onboarding creates a new tenant and is intentionally limited to the
-- two relationships allowed to initiate that lifecycle. Every other role must
-- arrive through the property-scoped invitation flow, which binds the target
-- email, role, permissions, expiry, and inviter approval.

drop policy if exists onboarding_requests_insert_anonymous
  on public.onboarding_requests;

create policy onboarding_requests_insert_anonymous
on public.onboarding_requests for insert to anon
with check (
  requester_profile_id is null
  and requester_kind in ('property_owner', 'company_operator')
  and status = 'pending'
);

drop policy if exists onboarding_requests_insert_authenticated
  on public.onboarding_requests;

create policy onboarding_requests_insert_authenticated
on public.onboarding_requests for insert to authenticated
with check (
  requester_profile_id = (select auth.uid())
  and contact_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  and requester_kind in ('property_owner', 'company_operator')
  and status = 'pending'
);
