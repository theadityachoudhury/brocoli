import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Toolbar from './Toolbar';

type Mode = 'visual' | 'raw' | 'preview';

interface Props {
  value: string;
  onChange: (markdown: string) => void;
}

export default function Editor({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>('visual');
  // Raw textarea value — kept in sync when switching modes
  const [raw, setRaw] = useState(value);
  const isInitialized = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformPastedText: true }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content: value,
    onUpdate({ editor: e }) {
      const md = e.storage.markdown.getMarkdown() as string;
      onChange(md);
    },
  });

  // Load initial value into TipTap once it's ready
  useEffect(() => {
    if (editor && !isInitialized.current && value) {
      editor.commands.setContent(value);
      isInitialized.current = true;
    }
  }, [editor, value]);

  function handleTabChange(next: Mode) {
    if (mode === 'visual' && editor) {
      const md = editor.storage.markdown.getMarkdown() as string;
      setRaw(md);
      onChange(md);
    }
    if (mode === 'raw') {
      onChange(raw);
      if (next === 'visual' && editor) {
        editor.commands.setContent(raw);
      }
    }
    setMode(next);
  }

  function handleRawChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setRaw(e.target.value);
    onChange(e.target.value);
  }

  const tabs: Mode[] = ['visual', 'raw', 'preview'];

  return (
    <div className="flex flex-col border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-700 bg-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={[
              'px-4 py-2 text-sm capitalize transition-colors',
              mode === tab
                ? 'text-white border-b-2 border-blue-500 -mb-px'
                : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Visual mode */}
      {mode === 'visual' && editor && (
        <>
          <Toolbar editor={editor} />
          <EditorContent
            editor={editor}
            className="prose prose-invert prose-zinc max-w-none p-4 min-h-96 focus-within:outline-none"
          />
        </>
      )}

      {/* Raw mode */}
      {mode === 'raw' && (
        <textarea
          value={raw}
          onChange={handleRawChange}
          spellCheck={false}
          className="w-full min-h-96 p-4 bg-zinc-900 text-zinc-100 font-mono text-sm resize-y focus:outline-none"
          placeholder="Paste or type raw markdown here..."
        />
      )}

      {/* Preview mode */}
      {mode === 'preview' && (
        <div className="prose prose-invert prose-zinc max-w-none p-4 min-h-96 overflow-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {mode === 'preview' ? (editor?.storage.markdown.getMarkdown() as string ?? raw) : raw}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
