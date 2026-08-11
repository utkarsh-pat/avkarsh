begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'resolver@example.test', 'not-real', now(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Resolver User"}', now(), now()
);

insert into public.organizations (id, name, slug, lifecycle_state, created_by_actor_id)
values ('c0000000-0000-0000-0000-000000000003', 'Resolver Organization', 'resolver-organization', 'active', '30000000-0000-0000-0000-000000000003');

insert into public.properties (id, organization_id, name, code, timezone, currency_code, created_by_actor_id)
values
  ('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Assigned Property', 'RES1', 'Asia/Kolkata', 'INR', '30000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Unassigned Property', 'RES2', 'Asia/Kolkata', 'INR', '30000000-0000-0000-0000-000000000003');

insert into public.organization_memberships (id, organization_id, profile_id, status, joined_at)
values ('cc000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'active', now());

insert into public.property_memberships (id, organization_id, organization_membership_id, property_id, status)
values ('cc100000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'active');

insert into public.permissions (permission_key, family, description, sensitive, requires_recent_reauth)
values
  ('reports.read', 'reports', 'Read reports', false, false),
  ('booking.create', 'booking', 'Create booking', false, false),
  ('stay.checkout', 'stay', 'Check out an existing stay', false, false),
  ('stay.check_in', 'stay', 'Check in a guest', false, false),
  ('payment.refund', 'payment', 'Refund a payment', true, false),
  ('organization.transfer', 'organization', 'Transfer ownership', true, true)
on conflict (permission_key) do update
set family = excluded.family,
    description = excluded.description,
    sensitive = excluded.sensitive,
    requires_recent_reauth = excluded.requires_recent_reauth;

insert into public.roles (id, role_key, display_name, scope_type, is_system, status)
values
  ('93000000-0000-0000-0000-000000000003', 'resolver_org_role', 'Resolver Org Role', 'organization', true, 'active'),
  ('94000000-0000-0000-0000-000000000003', 'resolver_property_deny', 'Resolver Property Deny', 'property', true, 'active');

insert into public.role_permissions (role_id, permission_key, effect)
select '93000000-0000-0000-0000-000000000003', permission_key, 'allow'
from public.permissions
where permission_key in ('reports.read', 'booking.create', 'stay.checkout', 'stay.check_in', 'payment.refund', 'organization.transfer');

insert into public.role_permissions (role_id, permission_key, effect)
values ('94000000-0000-0000-0000-000000000003', 'reports.read', 'deny');

insert into public.organization_membership_roles (organization_membership_id, role_id)
values ('cc000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003');

insert into public.property_membership_roles (property_membership_id, role_id)
values ('cc100000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000003');

insert into public.role_financial_limits (role_id, permission_key, currency_code, minor_units)
values ('93000000-0000-0000-0000-000000000003', 'payment.refund', 'INR', 500000);

insert into public.property_membership_financial_limits (property_membership_id, permission_key, currency_code, minor_units, set_by_actor_id)
values ('cc100000-0000-0000-0000-000000000003', 'payment.refund', 'INR', 200000, '30000000-0000-0000-0000-000000000003');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'reports.read', 'google')$$,
  array['explicit_deny'::text],
  'property deny overrides organization allow'
);

reset role;
delete from public.property_membership_roles
where property_membership_id = 'cc100000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';

select results_eq(
  $$select allowed from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'reports.read', 'google')$$,
  array[true],
  'organization allow applies to an assigned property'
);

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000003', 'reports.read', 'google')$$,
  array['scope_denied'::text],
  'unassigned property is denied without disclosure'
);

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'payment.refund', 'device_pin')$$,
  array['authentication_ceiling'::text],
  'device PIN mode cannot elevate into a sensitive permission'
);

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', null, 'organization.transfer', 'google')$$,
  array['step_up_required'::text],
  'sensitive ownership action requires recent Google authentication'
);

select results_eq(
  $$select effective_minor_units from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'payment.refund', 'google')$$,
  array[200000::bigint],
  'minimum applicable monetary limit wins'
);

reset role;
update public.organizations set lifecycle_state = 'read_only'
where id = 'c0000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'booking.create', 'google')$$,
  array['lifecycle_denied'::text],
  'read-only lifecycle blocks new bookings'
);

select results_eq(
  $$select allowed from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'stay.checkout', 'google')$$,
  array[true],
  'read-only lifecycle preserves existing-stay checkout'
);

reset role;
update public.organizations set lifecycle_state = 'grace', grace_check_in_allowed = false
where id = 'c0000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'stay.check_in', 'google')$$,
  array['lifecycle_denied'::text],
  'grace lifecycle blocks check-in when policy is disabled'
);

reset role;
update public.organization_memberships set status = 'revoked', revoked_at = now()
where id = 'cc000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';

select results_eq(
  $$select decision from private.resolve_management_permission(
    'c0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'reports.read', 'google')$$,
  array['inactive_membership'::text],
  'revoked membership denies an otherwise valid JWT'
);

select * from finish();
rollback;
