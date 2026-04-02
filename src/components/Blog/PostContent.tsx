import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';

interface PostContentProps {
  content: string;
}

type PreProps = React.ComponentPropsWithoutRef<'pre'> & { node?: unknown };
type TableProps = React.ComponentPropsWithoutRef<'table'> & { node?: unknown };

function CopyableCodeBlock({ children, node: _, ...props }: PreProps) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  function copy() {
    const text = preRef.current?.textContent ?? '';
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <pre ref={preRef} {...props} className="relative group overflow-x-auto">
      {children}
      <button
        onClick={copy}
        aria-label="Copy code"
        className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 px-2 py-0.5 text-xs rounded border border-border text-text-muted hover:text-text-secondary bg-surface cursor-pointer"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </pre>
  );
}

function ScrollableTable({ children, node: _, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto w-full">
      <table {...props}>{children}</table>
    </div>
  );
}

export function PostContent({ content }: PostContentProps) {
  return (
    <div className="prose prose-base sm:prose-lg max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{ pre: CopyableCodeBlock, table: ScrollableTable }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
