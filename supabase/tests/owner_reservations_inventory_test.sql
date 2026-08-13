begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'inventory_units', 'sellable inventory table exists');
select has_table('public', 'reservations', 'reservation table exists');
select has_table('public', 'reservation_allocations', 'allocation table exists');

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.inventory_units'::regclass,
     'public.reservations'::regclass,
     'public.reservation_allocations'::regclass
   )),
  'all reservation tables enable RLS'
);

select ok(
  not has_table_privilege('anon', 'public.inventory_units', 'SELECT')
  and not has_table_privilege('anon', 'public.reservations', 'SELECT')
  and not has_table_privilege('anon', 'public.reservation_allocations', 'SELECT'),
  'anonymous clients cannot access reservation data'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'inventory-owner@example.test', 'not-real', now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'inventory-outsider@example.test', 'not-real', now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory Outsider"}', now(), now());

insert into public.organizations (id, name, slug, lifecycle_state, created_by_actor_id)
values ('73000000-0000-0000-0000-000000000007', 'Inventory Hotels', 'inventory-hotels', 'active', '71000000-0000-0000-0000-000000000007');

insert into public.properties (id, organization_id, name, code, timezone, currency_code, property_type, inventory_unit, created_by_actor_id)
values
  ('74000000-0000-0000-0000-000000000007', '73000000-0000-0000-0000-000000000007', 'Inventory Hotel', 'INV1', 'Asia/Kolkata', 'INR', 'hotel', 'rooms', '71000000-0000-0000-0000-000000000007'),
  ('75000000-0000-0000-0000-000000000007', '73000000-0000-0000-0000-000000000007', 'Inventory Dormitory', 'INV2', 'Asia/Kolkata', 'INR', 'dormitory', 'beds', '71000000-0000-0000-0000-000000000007');

insert into public.organization_memberships (id, organization_id, profile_id, status, joined_at)
values ('76000000-0000-0000-0000-000000000007', '73000000-0000-0000-0000-000000000007', '71000000-0000-0000-0000-000000000007', 'active', now());

insert into public.property_memberships (id, organization_id, organization_membership_id, property_id, status)
values ('77000000-0000-0000-0000-000000000007', '73000000-0000-0000-0000-000000000007', '76000000-0000-0000-0000-000000000007', '74000000-0000-0000-0000-000000000007', 'active');

insert into public.property_permission_overrides (property_membership_id, permission_key, effect, reason, granted_by_actor_id)
values
  ('77000000-0000-0000-0000-000000000007', 'reservation.manage', 'allow', 'Reservation test access', '71000000-0000-0000-0000-000000000007'),
  ('77000000-0000-0000-0000-000000000007', 'whatsapp.manage', 'allow', 'WhatsApp media test access', '71000000-0000-0000-0000-000000000007');

insert into public.whatsapp_conversations (
  id, organization_id, property_id, whatsapp_phone, guest_name, state, status
) values (
  '79000000-0000-0000-0000-000000000007',
  '73000000-0000-0000-0000-000000000007',
  '74000000-0000-0000-0000-000000000007',
  '+919876543219', 'WhatsApp Guest', 'direct_chat', 'active'
);

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000007';
set local request.jwt.claims = '{"sub":"71000000-0000-0000-0000-000000000007","email":"inventory-owner@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select lives_ok(
  $$insert into public.inventory_units (id, organization_id, property_id, unit_code, display_name, unit_kind, category, max_occupancy, nightly_rate_minor)
    values ('78000000-0000-0000-0000-000000000007', '73000000-0000-0000-0000-000000000007', '74000000-0000-0000-0000-000000000007', '101', 'Room 101', 'room', 'Deluxe', 3, 250000)$$,
  'authorized owner can add matching room inventory'
);

select ok(
  private.can_manage_whatsapp_media(
    '74000000-0000-0000-0000-000000000007/79000000-0000-0000-0000-000000000007/test-image.jpg'
  ),
  'authorized owner can access media inside the property conversation path'
);

select throws_ok(
  $$insert into public.inventory_units (organization_id, property_id, unit_code, display_name, unit_kind)
    values ('73000000-0000-0000-0000-000000000007', '74000000-0000-0000-0000-000000000007', 'B1', 'Bed 1', 'bed')$$,
  '23514', null,
  'room property rejects bed inventory'
);

select lives_ok(
  $$select public.create_property_reservation(
    '74000000-0000-0000-0000-000000000007', '78000000-0000-0000-0000-000000000007',
    'First Guest', '+919876543210', '2026-09-01', '2026-09-03', 2, 0, 'front_desk', null
  )$$,
  'owner can create a valid room reservation'
);

select results_eq(
  $$select booked_amount_minor from public.reservations where primary_guest_name = 'First Guest'$$,
  array[500000::bigint],
  'reservation captures real gross revenue from nightly rate and stay length'
);

select throws_ok(
  $$select public.create_property_reservation(
    '74000000-0000-0000-0000-000000000007', '78000000-0000-0000-0000-000000000007',
    'Overlap Guest', '+919876543211', '2026-09-02', '2026-09-04', 1, 0, 'phone', null
  )$$,
  '23P01', null,
  'database blocks overlapping allocation'
);

select throws_ok(
  $$select public.create_property_reservation(
    '74000000-0000-0000-0000-000000000007', '78000000-0000-0000-0000-000000000007',
    'Crowded Guest', '+919876543212', '2026-09-05', '2026-09-06', 4, 0, 'phone', null
  )$$,
  '23514', null,
  'guest count cannot exceed unit capacity'
);

select lives_ok(
  $$select public.cancel_property_reservation(
    '74000000-0000-0000-0000-000000000007',
    (select id from public.reservations where booking_reference like 'AVK-%' limit 1)
  )$$,
  'owner can cancel a confirmed reservation'
);

select lives_ok(
  $$select public.create_property_reservation(
    '74000000-0000-0000-0000-000000000007', '78000000-0000-0000-0000-000000000007',
    'Replacement Guest', '+919876543213', '2026-09-02', '2026-09-04', 1, 0, 'phone', null
  )$$,
  'cancelled allocation releases the room dates'
);

select results_eq(
  $$select inventory_unit from public.properties where id = '74000000-0000-0000-0000-000000000007'$$,
  array['rooms'::text],
  'hotel retains room-wise inventory context'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '72000000-0000-0000-0000-000000000007';
set local request.jwt.claims = '{"sub":"72000000-0000-0000-0000-000000000007","email":"inventory-outsider@example.test","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}';

select ok(
  not private.can_manage_whatsapp_media(
    '74000000-0000-0000-0000-000000000007/79000000-0000-0000-0000-000000000007/test-image.jpg'
  ),
  'unassigned user cannot access conversation media'
);

select results_eq(
  $$select count(*)::bigint from public.reservations$$,
  array[0::bigint],
  'unassigned user cannot enumerate reservations'
);

select * from finish();
rollback;
