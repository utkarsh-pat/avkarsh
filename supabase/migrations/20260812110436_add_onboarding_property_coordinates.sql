alter table public.onboarding_requests
  add column latitude double precision,
  add column longitude double precision,
  add constraint onboarding_requests_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );

comment on column public.onboarding_requests.latitude is
  'Applicant-confirmed property pin latitude.';
comment on column public.onboarding_requests.longitude is
  'Applicant-confirmed property pin longitude.';
