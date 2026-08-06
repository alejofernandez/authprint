/**
 * Lossy plain-text preview of a markdown note for the canvas node.
 * Deliberately not a parser: the canvas path must never load the markdown
 * renderer, and two lines cannot carry lists or fences anyway.
 */
export function stripMarkdown(src: string): string {
  return (
    src
      .replace(/```[\s\S]*?```/g, (block) => block.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/<\/?[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      // Collapse blank lines rather than preserving paragraphs. The node clamps to
      // two lines and renders with `whitespace-pre-line`, so a preserved paragraph
      // break spends one of those two lines on nothing and the content below it
      // never shows at all.
      .replace(/\n\s*\n/g, '\n')
      .trim()
  );
}
