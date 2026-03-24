import { useState, useEffect, useMemo } from 'react';
import { getAllPosts } from '@/lib/posts';
import { PostList } from '@/components/Blog/PostList';
import { Tag } from '@/components/ui/Tag';
import type { PostMeta } from '@/types/post';

export default function Home() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllPosts()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  const allTags = useMemo(
    () => Array.from(new Set(posts.flatMap((p) => p.tags))).sort(),
    [posts],
  );

  const filtered = useMemo(
    () =>
      posts
        .filter((p) => !activeTag || p.tags.includes(activeTag))
        .filter(
          (p) =>
            !search ||
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase()),
        ),
    [posts, activeTag, search],
  );

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-10">
        <h1 className="text-text-primary text-3xl font-semibold tracking-tight mb-1">
          Notes
        </h1>
        <p className="text-text-muted text-sm">
          {loading ? '\u00A0' : `${posts.length} post${posts.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <SearchIcon />
        <input
          type="search"
          placeholder="Search posts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus:border-accent-border transition-colors duration-150"
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {allTags.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => handleTagClick(tag)}
            />
          ))}
        </div>
      )}

      {/* Post list or skeleton */}
      {loading ? (
        <PostListSkeleton />
      ) : (
        <PostList posts={filtered} onTagClick={handleTagClick} />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function PostListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[72, 60, 80].map((titleWidth, i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-lg p-6 animate-pulse"
        >
          <div className="h-3.5 bg-surface-raised rounded w-36 mb-4" />
          <div
            className="h-5 bg-surface-raised rounded mb-3"
            style={{ width: `${titleWidth}%` }}
          />
          <div className="h-3.5 bg-surface-raised rounded w-full mb-2" />
          <div className="h-3.5 bg-surface-raised rounded w-2/3 mb-4" />
          <div className="flex gap-2">
            <div className="h-5 bg-surface-raised rounded w-14" />
            <div className="h-5 bg-surface-raised rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
