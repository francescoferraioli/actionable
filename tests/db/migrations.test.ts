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
    expect(version.user_version).toBe(1);
  });
});
