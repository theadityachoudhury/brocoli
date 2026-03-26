import { Link } from 'react-router-dom';
import { Tag } from '@/components/ui/Tag';
import { formatDate } from '@/lib/utils';
import type { PostMeta } from '@/types/post';

interface PostCardProps {
  post: PostMeta;
  onTagClick?: (tag: string) => void;
}

export function PostCard({ post, onTagClick }: PostCardProps) {
  return (
    <article
      className="group bg-surface border border-border rounded-lg p-4 sm:p-6 transition-all duration-200 hover:border-accent-border"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Meta row */}
      <div className="flex items-center gap-2 text-text-muted text-sm mb-3">
        <time dateTime={post.date} className="whitespace-nowrap">{formatDate(post.date)}</time>
        <span aria-hidden="true">·</span>
        <span className="whitespace-nowrap">{post.readingTime} min read</span>
      </div>

      {/* Title */}
      <Link to={`/posts/${post.slug}`}>
        <h2 className="text-text-primary text-lg sm:text-xl font-semibold leading-snug mb-2 group-hover:text-accent transition-colors duration-150">
          {post.title}
        </h2>
      </Link>

      {/* Description */}
      <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-2">
        {post.description}
      </p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
            />
          ))}
        </div>
      )}
    </article>
  );
}
