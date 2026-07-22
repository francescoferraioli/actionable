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
  `
  CREATE TABLE actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL DEFAULT 'schedule'
      CHECK (source IN ('schedule', 'file')),
    todo_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body_md TEXT,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'completed', 'dismissed', 'snoozed')),
    completed_at TEXT,
    dismissed_at TEXT,
    dismiss_reason TEXT,
    snoozed_until TEXT,
    created_at TEXT NOT NULL,
    CHECK (
      (source = 'schedule' AND todo_id IS NOT NULL)
      OR (source = 'file' AND todo_id IS NULL)
    )
  );

  INSERT INTO actions (
    id, source, todo_id, schedule_id, title, body_md,
    scheduled_at, status, completed_at, dismissed_at, dismiss_reason,
    snoozed_until, created_at
  )
  SELECT
    o.id, 'schedule', o.todo_id, o.schedule_id, t.name, NULL,
    o.scheduled_at, o.status, o.completed_at, o.dismissed_at, o.dismiss_reason,
    o.snoozed_until, o.created_at
  FROM occurrences o
  JOIN todos t ON t.id = o.todo_id;

  CREATE INDEX idx_actions_status ON actions(status);
  CREATE INDEX idx_actions_todo ON actions(todo_id);
  CREATE INDEX idx_actions_scheduled_at ON actions(scheduled_at);
  CREATE UNIQUE INDEX idx_actions_schedule_fire
    ON actions(schedule_id, scheduled_at)
    WHERE schedule_id IS NOT NULL;

  CREATE TABLE action_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
      CHECK (event_type IN ('created', 'completed', 'dismissed', 'snoozed', 'reopened')),
    metadata TEXT NOT NULL DEFAULT '{}',
    timestamp TEXT NOT NULL
  );

  INSERT INTO action_events (id, action_id, event_type, metadata, timestamp)
  SELECT id, occurrence_id, event_type, metadata, timestamp
  FROM occurrence_events;

  CREATE INDEX idx_action_events_action ON action_events(action_id);
  CREATE INDEX idx_action_events_type ON action_events(event_type);

  DROP TABLE occurrence_events;
  DROP TABLE occurrences;

  INSERT INTO sqlite_sequence (name, seq)
  SELECT 'actions', COALESCE(MAX(id), 0) FROM actions;
  INSERT INTO sqlite_sequence (name, seq)
  SELECT 'action_events', COALESCE(MAX(id), 0) FROM action_events;

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function migrate(db: DatabaseSync, options?: { upTo?: number }): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const currentVersion = row.user_version;
  const targetVersion = options?.upTo ?? MIGRATIONS.length;
  const pending = MIGRATIONS.slice(currentVersion, targetVersion);

  pending.forEach((sql, index) => {
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
