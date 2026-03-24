import { supabase } from './supabase';
import type { Post, PostMeta } from '@/types/post';

const PAGE_SIZE = 10;

interface SupabasePostRow {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  reading_time: number;
  draft: boolean;
}

function mapRow(row: SupabasePostRow): PostMeta {
  return {
    slug: row.slug,
    title: row.title,
    date: row.date,
    description: row.description,
    tags: row.tags ?? [],
    readingTime: row.reading_time,
    draft: row.draft,
  };
}

export async function getAllPosts(opts: {
  page?: number;
  tag?: string | null;
  search?: string;
} = {}): Promise<{ posts: PostMeta[]; total: number }> {
  const { page = 0, tag, search } = opts;

  // Dev fallback: no Supabase configured — read static JSON
  if (!supabase) {
    const res = await fetch('/content/index.json');
    const all: PostMeta[] = res.ok ? await (res.json() as Promise<PostMeta[]>) : [];
    const filtered = all
      .filter((p) => !tag || p.tags.includes(tag))
      .filter(
        (p) =>
          !search ||
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()),
      );
    const from = page * PAGE_SIZE;
    return { posts: filtered.slice(from, from + PAGE_SIZE), total: filtered.length };
  }

  const from = page * PAGE_SIZE;

  let query = supabase
    .from('posts')
    .select('slug, title, date, description, tags, reading_time, draft', { count: 'exact' })
    .eq('draft', false)
    .order('date', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (tag) query = query.contains('tags', [tag]);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, count } = await query;
  return {
    posts: ((data ?? []) as SupabasePostRow[]).map(mapRow),
    total: count ?? 0,
  };
}

export async function getAllTags(): Promise<string[]> {
  if (!supabase) {
    const res = await fetch('/content/index.json');
    const all: PostMeta[] = res.ok ? await (res.json() as Promise<PostMeta[]>) : [];
    return Array.from(new Set(all.flatMap((p) => p.tags))).sort();
  }

  const { data } = await supabase.from('posts').select('tags').eq('draft', false);
  const all = ((data ?? []) as { tags: string[] }[]).flatMap((r) => r.tags);
  return Array.from(new Set(all)).sort();
}

export async function getPost(slug: string): Promise<Post | null> {
  let meta: PostMeta | null = null;

  if (!supabase) {
    const { posts } = await getAllPosts();
    meta = posts.find((p) => p.slug === slug) ?? null;
  } else {
    const { data } = await supabase
      .from('posts')
      .select('slug, title, date, description, tags, reading_time, draft')
      .eq('slug', slug)
      .eq('draft', false)
      .maybeSingle();
    meta = data ? mapRow(data as SupabasePostRow) : null;
  }

  if (!meta) return null;

  const contentRes = await fetch(`/content/${slug}.md`);
  if (!contentRes.ok) return null;

  return { ...meta, content: await contentRes.text() };
}
