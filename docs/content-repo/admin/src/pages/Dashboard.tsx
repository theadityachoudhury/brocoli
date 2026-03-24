import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { deleteFile } from '../lib/github';
import { postFilename } from '../lib/utils';
import type { Post } from '../types/post';

const PAGE_SIZE = 10;

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(p: number) {
    setLoading(true);
    setError(null);
    const from = p * PAGE_SIZE;
    const { data, count, error: err } = await supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (err) {
      setError(err.message);
    } else {
      setPosts((data as Post[]) ?? []);
      setTotal(count ?? 0);
      setPage(p);
    }
    setLoading(false);
  }

  useEffect(() => { void loadPage(0); }, []);

  async function handleDelete(post: Post) {
    if (!confirm(`Delete "${post.title}"? This removes the GitHub file and Supabase record.`)) return;
    try {
      await deleteFile(postFilename(post.date, post.slug), `delete: ${post.title}`);
      const { error: err } = await supabase.from('posts').delete().eq('slug', post.slug);
      if (err) throw new Error(err.message);
      await loadPage(page);
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleToggleDraft(post: Post) {
    const { error: err } = await supabase
      .from('posts')
      .update({ draft: !post.draft })
      .eq('slug', post.slug);
    if (err) { alert(err.message); return; }
    await loadPage(page);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Posts</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{total} total</p>
        </div>
        <Link
          to="/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          New post
        </Link>
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-zinc-500 text-center py-16">No posts yet.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.slug}
              className="flex items-center justify-between px-4 py-3 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-100 font-medium truncate">{post.title}</span>
                  {post.draft && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                      draft
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {post.date} · {post.reading_time} min · {post.view_count} views
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  onClick={() => void handleToggleDraft(post)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                >
                  {post.draft ? 'Publish' : 'Unpublish'}
                </button>
                <Link
                  to={`/edit/${post.slug}`}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => void handleDelete(post)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => void loadPage(page - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => void loadPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
