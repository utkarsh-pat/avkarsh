alter table public.onboarding_requests
  drop constraint onboarding_requests_property_type_check;

alter table public.onboarding_requests
  add constraint onboarding_requests_property_type_check
  check (property_type in (
    'hotel', 'hostel', 'dormitory', 'resort', 'guest_house',
    'serviced_apartment', 'homestay', 'other'
  )),
  add column inventory_unit text not null default 'rooms',
  add constraint onboarding_requests_inventory_unit_check
  check (inventory_unit in ('rooms', 'beds'));

update public.onboarding_requests
set inventory_unit = 'beds'
where property_type = 'hostel';

comment on column public.onboarding_requests.room_count is
  'Total sellable inventory count; interpret using inventory_unit.';
comment on column public.onboarding_requests.inventory_unit is
  'Whether room_count represents rooms or individually allocated beds.';
