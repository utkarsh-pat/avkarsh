begin;

alter table public.inventory_units
  add column nightly_rate_minor bigint not null default 0,
  add constraint inventory_units_nightly_rate_check check (nightly_rate_minor between 0 and 100000000);

alter table public.reservations
  add column booked_amount_minor bigint not null default 0,
  add constraint reservations_booked_amount_check check (booked_amount_minor between 0 and 100000000000);

create or replace function public.create_property_reservation(
  target_property_id uuid,
  target_inventory_unit_id uuid,
  guest_name text,
  guest_phone text,
  check_in_date date,
  check_out_date date,
  adult_count integer default 1,
  child_count integer default 0,
  booking_source text default 'front_desk',
  reservation_notes text default null
)
returns table (reservation_id uuid, booking_reference text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  unit_row public.inventory_units%rowtype;
  created_reservation public.reservations%rowtype;
  generated_reference text;
  stay_nights integer;
begin
  if check_in_date is null or check_out_date is null or check_out_date <= check_in_date then
    raise exception 'check-out must be after check-in' using errcode = '22007';
  end if;

  select * into unit_row
  from public.inventory_units
  where id = target_inventory_unit_id
    and property_id = target_property_id
    and status = 'available';

  if unit_row.id is null then
    raise exception 'inventory unit is not available' using errcode = '23514';
  end if;
  if adult_count < 1 or child_count < 0 or adult_count + child_count > unit_row.max_occupancy then
    raise exception 'guest count exceeds inventory capacity' using errcode = '23514';
  end if;

  stay_nights := check_out_date - check_in_date;
  generated_reference := 'AVK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.reservations (
    organization_id, property_id, booking_reference, primary_guest_name,
    primary_guest_phone, adults, children, source, status, notes,
    booked_amount_minor, created_by_profile_id
  ) values (
    unit_row.organization_id, unit_row.property_id, generated_reference, pg_catalog.btrim(guest_name),
    pg_catalog.btrim(guest_phone), adult_count, child_count, booking_source, 'confirmed',
    nullif(pg_catalog.btrim(reservation_notes), ''), unit_row.nightly_rate_minor * stay_nights,
    (select auth.uid())
  ) returning * into created_reservation;

  insert into public.reservation_allocations (
    reservation_id, inventory_unit_id, organization_id, property_id, stay_period, status
  ) values (
    created_reservation.id, unit_row.id, unit_row.organization_id, unit_row.property_id,
    daterange(check_in_date, check_out_date, '[)'), 'confirmed'
  );

  return query select created_reservation.id, created_reservation.booking_reference;
end;
$$;

revoke all on function public.create_property_reservation(uuid, uuid, text, text, date, date, integer, integer, text, text) from public, anon;
grant execute on function public.create_property_reservation(uuid, uuid, text, text, date, date, integer, integer, text, text) to authenticated;

comment on column public.inventory_units.nightly_rate_minor is 'Current nightly sell rate in the property currency, stored in minor units.';
comment on column public.reservations.booked_amount_minor is 'Gross room or bed revenue captured when the reservation is created; not a payment ledger.';

commit;
