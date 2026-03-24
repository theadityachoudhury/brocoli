import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

// Load .env then .env.local (mirrors Vite's behaviour; .env.local takes priority)
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const CONTENT_DIR = path.join(process.cwd(), 'public/content');

async function run(): Promise<void> {
  const token = process.env.CONTENT_REPO_TOKEN;
  const owner = process.env.CONTENT_REPO_OWNER;
  const repo = process.env.CONTENT_REPO_NAME;

  // Dev mode: no token — reuse existing public/content/ files
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

  // Fetch pre-generated index.json from dist/ (no parsing — already processed locally)
  const indexApiRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/index.json`,
    { headers },
  );

  if (indexApiRes.status === 404) {
    console.log(`[fetch-content] No index.json file found in ${owner}/${repo} — writing empty index.`);
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    await fs.writeFile(path.join(CONTENT_DIR, 'index.json'), '[]', 'utf8');
    return;
  }

  if (!indexApiRes.ok) {
    const body = await indexApiRes.text();
    throw new Error(`GitHub API error ${indexApiRes.status}: ${body}`);
  }

  const indexFileInfo = (await indexApiRes.json()) as { download_url: string };
  const indexContent = await fetch(indexFileInfo.download_url, { headers }).then((r) => r.text());

  // Fetch list of body-only .md files from dist/posts/
  const postsApiRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/posts`,
    { headers },
  );

  const postFiles: Array<{ name: string; download_url: string }> = postsApiRes.ok
    ? ((await postsApiRes.json()) as Array<{ name: string; download_url: string }>)
    : [];

  // Recreate content dir cleanly
  await fs.rm(CONTENT_DIR, { recursive: true, force: true });
  await fs.mkdir(CONTENT_DIR, { recursive: true });

  // Write index.json as-is (already correct shape)
  await fs.writeFile(path.join(CONTENT_DIR, 'index.json'), indexContent, 'utf8');

  // Download and write each post file
  for (const file of postFiles.filter((f) => f.name.endsWith('.md'))) {
    const content = await fetch(file.download_url, { headers }).then((r) => r.text());
    await fs.writeFile(path.join(CONTENT_DIR, file.name), content, 'utf8');
  }

  const postCount = JSON.parse(indexContent).length as number;
  console.log(`[fetch-content] Fetched ${postCount} posts from ${owner}/${repo}`);
}

run().catch((err: unknown) => {
  console.error('[fetch-content]', err instanceof Error ? err.message : err);
  process.exit(1);
});
