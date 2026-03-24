# Task Tracker

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[-]` skipped

---

## Phase 0 — Planning & Documentation
- [x] Define high-level architecture
- [x] Choose tech stack
- [x] Create `docs/ARCHITECTURE.md` with full diagrams
- [x] Create `docs/TASKS.md` (this file)
- [x] Update `CLAUDE.md`

---

## Phase 1 — Project Initialization
- [x] Initialize Vite + React + TypeScript project (scaffolded via temp dir, moved to root)
- [x] Add `vercel.json` with SPA catch-all rewrite
- [x] Install dependencies: react-router-dom, react-markdown, remark-gfm, rehype-highlight, @supabase/supabase-js, tailwindcss, @tailwindcss/typography, @tailwindcss/vite, gray-matter, reading-time, tsx
- [x] Configure Tailwind v4 (CSS `@import "tailwindcss"` + `@plugin "@tailwindcss/typography"`, `@tailwindcss/vite` plugin in vite.config.ts)
- [x] Configure TypeScript path alias `@` → `./src` in `tsconfig.app.json`
- [x] Set up `vite.config.ts` with path alias + Tailwind plugin
- [x] Create `.env.example` with all required env vars
- [x] Add `public/content/` and `.env`/`.env.local` to `.gitignore`
- [x] Create folder structure (src/components/Layout, Blog, ui, pages, lib, types, scripts, public/content)
- [x] Clean up Vite boilerplate (App.css, assets, icons.svg)
- [x] Add `prebuild` and `predev` scripts to `package.json`
- [x] Fix package name from "temp" to "ai-notes-blog"
- NOTE: Tailwind v4 installed (no tailwind.config.ts — configured via CSS)

---

## Phase 2 — Content Infrastructure
- [x] Create `src/types/post.ts` (PostMeta, Post interfaces)
- [x] Write `scripts/fetch-content.ts` prebuild script
  - [x] Dev mode: no token → print warning, ensure dir exists, exit 0
  - [x] Prod mode: fetch from GitHub API, parse frontmatter, strip, write files
  - [x] Slug derivation: `2026-03-24-my-post.md` → `my-post`
  - [x] Filters drafts, sorts by date descending
  - [x] Writes `public/content/{slug}.md` + `public/content/index.json`
- [x] Add `prebuild`/`predev` scripts to `package.json` (done in Phase 1)
- [x] Write `src/lib/posts.ts` — browser-safe: getAllPosts() + getPost(slug) via fetch()
- [x] Add `scripts/` to `tsconfig.node.json` for IDE support
- [x] Create 2 sample posts in `public/content/` for local dev

---

## Phase 3 — Core UI Components
- [x] `src/lib/utils.ts` — formatDate() helper
- [x] `src/components/Layout/Header.tsx` — sticky, frosted glass, "notes" link
- [x] `src/components/Layout/Footer.tsx` — minimal
- [x] `src/components/Layout/Layout.tsx` — Header + main + Footer wrapper
- [x] `src/components/Blog/PostCard.tsx` — date, title, description, tags, read time; hover accent border
- [x] `src/components/Blog/PostList.tsx` — flex column of PostCards + empty state
- [x] `src/components/Blog/PostContent.tsx` — react-markdown + remark-gfm + rehype-highlight, prose class
- [x] `src/components/ui/Tag.tsx` — clickable/static chip, active state
- [x] `src/components/ui/ViewCount.tsx` — eye icon + count, loading skeleton
- [x] `src/index.css` — syntax highlight CSS vars + .hljs-* rules (light + dark)
- [x] `src/App.tsx` — wired to Layout with BrowserRouter (placeholder content)

---

## Phase 4 — Pages & Routing
- [x] `src/lib/usePageView.ts` — stub returning null (replaced in Phase 5)
- [x] `src/pages/Home.tsx` — heading, search input, tag filter chips, PostList, loading skeleton
- [x] `src/pages/Post.tsx` — back link, title, meta row (date · read time · view count), tags, divider, PostContent, loading skeleton, not-found state
- [x] `src/pages/NotFound.tsx` — 404 with back link
- [x] `src/App.tsx` — BrowserRouter + lazy-loaded Routes (code splitting: Post chunk ~100 kB gz, Home ~1.4 kB gz)
- [x] SPA fallback — handled by vercel.json (done in Phase 1)

---

## Phase 5 — Page View Tracking
- [x] `src/lib/supabase.ts` — null-safe client (returns null if env vars missing, so local dev works without Supabase)
- [x] `src/lib/usePageView.ts` — real implementation: sessionStorage dedup, atomic RPC, fetch count, cleanup on unmount
- [x] Wired into `Post.tsx` (was already calling the stub — now uses real impl)
- [x] `vite.config.ts` — chunkSizeWarningLimit bumped to 600 (Post chunk is 148 kB gz, lazy-loaded, acceptable)
- [ ] MANUAL: Create Supabase project + run SQL + set env vars (see instructions below)

---

## Phase 6 — Deployment Setup
- [x] Create `docs/DEPLOY.md` — full 6-step deployment guide
- [x] Create `docs/content-repo/trigger-deploy.yml` — GitHub Actions workflow for content repo
- [ ] Push `AINotesTakingApp` to GitHub (private repo `theadityachoudhury/AINotesTakingApp`)
- [ ] Create Vercel project, link to `AINotesTakingApp` repo
- [ ] Set all env vars in Vercel dashboard (see ARCHITECTURE.md)
- [ ] Verify prebuild script runs correctly on Vercel
- [ ] Set up custom domain in Vercel
- [ ] Create `blog-content` private repo (or verify it exists)
- [ ] Add first post to `blog-content/posts/` with proper frontmatter
- [ ] Add `VERCEL_DEPLOY_HOOK_URL` to `blog-content` GitHub Secrets
- [ ] Copy `docs/content-repo/trigger-deploy.yml` to `blog-content/.github/workflows/`
- [ ] Test full pipeline: push `.md` → auto deploy → live

---

## Phase 7 — Claude Export Tooling
- [ ] Write `scripts/add-frontmatter.ts` — CLI tool that takes a raw exported `.md` file and prompts for/adds frontmatter
- [ ] Document Claude Code → blog post workflow in `docs/EXPORT_WORKFLOW.md`

---

## Backlog (future ideas)
- [ ] RSS feed (`/rss.xml`)
- [ ] Open Graph meta tags per post (for social sharing)
- [ ] Search across all posts (client-side with Fuse.js)
- [ ] Related posts by tags
- [ ] Code block copy button
- [ ] Dark mode toggle
- [ ] Reading progress bar on post page
- [ ] Syntax highlighting theme (via rehype-highlight or shiki)

---

## Session Log

### Session 1 — 2026-03-24
- Defined full architecture
- Chose tech stack: Vite + React + TS, Tailwind, react-markdown, gray-matter, Supabase, Vercel
- Decision: two private repos (app + content), webhook triggers Vercel rebuild
- Created `docs/ARCHITECTURE.md`, `docs/TASKS.md`, updated `CLAUDE.md`
- Blueprint adversarial review caught 4 issues (see `plans/blog-app-build-plan.md` for details):
  1. `gray-matter` is Node.js-only — content goes to `public/content/`, not parsed in browser
  2. Supabase view count needs atomic RPC, not client-side upsert
  3. Prebuild script must gracefully skip when no token (local dev)
  4. `vercel.json` SPA rewrite required for React Router
- Updated `docs/ARCHITECTURE.md` and `docs/TASKS.md` with corrections
- Full step-by-step build plan written to `plans/blog-app-build-plan.md`
### Session 2 — 2026-03-24
- Completed Phase 1 (project scaffolding)
- Tailwind v4 used (different setup from v3 — `@tailwindcss/vite` plugin, no tailwind.config.ts)
- Build verified: `vite build` passes, dev server starts on localhost:5173
### Session 3 — 2026-03-24
- Completed Phase 2 (content infrastructure)
- Added design system: Inter + JetBrains Mono fonts, blue token system, light/dark mode (CSS vars + .dark class)
- Design tokens documented in `docs/DESIGN.md`
- `tsx scripts/fetch-content.ts` exits cleanly in dev mode (no token), full build passes
### Session 4 — 2026-03-24
- Completed Phase 3 (all UI components)
- All components use design tokens (no hardcoded colors)
- Syntax highlighting theme integrated into index.css (light + dark vars)
- Build: 27 modules, clean TypeScript, 230 kB JS / 35 kB CSS
### Session 5 — 2026-03-24
- Completed Phase 4 (pages and routing)
- Lazy-loaded pages with React.lazy + Suspense for code splitting
- Bundle: Home 1.4 kB gz, Post 100 kB gz (markdown+highlight only loads on post page), shared 74 kB gz
- usePageView is a stub (returns null) — replaced in Phase 5
### Session 6 — 2026-03-24
- Completed Phase 5 code (supabase.ts + usePageView real impl)
- Supabase manual setup still pending (user needs to create project + run SQL + set env vars)
- Created docs/DEPLOY.md (6-step deployment guide) + docs/content-repo/trigger-deploy.yml
- **Stopped at:** Phase 6 — docs ready, git push not yet done
- **Next step:** Phase 6 — git init + push app to GitHub, then follow docs/DEPLOY.md steps 2–6
