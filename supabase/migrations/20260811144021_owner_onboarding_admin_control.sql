begin;

insert into public.permissions (permission_key, family, description, sensitive)
values
  ('dashboard.view', 'dashboard', 'View the property operations dashboard', false),
  ('reservation.manage', 'reservation', 'Create and manage reservations', false),
  ('guest.manage', 'guest', 'Manage guest profiles and requests', false),
  ('stay.manage', 'stay', 'Manage arrivals, in-house stays, and departures', false),
  ('folio.manage', 'folio', 'Manage folios, charges, and settlement state', true),
  ('payment.manage', 'payment', 'Collect, adjust, and refund payments', true),
  ('reports.read', 'reports', 'Read operational and financial reports', false),
  ('staff.manage', 'staff', 'Invite, suspend, and manage property staff', true),
  ('property.settings', 'property', 'Manage property configuration', true),
  ('whatsapp.manage', 'whatsapp', 'Manage WhatsApp guest messaging and automation', false),
  ('audit.read', 'audit', 'Read security and operational audit events', true),
  ('organization.manage', 'organization', 'Manage organization-wide settings and access', true),
  ('subscription.read', 'subscription', 'Read subscription status and limits', false)
on conflict (permission_key) do nothing;

create table public.platform_admins (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  admin_role text not null default 'onboarding_reviewer',
  permissions text[] not null default '{}'::text[],
  status text not null default 'active',
  assigned_by_actor_id uuid references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_role_check
    check (admin_role in ('super_admin', 'onboarding_reviewer', 'support')),
  constraint platform_admins_permissions_check
    check (permissions <@ array[
      'onboarding.read', 'onboarding.review', 'subscription.manage',
      'organization.revoke', 'organization.restore'
    ]::text[]),
  constraint platform_admins_status_check check (status in ('active', 'revoked'))
);

comment on table public.platform_admins is
  'Platform operators for the Avkarsh SaaS control plane. Tenant roles never grant platform access.';

create table public.onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid references public.profiles(id) on delete restrict,
  requester_kind text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  whatsapp_phone text,
  organization_name text not null,
  property_name text not null,
  property_type text not null,
  room_count integer not null,
  address_line text not null,
  city text not null,
  state_region text not null,
  country_code text not null default 'IN',
  timezone text not null default 'Asia/Kolkata',
  currency_code text not null default 'INR',
  requested_plan text not null default 'trial',
  requested_permissions text[] not null default array[
    'dashboard.view', 'reservation.manage', 'guest.manage', 'stay.manage',
    'folio.manage', 'reports.read', 'staff.manage', 'property.settings',
    'whatsapp.manage', 'subscription.read'
  ]::text[],
  notes text,
  status text not null default 'pending',
  review_reason text,
  approved_permissions text[],
  approved_plan text,
  approved_amount_minor bigint,
  approved_currency_code text,
  approved_billing_cycle text,
  approved_trial_days integer,
  organization_id uuid references public.organizations(id) on delete restrict,
  property_id uuid references public.properties(id) on delete restrict,
  reviewed_by_actor_id uuid references public.actors(id) on delete restrict,
  reviewed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_requests_kind_check
    check (requester_kind in ('property_owner', 'company_operator', 'implementation_partner', 'property_staff')),
  constraint onboarding_requests_name_check check (char_length(contact_name) between 2 and 120),
  constraint onboarding_requests_email_check
    check (contact_email = lower(contact_email) and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint onboarding_requests_phone_check check (char_length(contact_phone) between 8 and 24),
  constraint onboarding_requests_whatsapp_check
    check (whatsapp_phone is null or char_length(whatsapp_phone) between 8 and 24),
  constraint onboarding_requests_organization_name_check check (char_length(organization_name) between 2 and 160),
  constraint onboarding_requests_property_name_check check (char_length(property_name) between 2 and 160),
  constraint onboarding_requests_property_type_check
    check (property_type in ('hotel', 'hostel', 'resort', 'guest_house', 'serviced_apartment', 'homestay', 'other')),
  constraint onboarding_requests_room_count_check check (room_count between 1 and 10000),
  constraint onboarding_requests_address_check check (char_length(address_line) between 5 and 300),
  constraint onboarding_requests_city_check check (char_length(city) between 2 and 120),
  constraint onboarding_requests_state_check check (char_length(state_region) between 2 and 120),
  constraint onboarding_requests_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint onboarding_requests_timezone_check check (char_length(timezone) between 3 and 64),
  constraint onboarding_requests_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint onboarding_requests_requested_plan_check check (requested_plan in ('trial', 'starter', 'growth', 'enterprise')),
  constraint onboarding_requests_requested_permissions_check check (requested_permissions <@ array[
    'dashboard.view', 'reservation.manage', 'guest.manage', 'stay.manage',
    'folio.manage', 'payment.manage', 'reports.read', 'staff.manage',
    'property.settings', 'whatsapp.manage', 'audit.read',
    'organization.manage', 'subscription.read'
  ]::text[]),
  constraint onboarding_requests_notes_check check (notes is null or char_length(notes) between 3 and 1000),
  constraint onboarding_requests_status_check
    check (status in ('pending', 'under_review', 'approved', 'rejected', 'revoked')),
  constraint onboarding_requests_review_reason_check
    check (review_reason is null or char_length(review_reason) between 3 and 500),
  constraint onboarding_requests_approved_permissions_check
    check (approved_permissions is null or approved_permissions <@ array[
      'dashboard.view', 'reservation.manage', 'guest.manage', 'stay.manage',
      'folio.manage', 'payment.manage', 'reports.read', 'staff.manage',
      'property.settings', 'whatsapp.manage', 'audit.read',
      'organization.manage', 'subscription.read'
    ]::text[]),
  constraint onboarding_requests_approved_plan_check
    check (approved_plan is null or approved_plan in ('trial', 'starter', 'growth', 'enterprise')),
  constraint onboarding_requests_amount_check check (approved_amount_minor is null or approved_amount_minor >= 0),
  constraint onboarding_requests_billing_cycle_check
    check (approved_billing_cycle is null or approved_billing_cycle in ('monthly', 'quarterly', 'annual', 'custom')),
  constraint onboarding_requests_trial_days_check check (approved_trial_days is null or approved_trial_days between 0 and 365),
  constraint onboarding_requests_review_state_check check (
    (status in ('pending', 'under_review') and reviewed_by_actor_id is null and reviewed_at is null)
    or (status in ('approved', 'rejected', 'revoked') and reviewed_by_actor_id is not null and reviewed_at is not null)
  ),
  constraint onboarding_requests_provisioning_check check (
    (status in ('approved', 'revoked') and organization_id is not null and property_id is not null)
    or (status in ('pending', 'under_review', 'rejected') and organization_id is null and property_id is null)
  )
);

create unique index onboarding_requests_open_email_idx
  on public.onboarding_requests (lower(contact_email))
  where status in ('pending', 'under_review');
create index onboarding_requests_status_created_idx
  on public.onboarding_requests (status, created_at desc);
create index onboarding_requests_requester_idx
  on public.onboarding_requests (requester_profile_id, created_at desc)
  where requester_profile_id is not null;

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  plan_code text not null,
  status text not null,
  billing_cycle text not null,
  amount_minor bigint not null,
  currency_code text not null,
  property_limit integer not null default 1,
  staff_limit integer not null default 10,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by_actor_id uuid references public.actors(id) on delete restrict,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_plan_check check (plan_code in ('trial', 'starter', 'growth', 'enterprise')),
  constraint organization_subscriptions_status_check check (status in ('trialing', 'active', 'past_due', 'revoked', 'cancelled')),
  constraint organization_subscriptions_cycle_check check (billing_cycle in ('monthly', 'quarterly', 'annual', 'custom')),
  constraint organization_subscriptions_amount_check check (amount_minor >= 0),
  constraint organization_subscriptions_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint organization_subscriptions_limits_check check (property_limit between 1 and 10000 and staff_limit between 1 and 100000),
  constraint organization_subscriptions_revoke_check check (
    (status = 'revoked' and revoked_at is not null and revoked_by_actor_id is not null and revoke_reason is not null)
    or (status <> 'revoked' and revoked_at is null and revoked_by_actor_id is null and revoke_reason is null)
  )
);

create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row execute function private.set_updated_at();
create trigger onboarding_requests_set_updated_at
before update on public.onboarding_requests
for each row execute function private.set_updated_at();
create trigger organization_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row execute function private.set_updated_at();

create or replace function private.has_platform_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins
    join public.profiles on profiles.id = platform_admins.profile_id
    join public.actors on actors.id = profiles.actor_id
    where platform_admins.profile_id = (select auth.uid())
      and platform_admins.status = 'active'
      and actors.status = 'active'
      and (
        platform_admins.admin_role = 'super_admin'
        or requested_permission = any(platform_admins.permissions)
      )
  );
$$;

create or replace function private.review_onboarding_request(
  target_request_id uuid,
  review_decision text,
  review_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.onboarding_requests%rowtype;
  admin_actor_id uuid;
  new_organization_id uuid;
  new_property_id uuid;
  new_membership_id uuid;
  owner_role_id uuid;
  provisioned_role_key text;
  provisioned_role_name text;
  subscription_plan text;
  subscription_cycle text;
  subscription_currency text;
  subscription_amount bigint;
  trial_days integer;
  property_limit_value integer;
  staff_limit_value integer;
  selected_permissions text[];
  generated_slug text;
  generated_code text;
  reason_text text;
begin
  if review_decision not in ('approve', 'reject') then
    raise exception 'unsupported review decision' using errcode = '22023';
  end if;

  if not private.has_platform_permission('onboarding.review') then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  select profiles.actor_id into admin_actor_id
  from public.profiles
  where profiles.id = (select auth.uid());

  select * into request_row
  from public.onboarding_requests
  where id = target_request_id
  for update;

  if request_row.id is null then
    raise exception 'onboarding request not found' using errcode = 'P0002';
  end if;
  if request_row.status not in ('pending', 'under_review') then
    raise exception 'onboarding request has already been processed' using errcode = '23514';
  end if;

  if review_decision = 'approve' and request_row.requester_kind = 'property_staff' then
    raise exception 'property staff must use an organization invitation' using errcode = '23514';
  end if;

  reason_text := nullif(pg_catalog.btrim(review_payload ->> 'reason'), '');

  if review_decision = 'reject' then
    if reason_text is null or char_length(reason_text) < 3 then
      raise exception 'a rejection reason is required' using errcode = '23514';
    end if;

    update public.onboarding_requests
    set status = 'rejected', review_reason = reason_text,
        reviewed_by_actor_id = admin_actor_id, reviewed_at = now()
    where id = target_request_id;

    insert into audit.events (
      event_name, actor_id, actor_type, authentication_mode, target_type, target_id,
      reason_text, request_id, correlation_id, safe_after_summary
    ) values (
      'onboarding.request_rejected', admin_actor_id, 'platform', 'platform',
      'onboarding_request', target_request_id, reason_text,
      gen_random_uuid(), gen_random_uuid(), jsonb_build_object('status', 'rejected')
    );
    return target_request_id;
  end if;

  subscription_plan := coalesce(nullif(review_payload ->> 'plan', ''), 'trial');
  subscription_cycle := coalesce(nullif(review_payload ->> 'billing_cycle', ''), 'monthly');
  subscription_currency := upper(coalesce(nullif(review_payload ->> 'currency_code', ''), request_row.currency_code));
  subscription_amount := coalesce((review_payload ->> 'amount_minor')::bigint, 0);
  trial_days := coalesce((review_payload ->> 'trial_days')::integer, 14);
  property_limit_value := coalesce((review_payload ->> 'property_limit')::integer, 1);
  staff_limit_value := coalesce((review_payload ->> 'staff_limit')::integer, 10);

  select coalesce(array_agg(value order by value), '{}'::text[])
  into selected_permissions
  from (
    select distinct value
    from jsonb_array_elements_text(coalesce(review_payload -> 'permissions', '[]'::jsonb))
    where value = any(array[
      'dashboard.view', 'reservation.manage', 'guest.manage', 'stay.manage',
      'folio.manage', 'payment.manage', 'reports.read', 'staff.manage',
      'property.settings', 'whatsapp.manage', 'audit.read',
      'organization.manage', 'subscription.read'
    ]::text[])
  ) approved;

  if cardinality(selected_permissions) = 0 then
    raise exception 'at least one permission is required' using errcode = '23514';
  end if;
  if subscription_plan not in ('trial', 'starter', 'growth', 'enterprise')
     or subscription_cycle not in ('monthly', 'quarterly', 'annual', 'custom')
     or subscription_currency !~ '^[A-Z]{3}$'
     or subscription_amount < 0
     or trial_days not between 0 and 365
     or property_limit_value not between 1 and 10000
     or staff_limit_value not between 1 and 100000 then
    raise exception 'invalid subscription configuration' using errcode = '23514';
  end if;

  generated_slug := regexp_replace(lower(request_row.organization_name), '[^a-z0-9]+', '-', 'g');
  generated_slug := trim(both '-' from generated_slug);
  if char_length(generated_slug) < 2 then generated_slug := 'hotel-group'; end if;
  generated_slug := left(generated_slug, 68) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  generated_code := upper(regexp_replace(request_row.property_name, '[^A-Za-z0-9]+', '', 'g'));
  generated_code := upper(
    left(coalesce(nullif(generated_code, ''), 'PROP'), 20)
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)
  );
  provisioned_role_key := case request_row.requester_kind
    when 'property_owner' then 'organization_owner'
    when 'company_operator' then 'company_operator'
    when 'implementation_partner' then 'implementation_partner'
    else 'organization_owner'
  end;
  provisioned_role_name := case request_row.requester_kind
    when 'property_owner' then 'Organization Owner'
    when 'company_operator' then 'Company Operator'
    when 'implementation_partner' then 'Implementation Partner'
    else 'Organization Owner'
  end;

  insert into public.organizations (
    name, slug, lifecycle_state, created_by_actor_id
  ) values (
    request_row.organization_name, generated_slug,
    case when subscription_plan = 'trial' or trial_days > 0 then 'trial' else 'active' end,
    admin_actor_id
  ) returning id into new_organization_id;

  insert into public.properties (
    organization_id, name, code, timezone, currency_code, created_by_actor_id
  ) values (
    new_organization_id, request_row.property_name, generated_code,
    request_row.timezone, request_row.currency_code, admin_actor_id
  ) returning id into new_property_id;

  insert into public.roles (
    organization_id, role_key, display_name, scope_type, is_system, status
  ) values (
    new_organization_id, provisioned_role_key, provisioned_role_name, 'organization', false, 'active'
  ) returning id into owner_role_id;

  insert into public.role_permissions (role_id, permission_key, effect)
  select owner_role_id, unnest(selected_permissions), 'allow';

  insert into public.organization_subscriptions (
    organization_id, plan_code, status, billing_cycle, amount_minor, currency_code,
    property_limit, staff_limit, trial_ends_at, current_period_ends_at
  ) values (
    new_organization_id, subscription_plan,
    case when subscription_plan = 'trial' or trial_days > 0 then 'trialing' else 'active' end,
    subscription_cycle, subscription_amount, subscription_currency,
    property_limit_value, staff_limit_value,
    case when trial_days > 0 then now() + make_interval(days => trial_days) else null end,
    case
      when subscription_cycle = 'monthly' then now() + interval '1 month'
      when subscription_cycle = 'quarterly' then now() + interval '3 months'
      when subscription_cycle = 'annual' then now() + interval '1 year'
      else null
    end
  );

  if request_row.requester_profile_id is not null then
    insert into public.organization_memberships (
      organization_id, profile_id, status, joined_at
    ) values (
      new_organization_id, request_row.requester_profile_id, 'active', now()
    ) returning id into new_membership_id;

    insert into public.organization_membership_roles (
      organization_membership_id, role_id, assigned_by_actor_id
    ) values (new_membership_id, owner_role_id, admin_actor_id);

    insert into public.property_memberships (
      organization_id, organization_membership_id, property_id, status
    ) values (new_organization_id, new_membership_id, new_property_id, 'active');
  end if;

  update public.onboarding_requests
  set status = 'approved', review_reason = reason_text,
      approved_permissions = selected_permissions,
      approved_plan = subscription_plan,
      approved_amount_minor = subscription_amount,
      approved_currency_code = subscription_currency,
      approved_billing_cycle = subscription_cycle,
      approved_trial_days = trial_days,
      organization_id = new_organization_id,
      property_id = new_property_id,
      reviewed_by_actor_id = admin_actor_id,
      reviewed_at = now(),
      claimed_at = case when requester_profile_id is not null then now() else null end
  where id = target_request_id;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, reason_text, request_id, correlation_id, safe_after_summary
  ) values (
    'onboarding.request_approved', admin_actor_id, 'platform', 'platform',
    new_organization_id, new_property_id, 'onboarding_request', target_request_id,
    reason_text, gen_random_uuid(), gen_random_uuid(),
    jsonb_build_object(
      'status', 'approved', 'plan', subscription_plan,
      'permission_count', cardinality(selected_permissions),
      'identity_claimed', request_row.requester_profile_id is not null
    )
  );

  return target_request_id;
end;
$$;

create or replace function private.claim_approved_onboarding_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_email text;
  request_row record;
  owner_role_id uuid;
  membership_id uuid;
  claimed_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  verified_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if verified_email = '' then
    raise exception 'verified email claim required' using errcode = '42501';
  end if;

  for request_row in
    select * from public.onboarding_requests
    where status = 'approved'
      and requester_profile_id is null
      and claimed_at is null
      and contact_email = verified_email
    for update
  loop
    select id into owner_role_id
    from public.roles
    where organization_id = request_row.organization_id
      and role_key = case request_row.requester_kind
        when 'property_owner' then 'organization_owner'
        when 'company_operator' then 'company_operator'
        when 'implementation_partner' then 'implementation_partner'
        else 'organization_owner'
      end
      and scope_type = 'organization'
      and status = 'active';

    insert into public.organization_memberships (
      organization_id, profile_id, status, joined_at
    ) values (
      request_row.organization_id, (select auth.uid()), 'active', now()
    )
    on conflict (organization_id, profile_id) do update
      set status = 'active', joined_at = coalesce(public.organization_memberships.joined_at, now()),
          suspended_at = null, revoked_at = null
    returning id into membership_id;

    insert into public.organization_membership_roles (
      organization_membership_id, role_id, assigned_by_actor_id
    ) values (membership_id, owner_role_id, null)
    on conflict do nothing;

    insert into public.property_memberships (
      organization_id, organization_membership_id, property_id, status
    ) values (
      request_row.organization_id, membership_id, request_row.property_id, 'active'
    ) on conflict (organization_membership_id, property_id) do update
      set status = 'active';

    update public.onboarding_requests
    set requester_profile_id = (select auth.uid()), claimed_at = now()
    where id = request_row.id;

    claimed_count := claimed_count + 1;
  end loop;

  return claimed_count;
end;
$$;

create or replace function private.set_onboarding_organization_access(
  target_request_id uuid,
  requested_action text,
  reason_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.onboarding_requests%rowtype;
  admin_actor_id uuid;
begin
  if requested_action not in ('revoke', 'restore') then
    raise exception 'unsupported access action' using errcode = '22023';
  end if;
  if char_length(pg_catalog.btrim(coalesce(reason_text, ''))) < 3 then
    raise exception 'an access-change reason is required' using errcode = '23514';
  end if;
  if not private.has_platform_permission(
    case when requested_action = 'revoke' then 'organization.revoke' else 'organization.restore' end
  ) then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  select profiles.actor_id into admin_actor_id
  from public.profiles where profiles.id = (select auth.uid());

  select * into request_row
  from public.onboarding_requests
  where id = target_request_id
  for update;

  if request_row.id is null or request_row.organization_id is null then
    raise exception 'approved onboarding request not found' using errcode = 'P0002';
  end if;

  if requested_action = 'revoke' then
    update public.organizations
    set previous_safe_state = case
          when lifecycle_state in ('trial', 'active', 'past_due', 'grace', 'read_only') then lifecycle_state
          else coalesce(previous_safe_state, 'active')
        end,
        lifecycle_state = 'suspended', lifecycle_changed_at = now()
    where id = request_row.organization_id;

    update public.organization_memberships
    set status = 'suspended', suspended_at = now(), revoked_at = null
    where organization_id = request_row.organization_id and status = 'active';

    update public.property_memberships
    set status = 'suspended'
    where organization_id = request_row.organization_id and status = 'active';

    update public.organization_subscriptions
    set status = 'revoked', revoked_at = now(), revoked_by_actor_id = admin_actor_id,
        revoke_reason = pg_catalog.btrim(reason_text)
    where organization_id = request_row.organization_id;

    update public.onboarding_requests
    set status = 'revoked', review_reason = pg_catalog.btrim(reason_text)
    where id = target_request_id;
  else
    update public.organizations
    set lifecycle_state = coalesce(previous_safe_state, 'active'), previous_safe_state = null,
        lifecycle_changed_at = now()
    where id = request_row.organization_id and lifecycle_state = 'suspended';

    update public.organization_memberships
    set status = 'active', joined_at = coalesce(joined_at, now()), suspended_at = null
    where organization_id = request_row.organization_id and status = 'suspended';

    update public.property_memberships
    set status = 'active'
    where organization_id = request_row.organization_id and status = 'suspended';

    update public.organization_subscriptions
    set status = case when trial_ends_at is not null and trial_ends_at > now() then 'trialing' else 'active' end,
        revoked_at = null, revoked_by_actor_id = null, revoke_reason = null
    where organization_id = request_row.organization_id and status = 'revoked';

    update public.onboarding_requests
    set status = 'approved', review_reason = pg_catalog.btrim(reason_text)
    where id = target_request_id;
  end if;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, reason_text, request_id, correlation_id, safe_after_summary
  ) values (
    case when requested_action = 'revoke' then 'organization.access_revoked' else 'organization.access_restored' end,
    admin_actor_id, 'platform', 'platform', request_row.organization_id, request_row.property_id,
    'organization', request_row.organization_id, pg_catalog.btrim(reason_text),
    gen_random_uuid(), gen_random_uuid(), jsonb_build_object('action', requested_action)
  );

  return target_request_id;
end;
$$;

create or replace function public.review_onboarding_request(
  target_request_id uuid,
  review_decision text,
  review_payload jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.review_onboarding_request(target_request_id, review_decision, review_payload); $$;

create or replace function public.claim_approved_onboarding_requests()
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.claim_approved_onboarding_requests(); $$;

create or replace function public.set_onboarding_organization_access(
  target_request_id uuid,
  requested_action text,
  reason_text text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.set_onboarding_organization_access(target_request_id, requested_action, reason_text); $$;

revoke all on function private.has_platform_permission(text) from public, anon;
revoke all on function private.review_onboarding_request(uuid, text, jsonb) from public, anon;
revoke all on function private.claim_approved_onboarding_requests() from public, anon;
revoke all on function private.set_onboarding_organization_access(uuid, text, text) from public, anon;
grant execute on function private.has_platform_permission(text) to authenticated;
grant execute on function private.review_onboarding_request(uuid, text, jsonb) to authenticated;
grant execute on function private.claim_approved_onboarding_requests() to authenticated;
grant execute on function private.set_onboarding_organization_access(uuid, text, text) to authenticated;

revoke all on function public.review_onboarding_request(uuid, text, jsonb) from public, anon;
revoke all on function public.claim_approved_onboarding_requests() from public, anon;
revoke all on function public.set_onboarding_organization_access(uuid, text, text) from public, anon;
grant execute on function public.review_onboarding_request(uuid, text, jsonb) to authenticated;
grant execute on function public.claim_approved_onboarding_requests() to authenticated;
grant execute on function public.set_onboarding_organization_access(uuid, text, text) to authenticated;

alter table public.platform_admins enable row level security;
alter table public.onboarding_requests enable row level security;
alter table public.organization_subscriptions enable row level security;

create policy platform_admins_select_self
on public.platform_admins for select to authenticated
using (profile_id = (select auth.uid()) and status = 'active');

create policy onboarding_requests_insert_anonymous
on public.onboarding_requests for insert to anon
with check (requester_profile_id is null and status = 'pending');

create policy onboarding_requests_insert_authenticated
on public.onboarding_requests for insert to authenticated
with check (
  requester_profile_id = (select auth.uid())
  and contact_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  and status = 'pending'
);

create policy onboarding_requests_select_requester_or_platform
on public.onboarding_requests for select to authenticated
using (
  requester_profile_id = (select auth.uid())
  or (select private.has_platform_permission('onboarding.read'))
  or (select private.has_platform_permission('onboarding.review'))
);

create policy organization_subscriptions_select_member_or_platform
on public.organization_subscriptions for select to authenticated
using (
  (select private.is_active_organization_member(organization_id))
  or (select private.has_platform_permission('subscription.manage'))
  or (select private.has_platform_permission('onboarding.read'))
);

revoke all on public.platform_admins, public.onboarding_requests, public.organization_subscriptions
from anon, authenticated;
grant select on public.platform_admins to authenticated;
grant insert (
  id, requester_profile_id, requester_kind, contact_name, contact_email,
  contact_phone, whatsapp_phone, organization_name, property_name, property_type,
  room_count, address_line, city, state_region, country_code, timezone,
  currency_code, requested_plan, requested_permissions, notes, status
) on public.onboarding_requests to anon, authenticated;
grant select on public.onboarding_requests to authenticated;
grant select on public.organization_subscriptions to authenticated;

comment on function public.review_onboarding_request(uuid, text, jsonb) is
  'Transactional platform-admin review. Approval provisions tenant, property, role, permissions, subscription, and audit state.';
comment on function public.claim_approved_onboarding_requests() is
  'Claims approved anonymous requests only when the authenticated verified email matches exactly.';
comment on function public.set_onboarding_organization_access(uuid, text, text) is
  'Revokes or restores organization access, memberships, property assignments, and subscription state together.';

commit;
