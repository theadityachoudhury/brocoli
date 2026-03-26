# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal blog/notes-taking app. Content metadata and post body are stored in a **Supabase `posts` table** (single source of truth). New posts are added via a local admin app in the `blog-content` repo. Page views are tracked atomically via Supabase RPC.

**Docs to read first:**
- `docs/ARCHITECTURE.md` — full system design, diagrams, data models, env vars
- `docs/TASKS.md` — phase-by-phase task tracker with session log; always check "Next step" at the bottom before starting work

---

## Commands

**Note:** Tailwind v4 is installed (no `tailwind.config.ts` — configured via `src/index.css`).

```bash
npm run dev          # local dev server
npm run build        # tsc type-check + vite build
npm run preview      # preview production build locally
npm run lint         # eslint
npm run migrate      # one-time: backfill posts.content from GitHub raw URLs (requires SUPABASE_SERVICE_KEY)
```

No prebuild step — post metadata and content are fetched from Supabase at **runtime**, not build time.

---

## Architecture

### Data flow

- **Post list & metadata**: fetched from Supabase `posts` table at runtime by `src/lib/posts.ts`
- **Post body**: stored in `posts.content` column (raw markdown, frontmatter stripped), fetched via `getPost(slug)`
- **View counts**: `posts.view_count` column, incremented atomically via `increment_view` RPC in `usePageView` hook
- **Dev fallback**: if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are absent, `getAllPosts()` falls back to `public/content/index.json` static files; `getPost()` returns null

### Supabase `posts` table (primary source of truth)

```sql
-- Key columns: slug (PK), title, date, description, tags[], reading_time,
--              draft, view_count, raw_url, content (markdown body)

create or replace function increment_view(post_slug text)
returns void as $$
  insert into posts (slug, view_count) values (post_slug, 1)
  on conflict (slug) do update set view_count = posts.view_count + 1;
$$ language sql;
```

View dedup: `sessionStorage` key `viewed:{slug}` prevents re-counting on refresh.

### Runtime data-fetch pattern

`src/lib/posts.ts` is the sole data access layer. Every function checks `if (!supabase)` and provides a static-file fallback. `supabase` is `null` when env vars are missing — never throw, always gracefully degrade.

### Routing

`App.tsx` uses lazy-loaded routes: `/` → `Home`, `/posts/:slug` → `Post`, `*` → `NotFound`. A `vercel.json` catch-all rewrite handles SPA deep-links.

---

## Design System

See `docs/DESIGN.md` for the full token reference. Key rules:
- **Never hardcode hex colors** — always use CSS custom properties (`var(--accent)`, etc.)
- **Tailwind utilities map to tokens:** `bg-surface`, `text-text-primary`, `text-accent`, `border-border`, `bg-accent-subtle`, `text-text-muted`, `surface-raised`, etc.
- **Fonts:** Inter (UI), JetBrains Mono (code) — loaded in `index.html`
- **Dark mode:** `useDarkMode` hook (`src/lib/useDarkMode.ts`) toggles `.dark` class on `<html>`; auto via `prefers-color-scheme` also supported
- All tokens defined in `src/index.css` under `:root` (light) and `@media (prefers-color-scheme: dark)` + `.dark` (dark)

---

## Key Conventions

- Post slugs derived from filenames in content repo: `2025-03-24-my-post.md` → `my-post`
- `draft: true` posts are excluded (filtered in Supabase query with `.eq('draft', false)`)
- `readingTime` (camelCase in TypeScript) maps to `reading_time` (snake_case in Supabase)
- Pagination: 10 posts/page (`PAGE_SIZE = 10` in `posts.ts`), load-more pattern on `Home`
- SEO meta tags via `react-helmet-async` (`<Helmet>` in `Home` and `Post` pages)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + @tailwindcss/typography |
| MD rendering | react-markdown + remark-gfm + rehype-highlight |
| Routing | React Router v7 |
| Data / Page views | Supabase (posts table — metadata + content + view_count) |
| SEO | react-helmet-async |
| Hosting | Vercel |

---

## Environment Variables

### App (Vercel + local dev)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose, RLS protects data) |

### Migration script only

| Variable | Purpose |
|---|---|
| `CONTENT_REPO_TOKEN` | GitHub PAT with `contents:read` on `blog-content` |
| `SUPABASE_SERVICE_KEY` | service_role key (Project Settings → API) — NOT anon key |

Local dev: copy `.env.example` → `.env.local`
