create table if not exists public.web_loaders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  download_url text not null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint web_loaders_status_check check (status in ('active', 'inactive'))
);

create unique index if not exists web_loaders_slug_unique
on public.web_loaders (lower(slug));

create index if not exists web_loaders_status_idx
on public.web_loaders (status);

create or replace function public.touch_web_loaders_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_web_loaders_updated_at on public.web_loaders;

create trigger trg_touch_web_loaders_updated_at
before update on public.web_loaders
for each row
execute function public.touch_web_loaders_updated_at();
