import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../../src/main/db/database';
import { createEventRepository } from '../../src/main/db/event-repository';
import { createActionRepository } from '../../src/main/db/action-repository';
import { createScheduleRepository } from '../../src/main/db/schedule-repository';
import { createTodoRepository } from '../../src/main/db/todo-repository';
import type { Action, ActionStatus, Todo } from '../../src/shared/types';

export const T0 = '2026-07-01T00:00:00.000Z';

export function createTestDb(): DatabaseSync {
  return openDatabase(':memory:');
}

export function createRepos(db: DatabaseSync) {
  return {
    todos: createTodoRepository(db),
    schedules: createScheduleRepository(db),
    actions: createActionRepository(db),
    events: createEventRepository(db),
  };
}

export type Repos = ReturnType<typeof createRepos>;

export function seedTodo(
  repos: Repos,
  overrides: { name?: string; category?: string | null } = {},
): Todo {
  return repos.todos.create(
    {
      name: overrides.name ?? 'Drink water',
      description: null,
      category: overrides.category ?? null,
    },
    T0,
  );
}

export function seedAction(
  repos: Repos,
  todoId: number,
  overrides: {
    title?: string;
    scheduledAt?: string;
    status?: ActionStatus;
    dismissReason?: string;
  } = {},
): Action {
  const scheduledAt = overrides.scheduledAt ?? T0;
  const action = repos.actions.create({
    source: 'schedule',
    todoId,
    scheduleId: null,
    title: overrides.title ?? 'Drink water',
    scheduledAt,
    createdAt: scheduledAt,
  });
  if (!overrides.status || overrides.status === 'pending') {
    return action;
  }
  return repos.actions.setStatus(action.id, {
    status: overrides.status,
    completedAt: overrides.status === 'completed' ? scheduledAt : null,
    dismissedAt: overrides.status === 'dismissed' ? scheduledAt : null,
    dismissReason: overrides.dismissReason ?? null,
    snoozedUntil: overrides.status === 'snoozed' ? scheduledAt : null,
  });
}
