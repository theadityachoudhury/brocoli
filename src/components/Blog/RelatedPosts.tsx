import { useState, useEffect } from 'react';
import { getRelatedPosts } from '@/lib/posts';
import { PostCard } from '@/components/Blog/PostCard';
import type { PostMeta } from '@/types/post';

interface RelatedPostsProps {
  slug: string;
  tags: string[];
}

export function RelatedPosts({ slug, tags }: RelatedPostsProps) {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRelatedPosts(slug, tags).then((result) => {
      setPosts(result);
      setLoading(false);
    });
  }, [slug, tags]);

  if (loading || posts.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-border">
      <h2 className="text-text-primary text-lg font-semibold mb-6">Related posts</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
