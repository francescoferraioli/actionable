import type { DatabaseSync } from 'node:sqlite';
import type { OccurrenceEvent, OccurrenceEventType } from '../../shared/types';
import { toOccurrenceEvent, type OccurrenceEventRow } from './rows';

export function createEventRepository(db: DatabaseSync) {
  return {
    append(
      occurrenceId: number,
      eventType: OccurrenceEventType,
      metadata: Record<string, unknown>,
      timestamp: string,
    ): OccurrenceEvent {
      const result = db
        .prepare(
          `INSERT INTO occurrence_events (occurrence_id, event_type, metadata, timestamp)
           VALUES (?, ?, ?, ?)`,
        )
        .run(occurrenceId, eventType, JSON.stringify(metadata), timestamp);
      const row = db
        .prepare('SELECT * FROM occurrence_events WHERE id = ?')
        .get(Number(result.lastInsertRowid)) as unknown as OccurrenceEventRow;
      return toOccurrenceEvent(row);
    },

    listForOccurrence(occurrenceId: number): OccurrenceEvent[] {
      const rows = db
        .prepare('SELECT * FROM occurrence_events WHERE occurrence_id = ? ORDER BY id')
        .all(occurrenceId) as unknown as OccurrenceEventRow[];
      return rows.map(toOccurrenceEvent);
    },

    countByType(eventType: OccurrenceEventType, from: string, to: string): number {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS count FROM occurrence_events
           WHERE event_type = ? AND timestamp >= ? AND timestamp < ?`,
        )
        .get(eventType, from, to) as { count: number };
      return row.count;
    },
  };
}

export type EventRepository = ReturnType<typeof createEventRepository>;
