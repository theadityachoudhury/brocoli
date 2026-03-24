import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createFile, getFileContent, rawUrl, updateFile } from '../lib/github';
import {
  buildFileContent,
  computeReadingTime,
  parseTags,
  postFilename,
  slugify,
  stripFrontmatter,
  today,
} from '../lib/utils';
import Editor from '../components/Editor';
import type { Post, PostFormValues } from '../types/post';

const EMPTY_FORM: PostFormValues = {
  title: '',
  slug: '',
  date: today(),
  description: '',
  tags: '',
  draft: true,
};

export default function PostEditor() {
  const { slug } = useParams<{ slug?: string }>();
  const isEdit = Boolean(slug);
  const navigate = useNavigate();

  const [form, setForm] = useState<PostFormValues>(EMPTY_FORM);
  const [body, setBody] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);

  // Load existing post when editing
  useEffect(() => {
    if (!isEdit || !slug) return;

    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', slug)
        .single();

      if (err || !data) {
        setError('Post not found.');
        setLoading(false);
        return;
      }

      const post = data as Post;
      const filename = postFilename(post.date, post.slug);
      const rawContent = await getFileContent(filename);
      const bodyOnly = stripFrontmatter(rawContent);

      setForm({
        title: post.title,
        slug: post.slug,
        date: post.date,
        description: post.description,
        tags: post.tags.join(', '),
        draft: post.draft,
      });
      setBody(bodyOnly);
      setSlugManuallyEdited(true); // don't auto-derive slug in edit mode
      setLoading(false);
    }

    void load();
  }, [isEdit, slug]);

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: slugManuallyEdited ? f.slug : slugify(title),
    }));
  }

  async function save(asDraft: boolean) {
    setError(null);

    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.slug.trim()) { setError('Slug is required.'); return; }
    if (!form.description.trim()) { setError('Description is required.'); return; }

    setSaving(true);
    try {
      const tags = parseTags(form.tags);
      const readingTime = computeReadingTime(body);
      const filename = postFilename(form.date, form.slug);
      const fileContent = buildFileContent(
        { title: form.title, date: form.date, description: form.description, tags, draft: asDraft },
        body,
      );

      if (isEdit) {
        await updateFile(filename, fileContent, `update: ${form.title}`);
        const { error: err } = await supabase
          .from('posts')
          .update({
            title: form.title,
            description: form.description,
            tags,
            reading_time: readingTime,
            draft: asDraft,
          })
          .eq('slug', form.slug);
        if (err) throw new Error(err.message);
      } else {
        // Check slug uniqueness
        const { data: existing } = await supabase
          .from('posts')
          .select('slug')
          .eq('slug', form.slug)
          .maybeSingle();
        if (existing) throw new Error(`Slug "${form.slug}" is already taken.`);

        await createFile(filename, fileContent, `add: ${form.title}`);
        const { error: err } = await supabase.from('posts').insert({
          slug: form.slug,
          title: form.title,
          date: form.date,
          description: form.description,
          tags,
          reading_time: readingTime,
          draft: asDraft,
          raw_url: rawUrl(filename),
          view_count: 0,
        });
        if (err) throw new Error(err.message);
      }

      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">
          {isEdit ? 'Edit post' : 'New post'}
        </h1>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-5 mb-6">
        {/* Title */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Title</label>
          <input
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Post title"
          />
        </div>

        {/* Slug + Date row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Slug</label>
            <input
              value={form.slug}
              onChange={(e) => { setForm((f) => ({ ...f, slug: e.target.value })); setSlugManuallyEdited(true); }}
              disabled={isEdit}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-mono text-sm"
              placeholder="my-post-slug"
            />
            {isEdit && <p className="text-xs text-zinc-600 mt-1">Slug cannot be changed after creation.</p>}
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              disabled={isEdit}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="One-sentence summary shown in post cards"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Tags</label>
          <input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="react, typescript, nodejs"
          />
        </div>
      </div>

      {/* Editor */}
      <div className="mb-6">
        <label className="block text-sm text-zinc-400 mb-1">Content</label>
        <Editor value={body} onChange={setBody} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => void save(true)}
          disabled={saving}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save draft'}
        </button>
        <button
          onClick={() => void save(false)}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? 'Publishing...' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
