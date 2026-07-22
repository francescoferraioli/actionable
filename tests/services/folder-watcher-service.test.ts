import { describe, expect, it } from 'vitest';
import { titleFromMarkdownFilename } from '../../src/main/services/folder-watcher-service';

describe('titleFromMarkdownFilename', () => {
  interface TestCase {
    filename: string;
    title: string | null;
  }

  const testCases: TestCase[] = [
    { filename: 'fix-the-bug.md', title: 'fix the bug' },
    { filename: 'Quick note.MD', title: 'Quick note' },
    { filename: 'readme.txt', title: null },
    { filename: '.md', title: null },
  ];

  testCases.forEach(({ filename, title }) => {
    it(`maps ${filename}`, () => {
      expect(titleFromMarkdownFilename(filename)).toBe(title);
    });
  });
});
