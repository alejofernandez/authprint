import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NOTE_MARKDOWN_ALLOWED_ELEMENTS, NoteMarkdown } from './NoteMarkdown.tsx';
import { stripMarkdown } from './stripMarkdown.ts';

const ALLOWED = new Set<string>(NOTE_MARKDOWN_ALLOWED_ELEMENTS);

function tagNames(html: string): string[] {
  const tags: string[] = [];
  for (const match of html.matchAll(/<\/?([a-z0-9]+)[\s>]/gi)) {
    const name = match[1]?.toLowerCase();
    if (name) tags.push(name);
  }
  return tags;
}

describe('stripMarkdown', () => {
  test('strips common markers into plain text', () => {
    const plain = stripMarkdown('## Title\n\n- **bold** item\n\n`code` and [link](https://x)');
    expect(plain).toContain('Title');
    expect(plain).toContain('bold item');
    expect(plain).toContain('code');
    expect(plain).toContain('link');
    expect(plain).not.toContain('##');
    expect(plain).not.toContain('https://');
  });

  test('spends no preview line on a blank paragraph separator', () => {
    // The node clamps to two lines with `whitespace-pre-line`. A preserved
    // blank line burns one of them and hides the content underneath, which is
    // what the first ActionWithNotes baseline recorded.
    const lines = stripMarkdown('## Retry\n\n- maxAttempts: 3\n- backoff: exponential\n').split(
      '\n',
    );
    expect(lines.slice(0, 2)).toEqual(['Retry', 'maxAttempts: 3']);
    expect(lines.some((l) => l.trim() === '')).toBe(false);
  });
});

describe('NoteMarkdown allowlist (hostile fixture)', () => {
  const HOSTILE = [
    '[x](javascript:alert(1))',
    'https://evil.example',
    '<https://x>',
    '[ref][r]\n\n[r]: https://evil.example',
    '![img](data:image/svg+xml;base64,PHN2Zy9+)',
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<!-- comment -->',
  ].join('\n\n');

  test('renders no anchors, images, scripts, or off-allowlist elements', () => {
    const html = renderToStaticMarkup(createElement(NoteMarkdown, null, HOSTILE));
    expect(html).not.toMatch(/<a[\s>]/i);
    expect(html).not.toMatch(/<img[\s>]/i);
    expect(html).not.toMatch(/<script[\s>]/i);

    for (const tag of tagNames(html)) {
      // Wrapper div from the component root is outside the markdown dialect.
      if (tag === 'div') continue;
      expect(ALLOWED.has(tag)).toBe(true);
    }
  });

  test('supported constructs still render', () => {
    const html = renderToStaticMarkup(
      createElement(
        NoteMarkdown,
        null,
        '## Heading\n\n**bold** and *italic* and `code`\n\n- bullet\n\n1. ordered\n\n```\nfenced\n```\n',
      ),
    );
    expect(html).toContain('Heading');
    expect(html).toContain('bold');
    expect(html).toContain('bullet');
    expect(html).toContain('fenced');
    expect(html).toMatch(/<strong[\s>]/i);
    expect(html).toMatch(/<em[\s>]/i);
    expect(html).toMatch(/<code[\s>]/i);
    expect(html).toMatch(/<ul[\s>]/i);
    expect(html).toMatch(/<ol[\s>]/i);
  });
});
