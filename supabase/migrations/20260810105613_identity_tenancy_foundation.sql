begin;

create schema if not exists private;
create schema if not exists audit;

revoke all on schema private from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create table public.actors (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actors_actor_type_check
    check (actor_type in ('management', 'staff', 'platform')),
  constraint actors_status_check
    check (status in ('active', 'suspended', 'revoked'))
);

comment on table public.actors is
  'Auditable principals. Guest principals remain stay/session scoped and are not stored here.';

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  actor_id uuid not null unique references public.actors(id) on delete restrict,
  display_name text,
  primary_locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length_check
    check (display_name is null or char_length(display_name) between 1 and 120),
  constraint profiles_primary_locale_check
    check (primary_locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

comment on table public.profiles is
  'Google-authenticated management identities. Authorization lives in membership tables, never profile metadata.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  lifecycle_state text not null default 'trial',
  previous_safe_state text,
  grace_check_in_allowed boolean not null default false,
  lifecycle_changed_at timestamptz not null default now(),
  created_by_actor_id uuid references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length_check
    check (char_length(name) between 2 and 160),
  constraint organizations_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  constraint organizations_lifecycle_state_check
    check (lifecycle_state in ('trial', 'active', 'past_due', 'grace', 'read_only', 'suspended', 'closed')),
  constraint organizations_previous_safe_state_check
    check (previous_safe_state is null or previous_safe_state in ('trial', 'active', 'past_due', 'grace', 'read_only')),
  constraint organizations_suspension_restore_state_check
    check (
      (lifecycle_state = 'suspended' and previous_safe_state is not null)
      or (lifecycle_state <> 'suspended' and previous_safe_state is null)
    )
);

create unique index organizations_slug_unique_idx on public.organizations (lower(slug));
create index organizations_created_by_actor_id_idx on public.organizations (created_by_actor_id)
  where created_by_actor_id is not null;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  code text not null,
  timezone text not null,
  currency_code text not null,
  status text not null default 'active',
  created_by_actor_id uuid references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_id_organization_unique unique (id, organization_id),
  constraint properties_name_length_check check (char_length(name) between 2 and 160),
  constraint properties_code_format_check
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint properties_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint properties_status_check check (status in ('active', 'inactive', 'closed')),
  constraint properties_organization_code_unique unique (organization_id, code)
);

create index properties_organization_id_idx on public.properties (organization_id);
create index properties_created_by_actor_id_idx on public.properties (created_by_actor_id)
  where created_by_actor_id is not null;

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'invited',
  joined_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_id_organization_unique unique (id, organization_id),
  constraint organization_memberships_organization_profile_unique unique (organization_id, profile_id),
  constraint organization_memberships_status_check
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  constraint organization_memberships_active_joined_check
    check (status <> 'active' or joined_at is not null),
  constraint organization_memberships_suspended_at_check
    check (status = 'suspended' or suspended_at is null),
  constraint organization_memberships_revoked_at_check
    check (status = 'revoked' or revoked_at is null)
);

create index organization_memberships_profile_status_idx
  on public.organization_memberships (profile_id, status, organization_id);
create index organization_memberships_active_org_idx
  on public.organization_memberships (organization_id, profile_id)
  where status = 'active';

create table public.property_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_membership_id uuid not null,
  property_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_memberships_organization_membership_fkey
    foreign key (organization_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint property_memberships_property_fkey
    foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint property_memberships_membership_property_unique
    unique (organization_membership_id, property_id),
  constraint property_memberships_status_check
    check (status in ('active', 'suspended', 'revoked'))
);

create index property_memberships_property_status_idx
  on public.property_memberships (property_id, status, organization_membership_id);
create index property_memberships_organization_id_idx
  on public.property_memberships (organization_id);

create table public.permissions (
  permission_key text primary key,
  family text not null,
  description text not null,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  constraint permissions_key_format_check
    check (permission_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint permissions_family_format_check check (family ~ '^[a-z][a-z0-9_]*$')
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  role_key text not null,
  display_name text not null,
  scope_type text not null,
  is_system boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_key_format_check check (role_key ~ '^[a-z][a-z0-9_]*$'),
  constraint roles_scope_type_check check (scope_type in ('organization', 'property')),
  constraint roles_status_check check (status in ('active', 'archived')),
  constraint roles_ownership_check
    check ((is_system and organization_id is null) or (not is_system and organization_id is not null))
);

create unique index roles_system_key_scope_unique_idx
  on public.roles (role_key, scope_type) where is_system;
create unique index roles_tenant_key_scope_unique_idx
  on public.roles (organization_id, role_key, scope_type) where not is_system;
create index roles_organization_id_idx on public.roles (organization_id)
  where organization_id is not null;

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete restrict,
  effect text not null default 'allow',
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  constraint role_permissions_effect_check check (effect in ('allow', 'deny'))
);

create index role_permissions_permission_key_idx on public.role_permissions (permission_key);

create table public.organization_membership_roles (
  organization_membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by_actor_id uuid references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_membership_id, role_id)
);

create index organization_membership_roles_role_id_idx
  on public.organization_membership_roles (role_id);
create index organization_membership_roles_assigned_by_actor_id_idx
  on public.organization_membership_roles (assigned_by_actor_id)
  where assigned_by_actor_id is not null;

create table public.property_membership_roles (
  property_membership_id uuid not null references public.property_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by_actor_id uuid references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (property_membership_id, role_id)
);

create index property_membership_roles_role_id_idx
  on public.property_membership_roles (role_id);
create index property_membership_roles_assigned_by_actor_id_idx
  on public.property_membership_roles (assigned_by_actor_id)
  where assigned_by_actor_id is not null;

create table public.organization_permission_overrides (
  organization_membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete restrict,
  effect text not null,
  reason text not null,
  granted_by_actor_id uuid not null references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_membership_id, permission_key),
  constraint organization_permission_overrides_effect_check check (effect in ('allow', 'deny')),
  constraint organization_permission_overrides_reason_check check (char_length(reason) between 3 and 500)
);

create index organization_permission_overrides_permission_key_idx
  on public.organization_permission_overrides (permission_key);
create index organization_permission_overrides_granted_by_actor_id_idx
  on public.organization_permission_overrides (granted_by_actor_id);

create table public.property_permission_overrides (
  property_membership_id uuid not null references public.property_memberships(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete restrict,
  effect text not null,
  reason text not null,
  granted_by_actor_id uuid not null references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (property_membership_id, permission_key),
  constraint property_permission_overrides_effect_check check (effect in ('allow', 'deny')),
  constraint property_permission_overrides_reason_check check (char_length(reason) between 3 and 500)
);

create index property_permission_overrides_permission_key_idx
  on public.property_permission_overrides (permission_key);
create index property_permission_overrides_granted_by_actor_id_idx
  on public.property_permission_overrides (granted_by_actor_id);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null unique references public.actors(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  display_name text not null,
  status text not null default 'active',
  created_by_actor_id uuid not null references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_members_display_name_check check (char_length(display_name) between 1 and 120),
  constraint staff_members_status_check check (status in ('active', 'suspended', 'revoked'))
);

create index staff_members_property_status_idx on public.staff_members (property_id, status);
create index staff_members_created_by_actor_id_idx on public.staff_members (created_by_actor_id);

create table private.staff_pin_credentials (
  staff_member_id uuid primary key references public.staff_members(id) on delete cascade,
  verifier text not null,
  algorithm text not null,
  parameters jsonb not null default '{}'::jsonb,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  rotated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_pin_credentials_algorithm_check check (algorithm in ('argon2id')),
  constraint staff_pin_credentials_verifier_check check (char_length(verifier) between 32 and 1024),
  constraint staff_pin_credentials_parameters_check check (jsonb_typeof(parameters) = 'object'),
  constraint staff_pin_credentials_failed_attempts_check check (failed_attempts between 0 and 100)
);

comment on column private.staff_pin_credentials.verifier is
  'Slow password verifier only. Plaintext PINs must never be persisted or logged.';

create table private.device_sessions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  token_hash text not null unique,
  label text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by_actor_id uuid not null references public.actors(id) on delete restrict,
  revoked_by_actor_id uuid references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint device_sessions_label_check check (char_length(label) between 1 and 120),
  constraint device_sessions_expiry_check check (expires_at > created_at),
  constraint device_sessions_revocation_actor_check
    check (
      (revoked_at is null and revoked_by_actor_id is null)
      or (revoked_at is not null and revoked_by_actor_id is not null)
    )
);

create index device_sessions_property_active_idx
  on private.device_sessions (property_id, expires_at) where revoked_at is null;
create index device_sessions_created_by_actor_id_idx
  on private.device_sessions (created_by_actor_id);
create index device_sessions_revoked_by_actor_id_idx
  on private.device_sessions (revoked_by_actor_id) where revoked_by_actor_id is not null;

create table private.device_session_staff (
  device_session_id uuid not null references private.device_sessions(id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (device_session_id, staff_member_id)
);

create index device_session_staff_staff_member_id_idx
  on private.device_session_staff (staff_member_id);

create table public.organization_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  from_state text not null,
  to_state text not null,
  reason text not null,
  changed_by_actor_id uuid not null references public.actors(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  constraint organization_lifecycle_events_from_state_check
    check (from_state in ('trial', 'active', 'past_due', 'grace', 'read_only', 'suspended', 'closed')),
  constraint organization_lifecycle_events_to_state_check
    check (to_state in ('trial', 'active', 'past_due', 'grace', 'read_only', 'suspended', 'closed')),
  constraint organization_lifecycle_events_transition_check check (from_state <> to_state),
  constraint organization_lifecycle_events_reason_check check (char_length(reason) between 3 and 500)
);

create index organization_lifecycle_events_org_time_idx
  on public.organization_lifecycle_events (organization_id, occurred_at desc);
create index organization_lifecycle_events_actor_idx
  on public.organization_lifecycle_events (changed_by_actor_id);

create trigger actors_set_updated_at
before update on public.actors
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();
create trigger properties_set_updated_at
before update on public.properties
for each row execute function private.set_updated_at();
create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function private.set_updated_at();
create trigger property_memberships_set_updated_at
before update on public.property_memberships
for each row execute function private.set_updated_at();
create trigger roles_set_updated_at
before update on public.roles
for each row execute function private.set_updated_at();
create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function private.set_updated_at();
create trigger staff_pin_credentials_set_updated_at
before update on private.staff_pin_credentials
for each row execute function private.set_updated_at();

create or replace function private.validate_organization_membership_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  membership_organization_id uuid;
  assigned_role public.roles%rowtype;
begin
  select organization_id
  into membership_organization_id
  from public.organization_memberships
  where id = new.organization_membership_id;

  select *
  into assigned_role
  from public.roles
  where id = new.role_id;

  if membership_organization_id is null or assigned_role.id is null then
    raise exception 'membership or role does not exist';
  end if;

  if assigned_role.scope_type <> 'organization' then
    raise exception 'role scope must be organization';
  end if;

  if not assigned_role.is_system and assigned_role.organization_id <> membership_organization_id then
    raise exception 'tenant role belongs to another organization';
  end if;

  return new;
end;
$$;

create or replace function private.validate_property_membership_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  membership_organization_id uuid;
  assigned_role public.roles%rowtype;
begin
  select organization_id
  into membership_organization_id
  from public.property_memberships
  where id = new.property_membership_id;

  select *
  into assigned_role
  from public.roles
  where id = new.role_id;

  if membership_organization_id is null or assigned_role.id is null then
    raise exception 'membership or role does not exist';
  end if;

  if assigned_role.scope_type <> 'property' then
    raise exception 'role scope must be property';
  end if;

  if not assigned_role.is_system and assigned_role.organization_id <> membership_organization_id then
    raise exception 'tenant role belongs to another organization';
  end if;

  return new;
end;
$$;

create or replace function private.validate_staff_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.actors
    where actors.id = new.actor_id
      and actors.actor_type = 'staff'
  ) then
    raise exception 'staff member must reference a staff actor';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_organization_membership_role() from public, anon, authenticated;
revoke execute on function private.validate_property_membership_role() from public, anon, authenticated;
revoke execute on function private.validate_staff_actor() from public, anon, authenticated;

create trigger organization_membership_roles_validate_scope
before insert or update on public.organization_membership_roles
for each row execute function private.validate_organization_membership_role();

create trigger property_membership_roles_validate_scope
before insert or update on public.property_membership_roles
for each row execute function private.validate_property_membership_role();

create trigger staff_members_validate_actor
before insert or update of actor_id on public.staff_members
for each row execute function private.validate_staff_actor();

create or replace function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.actors (id, actor_type, status)
  values (new.id, 'management', 'active')
  on conflict (id) do nothing;

  insert into public.profiles (id, actor_id, display_name)
  values (
    new.id,
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_auth_user_created() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_auth_user_created();

insert into public.actors (id, actor_type, status)
select users.id, 'management', 'active'
from auth.users as users
left join public.actors as actors on actors.id = users.id
where actors.id is null;

insert into public.profiles (id, actor_id, display_name)
select
  users.id,
  users.id,
  nullif(pg_catalog.btrim(users.raw_user_meta_data ->> 'full_name'), '')
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;

create or replace function private.is_current_actor(target_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.actor_id = target_actor_id
    );
$$;

create or replace function private.is_active_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_memberships
      join public.organizations
        on organizations.id = organization_memberships.organization_id
      where organization_memberships.organization_id = target_organization_id
        and organization_memberships.profile_id = (select auth.uid())
        and organization_memberships.status = 'active'
        and organizations.lifecycle_state in ('trial', 'active', 'past_due', 'grace', 'read_only')
    );
$$;

create or replace function private.can_access_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.property_memberships
      join public.organization_memberships
        on organization_memberships.id = property_memberships.organization_membership_id
       and organization_memberships.organization_id = property_memberships.organization_id
      join public.properties
        on properties.id = property_memberships.property_id
       and properties.organization_id = property_memberships.organization_id
      join public.organizations
        on organizations.id = property_memberships.organization_id
      where property_memberships.property_id = target_property_id
        and organization_memberships.profile_id = (select auth.uid())
        and organization_memberships.status = 'active'
        and property_memberships.status = 'active'
        and properties.status = 'active'
        and organizations.lifecycle_state in ('trial', 'active', 'past_due', 'grace', 'read_only')
    );
$$;

revoke execute on function private.is_current_actor(uuid) from public, anon;
revoke execute on function private.is_active_organization_member(uuid) from public, anon;
revoke execute on function private.can_access_property(uuid) from public, anon;
grant execute on function private.is_current_actor(uuid) to authenticated;
grant execute on function private.is_active_organization_member(uuid) to authenticated;
grant execute on function private.can_access_property(uuid) to authenticated;

alter table public.actors enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.properties enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.property_memberships enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_membership_roles enable row level security;
alter table public.property_membership_roles enable row level security;
alter table public.organization_permission_overrides enable row level security;
alter table public.property_permission_overrides enable row level security;
alter table public.staff_members enable row level security;
alter table public.organization_lifecycle_events enable row level security;

create policy actors_select_self
on public.actors for select to authenticated
using ((select private.is_current_actor(id)));

create policy profiles_select_self
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_active_member
on public.organizations for select to authenticated
using ((select private.is_active_organization_member(id)));

create policy properties_select_assigned_member
on public.properties for select to authenticated
using ((select private.can_access_property(id)));

create policy organization_memberships_select_self
on public.organization_memberships for select to authenticated
using (profile_id = (select auth.uid()));

create policy property_memberships_select_self
on public.property_memberships for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships
    where organization_memberships.id = property_memberships.organization_membership_id
      and organization_memberships.profile_id = (select auth.uid())
  )
);

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
grant select on public.actors to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, primary_locale) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select on public.properties to authenticated;
grant select on public.organization_memberships to authenticated;
grant select on public.property_memberships to authenticated;

commit;
