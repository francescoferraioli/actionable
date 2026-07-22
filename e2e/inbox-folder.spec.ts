import { existsSync } from 'node:fs';
import {
  configureInboxFolder,
  createInboxFolder,
  dropMarkdownInboxFile,
  expect,
  test,
} from './helpers/app';

test('dropping a markdown file creates a complete-only inbox action', async ({ page }) => {
  const inboxFolder = createInboxFolder();
  await configureInboxFolder(page, inboxFolder);

  const filePath = dropMarkdownInboxFile(
    inboxFolder,
    'fix-the-bug.md',
    '# Details\n\nInvestigate the login flow.',
  );

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('action-card').filter({ hasText: 'fix the bug' });
  await expect(card).toBeVisible({ timeout: 10_000 });

  expect(existsSync(filePath)).toBe(false);
  await expect(card.getByTestId('complete-button')).toBeVisible();
  await expect(card.getByTestId('snooze-button')).toHaveCount(0);
  await expect(card.getByTestId('dismiss-button')).toHaveCount(0);
  await expect(card.getByTestId('action-body-preview')).toContainText('Investigate the login flow');
});

test('file-sourced action expands to show full markdown', async ({ page }) => {
  const inboxFolder = createInboxFolder();
  await configureInboxFolder(page, inboxFolder);
  dropMarkdownInboxFile(inboxFolder, 'review-notes.md', '# Review\n\nCheck the **edge cases**.');

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('action-card').filter({ hasText: 'review notes' });
  await expect(card).toBeVisible({ timeout: 10_000 });

  await card.getByTestId('action-expand').click();
  const body = page.getByTestId('action-body-full');
  await expect(body).toBeVisible();
  await expect(body).toContainText('Review');
  await expect(body).toContainText('edge cases');
});

test('completing a file-sourced action records it in history', async ({ page }) => {
  const inboxFolder = createInboxFolder();
  await configureInboxFolder(page, inboxFolder);
  dropMarkdownInboxFile(inboxFolder, 'quick-task.md', 'Just do it.');

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('action-card').filter({ hasText: 'quick task' });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByTestId('complete-button').click();

  await expect(page.getByTestId('inbox-empty')).toBeVisible();

  await page.getByTestId('nav-history').click();
  const historyRow = page.getByTestId('history-row').filter({ hasText: 'quick task' });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByTestId('history-status')).toContainText('Completed at');
});

test('file-sourced actions are excluded from analytics', async ({ page }) => {
  const inboxFolder = createInboxFolder();
  await configureInboxFolder(page, inboxFolder);
  dropMarkdownInboxFile(inboxFolder, 'one-off.md', 'Not a scheduled habit.');

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('action-card').filter({ hasText: 'one off' });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByTestId('complete-button').click();
  await expect(page.getByTestId('inbox-empty')).toBeVisible();

  await page.getByTestId('nav-analytics').click();
  await expect(page.getByTestId('analytics-empty')).toBeVisible();
});
