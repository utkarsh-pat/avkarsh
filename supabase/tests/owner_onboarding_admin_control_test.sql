begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', 'platform_admins', 'platform admin RBAC table exists');
select has_table('public', 'onboarding_requests', 'owner onboarding request table exists');
select has_table('public', 'organization_subscriptions', 'organization subscription table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.platform_admins'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.onboarding_requests'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.organization_subscriptions'::regclass),
  'control-plane tables enable RLS'
);

select ok(
  not has_table_privilege('anon', 'public.onboarding_requests', 'SELECT')
  and has_column_privilege('anon', 'public.onboarding_requests', 'contact_email', 'INSERT')
  and has_column_privilege('anon', 'public.onboarding_requests', 'latitude', 'INSERT')
  and has_column_privilege('anon', 'public.onboarding_requests', 'longitude', 'INSERT')
  and has_column_privilege('anon', 'public.onboarding_requests', 'inventory_unit', 'INSERT')
  and not has_column_privilege('anon', 'public.onboarding_requests', 'status', 'UPDATE'),
  'anonymous applicants can submit but cannot read or process requests'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'platform@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Platform Admin"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '42000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'owner@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Hotel Owner"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '43000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'outsider@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Outsider"}', now(), now()
  );

insert into public.platform_admins (
  profile_id, admin_role, permissions, assigned_by_actor_id
) values (
  '41000000-0000-0000-0000-000000000004', 'super_admin', '{}',
  '41000000-0000-0000-0000-000000000004'
);

set local role anon;
select lives_ok(
  $$insert into public.onboarding_requests (
    id, requester_kind, contact_name, contact_email, contact_phone,
    organization_name, property_name, property_type, room_count,
    address_line, city, state_region, country_code, timezone, currency_code,
    requested_plan, requested_permissions, status
  ) values (
    '44000000-0000-0000-0000-000000000004', 'property_owner', 'Anonymous Owner',
    'anonymous@example.test', '+91 99999 99999', 'Anonymous Hotels', 'Anonymous Hotel',
    'hotel', 12, '1 Test Road', 'Delhi', 'Delhi', 'IN', 'Asia/Kolkata', 'INR',
    'trial', array['dashboard.view', 'reservation.manage'], 'pending'
  )$$,
  'anonymous owner request is accepted without granting read access'
);

reset role;

insert into public.onboarding_requests (
  id, requester_kind, contact_name, contact_email, contact_phone,
  organization_name, property_name, property_type, room_count,
  address_line, city, state_region, requested_permissions
) values (
  '46000000-0000-0000-0000-000000000004', 'property_staff', 'Property Staff',
  'staff@example.test', '+91 96666 66666', 'Staff Hotels', 'Staff Hotel',
  'hotel', 10, '4 Test Road', 'Delhi', 'Delhi', array['dashboard.view']
);

set local role authenticated;
set local request.jwt.claim.sub = '42000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"42000000-0000-0000-0000-000000000004","email":"owner@example.test","role":"authenticated"}';

select lives_ok(
  $$insert into public.onboarding_requests (
    id, requester_profile_id, requester_kind, contact_name, contact_email, contact_phone,
    organization_name, property_name, property_type, room_count,
    address_line, city, state_region, country_code, timezone, currency_code,
    requested_plan, requested_permissions, status
  ) values (
    '45000000-0000-0000-0000-000000000004',
    '42000000-0000-0000-0000-000000000004', 'property_owner', 'Hotel Owner',
    'owner@example.test', '+91 98888 88888', 'Owner Hotels', 'Owner Hotel',
    'hotel', 24, '2 Test Road', 'Jaipur', 'Rajasthan', 'IN', 'Asia/Kolkata', 'INR',
    'growth', array['dashboard.view', 'reservation.manage', 'staff.manage'], 'pending'
  )$$,
  'authenticated owner can submit only as their verified identity'
);

select throws_ok(
  $$insert into public.onboarding_requests (
    requester_profile_id, requester_kind, contact_name, contact_email, contact_phone,
    organization_name, property_name, property_type, room_count,
    address_line, city, state_region, requested_permissions
  ) values (
    '42000000-0000-0000-0000-000000000004', 'property_owner', 'Spoofed Owner',
    'different@example.test', '+91 97777 77777', 'Spoof Hotels', 'Spoof Hotel',
    'hotel', 10, '3 Test Road', 'Delhi', 'Delhi', array['dashboard.view']
  )$$,
  '42501', null,
  'authenticated requester cannot attach a different email'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '43000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"43000000-0000-0000-0000-000000000004","email":"outsider@example.test","role":"authenticated"}';

select throws_ok(
  $$select public.review_onboarding_request(
    '45000000-0000-0000-0000-000000000004', 'approve',
    '{"permissions":["dashboard.view"],"plan":"trial"}'::jsonb
  )$$,
  '42501', 'platform permission denied',
  'ordinary authenticated users cannot process requests'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-000000000004","email":"platform@example.test","role":"authenticated"}';

select throws_ok(
  $$select public.review_onboarding_request(
    '46000000-0000-0000-0000-000000000004', 'approve',
    '{"permissions":["dashboard.view"],"plan":"trial"}'::jsonb
  )$$,
  '23514', 'property staff must use an organization invitation',
  'staff requests cannot be elevated into owner provisioning'
);

select lives_ok(
  $$select public.review_onboarding_request(
    '45000000-0000-0000-0000-000000000004', 'approve',
    '{
      "reason":"Verified owner and property details",
      "permissions":["dashboard.view","reservation.manage","staff.manage"],
      "plan":"growth","billing_cycle":"monthly","amount_minor":499900,
      "currency_code":"INR","trial_days":14,"property_limit":2,"staff_limit":25
    }'::jsonb
  )$$,
  'platform super admin can transactionally approve a request'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.onboarding_requests requests
    join public.organizations on organizations.id = requests.organization_id
    join public.properties on properties.id = requests.property_id
    join public.organization_subscriptions subscriptions
      on subscriptions.organization_id = organizations.id
    where requests.id = '45000000-0000-0000-0000-000000000004'
      and requests.status = 'approved'
      and organizations.lifecycle_state = 'trial'
      and subscriptions.plan_code = 'growth'
      and subscriptions.amount_minor = 499900$$,
  array[1::bigint],
  'approval provisions request, organization, property, and subscription atomically'
);

select results_eq(
  $$select count(*)::bigint
    from public.organization_memberships memberships
    join public.organization_membership_roles membership_roles
      on membership_roles.organization_membership_id = memberships.id
    join public.roles on roles.id = membership_roles.role_id
    where memberships.profile_id = '42000000-0000-0000-0000-000000000004'
      and memberships.status = 'active'
      and roles.role_key = 'organization_owner'$$,
  array[1::bigint],
  'logged-in applicant receives the approved owner membership and role'
);

select results_eq(
  $$select count(*)::bigint
    from public.role_permissions
    join public.roles on roles.id = role_permissions.role_id
    where roles.organization_id = (
      select organization_id from public.onboarding_requests
      where id = '45000000-0000-0000-0000-000000000004'
    ) and role_permissions.effect = 'allow'$$,
  array[3::bigint],
  'only the three approved permissions are granted'
);

set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-000000000004","email":"platform@example.test","role":"authenticated"}';

select lives_ok(
  $$select public.set_onboarding_organization_access(
    '45000000-0000-0000-0000-000000000004', 'revoke', 'Subscription payment risk'
  )$$,
  'super admin can revoke the provisioned tenant'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.onboarding_requests requests
    join public.organizations on organizations.id = requests.organization_id
    join public.organization_subscriptions subscriptions
      on subscriptions.organization_id = requests.organization_id
    join public.organization_memberships memberships
      on memberships.organization_id = requests.organization_id
    where requests.id = '45000000-0000-0000-0000-000000000004'
      and requests.status = 'revoked'
      and organizations.lifecycle_state = 'suspended'
      and subscriptions.status = 'revoked'
      and memberships.status = 'suspended'$$,
  array[1::bigint],
  'revoke synchronizes tenant, subscription, and membership state'
);

set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-000000000004","email":"platform@example.test","role":"authenticated"}';

select lives_ok(
  $$select public.set_onboarding_organization_access(
    '45000000-0000-0000-0000-000000000004', 'restore', 'Payment verified and risk cleared'
  )$$,
  'super admin can restore the provisioned tenant'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.onboarding_requests requests
    join public.organizations on organizations.id = requests.organization_id
    join public.organization_subscriptions subscriptions
      on subscriptions.organization_id = requests.organization_id
    where requests.id = '45000000-0000-0000-0000-000000000004'
      and requests.status = 'approved'
      and organizations.lifecycle_state = 'trial'
      and subscriptions.status = 'trialing'$$,
  array[1::bigint],
  'restore synchronizes tenant and subscription state'
);

select results_eq(
  $$select count(*)::bigint from audit.events
    where target_id = '45000000-0000-0000-0000-000000000004'
       or organization_id = (
         select organization_id from public.onboarding_requests
         where id = '45000000-0000-0000-0000-000000000004'
       )$$,
  array[3::bigint],
  'approval, revocation, and restoration create audit events'
);

select * from finish();
rollback;
