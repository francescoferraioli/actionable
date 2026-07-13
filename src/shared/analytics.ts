import type {
  AnalyticsSummary,
  BestHour,
  DailyTrendPoint,
  OccurrenceStatus,
  TodoAnalytics,
} from './types';

/**
 * Pure analytics over occurrences. Callers pre-compute timezone-dependent
 * values (local hour and date key) so everything here is deterministic.
 */
export interface OccurrenceForAnalytics {
  todoId: number;
  todoName: string;
  status: OccurrenceStatus;
  dismissReason: string | null;
  /** Local hour of day (0-23) the occurrence was scheduled for. */
  hour: number;
  /** Local calendar date key (YYYY-MM-DD) the occurrence was scheduled on. */
  dateKey: string;
}

export interface AnalyticsInput {
  occurrences: OccurrenceForAnalytics[];
  snoozeEventCount: number;
  rangeDays: number;
  /** Date keys covering the range, oldest first, for the daily trend. */
  dateKeys: string[];
}

/** Minimum samples in an hour bucket before calling it a "best time". */
const BEST_HOUR_MIN_SAMPLES = 3;

const countByStatus = (
  occurrences: OccurrenceForAnalytics[],
  status: OccurrenceStatus,
): number => occurrences.filter((occurrence) => occurrence.status === status).length;

function bestHourFor(occurrences: OccurrenceForAnalytics[]): BestHour | null {
  const byHour = new Map<number, OccurrenceForAnalytics[]>();
  occurrences.forEach((occurrence) => {
    const bucket = byHour.get(occurrence.hour) ?? [];
    bucket.push(occurrence);
    byHour.set(occurrence.hour, bucket);
  });

  const candidates = [...byHour.entries()]
    .map(([hour, bucket]) => ({
      hour,
      completed: countByStatus(bucket, 'completed'),
      total: bucket.length,
      rate: countByStatus(bucket, 'completed') / bucket.length,
    }))
    .filter((candidate) => candidate.total >= BEST_HOUR_MIN_SAMPLES && candidate.completed > 0);

  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((best, candidate) =>
    candidate.rate > best.rate || (candidate.rate === best.rate && candidate.hour < best.hour)
      ? candidate
      : best,
  );
}

function analyticsForTodo(
  todoId: number,
  todoName: string,
  occurrences: OccurrenceForAnalytics[],
): TodoAnalytics {
  const total = occurrences.length;
  const completed = countByStatus(occurrences, 'completed');
  const dismissed = countByStatus(occurrences, 'dismissed');
  return {
    todoId,
    todoName,
    total,
    completed,
    dismissed,
    pending: countByStatus(occurrences, 'pending'),
    snoozed: countByStatus(occurrences, 'snoozed'),
    completionRate: total > 0 ? completed / total : null,
    dismissRate: total > 0 ? dismissed / total : null,
    bestHour: bestHourFor(occurrences),
  };
}

function dismissReasonBreakdown(
  occurrences: OccurrenceForAnalytics[],
): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  occurrences
    .filter((occurrence) => occurrence.status === 'dismissed' && occurrence.dismissReason)
    .forEach((occurrence) => {
      const reason = occurrence.dismissReason as string;
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    });
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function dailyTrend(
  occurrences: OccurrenceForAnalytics[],
  dateKeys: string[],
): DailyTrendPoint[] {
  return dateKeys.map((date) => {
    const onDay = occurrences.filter((occurrence) => occurrence.dateKey === date);
    return {
      date,
      completed: countByStatus(onDay, 'completed'),
      dismissed: countByStatus(onDay, 'dismissed'),
    };
  });
}

export function computeAnalytics(input: AnalyticsInput): AnalyticsSummary {
  const { occurrences } = input;

  const todoIds = [...new Set(occurrences.map((occurrence) => occurrence.todoId))];
  const todos = todoIds
    .map((todoId) => {
      const forTodo = occurrences.filter((occurrence) => occurrence.todoId === todoId);
      return analyticsForTodo(todoId, forTodo[0].todoName, forTodo);
    })
    .sort((a, b) => b.total - a.total || a.todoName.localeCompare(b.todoName));

  return {
    rangeDays: input.rangeDays,
    totals: {
      occurrences: occurrences.length,
      completed: countByStatus(occurrences, 'completed'),
      dismissed: countByStatus(occurrences, 'dismissed'),
      pending: countByStatus(occurrences, 'pending'),
      snoozeEvents: input.snoozeEventCount,
    },
    todos,
    dismissReasonBreakdown: dismissReasonBreakdown(occurrences),
    dailyTrend: dailyTrend(occurrences, input.dateKeys),
  };
}
