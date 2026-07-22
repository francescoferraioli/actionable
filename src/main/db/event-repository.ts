import type { DatabaseSync } from 'node:sqlite';
import type { ActionEvent, ActionEventType } from '../../shared/types';
import { toActionEvent, type ActionEventRow } from './rows';

export function createEventRepository(db: DatabaseSync) {
  return {
    append(
      actionId: number,
      eventType: ActionEventType,
      metadata: Record<string, unknown>,
      timestamp: string,
    ): ActionEvent {
      const result = db
        .prepare(
          `INSERT INTO action_events (action_id, event_type, metadata, timestamp)
           VALUES (?, ?, ?, ?)`,
        )
        .run(actionId, eventType, JSON.stringify(metadata), timestamp);
      const row = db
        .prepare('SELECT * FROM action_events WHERE id = ?')
        .get(Number(result.lastInsertRowid)) as unknown as ActionEventRow;
      return toActionEvent(row);
    },

    listForAction(actionId: number): ActionEvent[] {
      const rows = db
        .prepare('SELECT * FROM action_events WHERE action_id = ? ORDER BY id')
        .all(actionId) as unknown as ActionEventRow[];
      return rows.map(toActionEvent);
    },

    countByType(eventType: ActionEventType, from: string, to: string): number {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS count FROM action_events
           WHERE event_type = ? AND timestamp >= ? AND timestamp < ?`,
        )
        .get(eventType, from, to) as { count: number };
      return row.count;
    },
  };
}

export type EventRepository = ReturnType<typeof createEventRepository>;
