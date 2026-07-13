import { createTodo, expect, test } from './helpers/app';

test('todos can be created, edited and deleted', async ({ page }) => {
  await page.getByTestId('nav-todos').click();
  await expect(page.getByTestId('todos-empty')).toBeVisible();

  // Create with the default daily preset.
  await createTodo(page, { name: 'Journal', category: 'mindfulness' });
  const card = page.getByTestId('todo-card').filter({ hasText: 'Journal' });
  await expect(card).toContainText('Daily at 9:00 AM');
  await expect(card).toContainText('mindfulness');

  // Edit the name and deactivate it.
  await card.getByTestId('edit-todo').click();
  await page.getByTestId('todo-name-input').fill('Evening journal');
  await page.getByTestId('todo-active-checkbox').uncheck();
  await page.getByTestId('save-todo').click();

  const renamed = page.getByTestId('todo-card').filter({ hasText: 'Evening journal' });
  await expect(renamed).toBeVisible();
  await expect(renamed).toContainText('inactive');

  // Delete it after confirming.
  await renamed.getByTestId('delete-todo').click();
  await page.getByTestId('confirm-delete').click();
  await expect(page.getByTestId('todos-empty')).toBeVisible();
});

test('invalid cron expressions are flagged and cannot be saved', async ({ page }) => {
  await page.getByTestId('nav-todos').click();
  await page.getByTestId('new-todo').click();
  await page.getByTestId('todo-name-input').fill('Broken');
  await page.getByTestId('schedule-kind').selectOption('custom');
  await page.getByTestId('schedule-cron-input').fill('not a cron');

  await expect(page.getByTestId('schedule-invalid')).toContainText('Invalid cron expression');
  await expect(page.getByTestId('save-todo')).toBeDisabled();
});

test('a todo can have multiple schedules', async ({ page }) => {
  await page.getByTestId('nav-todos').click();
  await page.getByTestId('new-todo').click();
  await page.getByTestId('todo-name-input').fill('Hydrate');
  await page.getByTestId('add-schedule').click();
  await expect(page.getByTestId('schedule-editor')).toHaveCount(2);

  const second = page.getByTestId('schedule-editor').nth(1);
  await second.getByTestId('schedule-kind').selectOption('hourlyBetween');
  await page.getByTestId('save-todo').click();

  const card = page.getByTestId('todo-card').filter({ hasText: 'Hydrate' });
  await expect(card).toContainText('Daily at 9:00 AM');
  await expect(card).toContainText('Every hour from 9am to 5pm');
});
