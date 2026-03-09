-- Harden HWID auth model:
-- 1) Uniqueness/index constraints
-- 2) Atomic bind function to prevent race conditions on max_devices

create unique index if not exists licenses_license_key_key
  on public.licenses (license_key);

create unique index if not exists devices_license_hwid_unique
  on public.devices (license_id, hwid_hash);

create index if not exists devices_license_id_idx
  on public.devices (license_id);

create index if not exists auth_logs_created_at_idx
  on public.auth_logs (created_at desc);

create index if not exists auth_logs_license_key_idx
  on public.auth_logs (license_key);

create or replace function public.bind_device_if_allowed(
  p_license_key text,
  p_hwid_hash text,
  p_device_name text default null
)
returns table(success boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses%rowtype;
  v_device_id uuid;
  v_device_count bigint;
begin
  select *
    into v_license
  from public.licenses
  where license_key = p_license_key
  for update;

  if not found then
    return query select false, 'license_not_found';
    return;
  end if;

  if v_license.status <> 'active' then
    return query select false, 'license_inactive';
    return;
  end if;

  if v_license.expires_at is not null and v_license.expires_at < now() then
    return query select false, 'license_expired';
    return;
  end if;

  select id
    into v_device_id
  from public.devices
  where license_id = v_license.id
    and hwid_hash = p_hwid_hash
  for update;

  if found then
    update public.devices
    set
      last_seen_at = now(),
      device_name = coalesce(nullif(p_device_name, ''), device_name)
    where id = v_device_id;

    return query select true, 'known_device';
    return;
  end if;

  select count(*)
    into v_device_count
  from public.devices
  where license_id = v_license.id;

  if v_device_count >= v_license.max_devices then
    return query select false, 'device_limit_reached';
    return;
  end if;

  insert into public.devices (license_id, hwid_hash, device_name, status, first_seen_at, last_seen_at)
  values (
    v_license.id,
    p_hwid_hash,
    coalesce(nullif(p_device_name, ''), 'Unknown device'),
    'active',
    now(),
    now()
  );

  return query select true, 'new_device_bound';
end;
$$;

revoke all on function public.bind_device_if_allowed(text, text, text) from public;
grant execute on function public.bind_device_if_allowed(text, text, text) to service_role;
