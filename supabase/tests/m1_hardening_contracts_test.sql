begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select has_table('public', 'membership_invitations', 'membership invitation workflow exists');
select has_table('public', 'recovery_cases', 'recovery case workflow exists');
select has_table('private', 'command_receipts', 'idempotency receipt store exists');
select has_table('audit', 'events', 'append-only audit store exists');
select has_table('private', 'outbox_events', 'recoverable outbox exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.membership_invitations'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.recovery_cases'::regclass)
  and (select relrowsecurity from pg_class where oid = 'private.command_receipts'::regclass)
  and (select relrowsecurity from pg_class where oid = 'audit.events'::regclass)
  and (select relrowsecurity from pg_class where oid = 'private.outbox_events'::regclass),
  'M1 hardening tables enable RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.membership_invitations', 'SELECT')
  and not has_table_privilege('authenticated', 'public.recovery_cases', 'INSERT')
  and not has_table_privilege('authenticated', 'private.command_receipts', 'SELECT')
  and not has_table_privilege('authenticated', 'audit.events', 'SELECT')
  and not has_table_privilege('authenticated', 'private.outbox_events', 'SELECT'),
  'browser clients have no direct access to server-owned workflow and audit tables'
);

select throws_ok(
  $$insert into public.membership_invitations (
    organization_id, invitation_kind, intended_email_hash, token_hash, expires_at, created_by_actor_id
  ) values (
    '00000000-0000-0000-0000-000000000000', 'owner', 'hash', 'token', now() + interval '1 day', '00000000-0000-0000-0000-000000000000'
  )$$,
  '23503', null, 'invitation references an existing tenant and actor'
);

select throws_ok(
  $$insert into private.command_receipts (
    organization_id, operation, idempotency_key, request_hash, request_id, correlation_id, expires_at
  ) values (
    '00000000-0000-0000-0000-000000000000', 'membership.invite', 'too-short', 'invalid',
    '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', now() + interval '1 day'
  )$$,
  '23514', null, 'command receipt validates idempotency key and canonical request hash'
);

select has_trigger('audit', 'events', 'audit_events_immutable', 'audit events have an immutable trigger');

select * from finish();
rollback;
