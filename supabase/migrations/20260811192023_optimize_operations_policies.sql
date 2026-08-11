create index if not exists guest_profiles_property_fkey_idx
  on public.guest_profiles (property_id, organization_id);

drop policy if exists guest_profiles_manage_authorized on public.guest_profiles;
drop policy if exists operational_cases_manage_authorized on public.operational_cases;
drop policy if exists whatsapp_conversations_manage_authorized on public.whatsapp_conversations;
drop policy if exists whatsapp_messages_manage_authorized on public.whatsapp_messages;

create policy guest_profiles_insert_authorized
on public.guest_profiles for insert to authenticated
with check ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy guest_profiles_update_authorized
on public.guest_profiles for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'guest.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy guest_profiles_delete_authorized
on public.guest_profiles for delete to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy operational_cases_insert_authorized
on public.operational_cases for insert to authenticated
with check ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy operational_cases_update_authorized
on public.operational_cases for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'guest.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy operational_cases_delete_authorized
on public.operational_cases for delete to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'guest.manage')));

create policy whatsapp_conversations_insert_authorized
on public.whatsapp_conversations for insert to authenticated
with check ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy whatsapp_conversations_update_authorized
on public.whatsapp_conversations for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy whatsapp_conversations_delete_authorized
on public.whatsapp_conversations for delete to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy whatsapp_messages_insert_authorized
on public.whatsapp_messages for insert to authenticated
with check ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy whatsapp_messages_update_authorized
on public.whatsapp_messages for update to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')))
with check ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));

create policy whatsapp_messages_delete_authorized
on public.whatsapp_messages for delete to authenticated
using ((select private.has_property_permission(organization_id, property_id, 'whatsapp.manage')));
