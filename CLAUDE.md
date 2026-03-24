# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal blog/notes-taking app. Content is stored as `.md` files in a **separate private repo** (`blog-content`). Pushing content triggers a Vercel rebuild of this React app. Page views tracked via Supabase.

**Docs to read first:**
- `docs/ARCHITECTURE.md` — full system design, diagrams, data models, env vars
- `docs/TASKS.md` — phase-by-phase task tracker with session log; always check "Next step" at the bottom before starting work
- `plans/blog-app-build-plan.md` — detailed step-by-step build plan with task checklists and verification commands per step

---

## Commands

**Note:** Tailwind v4 is installed (no `tailwind.config.ts` — configured via `src/index.css`).

```bash
npm run dev          # local dev server
npm run build        # prebuild (fetch content) + vite build
npm run preview      # preview production build locally
npm run lint         # eslint
```

The `build` command runs a prebuild script first (`scripts/fetch-content.ts`) that fetches `.md` files from the content repo via GitHub API before Vite builds.

---

## Architecture Summary

- **Two private repos:** `AINotesTakingApp` (this repo, app code) + `blog-content` (MD files only)
- **Deploy flow:** push to `blog-content` → GitHub Action fires Vercel deploy hook → Vercel fetches MD files + builds → deploys to CDN
- **Content loading:** build-time only; `content/` dir is gitignored and populated by prebuild script
- **Page views:** Supabase `page_views` table; upserted client-side on post load

## Design System

See `docs/DESIGN.md` for the full reference. Key rules:
- **Never hardcode hex colors** — always use CSS custom properties (`var(--accent)`, etc.)
- **Tailwind color utilities map to tokens:** `bg-surface`, `text-text-primary`, `text-accent`, `border-border`, `bg-accent-subtle`, etc.
- **Fonts:** Inter (UI), JetBrains Mono (code) — loaded in `index.html`
- **Dark mode:** automatic via `prefers-color-scheme`; also responds to `.dark` class on `<html>`
- All tokens defined in `src/index.css` under `:root` (light) and `@media (prefers-color-scheme: dark)` + `.dark` (dark)

## Key Conventions

- Post slugs are derived from filenames: `2025-03-24-my-post.md` → `/posts/my-post`
- All posts require frontmatter: `title`, `date`, `description`, `tags`, `draft`
- `draft: true` posts are excluded from builds
- Reading time is computed from content at build time, not stored in frontmatter

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS + @tailwindcss/typography |
| MD rendering | react-markdown + remark-gfm |
| Frontmatter | gray-matter |
| Read time | reading-time |
| Routing | React Router v6 |
| Page views | Supabase (free tier) |
| Hosting | Vercel |

## Environment Variables

See `docs/ARCHITECTURE.md` for full list. Required in Vercel:
- `CONTENT_REPO_TOKEN` — GitHub PAT (contents:read on blog-content repo)
- `CONTENT_REPO_OWNER`, `CONTENT_REPO_NAME`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Local dev: copy `.env.example` → `.env.local`

## Current Status

**Phases 1–5 complete.** Full app built. Supabase manual setup (project + SQL + env vars) still needed.
**Next:** Phase 6 — deployment (Vercel + content repo + deploy hook). See `docs/TASKS.md`.
