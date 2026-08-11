create index if not exists operational_cases_organization_idx
  on public.operational_cases (organization_id);
create index if not exists operational_cases_property_fkey_idx
  on public.operational_cases (property_id, organization_id);
create index if not exists operational_cases_guest_fkey_idx
  on public.operational_cases (guest_profile_id, organization_id, property_id)
  where guest_profile_id is not null;
create index if not exists operational_cases_assignee_idx
  on public.operational_cases (assigned_to_profile_id)
  where assigned_to_profile_id is not null;
create index if not exists operational_cases_opened_by_idx
  on public.operational_cases (opened_by_actor_id);

create index if not exists whatsapp_conversations_organization_idx
  on public.whatsapp_conversations (organization_id);
create index if not exists whatsapp_conversations_property_fkey_idx
  on public.whatsapp_conversations (property_id, organization_id);
create index if not exists whatsapp_conversations_guest_fkey_idx
  on public.whatsapp_conversations (guest_profile_id, organization_id, property_id)
  where guest_profile_id is not null;
create index if not exists whatsapp_conversations_assignee_idx
  on public.whatsapp_conversations (assigned_to_profile_id)
  where assigned_to_profile_id is not null;

create index if not exists whatsapp_messages_organization_idx
  on public.whatsapp_messages (organization_id);
create index if not exists whatsapp_messages_property_fkey_idx
  on public.whatsapp_messages (property_id, organization_id);
create index if not exists whatsapp_messages_conversation_fkey_idx
  on public.whatsapp_messages (conversation_id, organization_id, property_id);

create index if not exists ops_incidents_assignee_idx
  on public.ops_incidents (assigned_to_profile_id)
  where assigned_to_profile_id is not null;
create index if not exists platform_settings_updated_by_idx
  on public.platform_settings (updated_by_profile_id)
  where updated_by_profile_id is not null;
