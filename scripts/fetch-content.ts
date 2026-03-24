import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env then .env.local (mirrors Vite's behaviour; .env.local takes priority)
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const CONTENT_DIR = path.join(process.cwd(), 'public/content');

interface PostRow {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  reading_time: number;
  draft: boolean;
  raw_url: string;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  return end === -1 ? content : content.slice(end + 4).trimStart();
}

async function run(): Promise<void> {
  const token = process.env.CONTENT_REPO_TOKEN;

  // Dev mode: no token — reuse existing public/content/ files
  if (!token) {
    console.log('[fetch-content] No CONTENT_REPO_TOKEN — using existing public/content/ files.');
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all published posts from Supabase (metadata + raw_url)
  const { data, error } = await supabase
    .from('posts')
    .select('slug, title, date, description, tags, reading_time, draft, raw_url')
    .eq('draft', false)
    .order('date', { ascending: false });

  if (error) throw new Error(`Supabase error: ${error.message}`);

  const posts = (data ?? []) as PostRow[];

  if (posts.length === 0) {
    console.log('[fetch-content] No published posts in Supabase — writing empty index.');
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    await fs.writeFile(path.join(CONTENT_DIR, 'index.json'), '[]', 'utf8');
    return;
  }

  // Recreate content dir cleanly
  await fs.rm(CONTENT_DIR, { recursive: true, force: true });
  await fs.mkdir(CONTENT_DIR, { recursive: true });

  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    'User-Agent': 'ai-notes-blog-prebuild',
  };

  // Fetch each post's body from its raw GitHub URL, strip frontmatter
  for (const post of posts) {
    const res = await fetch(post.raw_url, { headers });
    if (!res.ok) {
      console.warn(`[fetch-content] Skipping ${post.slug} — fetch failed (${res.status})`);
      continue;
    }
    const body = stripFrontmatter(await res.text());
    await fs.writeFile(path.join(CONTENT_DIR, `${post.slug}.md`), body, 'utf8');
  }

  // Write index.json in PostMeta shape (camelCase to match existing types)
  const index = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    description: p.description,
    tags: p.tags,
    readingTime: p.reading_time,
    draft: p.draft,
  }));

  await fs.writeFile(
    path.join(CONTENT_DIR, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf8',
  );

  console.log(`[fetch-content] Wrote ${posts.length} posts from Supabase`);
}

run().catch((err: unknown) => {
  console.error('[fetch-content]', err instanceof Error ? err.message : err);
  process.exit(1);
});
