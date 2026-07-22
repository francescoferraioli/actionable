import { createTodoFiringSoon, expect, test } from './helpers/app';

test('history filters by status and analytics reflect actions', async ({ page }) => {
  await createTodoFiringSoon(page, 'Meditate', 'mindfulness');

  // Action the first occurrence: complete it.
  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('action-card').filter({ hasText: 'Meditate' });
  await expect(card).toBeVisible();
  await card.getByTestId('complete-button').click();
  await expect(page.getByTestId('inbox-empty')).toBeVisible();

  // History: the completed row is there, and status filtering works.
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-row')).toHaveCount(1);
  await page.getByTestId('history-status-filter').selectOption('dismissed');
  await expect(page.getByTestId('history-row')).toHaveCount(0);
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await page.getByTestId('history-status-filter').selectOption('completed');
  await expect(page.getByTestId('history-row')).toHaveCount(1);

  // Analytics: totals and the per-todo completion rate reflect the action.
  await page.getByTestId('nav-analytics').click();
  const totals = page.getByTestId('analytics-totals');
  await expect(totals).toBeVisible();
  await expect(totals.locator('.stat-tile').filter({ hasText: 'Completed' })).toContainText('1');

  const todoCard = page.getByTestId('todo-analytics-card').filter({ hasText: 'Meditate' });
  await expect(todoCard).toContainText('100% completed');
});

test('analytics starts empty', async ({ page }) => {
  await page.getByTestId('nav-analytics').click();
  await expect(page.getByTestId('analytics-empty')).toBeVisible();
});
