-- 1. User profile: one row per Supabase Auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 100)
);

-- 2. Vehicles owned by a user.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  nickname text,
  make text not null,
  model text not null,
  model_year smallint,
  trim text,
  color text,
  license_plate text,
  vin text,

  current_odometer integer not null default 0,
  odometer_unit text not null default 'km',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Required for composite foreign keys on child tables.
  constraint vehicles_id_user_id_unique unique (id, user_id),

  constraint vehicles_make_not_blank
    check (char_length(trim(make)) > 0),
  constraint vehicles_model_not_blank
    check (char_length(trim(model)) > 0),
  constraint vehicles_year_valid
    check (model_year is null or model_year between 1886 and 2100),
  constraint vehicles_odometer_nonnegative
    check (current_odometer >= 0),
  constraint vehicles_odometer_unit_valid
    check (odometer_unit in ('km', 'mi')),
  constraint vehicles_nickname_length
    check (nickname is null or char_length(nickname) <= 100)
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid not null,

  title text not null,
  category text not null default 'other',
  description text,
  service_date date not null default current_date,
  odometer integer,
  cost numeric(12, 2) not null default 0,
  currency text not null default 'PHP',
  shop_name text,
  receipt_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maintenance_vehicle_owner_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on delete cascade,

  constraint maintenance_title_not_blank
    check (char_length(trim(title)) > 0),
  constraint maintenance_category_valid
    check (
      category in (
        'oil_change', 'repair', 'inspection', 'tires',
        'brakes', 'battery', 'fluids', 'other'
      )
    ),
  constraint maintenance_odometer_nonnegative
    check (odometer is null or odometer >= 0),
  constraint maintenance_cost_nonnegative
    check (cost >= 0),
  constraint maintenance_currency_format
    check (currency ~ '^[A-Z]{3}$')
);

create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid not null,

  fill_date date not null default current_date,
  odometer integer not null,
  liters numeric(10, 3) not null,
  price_per_liter numeric(10, 3) not null,
  total_cost numeric(12, 2) not null,
  fuel_type text,
  full_tank boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fuel_vehicle_owner_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on delete cascade,

  constraint fuel_odometer_nonnegative
    check (odometer >= 0),
  constraint fuel_liters_positive
    check (liters > 0),
  constraint fuel_price_nonnegative
    check (price_per_liter >= 0),
  constraint fuel_total_cost_nonnegative
    check (total_cost >= 0)
);

create table public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid not null,

  title text not null,
  description text,
  due_date date,
  due_odometer integer,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminder_vehicle_owner_fk
    foreign key (vehicle_id, user_id)
    references public.vehicles (id, user_id)
    on delete cascade,

  constraint reminder_title_not_blank
    check (char_length(trim(title)) > 0),
  constraint reminder_due_date_or_odometer
    check (due_date is not null or due_odometer is not null),
  constraint reminder_odometer_nonnegative
    check (due_odometer is null or due_odometer >= 0)
);

-- Vehicles belonging to a user.
create index vehicles_user_created_idx
  on public.vehicles (user_id, created_at desc);

-- Maintenance history for a vehicle.
create index maintenance_vehicle_date_idx
  on public.maintenance_records (vehicle_id, service_date desc);

-- Maintenance history and ownership-scoped queries.
create index maintenance_user_date_idx
  on public.maintenance_records (user_id, service_date desc);

-- Fuel history and fuel analytics.
create index fuel_vehicle_date_idx
  on public.fuel_logs (vehicle_id, fill_date desc);

create index fuel_user_date_idx
  on public.fuel_logs (user_id, fill_date desc);

-- Upcoming reminders by vehicle and due date.
create index reminders_vehicle_due_date_idx
  on public.maintenance_reminders (vehicle_id, due_date)
  where completed_at is null;

create index reminders_user_due_date_idx
  on public.maintenance_reminders (user_id, due_date)
  where completed_at is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
insert into public.profiles (id, display_name)
values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
);

return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();

create trigger maintenance_records_set_updated_at
before update on public.maintenance_records
for each row
execute function public.set_updated_at();

create trigger fuel_logs_set_updated_at
before update on public.fuel_logs
for each row
execute function public.set_updated_at();

create trigger maintenance_reminders_set_updated_at
before update on public.maintenance_reminders
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.maintenance_reminders enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Users can read their own vehicles"
on public.vehicles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own vehicles"
on public.vehicles
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own vehicles"
on public.vehicles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own vehicles"
on public.vehicles
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Maintenance records
create policy "Users can read their own maintenance records"
on public.maintenance_records
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own maintenance records"
on public.maintenance_records
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own maintenance records"
on public.maintenance_records
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own maintenance records"
on public.maintenance_records
for delete to authenticated
using (user_id = (select auth.uid()));


-- Fuel logs
create policy "Users can read their own fuel logs"
on public.fuel_logs
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own fuel logs"
on public.fuel_logs
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own fuel logs"
on public.fuel_logs
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own fuel logs"
on public.fuel_logs
for delete to authenticated
using (user_id = (select auth.uid()));


-- Maintenance reminders
create policy "Users can read their own reminders"
on public.maintenance_reminders
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own reminders"
on public.maintenance_reminders
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own reminders"
on public.maintenance_reminders
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own reminders"
on public.maintenance_reminders
for delete to authenticated
using (user_id = (select auth.uid()));
