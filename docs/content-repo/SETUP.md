# blog-content repo setup

## Structure

```
blog-content/
├── posts/                    ← MD files (frontmatter + content)
├── admin/                    ← Local admin app (Vite + React)
│   └── ...                      Copy from docs/content-repo/admin/
├── .github/
│   └── workflows/
│       └── trigger-deploy.yml   Copy from docs/content-repo/trigger-deploy.yml
└── .gitignore
```

## .gitignore

```
node_modules/
admin/.env.local
```

## 1. Copy files

```bash
# From AINotesTakingApp repo:
cp -r docs/content-repo/admin/ /path/to/blog-content/admin/
cp docs/content-repo/trigger-deploy.yml /path/to/blog-content/.github/workflows/
```

## 2. Run Supabase SQL

Open Supabase → SQL editor → paste and run `docs/content-repo/supabase-posts.sql`.

## 3. Set up admin app

```bash
cd blog-content/admin/

# Install dependencies
npm install

# Create env file
cp .env.example .env.local
# Edit .env.local — fill in GitHub PAT, Supabase URL, service role key
```

## 4. Run admin

```bash
cd blog-content/admin/
npm run dev
# → http://localhost:4173
```

## Workflow

```
1. npm run dev (in admin/)        → opens local admin UI
2. New post → fill metadata + write/paste content → Publish
   → creates posts/YYYY-MM-DD-slug.md on GitHub
   → inserts row in Supabase posts table
   → GitHub Action fires → Vercel rebuild (current blog still uses static build)
3. Edit post → loads from GitHub, edit, save
4. Toggle draft → metadata-only update in Supabase (no rebuild needed)
```

## Environment variables needed

| Variable | Where to get it |
|---|---|
| `VITE_GITHUB_TOKEN` | GitHub → Settings → Developer settings → Fine-grained PAT → Contents: read+write on blog-content |
| `VITE_GITHUB_OWNER` | Your GitHub username |
| `VITE_GITHUB_REPO` | `blog-content` |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role key |

> The service role key bypasses Row Level Security. It's safe here because
> the admin app runs on your local machine only and is never deployed.
