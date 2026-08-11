begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

select has_function(
  'public', 'create_property_staff_invitation', array['uuid', 'text', 'text[]', 'integer'],
  'property staff invitation creation RPC exists'
);
select has_function(
  'public', 'claim_property_staff_invitation', array['text'],
  'Google identity invitation claim RPC exists'
);
select has_function(
  'public', 'review_property_staff_invitation', array['uuid', 'text', 'text'],
  'owner invitation review RPC exists'
);
select has_function(
  'public', 'set_property_team_member_access', array['uuid', 'uuid', 'text', 'text'],
  'property team suspension RPC exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '61000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'invite-admin@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Invite Platform Admin"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '62000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'team-owner@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Team Owner"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '63000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'staff-member@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Staff Member"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '64000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'wrong-member@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Wrong Member"}', now(), now()
  );

insert into public.platform_admins (
  profile_id, admin_role, permissions, assigned_by_actor_id
) values (
  '61000000-0000-0000-0000-000000000006', 'super_admin', '{}',
  '61000000-0000-0000-0000-000000000006'
);

insert into public.onboarding_requests (
  id, requester_profile_id, requester_kind, contact_name, contact_email, contact_phone,
  organization_name, property_name, property_type, room_count,
  address_line, city, state_region, country_code, timezone, currency_code,
  requested_plan, requested_permissions, status
) values (
  '65000000-0000-0000-0000-000000000006',
  '62000000-0000-0000-0000-000000000006', 'property_owner', 'Team Owner',
  'team-owner@example.test', '+91 94444 44444', 'Invitation Hotels', 'Invitation Hotel',
  'hotel', 30, '6 Test Road', 'Mumbai', 'Maharashtra', 'IN', 'Asia/Kolkata', 'INR',
  'growth', array['dashboard.view', 'reservation.manage', 'payment.manage', 'staff.manage'], 'pending'
);

set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"61000000-0000-0000-0000-000000000006","email":"invite-admin@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select lives_ok(
  $$select public.review_onboarding_request(
    '65000000-0000-0000-0000-000000000006', 'approve',
    '{
      "reason":"Provision invitation test tenant",
      "permissions":["dashboard.view","reservation.manage","payment.manage","staff.manage"],
      "plan":"growth","billing_cycle":"monthly","amount_minor":499900,
      "currency_code":"INR","trial_days":0,"property_limit":1,"staff_limit":10
    }'::jsonb
  )$$,
  'test tenant is provisioned with staff delegation permission'
);

reset role;
create temporary table invitation_capture (invitation_id uuid, raw_token text);
create temporary table tenant_capture (organization_id uuid, property_id uuid);
insert into tenant_capture
select organization_id, property_id from public.onboarding_requests
where id = '65000000-0000-0000-0000-000000000006';
grant all on invitation_capture to authenticated;
grant select on tenant_capture to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '62000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-000000000006","email":"team-owner@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select lives_ok(
  $$insert into invitation_capture
    select * from public.create_property_staff_invitation(
      (select property_id from tenant_capture),
      'staff-member@example.test',
      array['dashboard.view', 'reservation.manage', 'payment.manage'],
      7
    )$$,
  'owner can create a property-scoped invitation with delegated permissions'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.membership_invitations invitations
    cross join invitation_capture capture
    where invitations.id = capture.invitation_id
      and invitations.token_hash <> capture.raw_token
      and invitations.token_hash = encode(digest(capture.raw_token, 'sha256'), 'hex')
      and invitations.intended_email_hash = encode(digest('staff-member@example.test', 'sha256'), 'hex')$$,
  array[1::bigint],
  'only token and intended-email hashes are persisted'
);

set local role authenticated;
set local request.jwt.claim.sub = '64000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"64000000-0000-0000-0000-000000000006","email":"wrong-member@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select throws_ok(
  $$select public.claim_property_staff_invitation((select raw_token from invitation_capture))$$,
  '42501', 'invitation email does not match this identity',
  'forwarded token cannot be claimed by a different Google identity'
);

select throws_ok(
  $$select * from public.get_property_team_members(
    (select property_id from tenant_capture)
  )$$,
  '42501', 'staff management permission denied',
  'ordinary authenticated users cannot enumerate a property team'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '63000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"63000000-0000-0000-0000-000000000006","email":"staff-member@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select lives_ok(
  $$select public.claim_property_staff_invitation((select raw_token from invitation_capture))$$,
  'matching Google identity can claim the invitation'
);

reset role;

select results_eq(
  $$select count(*)::bigint from public.organization_memberships
    where profile_id = '63000000-0000-0000-0000-000000000006'$$,
  array[0::bigint],
  'claiming alone creates no membership or tenant access'
);

set local role authenticated;
set local request.jwt.claim.sub = '62000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-000000000006","email":"team-owner@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select results_eq(
  $$select status from public.get_property_staff_invitations(
    (select property_id from tenant_capture)
  ) where invitation_id = (select invitation_id from invitation_capture)$$,
  array['claimed'::text],
  'owner sees the claimed identity waiting for approval'
);

select lives_ok(
  $$select public.review_property_staff_invitation(
    (select invitation_id from invitation_capture), 'approve', 'Identity confirmed with the staff member'
  )$$,
  'owner can approve the claimed identity'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.organization_memberships organization_memberships
    join public.property_memberships property_memberships
      on property_memberships.organization_membership_id = organization_memberships.id
    join public.property_membership_roles property_membership_roles
      on property_membership_roles.property_membership_id = property_memberships.id
    where organization_memberships.profile_id = '63000000-0000-0000-0000-000000000006'
      and organization_memberships.status = 'active'
      and property_memberships.status = 'active'$$,
  array[1::bigint],
  'approval atomically activates organization, property, and role assignment'
);

select results_eq(
  $$select array_agg(role_permissions.permission_key order by role_permissions.permission_key)
    from public.membership_invitations invitations
    join public.role_permissions on role_permissions.role_id = any(invitations.intended_role_ids)
    where invitations.id = (select invitation_id from invitation_capture)$$,
  $$values (array['dashboard.view', 'payment.manage', 'reservation.manage']::text[])$$,
  'staff receives exactly the permissions selected by the owner'
);

set local role authenticated;
set local request.jwt.claim.sub = '63000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"63000000-0000-0000-0000-000000000006","email":"staff-member@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select ok(
  private.can_access_property(
    (select property_id from tenant_capture)
  ),
  'approved staff membership makes the property RLS-visible'
);

select results_eq(
  $$select allowed from private.resolve_management_permission(
    (select organization_id from tenant_capture),
    (select property_id from tenant_capture),
    'dashboard.view', 'google'
  )$$,
  array[true],
  'approved property role resolves its delegated permission'
);

select results_eq(
  $$select array_agg(permission_key order by permission_key)
    from public.get_property_workspace_access(
      (select property_id from tenant_capture)
    ) where allowed$$,
  $$values (array['dashboard.view', 'payment.manage', 'reservation.manage']::text[])$$,
  'approved staff workspace resolves only their assigned modules'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '62000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-000000000006","email":"team-owner@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select lives_ok(
  $$select public.set_property_team_member_access(
    (select property_id from tenant_capture),
    '63000000-0000-0000-0000-000000000006', 'suspend', 'Staff member is temporarily off roster'
  )$$,
  'owner can suspend staff access to this property'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '63000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub":"63000000-0000-0000-0000-000000000006","email":"staff-member@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select is_empty(
  $$select * from public.get_property_workspace_access(
    (select property_id from tenant_capture)
  )$$,
  'suspended property membership removes workspace visibility immediately'
);

reset role;

select results_eq(
  $$select count(*)::bigint from audit.events
    where organization_id = (
      select organization_id from public.onboarding_requests
      where id = '65000000-0000-0000-0000-000000000006'
    )$$,
  array[5::bigint],
  'approval, invitation, claim, identity approval, and suspension are audited'
);

select * from finish();
rollback;
