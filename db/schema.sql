-- ============================================================================
-- Lunaro Gate — Neon Postgres Schema
-- ============================================================================
-- Run this in the Neon SQL Editor (Console → SQL Editor → New Query).
-- This script is idempotent: safe to re-run on an existing schema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

create table if not exists public.codes (
  code              text         primary key,
  status            text         not null default 'unused',
  prints_paid_for   integer      not null check (prints_paid_for >= 1 and prints_paid_for <= 10),
  prints_completed  integer      not null default 0,
  generated_at      timestamptz  not null default now(),
  expires_at        timestamptz  not null,
  claimed_at        timestamptz  null,
  completed_at      timestamptz  null,
  booth_id          text         not null default 'default',
  metadata          jsonb        not null default '{}'::jsonb,

  constraint codes_status_check check (
    status in ('unused', 'claimed', 'in_session', 'used', 'expired', 'voided')
  ),
  constraint codes_format_check check (code ~ '^[0-9]{4}$')
);

create index if not exists codes_status_idx           on public.codes (status);
create index if not exists codes_expires_at_idx       on public.codes (expires_at);
create index if not exists codes_booth_status_idx     on public.codes (booth_id, status);
create index if not exists codes_generated_at_idx     on public.codes (generated_at desc);

create table if not exists public.webhook_events (
  id           uuid         primary key default gen_random_uuid(),
  code         text         null references public.codes(code) on delete set null,
  event_type   text         not null,
  param1       text         null,
  param2       text         null,
  param3       text         null,
  param4       text         null,
  received_at  timestamptz  not null default now(),
  booth_id     text         not null default 'default',
  raw          jsonb        not null default '{}'::jsonb
);

create index if not exists webhook_events_received_idx on public.webhook_events (received_at desc);
create index if not exists webhook_events_booth_idx    on public.webhook_events (booth_id, received_at desc);


-- ----------------------------------------------------------------------------
-- 3. Functions (atomic operations)
-- ----------------------------------------------------------------------------

-- Generate a new code, atomically. Returns the generated code.
-- Retries up to 50 times on collision.
create or replace function public.generate_code(
  p_prints_paid_for int,
  p_booth_id        text default 'default',
  p_expiry_hours    int  default 2
)
returns text
language plpgsql
as $$
declare
  v_candidate text;
  v_inserted  text;
  v_attempt   int := 0;
begin
  if p_prints_paid_for < 1 or p_prints_paid_for > 10 then
    raise exception 'prints_paid_for must be between 1 and 10';
  end if;

  while v_attempt < 50 loop
    v_candidate := lpad(floor(random() * 10000)::int::text, 4, '0');

    insert into public.codes (code, status, prints_paid_for, expires_at, booth_id)
    values (
      v_candidate,
      'unused',
      p_prints_paid_for,
      now() + (p_expiry_hours || ' hours')::interval,
      p_booth_id
    )
    on conflict (code) do nothing
    returning code into v_inserted;

    if v_inserted is not null then
      return v_inserted;
    end if;

    v_attempt := v_attempt + 1;
  end loop;

  raise exception 'code generation failed after 50 attempts';
end;
$$;

-- Atomically claim a code for a booth. Returns the code row if claim succeeded,
-- or empty if invalid, expired, or already used.
create or replace function public.claim_code(
  p_code     text,
  p_booth_id text default 'default'
)
returns table (
  code             text,
  prints_paid_for  int,
  expires_at       timestamptz
)
language plpgsql
as $$
begin
  return query
  update public.codes c
     set status     = 'claimed',
         claimed_at = now()
   where c.code       = p_code
     and c.status     = 'unused'
     and c.expires_at > now()
     and c.booth_id   = p_booth_id
  returning c.code, c.prints_paid_for, c.expires_at;
end;
$$;

-- Expire codes past their expiry (called by Vercel cron hourly).
create or replace function public.expire_old_codes()
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  update public.codes
     set status = 'expired'
   where status     = 'unused'
     and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Verification (uncomment to test after applying schema)
-- ----------------------------------------------------------------------------
-- select public.generate_code(2);
-- select * from public.codes order by generated_at desc limit 5;
-- select * from public.claim_code((select code from public.codes order by generated_at desc limit 1));
-- select * from public.codes;

-- ============================================================================
-- Done.
-- ============================================================================
