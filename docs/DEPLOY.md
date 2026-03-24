# Deployment Guide

Full step-by-step guide to go from local dev to a live site on Vercel with a custom domain.

---

## Overview

```
AINotesTakingApp (private) ──► Vercel ──► yourdomain.com
                                  ▲
blog-content (private) ──► GitHub Action ──┘
```

---

## Step 1 — Push app repo to GitHub

Create a new **private** repo on GitHub named `AINotesTakingApp`, then:

```bash
cd /path/to/AINotesTakingApp
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/theadityachoudhury/AINotesTakingApp.git
git push -u origin main
```

> Make sure `.gitignore` includes `public/content/` and `.env.local` — both are already listed.

---

## Step 2 — Create Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `AINotesTakingApp` from GitHub
3. Vercel will auto-detect it as a Vite project
4. **Before deploying**, set environment variables (Step 3)

---

## Step 3 — Set Vercel environment variables

In Vercel → Project → **Settings → Environment Variables**, add all of these:

| Name | Value | Environments |
|---|---|---|
| `CONTENT_REPO_TOKEN` | Your GitHub PAT (fine-grained, `blog-content` contents:read) | Production, Preview |
| `CONTENT_REPO_OWNER` | `theadityachoudhury` | Production, Preview |
| `CONTENT_REPO_NAME` | `blog-content` | Production, Preview |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview |

Then trigger the first deploy from the Vercel dashboard.

---

## Step 4 — Configure custom domain

1. Vercel → Project → **Settings → Domains**
2. Add your domain (e.g. `notes.yourdomain.com`)
3. Vercel shows you the DNS record to add — go to your domain registrar and add it:
   - Type: `CNAME`
   - Name: `notes` (or `@` for apex)
   - Value: `cname.vercel-dns.com`
4. HTTPS is provisioned automatically via Let's Encrypt (takes a few minutes after DNS propagates)

---

## Step 5 — Set up blog-content repo

Your `blog-content` repo already exists. Now set it up for the deploy pipeline.

### 5a — Create posts/ directory

GitHub doesn't allow empty directories. Add your first post to create it:

```bash
cd /path/to/blog-content
mkdir posts
```

Create `posts/2026-03-24-nodejs-internals-deep-dive.md`:

```yaml
---
title: "Node.js Internals Deep Dive"
date: 2026-03-24
description: "A deep dive into Node.js internals"
tags: [nodejs, internals]
draft: false
---

Your post content here...
```

```bash
git add posts/
git commit -m "add: first post"
git push
```

### 5b — Get Vercel deploy hook URL

1. Vercel → Project → **Settings → Git → Deploy Hooks**
2. Create a hook:
   - **Hook name:** `blog-content push`
   - **Branch:** `main`
3. Copy the generated URL — it looks like:
   `https://api.vercel.com/v1/integrations/deploy/prj_.../...`

### 5c — Add deploy hook as GitHub Secret

In `blog-content` GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

- **Name:** `VERCEL_DEPLOY_HOOK_URL`
- **Value:** the URL from Step 5b

### 5d — Add GitHub Actions workflow

Copy `docs/content-repo/trigger-deploy.yml` from this repo into the content repo:

```bash
mkdir -p .github/workflows
cp /path/to/AINotesTakingApp/docs/content-repo/trigger-deploy.yml \
   .github/workflows/trigger-deploy.yml

git add .github/
git commit -m "ci: trigger Vercel deploy on post push"
git push
```

---

## Step 6 — Test the full pipeline

```bash
cd /path/to/blog-content

# Create a test post
cat > posts/2026-03-24-hello-world.md << 'EOF'
---
title: "Hello World"
date: 2026-03-24
description: "My first post"
tags: [meta]
draft: false
---

This is my first post. The pipeline works!
EOF

git add posts/
git commit -m "add: hello world post"
git push
```

Then verify:
1. **GitHub** → `blog-content` → Actions tab → workflow run appears ✓
2. **Vercel** → Project → Deployments → new build starts ✓
3. **Site** → your domain → new post appears ✓
4. **Open the post** → view count increments in Supabase ✓

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Build fails on Vercel | Missing env vars | Check all 5 vars are set in Vercel dashboard |
| Posts not showing | GitHub PAT expired or wrong scope | Regenerate PAT with `contents:read` on `blog-content` |
| Posts not showing | `posts/` dir path wrong in content repo | Ensure files are at `posts/*.md`, not in a subfolder |
| View count not working | Supabase env vars not set | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel |
| Direct URLs return 404 | `vercel.json` not committed | Ensure `vercel.json` is in the root of app repo |
| GitHub Action not firing | Workflow path filter too strict | Check files are under `posts/` not root |

---

## Post frontmatter reference

Every post in `blog-content/posts/` must have:

```yaml
---
title: "Your Post Title"
date: 2026-03-24          # YYYY-MM-DD
description: "One sentence summary shown in post cards"
tags: [tag1, tag2]        # array, used for filtering
draft: false              # set true to push without publishing
---
```

Filename format: `YYYY-MM-DD-slug.md`
The slug in the URL is derived by stripping the date prefix: `2026-03-24-my-post.md` → `/posts/my-post`
