import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../../src/main/db/database';
import { createEventRepository } from '../../src/main/db/event-repository';
import { createOccurrenceRepository } from '../../src/main/db/occurrence-repository';
import { createScheduleRepository } from '../../src/main/db/schedule-repository';
import { createTodoRepository } from '../../src/main/db/todo-repository';
import type { Occurrence, OccurrenceStatus, Todo } from '../../src/shared/types';

export const T0 = '2026-07-01T00:00:00.000Z';

export function createTestDb(): DatabaseSync {
  return openDatabase(':memory:');
}

export function createRepos(db: DatabaseSync) {
  return {
    todos: createTodoRepository(db),
    schedules: createScheduleRepository(db),
    occurrences: createOccurrenceRepository(db),
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

export function seedOccurrence(
  repos: Repos,
  todoId: number,
  overrides: { scheduledAt?: string; status?: OccurrenceStatus; dismissReason?: string } = {},
): Occurrence {
  const scheduledAt = overrides.scheduledAt ?? T0;
  const occurrence = repos.occurrences.create({
    todoId,
    scheduleId: null,
    scheduledAt,
    createdAt: scheduledAt,
  });
  if (!overrides.status || overrides.status === 'pending') {
    return occurrence;
  }
  return repos.occurrences.setStatus(occurrence.id, {
    status: overrides.status,
    completedAt: overrides.status === 'completed' ? scheduledAt : null,
    dismissedAt: overrides.status === 'dismissed' ? scheduledAt : null,
    dismissReason: overrides.dismissReason ?? null,
    snoozedUntil: overrides.status === 'snoozed' ? scheduledAt : null,
  });
}
