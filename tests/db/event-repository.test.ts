import { describe, expect, it } from 'vitest';
import { createRepos, createTestDb, seedAction, seedTodo } from '../helpers/test-db';

describe('event repository', () => {
  it('appends and lists events with parsed metadata in order', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const action = seedAction(repos, todo.id);

    repos.events.append(action.id, 'created', {}, '2026-07-10T09:00:00.000Z');
    repos.events.append(
      action.id,
      'snoozed',
      { minutes: 15 },
      '2026-07-10T09:05:00.000Z',
    );

    const events = repos.events.listForAction(action.id);
    expect(events.map((event) => event.eventType)).toEqual(['created', 'snoozed']);
    expect(events[1].metadata).toEqual({ minutes: 15 });
  });

  it('counts events by type within a time range', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const action = seedAction(repos, todo.id);

    repos.events.append(action.id, 'snoozed', {}, '2026-07-10T09:00:00.000Z');
    repos.events.append(action.id, 'snoozed', {}, '2026-07-11T09:00:00.000Z');
    repos.events.append(action.id, 'completed', {}, '2026-07-10T10:00:00.000Z');

    const count = repos.events.countByType(
      'snoozed',
      '2026-07-10T00:00:00.000Z',
      '2026-07-11T00:00:00.000Z',
    );
    expect(count).toBe(1);
  });
});
