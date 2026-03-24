-- Run this in Supabase SQL editor after supabase-posts.sql
-- Updates increment_view to write to posts.view_count instead of page_views

create or replace function increment_view(post_slug text)
returns void language plpgsql security definer as $$
begin
  update posts set view_count = view_count + 1 where slug = post_slug;
end;
$$;
