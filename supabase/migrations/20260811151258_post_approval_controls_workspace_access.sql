begin;

create or replace function private.update_provisioned_tenant_controls(
  target_request_id uuid,
  control_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.onboarding_requests%rowtype;
  subscription_row public.organization_subscriptions%rowtype;
  admin_actor_id uuid;
  tenant_role_id uuid;
  tenant_role_key text;
  selected_permissions text[];
  plan_value text;
  billing_cycle_value text;
  currency_value text;
  amount_value bigint;
  trial_days_value integer;
  property_limit_value integer;
  staff_limit_value integer;
  reason_value text;
begin
  if not private.has_platform_permission('onboarding.review')
     or not private.has_platform_permission('subscription.manage') then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  select profiles.actor_id into admin_actor_id
  from public.profiles
  where profiles.id = (select auth.uid());

  select * into request_row
  from public.onboarding_requests
  where id = target_request_id
  for update;

  if request_row.id is null or request_row.status not in ('approved', 'revoked') then
    raise exception 'provisioned onboarding request not found' using errcode = 'P0002';
  end if;

  select * into subscription_row
  from public.organization_subscriptions
  where organization_id = request_row.organization_id
  for update;

  if subscription_row.organization_id is null then
    raise exception 'organization subscription not found' using errcode = 'P0002';
  end if;

  tenant_role_key := case request_row.requester_kind
    when 'property_owner' then 'organization_owner'
    when 'company_operator' then 'company_operator'
    when 'implementation_partner' then 'implementation_partner'
    else 'organization_owner'
  end;

  select roles.id into tenant_role_id
  from public.roles
  where roles.organization_id = request_row.organization_id
    and roles.role_key = tenant_role_key
    and roles.scope_type = 'organization'
    and roles.status = 'active';

  if tenant_role_id is null then
    raise exception 'provisioned tenant role not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into selected_permissions
  from (
    select distinct value
    from jsonb_array_elements_text(coalesce(control_payload -> 'permissions', '[]'::jsonb))
    where value = any(array[
      'dashboard.view', 'reservation.manage', 'guest.manage', 'stay.manage',
      'folio.manage', 'payment.manage', 'reports.read', 'staff.manage',
      'property.settings', 'whatsapp.manage', 'audit.read',
      'organization.manage', 'subscription.read'
    ]::text[])
  ) approved;

  plan_value := coalesce(nullif(control_payload ->> 'plan', ''), subscription_row.plan_code);
  billing_cycle_value := coalesce(nullif(control_payload ->> 'billing_cycle', ''), subscription_row.billing_cycle);
  currency_value := upper(coalesce(nullif(control_payload ->> 'currency_code', ''), subscription_row.currency_code));
  amount_value := coalesce((control_payload ->> 'amount_minor')::bigint, subscription_row.amount_minor);
  trial_days_value := coalesce((control_payload ->> 'trial_days')::integer, 0);
  property_limit_value := coalesce((control_payload ->> 'property_limit')::integer, subscription_row.property_limit);
  staff_limit_value := coalesce((control_payload ->> 'staff_limit')::integer, subscription_row.staff_limit);
  reason_value := nullif(pg_catalog.btrim(control_payload ->> 'reason'), '');

  if cardinality(selected_permissions) = 0 then
    raise exception 'at least one permission is required' using errcode = '23514';
  end if;
  if reason_value is null or char_length(reason_value) < 3 then
    raise exception 'a control-change reason is required' using errcode = '23514';
  end if;
  if plan_value not in ('trial', 'starter', 'growth', 'enterprise')
     or billing_cycle_value not in ('monthly', 'quarterly', 'annual', 'custom')
     or currency_value !~ '^[A-Z]{3}$'
     or amount_value < 0
     or trial_days_value not between 0 and 365
     or property_limit_value not between 1 and 10000
     or staff_limit_value not between 1 and 100000 then
    raise exception 'invalid subscription configuration' using errcode = '23514';
  end if;

  delete from public.role_permissions
  where role_id = tenant_role_id;

  insert into public.role_permissions (role_id, permission_key, effect)
  select tenant_role_id, unnest(selected_permissions), 'allow';

  update public.organization_subscriptions
  set plan_code = plan_value,
      status = case
        when status = 'revoked' then 'revoked'
        when plan_value = 'trial' or trial_days_value > 0 then 'trialing'
        else 'active'
      end,
      billing_cycle = billing_cycle_value,
      amount_minor = amount_value,
      currency_code = currency_value,
      property_limit = property_limit_value,
      staff_limit = staff_limit_value,
      trial_ends_at = case when trial_days_value > 0 then now() + make_interval(days => trial_days_value) else null end,
      current_period_ends_at = case
        when billing_cycle_value = 'monthly' then now() + interval '1 month'
        when billing_cycle_value = 'quarterly' then now() + interval '3 months'
        when billing_cycle_value = 'annual' then now() + interval '1 year'
        else null
      end
  where organization_id = request_row.organization_id;

  update public.organizations
  set lifecycle_state = case
        when plan_value = 'trial' or trial_days_value > 0 then 'trial'
        else 'active'
      end,
      lifecycle_changed_at = now()
  where id = request_row.organization_id
    and lifecycle_state not in ('suspended', 'closed');

  update public.onboarding_requests
  set approved_permissions = selected_permissions,
      approved_plan = plan_value,
      approved_amount_minor = amount_value,
      approved_currency_code = currency_value,
      approved_billing_cycle = billing_cycle_value,
      approved_trial_days = trial_days_value,
      review_reason = reason_value,
      reviewed_by_actor_id = admin_actor_id,
      reviewed_at = now()
  where id = target_request_id;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, reason_text, request_id, correlation_id, safe_after_summary
  ) values (
    'organization.controls_updated', admin_actor_id, 'platform', 'platform',
    request_row.organization_id, request_row.property_id,
    'onboarding_request', target_request_id, reason_value,
    gen_random_uuid(), gen_random_uuid(),
    jsonb_build_object(
      'plan', plan_value,
      'billing_cycle', billing_cycle_value,
      'permission_count', cardinality(selected_permissions),
      'property_limit', property_limit_value,
      'staff_limit', staff_limit_value
    )
  );

  return target_request_id;
end;
$$;

create or replace function public.update_provisioned_tenant_controls(
  target_request_id uuid,
  control_payload jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.update_provisioned_tenant_controls(target_request_id, control_payload);
$$;

create or replace function public.get_property_workspace_access(target_property_id uuid)
returns table (
  permission_key text,
  allowed boolean,
  decision text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped_property as (
    select properties.id, properties.organization_id
    from public.properties
    where properties.id = target_property_id
  ), requested_permissions(permission_key) as (
    values
      ('dashboard.view'::text),
      ('reservation.manage'::text),
      ('guest.manage'::text),
      ('stay.manage'::text),
      ('folio.manage'::text),
      ('payment.manage'::text),
      ('reports.read'::text),
      ('staff.manage'::text),
      ('property.settings'::text),
      ('whatsapp.manage'::text),
      ('audit.read'::text),
      ('organization.manage'::text),
      ('subscription.read'::text)
  )
  select
    requested_permissions.permission_key,
    resolution.allowed,
    resolution.decision
  from scoped_property
  cross join requested_permissions
  cross join lateral private.resolve_management_permission(
    scoped_property.organization_id,
    scoped_property.id,
    requested_permissions.permission_key,
    'google'
  ) as resolution;
$$;

revoke all on function private.update_provisioned_tenant_controls(uuid, jsonb) from public, anon;
grant execute on function private.update_provisioned_tenant_controls(uuid, jsonb) to authenticated;

revoke all on function public.update_provisioned_tenant_controls(uuid, jsonb) from public, anon;
revoke all on function public.get_property_workspace_access(uuid) from public, anon;
grant execute on function public.update_provisioned_tenant_controls(uuid, jsonb) to authenticated;
grant execute on function public.get_property_workspace_access(uuid) to authenticated;

comment on function public.update_provisioned_tenant_controls(uuid, jsonb) is
  'Platform-admin mutation for post-approval role permissions and commercial subscription controls.';
comment on function public.get_property_workspace_access(uuid) is
  'Returns resolver decisions for the authenticated management user and an RLS-visible property.';

commit;
