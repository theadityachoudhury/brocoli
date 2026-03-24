-- Run this in Supabase SQL editor
-- Creates the posts table (merged metadata + view count + raw GitHub URL)
-- page_views table is NOT touched — blog still uses it until migration

create table if not exists posts (
  slug         text primary key,
  title        text not null,
  date         date not null,
  description  text not null,
  tags         text[] not null default '{}',
  reading_time int not null default 1,
  draft        boolean not null default false,
  raw_url      text not null,
  view_count   bigint not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-update updated_at on every row update
create or replace function update_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_updated_at
  before update on posts
  for each row execute function update_posts_updated_at();

-- RLS: anyone can read published posts
alter table posts enable row level security;

create policy "public read published"
  on posts for select
  using (draft = false);

-- Service role key (used by local admin app) bypasses RLS automatically.
-- No write policies needed — admin always uses the service key.
