import type { DatabaseSync } from 'node:sqlite';
import type {
  Action,
  ActionStatus,
  ActionWithTodo,
  HistoryFilters,
} from '../../shared/types';
import {
  toAction,
  toActionWithTodo,
  type ActionRow,
  type ActionWithTodoRow,
} from './rows';

const WITH_TODO_SELECT = `
  SELECT a.*, t.category AS todo_category
  FROM actions a
  LEFT JOIN todos t ON t.id = a.todo_id
`;

interface WhereClause {
  sql: string;
  params: (string | number)[];
}

function buildHistoryWhere(filters: HistoryFilters): WhereClause {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.from) {
    conditions.push('a.scheduled_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('a.scheduled_at < ?');
    params.push(filters.to);
  }
  if (filters.todoId !== undefined) {
    conditions.push('a.todo_id = ?');
    params.push(filters.todoId);
  }
  if (filters.category !== undefined) {
    conditions.push('t.category = ?');
    params.push(filters.category);
  }
  if (filters.status !== undefined) {
    conditions.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.scheduleOnly) {
    conditions.push("a.source = 'schedule'");
  }

  const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { sql, params };
}

export function createActionRepository(db: DatabaseSync) {
  return {
    create(input: {
      source: 'schedule' | 'file';
      todoId: number | null;
      scheduleId: number | null;
      title: string;
      bodyMd?: string | null;
      url?: string | null;
      scheduledAt: string;
      createdAt: string;
    }): Action {
      const result = db
        .prepare(
          `INSERT INTO actions (
             source, todo_id, schedule_id, title, body_md, url, scheduled_at, status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .run(
          input.source,
          input.todoId,
          input.scheduleId,
          input.title,
          input.bodyMd ?? null,
          input.url ?? null,
          input.scheduledAt,
          input.createdAt,
        );
      return this.getOrThrow(Number(result.lastInsertRowid));
    },

    /** True when an action already exists for this schedule fire time. */
    existsForFire(scheduleId: number, scheduledAt: string): boolean {
      const row = db
        .prepare('SELECT 1 AS x FROM actions WHERE schedule_id = ? AND scheduled_at = ?')
        .get(scheduleId, scheduledAt);
      return row !== undefined;
    },

    latestScheduledAtForSchedule(scheduleId: number): string | null {
      const row = db
        .prepare('SELECT MAX(scheduled_at) AS latest FROM actions WHERE schedule_id = ?')
        .get(scheduleId) as { latest: string | null };
      return row.latest;
    },

    get(id: number): Action | null {
      const row = db.prepare('SELECT * FROM actions WHERE id = ?').get(id) as ActionRow | undefined;
      return row ? toAction(row) : null;
    },

    getOrThrow(id: number): Action {
      const action = this.get(id);
      if (!action) {
        throw new Error(`Action ${id} not found`);
      }
      return action;
    },

    listPending(): ActionWithTodo[] {
      const rows = db
        .prepare(`${WITH_TODO_SELECT} WHERE a.status = 'pending' ORDER BY a.scheduled_at`)
        .all() as unknown as ActionWithTodoRow[];
      return rows.map(toActionWithTodo);
    },

    countPending(): number {
      const row = db
        .prepare(`SELECT COUNT(*) AS count FROM actions WHERE status = 'pending'`)
        .get() as { count: number };
      return row.count;
    },

    listSnoozedDue(now: string): Action[] {
      const rows = db
        .prepare(
          `SELECT * FROM actions
           WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?
           ORDER BY snoozed_until`,
        )
        .all(now) as unknown as ActionRow[];
      return rows.map(toAction);
    },

    listHistory(filters: HistoryFilters): ActionWithTodo[] {
      const where = buildHistoryWhere(filters);
      const rows = db
        .prepare(`${WITH_TODO_SELECT} ${where.sql} ORDER BY a.scheduled_at DESC`)
        .all(...where.params) as unknown as ActionWithTodoRow[];
      return rows.map(toActionWithTodo);
    },

    setStatus(
      id: number,
      update: {
        status: ActionStatus;
        completedAt?: string | null;
        dismissedAt?: string | null;
        dismissReason?: string | null;
        snoozedUntil?: string | null;
      },
    ): Action {
      const current = this.getOrThrow(id);
      db.prepare(
        `UPDATE actions
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

    delete(id: number): void {
      const result = db.prepare('DELETE FROM actions WHERE id = ?').run(id);
      if (result.changes === 0) {
        throw new Error(`Action ${id} not found`);
      }
    },
  };
}

export type ActionRepository = ReturnType<typeof createActionRepository>;
