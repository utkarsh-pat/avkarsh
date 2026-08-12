-- Column-level INSERT grants do not automatically include columns added later.
-- Keep public onboarding narrowly write-only while allowing the location and
-- inventory fields introduced after the original grant list.
grant insert (latitude, longitude, inventory_unit)
on public.onboarding_requests to anon, authenticated;
