'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';

/**
 * Tag names the notes dialect may emit. Anything else is unwrapped to text
 * (`unwrapDisallowed`) or dropped. Assert hostile fixtures against this list,
 * not against individual attack strings.
 */
export const NOTE_MARKDOWN_ALLOWED_ELEMENTS = [
  'p',
  'h1',
  'h2',
  'h3',
  'strong',
  'em',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
] as const;

export type NoteMarkdownAllowedElement = (typeof NOTE_MARKDOWN_ALLOWED_ELEMENTS)[number];

/** Neutralise any URL that survives parsing — notes never fetch or navigate. */
function neutralizeUrl(): string {
  return '';
}

function FlatHeading({ children }: { children?: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-fg-muted">{children}</div>;
}

const components: Components = {
  h1: FlatHeading,
  h2: FlatHeading,
  h3: FlatHeading,
  p: ({ children }) => <p className="my-1 text-xs leading-snug text-fg-default">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-4 text-xs">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-4 text-xs">{children}</ol>,
  li: ({ children }) => <li className="text-xs leading-snug text-fg-default">{children}</li>,
  pre: ({ children }) => (
    <pre className="my-1 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded border border-border-subtle bg-bg-subtle px-2 py-1 font-mono text-[11px] text-fg-default dark:border-border-default">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    // Fenced blocks wrap `code` in `pre`; inline code stands alone.
    const fenced = Boolean(className) || (typeof children === 'string' && children.includes('\n'));
    if (fenced) {
      return <code className="font-mono text-[11px]">{children}</code>;
    }
    return (
      <code className="break-words whitespace-pre-wrap rounded bg-bg-subtle px-1 py-0.5 font-mono text-[11px] text-fg-default">
        {children}
      </code>
    );
  },
};

export type NoteMarkdownProps = {
  children: string;
  className?: string;
};

/**
 * Shared markdown renderer for node notes (and future Annotation.text).
 * Allowlist only — no rehype-raw, no GFM, no links/images/HTML.
 */
export function NoteMarkdown({ children, className }: NoteMarkdownProps) {
  return (
    <div className={className} data-note-markdown>
      <ReactMarkdown
        allowedElements={[...NOTE_MARKDOWN_ALLOWED_ELEMENTS]}
        unwrapDisallowed
        urlTransform={neutralizeUrl}
        skipHtml
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
