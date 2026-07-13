import type { DatabaseSync } from 'node:sqlite';
import type {
  HistoryFilters,
  Occurrence,
  OccurrenceStatus,
  OccurrenceWithTodo,
} from '../../shared/types';
import {
  toOccurrence,
  toOccurrenceWithTodo,
  type OccurrenceRow,
  type OccurrenceWithTodoRow,
} from './rows';

const WITH_TODO_SELECT = `
  SELECT o.*, t.name AS todo_name, t.category AS todo_category
  FROM occurrences o
  JOIN todos t ON t.id = o.todo_id
`;

interface WhereClause {
  sql: string;
  params: (string | number)[];
}

function buildHistoryWhere(filters: HistoryFilters): WhereClause {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.from) {
    conditions.push('o.scheduled_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('o.scheduled_at < ?');
    params.push(filters.to);
  }
  if (filters.todoId !== undefined) {
    conditions.push('o.todo_id = ?');
    params.push(filters.todoId);
  }
  if (filters.category !== undefined) {
    conditions.push('t.category = ?');
    params.push(filters.category);
  }
  if (filters.status !== undefined) {
    conditions.push('o.status = ?');
    params.push(filters.status);
  }

  const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { sql, params };
}

export function createOccurrenceRepository(db: DatabaseSync) {
  return {
    create(input: {
      todoId: number;
      scheduleId: number | null;
      scheduledAt: string;
      createdAt: string;
    }): Occurrence {
      const result = db
        .prepare(
          `INSERT INTO occurrences (todo_id, schedule_id, scheduled_at, status, created_at)
           VALUES (?, ?, ?, 'pending', ?)`,
        )
        .run(input.todoId, input.scheduleId, input.scheduledAt, input.createdAt);
      return this.getOrThrow(Number(result.lastInsertRowid));
    },

    /** True when an occurrence already exists for this schedule fire time. */
    existsForFire(scheduleId: number, scheduledAt: string): boolean {
      const row = db
        .prepare('SELECT 1 AS x FROM occurrences WHERE schedule_id = ? AND scheduled_at = ?')
        .get(scheduleId, scheduledAt);
      return row !== undefined;
    },

    latestScheduledAtForSchedule(scheduleId: number): string | null {
      const row = db
        .prepare('SELECT MAX(scheduled_at) AS latest FROM occurrences WHERE schedule_id = ?')
        .get(scheduleId) as { latest: string | null };
      return row.latest;
    },

    get(id: number): Occurrence | null {
      const row = db.prepare('SELECT * FROM occurrences WHERE id = ?').get(id) as
        | OccurrenceRow
        | undefined;
      return row ? toOccurrence(row) : null;
    },

    getOrThrow(id: number): Occurrence {
      const occurrence = this.get(id);
      if (!occurrence) {
        throw new Error(`Occurrence ${id} not found`);
      }
      return occurrence;
    },

    listPending(): OccurrenceWithTodo[] {
      const rows = db
        .prepare(`${WITH_TODO_SELECT} WHERE o.status = 'pending' ORDER BY o.scheduled_at`)
        .all() as unknown as OccurrenceWithTodoRow[];
      return rows.map(toOccurrenceWithTodo);
    },

    countPending(): number {
      const row = db
        .prepare(`SELECT COUNT(*) AS count FROM occurrences WHERE status = 'pending'`)
        .get() as { count: number };
      return row.count;
    },

    listSnoozedDue(now: string): Occurrence[] {
      const rows = db
        .prepare(
          `SELECT * FROM occurrences
           WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?
           ORDER BY snoozed_until`,
        )
        .all(now) as unknown as OccurrenceRow[];
      return rows.map(toOccurrence);
    },

    listHistory(filters: HistoryFilters): OccurrenceWithTodo[] {
      const where = buildHistoryWhere(filters);
      const rows = db
        .prepare(`${WITH_TODO_SELECT} ${where.sql} ORDER BY o.scheduled_at DESC`)
        .all(...where.params) as unknown as OccurrenceWithTodoRow[];
      return rows.map(toOccurrenceWithTodo);
    },

    setStatus(
      id: number,
      update: {
        status: OccurrenceStatus;
        completedAt?: string | null;
        dismissedAt?: string | null;
        dismissReason?: string | null;
        snoozedUntil?: string | null;
      },
    ): Occurrence {
      const current = this.getOrThrow(id);
      db.prepare(
        `UPDATE occurrences
         SET status = ?, completed_at = ?, dismissed_at = ?, dismiss_reason = ?, snoozed_until = ?
         WHERE id = ?`,
      ).run(
        update.status,
        update.completedAt !== undefined ? update.completedAt : current.completedAt,
        update.dismissedAt !== undefined ? update.dismissedAt : current.dismissedAt,
        update.dismissReason !== undefined ? update.dismissReason : current.dismissReason,
        update.snoozedUntil !== undefined ? update.snoozedUntil : current.snoozedUntil,
        id,
      );
      return this.getOrThrow(id);
    },
  };
}

export type OccurrenceRepository = ReturnType<typeof createOccurrenceRepository>;
