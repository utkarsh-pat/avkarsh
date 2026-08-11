begin;

create or replace function private.can_manage_property_team(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select resolution.allowed
    from public.properties
    cross join lateral private.resolve_management_permission(
      properties.organization_id,
      properties.id,
      'staff.manage',
      'google'
    ) as resolution
    where properties.id = target_property_id
  ), false);
$$;

create or replace function private.create_property_staff_invitation(
  target_property_id uuid,
  intended_email text,
  selected_permissions text[],
  expiry_days integer default 7
)
returns table (invitation_id uuid, raw_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id_value uuid;
  inviter_actor_id uuid;
  normalized_email text := lower(pg_catalog.btrim(coalesce(intended_email, '')));
  permission_set text[];
  new_invitation_id uuid := gen_random_uuid();
  new_role_id uuid := gen_random_uuid();
  new_token text := encode(extensions.gen_random_bytes(32), 'hex');
  subscription_staff_limit integer;
  occupied_staff_count integer;
begin
  if not private.can_manage_property_team(target_property_id) then
    raise exception 'staff management permission denied' using errcode = '42501';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'valid staff email required' using errcode = '23514';
  end if;
  if expiry_days not between 1 and 30 then
    raise exception 'invitation expiry must be between 1 and 30 days' using errcode = '23514';
  end if;

  select properties.organization_id into organization_id_value
  from public.properties
  where properties.id = target_property_id
    and properties.status = 'active';

  select profiles.actor_id into inviter_actor_id
  from public.profiles
  where profiles.id = (select auth.uid());

  select coalesce(array_agg(permission_key order by permission_key), '{}'::text[])
  into permission_set
  from (
    select distinct permission_key
    from unnest(coalesce(selected_permissions, '{}'::text[])) as requested(permission_key)
    where permission_key = any(array[
      'dashboard.view', 'reservation.manage', 'guest.manage', 'stay.manage',
      'folio.manage', 'payment.manage', 'reports.read', 'whatsapp.manage', 'audit.read'
    ]::text[])
  ) allowed;

  if cardinality(permission_set) = 0
     or cardinality(permission_set) <> cardinality(array(select distinct unnest(coalesce(selected_permissions, '{}'::text[])))) then
    raise exception 'invalid property staff permission set' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(permission_set) as requested(permission_key)
    cross join lateral private.resolve_management_permission(
      organization_id_value,
      target_property_id,
      requested.permission_key,
      'google'
    ) as resolution
    where not resolution.allowed
  ) then
    raise exception 'cannot delegate a permission you do not hold' using errcode = '42501';
  end if;

  select subscriptions.staff_limit into subscription_staff_limit
  from public.organization_subscriptions as subscriptions
  where subscriptions.organization_id = organization_id_value
    and subscriptions.status in ('trialing', 'active', 'past_due');

  select
    (select count(*) from public.organization_memberships
      where organization_memberships.organization_id = organization_id_value
        and organization_memberships.status in ('active', 'invited'))
    +
    (select count(*) from public.membership_invitations
      where membership_invitations.organization_id = organization_id_value
        and membership_invitations.status in ('pending', 'claimed')
        and membership_invitations.expires_at > now())
  into occupied_staff_count;

  if subscription_staff_limit is null or occupied_staff_count >= subscription_staff_limit then
    raise exception 'subscription staff limit reached' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.membership_invitations
    where organization_id = organization_id_value
      and property_id = target_property_id
      and intended_email_hash = encode(extensions.digest(normalized_email, 'sha256'), 'hex')
      and status in ('pending', 'claimed')
      and expires_at > now()
  ) then
    raise exception 'an active invitation already exists for this email' using errcode = '23505';
  end if;

  insert into public.roles (
    id, organization_id, role_key, display_name, scope_type, is_system, status
  ) values (
    new_role_id, organization_id_value,
    'invite_' || replace(new_invitation_id::text, '-', ''),
    'Property Staff ' || upper(substr(replace(new_invitation_id::text, '-', ''), 1, 6)),
    'property', false, 'active'
  );

  insert into public.role_permissions (role_id, permission_key, effect)
  select new_role_id, unnest(permission_set), 'allow';

  insert into public.membership_invitations (
    id, organization_id, property_id, invitation_kind, intended_email_hash,
    intended_role_ids, token_hash, status, expires_at, created_by_actor_id
  ) values (
    new_invitation_id, organization_id_value, target_property_id, 'member',
    encode(extensions.digest(normalized_email, 'sha256'), 'hex'), array[new_role_id],
    encode(extensions.digest(new_token, 'sha256'), 'hex'), 'pending',
    now() + make_interval(days => expiry_days), inviter_actor_id
  );

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, request_id, correlation_id, safe_after_summary
  ) values (
    'membership.invited', inviter_actor_id, 'management', 'google',
    organization_id_value, target_property_id, 'membership_invitation', new_invitation_id,
    gen_random_uuid(), gen_random_uuid(),
    jsonb_build_object('kind', 'member', 'permission_count', cardinality(permission_set), 'expiry_days', expiry_days)
  );

  invitation_id := new_invitation_id;
  raw_token := new_token;
  return next;
end;
$$;

create or replace function private.claim_property_staff_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_row public.membership_invitations%rowtype;
  verified_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  claimant_actor_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if verified_email = ''
     or not (
       coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
       or coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
     ) then
    raise exception 'verified Google identity required' using errcode = '42501';
  end if;
  if coalesce(raw_token, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid invitation token' using errcode = '22023';
  end if;

  select * into invitation_row
  from public.membership_invitations
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  for update;

  if invitation_row.id is null or invitation_row.status <> 'pending' then
    raise exception 'invitation is not claimable' using errcode = 'P0002';
  end if;
  if invitation_row.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = '23514';
  end if;
  if invitation_row.intended_email_hash <> encode(extensions.digest(verified_email, 'sha256'), 'hex') then
    raise exception 'invitation email does not match this identity' using errcode = '42501';
  end if;

  select profiles.actor_id into claimant_actor_id
  from public.profiles
  where profiles.id = (select auth.uid());

  update public.membership_invitations
  set status = 'claimed', claimed_by_profile_id = (select auth.uid()), claimed_at = now()
  where id = invitation_row.id;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, request_id, correlation_id, safe_after_summary
  ) values (
    'membership.invitation_claimed', claimant_actor_id, 'management', 'google',
    invitation_row.organization_id, invitation_row.property_id,
    'membership_invitation', invitation_row.id, gen_random_uuid(), gen_random_uuid(),
    jsonb_build_object('status', 'claimed')
  );

  return invitation_row.id;
end;
$$;

create or replace function private.review_property_staff_invitation(
  target_invitation_id uuid,
  review_decision text,
  reason_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_row public.membership_invitations%rowtype;
  reviewer_actor_id uuid;
  membership_id uuid;
  property_membership_id uuid;
  intended_role_id uuid;
begin
  select * into invitation_row
  from public.membership_invitations
  where id = target_invitation_id
  for update;

  if invitation_row.id is null or not private.can_manage_property_team(invitation_row.property_id) then
    raise exception 'staff management permission denied' using errcode = '42501';
  end if;
  if review_decision not in ('approve', 'revoke') then
    raise exception 'unsupported invitation decision' using errcode = '22023';
  end if;
  if char_length(pg_catalog.btrim(coalesce(reason_text, ''))) < 3 then
    raise exception 'review reason required' using errcode = '23514';
  end if;

  select profiles.actor_id into reviewer_actor_id
  from public.profiles
  where profiles.id = (select auth.uid());

  if review_decision = 'revoke' then
    if invitation_row.status not in ('pending', 'claimed') then
      raise exception 'invitation can no longer be revoked' using errcode = '23514';
    end if;
    update public.membership_invitations
    set status = 'revoked', claimed_by_profile_id = null, claimed_at = null
    where id = invitation_row.id;
    update public.roles set status = 'archived'
    where id = any(invitation_row.intended_role_ids);
  else
    if invitation_row.status <> 'claimed' or invitation_row.expires_at <= now() then
      raise exception 'claimed unexpired invitation required' using errcode = '23514';
    end if;
    if invitation_row.claimed_by_profile_id = (select auth.uid()) then
      raise exception 'claimant cannot approve their own invitation' using errcode = '42501';
    end if;
    if cardinality(invitation_row.intended_role_ids) <> 1 then
      raise exception 'invalid invitation role contract' using errcode = '23514';
    end if;
    intended_role_id := invitation_row.intended_role_ids[1];

    insert into public.organization_memberships (
      organization_id, profile_id, status, joined_at
    ) values (
      invitation_row.organization_id, invitation_row.claimed_by_profile_id, 'active', now()
    ) on conflict (organization_id, profile_id) do update
      set status = 'active', joined_at = coalesce(public.organization_memberships.joined_at, now()),
          suspended_at = null, revoked_at = null
    returning id into membership_id;

    insert into public.property_memberships (
      organization_id, organization_membership_id, property_id, status
    ) values (
      invitation_row.organization_id, membership_id, invitation_row.property_id, 'active'
    ) on conflict (organization_membership_id, property_id) do update
      set status = 'active'
    returning id into property_membership_id;

    insert into public.property_membership_roles (
      property_membership_id, role_id, assigned_by_actor_id
    ) values (property_membership_id, intended_role_id, reviewer_actor_id)
    on conflict do nothing;

    update public.membership_invitations
    set status = 'approved', approved_by_actor_id = reviewer_actor_id, approved_at = now()
    where id = invitation_row.id;
  end if;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, reason_text, request_id, correlation_id, safe_after_summary
  ) values (
    case when review_decision = 'approve' then 'membership.invitation_approved' else 'membership.invitation_revoked' end,
    reviewer_actor_id, 'management', 'google', invitation_row.organization_id,
    invitation_row.property_id, 'membership_invitation', invitation_row.id,
    pg_catalog.btrim(reason_text), gen_random_uuid(), gen_random_uuid(),
    jsonb_build_object('status', case when review_decision = 'approve' then 'approved' else 'revoked' end)
  );

  return invitation_row.id;
end;
$$;

create or replace function private.set_property_team_member_access(
  target_property_id uuid,
  target_profile_id uuid,
  requested_action text,
  reason_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_membership_row public.property_memberships%rowtype;
  reviewer_actor_id uuid;
begin
  if not private.can_manage_property_team(target_property_id) then
    raise exception 'staff management permission denied' using errcode = '42501';
  end if;
  if target_profile_id = (select auth.uid()) then
    raise exception 'you cannot change your own access here' using errcode = '42501';
  end if;
  if requested_action not in ('suspend', 'restore')
     or char_length(pg_catalog.btrim(coalesce(reason_text, ''))) < 3 then
    raise exception 'valid access action and reason required' using errcode = '23514';
  end if;

  select property_memberships.*
  into property_membership_row
  from public.property_memberships
  join public.organization_memberships
    on organization_memberships.id = property_memberships.organization_membership_id
   and organization_memberships.organization_id = property_memberships.organization_id
  where property_memberships.property_id = target_property_id
    and organization_memberships.profile_id = target_profile_id
  for update of property_memberships;

  if property_membership_row.id is null then
    raise exception 'property team member not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.organization_membership_roles
    join public.roles on roles.id = organization_membership_roles.role_id
    where organization_membership_roles.organization_membership_id = property_membership_row.organization_membership_id
      and roles.role_key = 'organization_owner'
      and roles.status = 'active'
  ) then
    raise exception 'organization owner access cannot be changed here' using errcode = '42501';
  end if;

  select profiles.actor_id into reviewer_actor_id
  from public.profiles where profiles.id = (select auth.uid());

  update public.property_memberships
  set status = case when requested_action = 'suspend' then 'suspended' else 'active' end
  where id = property_membership_row.id;

  insert into audit.events (
    event_name, actor_id, actor_type, authentication_mode, organization_id, property_id,
    target_type, target_id, reason_text, request_id, correlation_id, safe_after_summary
  ) values (
    case when requested_action = 'suspend' then 'membership.property_suspended' else 'membership.property_restored' end,
    reviewer_actor_id, 'management', 'google', property_membership_row.organization_id,
    target_property_id, 'profile', target_profile_id, pg_catalog.btrim(reason_text),
    gen_random_uuid(), gen_random_uuid(),
    jsonb_build_object('property_membership_status', case when requested_action = 'suspend' then 'suspended' else 'active' end)
  );

  return target_profile_id;
end;
$$;

create or replace function private.get_property_staff_invitations(target_property_id uuid)
returns table (
  invitation_id uuid,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  claimed_display_name text,
  permissions text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_property_team(target_property_id) then
    raise exception 'staff management permission denied' using errcode = '42501';
  end if;
  return query
  select invitations.id,
    case when invitations.status = 'pending' and invitations.expires_at <= now() then 'expired' else invitations.status end,
    invitations.expires_at, invitations.created_at, profiles.display_name,
    coalesce(array_agg(role_permissions.permission_key order by role_permissions.permission_key)
      filter (where role_permissions.permission_key is not null), '{}'::text[])
  from public.membership_invitations as invitations
  left join public.profiles on profiles.id = invitations.claimed_by_profile_id
  left join public.role_permissions on role_permissions.role_id = any(invitations.intended_role_ids)
  where invitations.property_id = target_property_id
  group by invitations.id, profiles.display_name
  order by invitations.created_at desc;
end;
$$;

create or replace function private.get_property_team_members(target_property_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  membership_status text,
  joined_at timestamptz,
  role_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_property_team(target_property_id) then
    raise exception 'staff management permission denied' using errcode = '42501';
  end if;
  return query
  select profiles.id, profiles.display_name, property_memberships.status,
    organization_memberships.joined_at,
    coalesce(array_agg(distinct roles.display_name order by roles.display_name)
      filter (where roles.display_name is not null), '{}'::text[])
  from public.property_memberships
  join public.organization_memberships
    on organization_memberships.id = property_memberships.organization_membership_id
   and organization_memberships.organization_id = property_memberships.organization_id
  join public.profiles on profiles.id = organization_memberships.profile_id
  left join public.property_membership_roles
    on property_membership_roles.property_membership_id = property_memberships.id
  left join public.roles on roles.id = property_membership_roles.role_id
  where property_memberships.property_id = target_property_id
  group by profiles.id, profiles.display_name, property_memberships.status, organization_memberships.joined_at
  order by profiles.display_name;
end;
$$;

create or replace function public.create_property_staff_invitation(
  target_property_id uuid,
  intended_email text,
  selected_permissions text[],
  expiry_days integer default 7
)
returns table (invitation_id uuid, raw_token text)
language sql security invoker set search_path = ''
as $$ select * from private.create_property_staff_invitation(target_property_id, intended_email, selected_permissions, expiry_days); $$;

create or replace function public.claim_property_staff_invitation(raw_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.claim_property_staff_invitation(raw_token); $$;

create or replace function public.review_property_staff_invitation(
  target_invitation_id uuid, review_decision text, reason_text text
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.review_property_staff_invitation(target_invitation_id, review_decision, reason_text); $$;

create or replace function public.set_property_team_member_access(
  target_property_id uuid, target_profile_id uuid, requested_action text, reason_text text
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.set_property_team_member_access(target_property_id, target_profile_id, requested_action, reason_text); $$;

create or replace function public.get_property_staff_invitations(target_property_id uuid)
returns table (
  invitation_id uuid, status text, expires_at timestamptz, created_at timestamptz,
  claimed_display_name text, permissions text[]
)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_property_staff_invitations(target_property_id); $$;

create or replace function public.get_property_team_members(target_property_id uuid)
returns table (
  profile_id uuid, display_name text, membership_status text, joined_at timestamptz, role_names text[]
)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_property_team_members(target_property_id); $$;

revoke all on function private.can_manage_property_team(uuid) from public, anon;
revoke all on function private.create_property_staff_invitation(uuid, text, text[], integer) from public, anon;
revoke all on function private.claim_property_staff_invitation(text) from public, anon;
revoke all on function private.review_property_staff_invitation(uuid, text, text) from public, anon;
revoke all on function private.set_property_team_member_access(uuid, uuid, text, text) from public, anon;
revoke all on function private.get_property_staff_invitations(uuid) from public, anon;
revoke all on function private.get_property_team_members(uuid) from public, anon;
grant execute on function private.can_manage_property_team(uuid) to authenticated;
grant execute on function private.create_property_staff_invitation(uuid, text, text[], integer) to authenticated;
grant execute on function private.claim_property_staff_invitation(text) to authenticated;
grant execute on function private.review_property_staff_invitation(uuid, text, text) to authenticated;
grant execute on function private.set_property_team_member_access(uuid, uuid, text, text) to authenticated;
grant execute on function private.get_property_staff_invitations(uuid) to authenticated;
grant execute on function private.get_property_team_members(uuid) to authenticated;

revoke all on function public.create_property_staff_invitation(uuid, text, text[], integer) from public, anon;
revoke all on function public.claim_property_staff_invitation(text) from public, anon;
revoke all on function public.review_property_staff_invitation(uuid, text, text) from public, anon;
revoke all on function public.set_property_team_member_access(uuid, uuid, text, text) from public, anon;
revoke all on function public.get_property_staff_invitations(uuid) from public, anon;
revoke all on function public.get_property_team_members(uuid) from public, anon;
grant execute on function public.create_property_staff_invitation(uuid, text, text[], integer) to authenticated;
grant execute on function public.claim_property_staff_invitation(text) to authenticated;
grant execute on function public.review_property_staff_invitation(uuid, text, text) to authenticated;
grant execute on function public.set_property_team_member_access(uuid, uuid, text, text) to authenticated;
grant execute on function public.get_property_staff_invitations(uuid) to authenticated;
grant execute on function public.get_property_team_members(uuid) to authenticated;

comment on function public.create_property_staff_invitation(uuid, text, text[], integer) is
  'Creates a property-scoped staff invite and returns the raw single-use token exactly once.';
comment on function public.claim_property_staff_invitation(text) is
  'Claims an invitation only for the matching Google-verified email; access remains pending owner approval.';
comment on function public.review_property_staff_invitation(uuid, text, text) is
  'Approves a claimed identity into property membership or revokes an unapproved invitation.';

commit;
