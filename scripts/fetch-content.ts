import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type { PostMeta } from '../src/types/post';

// Load .env then .env.local (mirrors Vite's behaviour; .env.local takes priority)
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const CONTENT_DIR = path.join(process.cwd(), 'public/content');

function deriveSlug(filename: string): string {
  // "2025-03-24-my-post-title.md" → "my-post-title"
  return filename.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

async function run(): Promise<void> {
  const token = process.env.CONTENT_REPO_TOKEN;
  const owner = process.env.CONTENT_REPO_OWNER;
  const repo = process.env.CONTENT_REPO_NAME;

  // Dev mode: no token present — reuse existing public/content/ files
  if (!token) {
    console.log('[fetch-content] No CONTENT_REPO_TOKEN — using existing public/content/ files.');
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    return;
  }

  if (!owner || !repo) {
    throw new Error('CONTENT_REPO_OWNER and CONTENT_REPO_NAME must be set when CONTENT_REPO_TOKEN is provided.');
  }

  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ai-notes-blog-prebuild',
  };

  // List files in posts/ directory
  const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/posts`;
  const listRes = await fetch(listUrl, { headers });

  if (listRes.status === 404) {
    // Repo exists but posts/ dir doesn't yet — write empty index and exit cleanly
    console.log(`[fetch-content] No posts/ directory found in ${owner}/${repo} — writing empty index.`);
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    await fs.writeFile(path.join(CONTENT_DIR, 'index.json'), '[]', 'utf8');
    return;
  }

  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`GitHub API error ${listRes.status}: ${body}`);
  }

  const files = (await listRes.json()) as Array<{ name: string; download_url: string }>;
  const mdFiles = files.filter((f) => f.name.endsWith('.md'));

  // Recreate content dir cleanly
  await fs.rm(CONTENT_DIR, { recursive: true, force: true });
  await fs.mkdir(CONTENT_DIR, { recursive: true });

  const posts: PostMeta[] = [];

  for (const file of mdFiles) {
    const rawRes = await fetch(file.download_url, { headers });
    if (!rawRes.ok) {
      console.warn(`[fetch-content] Skipping ${file.name} — fetch failed (${rawRes.status})`);
      continue;
    }

    const raw = await rawRes.text();
    const { data, content } = matter(raw);

    if (data.draft === true) continue;

    const slug = deriveSlug(file.name);
    const stats = readingTime(content);

    posts.push({
      slug,
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      date: data.date
        ? new Date(data.date as string).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      description: typeof data.description === 'string' ? data.description : '',
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      readingTime: Math.max(1, Math.round(stats.minutes)),
      draft: false,
    });

    await fs.writeFile(path.join(CONTENT_DIR, `${slug}.md`), content.trim(), 'utf8');
  }

  // Sort newest first
  posts.sort((a, b) => b.date.localeCompare(a.date));

  await fs.writeFile(
    path.join(CONTENT_DIR, 'index.json'),
    JSON.stringify(posts, null, 2),
    'utf8',
  );

  console.log(`[fetch-content] Wrote ${posts.length} posts from ${owner}/${repo}`);
}

run().catch((err: unknown) => {
  console.error('[fetch-content]', err instanceof Error ? err.message : err);
  process.exit(1);
});
