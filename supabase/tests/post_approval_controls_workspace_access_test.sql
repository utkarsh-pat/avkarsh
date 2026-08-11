begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_function(
  'public', 'update_provisioned_tenant_controls', array['uuid', 'jsonb'],
  'post-approval controls mutation exists'
);
select has_function(
  'public', 'get_property_workspace_access', array['uuid'],
  'property workspace access resolver exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'controls-admin@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Controls Admin"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '52000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'workspace-owner@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Workspace Owner"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '53000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'workspace-outsider@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Workspace Outsider"}', now(), now()
  );

insert into public.platform_admins (
  profile_id, admin_role, permissions, assigned_by_actor_id
) values (
  '51000000-0000-0000-0000-000000000005', 'super_admin', '{}',
  '51000000-0000-0000-0000-000000000005'
);

insert into public.onboarding_requests (
  id, requester_profile_id, requester_kind, contact_name, contact_email, contact_phone,
  organization_name, property_name, property_type, room_count,
  address_line, city, state_region, country_code, timezone, currency_code,
  requested_plan, requested_permissions, status
) values (
  '54000000-0000-0000-0000-000000000005',
  '52000000-0000-0000-0000-000000000005', 'property_owner', 'Workspace Owner',
  'workspace-owner@example.test', '+91 95555 55555', 'Workspace Hotels', 'Workspace Hotel',
  'hotel', 18, '5 Test Road', 'Pune', 'Maharashtra', 'IN', 'Asia/Kolkata', 'INR',
  'starter', array['dashboard.view', 'reservation.manage', 'guest.manage'], 'pending'
);

set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000005","email":"controls-admin@example.test","role":"authenticated"}';

select lives_ok(
  $$select public.review_onboarding_request(
    '54000000-0000-0000-0000-000000000005', 'approve',
    '{
      "reason":"Initial workspace approval",
      "permissions":["dashboard.view","reservation.manage","guest.manage"],
      "plan":"starter","billing_cycle":"monthly","amount_minor":199900,
      "currency_code":"INR","trial_days":0,"property_limit":1,"staff_limit":10
    }'::jsonb
  )$$,
  'admin can provision the tenant used by workspace tests'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '52000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"52000000-0000-0000-0000-000000000005","email":"workspace-owner@example.test","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint
    from public.get_property_workspace_access(
      (select property_id from public.onboarding_requests
       where id = '54000000-0000-0000-0000-000000000005')
    ) where allowed$$,
  array[3::bigint],
  'workspace exposes exactly the initially approved modules'
);

select results_eq(
  $$select decision
    from public.get_property_workspace_access(
      (select property_id from public.onboarding_requests
       where id = '54000000-0000-0000-0000-000000000005')
    ) where permission_key = 'payment.manage'$$,
  array['no_allow'::text],
  'unapproved workspace modules fail closed with a resolver decision'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000005","email":"controls-admin@example.test","role":"authenticated"}';

select lives_ok(
  $$select public.update_provisioned_tenant_controls(
    '54000000-0000-0000-0000-000000000005',
    '{
      "reason":"Enable finance and reporting for the upgraded tenant",
      "permissions":["dashboard.view","payment.manage","reports.read","subscription.read"],
      "plan":"growth","billing_cycle":"annual","amount_minor":4999000,
      "currency_code":"INR","trial_days":21,"property_limit":4,"staff_limit":40
    }'::jsonb
  )$$,
  'platform admin can update post-approval permissions and subscription controls'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.role_permissions role_permissions
    join public.roles roles on roles.id = role_permissions.role_id
    where roles.organization_id = (
      select organization_id from public.onboarding_requests
      where id = '54000000-0000-0000-0000-000000000005'
    ) and role_permissions.effect = 'allow'$$,
  array[4::bigint],
  'control update replaces the tenant role permission set exactly'
);

select results_eq(
  $$select array_agg(role_permissions.permission_key order by role_permissions.permission_key)
    from public.role_permissions role_permissions
    join public.roles roles on roles.id = role_permissions.role_id
    where roles.organization_id = (
      select organization_id from public.onboarding_requests
      where id = '54000000-0000-0000-0000-000000000005'
    ) and role_permissions.effect = 'allow'$$,
  $$values (array['dashboard.view', 'payment.manage', 'reports.read', 'subscription.read']::text[])$$,
  'only the newly selected permissions remain on the tenant role'
);

select results_eq(
  $$select count(*)::bigint
    from public.organization_subscriptions
    where organization_id = (
      select organization_id from public.onboarding_requests
      where id = '54000000-0000-0000-0000-000000000005'
    )
      and plan_code = 'growth'
      and status = 'trialing'
      and billing_cycle = 'annual'
      and amount_minor = 4999000
      and currency_code = 'INR'
      and property_limit = 4
      and staff_limit = 40
      and trial_ends_at is not null$$,
  array[1::bigint],
  'commercial subscription controls are updated atomically'
);

set local role authenticated;
set local request.jwt.claim.sub = '52000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"52000000-0000-0000-0000-000000000005","email":"workspace-owner@example.test","role":"authenticated"}';

select results_eq(
  $$select array_agg(permission_key order by permission_key)
    from public.get_property_workspace_access(
      (select property_id from public.onboarding_requests
       where id = '54000000-0000-0000-0000-000000000005')
    ) where allowed$$,
  $$values (array['dashboard.view', 'payment.manage', 'reports.read', 'subscription.read']::text[])$$,
  'owner workspace immediately reflects the revised resolver permissions'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '53000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"53000000-0000-0000-0000-000000000005","email":"workspace-outsider@example.test","role":"authenticated"}';

select is_empty(
  $$select * from public.get_property_workspace_access(
    (select property_id from public.onboarding_requests
     where id = '54000000-0000-0000-0000-000000000005')
  )$$,
  'outsider receives no workspace rows for an RLS-hidden property'
);

select throws_ok(
  $$select public.update_provisioned_tenant_controls(
    '54000000-0000-0000-0000-000000000005',
    '{"reason":"Unauthorized change","permissions":["dashboard.view"]}'::jsonb
  )$$,
  '42501', 'platform permission denied',
  'ordinary authenticated users cannot change tenant controls'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000005","email":"controls-admin@example.test","role":"authenticated"}';

select lives_ok(
  $$select public.set_onboarding_organization_access(
    '54000000-0000-0000-0000-000000000005', 'revoke', 'Commercial review hold'
  )$$,
  'platform admin can revoke the updated tenant'
);

select lives_ok(
  $$select public.update_provisioned_tenant_controls(
    '54000000-0000-0000-0000-000000000005',
    '{
      "reason":"Prepare reduced package while access remains revoked",
      "permissions":["dashboard.view","subscription.read"],
      "plan":"starter","billing_cycle":"monthly","amount_minor":99900,
      "currency_code":"INR","trial_days":0,"property_limit":1,"staff_limit":5
    }'::jsonb
  )$$,
  'commercial controls can be prepared while tenant access remains revoked'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.onboarding_requests requests
    join public.organizations organizations on organizations.id = requests.organization_id
    join public.organization_subscriptions subscriptions
      on subscriptions.organization_id = requests.organization_id
    where requests.id = '54000000-0000-0000-0000-000000000005'
      and requests.status = 'revoked'
      and organizations.lifecycle_state = 'suspended'
      and subscriptions.status = 'revoked'
      and subscriptions.plan_code = 'starter'
      and subscriptions.amount_minor = 99900$$,
  array[1::bigint],
  'post-approval edits preserve revoked tenant and subscription state'
);

select results_eq(
  $$select count(*)::bigint from audit.events
    where organization_id = (
      select organization_id from public.onboarding_requests
      where id = '54000000-0000-0000-0000-000000000005'
    )$$,
  array[4::bigint],
  'approval, two control updates, and revocation are fully audited'
);

select * from finish();
rollback;
