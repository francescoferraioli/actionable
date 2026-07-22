import { computeAnalytics, type ActionForAnalytics } from '../../shared/analytics';
import type { ActionWithTodo, AnalyticsSummary } from '../../shared/types';
import type { EventRepository } from '../db/event-repository';
import type { ActionRepository } from '../db/action-repository';

export interface AnalyticsServiceDeps {
  actions: ActionRepository;
  events: EventRepository;
  now: () => Date;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toAnalyticsAction(action: ActionWithTodo): ActionForAnalytics {
  const scheduled = new Date(action.scheduledAt);
  return {
    todoId: action.todoId as number,
    todoName: action.title,
    status: action.status,
    dismissReason: action.dismissReason,
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

      const actions = deps.actions
        .listHistory({ from, scheduleOnly: true })
        .filter((action) => action.todoId !== null)
        .map(toAnalyticsAction);

      return computeAnalytics({
        actions,
        snoozeEventCount: deps.events.countByType('snoozed', from, to),
        rangeDays,
        dateKeys: dateKeysForRange(now, rangeDays),
      });
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
