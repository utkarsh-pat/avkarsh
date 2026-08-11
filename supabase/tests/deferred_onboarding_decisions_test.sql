begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select lives_ok(
  $$
    insert into public.onboarding_requests (
      requester_kind, contact_name, contact_email, contact_phone,
      organization_name, property_name, property_type, room_count,
      address_line, city, state_region, country_code, timezone, currency_code
    ) values (
      'property_owner', 'Simple Owner', 'simple.owner@example.com', '+919876543210',
      'Simple Hotels', 'Simple Residency', 'hotel', 24,
      '12 Station Road', 'Jaipur', 'Rajasthan', 'IN', 'Asia/Kolkata', 'INR'
    )
  $$,
  'a first enquiry does not require customer plan or module choices'
);

select results_eq(
  $$
    select requested_plan
    from public.onboarding_requests
    where contact_email = 'simple.owner@example.com'
  $$,
  $$ values ('pending_admin_review'::text) $$,
  'new enquiries defer the plan decision to platform review'
);

select results_eq(
  $$
    select requested_permissions
    from public.onboarding_requests
    where contact_email = 'simple.owner@example.com'
  $$,
  $$ values ('{}'::text[]) $$,
  'new enquiries begin without a customer-selected permission scope'
);

select * from finish();
rollback;
