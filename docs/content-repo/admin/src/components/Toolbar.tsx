import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor;
}

type ToolbarAction = {
  label: string;
  action: () => void;
  active?: boolean;
};

export default function Toolbar({ editor }: Props) {
  const groups: ToolbarAction[][] = [
    [
      {
        label: 'B',
        action: () => editor.chain().focus().toggleBold().run(),
        active: editor.isActive('bold'),
      },
      {
        label: 'I',
        action: () => editor.chain().focus().toggleItalic().run(),
        active: editor.isActive('italic'),
      },
      {
        label: '`',
        action: () => editor.chain().focus().toggleCode().run(),
        active: editor.isActive('code'),
      },
    ],
    [
      {
        label: 'H1',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        active: editor.isActive('heading', { level: 1 }),
      },
      {
        label: 'H2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        active: editor.isActive('heading', { level: 2 }),
      },
      {
        label: 'H3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        active: editor.isActive('heading', { level: 3 }),
      },
    ],
    [
      {
        label: 'UL',
        action: () => editor.chain().focus().toggleBulletList().run(),
        active: editor.isActive('bulletList'),
      },
      {
        label: 'OL',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        active: editor.isActive('orderedList'),
      },
      {
        label: '❝',
        action: () => editor.chain().focus().toggleBlockquote().run(),
        active: editor.isActive('blockquote'),
      },
      {
        label: '```',
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        active: editor.isActive('codeBlock'),
      },
    ],
    [
      {
        label: '—',
        action: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
  ];

  return (
    <div className="flex flex-wrap gap-1 border-b border-zinc-700 px-3 py-2">
      {groups.map((group, gi) => (
        <span key={gi} className="flex gap-1 after:block after:w-px after:bg-zinc-700 after:mx-1 last:after:hidden">
          {group.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.action}
              className={[
                'px-2 py-0.5 rounded text-sm font-mono transition-colors',
                btn.active
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100',
              ].join(' ')}
            >
              {btn.label}
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}
