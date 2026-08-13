begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-media',
  'whatsapp-media',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/3gpp',
    'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_manage_whatsapp_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.whatsapp_conversations conversation
    where conversation.property_id::text = (storage.foldername(object_name))[1]
      and conversation.id::text = (storage.foldername(object_name))[2]
      and private.has_property_permission(
        conversation.organization_id,
        conversation.property_id,
        'whatsapp.manage'
      )
  )
$$;

revoke all on function private.can_manage_whatsapp_media(text) from public, anon;
grant execute on function private.can_manage_whatsapp_media(text) to authenticated;

create policy whatsapp_media_select_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'whatsapp-media'
  and (select private.can_manage_whatsapp_media(name))
);

create policy whatsapp_media_insert_authorized
on storage.objects for insert to authenticated
with check (
  bucket_id = 'whatsapp-media'
  and (select private.can_manage_whatsapp_media(name))
);

create policy whatsapp_media_delete_authorized
on storage.objects for delete to authenticated
using (
  bucket_id = 'whatsapp-media'
  and (select private.can_manage_whatsapp_media(name))
);

drop function public.prepare_whatsapp_outbound(uuid, text, text, text, text, uuid);

create function public.prepare_whatsapp_outbound(
  target_conversation_id uuid,
  message_body text,
  requested_type text default 'text',
  requested_template_name text default null,
  requested_template_language text default null,
  request_id uuid default gen_random_uuid(),
  requested_media_path text default null,
  requested_media_type text default null,
  requested_file_name text default null
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
  normalized_type text := pg_catalog.btrim(coalesce(requested_type, 'text'));
begin
  select * into conversation_row from public.whatsapp_conversations where id = target_conversation_id;
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or not (
    private.has_platform_permission('whatsapp.manage')
    or private.has_property_permission(conversation_row.organization_id, conversation_row.property_id, 'whatsapp.manage')
  ) then raise exception 'whatsapp send permission required' using errcode = '42501'; end if;
  if normalized_type not in ('text', 'template', 'image', 'document', 'audio', 'video') then
    raise exception 'unsupported outbound type' using errcode = '23514';
  end if;
  if conversation_row.status <> 'active' then
    raise exception 'conversation is archived' using errcode = '23514';
  end if;
  if normalized_type <> 'template' and (
    conversation_row.direct_chat_expires_at is null
    or conversation_row.direct_chat_expires_at <= now()
  ) then
    raise exception '24-hour reply window is closed; use an approved template' using errcode = '23514';
  end if;
  if normalized_type = 'text' and char_length(pg_catalog.btrim(coalesce(message_body, ''))) not between 1 and 4096 then
    raise exception 'text message must be 1 to 4096 characters' using errcode = '23514';
  end if;
  if normalized_type = 'template' and nullif(pg_catalog.btrim(requested_template_name), '') is null then
    raise exception 'template name required' using errcode = '23514';
  end if;
  if normalized_type in ('image', 'document', 'audio', 'video') and (
    nullif(pg_catalog.btrim(requested_media_path), '') is null
    or requested_media_type <> normalized_type
    or requested_media_path !~ ('^' || conversation_row.property_id::text || '/' || conversation_row.id::text || '/[A-Za-z0-9_-]+-[^/]+$')
  ) then
    raise exception 'invalid WhatsApp media object' using errcode = '23514';
  end if;
  if requested_file_name is not null and char_length(requested_file_name) > 180 then
    raise exception 'file name is too long' using errcode = '23514';
  end if;
  select * into config_row from public.property_whatsapp_configs
  where property_id = conversation_row.property_id and status in ('configured', 'connected');
  if not found then raise exception 'property WhatsApp is not configured' using errcode = '55000'; end if;
  insert into public.whatsapp_messages (
    conversation_id, organization_id, property_id, direction, sender_type, message_type,
    body, media_url, file_name, delivery_status, client_request_id, template_name, template_language
  ) values (
    conversation_row.id, conversation_row.organization_id, conversation_row.property_id,
    'outbound', 'staff', normalized_type,
    case
      when normalized_type = 'template' then coalesce(nullif(pg_catalog.btrim(message_body), ''), 'Template: ' || requested_template_name)
      else nullif(pg_catalog.btrim(message_body), '')
    end,
    case when normalized_type in ('image', 'document', 'audio', 'video') then 'storage:' || requested_media_path else null end,
    nullif(pg_catalog.btrim(requested_file_name), ''),
    'queued', request_id, nullif(pg_catalog.btrim(requested_template_name), ''),
    nullif(pg_catalog.btrim(requested_template_language), '')
  ) on conflict (client_request_id) where client_request_id is not null do update
    set client_request_id = excluded.client_request_id
  returning id into new_message_id;
  return query select new_message_id, config_row.id, conversation_row.whatsapp_phone,
    config_row.phone_number_id, config_row.graph_api_version;
end;
$$;

revoke all on function public.prepare_whatsapp_outbound(uuid, text, text, text, text, uuid, text, text, text) from public, anon;
grant execute on function public.prepare_whatsapp_outbound(uuid, text, text, text, text, uuid, text, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_conversations'
  ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;
end;
$$;

comment on function private.can_manage_whatsapp_media(text) is
  'Authorizes private WhatsApp media objects by property and conversation path.';

commit;
