import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createDismissReasonRepository } from '../../src/main/db/dismiss-reason-repository';
import { migrate } from '../../src/main/db/migrations';
import { createTestDb } from '../helpers/test-db';

describe('migrations', () => {
  it('creates the schema and seeds dismiss reasons', () => {
    const db = createTestDb();
    const reasons = createDismissReasonRepository(db).list();
    expect(reasons.map((reason) => reason.label)).toEqual([
      "Didn't need it",
      'Too busy',
      'Forgot',
      'Already did it',
      'Wrong timing',
      'Other',
    ]);
  });

  it('is idempotent when run again', () => {
    const db = createTestDb();
    expect(() => migrate(db)).not.toThrow();
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBe(2);
  });

  it('migrates occurrences to actions with titles from todos', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, { upTo: 1 });
    const now = '2026-07-01T00:00:00.000Z';
    db.prepare(
      `INSERT INTO todos (name, description, category, active, created_at, updated_at)
       VALUES ('Drink water', NULL, NULL, 1, ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO occurrences (todo_id, schedule_id, scheduled_at, status, created_at)
       VALUES (1, NULL, ?, 'pending', ?)`,
    ).run(now, now);

    migrate(db);

    const action = db.prepare('SELECT * FROM actions WHERE id = 1').get() as {
      source: string;
      title: string;
      todo_id: number;
    };
    expect(action).toMatchObject({ source: 'schedule', title: 'Drink water', todo_id: 1 });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((row) => row.name)).not.toContain('occurrences');
  });
});
