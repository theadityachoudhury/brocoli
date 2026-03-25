/**
 * One-time migration: backfill posts.content from GitHub raw URLs.
 *
 * Run once after applying supabase-add-content.sql:
 *   npx tsx scripts/migrate-content.ts
 *
 * Requires in .env / .env.local:
 *   CONTENT_REPO_TOKEN   — GitHub PAT with contents:read on blog-content
 *   SUPABASE_SERVICE_KEY — service_role key (Project Settings > API)
 *   VITE_SUPABASE_URL    — Supabase project URL
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

interface PostRow {
  slug: string;
  raw_url: string;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  return end === -1 ? content : content.slice(end + 4).trimStart();
}

async function run(): Promise<void> {
  const token = process.env.CONTENT_REPO_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!token) throw new Error('CONTENT_REPO_TOKEN is required.');
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required.');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_KEY is required (service_role key, not anon).');

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch posts that don't have content yet
  const { data, error } = await supabase
    .from('posts')
    .select('slug, raw_url')
    .is('content', null);

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);

  const posts = (data ?? []) as PostRow[];
  console.log(`[migrate] ${posts.length} posts need content backfill.`);

  if (posts.length === 0) {
    console.log('[migrate] Nothing to do.');
    return;
  }

  const headers = {
    Authorization: `token ${token}`,
    'User-Agent': 'ai-notes-blog-migrate',
  };

  let ok = 0;
  let skipped = 0;

  for (const post of posts) {
    const res = await fetch(post.raw_url, { headers });
    if (!res.ok) {
      console.warn(`[migrate] Skipping ${post.slug} — GitHub fetch failed (${res.status})`);
      skipped++;
      continue;
    }

    const content = stripFrontmatter(await res.text());

    const { error: updateErr } = await supabase
      .from('posts')
      .update({ content })
      .eq('slug', post.slug);

    if (updateErr) {
      console.warn(`[migrate] Skipping ${post.slug} — Supabase update failed: ${updateErr.message}`);
      skipped++;
      continue;
    }

    console.log(`[migrate] ✓ ${post.slug}`);
    ok++;
  }

  console.log(`[migrate] Done. ${ok} migrated, ${skipped} skipped.`);
}

run().catch((err: unknown) => {
  console.error('[migrate]', err instanceof Error ? err.message : err);
  process.exit(1);
});
