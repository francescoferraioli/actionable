import type { DatabaseSync } from 'node:sqlite';
import type { Schedule, ScheduleInput } from '../../shared/types';
import { toSchedule, type ScheduleRow } from './rows';

export function createScheduleRepository(db: DatabaseSync) {
  return {
    listForTodo(todoId: number): Schedule[] {
      const rows = db
        .prepare('SELECT * FROM schedules WHERE todo_id = ? ORDER BY id')
        .all(todoId) as unknown as ScheduleRow[];
      return rows.map(toSchedule);
    },

    listActive(): Schedule[] {
      const rows = db
        .prepare(
          `SELECT s.* FROM schedules s
           JOIN todos t ON t.id = s.todo_id
           WHERE s.active = 1 AND t.active = 1
           ORDER BY s.id`,
        )
        .all() as unknown as ScheduleRow[];
      return rows.map(toSchedule);
    },

    /**
     * Replaces a todo's schedules with the given set. Existing schedules that
     * match an input by expression and timezone are kept (preserving their id,
     * and therefore the link from past occurrences); others are deleted.
     */
    replaceForTodo(todoId: number, inputs: ScheduleInput[]): Schedule[] {
      const existing = this.listForTodo(todoId);
      const matchesInput = (schedule: Schedule, input: ScheduleInput): boolean =>
        schedule.expression === input.expression && schedule.timezone === input.timezone;

      const kept = new Set<number>();
      inputs.forEach((input) => {
        const match = existing.find((s) => !kept.has(s.id) && matchesInput(s, input));
        if (match) {
          kept.add(match.id);
          db.prepare('UPDATE schedules SET active = ? WHERE id = ?').run(
            (input.active ?? true) ? 1 : 0,
            match.id,
          );
          return;
        }
        db.prepare(
          'INSERT INTO schedules (todo_id, expression, timezone, active) VALUES (?, ?, ?, ?)',
        ).run(todoId, input.expression, input.timezone, (input.active ?? true) ? 1 : 0);
      });

      existing
        .filter((schedule) => !kept.has(schedule.id))
        .forEach((schedule) => {
          db.prepare('DELETE FROM schedules WHERE id = ?').run(schedule.id);
        });

      return this.listForTodo(todoId);
    },
  };
}

export type ScheduleRepository = ReturnType<typeof createScheduleRepository>;
