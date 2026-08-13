begin;

alter table public.inventory_units
  add column operational_state text not null default 'ready',
  add column housekeeping_assignee text,
  add column housekeeping_started_at timestamptz,
  add column operational_updated_at timestamptz not null default now(),
  add constraint inventory_units_operational_state_check check (
    operational_state in ('ready', 'dirty', 'cleaning', 'inspection_pending', 'maintenance', 'blocked')
  ),
  add constraint inventory_units_housekeeping_assignee_check check (
    housekeeping_assignee is null or char_length(housekeeping_assignee) between 1 and 120
  );

update public.inventory_units
set operational_state = case status
  when 'maintenance' then 'maintenance'
  when 'inactive' then 'blocked'
  else 'ready'
end;

create table public.property_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  inventory_unit_id uuid,
  task_type text not null,
  title text not null,
  description text,
  status text not null default 'new',
  priority text not null default 'normal',
  source text not null default 'staff',
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  assigned_to_label text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_tasks_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint property_tasks_unit_fkey foreign key (inventory_unit_id, organization_id, property_id)
    references public.inventory_units(id, organization_id, property_id) on delete restrict,
  constraint property_tasks_type_check check (task_type in ('housekeeping', 'guest_request', 'maintenance', 'inspection', 'lost_found', 'general')),
  constraint property_tasks_title_check check (char_length(title) between 2 and 180),
  constraint property_tasks_description_check check (description is null or char_length(description) <= 4000),
  constraint property_tasks_status_check check (status in ('new', 'assigned', 'in_progress', 'waiting', 'completed', 'closed', 'cancelled')),
  constraint property_tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint property_tasks_source_check check (source in ('staff', 'guest_portal', 'whatsapp', 'checkout', 'system')),
  constraint property_tasks_assignee_label_check check (assigned_to_label is null or char_length(assigned_to_label) between 1 and 120),
  constraint property_tasks_completion_check check ((status not in ('completed', 'closed')) or completed_at is not null)
);

create index property_tasks_queue_idx on public.property_tasks
  (property_id, status, priority, due_at, created_at desc);
create index property_tasks_unit_idx on public.property_tasks
  (inventory_unit_id, status, created_at desc) where inventory_unit_id is not null;
create index property_tasks_assignee_idx on public.property_tasks
  (assigned_to_profile_id, status) where assigned_to_profile_id is not null;

create trigger property_tasks_set_updated_at before update on public.property_tasks
for each row execute function private.set_updated_at();

alter table public.property_tasks enable row level security;

create policy property_tasks_select_authorized
on public.property_tasks for select to authenticated
using (
  (select private.has_property_permission(organization_id, property_id, 'stay.manage'))
  or (select private.has_property_permission(organization_id, property_id, 'guest.manage'))
);

create policy property_tasks_insert_authorized
on public.property_tasks for insert to authenticated
with check (
  created_by_profile_id = (select auth.uid())
  and (
    (select private.has_property_permission(organization_id, property_id, 'stay.manage'))
    or (select private.has_property_permission(organization_id, property_id, 'guest.manage'))
  )
);

create policy property_tasks_update_authorized
on public.property_tasks for update to authenticated
using (
  (select private.has_property_permission(organization_id, property_id, 'stay.manage'))
  or (select private.has_property_permission(organization_id, property_id, 'guest.manage'))
)
with check (
  (select private.has_property_permission(organization_id, property_id, 'stay.manage'))
  or (select private.has_property_permission(organization_id, property_id, 'guest.manage'))
);

revoke all on public.property_tasks from anon, authenticated;
grant select, insert, update on public.property_tasks to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'property_tasks'
  ) then
    alter publication supabase_realtime add table public.property_tasks;
  end if;
end;
$$;

comment on column public.inventory_units.operational_state is
  'Physical room readiness state, intentionally separate from derived reservation occupancy.';
comment on table public.property_tasks is
  'Property-scoped housekeeping, guest request, maintenance, inspection and general operations queue.';

commit;
