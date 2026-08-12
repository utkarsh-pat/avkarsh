create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_net with schema extensions;

alter table public.platform_admins
  drop constraint platform_admins_permissions_check;

alter table public.platform_admins
  add constraint platform_admins_permissions_check
  check (permissions <@ array[
    'onboarding.read', 'onboarding.review', 'subscription.manage',
    'organization.revoke', 'organization.restore', 'listings.read',
    'users.read', 'guests.read', 'cases.read', 'whatsapp.read', 'whatsapp.manage',
    'incidents.manage', 'audit.read', 'analytics.read', 'settings.manage'
  ]::text[]);

create table public.platform_integrations (
  singleton boolean primary key default true check (singleton),
  meta_app_id text,
  meta_credentials_configured boolean not null default false,
  webhook_verify_token_configured boolean not null default false,
  resend_credentials_configured boolean not null default false,
  resend_from_email text,
  resend_from_name text not null default 'Avkarsh Operations',
  edge_functions_base_url text,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_integrations_meta_app_id_check check (meta_app_id is null or meta_app_id ~ '^[0-9]{6,32}$'),
  constraint platform_integrations_resend_email_check check (resend_from_email is null or resend_from_email = lower(resend_from_email)),
  constraint platform_integrations_edge_url_check check (edge_functions_base_url is null or edge_functions_base_url ~ '^https://[^/]+/functions/v1$')
);

insert into public.platform_integrations (singleton) values (true) on conflict do nothing;

create table public.property_whatsapp_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  waba_id text not null,
  phone_number_id text not null unique,
  display_phone_number text not null,
  business_name text,
  graph_api_version text not null default 'v25.0',
  status text not null default 'configured',
  subscribed_at timestamptz,
  templates_synced_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_whatsapp_configs_property_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete cascade,
  constraint property_whatsapp_configs_waba_check check (waba_id ~ '^[0-9]{6,32}$'),
  constraint property_whatsapp_configs_phone_id_check check (phone_number_id ~ '^[0-9]{6,32}$'),
  constraint property_whatsapp_configs_display_phone_check check (display_phone_number ~ '^[+]?[0-9 ()-]{8,24}$'),
  constraint property_whatsapp_configs_graph_version_check check (graph_api_version ~ '^v[0-9]{2}[.][0-9]$'),
  constraint property_whatsapp_configs_status_check check (status in ('configured', 'connected', 'error', 'disabled')),
  unique (property_id),
  unique (id, organization_id, property_id)
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.property_whatsapp_configs(id) on delete cascade,
  organization_id uuid not null,
  property_id uuid not null,
  provider_template_id text,
  name text not null,
  language text not null,
  category text not null,
  status text not null,
  components jsonb not null default '[]'::jsonb,
  quality_score text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_templates_config_fkey foreign key (config_id, organization_id, property_id)
    references public.property_whatsapp_configs(id, organization_id, property_id) on delete cascade,
  constraint whatsapp_templates_name_check check (name ~ '^[a-z0-9_]{1,512}$'),
  constraint whatsapp_templates_components_check check (jsonb_typeof(components) = 'array'),
  unique (config_id, name, language)
);

alter table public.whatsapp_messages add column client_request_id uuid;
alter table public.whatsapp_messages add column provider_error text;
alter table public.whatsapp_messages add column template_name text;
alter table public.whatsapp_messages add column template_language text;
create unique index whatsapp_messages_client_request_unique_idx
  on public.whatsapp_messages (client_request_id) where client_request_id is not null;

create table public.whatsapp_webhook_receipts (
  delivery_id text primary key,
  phone_number_id text,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default 'received',
  error_message text,
  constraint whatsapp_webhook_receipts_hash_check check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint whatsapp_webhook_receipts_outcome_check check (outcome in ('received', 'processed', 'ignored', 'failed'))
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  deduplication_key text not null unique,
  event_type text not null,
  channel text not null default 'email',
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_event_check check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint notification_deliveries_channel_check check (channel in ('email')),
  constraint notification_deliveries_recipient_check check (recipient = lower(recipient)),
  constraint notification_deliveries_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint notification_deliveries_status_check check (status in ('queued', 'processing', 'sent', 'retry', 'dead_letter')),
  constraint notification_deliveries_attempts_check check (attempts between 0 and max_attempts and max_attempts between 1 and 20)
);

create table private.integration_credentials (
  singleton boolean primary key default true check (singleton),
  meta_app_secret_id uuid,
  webhook_verify_token_secret_id uuid,
  resend_api_key_secret_id uuid,
  dispatch_token_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.property_whatsapp_credentials (
  config_id uuid primary key references public.property_whatsapp_configs(id) on delete cascade,
  access_token_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.integration_credentials (singleton, dispatch_token_secret_id)
values (
  true,
  vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'avkarsh_notification_dispatch_token', 'Internal notification dispatcher authentication')
)
on conflict (singleton) do nothing;

create index property_whatsapp_configs_property_fkey_idx on public.property_whatsapp_configs (property_id, organization_id);
create index property_whatsapp_configs_waba_idx on public.property_whatsapp_configs (waba_id);
create index whatsapp_templates_property_idx on public.whatsapp_templates (property_id, status, name);
create index whatsapp_templates_config_fkey_idx on public.whatsapp_templates (config_id, organization_id, property_id);
create index whatsapp_webhook_receipts_received_idx on public.whatsapp_webhook_receipts (received_at desc);
create index notification_deliveries_ready_idx on public.notification_deliveries (available_at, created_at) where status in ('queued', 'retry');
create index notification_deliveries_status_idx on public.notification_deliveries (status, created_at desc);
create index platform_integrations_updated_by_idx on public.platform_integrations (updated_by_profile_id) where updated_by_profile_id is not null;
create index property_whatsapp_configs_creator_idx on public.property_whatsapp_configs (created_by_profile_id) where created_by_profile_id is not null;
create index property_whatsapp_configs_updater_idx on public.property_whatsapp_configs (updated_by_profile_id) where updated_by_profile_id is not null;

create trigger platform_integrations_set_updated_at before update on public.platform_integrations
for each row execute function private.set_updated_at();
create trigger property_whatsapp_configs_set_updated_at before update on public.property_whatsapp_configs
for each row execute function private.set_updated_at();
create trigger whatsapp_templates_set_updated_at before update on public.whatsapp_templates
for each row execute function private.set_updated_at();
create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries
for each row execute function private.set_updated_at();

alter table public.platform_integrations enable row level security;
alter table public.property_whatsapp_configs enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_webhook_receipts enable row level security;
alter table public.notification_deliveries enable row level security;
alter table private.integration_credentials enable row level security;
alter table private.property_whatsapp_credentials enable row level security;

revoke all on public.platform_integrations, public.property_whatsapp_configs, public.whatsapp_templates,
  public.whatsapp_webhook_receipts, public.notification_deliveries from public, anon;
grant select on public.platform_integrations, public.property_whatsapp_configs, public.whatsapp_templates,
  public.notification_deliveries to authenticated;
grant select, insert, update, delete on public.property_whatsapp_configs, public.whatsapp_templates to service_role;
grant select, insert, update, delete on public.whatsapp_webhook_receipts to service_role;
grant select, insert, update on public.notification_deliveries to service_role;
revoke all on private.integration_credentials, private.property_whatsapp_credentials from public, anon, authenticated;

create policy platform_integrations_admin_read on public.platform_integrations for select to authenticated
using ((select private.has_platform_permission('settings.manage')));

create policy property_whatsapp_configs_read on public.property_whatsapp_configs for select to authenticated
using (
  (select private.has_platform_permission('whatsapp.read'))
  or (select private.has_property_permission(organization_id, property_id, 'whatsapp.manage'))
);

create policy whatsapp_templates_read on public.whatsapp_templates for select to authenticated
using (
  (select private.has_platform_permission('whatsapp.read'))
  or (select private.has_property_permission(organization_id, property_id, 'whatsapp.manage'))
);

create policy notification_deliveries_admin_read on public.notification_deliveries for select to authenticated
using ((select private.has_platform_permission('incidents.manage')));

create or replace function private.put_vault_secret(
  current_secret_id uuid,
  secret_value text,
  secret_name text,
  secret_description text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, vault
as $$
begin
  if nullif(pg_catalog.btrim(secret_value), '') is null then
    return current_secret_id;
  end if;
  if current_secret_id is null then
    return vault.create_secret(secret_value, secret_name, secret_description);
  end if;
  perform vault.update_secret(current_secret_id, secret_value, secret_name, secret_description);
  return current_secret_id;
end;
$$;

revoke all on function private.put_vault_secret(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.configure_platform_integrations(
  p_meta_app_id text,
  p_meta_app_secret text,
  p_webhook_verify_token text,
  p_resend_api_key text,
  p_resend_from_email text,
  p_resend_from_name text,
  p_edge_functions_base_url text
)
returns public.platform_integrations
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault
as $$
declare
  profile_id uuid;
  credential_row private.integration_credentials%rowtype;
  result public.platform_integrations%rowtype;
begin
  if auth.uid() is null or not private.has_platform_permission('settings.manage') then
    raise exception 'platform settings permission required' using errcode = '42501';
  end if;
  select id into profile_id from public.profiles where id = auth.uid();
  select * into credential_row from private.integration_credentials where singleton = true for update;
  credential_row.meta_app_secret_id := private.put_vault_secret(
    credential_row.meta_app_secret_id, p_meta_app_secret, 'avkarsh_meta_app_secret', 'Meta app secret for WhatsApp webhook signatures'
  );
  credential_row.webhook_verify_token_secret_id := private.put_vault_secret(
    credential_row.webhook_verify_token_secret_id, p_webhook_verify_token, 'avkarsh_whatsapp_verify_token', 'Meta WhatsApp webhook verification token'
  );
  credential_row.resend_api_key_secret_id := private.put_vault_secret(
    credential_row.resend_api_key_secret_id, p_resend_api_key, 'avkarsh_resend_api_key', 'Resend API key for operations alerts'
  );
  update private.integration_credentials set
    meta_app_secret_id = credential_row.meta_app_secret_id,
    webhook_verify_token_secret_id = credential_row.webhook_verify_token_secret_id,
    resend_api_key_secret_id = credential_row.resend_api_key_secret_id,
    updated_at = now()
  where singleton = true;
  update public.platform_integrations set
    meta_app_id = nullif(pg_catalog.btrim(p_meta_app_id), ''),
    meta_credentials_configured = credential_row.meta_app_secret_id is not null,
    webhook_verify_token_configured = credential_row.webhook_verify_token_secret_id is not null,
    resend_credentials_configured = credential_row.resend_api_key_secret_id is not null,
    resend_from_email = nullif(lower(pg_catalog.btrim(p_resend_from_email)), ''),
    resend_from_name = coalesce(nullif(pg_catalog.btrim(p_resend_from_name), ''), 'Avkarsh Operations'),
    edge_functions_base_url = nullif(pg_catalog.rtrim(pg_catalog.btrim(p_edge_functions_base_url), '/'), ''),
    updated_by_profile_id = profile_id,
    updated_at = now()
  where singleton = true returning * into result;
  return result;
end;
$$;

create or replace function public.configure_property_whatsapp(
  target_property_id uuid,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_business_name text,
  p_access_token text,
  p_graph_api_version text default 'v25.0'
)
returns public.property_whatsapp_configs
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault
as $$
declare
  property_row public.properties%rowtype;
  profile_id uuid;
  config_row public.property_whatsapp_configs%rowtype;
  credential_row private.property_whatsapp_credentials%rowtype;
  token_secret_id uuid;
begin
  select * into property_row from public.properties where id = target_property_id;
  if not found then raise exception 'property not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or not (
    private.has_platform_permission('settings.manage')
    or private.has_property_permission(property_row.organization_id, property_row.id, 'whatsapp.manage')
  ) then raise exception 'whatsapp management permission required' using errcode = '42501'; end if;
  select id into profile_id from public.profiles where id = auth.uid();
  insert into public.property_whatsapp_configs (
    organization_id, property_id, waba_id, phone_number_id, display_phone_number,
    business_name, graph_api_version, status, created_by_profile_id, updated_by_profile_id
  ) values (
    property_row.organization_id, property_row.id, pg_catalog.btrim(p_waba_id), pg_catalog.btrim(p_phone_number_id),
    pg_catalog.btrim(p_display_phone_number), nullif(pg_catalog.btrim(p_business_name), ''), pg_catalog.btrim(p_graph_api_version),
    'configured', profile_id, profile_id
  ) on conflict (property_id) do update set
    waba_id = excluded.waba_id,
    phone_number_id = excluded.phone_number_id,
    display_phone_number = excluded.display_phone_number,
    business_name = excluded.business_name,
    graph_api_version = excluded.graph_api_version,
    status = case when public.property_whatsapp_configs.status = 'connected' then 'connected' else 'configured' end,
    updated_by_profile_id = profile_id,
    updated_at = now()
  returning * into config_row;
  select * into credential_row from private.property_whatsapp_credentials where config_id = config_row.id for update;
  token_secret_id := private.put_vault_secret(
    credential_row.access_token_secret_id, p_access_token,
    'avkarsh_whatsapp_token_' || config_row.id::text,
    'Meta system-user access token for property ' || property_row.id::text
  );
  if token_secret_id is null then raise exception 'access token required for first configuration' using errcode = '23514'; end if;
  insert into private.property_whatsapp_credentials (config_id, access_token_secret_id)
  values (config_row.id, token_secret_id)
  on conflict (config_id) do update set access_token_secret_id = excluded.access_token_secret_id, updated_at = now();
  return config_row;
end;
$$;

create or replace function public.prepare_whatsapp_outbound(
  target_conversation_id uuid,
  message_body text,
  requested_type text default 'text',
  requested_template_name text default null,
  requested_template_language text default null,
  request_id uuid default gen_random_uuid()
)
returns table(message_id uuid, config_id uuid, recipient text, phone_number_id text, graph_api_version text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  conversation_row public.whatsapp_conversations%rowtype;
  config_row public.property_whatsapp_configs%rowtype;
  new_message_id uuid;
begin
  select * into conversation_row from public.whatsapp_conversations where id = target_conversation_id;
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or not (
    private.has_platform_permission('whatsapp.manage')
    or private.has_property_permission(conversation_row.organization_id, conversation_row.property_id, 'whatsapp.manage')
  ) then raise exception 'whatsapp send permission required' using errcode = '42501'; end if;
  if requested_type not in ('text', 'template') then raise exception 'unsupported outbound type' using errcode = '23514'; end if;
  if requested_type = 'text' and char_length(pg_catalog.btrim(coalesce(message_body, ''))) not between 1 and 4096 then
    raise exception 'text message must be 1 to 4096 characters' using errcode = '23514';
  end if;
  if requested_type = 'template' and nullif(pg_catalog.btrim(requested_template_name), '') is null then
    raise exception 'template name required' using errcode = '23514';
  end if;
  select * into config_row from public.property_whatsapp_configs
  where property_id = conversation_row.property_id and status in ('configured', 'connected');
  if not found then raise exception 'property WhatsApp is not configured' using errcode = '55000'; end if;
  insert into public.whatsapp_messages (
    conversation_id, organization_id, property_id, direction, sender_type, message_type,
    body, delivery_status, client_request_id, template_name, template_language
  ) values (
    conversation_row.id, conversation_row.organization_id, conversation_row.property_id,
    'outbound', 'staff', requested_type, coalesce(nullif(pg_catalog.btrim(message_body), ''), 'Template: ' || requested_template_name),
    'queued', request_id, nullif(pg_catalog.btrim(requested_template_name), ''),
    nullif(pg_catalog.btrim(requested_template_language), '')
  ) on conflict (client_request_id) where client_request_id is not null do update
    set client_request_id = excluded.client_request_id
  returning id into new_message_id;
  return query select new_message_id, config_row.id, conversation_row.whatsapp_phone,
    config_row.phone_number_id, config_row.graph_api_version;
end;
$$;

create or replace function public.get_whatsapp_service_config(target_config_id uuid default null, target_phone_number_id text default null)
returns table(config_id uuid, property_id uuid, organization_id uuid, waba_id text, phone_number_id text,
  graph_api_version text, access_token text)
language sql
security definer
set search_path = pg_catalog, public, private, vault
as $$
  select c.id, c.property_id, c.organization_id, c.waba_id, c.phone_number_id, c.graph_api_version, s.decrypted_secret
  from public.property_whatsapp_configs c
  join private.property_whatsapp_credentials pc on pc.config_id = c.id
  join vault.decrypted_secrets s on s.id = pc.access_token_secret_id
  where (target_config_id is not null and c.id = target_config_id)
     or (target_phone_number_id is not null and c.phone_number_id = target_phone_number_id)
  limit 1
$$;

create or replace function public.get_platform_service_credentials()
returns table(meta_app_secret text, webhook_verify_token text, resend_api_key text, dispatch_token text,
  resend_from_email text, resend_from_name text, edge_functions_base_url text)
language sql
security definer
set search_path = pg_catalog, public, private, vault
as $$
  select meta_secret.decrypted_secret, verify_secret.decrypted_secret, resend_secret.decrypted_secret,
    dispatch_secret.decrypted_secret, p.resend_from_email, p.resend_from_name, p.edge_functions_base_url
  from private.integration_credentials c
  join public.platform_integrations p on p.singleton = c.singleton
  left join vault.decrypted_secrets meta_secret on meta_secret.id = c.meta_app_secret_id
  left join vault.decrypted_secrets verify_secret on verify_secret.id = c.webhook_verify_token_secret_id
  left join vault.decrypted_secrets resend_secret on resend_secret.id = c.resend_api_key_secret_id
  join vault.decrypted_secrets dispatch_secret on dispatch_secret.id = c.dispatch_token_secret_id
  where c.singleton = true
$$;

revoke all on function public.configure_platform_integrations(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.configure_property_whatsapp(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.prepare_whatsapp_outbound(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.configure_platform_integrations(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.configure_property_whatsapp(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.prepare_whatsapp_outbound(uuid, text, text, text, text, uuid) to authenticated;
revoke all on function public.get_whatsapp_service_config(uuid, text), public.get_platform_service_credentials() from public, anon, authenticated;
grant execute on function public.get_whatsapp_service_config(uuid, text), public.get_platform_service_credentials() to service_role;

create or replace function private.queue_ops_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  destination text;
  notification_key text;
begin
  select support_email into destination from public.platform_settings
  where singleton = true and incident_email_enabled = true;
  if destination is null then return new; end if;
  if tg_table_name = 'ops_incidents' then
    if new.severity not in ('error', 'critical') or new.status in ('resolved', 'muted') then return new; end if;
    notification_key := 'incident:' || new.id::text || ':' || new.occurrence_count::text;
    insert into public.notification_deliveries (deduplication_key, event_type, recipient, subject, payload)
    values (notification_key, 'incident.alert', destination,
      '[' || upper(new.severity) || '] ' || new.title,
      jsonb_build_object('title', new.title, 'message', new.message, 'severity', new.severity,
        'status', new.status, 'source', new.source, 'route', new.route, 'occurrenceCount', new.occurrence_count,
        'lastSeenAt', new.last_seen_at)) on conflict (deduplication_key) do nothing;
  elsif tg_table_name = 'onboarding_requests' then
    notification_key := 'onboarding:' || new.id::text;
    insert into public.notification_deliveries (deduplication_key, event_type, recipient, subject, payload)
    values (notification_key, 'onboarding.requested', destination,
      'New property enquiry: ' || new.property_name,
      jsonb_build_object('propertyName', new.property_name, 'contactName', new.contact_name,
        'contactEmail', new.contact_email, 'contactPhone', new.contact_phone, 'city', new.city,
        'state', new.state, 'createdAt', new.created_at)) on conflict (deduplication_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger ops_incidents_queue_notification after insert or update of occurrence_count, severity, status on public.ops_incidents
for each row execute function private.queue_ops_notification();
create trigger onboarding_requests_queue_notification after insert on public.onboarding_requests
for each row execute function private.queue_ops_notification();

create or replace function private.kick_notification_dispatch()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault, extensions
as $$
declare
  base_url text;
  dispatch_token text;
begin
  select p.edge_functions_base_url, s.decrypted_secret
  into base_url, dispatch_token
  from public.platform_integrations p
  join private.integration_credentials c on c.singleton = p.singleton
  join vault.decrypted_secrets s on s.id = c.dispatch_token_secret_id
  where p.singleton = true;
  if base_url is not null and dispatch_token is not null then
    perform net.http_post(
      url := base_url || '/notification-dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-avkarsh-dispatch-token', dispatch_token),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

create trigger notification_deliveries_dispatch after insert on public.notification_deliveries
for each statement execute function private.kick_notification_dispatch();

comment on table public.property_whatsapp_configs is 'Non-secret Meta WhatsApp Cloud API configuration per hotel property.';
comment on table private.property_whatsapp_credentials is 'Vault secret references only; never exposed through the Data API.';
comment on table public.whatsapp_webhook_receipts is 'Idempotency receipts for signed Meta webhook deliveries; service-role only.';
comment on table public.notification_deliveries is 'Retryable operations-email delivery queue; no payment or subscription events.';
