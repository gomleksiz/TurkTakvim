-- fake_future: stores pre-scripted AI content keyed by birth_date
create table if not exists fake_future (
  id          uuid        default gen_random_uuid() primary key,
  birth_date  date        not null unique,
  dh          text,        -- dogumHaritasi
  md          text,        -- mevcutDonem
  nd          text,        -- nextDonem (gelecekDonem)
  oa          jsonb,       -- onemliAnlar array: [{y,t,b,ac,a?}]
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- auto-update updated_at on upsert
create or replace function update_fake_future_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fake_future_updated_at
  before update on fake_future
  for each row execute procedure update_fake_future_timestamp();

-- Row-level security (service role bypasses RLS automatically)
alter table fake_future enable row level security;
-- Public read: ffuture.html fetches via the edge function (service role) so RLS doesn't block
-- No direct anon access needed since reads go through the edge function
