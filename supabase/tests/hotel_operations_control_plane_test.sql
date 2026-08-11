begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'guest_profiles', 'guest CRM table exists');
select has_table('public', 'operational_cases', 'complaint and enquiry queue exists');
select has_table('public', 'whatsapp_conversations', 'WhatsApp conversation table exists');
select has_table('public', 'whatsapp_messages', 'WhatsApp message table exists');
select has_table('public', 'ops_incidents', 'incident triage table exists');
select has_table('public', 'platform_settings', 'platform settings table exists');

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.guest_profiles'::regclass,
     'public.operational_cases'::regclass,
     'public.whatsapp_conversations'::regclass,
     'public.whatsapp_messages'::regclass,
     'public.ops_incidents'::regclass,
     'public.platform_settings'::regclass
   )),
  'all new exposed tables enable RLS'
);

select ok(
  not has_table_privilege('anon', 'public.guest_profiles', 'SELECT')
  and not has_table_privilege('anon', 'public.operational_cases', 'SELECT')
  and not has_table_privilege('anon', 'public.whatsapp_messages', 'SELECT')
  and not has_table_privilege('anon', 'public.ops_incidents', 'SELECT'),
  'anonymous clients have no hotel operations access'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'ops-admin@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Operations Admin"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '52000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'outsider-ops@example.test', 'not-real', now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Operations Outsider"}', now(), now()
  );

insert into public.platform_admins (profile_id, admin_role, permissions, assigned_by_actor_id)
values (
  '51000000-0000-0000-0000-000000000005', 'super_admin', '{}',
  '51000000-0000-0000-0000-000000000005'
);

insert into public.organizations (id, name, slug, lifecycle_state, created_by_actor_id)
values (
  '53000000-0000-0000-0000-000000000005', 'Operations Hotels',
  'operations-hotels', 'active', '51000000-0000-0000-0000-000000000005'
);

insert into public.properties (id, organization_id, name, code, timezone, currency_code, created_by_actor_id)
values
  (
    '54000000-0000-0000-0000-000000000005',
    '53000000-0000-0000-0000-000000000005', 'Operations Hotel', 'OPS1',
    'Asia/Kolkata', 'INR', '51000000-0000-0000-0000-000000000005'
  ),
  (
    '55000000-0000-0000-0000-000000000005',
    '53000000-0000-0000-0000-000000000005', 'Second Operations Hotel', 'OPS2',
    'Asia/Kolkata', 'INR', '51000000-0000-0000-0000-000000000005'
  );

insert into public.guest_profiles (
  id, organization_id, property_id, full_name, phone, email, vip_tier
) values (
  '56000000-0000-0000-0000-000000000005',
  '53000000-0000-0000-0000-000000000005',
  '54000000-0000-0000-0000-000000000005',
  'Guest Example', '+919876543210', 'guest@example.test', 'gold'
);

insert into public.operational_cases (
  organization_id, property_id, guest_profile_id, case_type, source,
  subject, description, priority
) values (
  '53000000-0000-0000-0000-000000000005',
  '54000000-0000-0000-0000-000000000005',
  '56000000-0000-0000-0000-000000000005',
  'complaint', 'whatsapp', 'Room service delay',
  'Guest has been waiting for room service assistance.', 'high'
);

insert into public.whatsapp_conversations (
  id, organization_id, property_id, guest_profile_id, whatsapp_phone,
  guest_name, state, tag, unread_count, last_message_preview, last_message_at
) values (
  '57000000-0000-0000-0000-000000000005',
  '53000000-0000-0000-0000-000000000005',
  '54000000-0000-0000-0000-000000000005',
  '56000000-0000-0000-0000-000000000005',
  '+919876543210', 'Guest Example', 'direct_chat', 'complaint', 2,
  'Please check my room service request', now()
);

insert into public.whatsapp_messages (
  conversation_id, organization_id, property_id, direction, sender_type,
  message_type, body, delivery_status
) values (
  '57000000-0000-0000-0000-000000000005',
  '53000000-0000-0000-0000-000000000005',
  '54000000-0000-0000-0000-000000000005',
  'inbound', 'guest', 'text', 'Please check my room service request', 'delivered'
);

insert into public.ops_incidents (fingerprint, severity, source, route, title, message)
values ('ops-test-fingerprint', 'critical', 'next_app', '/admin', 'Test incident', 'Test incident message');

set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000005","email":"ops-admin@example.test","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.guest_profiles$$,
  array[1::bigint],
  'super admin can read property guest profiles'
);

select results_eq(
  $$select (public.get_platform_dashboard_stats() ->> 'openCases')::bigint$$,
  array[1::bigint],
  'dashboard RPC aggregates the protected operational queue'
);

select results_eq(
  $$select email from public.get_platform_users(null, 100) where email = 'ops-admin@example.test'$$,
  array['ops-admin@example.test'::text],
  'platform user RPC exposes verified identity only to an authorized admin'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '52000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"52000000-0000-0000-0000-000000000005","email":"outsider-ops@example.test","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.guest_profiles$$,
  array[0::bigint],
  'ordinary authenticated users cannot enumerate guest PII'
);

select results_eq(
  $$select count(*)::bigint from public.ops_incidents$$,
  array[0::bigint],
  'ordinary authenticated users cannot enumerate platform incidents'
);

select results_eq(
  $$select public.get_platform_dashboard_stats() ->> 'authorized'$$,
  array['false'::text],
  'dashboard RPC fails closed for a non-platform identity'
);

select throws_ok(
  $$insert into public.whatsapp_messages (
      conversation_id, organization_id, property_id, direction, sender_type, body
    ) values (
      '57000000-0000-0000-0000-000000000005',
      '53000000-0000-0000-0000-000000000005',
      '55000000-0000-0000-0000-000000000005',
      'inbound', 'guest', 'Cross-property injection'
    )$$,
  '42501', null,
  'RLS blocks unauthorized cross-property message insertion'
);

select * from finish();
rollback;
