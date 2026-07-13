import { computeAnalytics, type OccurrenceForAnalytics } from '../../shared/analytics';
import type { AnalyticsSummary, OccurrenceWithTodo } from '../../shared/types';
import type { EventRepository } from '../db/event-repository';
import type { OccurrenceRepository } from '../db/occurrence-repository';

export interface AnalyticsServiceDeps {
  occurrences: OccurrenceRepository;
  events: EventRepository;
  now: () => Date;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toAnalyticsOccurrence(occurrence: OccurrenceWithTodo): OccurrenceForAnalytics {
  const scheduled = new Date(occurrence.scheduledAt);
  return {
    todoId: occurrence.todoId,
    todoName: occurrence.todoName,
    status: occurrence.status,
    dismissReason: occurrence.dismissReason,
    hour: scheduled.getHours(),
    dateKey: localDateKey(scheduled),
  };
}

function dateKeysForRange(now: Date, rangeDays: number): string[] {
  return Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (rangeDays - 1 - index));
    return localDateKey(date);
  });
}

export function createAnalyticsService(deps: AnalyticsServiceDeps) {
  return {
    summary(rangeDays: number): AnalyticsSummary {
      const now = deps.now();
      const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();

      const occurrences = deps.occurrences
        .listHistory({ from })
        .map(toAnalyticsOccurrence);

      return computeAnalytics({
        occurrences,
        snoozeEventCount: deps.events.countByType('snoozed', from, to),
        rangeDays,
        dateKeys: dateKeysForRange(now, rangeDays),
      });
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
