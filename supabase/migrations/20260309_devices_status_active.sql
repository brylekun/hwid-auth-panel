-- Ensure device status is always populated and defaults to active.

update public.devices
set status = 'active'
where status is null;

alter table public.devices
alter column status set default 'active';

alter table public.devices
alter column status set not null;
