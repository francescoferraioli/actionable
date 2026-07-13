import type {
  Occurrence,
  OccurrenceEvent,
  OccurrenceEventType,
  OccurrenceStatus,
  OccurrenceWithTodo,
  Schedule,
  Todo,
} from '../../shared/types';

export interface TodoRow {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRow {
  id: number;
  todo_id: number;
  expression: string;
  timezone: string;
  active: number;
}

export interface OccurrenceRow {
  id: number;
  todo_id: number;
  schedule_id: number | null;
  scheduled_at: string;
  status: string;
  completed_at: string | null;
  dismissed_at: string | null;
  dismiss_reason: string | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface OccurrenceWithTodoRow extends OccurrenceRow {
  todo_name: string;
  todo_category: string | null;
}

export interface OccurrenceEventRow {
  id: number;
  occurrence_id: number;
  event_type: string;
  metadata: string;
  timestamp: string;
}

export function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    todoId: row.todo_id,
    expression: row.expression,
    timezone: row.timezone,
    active: row.active === 1,
  };
}

export function toOccurrence(row: OccurrenceRow): Occurrence {
  return {
    id: row.id,
    todoId: row.todo_id,
    scheduleId: row.schedule_id,
    scheduledAt: row.scheduled_at,
    status: row.status as OccurrenceStatus,
    completedAt: row.completed_at,
    dismissedAt: row.dismissed_at,
    dismissReason: row.dismiss_reason,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
  };
}

export function toOccurrenceWithTodo(row: OccurrenceWithTodoRow): OccurrenceWithTodo {
  return {
    ...toOccurrence(row),
    todoName: row.todo_name,
    todoCategory: row.todo_category,
  };
}

export function toOccurrenceEvent(row: OccurrenceEventRow): OccurrenceEvent {
  return {
    id: row.id,
    occurrenceId: row.occurrence_id,
    eventType: row.event_type as OccurrenceEventType,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    timestamp: row.timestamp,
  };
}
