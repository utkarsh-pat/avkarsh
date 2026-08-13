begin;

delete from public.onboarding_requests where status = 'rejected';

create or replace function private.delete_rejected_onboarding_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.onboarding_requests where id = new.id;
  return new;
end;
$$;

revoke all on function private.delete_rejected_onboarding_request() from public, anon, authenticated;

drop trigger if exists delete_rejected_onboarding_request_after_review
on public.onboarding_requests;

create trigger delete_rejected_onboarding_request_after_review
after update of status on public.onboarding_requests
for each row
when (new.status = 'rejected' and old.status is distinct from new.status)
execute function private.delete_rejected_onboarding_request();

comment on function private.delete_rejected_onboarding_request() is
  'Removes rejected applicant data immediately; the platform rejection audit event remains as the non-PII record of the decision.';

commit;
