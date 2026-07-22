import type {
  AnalyticsSummary,
  BestHour,
  DailyTrendPoint,
  ActionStatus,
  TodoAnalytics,
} from './types';

/**
 * Pure analytics over schedule-sourced actions. Callers pre-compute timezone-dependent
 * values (local hour and date key) so everything here is deterministic.
 */
export interface ActionForAnalytics {
  todoId: number;
  todoName: string;
  status: ActionStatus;
  dismissReason: string | null;
  /** Local hour of day (0-23) the action was scheduled for. */
  hour: number;
  /** Local calendar date key (YYYY-MM-DD) the action was scheduled on. */
  dateKey: string;
}

export interface AnalyticsInput {
  actions: ActionForAnalytics[];
  snoozeEventCount: number;
  rangeDays: number;
  /** Date keys covering the range, oldest first, for the daily trend. */
  dateKeys: string[];
}

/** Minimum samples in an hour bucket before calling it a "best time". */
const BEST_HOUR_MIN_SAMPLES = 3;

const countByStatus = (
  actions: ActionForAnalytics[],
  status: ActionStatus,
): number => actions.filter((action) => action.status === status).length;

function bestHourFor(actions: ActionForAnalytics[]): BestHour | null {
  const byHour = new Map<number, ActionForAnalytics[]>();
  actions.forEach((action) => {
    const bucket = byHour.get(action.hour) ?? [];
    bucket.push(action);
    byHour.set(action.hour, bucket);
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
  actions: ActionForAnalytics[],
): TodoAnalytics {
  const total = actions.length;
  const completed = countByStatus(actions, 'completed');
  const dismissed = countByStatus(actions, 'dismissed');
  return {
    todoId,
    todoName,
    total,
    completed,
    dismissed,
    pending: countByStatus(actions, 'pending'),
    snoozed: countByStatus(actions, 'snoozed'),
    completionRate: total > 0 ? completed / total : null,
    dismissRate: total > 0 ? dismissed / total : null,
    bestHour: bestHourFor(actions),
  };
}

function dismissReasonBreakdown(
  actions: ActionForAnalytics[],
): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  actions
    .filter((action) => action.status === 'dismissed' && action.dismissReason)
    .forEach((action) => {
      const reason = action.dismissReason as string;
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    });
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function dailyTrend(actions: ActionForAnalytics[], dateKeys: string[]): DailyTrendPoint[] {
  return dateKeys.map((date) => {
    const onDay = actions.filter((action) => action.dateKey === date);
    return {
      date,
      completed: countByStatus(onDay, 'completed'),
      dismissed: countByStatus(onDay, 'dismissed'),
    };
  });
}

export function computeAnalytics(input: AnalyticsInput): AnalyticsSummary {
  const { actions } = input;

  const todoIds = [...new Set(actions.map((action) => action.todoId))];
  const todos = todoIds
    .map((todoId) => {
      const forTodo = actions.filter((action) => action.todoId === todoId);
      return analyticsForTodo(todoId, forTodo[0].todoName, forTodo);
    })
    .sort((a, b) => b.total - a.total || a.todoName.localeCompare(b.todoName));

  return {
    rangeDays: input.rangeDays,
    totals: {
      actions: actions.length,
      completed: countByStatus(actions, 'completed'),
      dismissed: countByStatus(actions, 'dismissed'),
      pending: countByStatus(actions, 'pending'),
      snoozeEvents: input.snoozeEventCount,
    },
    todos,
    dismissReasonBreakdown: dismissReasonBreakdown(actions),
    dailyTrend: dailyTrend(actions, input.dateKeys),
  };
}
