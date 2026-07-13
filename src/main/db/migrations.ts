import type { DatabaseSync } from 'node:sqlite';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    expression TEXT NOT NULL,
    timezone TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_schedules_todo ON schedules(todo_id);

  CREATE TABLE occurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'completed', 'dismissed', 'snoozed')),
    completed_at TEXT,
    dismissed_at TEXT,
    dismiss_reason TEXT,
    snoozed_until TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_occurrences_status ON occurrences(status);
  CREATE INDEX idx_occurrences_todo ON occurrences(todo_id);
  CREATE INDEX idx_occurrences_scheduled_at ON occurrences(scheduled_at);
  CREATE UNIQUE INDEX idx_occurrences_schedule_fire
    ON occurrences(schedule_id, scheduled_at)
    WHERE schedule_id IS NOT NULL;

  CREATE TABLE occurrence_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
      CHECK (event_type IN ('created', 'completed', 'dismissed', 'snoozed', 'reopened')),
    metadata TEXT NOT NULL DEFAULT '{}',
    timestamp TEXT NOT NULL
  );
  CREATE INDEX idx_events_occurrence ON occurrence_events(occurrence_id);
  CREATE INDEX idx_events_type ON occurrence_events(event_type);

  CREATE TABLE dismiss_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL
  );
  INSERT INTO dismiss_reasons (label, sort_order) VALUES
    ('Didn''t need it', 1),
    ('Too busy', 2),
    ('Forgot', 3),
    ('Already did it', 4),
    ('Wrong timing', 5),
    ('Other', 6);
  `,
];

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const currentVersion = row.user_version;

  MIGRATIONS.slice(currentVersion).forEach((sql, index) => {
    const targetVersion = currentVersion + index + 1;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${targetVersion}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}
