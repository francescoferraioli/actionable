export interface Todo {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: number;
  todoId: number;
  expression: string;
  timezone: string;
  active: boolean;
}

export interface TodoWithSchedules extends Todo {
  schedules: Schedule[];
}

export type OccurrenceStatus = 'pending' | 'completed' | 'dismissed' | 'snoozed';

export interface Occurrence {
  id: number;
  todoId: number;
  scheduleId: number | null;
  scheduledAt: string;
  status: OccurrenceStatus;
  completedAt: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
  snoozedUntil: string | null;
  createdAt: string;
}

export interface OccurrenceWithTodo extends Occurrence {
  todoName: string;
  todoCategory: string | null;
}

export type OccurrenceEventType =
  | 'created'
  | 'completed'
  | 'dismissed'
  | 'snoozed'
  | 'reopened';

export interface OccurrenceEvent {
  id: number;
  occurrenceId: number;
  eventType: OccurrenceEventType;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface DismissReason {
  id: number;
  label: string;
  sortOrder: number;
}

export interface ScheduleInput {
  expression: string;
  timezone: string;
  active?: boolean;
}

export interface CreateTodoInput {
  name: string;
  description?: string | null;
  category?: string | null;
  schedules: ScheduleInput[];
}

export interface UpdateTodoInput {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  active: boolean;
  schedules: ScheduleInput[];
}

export interface HistoryFilters {
  /** Inclusive ISO lower bound on scheduledAt. */
  from?: string;
  /** Exclusive ISO upper bound on scheduledAt. */
  to?: string;
  todoId?: number;
  category?: string;
  status?: OccurrenceStatus;
}

export interface BestHour {
  hour: number;
  completed: number;
  total: number;
  rate: number;
}

export interface TodoAnalytics {
  todoId: number;
  todoName: string;
  total: number;
  completed: number;
  dismissed: number;
  pending: number;
  snoozed: number;
  completionRate: number | null;
  dismissRate: number | null;
  bestHour: BestHour | null;
}

export interface DailyTrendPoint {
  date: string;
  completed: number;
  dismissed: number;
}

export interface AnalyticsSummary {
  rangeDays: number;
  totals: {
    occurrences: number;
    completed: number;
    dismissed: number;
    pending: number;
    snoozeEvents: number;
  };
  todos: TodoAnalytics[];
  dismissReasonBreakdown: { reason: string; count: number }[];
  dailyTrend: DailyTrendPoint[];
}

export const SNOOZE_PRESETS_MINUTES = [5, 15, 60] as const;
