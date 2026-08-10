begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'actors', 'actors table exists');

select results_eq(
  $$select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind = 'r'
      and pg_class.relname in (
        'actors', 'profiles', 'organizations', 'properties',
        'organization_memberships', 'property_memberships', 'permissions',
        'roles', 'role_permissions', 'organization_membership_roles',
        'property_membership_roles', 'organization_permission_overrides',
        'property_permission_overrides', 'staff_members',
        'organization_lifecycle_events'
      )
      and not pg_class.relrowsecurity$$,
  array[0::bigint],
  'RLS is enabled on every public foundation table'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'owner-a@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Owner A"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'owner-b@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Owner B"}', now(), now()
  );

select results_eq(
  $$select count(*)::bigint from public.profiles
    where id in (
      '10000000-0000-0000-0000-000000000001'::uuid,
      '20000000-0000-0000-0000-000000000002'::uuid
    )$$,
  array[2::bigint],
  'auth trigger creates management profiles'
);

insert into public.organizations (id, name, slug, lifecycle_state, created_by_actor_id)
values
  ('a0000000-0000-0000-0000-000000000001', 'Organization A', 'organization-a', 'active', '10000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Organization B', 'organization-b', 'active', '20000000-0000-0000-0000-000000000002');

insert into public.properties (
  id, organization_id, name, code, timezone, currency_code, created_by_actor_id
)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Assigned Property A', 'PROPA', 'Asia/Kolkata', 'INR', '10000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Unassigned Property A', 'PROPA2', 'Asia/Kolkata', 'INR', '10000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Assigned Property B', 'PROPB', 'Europe/Paris', 'EUR', '20000000-0000-0000-0000-000000000002');

insert into public.organization_memberships (
  id, organization_id, profile_id, status, joined_at
)
values
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active', now()),
  ('bb000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'active', now());

insert into public.property_memberships (
  id, organization_id, organization_membership_id, property_id, status
)
values
  ('aa100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'active'),
  ('bb100000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'active');

insert into public.roles (id, role_key, display_name, scope_type, is_system)
values ('90000000-0000-0000-0000-000000000001', 'property_manager', 'Property Manager', 'property', true);

select throws_ok(
  $$insert into public.organization_membership_roles (organization_membership_id, role_id)
    values ('aa000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001')$$,
  'P0001', 'role scope must be organization',
  'property role cannot be assigned at organization scope'
);

select throws_ok(
  $$insert into public.staff_members (actor_id, property_id, display_name, created_by_actor_id)
    values (
      '10000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-000000000001',
      'Invalid Staff',
      '10000000-0000-0000-0000-000000000001'
    )$$,
  'P0001', 'staff member must reference a staff actor',
  'management actor cannot become operational staff'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'actor_id', 'UPDATE'),
  'self-service profile grant exposes only approved columns'
);

select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'INSERT'),
  'authenticated clients cannot directly create organizations'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select results_eq(
  'select count(*)::bigint from public.actors', array[1::bigint],
  'user A sees only their management actor'
);
select results_eq(
  'select count(*)::bigint from public.organizations', array[1::bigint],
  'user A sees only organization A'
);
select results_eq(
  'select count(*)::bigint from public.properties', array[1::bigint],
  'user A sees only their assigned property'
);
select results_eq(
  $$select count(*)::bigint from public.properties
    where id = 'a2000000-0000-0000-0000-000000000002'::uuid$$,
  array[0::bigint],
  'user A cannot discover an unassigned same-organization property'
);

reset role;
update public.organization_memberships
set status = 'revoked', revoked_at = now()
where id = 'bb000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';

select results_eq(
  'select count(*)::bigint from public.organizations', array[0::bigint],
  'revoked membership denies organization access immediately'
);

reset role;
update public.organizations set lifecycle_state = 'read_only'
where id = 'a0000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select results_eq(
  'select count(*)::bigint from public.organizations', array[1::bigint],
  'read-only lifecycle preserves authorized visibility'
);

reset role;
update public.organizations
set lifecycle_state = 'suspended', previous_safe_state = 'read_only'
where id = 'a0000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select results_eq(
  'select count(*)::bigint from public.organizations', array[0::bigint],
  'suspended lifecycle blocks ordinary tenant access'
);

select * from finish();
rollback;
