import { describe, expect, it, vi } from 'vitest';
import {
  createFolderWatcherService,
  titleFromMarkdownFilename,
} from '../../src/main/services/folder-watcher-service';
import { createActionService } from '../../src/main/services/action-service';
import { createRepos, createTestDb } from '../helpers/test-db';

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

describe('createFolderWatcherService', () => {
  it('notifies with the created action after ingesting a file', () => {
    const repos = createRepos(createTestDb());
    const now = new Date('2026-07-10T10:00:00.000Z');
    const actionService = createActionService({
      actions: repos.actions,
      events: repos.events,
      now: () => now,
    });
    const onActionsCreated = vi.fn();
    const watcher = createFolderWatcherService({
      actionService,
      getInboxFolder: () => '/inbox',
      readFile: () => '# Note\n\nBody text.',
      unlink: vi.fn(),
      watch: () => () => {},
      onActionsCreated,
    });

    watcher.start(() => ['my-task.md']);

    expect(onActionsCreated).toHaveBeenCalledTimes(1);
    expect(onActionsCreated.mock.calls[0][0]).toMatchObject([
      { source: 'file', title: 'my task', bodyMd: '# Note\n\nBody text.' },
    ]);
  });
});
