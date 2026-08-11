alter table public.onboarding_requests
  alter column requested_plan set default 'pending_admin_review',
  alter column requested_permissions set default '{}'::text[];

alter table public.onboarding_requests
  drop constraint onboarding_requests_requested_plan_check;

alter table public.onboarding_requests
  add constraint onboarding_requests_requested_plan_check
  check (requested_plan in (
    'pending_admin_review', 'trial', 'starter', 'growth', 'enterprise'
  ));

comment on column public.onboarding_requests.requested_plan is
  'Customer preference when supplied; pending_admin_review means commercial terms are decided by the platform team.';

comment on column public.onboarding_requests.requested_permissions is
  'Optional customer-requested scope. An empty array means the platform team decides permissions during review.';
