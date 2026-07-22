import { describe, expect, it } from 'vitest';
import { normalizeInboxUrl, parseInboxMarkdown } from '../../src/shared/inbox-markdown';

describe('normalizeInboxUrl', () => {
  interface TestCase {
    input: string;
    output: string | null;
  }

  const testCases: TestCase[] = [
    { input: 'https://example.com/path', output: 'https://example.com/path' },
    { input: 'http://localhost:3000', output: 'http://localhost:3000/' },
    { input: '"https://example.com"', output: 'https://example.com/' },
    { input: 'javascript:alert(1)', output: null },
    { input: 'not-a-url', output: null },
    { input: '', output: null },
  ];

  testCases.forEach(({ input, output }) => {
    it(`normalizes ${input || '(empty)'}`, () => {
      expect(normalizeInboxUrl(input)).toBe(output);
    });
  });
});

describe('parseInboxMarkdown', () => {
  interface TestCase {
    description: string;
    input: string;
    output: { url: string | null; bodyMd: string | null };
  }

  const testCases: TestCase[] = [
    {
      description: 'extracts url and body from frontmatter',
      input: `---
url: https://jira.example.com/browse/FOO-123
---

# Context

Fix the login bug.`,
      output: {
        url: 'https://jira.example.com/browse/FOO-123',
        bodyMd: '# Context\n\nFix the login bug.',
      },
    },
    {
      description: 'accepts link as an alias for url',
      input: `---
link: https://example.com/task
---

Some notes.`,
      output: {
        url: 'https://example.com/task',
        bodyMd: 'Some notes.',
      },
    },
    {
      description: 'returns url-only when body is empty',
      input: `---
url: https://example.com
---`,
      output: { url: 'https://example.com/', bodyMd: null },
    },
    {
      description: 'treats files without frontmatter as body-only',
      input: '# Title\n\nJust markdown.',
      output: { url: null, bodyMd: '# Title\n\nJust markdown.' },
    },
    {
      description: 'ignores invalid url values in frontmatter',
      input: `---
url: ftp://files.example.com
---

Body`,
      output: { url: null, bodyMd: 'Body' },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      expect(parseInboxMarkdown(input)).toEqual(output);
    });
  });
});
