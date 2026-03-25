import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getPost } from '@/lib/posts';
import { PostContent } from '@/components/Blog/PostContent';
import { Tag } from '@/components/ui/Tag';
import { ViewCount } from '@/components/ui/ViewCount';
import { ReadingProgress } from '@/components/ui/ReadingProgress';
import { RelatedPosts } from '@/components/Blog/RelatedPosts';
import { usePageView } from '@/lib/usePageView';
import { formatDate } from '@/lib/utils';
import type { Post as PostType } from '@/types/post';

export default function Post() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const { count } = usePageView(slug ?? '');

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    getPost(slug).then((data) => {
      setPost(data);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <PostSkeleton />;

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-text-primary text-xl font-semibold mb-2">Post not found</p>
        <p className="text-text-muted text-sm mb-8">
          This post may have been moved or deleted.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hover text-sm transition-colors duration-150"
        >
          ← Back to notes
        </Link>
      </div>
    );
  }

  return (
    <article>
      <ReadingProgress />

      <Helmet>
        <title>{post.title} — Notes</title>
        <meta name="description" content={post.description} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.date} />
        {post.tags.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
      </Helmet>

      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-text-muted text-sm hover:text-accent transition-colors duration-150 mb-10 group"
      >
        <ArrowLeftIcon />
        All notes
      </Link>

      {/* Title */}
      <h1 className="text-text-primary text-3xl font-semibold tracking-tight leading-tight mb-4">
        {post.title}
      </h1>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted text-sm mb-4">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span aria-hidden="true">·</span>
        <span>{post.readingTime} min read</span>
        <span aria-hidden="true">·</span>
        <ViewCount count={count} />
      </div>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-10">
          {post.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      )}

      {/* Divider */}
      <hr className="border-border mb-10" />

      {/* Content */}
      <PostContent content={post.content} />

      <RelatedPosts slug={post.slug} tags={post.tags} />
    </article>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="transition-transform duration-150 group-hover:-translate-x-0.5"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function PostSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-surface-raised rounded w-20 mb-10" />
      <div className="h-8 bg-surface-raised rounded w-3/4 mb-4" />
      <div className="h-4 bg-surface-raised rounded w-56 mb-4" />
      <div className="flex gap-2 mb-10">
        <div className="h-5 bg-surface-raised rounded w-14" />
        <div className="h-5 bg-surface-raised rounded w-16" />
      </div>
      <hr className="border-border mb-10" />
      <div className="space-y-3">
        {[100, 92, 96, 78, 88, 94, 70].map((w, i) => (
          <div
            key={i}
            className="h-4 bg-surface-raised rounded"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}
