begin;

alter table public.reservations
  add column external_booking_id text,
  add column checked_in_at timestamptz,
  add column checked_out_at timestamptz,
  add constraint reservations_external_booking_id_check check (
    external_booking_id is null or char_length(external_booking_id) between 3 and 120
  ),
  add constraint reservations_lifecycle_timestamps_check check (
    checked_out_at is null or (checked_in_at is not null and checked_out_at >= checked_in_at)
  );

create unique index reservations_property_external_booking_unique
  on public.reservations (property_id, external_booking_id)
  where external_booking_id is not null;

create or replace function private.claim_property_command(
  target_property_id uuid,
  permission_name text,
  operation_name text,
  command_key text,
  command_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_row public.properties%rowtype;
  receipt_row private.command_receipts%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if command_key is null or char_length(command_key) < 16 or char_length(command_key) > 255 then
    raise exception 'invalid command key' using errcode = '22023';
  end if;
  if command_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid request hash' using errcode = '22023';
  end if;

  select * into property_row from public.properties where id = target_property_id;
  if property_row.id is null
     or not private.has_property_permission(property_row.organization_id, property_row.id, permission_name) then
    raise exception 'property command is not authorized' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(property_row.organization_id::text || ':' || target_property_id::text || ':' || operation_name || ':' || command_key, 0)
  );

  select * into receipt_row
  from private.command_receipts
  where organization_id = property_row.organization_id
    and property_id = target_property_id
    and operation = operation_name
    and idempotency_key = command_key;

  if receipt_row.id is not null then
    if receipt_row.request_hash <> command_request_hash then
      raise exception 'command key was reused with different input' using errcode = '22023';
    end if;
    if receipt_row.status = 'completed' then
      return receipt_row.response_snapshot;
    end if;
    raise exception 'command is already in progress' using errcode = '55P03';
  end if;

  insert into private.command_receipts (
    organization_id, property_id, actor_id, operation, idempotency_key, request_hash,
    request_id, correlation_id, expires_at
  ) values (
    property_row.organization_id, target_property_id, (select auth.uid()), operation_name,
    command_key, command_request_hash, gen_random_uuid(), gen_random_uuid(), now() + interval '7 days'
  );
  return null;
end;
$$;

create or replace function private.complete_property_command(
  target_property_id uuid,
  operation_name text,
  command_key text,
  result_kind text,
  result_identifier uuid,
  result_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.command_receipts
  set status = 'completed', result_type = result_kind, result_id = result_identifier,
      response_snapshot = result_snapshot, completed_at = now()
  where property_id = target_property_id
    and operation = operation_name
    and idempotency_key = command_key
    and actor_id = (select auth.uid())
    and status = 'started';
  if not found then
    raise exception 'command receipt could not be completed' using errcode = '55000';
  end if;
end;
$$;

create or replace function private.write_reservation_audit(
  target_property_id uuid,
  target_reservation_id uuid,
  audit_event_name text,
  before_summary jsonb,
  after_summary jsonb,
  audit_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_row public.properties%rowtype;
begin
  select * into property_row from public.properties where id = target_property_id;
  if (select auth.uid()) is null
     or property_row.id is null
     or not (
       private.has_property_permission(property_row.organization_id, property_row.id, 'reservation.manage')
       or private.has_property_permission(property_row.organization_id, property_row.id, 'stay.manage')
     ) then
    raise exception 'audit event is not authorized' using errcode = '42501';
  end if;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, reason_text, request_id, correlation_id,
    safe_before_summary, safe_after_summary, source_metadata
  ) values (
    audit_event_name, (select auth.uid()), 'management', 'google', property_row.organization_id,
    property_row.id, 'reservation', target_reservation_id, nullif(pg_catalog.btrim(audit_reason), ''),
    gen_random_uuid(), gen_random_uuid(), before_summary, after_summary,
    jsonb_build_object('surface', 'owner_workspace')
  );
end;
$$;

revoke all on function private.claim_property_command(uuid, text, text, text, text) from public, anon;
revoke all on function private.complete_property_command(uuid, text, text, text, uuid, jsonb) from public, anon;
revoke all on function private.write_reservation_audit(uuid, uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function private.claim_property_command(uuid, text, text, text, text) to authenticated;
grant execute on function private.complete_property_command(uuid, text, text, text, uuid, jsonb) to authenticated;
grant execute on function private.write_reservation_audit(uuid, uuid, text, jsonb, jsonb, text) to authenticated;

create or replace function public.create_property_reservation_idempotent(
  target_property_id uuid,
  target_inventory_unit_id uuid,
  guest_name text,
  guest_phone text,
  check_in_date date,
  check_out_date date,
  adult_count integer,
  child_count integer,
  booking_source text,
  reservation_notes text,
  command_key text,
  external_reference text default null
)
returns table (reservation_id uuid, booking_reference text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_hash text;
  prior_result jsonb;
  created_result record;
begin
  command_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    concat_ws('|', target_property_id, target_inventory_unit_id, pg_catalog.btrim(guest_name),
      pg_catalog.btrim(guest_phone), check_in_date, check_out_date, adult_count, child_count,
      booking_source, coalesce(pg_catalog.btrim(reservation_notes), ''), coalesce(pg_catalog.btrim(external_reference), '')),
    'UTF8'
  )), 'hex');
  prior_result := private.claim_property_command(
    target_property_id, 'reservation.manage', 'reservation.create', command_key, command_hash
  );
  if prior_result is not null then
    return query select (prior_result->>'reservation_id')::uuid, prior_result->>'booking_reference';
    return;
  end if;

  select * into created_result from public.create_property_reservation(
    target_property_id, target_inventory_unit_id, guest_name, guest_phone, check_in_date,
    check_out_date, adult_count, child_count, booking_source, reservation_notes
  );

  update public.reservations
  set external_booking_id = nullif(pg_catalog.btrim(external_reference), '')
  where id = created_result.reservation_id and property_id = target_property_id;

  perform private.write_reservation_audit(
    target_property_id, created_result.reservation_id, 'reservation.created', null,
    jsonb_build_object('status', 'confirmed', 'booking_reference', created_result.booking_reference,
      'inventory_unit_id', target_inventory_unit_id), null
  );
  perform private.complete_property_command(
    target_property_id, 'reservation.create', command_key, 'reservation', created_result.reservation_id,
    jsonb_build_object('reservation_id', created_result.reservation_id, 'booking_reference', created_result.booking_reference)
  );
  return query select created_result.reservation_id, created_result.booking_reference;
end;
$$;

create or replace function public.transition_property_reservation_idempotent(
  target_property_id uuid,
  target_reservation_id uuid,
  next_status text,
  command_key text,
  transition_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_hash text;
  prior_result jsonb;
  reservation_row public.reservations%rowtype;
  allocation_row public.reservation_allocations%rowtype;
  unit_row public.inventory_units%rowtype;
  result_snapshot jsonb;
begin
  command_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    concat_ws('|', target_property_id, target_reservation_id, next_status, coalesce(pg_catalog.btrim(transition_reason), '')), 'UTF8'
  )), 'hex');
  prior_result := private.claim_property_command(
    target_property_id, 'stay.manage', 'reservation.transition', command_key, command_hash
  );
  if prior_result is not null then return prior_result; end if;

  select * into reservation_row from public.reservations
  where id = target_reservation_id and property_id = target_property_id for update;
  if reservation_row.id is null or not (
    (reservation_row.status = 'confirmed' and next_status in ('checked_in', 'no_show'))
    or (reservation_row.status = 'checked_in' and next_status = 'checked_out')
  ) then
    raise exception 'invalid reservation status transition' using errcode = '23514';
  end if;

  select * into allocation_row from public.reservation_allocations
  where reservation_id = target_reservation_id and property_id = target_property_id
  order by created_at desc limit 1 for update;
  select * into unit_row from public.inventory_units
  where id = allocation_row.inventory_unit_id and property_id = target_property_id for update;

  if next_status = 'checked_in' and (unit_row.status <> 'available' or unit_row.operational_state <> 'ready') then
    raise exception 'inventory unit is not ready for check-in' using errcode = '23514';
  end if;

  update public.reservations
  set status = next_status,
      checked_in_at = case when next_status = 'checked_in' then now() else checked_in_at end,
      checked_out_at = case when next_status = 'checked_out' then now() else checked_out_at end
  where id = target_reservation_id and property_id = target_property_id;
  update public.reservation_allocations
  set status = case next_status when 'checked_in' then 'checked_in' when 'checked_out' then 'completed' else 'cancelled' end
  where reservation_id = target_reservation_id and property_id = target_property_id;

  if next_status = 'checked_out' then
    update public.inventory_units
    set operational_state = 'dirty', operational_updated_at = now(), housekeeping_assignee = null,
        housekeeping_started_at = null
    where id = unit_row.id and property_id = target_property_id;
    insert into public.property_tasks (
      organization_id, property_id, inventory_unit_id, task_type, title, priority, source,
      created_by_profile_id
    ) values (
      reservation_row.organization_id, target_property_id, unit_row.id, 'housekeeping',
      'Turn over ' || unit_row.unit_code || ' after checkout', 'high', 'checkout', (select auth.uid())
    );
  end if;

  result_snapshot := jsonb_build_object(
    'reservation_id', target_reservation_id, 'status', next_status,
    'inventory_unit_id', unit_row.id,
    'operational_state', case when next_status = 'checked_out' then 'dirty' else unit_row.operational_state end
  );
  perform private.write_reservation_audit(
    target_property_id, target_reservation_id, 'reservation.' || next_status,
    jsonb_build_object('status', reservation_row.status, 'inventory_unit_id', unit_row.id),
    result_snapshot, transition_reason
  );
  perform private.complete_property_command(
    target_property_id, 'reservation.transition', command_key, 'reservation', target_reservation_id, result_snapshot
  );
  return result_snapshot;
end;
$$;

create or replace function public.move_property_reservation(
  target_property_id uuid,
  target_reservation_id uuid,
  target_inventory_unit_id uuid,
  command_key text,
  move_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_hash text;
  prior_result jsonb;
  reservation_row public.reservations%rowtype;
  allocation_row public.reservation_allocations%rowtype;
  old_unit public.inventory_units%rowtype;
  new_unit public.inventory_units%rowtype;
  result_snapshot jsonb;
begin
  command_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    concat_ws('|', target_property_id, target_reservation_id, target_inventory_unit_id, pg_catalog.btrim(move_reason)), 'UTF8'
  )), 'hex');
  prior_result := private.claim_property_command(target_property_id, 'stay.manage', 'reservation.move', command_key, command_hash);
  if prior_result is not null then return prior_result; end if;
  if move_reason is null or char_length(pg_catalog.btrim(move_reason)) < 3 then
    raise exception 'room move reason is required' using errcode = '23514';
  end if;

  select * into reservation_row from public.reservations
  where id = target_reservation_id and property_id = target_property_id for update;
  if reservation_row.id is null or reservation_row.status not in ('confirmed', 'checked_in') then
    raise exception 'reservation cannot be moved' using errcode = '23514';
  end if;
  select * into allocation_row from public.reservation_allocations
  where reservation_id = target_reservation_id and property_id = target_property_id
  order by created_at desc limit 1 for update;
  select * into old_unit from public.inventory_units where id = allocation_row.inventory_unit_id and property_id = target_property_id for update;
  select * into new_unit from public.inventory_units where id = target_inventory_unit_id and property_id = target_property_id for update;
  if new_unit.id is null or new_unit.status <> 'available' or (reservation_row.status = 'checked_in' and new_unit.operational_state <> 'ready') then
    raise exception 'target inventory unit is not available and ready' using errcode = '23514';
  end if;

  update public.reservation_allocations set inventory_unit_id = new_unit.id
  where id = allocation_row.id;
  if reservation_row.status = 'checked_in' then
    update public.inventory_units set operational_state = 'dirty', operational_updated_at = now()
    where id = old_unit.id;
    insert into public.property_tasks (
      organization_id, property_id, inventory_unit_id, task_type, title, priority, source,
      created_by_profile_id
    ) values (
      reservation_row.organization_id, target_property_id, old_unit.id, 'housekeeping',
      'Turn over ' || old_unit.unit_code || ' after room move', 'high', 'staff', (select auth.uid())
    );
  end if;

  result_snapshot := jsonb_build_object('reservation_id', target_reservation_id,
    'from_inventory_unit_id', old_unit.id, 'to_inventory_unit_id', new_unit.id,
    'booked_amount_minor', reservation_row.booked_amount_minor);
  perform private.write_reservation_audit(target_property_id, target_reservation_id, 'reservation.room_moved',
    jsonb_build_object('inventory_unit_id', old_unit.id), jsonb_build_object('inventory_unit_id', new_unit.id), move_reason);
  perform private.complete_property_command(target_property_id, 'reservation.move', command_key,
    'reservation', target_reservation_id, result_snapshot);
  return result_snapshot;
end;
$$;

create or replace function public.extend_property_reservation(
  target_property_id uuid,
  target_reservation_id uuid,
  new_check_out_date date,
  command_key text,
  extension_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_hash text;
  prior_result jsonb;
  reservation_row public.reservations%rowtype;
  allocation_row public.reservation_allocations%rowtype;
  unit_row public.inventory_units%rowtype;
  old_check_out date;
  new_total bigint;
  result_snapshot jsonb;
begin
  command_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    concat_ws('|', target_property_id, target_reservation_id, new_check_out_date, pg_catalog.btrim(extension_reason)), 'UTF8'
  )), 'hex');
  prior_result := private.claim_property_command(target_property_id, 'stay.manage', 'reservation.extend', command_key, command_hash);
  if prior_result is not null then return prior_result; end if;
  if extension_reason is null or char_length(pg_catalog.btrim(extension_reason)) < 3 then
    raise exception 'extension reason is required' using errcode = '23514';
  end if;

  select * into reservation_row from public.reservations
  where id = target_reservation_id and property_id = target_property_id for update;
  if reservation_row.id is null or reservation_row.status not in ('confirmed', 'checked_in') then
    raise exception 'reservation cannot be extended' using errcode = '23514';
  end if;
  select * into allocation_row from public.reservation_allocations
  where reservation_id = target_reservation_id and property_id = target_property_id
  order by created_at desc limit 1 for update;
  old_check_out := upper(allocation_row.stay_period);
  if new_check_out_date <= old_check_out then
    raise exception 'new checkout must be after current checkout' using errcode = '23514';
  end if;
  select * into unit_row from public.inventory_units where id = allocation_row.inventory_unit_id;
  new_total := reservation_row.booked_amount_minor + unit_row.nightly_rate_minor * (new_check_out_date - old_check_out);

  update public.reservation_allocations
  set stay_period = daterange(lower(allocation_row.stay_period), new_check_out_date, '[)')
  where id = allocation_row.id;
  update public.reservations set booked_amount_minor = new_total where id = target_reservation_id;

  result_snapshot := jsonb_build_object('reservation_id', target_reservation_id,
    'old_check_out', old_check_out, 'new_check_out', new_check_out_date,
    'booked_amount_minor', new_total);
  perform private.write_reservation_audit(target_property_id, target_reservation_id, 'reservation.extended',
    jsonb_build_object('check_out', old_check_out, 'booked_amount_minor', reservation_row.booked_amount_minor),
    jsonb_build_object('check_out', new_check_out_date, 'booked_amount_minor', new_total), extension_reason);
  perform private.complete_property_command(target_property_id, 'reservation.extend', command_key,
    'reservation', target_reservation_id, result_snapshot);
  return result_snapshot;
end;
$$;

revoke all on function public.create_property_reservation_idempotent(uuid, uuid, text, text, date, date, integer, integer, text, text, text, text) from public, anon;
revoke all on function public.transition_property_reservation_idempotent(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.move_property_reservation(uuid, uuid, uuid, text, text) from public, anon;
revoke all on function public.extend_property_reservation(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.create_property_reservation_idempotent(uuid, uuid, text, text, date, date, integer, integer, text, text, text, text) to authenticated;
grant execute on function public.transition_property_reservation_idempotent(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.move_property_reservation(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.extend_property_reservation(uuid, uuid, date, text, text) to authenticated;

comment on function public.transition_property_reservation_idempotent(uuid, uuid, text, text, text) is
  'Atomically checks in/out/no-shows a reservation. Checkout marks inventory dirty and creates housekeeping work.';
comment on function public.move_property_reservation(uuid, uuid, uuid, text, text) is
  'Atomically moves an active reservation while preserving booked value and allocation history in audit.';
comment on function public.extend_property_reservation(uuid, uuid, date, text, text) is
  'Extends allocation dates with exclusion-constraint protection and appends extra-night value at the active unit rate.';

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
begin
  perform public.transition_property_reservation_idempotent(
    target_property_id, target_reservation_id, next_status,
    gen_random_uuid()::text, 'Compatibility transition from owner API'
  );
end;
$$;

commit;
