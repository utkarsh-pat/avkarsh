begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select has_table('public', 'property_whatsapp_configs', 'hotel WhatsApp configuration exists');
select has_table('public', 'whatsapp_templates', 'WhatsApp templates exist');
select has_table('public', 'whatsapp_webhook_receipts', 'webhook idempotency receipts exist');
select has_table('public', 'notification_deliveries', 'notification delivery queue exists');
select has_function('public', 'prepare_whatsapp_outbound', array['uuid', 'text', 'text', 'text', 'text', 'uuid'], 'outbound preparation RPC exists');
select has_function('public', 'get_platform_service_credentials', array[]::text[], 'service credential RPC exists');

select results_eq(
  $$select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'property_whatsapp_configs'$$,
  array[true],
  'WhatsApp configuration uses RLS'
);

select results_eq(
  $$select has_table_privilege('anon', 'public.whatsapp_webhook_receipts', 'select')$$,
  array[false],
  'anonymous clients cannot read webhook receipts'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.get_platform_service_credentials()', 'execute')$$,
  array[false],
  'authenticated clients cannot decrypt provider credentials'
);

select results_eq(
  $$select count(*)::bigint from public.platform_admins where not (permissions <@ array['onboarding.read','onboarding.review','subscription.manage','organization.revoke','organization.restore','listings.read','users.read','guests.read','cases.read','whatsapp.read','whatsapp.manage','incidents.manage','audit.read','analytics.read','settings.manage']::text[])$$,
  array[0::bigint],
  'all platform permission arrays remain constrained'
);

select * from finish();
rollback;
