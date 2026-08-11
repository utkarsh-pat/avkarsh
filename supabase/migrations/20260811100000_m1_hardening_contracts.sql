begin;

-- These tables are intentionally server-owned. Browser clients only receive the
-- RLS-safe tenancy projections from the identity foundation migration.
create table public.membership_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid,
  invitation_kind text not null,
  intended_email_hash text not null,
  intended_role_ids uuid[] not null default '{}',
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  claimed_by_profile_id uuid references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  approved_by_actor_id uuid references public.actors(id) on delete restrict,
  approved_at timestamptz,
  created_by_actor_id uuid not null references public.actors(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint membership_invitations_kind_check
    check (invitation_kind in ('owner', 'partner', 'manager', 'member')),
  constraint membership_invitations_status_check
    check (status in ('pending', 'claimed', 'approved', 'expired', 'revoked')),
  constraint membership_invitations_expiry_check check (expires_at > created_at),
  constraint membership_invitations_property_scope_check
    check (invitation_kind = 'member' or property_id is null),
  constraint membership_invitations_property_fkey
    foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint membership_invitations_claim_check
    check ((status in ('claimed', 'approved') and claimed_by_profile_id is not null and claimed_at is not null)
      or (status not in ('claimed', 'approved') and claimed_by_profile_id is null and claimed_at is null)),
  constraint membership_invitations_approval_check
    check ((status = 'approved' and approved_by_actor_id is not null and approved_at is not null)
      or (status <> 'approved' and approved_by_actor_id is null and approved_at is null))
);

comment on table public.membership_invitations is
  'Server-owned, single-use invitation workflow. Claiming never activates a membership; approval is required.';

create index membership_invitations_org_status_idx
  on public.membership_invitations (organization_id, status, expires_at);
create index membership_invitations_claimant_idx
  on public.membership_invitations (claimed_by_profile_id) where claimed_by_profile_id is not null;

create table public.recovery_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  case_type text not null,
  status text not null default 'opened',
  claimant_profile_id uuid references public.profiles(id) on delete restrict,
  evidence_reference text not null,
  independent_approver_actor_id uuid references public.actors(id) on delete restrict,
  approved_at timestamptz,
  cooling_ends_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recovery_cases_type_check check (case_type in ('lost_access', 'sole_owner')),
  constraint recovery_cases_status_check check (status in ('opened', 'under_review', 'approved', 'cooling', 'completed', 'rejected', 'cancelled')),
  constraint recovery_cases_evidence_reference_check check (char_length(evidence_reference) between 8 and 500),
  constraint recovery_cases_approval_check check (
    (status in ('approved', 'cooling', 'completed') and independent_approver_actor_id is not null and approved_at is not null)
    or (status not in ('approved', 'cooling', 'completed') and independent_approver_actor_id is null and approved_at is null)
  ),
  constraint recovery_cases_cooling_check check (
    (status in ('cooling', 'completed') and cooling_ends_at is not null)
    or (status not in ('cooling', 'completed') and cooling_ends_at is null)
  ),
  constraint recovery_cases_completion_check check ((status = 'completed') = (completed_at is not null))
);

create index recovery_cases_org_status_idx on public.recovery_cases (organization_id, status, created_at desc);
create trigger recovery_cases_set_updated_at before update on public.recovery_cases
for each row execute function private.set_updated_at();

create table private.command_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid,
  actor_id uuid references public.actors(id) on delete restrict,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'started',
  result_type text,
  result_id uuid,
  response_snapshot jsonb,
  request_id uuid not null,
  correlation_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint command_receipts_operation_check check (operation ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint command_receipts_property_fkey
    foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint command_receipts_key_check check (char_length(idempotency_key) between 16 and 255),
  constraint command_receipts_hash_check check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint command_receipts_status_check check (status in ('started', 'completed', 'failed')),
  constraint command_receipts_expiry_check check (expires_at > created_at),
  constraint command_receipts_completion_check check (
    (status = 'started' and completed_at is null) or (status <> 'started' and completed_at is not null)
  ),
  constraint command_receipts_response_check check (
    (status = 'completed' and response_snapshot is not null) or status <> 'completed'
  ),
  unique (organization_id, property_id, operation, idempotency_key)
);

comment on table private.command_receipts is
  'Idempotency contract: the application compares request_hash on key reuse and returns conflict on mismatch.';
create index command_receipts_expiry_idx on private.command_receipts (expires_at);

create table audit.events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_version smallint not null default 1,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.actors(id) on delete restrict,
  actor_type text not null,
  authentication_mode text not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  property_id uuid,
  target_type text not null,
  target_id uuid,
  reason_code text,
  reason_text text,
  request_id uuid not null,
  correlation_id uuid not null,
  safe_before_summary jsonb,
  safe_after_summary jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  constraint audit_events_name_check check (event_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint audit_events_property_fkey
    foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint audit_events_version_check check (event_version > 0),
  constraint audit_events_actor_type_check check (actor_type in ('management', 'staff', 'platform', 'guest', 'system')),
  constraint audit_events_authentication_mode_check check (authentication_mode in ('google', 'device_pin', 'service', 'guest_portal', 'platform')),
  constraint audit_events_target_type_check check (target_type ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_events_reason_text_check check (reason_text is null or char_length(reason_text) between 3 and 500),
  constraint audit_events_summaries_check check (
    (safe_before_summary is null or jsonb_typeof(safe_before_summary) = 'object')
    and (safe_after_summary is null or jsonb_typeof(safe_after_summary) = 'object')
    and jsonb_typeof(source_metadata) = 'object'
  )
);

comment on table audit.events is
  'Append-only critical audit envelope. Safe summaries must exclude credentials, PIN/KYC/payment secrets and full provider payloads.';
create index audit_events_tenant_time_idx on audit.events (organization_id, occurred_at desc);
create index audit_events_target_idx on audit.events (target_type, target_id, occurred_at desc);
create index audit_events_correlation_idx on audit.events (correlation_id, occurred_at desc);

create or replace function audit.prevent_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit events are append-only';
end;
$$;
revoke execute on function audit.prevent_event_mutation() from public, anon, authenticated;
create trigger audit_events_immutable before update or delete on audit.events
for each row execute function audit.prevent_event_mutation();

create table private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  property_id uuid,
  event_type text not null,
  schema_version smallint not null default 1,
  payload jsonb not null,
  status text not null default 'ready',
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  attempts smallint not null default 0,
  max_attempts smallint not null default 8,
  last_error_safe text,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  request_id uuid not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint outbox_events_type_check check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint outbox_events_property_fkey
    foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  constraint outbox_events_version_check check (schema_version > 0),
  constraint outbox_events_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint outbox_events_status_check check (status in ('ready', 'leased', 'delivered', 'dead_letter')),
  constraint outbox_events_attempts_check check (attempts between 0 and max_attempts and max_attempts between 1 and 100),
  constraint outbox_events_lease_check check ((status = 'leased') = (lease_owner is not null and lease_expires_at is not null)),
  constraint outbox_events_delivery_check check ((status = 'delivered') = (delivered_at is not null)),
  constraint outbox_events_dead_letter_check check ((status = 'dead_letter') = (dead_lettered_at is not null))
);

comment on table private.outbox_events is
  'Retryable external delivery queue. Workers acquire rows with FOR UPDATE SKIP LOCKED and recover expired leases.';
create index outbox_events_ready_idx on private.outbox_events (available_at, created_at) where status = 'ready';
create index outbox_events_lease_recovery_idx on private.outbox_events (lease_expires_at) where status = 'leased';

alter table public.membership_invitations enable row level security;
alter table public.recovery_cases enable row level security;
alter table private.command_receipts enable row level security;
alter table audit.events enable row level security;
alter table private.outbox_events enable row level security;

revoke all on public.membership_invitations, public.recovery_cases from anon, authenticated;
revoke all on private.command_receipts, private.outbox_events from public, anon, authenticated;
revoke all on audit.events from public, anon, authenticated;

commit;
