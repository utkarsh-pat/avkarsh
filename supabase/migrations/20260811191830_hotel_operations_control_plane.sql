begin;

alter table public.platform_admins
  drop constraint platform_admins_permissions_check;

alter table public.platform_admins
  add constraint platform_admins_permissions_check
  check (permissions <@ array[
    'onboarding.read', 'onboarding.review', 'subscription.manage',
    'organization.revoke', 'organization.restore', 'listings.read',
    'users.read', 'guests.read', 'cases.read', 'whatsapp.read',
    'incidents.manage', 'audit.read', 'analytics.read', 'settings.manage'
  ]::text[]);

create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  full_name text not null,
  phone text not null,
  email text,
  whatsapp_phone text,
  nationality text,
  vip_tier text not null default 'standard',
  status text not null default 'active',
  total_stays integer not null default 0,
  last_stay_at timestamptz,
  preferences jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_profiles_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint guest_profiles_name_check check (char_length(full_name) between 2 and 160),
  constraint guest_profiles_phone_check check (phone ~ '^[+]?[0-9 ()-]{8,24}$'),
  constraint guest_profiles_email_check check (email is null or email = lower(email)),
  constraint guest_profiles_vip_tier_check check (vip_tier in ('standard', 'silver', 'gold', 'platinum')),
  constraint guest_profiles_status_check check (status in ('active', 'blocked', 'archived')),
  constraint guest_profiles_total_stays_check check (total_stays >= 0),
  constraint guest_profiles_preferences_check check (jsonb_typeof(preferences) = 'object'),
  constraint guest_profiles_notes_check check (notes is null or char_length(notes) <= 2000),
  unique (property_id, phone),
  unique (id, organization_id, property_id)
);

create index guest_profiles_property_activity_idx
  on public.guest_profiles (property_id, status, last_stay_at desc nulls last);
create index guest_profiles_organization_idx on public.guest_profiles (organization_id, created_at desc);

create table public.operational_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  guest_profile_id uuid,
  case_type text not null,
  source text not null default 'front_desk',
  subject text not null,
  description text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  opened_by_actor_id uuid references public.actors(id) on delete restrict,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_cases_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint operational_cases_guest_fkey foreign key (guest_profile_id, organization_id, property_id)
    references public.guest_profiles(id, organization_id, property_id) on delete restrict,
  constraint operational_cases_type_check check (case_type in ('complaint', 'enquiry', 'request', 'feedback')),
  constraint operational_cases_source_check check (source in ('whatsapp', 'front_desk', 'phone', 'email', 'web', 'system')),
  constraint operational_cases_subject_check check (char_length(subject) between 3 and 200),
  constraint operational_cases_description_check check (char_length(description) between 3 and 5000),
  constraint operational_cases_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint operational_cases_status_check check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  constraint operational_cases_resolution_check check (
    (status in ('resolved', 'closed') and resolved_at is not null)
    or (status not in ('resolved', 'closed') and resolved_at is null)
  )
);

create index operational_cases_queue_idx
  on public.operational_cases (property_id, case_type, status, priority, created_at desc);
create index operational_cases_guest_idx
  on public.operational_cases (guest_profile_id, created_at desc) where guest_profile_id is not null;

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  guest_profile_id uuid,
  whatsapp_phone text not null,
  guest_name text not null,
  state text not null default 'bot',
  tag text,
  unread_count integer not null default 0,
  last_message_preview text,
  last_message_at timestamptz,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  direct_chat_expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint whatsapp_conversations_guest_fkey foreign key (guest_profile_id, organization_id, property_id)
    references public.guest_profiles(id, organization_id, property_id) on delete restrict,
  constraint whatsapp_conversations_phone_check check (whatsapp_phone ~ '^[+]?[0-9]{8,20}$'),
  constraint whatsapp_conversations_guest_name_check check (char_length(guest_name) between 1 and 160),
  constraint whatsapp_conversations_state_check check (state in ('bot', 'direct_chat', 'waiting', 'closed')),
  constraint whatsapp_conversations_tag_check check (tag is null or tag in ('urgent', 'complaint', 'enquiry', 'feedback', 'resolved')),
  constraint whatsapp_conversations_unread_check check (unread_count >= 0),
  constraint whatsapp_conversations_status_check check (status in ('active', 'archived')),
  unique (property_id, whatsapp_phone),
  unique (id, organization_id, property_id)
);

create index whatsapp_conversations_inbox_idx
  on public.whatsapp_conversations (property_id, status, unread_count desc, last_message_at desc nulls last);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  direction text not null,
  sender_type text not null,
  message_type text not null default 'text',
  body text,
  media_url text,
  file_name text,
  provider_message_id text,
  delivery_status text not null default 'queued',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint whatsapp_messages_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint whatsapp_messages_conversation_fkey foreign key (conversation_id, organization_id, property_id)
    references public.whatsapp_conversations(id, organization_id, property_id) on delete cascade,
  constraint whatsapp_messages_direction_check check (direction in ('inbound', 'outbound', 'system')),
  constraint whatsapp_messages_sender_check check (sender_type in ('guest', 'staff', 'bot', 'system')),
  constraint whatsapp_messages_type_check check (message_type in ('text', 'image', 'document', 'audio', 'video', 'template', 'system')),
  constraint whatsapp_messages_content_check check (body is not null or media_url is not null),
  constraint whatsapp_messages_delivery_check check (delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed'))
);

create unique index whatsapp_messages_provider_unique_idx
  on public.whatsapp_messages (provider_message_id) where provider_message_id is not null;
create index whatsapp_messages_conversation_time_idx
  on public.whatsapp_messages (conversation_id, sent_at asc);

create table public.ops_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  severity text not null default 'error',
  status text not null default 'new',
  source text not null,
  route text,
  title text not null,
  message text not null,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  admin_note text,
  context jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_incidents_fingerprint_check check (char_length(fingerprint) between 8 and 160),
  constraint ops_incidents_severity_check check (severity in ('info', 'warning', 'error', 'critical')),
  constraint ops_incidents_status_check check (status in ('new', 'acknowledged', 'investigating', 'resolved', 'muted')),
  constraint ops_incidents_title_check check (char_length(title) between 3 and 240),
  constraint ops_incidents_message_check check (char_length(message) between 3 and 10000),
  constraint ops_incidents_count_check check (occurrence_count > 0),
  constraint ops_incidents_context_check check (jsonb_typeof(context) = 'object'),
  constraint ops_incidents_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index ops_incidents_triage_idx
  on public.ops_incidents (status, severity, last_seen_at desc);

create table public.platform_settings (
  singleton boolean primary key default true check (singleton),
  support_email text,
  default_timezone text not null default 'Asia/Kolkata',
  default_currency_code text not null default 'INR',
  whatsapp_provider text not null default 'meta_cloud_api',
  whatsapp_enabled boolean not null default false,
  incident_email_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  data_retention_days integer not null default 365,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_support_email_check check (support_email is null or support_email = lower(support_email)),
  constraint platform_settings_currency_check check (default_currency_code ~ '^[A-Z]{3}$'),
  constraint platform_settings_provider_check check (whatsapp_provider in ('meta_cloud_api', 'disabled')),
  constraint platform_settings_retention_check check (data_retention_days between 30 and 3650)
);

insert into public.platform_settings (singleton) values (true) on conflict do nothing;

create trigger guest_profiles_set_updated_at before update on public.guest_profiles
for each row execute function private.set_updated_at();
create trigger operational_cases_set_updated_at before update on public.operational_cases
for each row execute function private.set_updated_at();
create trigger whatsapp_conversations_set_updated_at before update on public.whatsapp_conversations
for each row execute function private.set_updated_at();
create trigger ops_incidents_set_updated_at before update on public.ops_incidents
for each row execute function private.set_updated_at();
create trigger platform_settings_set_updated_at before update on public.platform_settings
for each row execute function private.set_updated_at();

create or replace function private.has_property_permission(
  target_organization_id uuid,
  target_property_id uuid,
  requested_permission_key text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select allowed
    from private.resolve_management_permission(
      target_organization_id,
      target_property_id,
      requested_permission_key,
      'google'
    )
  ), false);
$$;

revoke all on function private.has_property_permission(uuid, uuid, text) from public, anon;
grant execute on function private.has_property_permission(uuid, uuid, text) to authenticated;

alter table public.guest_profiles enable row level security;
alter table public.operational_cases enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.ops_incidents enable row level security;
alter table public.platform_settings enable row level security;

create policy guest_profiles_select_authorized
on public.guest_profiles for select to authenticated
using (
  (select private.has_platform_permission('guests.read'))
  or (select private.has_property_permission(organization_id, property_id, 'guest.manage'))
);

create policy guest_profiles_manage_authorized
on public.guest_profiles for all to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'guest.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy operational_cases_select_authorized
on public.operational_cases for select to authenticated
using (
  (select private.has_platform_permission('cases.read'))
  or (select private.has_property_permission(organization_id, property_id, 'guest.manage'))
);

create policy operational_cases_manage_authorized
on public.operational_cases for all to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'guest.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy whatsapp_conversations_select_authorized
on public.whatsapp_conversations for select to authenticated
using (
  (select private.has_platform_permission('whatsapp.read'))
  or (select private.has_property_permission(organization_id, property_id, 'whatsapp.manage'))
);

create policy whatsapp_conversations_manage_authorized
on public.whatsapp_conversations for all to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy whatsapp_messages_select_authorized
on public.whatsapp_messages for select to authenticated
using (
  (select private.has_platform_permission('whatsapp.read'))
  or (select private.has_property_permission(organization_id, property_id, 'whatsapp.manage'))
);

create policy whatsapp_messages_manage_authorized
on public.whatsapp_messages for all to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy ops_incidents_platform_select
on public.ops_incidents for select to authenticated
using ((select private.has_platform_permission('incidents.manage')));

create policy ops_incidents_platform_update
on public.ops_incidents for update to authenticated
using ((select private.has_platform_permission('incidents.manage')))
with check ((select private.has_platform_permission('incidents.manage')));

create policy platform_settings_platform_select
on public.platform_settings for select to authenticated
using ((select private.has_platform_permission('settings.manage')));

create policy platform_settings_platform_update
on public.platform_settings for update to authenticated
using ((select private.has_platform_permission('settings.manage')))
with check ((select private.has_platform_permission('settings.manage')));

create policy actors_platform_read on public.actors for select to authenticated
using ((select private.has_platform_permission('users.read')));
create policy profiles_platform_read on public.profiles for select to authenticated
using ((select private.has_platform_permission('users.read')));
create policy organizations_platform_read on public.organizations for select to authenticated
using ((select private.has_platform_permission('listings.read')));
create policy properties_platform_read on public.properties for select to authenticated
using ((select private.has_platform_permission('listings.read')));
create policy organization_memberships_platform_read on public.organization_memberships for select to authenticated
using ((select private.has_platform_permission('users.read')));
create policy property_memberships_platform_read on public.property_memberships for select to authenticated
using ((select private.has_platform_permission('users.read')));

revoke all on public.guest_profiles, public.operational_cases, public.whatsapp_conversations,
  public.whatsapp_messages, public.ops_incidents, public.platform_settings from anon, authenticated;

grant select, insert, update on public.guest_profiles to authenticated;
grant select, insert, update on public.operational_cases to authenticated;
grant select, insert, update on public.whatsapp_conversations to authenticated;
grant select, insert, update on public.whatsapp_messages to authenticated;
grant select, update on public.ops_incidents to authenticated;
grant select, update on public.platform_settings to authenticated;

create or replace function private.get_platform_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.has_platform_permission('analytics.read') then
      jsonb_build_object('authorized', false)
    else jsonb_build_object(
      'authorized', true,
      'pendingApprovals', (select count(*) from public.onboarding_requests where status in ('pending', 'under_review')),
      'totalListings', (select count(*) from public.properties),
      'totalUsers', (select count(*) from auth.users),
      'totalGuests', (select count(*) from public.guest_profiles where status = 'active'),
      'openCases', (select count(*) from public.operational_cases where status in ('open', 'in_progress', 'waiting')),
      'unreadWhatsApp', (select coalesce(sum(unread_count), 0) from public.whatsapp_conversations where status = 'active'),
      'openIncidents', (select count(*) from public.ops_incidents where status not in ('resolved', 'muted')),
      'auditEventsToday', (select count(*) from audit.events where occurred_at >= date_trunc('day', now()))
    )
  end;
$$;

create or replace function private.get_platform_users(search_text text default null, result_limit integer default 100)
returns table (
  id uuid,
  email text,
  display_name text,
  actor_type text,
  actor_status text,
  joined_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select users.id, users.email::text, profiles.display_name, actors.actor_type,
    actors.status, users.created_at, users.last_sign_in_at
  from auth.users as users
  join public.profiles on profiles.id = users.id
  join public.actors on actors.id = profiles.actor_id
  where private.has_platform_permission('users.read')
    and (
      nullif(trim(search_text), '') is null
      or users.email ilike '%' || trim(search_text) || '%'
      or profiles.display_name ilike '%' || trim(search_text) || '%'
    )
  order by users.created_at desc
  limit least(greatest(result_limit, 1), 500);
$$;

create or replace function private.get_platform_audit_events(result_limit integer default 100)
returns table (
  id uuid,
  event_name text,
  occurred_at timestamptz,
  actor_type text,
  organization_id uuid,
  property_id uuid,
  target_type text,
  target_id uuid,
  reason_text text,
  source_metadata jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select events.id, events.event_name, events.occurred_at, events.actor_type,
    events.organization_id, events.property_id, events.target_type, events.target_id,
    events.reason_text, events.source_metadata
  from audit.events
  where private.has_platform_permission('audit.read')
  order by events.occurred_at desc
  limit least(greatest(result_limit, 1), 500);
$$;

revoke all on function private.get_platform_dashboard_stats() from public, anon;
revoke all on function private.get_platform_users(text, integer) from public, anon;
revoke all on function private.get_platform_audit_events(integer) from public, anon;
grant execute on function private.get_platform_dashboard_stats() to authenticated;
grant execute on function private.get_platform_users(text, integer) to authenticated;
grant execute on function private.get_platform_audit_events(integer) to authenticated;

create or replace function public.get_platform_dashboard_stats()
returns jsonb language sql stable set search_path = ''
as $$ select private.get_platform_dashboard_stats(); $$;

create or replace function public.get_platform_users(search_text text default null, result_limit integer default 100)
returns table (
  id uuid, email text, display_name text, actor_type text, actor_status text,
  joined_at timestamptz, last_sign_in_at timestamptz
)
language sql stable set search_path = ''
as $$ select * from private.get_platform_users(search_text, result_limit); $$;

create or replace function public.get_platform_audit_events(result_limit integer default 100)
returns table (
  id uuid, event_name text, occurred_at timestamptz, actor_type text,
  organization_id uuid, property_id uuid, target_type text, target_id uuid,
  reason_text text, source_metadata jsonb
)
language sql stable set search_path = ''
as $$ select * from private.get_platform_audit_events(result_limit); $$;

revoke all on function public.get_platform_dashboard_stats() from public, anon;
revoke all on function public.get_platform_users(text, integer) from public, anon;
revoke all on function public.get_platform_audit_events(integer) from public, anon;
grant execute on function public.get_platform_dashboard_stats() to authenticated;
grant execute on function public.get_platform_users(text, integer) to authenticated;
grant execute on function public.get_platform_audit_events(integer) to authenticated;

comment on table public.guest_profiles is 'Property-scoped guest CRM profile. Access is permission resolved and platform support is read-only.';
comment on table public.operational_cases is 'Unified complaint, enquiry, request and feedback queue for hotel operations.';
comment on table public.whatsapp_conversations is 'Property WhatsApp Direct inbox metadata; message payloads live in whatsapp_messages.';
comment on table public.ops_incidents is 'Platform production incident fingerprints and triage state.';

commit;
