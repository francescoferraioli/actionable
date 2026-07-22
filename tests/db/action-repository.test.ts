import { describe, expect, it } from 'vitest';
import type { HistoryFilters } from '../../src/shared/types';
import { createRepos, createTestDb, seedAction, seedTodo, type Repos } from '../helpers/test-db';

describe('action repository history filters', () => {
  interface Input {
    filters: HistoryFilters;
  }

  interface Output {
    /** `${title}@${scheduledAt}` keys in expected (scheduledAt DESC) order. */
    keys: string[];
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  interface Fixture {
    repos: Repos;
    todoIdsByName: Record<string, number>;
  }

  const at = (day: number, hour: number): string =>
    `2026-07-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  const setup = (): Fixture => {
    const repos = createRepos(createTestDb());
    const water = seedTodo(repos, { name: 'Drink water', category: 'health' });
    const exercise = seedTodo(repos, { name: 'Exercise', category: 'health' });
    const standup = seedTodo(repos, { name: 'Standup', category: 'work' });

    seedAction(repos, water.id, { title: 'Drink water', scheduledAt: at(10, 9), status: 'completed' });
    seedAction(repos, water.id, {
      title: 'Drink water',
      scheduledAt: at(11, 9),
      status: 'dismissed',
      dismissReason: 'Too busy',
    });
    seedAction(repos, water.id, { title: 'Drink water', scheduledAt: at(12, 9), status: 'pending' });
    seedAction(repos, exercise.id, { title: 'Exercise', scheduledAt: at(11, 7), status: 'completed' });
    seedAction(repos, standup.id, { title: 'Standup', scheduledAt: at(13, 10), status: 'snoozed' });

    return {
      repos,
      todoIdsByName: {
        'Drink water': water.id,
        Exercise: exercise.id,
        Standup: standup.id,
      },
    };
  };

  const verify = (fixture: Fixture, input: Input, output: Output): void => {
    const results = fixture.repos.actions.listHistory(input.filters);
    expect(results.map((a) => `${a.title}@${a.scheduledAt}`)).toEqual(output.keys);
  };

  const testCases: TestCase[] = [
    {
      description: 'returns everything sorted by scheduledAt descending when unfiltered',
      input: { filters: {} },
      output: {
        keys: [
          `Standup@${at(13, 10)}`,
          `Drink water@${at(12, 9)}`,
          `Drink water@${at(11, 9)}`,
          `Exercise@${at(11, 7)}`,
          `Drink water@${at(10, 9)}`,
        ],
      },
    },
    {
      description: 'filters by inclusive from bound',
      input: { filters: { from: at(12, 9) } },
      output: { keys: [`Standup@${at(13, 10)}`, `Drink water@${at(12, 9)}`] },
    },
    {
      description: 'filters by exclusive to bound',
      input: { filters: { to: at(11, 7) } },
      output: { keys: [`Drink water@${at(10, 9)}`] },
    },
    {
      description: 'filters by date range',
      input: { filters: { from: at(11, 0), to: at(12, 0) } },
      output: { keys: [`Drink water@${at(11, 9)}`, `Exercise@${at(11, 7)}`] },
    },
    {
      description: 'filters by category',
      input: { filters: { category: 'work' } },
      output: { keys: [`Standup@${at(13, 10)}`] },
    },
    {
      description: 'filters by status',
      input: { filters: { status: 'completed' } },
      output: { keys: [`Exercise@${at(11, 7)}`, `Drink water@${at(10, 9)}`] },
    },
    {
      description: 'combines category and status filters',
      input: { filters: { category: 'health', status: 'dismissed' } },
      output: { keys: [`Drink water@${at(11, 9)}`] },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(), input, output);
    });
  });

  it('filters by todoId', () => {
    const fixture = setup();
    const results = fixture.repos.actions.listHistory({
      todoId: fixture.todoIdsByName.Exercise,
    });
    expect(results.map((a) => a.title)).toEqual(['Exercise']);
  });

  it('excludes file-sourced actions when scheduleOnly is set', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    seedAction(repos, todo.id, { title: 'Scheduled', status: 'completed' });
    repos.actions.create({
      source: 'file',
      todoId: null,
      scheduleId: null,
      title: 'From file',
      bodyMd: 'body',
      scheduledAt: '2026-07-10T09:00:00.000Z',
      createdAt: '2026-07-10T09:00:00.000Z',
    });
    const results = repos.actions.listHistory({ scheduleOnly: true });
    expect(results.map((a) => a.title)).toEqual(['Scheduled']);
  });
});

describe('action repository status updates', () => {
  interface Input {
    update: Parameters<Repos['actions']['setStatus']>[1];
  }

  interface Output {
    status: string;
    completedAt: string | null;
    dismissReason: string | null;
    snoozedUntil: string | null;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const NOW = '2026-07-10T10:00:00.000Z';

  const setup = (input: Input) => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const action = seedAction(repos, todo.id);
    return repos.actions.setStatus(action.id, input.update);
  };

  const verify = (result: ReturnType<typeof setup>, output: Output): void => {
    expect(result).toMatchObject(output);
  };

  const testCases: TestCase[] = [
    {
      description: 'marks completed with a timestamp',
      input: { update: { status: 'completed', completedAt: NOW } },
      output: { status: 'completed', completedAt: NOW, dismissReason: null, snoozedUntil: null },
    },
    {
      description: 'marks dismissed with a reason',
      input: {
        update: { status: 'dismissed', dismissedAt: NOW, dismissReason: 'Too busy' },
      },
      output: { status: 'dismissed', completedAt: null, dismissReason: 'Too busy', snoozedUntil: null },
    },
    {
      description: 'marks snoozed until a time',
      input: { update: { status: 'snoozed', snoozedUntil: NOW } },
      output: { status: 'snoozed', completedAt: null, dismissReason: null, snoozedUntil: NOW },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });
});

describe('action repository scheduling helpers', () => {
  it('deduplicates actions per schedule fire time', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const [schedule] = repos.schedules.replaceForTodo(todo.id, [
      { expression: '0 * * * *', timezone: 'UTC' },
    ]);
    const fireTime = '2026-07-10T09:00:00.000Z';

    expect(repos.actions.existsForFire(schedule.id, fireTime)).toBe(false);
    repos.actions.create({
      source: 'schedule',
      todoId: todo.id,
      scheduleId: schedule.id,
      title: todo.name,
      scheduledAt: fireTime,
      createdAt: fireTime,
    });
    expect(repos.actions.existsForFire(schedule.id, fireTime)).toBe(true);
    expect(repos.actions.latestScheduledAtForSchedule(schedule.id)).toBe(fireTime);
    expect(() =>
      repos.actions.create({
        source: 'schedule',
        todoId: todo.id,
        scheduleId: schedule.id,
        title: todo.name,
        scheduledAt: fireTime,
        createdAt: fireTime,
      }),
    ).toThrow();
  });

  it('counts and lists pending actions ordered by scheduled time', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    seedAction(repos, todo.id, { scheduledAt: '2026-07-10T10:00:00.000Z' });
    seedAction(repos, todo.id, { scheduledAt: '2026-07-10T09:00:00.000Z' });
    seedAction(repos, todo.id, { scheduledAt: '2026-07-10T08:00:00.000Z', status: 'completed' });

    expect(repos.actions.countPending()).toBe(2);
    expect(repos.actions.listPending().map((a) => a.scheduledAt)).toEqual([
      '2026-07-10T09:00:00.000Z',
      '2026-07-10T10:00:00.000Z',
    ]);
  });

  it('lists snoozed actions whose snooze has elapsed', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const due = seedAction(repos, todo.id, {
      scheduledAt: '2026-07-10T09:00:00.000Z',
      status: 'snoozed',
    });
    repos.actions.setStatus(due.id, {
      status: 'snoozed',
      snoozedUntil: '2026-07-10T09:30:00.000Z',
    });
    const notDue = seedAction(repos, todo.id, {
      scheduledAt: '2026-07-10T10:00:00.000Z',
      status: 'snoozed',
    });
    repos.actions.setStatus(notDue.id, {
      status: 'snoozed',
      snoozedUntil: '2026-07-10T11:00:00.000Z',
    });

    const dueList = repos.actions.listSnoozedDue('2026-07-10T09:30:00.000Z');
    expect(dueList.map((a) => a.id)).toEqual([due.id]);
  });
});
