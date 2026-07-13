import {
  test as base,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface AppFixtures {
  app: ElectronApplication;
  page: Page;
}

/**
 * Launches the built app (out/) against a throwaway userData dir with a fast
 * scheduler tick and OS notifications disabled.
 */
export const test = base.extend<AppFixtures>({
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, use) => {
    const userData = mkdtempSync(join(tmpdir(), 'actionable-e2e-'));
    const app = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        ACTIONABLE_USER_DATA: userData,
        ACTIONABLE_TICK_MS: '250',
        ACTIONABLE_DISABLE_NOTIFICATIONS: '1',
      },
    });
    await use(app);
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect };

/**
 * A 6-field cron (with seconds) that fires once, `seconds` from now, in the
 * machine's local time.
 */
export function cronFiringInSeconds(seconds: number): string {
  const at = new Date(Date.now() + seconds * 1000);
  return `${at.getSeconds()} ${at.getMinutes()} ${at.getHours()} * * *`;
}

export interface CreateTodoOptions {
  name: string;
  category?: string;
  /** Custom cron expression; when omitted the default daily preset is kept. */
  cron?: string;
}

export async function createTodo(page: Page, options: CreateTodoOptions): Promise<void> {
  await page.getByTestId('nav-todos').click();
  await page.getByTestId('new-todo').click();
  await page.getByTestId('todo-name-input').fill(options.name);
  if (options.category) {
    await page.getByTestId('todo-category-input').fill(options.category);
  }
  if (options.cron) {
    await page.getByTestId('schedule-kind').selectOption('custom');
    await page.getByTestId('schedule-cron-input').fill(options.cron);
  }
  await page.getByTestId('save-todo').click();
  await expect(page.getByTestId('todo-card').filter({ hasText: options.name })).toBeVisible();
}

/** Creates a todo whose schedule fires a few seconds from now. */
export async function createTodoFiringSoon(
  page: Page,
  name: string,
  category?: string,
): Promise<void> {
  await createTodo(page, { name, category, cron: cronFiringInSeconds(4) });
}
