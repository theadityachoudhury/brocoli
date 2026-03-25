import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { getAllPosts, getAllTags } from '@/lib/posts';
import { PostList } from '@/components/Blog/PostList';
import { Tag } from '@/components/ui/Tag';
import type { PostMeta } from '@/types/post';

export default function Home() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasMore = posts.length < total;

  // Debounce search input 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset + reload when filter or search changes
  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setPage(0);
    void Promise.all([
      getAllPosts({ page: 0, tag: activeTag, search: debouncedSearch }),
      getAllTags(),
    ]).then(([result, tags]) => {
      setPosts(result.posts);
      setTotal(result.total);
      setAllTags(tags);
      setLoading(false);
    });
  }, [activeTag, debouncedSearch]);

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    const result = await getAllPosts({ page: next, tag: activeTag, search: debouncedSearch });
    setPosts((prev) => [...prev, ...result.posts]);
    setTotal(result.total);
    setPage(next);
    setLoadingMore(false);
  }

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
  }

  const countLabel = loading
    ? '\u00A0'
    : debouncedSearch || activeTag
      ? `${total} result${total !== 1 ? 's' : ''}`
      : `${total} post${total !== 1 ? 's' : ''}`;

  return (
    <div>
      <Helmet>
        <title>Notes</title>
        <meta name="description" content="Personal notes and articles." />
      </Helmet>

      {/* Heading */}
      <div className="mb-10">
        <h1 className="text-text-primary text-3xl font-semibold tracking-tight mb-1">Notes</h1>
        <p className="text-text-muted text-sm">{countLabel}</p>
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
        <>
          <PostList posts={posts} onTagClick={handleTagClick} />

          {hasMore && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="px-5 py-2 text-sm border border-border rounded-lg text-text-secondary hover:border-accent-border hover:text-accent transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
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
          <div className="h-5 bg-surface-raised rounded mb-3" style={{ width: `${titleWidth}%` }} />
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
