import type { EventRepository } from '../db/event-repository';
import type { OccurrenceRepository } from '../db/occurrence-repository';
import type { Occurrence } from '../../shared/types';

export interface OccurrenceServiceDeps {
  occurrences: OccurrenceRepository;
  events: EventRepository;
  now: () => Date;
}

/**
 * All state transitions for occurrences. Every transition appends to the
 * occurrence_events table so history and analytics can be rebuilt from events.
 */
export function createOccurrenceService(deps: OccurrenceServiceDeps) {
  const iso = (): string => deps.now().toISOString();

  return {
    /**
     * Creates a pending occurrence for a schedule fire, or returns null when
     * one already exists for that fire time (dedupe on restart/catch-up).
     */
    createFromSchedule(todoId: number, scheduleId: number, scheduledAt: Date): Occurrence | null {
      const scheduledAtIso = scheduledAt.toISOString();
      if (deps.occurrences.existsForFire(scheduleId, scheduledAtIso)) {
        return null;
      }
      const occurrence = deps.occurrences.create({
        todoId,
        scheduleId,
        scheduledAt: scheduledAtIso,
        createdAt: iso(),
      });
      deps.events.append(occurrence.id, 'created', { scheduledAt: scheduledAtIso }, iso());
      return occurrence;
    },

    complete(id: number): Occurrence {
      const timestamp = iso();
      const occurrence = deps.occurrences.setStatus(id, {
        status: 'completed',
        completedAt: timestamp,
        snoozedUntil: null,
      });
      deps.events.append(id, 'completed', {}, timestamp);
      return occurrence;
    },

    dismiss(id: number, reason: string): Occurrence {
      const timestamp = iso();
      const occurrence = deps.occurrences.setStatus(id, {
        status: 'dismissed',
        dismissedAt: timestamp,
        dismissReason: reason,
        snoozedUntil: null,
      });
      deps.events.append(id, 'dismissed', { reason }, timestamp);
      return occurrence;
    },

    snooze(id: number, minutes: number): Occurrence {
      if (minutes <= 0) {
        throw new Error(`Snooze minutes must be positive, got ${minutes}`);
      }
      const timestamp = iso();
      const until = new Date(deps.now().getTime() + minutes * 60_000).toISOString();
      const occurrence = deps.occurrences.setStatus(id, {
        status: 'snoozed',
        snoozedUntil: until,
      });
      deps.events.append(id, 'snoozed', { minutes, until }, timestamp);
      return occurrence;
    },

    /** Returns snoozed occurrences whose snooze elapsed, now pending again. */
    reopenDueSnoozes(): Occurrence[] {
      const due = deps.occurrences.listSnoozedDue(iso());
      return due.map((occurrence) => {
        const reopened = deps.occurrences.setStatus(occurrence.id, {
          status: 'pending',
          snoozedUntil: null,
        });
        deps.events.append(occurrence.id, 'reopened', { from: 'snooze' }, iso());
        return reopened;
      });
    },
  };
}

export type OccurrenceService = ReturnType<typeof createOccurrenceService>;
