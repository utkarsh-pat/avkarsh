begin;

alter table public.permissions
  add column requires_recent_reauth boolean not null default false;

create table public.role_financial_limits (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete restrict,
  currency_code text,
  minor_units bigint,
  percentage_basis_points integer,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  constraint role_financial_limits_value_check check (
    (minor_units is not null and minor_units >= 0 and currency_code ~ '^[A-Z]{3}$' and percentage_basis_points is null)
    or
    (percentage_basis_points is not null and percentage_basis_points between 0 and 10000 and minor_units is null and currency_code is null)
  )
);

create table public.organization_membership_financial_limits (
  organization_membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete restrict,
  currency_code text,
  minor_units bigint,
  percentage_basis_points integer,
  set_by_actor_id uuid not null references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_membership_id, permission_key),
  constraint organization_membership_financial_limits_value_check check (
    (minor_units is not null and minor_units >= 0 and currency_code ~ '^[A-Z]{3}$' and percentage_basis_points is null)
    or
    (percentage_basis_points is not null and percentage_basis_points between 0 and 10000 and minor_units is null and currency_code is null)
  )
);

create table public.property_membership_financial_limits (
  property_membership_id uuid not null references public.property_memberships(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete restrict,
  currency_code text,
  minor_units bigint,
  percentage_basis_points integer,
  set_by_actor_id uuid not null references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (property_membership_id, permission_key),
  constraint property_membership_financial_limits_value_check check (
    (minor_units is not null and minor_units >= 0 and currency_code ~ '^[A-Z]{3}$' and percentage_basis_points is null)
    or
    (percentage_basis_points is not null and percentage_basis_points between 0 and 10000 and minor_units is null and currency_code is null)
  )
);

create index role_financial_limits_permission_idx
  on public.role_financial_limits (permission_key, role_id);
create index organization_membership_financial_limits_permission_idx
  on public.organization_membership_financial_limits (permission_key, organization_membership_id);
create index property_membership_financial_limits_permission_idx
  on public.property_membership_financial_limits (permission_key, property_membership_id);

alter table public.role_financial_limits enable row level security;
alter table public.organization_membership_financial_limits enable row level security;
alter table public.property_membership_financial_limits enable row level security;

revoke all on public.role_financial_limits from anon, authenticated;
revoke all on public.organization_membership_financial_limits from anon, authenticated;
revoke all on public.property_membership_financial_limits from anon, authenticated;

create or replace function private.resolve_management_permission(
  target_organization_id uuid,
  target_property_id uuid,
  requested_permission_key text,
  authentication_mode text default 'google'
)
returns table (
  allowed boolean,
  decision text,
  effective_minor_units bigint,
  effective_percentage_basis_points integer,
  limit_currency_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  v_current_actor_id uuid;
  v_organization_membership_id uuid;
  v_property_membership_id uuid;
  organization_state text;
  grace_check_in_allowed boolean;
  property_currency text;
  permission_is_sensitive boolean;
  permission_requires_recent_reauth boolean;
  has_allow boolean := false;
  has_deny boolean := false;
begin
  allowed := false;
  decision := 'denied';
  effective_minor_units := null;
  effective_percentage_basis_points := null;
  limit_currency_code := null;

  if current_profile_id is null then
    decision := 'unauthenticated';
    return next;
    return;
  end if;

  if authentication_mode not in ('google', 'recent_google', 'device_pin') then
    decision := 'invalid_authentication_mode';
    return next;
    return;
  end if;

  select profiles.actor_id
  into v_current_actor_id
  from public.profiles
  join public.actors on actors.id = profiles.actor_id
  where profiles.id = current_profile_id
    and actors.actor_type = 'management'
    and actors.status = 'active';

  if v_current_actor_id is null then
    decision := 'inactive_actor';
    return next;
    return;
  end if;

  select memberships.id, organizations.lifecycle_state, organizations.grace_check_in_allowed
  into v_organization_membership_id, organization_state, grace_check_in_allowed
  from public.organization_memberships as memberships
  join public.organizations on organizations.id = memberships.organization_id
  where memberships.organization_id = target_organization_id
    and memberships.profile_id = current_profile_id
    and memberships.status = 'active';

  if v_organization_membership_id is null then
    decision := 'inactive_membership';
    return next;
    return;
  end if;

  if target_property_id is not null then
    select property_memberships.id, properties.currency_code
    into v_property_membership_id, property_currency
    from public.property_memberships
    join public.properties
      on properties.id = property_memberships.property_id
     and properties.organization_id = property_memberships.organization_id
    where property_memberships.organization_id = target_organization_id
      and property_memberships.organization_membership_id = v_organization_membership_id
      and property_memberships.property_id = target_property_id
      and property_memberships.status = 'active'
      and properties.status = 'active';

    if v_property_membership_id is null then
      decision := 'scope_denied';
      return next;
      return;
    end if;
  end if;

  select permissions.sensitive, permissions.requires_recent_reauth
  into permission_is_sensitive, permission_requires_recent_reauth
  from public.permissions
  where permissions.permission_key = requested_permission_key;

  if not found then
    decision := 'unknown_permission';
    return next;
    return;
  end if;

  if authentication_mode = 'device_pin' and permission_is_sensitive then
    decision := 'authentication_ceiling';
    return next;
    return;
  end if;

  if permission_requires_recent_reauth and authentication_mode <> 'recent_google' then
    decision := 'step_up_required';
    return next;
    return;
  end if;

  select
    coalesce(bool_or(effects.effect = 'allow'), false),
    coalesce(bool_or(effects.effect = 'deny'), false)
  into has_allow, has_deny
  from (
    select role_permissions.effect
    from public.organization_membership_roles
    join public.roles on roles.id = organization_membership_roles.role_id
    join public.role_permissions on role_permissions.role_id = roles.id
    where organization_membership_roles.organization_membership_id = v_organization_membership_id
      and roles.scope_type = 'organization'
      and roles.status = 'active'
      and (roles.is_system or roles.organization_id = target_organization_id)
      and role_permissions.permission_key = requested_permission_key

    union all

    select organization_permission_overrides.effect
    from public.organization_permission_overrides
    where organization_permission_overrides.organization_membership_id = v_organization_membership_id
      and organization_permission_overrides.permission_key = requested_permission_key

    union all

    select role_permissions.effect
    from public.property_membership_roles
    join public.roles on roles.id = property_membership_roles.role_id
    join public.role_permissions on role_permissions.role_id = roles.id
    where property_membership_roles.property_membership_id = v_property_membership_id
      and target_property_id is not null
      and roles.scope_type = 'property'
      and roles.status = 'active'
      and (roles.is_system or roles.organization_id = target_organization_id)
      and role_permissions.permission_key = requested_permission_key

    union all

    select property_permission_overrides.effect
    from public.property_permission_overrides
    where property_permission_overrides.property_membership_id = v_property_membership_id
      and target_property_id is not null
      and property_permission_overrides.permission_key = requested_permission_key
  ) as effects;

  if has_deny then
    decision := 'explicit_deny';
    return next;
    return;
  end if;

  if not has_allow then
    decision := 'no_allow';
    return next;
    return;
  end if;

  if organization_state in ('suspended', 'closed') then
    decision := 'tenant_unavailable';
    return next;
    return;
  end if;

  if organization_state = 'read_only'
     and requested_permission_key not in (
       'stay.checkout',
       'folio.reconcile',
       'payment.refund',
       'payment.reverse',
       'data.export',
       'public_qr.read'
     ) then
    decision := 'lifecycle_denied';
    return next;
    return;
  end if;

  if organization_state = 'grace'
     and requested_permission_key = 'stay.check_in'
     and not grace_check_in_allowed then
    decision := 'lifecycle_denied';
    return next;
    return;
  end if;

  select
    min(limits.minor_units) filter (
      where limits.minor_units is not null
        and property_currency is not null
        and limits.currency_code = property_currency
    ),
    min(limits.percentage_basis_points) filter (
      where limits.percentage_basis_points is not null
    ),
    property_currency
  into effective_minor_units, effective_percentage_basis_points, limit_currency_code
  from (
    select role_financial_limits.currency_code,
           role_financial_limits.minor_units,
           role_financial_limits.percentage_basis_points
    from public.organization_membership_roles
    join public.roles on roles.id = organization_membership_roles.role_id
    join public.role_financial_limits on role_financial_limits.role_id = roles.id
    where organization_membership_roles.organization_membership_id = v_organization_membership_id
      and roles.scope_type = 'organization'
      and roles.status = 'active'
      and (roles.is_system or roles.organization_id = target_organization_id)
      and role_financial_limits.permission_key = requested_permission_key

    union all

    select organization_membership_financial_limits.currency_code,
           organization_membership_financial_limits.minor_units,
           organization_membership_financial_limits.percentage_basis_points
    from public.organization_membership_financial_limits
    where organization_membership_financial_limits.organization_membership_id = v_organization_membership_id
      and organization_membership_financial_limits.permission_key = requested_permission_key

    union all

    select role_financial_limits.currency_code,
           role_financial_limits.minor_units,
           role_financial_limits.percentage_basis_points
    from public.property_membership_roles
    join public.roles on roles.id = property_membership_roles.role_id
    join public.role_financial_limits on role_financial_limits.role_id = roles.id
    where property_membership_roles.property_membership_id = v_property_membership_id
      and target_property_id is not null
      and roles.scope_type = 'property'
      and roles.status = 'active'
      and (roles.is_system or roles.organization_id = target_organization_id)
      and role_financial_limits.permission_key = requested_permission_key

    union all

    select property_membership_financial_limits.currency_code,
           property_membership_financial_limits.minor_units,
           property_membership_financial_limits.percentage_basis_points
    from public.property_membership_financial_limits
    where property_membership_financial_limits.property_membership_id = v_property_membership_id
      and target_property_id is not null
      and property_membership_financial_limits.permission_key = requested_permission_key
  ) as limits;

  allowed := true;
  decision := 'allowed';
  return next;
end;
$$;

comment on function private.resolve_management_permission(uuid, uuid, text, text) is
  'Deterministic M1 management authorization resolver. Deny wins, mode ceilings cannot be elevated, and lifecycle restrictions run after actor permissions.';

revoke all on function private.resolve_management_permission(uuid, uuid, text, text) from public, anon;
grant execute on function private.resolve_management_permission(uuid, uuid, text, text) to authenticated;

commit;
