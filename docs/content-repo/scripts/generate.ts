import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const POSTS_DIR = path.join(process.cwd(), 'posts');
const DIST_DIR = path.join(process.cwd(), 'dist');
const DIST_POSTS_DIR = path.join(DIST_DIR, 'posts');

interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  readingTime: number;
  draft: boolean;
}

function deriveSlug(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

async function run(): Promise<void> {
  const files = await fs.readdir(POSTS_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_POSTS_DIR, { recursive: true });

  const posts: PostMeta[] = [];
  let skipped = 0;

  for (const filename of mdFiles) {
    const raw = await fs.readFile(path.join(POSTS_DIR, filename), 'utf8');
    const { data, content } = matter(raw);

    // Skip drafts silently
    if (data.draft === true) {
      skipped++;
      continue;
    }

    // Validate required fields
    const required = ['title', 'date', 'description', 'tags'];
    const missing = required.filter((k) => !data[k]);
    if (missing.length > 0) {
      console.warn(`[generate] Skipping ${filename} — missing: ${missing.join(', ')}`);
      skipped++;
      continue;
    }

    const slug = deriveSlug(filename);
    const stats = readingTime(content);

    posts.push({
      slug,
      title: String(data.title),
      date: new Date(data.date as string).toISOString().split('T')[0],
      description: String(data.description),
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      readingTime: Math.max(1, Math.round(stats.minutes)),
      draft: false,
    });

    // Write body-only .md (no frontmatter)
    await fs.writeFile(path.join(DIST_POSTS_DIR, `${slug}.md`), content.trim(), 'utf8');
  }

  // Sort newest first
  posts.sort((a, b) => b.date.localeCompare(a.date));

  await fs.writeFile(path.join(DIST_DIR, 'index.json'), JSON.stringify(posts, null, 2), 'utf8');

  console.log(`[generate] ${posts.length} posts → dist/ (${skipped} skipped)`);
}

run().catch((err: unknown) => {
  console.error('[generate]', err instanceof Error ? err.message : err);
  process.exit(1);
});
