begin;

create extension if not exists btree_gist with schema extensions;

alter table public.properties
  add column property_type text not null default 'hotel',
  add column inventory_unit text not null default 'rooms',
  add constraint properties_property_type_check check (
    property_type in ('hotel', 'hostel', 'dormitory', 'resort', 'guest_house', 'serviced_apartment', 'homestay', 'other')
  ),
  add constraint properties_inventory_unit_check check (inventory_unit in ('rooms', 'beds'));

update public.properties
set property_type = onboarding_requests.property_type,
    inventory_unit = onboarding_requests.inventory_unit
from public.onboarding_requests
where onboarding_requests.property_id = properties.id
  and onboarding_requests.status = 'approved';

create or replace function private.sync_property_inventory_context()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved' and new.property_id is not null then
    update public.properties
    set property_type = new.property_type,
        inventory_unit = new.inventory_unit
    where id = new.property_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_property_inventory_context() from public, anon, authenticated;

create trigger onboarding_requests_sync_property_inventory
after insert or update of status, property_id on public.onboarding_requests
for each row execute function private.sync_property_inventory_context();

create table public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  unit_code text not null,
  display_name text not null,
  unit_kind text not null,
  category text,
  floor_label text,
  max_occupancy smallint not null default 1,
  status text not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_units_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint inventory_units_id_scope_unique unique (id, organization_id, property_id),
  constraint inventory_units_property_code_unique unique (property_id, unit_code),
  constraint inventory_units_code_check check (unit_code ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$'),
  constraint inventory_units_name_check check (char_length(display_name) between 1 and 120),
  constraint inventory_units_kind_check check (unit_kind in ('room', 'bed')),
  constraint inventory_units_category_check check (category is null or char_length(category) between 1 and 80),
  constraint inventory_units_floor_check check (floor_label is null or char_length(floor_label) between 1 and 40),
  constraint inventory_units_occupancy_check check (max_occupancy between 1 and 50),
  constraint inventory_units_status_check check (status in ('available', 'maintenance', 'inactive')),
  constraint inventory_units_notes_check check (notes is null or char_length(notes) <= 1000)
);

create index inventory_units_property_status_idx
  on public.inventory_units (property_id, status, unit_kind, unit_code);
create index inventory_units_organization_idx on public.inventory_units (organization_id);

create or replace function private.validate_inventory_unit_kind()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_kind text;
begin
  select case properties.inventory_unit when 'beds' then 'bed' else 'room' end
  into expected_kind
  from public.properties
  where id = new.property_id
    and organization_id = new.organization_id;

  if expected_kind is null or new.unit_kind <> expected_kind then
    raise exception 'inventory unit kind does not match property allocation mode' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_inventory_unit_kind() from public, anon, authenticated;
create trigger inventory_units_validate_kind
before insert or update of property_id, organization_id, unit_kind on public.inventory_units
for each row execute function private.validate_inventory_unit_kind();

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  guest_profile_id uuid,
  booking_reference text not null,
  primary_guest_name text not null,
  primary_guest_phone text not null,
  adults smallint not null default 1,
  children smallint not null default 0,
  source text not null default 'front_desk',
  status text not null default 'confirmed',
  notes text,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint reservations_guest_fkey foreign key (guest_profile_id, organization_id, property_id)
    references public.guest_profiles(id, organization_id, property_id) on delete restrict,
  constraint reservations_id_scope_unique unique (id, organization_id, property_id),
  constraint reservations_property_reference_unique unique (property_id, booking_reference),
  constraint reservations_reference_check check (booking_reference ~ '^[A-Z0-9][A-Z0-9-]{5,31}$'),
  constraint reservations_guest_name_check check (char_length(primary_guest_name) between 2 and 160),
  constraint reservations_guest_phone_check check (primary_guest_phone ~ '^[+]?[0-9 ()-]{8,24}$'),
  constraint reservations_adults_check check (adults between 1 and 50),
  constraint reservations_children_check check (children between 0 and 50),
  constraint reservations_source_check check (source in ('front_desk', 'phone', 'whatsapp', 'web', 'walk_in', 'other')),
  constraint reservations_status_check check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  constraint reservations_notes_check check (notes is null or char_length(notes) <= 2000)
);

create index reservations_property_status_time_idx
  on public.reservations (property_id, status, created_at desc);
create index reservations_guest_idx
  on public.reservations (guest_profile_id, created_at desc) where guest_profile_id is not null;
create index reservations_created_by_idx on public.reservations (created_by_profile_id);

create table public.reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  inventory_unit_id uuid not null,
  organization_id uuid not null,
  property_id uuid not null,
  stay_period daterange not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_allocations_reservation_fkey
    foreign key (reservation_id, organization_id, property_id)
    references public.reservations(id, organization_id, property_id) on delete cascade,
  constraint reservation_allocations_unit_fkey
    foreign key (inventory_unit_id, organization_id, property_id)
    references public.inventory_units(id, organization_id, property_id) on delete restrict,
  constraint reservation_allocations_stay_check check (
    not isempty(stay_period)
    and lower_inc(stay_period)
    and not upper_inc(stay_period)
    and lower(stay_period) < upper(stay_period)
  ),
  constraint reservation_allocations_status_check check (status in ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled')),
  constraint reservation_allocations_unit_stay_exclusion exclude using gist (
    inventory_unit_id with =,
    stay_period with &&
  ) where (status in ('pending', 'confirmed', 'checked_in'))
);

create index reservation_allocations_property_period_idx
  on public.reservation_allocations (property_id, lower(stay_period), upper(stay_period));
create index reservation_allocations_reservation_idx on public.reservation_allocations (reservation_id);

create trigger inventory_units_set_updated_at before update on public.inventory_units
for each row execute function private.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations
for each row execute function private.set_updated_at();
create trigger reservation_allocations_set_updated_at before update on public.reservation_allocations
for each row execute function private.set_updated_at();

alter table public.inventory_units enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_allocations enable row level security;

create policy inventory_units_select_authorized
on public.inventory_units for select to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));
create policy inventory_units_insert_authorized
on public.inventory_units for insert to authenticated
with check ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));
create policy inventory_units_update_authorized
on public.inventory_units for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));

create policy reservations_select_authorized
on public.reservations for select to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));
create policy reservations_insert_authorized
on public.reservations for insert to authenticated
with check (
  created_by_profile_id = (select auth.uid())
  and (select private.has_property_permission(organization_id, property_id, 'reservation.manage'))
);
create policy reservations_update_authorized
on public.reservations for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));

create policy reservation_allocations_select_authorized
on public.reservation_allocations for select to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));
create policy reservation_allocations_insert_authorized
on public.reservation_allocations for insert to authenticated
with check ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));
create policy reservation_allocations_update_authorized
on public.reservation_allocations for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'reservation.manage')));

revoke all on public.inventory_units, public.reservations, public.reservation_allocations from anon, authenticated;
grant select, insert, update on public.inventory_units to authenticated;
grant select, insert, update on public.reservations to authenticated;
grant select, insert, update on public.reservation_allocations to authenticated;

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

  generated_reference := 'AVK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.reservations (
    organization_id, property_id, booking_reference, primary_guest_name,
    primary_guest_phone, adults, children, source, status, notes, created_by_profile_id
  ) values (
    unit_row.organization_id, unit_row.property_id, generated_reference, pg_catalog.btrim(guest_name),
    pg_catalog.btrim(guest_phone), adult_count, child_count, booking_source, 'confirmed',
    nullif(pg_catalog.btrim(reservation_notes), ''), (select auth.uid())
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

create or replace function public.cancel_property_reservation(
  target_property_id uuid,
  target_reservation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.reservations
  set status = 'cancelled'
  where id = target_reservation_id
    and property_id = target_property_id
    and status in ('pending', 'confirmed');

  if not found then
    raise exception 'reservation cannot be cancelled' using errcode = '23514';
  end if;

  update public.reservation_allocations
  set status = 'cancelled'
  where reservation_id = target_reservation_id
    and property_id = target_property_id
    and status in ('pending', 'confirmed');
end;
$$;

create or replace function public.transition_property_reservation(
  target_property_id uuid,
  target_reservation_id uuid,
  next_status text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
  allocation_status text;
begin
  select status into current_status
  from public.reservations
  where id = target_reservation_id
    and property_id = target_property_id
  for update;

  if current_status is null
     or not (
       (current_status = 'confirmed' and next_status in ('checked_in', 'no_show'))
       or (current_status = 'checked_in' and next_status = 'checked_out')
     ) then
    raise exception 'invalid reservation status transition' using errcode = '23514';
  end if;

  allocation_status := case next_status
    when 'checked_in' then 'checked_in'
    when 'checked_out' then 'completed'
    when 'no_show' then 'cancelled'
  end;

  update public.reservations set status = next_status
  where id = target_reservation_id and property_id = target_property_id;

  update public.reservation_allocations set status = allocation_status
  where reservation_id = target_reservation_id and property_id = target_property_id;
end;
$$;

revoke all on function public.create_property_reservation(uuid, uuid, text, text, date, date, integer, integer, text, text) from public, anon;
revoke all on function public.cancel_property_reservation(uuid, uuid) from public, anon;
revoke all on function public.transition_property_reservation(uuid, uuid, text) from public, anon;
grant execute on function public.create_property_reservation(uuid, uuid, text, text, date, date, integer, integer, text, text) to authenticated;
grant execute on function public.cancel_property_reservation(uuid, uuid) to authenticated;
grant execute on function public.transition_property_reservation(uuid, uuid, text) to authenticated;

comment on table public.inventory_units is 'Individually sellable rooms or beds within a property.';
comment on table public.reservations is 'Property-scoped guest booking records without payment data.';
comment on table public.reservation_allocations is 'Date-bounded inventory allocation with database-enforced overlap protection.';

commit;
