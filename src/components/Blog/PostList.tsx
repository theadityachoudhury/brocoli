import { PostCard } from './PostCard';
import type { PostMeta } from '@/types/post';

interface PostListProps {
  posts: PostMeta[];
  onTagClick?: (tag: string) => void;
}

export function PostList({ posts, onTagClick }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        No posts found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} onTagClick={onTagClick} />
      ))}
    </div>
  );
}
