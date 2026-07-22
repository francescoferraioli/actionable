import type { DatabaseSync } from 'node:sqlite';

export const SETTING_INBOX_FOLDER = 'inbox_folder';

export function createSettingsRepository(db: DatabaseSync) {
  return {
    get(key: string): string | null {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row?.value ?? null;
    },

    set(key: string, value: string): void {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(key, value);
    },

    delete(key: string): void {
      db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
