import type { Post, PostMeta } from '@/types/post';

export async function getAllPosts(): Promise<PostMeta[]> {
  const res = await fetch('/content/index.json');
  if (!res.ok) return [];
  return res.json() as Promise<PostMeta[]>;
}

export async function getPost(slug: string): Promise<Post | null> {
  const [allPosts, contentRes] = await Promise.all([
    getAllPosts(),
    fetch(`/content/${slug}.md`),
  ]);

  const meta = allPosts.find((p) => p.slug === slug) ?? null;
  if (!meta || !contentRes.ok) return null;

  const content = await contentRes.text();
  return { ...meta, content };
}
