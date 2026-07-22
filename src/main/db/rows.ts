import type {
  Action,
  ActionEvent,
  ActionEventType,
  ActionStatus,
  ActionWithTodo,
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

export interface ActionRow {
  id: number;
  source: string;
  todo_id: number | null;
  schedule_id: number | null;
  title: string;
  body_md: string | null;
  scheduled_at: string;
  status: string;
  completed_at: string | null;
  dismissed_at: string | null;
  dismiss_reason: string | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface ActionWithTodoRow extends ActionRow {
  todo_category: string | null;
}

export interface ActionEventRow {
  id: number;
  action_id: number;
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

export function toAction(row: ActionRow): Action {
  return {
    id: row.id,
    source: row.source as Action['source'],
    todoId: row.todo_id,
    scheduleId: row.schedule_id,
    title: row.title,
    bodyMd: row.body_md,
    scheduledAt: row.scheduled_at,
    status: row.status as ActionStatus,
    completedAt: row.completed_at,
    dismissedAt: row.dismissed_at,
    dismissReason: row.dismiss_reason,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
  };
}

export function toActionWithTodo(row: ActionWithTodoRow): ActionWithTodo {
  return {
    ...toAction(row),
    todoCategory: row.todo_category,
  };
}

export function toActionEvent(row: ActionEventRow): ActionEvent {
  return {
    id: row.id,
    actionId: row.action_id,
    eventType: row.event_type as ActionEventType,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    timestamp: row.timestamp,
  };
}
