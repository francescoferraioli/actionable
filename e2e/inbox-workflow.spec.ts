import { createTodoFiringSoon, expect, test } from './helpers/app';

test('scheduled todo creates an occurrence that can be completed', async ({ page }) => {
  await createTodoFiringSoon(page, 'Drink water');

  // The schedule fires and the occurrence lands in the inbox unprompted.
  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('occurrence-card').filter({ hasText: 'Drink water' });
  await expect(card).toBeVisible();
  await expect(page.getByTestId('unread-badge')).toHaveText('1');
  await expect(page.getByTestId('outstanding-count')).toHaveText('1 outstanding');
  await expect(card.getByTestId('occurrence-due')).toContainText('Due');

  await card.getByTestId('complete-button').click();

  await expect(page.getByTestId('inbox-empty')).toBeVisible();
  await expect(page.getByTestId('unread-badge')).toHaveCount(0);

  await page.getByTestId('nav-history').click();
  const historyRow = page.getByTestId('history-row').filter({ hasText: 'Drink water' });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByTestId('history-status')).toContainText('Completed at');
});

test('dismissing an occurrence requires a reason and records it', async ({ page }) => {
  await createTodoFiringSoon(page, 'Exercise');

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('occurrence-card').filter({ hasText: 'Exercise' });
  await expect(card).toBeVisible();

  await card.getByTestId('dismiss-button').click();
  const dialog = page.getByTestId('dismiss-reasons');
  await expect(dialog).toBeVisible();

  // Confirm is disabled until a reason is chosen.
  await expect(page.getByTestId('confirm-dismiss')).toBeDisabled();
  await dialog.getByText('Too busy').click();
  await page.getByTestId('confirm-dismiss').click();

  await expect(page.getByTestId('inbox-empty')).toBeVisible();

  await page.getByTestId('nav-history').click();
  const historyRow = page.getByTestId('history-row').filter({ hasText: 'Exercise' });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByTestId('history-status')).toContainText('Dismissed (too busy)');
});

test('snoozing hides an occurrence and brings it back when the snooze elapses', async ({
  page,
}) => {
  await createTodoFiringSoon(page, 'Stretch');

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('occurrence-card').filter({ hasText: 'Stretch' });
  await expect(card).toBeVisible();

  await card.getByTestId('snooze-button').click();
  await expect(page.getByTestId('snooze-panel')).toBeVisible();
  // 0.05 minutes = 3 seconds, so the test can watch it come back.
  await page.getByTestId('snooze-custom-input').fill('0.05');
  await page.getByTestId('snooze-custom-confirm').click();

  await expect(page.getByTestId('inbox-empty')).toBeVisible();
  await expect(page.getByTestId('unread-badge')).toHaveCount(0);

  // The snooze elapses and the occurrence becomes pending again.
  await expect(card).toBeVisible();
  await expect(page.getByTestId('unread-badge')).toHaveText('1');
});

test('snooze presets are offered', async ({ page }) => {
  await createTodoFiringSoon(page, 'Read');

  await page.getByTestId('nav-inbox').click();
  const card = page.getByTestId('occurrence-card').filter({ hasText: 'Read' });
  await expect(card).toBeVisible();
  await card.getByTestId('snooze-button').click();

  await expect(page.getByTestId('snooze-5')).toHaveText('5 minutes');
  await expect(page.getByTestId('snooze-15')).toHaveText('15 minutes');
  await expect(page.getByTestId('snooze-60')).toHaveText('1 hour');

  await page.getByTestId('snooze-5').click();
  await expect(page.getByTestId('inbox-empty')).toBeVisible();

  // A 5 minute snooze stays snoozed; it shows up in history as such.
  await page.getByTestId('nav-history').click();
  const historyRow = page.getByTestId('history-row').filter({ hasText: 'Read' });
  await expect(historyRow.getByTestId('history-status')).toContainText('Snoozed until');
});
