# Blueprint: Personal Blog / Notes App
**Objective:** Vite + React + TS blog app — two private repos, Vercel hosting, Supabase page views, GitHub Actions deploy trigger.

**Generated:** 2026-03-24
**Status:** Ready to execute
**Phases:** 7 steps, serial with noted parallelism

---

## ⚠️ Critical Corrections vs. Original Plan

Three issues found during adversarial review that change implementation details:

### 1. `gray-matter` is Node.js-only (CRITICAL)
`gray-matter` cannot run in the browser. The original plan described `src/lib/posts.ts` parsing frontmatter "at runtime" — this would break.

**Fix:** Prebuild script (Node.js) parses all frontmatter + computes reading time → writes static JSON to `public/content/index.json` and strips frontmatter from `.md` files before writing to `public/content/{slug}.md`. React app just does `fetch('/content/index.json')` and `fetch('/content/{slug}.md')` at runtime. `gray-matter` and `reading-time` are build-time-only.

### 2. Supabase view count race condition
Client-side read → increment → write has a race condition if two users load simultaneously.

**Fix:** Use a Postgres atomic RPC function `increment_view(slug)` via `supabase.rpc()` instead of a manual upsert. One call, no race.

### 3. Missing: local dev without GitHub PAT
Prebuild script would fail locally if `CONTENT_REPO_TOKEN` is not set.

**Fix:** Prebuild script checks for token; if absent, skips fetch and reuses existing files in `public/content/` (developer drops sample `.md` files there manually). Local dev works without credentials.

### 4. Missing: Vercel SPA routing config
React Router requires all routes to resolve to `index.html`. Without a `vercel.json` rewrite rule, direct URL access (e.g. `/posts/my-slug`) returns 404 on Vercel.

**Fix:** Add `vercel.json` with a catch-all rewrite.

---

## Dependency Graph

```
Step 1 (Scaffold) ──► Step 2 (Content Infra) ──► Step 3 (UI Components) ──► Step 4 (Pages + Routing)
                                                                                      │
                                                                              Step 5 (Page Views)
                                                                                      │
                                                                              Step 6 (Deployment)
                                                                                      │
                  Step 7 (Export Tooling) ─────────────────────────────────────────►─┘
                  (can start after Step 1, independent of Steps 2–6)
```

**Parallel opportunity:** Step 7 can be worked in parallel with Steps 2–5 if two sessions are active.

---

## Step 1 — Project Scaffolding
**Blocks:** All other steps
**Model:** default

### Context
Empty directory with only `CLAUDE.md`, `docs/`, and `plans/`. No `package.json` yet.

### Tasks
- [ ] Run `npm create vite@latest . -- --template react-ts` (say yes to scaffold in existing dir)
- [ ] Install runtime dependencies:
  ```
  npm install react-router-dom react-markdown remark-gfm rehype-highlight @supabase/supabase-js
  ```
- [ ] Install build-time dependencies:
  ```
  npm install --save-dev tailwindcss @tailwindcss/typography gray-matter reading-time tsx
  ```
- [ ] Initialize Tailwind: `npx tailwindcss init -p`
- [ ] Update `tailwind.config.ts`:
  - `content: ['./index.html', './src/**/*.{ts,tsx}']`
  - Add `@tailwindcss/typography` to plugins
- [ ] Update `src/index.css` to include Tailwind directives
- [ ] Configure TypeScript path aliases in `tsconfig.json`:
  ```json
  "baseUrl": ".",
  "paths": { "@/*": ["./src/*"] }
  ```
- [ ] Update `vite.config.ts` with path alias `@` → `./src`
- [ ] Create `.env.example`:
  ```
  CONTENT_REPO_TOKEN=
  CONTENT_REPO_OWNER=
  CONTENT_REPO_NAME=
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  ```
- [ ] Add to `.gitignore`: `content/`, `.env.local`, `.env`
- [ ] Create directory structure:
  ```
  src/components/Layout/
  src/components/Blog/
  src/components/ui/
  src/pages/
  src/lib/
  src/types/
  scripts/
  public/content/
  ```
- [ ] Add `vercel.json`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
- [ ] Delete Vite boilerplate: `src/assets/react.svg`, `public/vite.svg`, reset `App.tsx` and `App.css`

### Verification
```bash
npm run dev   # should open on localhost:5173 with blank page, no errors
```

---

## Step 2 — Content Infrastructure
**Blocked by:** Step 1
**Blocks:** Steps 3, 4
**Model:** default

### Context
Vite project is initialized. `public/content/` dir exists. We need the prebuild script that fetches `.md` files from the private content repo and generates static JSON for the React app. Note: `gray-matter` is Node.js-only — all parsing happens here, not in the browser.

### Tasks

#### `src/types/post.ts`
```typescript
export interface PostMeta {
  slug: string;
  title: string;
  date: string;         // ISO date string e.g. "2025-03-24"
  description: string;
  tags: string[];
  readingTime: number;  // minutes, integer
  draft: boolean;
}

export interface Post extends PostMeta {
  content: string;      // raw markdown (frontmatter stripped)
}
```

#### `scripts/fetch-content.ts`
This script runs as the `prebuild` npm script (via `tsx scripts/fetch-content.ts`).

Logic:
1. Read env vars: `CONTENT_REPO_TOKEN`, `CONTENT_REPO_OWNER`, `CONTENT_REPO_NAME`
2. If token is missing → log warning "No CONTENT_REPO_TOKEN — using existing public/content/ files" and exit 0 (dev mode)
3. Use GitHub REST API to list files in `posts/` directory of the content repo:
   `GET https://api.github.com/repos/{owner}/{repo}/contents/posts`
4. For each `.md` file, fetch raw content via the `download_url`
5. Parse with `gray-matter` → extract frontmatter + body
6. Compute reading time with `reading-time`
7. Derive slug: strip date prefix and `.md` from filename → `2025-03-24-my-post.md` → `my-post`
8. Skip if `draft: true`
9. Write stripped body (no frontmatter) to `public/content/{slug}.md`
10. Accumulate PostMeta objects → write all to `public/content/index.json`

#### `package.json` scripts
```json
"prebuild": "tsx scripts/fetch-content.ts",
"predev": "tsx scripts/fetch-content.ts"
```

#### `src/lib/posts.ts` — runtime fetcher (browser-safe)
```typescript
import type { PostMeta, Post } from '@/types/post';

export async function getAllPosts(): Promise<PostMeta[]> {
  const res = await fetch('/content/index.json');
  return res.json();
}

export async function getPost(slug: string): Promise<Post | null> {
  const [meta, content] = await Promise.all([
    getAllPosts().then(posts => posts.find(p => p.slug === slug) ?? null),
    fetch(`/content/${slug}.md`).then(r => r.ok ? r.text() : null),
  ]);
  if (!meta || !content) return null;
  return { ...meta, content };
}
```

#### Sample content for local dev
Create `public/content/index.json` and `public/content/hello-world.md` with sample data so `npm run dev` works without a GitHub token.

### Verification
```bash
# With token set:
tsx scripts/fetch-content.ts
# Should create public/content/index.json and public/content/*.md

# Without token:
# Should print warning and exit cleanly
```

---

## Step 3 — Core UI Components
**Blocked by:** Step 2 (needs types)
**Blocks:** Step 4
**Model:** default

### Context
Types and data-fetching utilities are in place. Build all UI components in isolation before wiring into pages.

### Tasks

#### `src/components/Layout/Header.tsx`
- Site name (from env or hardcoded) as link to `/`
- Minimal nav: Home, optional About

#### `src/components/Layout/Footer.tsx`
- Minimal: copyright, optional GitHub link

#### `src/components/ui/Tag.tsx`
```tsx
// Renders a tag chip. onClick is optional (for filtering on Home page)
interface TagProps { label: string; onClick?: () => void; active?: boolean; }
```

#### `src/components/ui/ViewCount.tsx`
```tsx
// Displays eye icon + count. Shows skeleton/loading state while count is null.
interface ViewCountProps { count: number | null; }
```

#### `src/components/Blog/PostCard.tsx`
Displays:
- Title (link to `/posts/{slug}`)
- Date (formatted: "March 24, 2025")
- Description
- Tags (using `<Tag />`)
- Reading time ("5 min read")

#### `src/components/Blog/PostList.tsx`
- Accepts `PostMeta[]` and renders a responsive grid of `<PostCard />`
- Empty state: "No posts found."

#### `src/components/Blog/PostContent.tsx`
```tsx
// Renders raw markdown via react-markdown
// Uses @tailwindcss/typography prose classes for styling
// Configures remark-gfm (tables, strikethrough, etc.)
// Configures rehype-highlight for code blocks
```

### Verification
- No TypeScript errors (`npx tsc --noEmit`)
- Components render without crashing in dev server

---

## Step 4 — Pages & Routing
**Blocked by:** Step 3
**Blocks:** Step 5
**Model:** default

### Context
All components exist. Wire them into pages and set up routing.

### Tasks

#### `src/pages/Home.tsx`
- On mount: `getAllPosts()` → store in state
- Tag filter: clicking a tag filters the list (active tag shown highlighted)
- Search: client-side text filter on title + description
- Renders `<PostList posts={filtered} />`
- Loading skeleton while fetching

#### `src/pages/Post.tsx`
- Extract `slug` from `useParams()`
- On mount: `getPost(slug)` → store in state
- Renders: title, date, tags, reading time, `<ViewCount />`, then `<PostContent />`
- 404 redirect if post not found
- `usePageView(slug)` hook (from Step 5) wired in here

#### `src/pages/NotFound.tsx`
- Simple "404 — Page not found" with link back to home

#### `src/App.tsx`
```tsx
<BrowserRouter>
  <Layout> {/* Header + Footer wrapper */}
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/posts/:slug" element={<Post />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Layout>
</BrowserRouter>
```

### Verification
```bash
npm run dev
# / → shows post list
# /posts/hello-world → shows sample post
# /posts/does-not-exist → shows 404
# /anything-else → shows 404
```

---

## Step 5 — Page View Tracking
**Blocked by:** Step 4 (needs `Post.tsx`)
**Blocks:** Step 6
**Model:** default

### Context
Supabase tracks view counts. The increment must be **atomic** (Postgres RPC) to avoid race conditions. Views should be counted once per browser session per slug (use `sessionStorage` to debounce).

### Manual Setup Required (user action)
Before coding, the user must:
1. Create a free Supabase project at supabase.com
2. Run this SQL in the Supabase SQL editor:
```sql
-- Table
create table page_views (
  slug         text primary key,
  count        integer not null default 0,
  last_viewed  timestamptz default now()
);

-- Atomic increment RPC (prevents race conditions)
create or replace function increment_view(post_slug text)
returns void as $$
  insert into page_views (slug, count, last_viewed)
  values (post_slug, 1, now())
  on conflict (slug) do update
  set count = page_views.count + 1,
      last_viewed = now();
$$ language sql;

-- RLS
alter table page_views enable row level security;
create policy "allow_read"   on page_views for select using (true);
create policy "allow_insert" on page_views for insert with check (true);
create policy "allow_update" on page_views for update using (true);
```
3. Copy project URL and anon key to `.env.local`

### Tasks

#### `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

#### `src/lib/usePageView.ts` — custom hook
```typescript
// 1. On mount, check sessionStorage for `viewed:{slug}`
// 2. If not seen this session:
//    a. Call supabase.rpc('increment_view', { post_slug: slug })
//    b. Set sessionStorage `viewed:{slug}` = true
// 3. Then fetch current count: supabase.from('page_views').select('count').eq('slug', slug)
// 4. Return { count: number | null }
```

#### Wire into `src/pages/Post.tsx`
```tsx
const { count } = usePageView(slug);
// pass count to <ViewCount count={count} />
```

### Verification
- Open a post → view count increments by 1
- Refresh the page → count does NOT increment again (sessionStorage gate)
- Open in a new tab → count increments again (different session)
- Check Supabase dashboard → rows appear in `page_views` table

---

## Step 6 — Deployment Setup
**Blocked by:** Step 5
**Model:** default

### Context
All app code is complete. This step is mostly configuration and testing the live pipeline. Several tasks require manual action in external dashboards.

### Tasks (mix of code + manual)

#### App repo (this repo)
- [ ] Ensure `vercel.json` is committed (created in Step 1)
- [ ] Push repo to GitHub (private)

#### Vercel setup (manual — dashboard)
- [ ] Create Vercel account if needed
- [ ] Import `AINotesTakingApp` repo → create project
- [ ] Set environment variables:
  - `CONTENT_REPO_TOKEN` — GitHub PAT with `contents:read` scope on `blog-content` repo
  - `CONTENT_REPO_OWNER` — your GitHub username
  - `CONTENT_REPO_NAME` — `blog-content`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [ ] Trigger first deploy → verify it succeeds
- [ ] Add custom domain in Vercel → follow DNS instructions

#### Content repo setup
- [ ] Create `blog-content` private GitHub repo
- [ ] Create `posts/` directory with one real `.md` post
- [ ] Add Vercel deploy hook URL as GitHub Secret `VERCEL_DEPLOY_HOOK_URL`
  - (Get this from: Vercel project → Settings → Git → Deploy Hooks → Create hook)
- [ ] Create `.github/workflows/trigger-deploy.yml`:
  ```yaml
  name: Trigger Vercel Deploy
  on:
    push:
      branches: [main]
      paths: ['posts/**']
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - name: Trigger rebuild
          run: curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
  ```

#### Pipeline test
- [ ] Push a new `.md` file to `blog-content/posts/`
- [ ] Verify GitHub Action fires (Actions tab)
- [ ] Verify Vercel build starts and succeeds
- [ ] Verify new post appears on live site
- [ ] Verify custom domain resolves over HTTPS

---

## Step 7 — Claude Export Tooling
**Blocked by:** Step 1 (needs project scaffolded for tsx)
**Independent of:** Steps 2–6
**Model:** default

### Context
The primary use case for this blog is exporting Claude Code conversation logs (`.md`) and publishing them. This step creates a helper script that adds required frontmatter to a raw exported file.

### Tasks

#### `scripts/add-frontmatter.ts` — CLI tool
```
Usage: tsx scripts/add-frontmatter.ts <input.md> [--title "..." --description "..." --tags "a,b,c"]
```
Logic:
1. Read the input `.md` file
2. If frontmatter already present → skip, exit
3. Prompt user interactively (via `readline`) for: title, description, tags, date (default today), draft (default false)
4. Prepend frontmatter block to file content
5. Suggest output filename: `{YYYY-MM-DD}-{slugified-title}.md`
6. Write to `blog-content/posts/` (or prompt for output path)

#### `docs/EXPORT_WORKFLOW.md`
Document the end-to-end workflow:
1. Export Claude Code conversation as `.md` (via `/save` or copy-paste)
2. Run `tsx scripts/add-frontmatter.ts path/to/export.md`
3. Review the generated file
4. `cd blog-content && git add posts/ && git commit -m "add: post title" && git push`
5. GitHub Action fires → Vercel rebuilds → post live in ~30s

### Verification
```bash
echo "# Hello world\nsome content" > /tmp/test-export.md
tsx scripts/add-frontmatter.ts /tmp/test-export.md
# Should interactively prompt and produce a file with frontmatter
```

---

## Backlog (post-launch)

| Item | Effort | Notes |
|---|---|---|
| RSS feed `/rss.xml` | Small | Generate in prebuild script alongside `index.json` |
| Open Graph meta tags | Small | Use `react-helmet-async` per post |
| Client-side search | Small | Fuse.js against `index.json` |
| Syntax highlighting theme | Small | Switch to `shiki` for better themes |
| Code block copy button | Small | Custom `rehype` plugin |
| Dark mode | Medium | Tailwind `dark:` classes + `localStorage` |
| Reading progress bar | Small | scroll position % on Post page |
| Related posts by tags | Small | Computed in `posts.ts` |

---

## Architecture Corrections Summary (diff from original plan)

| Original | Corrected | Why |
|---|---|---|
| `src/lib/posts.ts` parses MD at runtime | Prebuild script parses; runtime only does `fetch()` | `gray-matter` is Node.js-only |
| Client-side upsert for view count | Postgres RPC `increment_view()` | Atomic, no race condition |
| Prebuild fails without token | Skip fetch, use existing files | Local dev without credentials |
| No `vercel.json` | Add catch-all rewrite | React Router needs SPA fallback |
| MD files in `content/` (src) | Static files in `public/content/` | Vite copies `public/` to build output; accessible at runtime via `fetch()` |
