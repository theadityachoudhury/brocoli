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
  content?: string | null;
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

export async function getRelatedPosts(
  slug: string,
  tags: string[],
  limit = 3,
): Promise<PostMeta[]> {
  if (tags.length === 0) return [];

  if (!supabase) {
    const { posts } = await getAllPosts();
    return posts
      .filter((p) => p.slug !== slug && p.tags.some((t) => tags.includes(t)))
      .slice(0, limit);
  }

  const { data } = await supabase
    .from('posts')
    .select('slug, title, date, description, tags, reading_time, draft')
    .eq('draft', false)
    .neq('slug', slug)
    .overlaps('tags', tags)
    .order('date', { ascending: false })
    .limit(limit);

  return ((data ?? []) as SupabasePostRow[]).map(mapRow);
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('posts')
    .select('slug, title, date, description, tags, reading_time, draft, content')
    .eq('slug', slug)
    .eq('draft', false)
    .maybeSingle();

  if (!data) return null;

  const row = data as SupabasePostRow;
  if (!row.content) return null; // content not yet migrated

  return { ...mapRow(row), content: row.content };
}
