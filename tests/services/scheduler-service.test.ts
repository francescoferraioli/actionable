import { describe, expect, it } from 'vitest';
import { createOccurrenceService } from '../../src/main/services/occurrence-service';
import { createSchedulerService } from '../../src/main/services/scheduler-service';
import type { Occurrence } from '../../src/shared/types';
import { createRepos, createTestDb, seedTodo, type Repos } from '../helpers/test-db';

interface Fixture {
  repos: Repos;
  scheduler: ReturnType<typeof createSchedulerService>;
  clock: { current: Date };
  created: Occurrence[];
  reopened: Occurrence[];
  occurrenceService: ReturnType<typeof createOccurrenceService>;
  todoId: number;
  scheduleId: number;
}

function createFixture(options: {
  expression?: string;
  startAt: string;
  catchUpWindowMs?: number;
}): Fixture {
  const repos = createRepos(createTestDb());
  const clock = { current: new Date(options.startAt) };
  const now = (): Date => clock.current;
  const occurrenceService = createOccurrenceService({
    occurrences: repos.occurrences,
    events: repos.events,
    now,
  });
  const created: Occurrence[] = [];
  const reopened: Occurrence[] = [];
  const scheduler = createSchedulerService({
    schedules: repos.schedules,
    occurrences: repos.occurrences,
    occurrenceService,
    onOccurrencesCreated: (occurrences) => created.push(...occurrences),
    onOccurrencesReopened: (occurrences) => reopened.push(...occurrences),
    now,
    tickMs: 1000,
    catchUpWindowMs: options.catchUpWindowMs,
  });
  const todo = seedTodo(repos);
  const [schedule] = repos.schedules.replaceForTodo(todo.id, [
    { expression: options.expression ?? '0 * * * *', timezone: 'UTC' },
  ]);
  return {
    repos,
    scheduler,
    clock,
    created,
    reopened,
    occurrenceService,
    todoId: todo.id,
    scheduleId: schedule.id,
  };
}

describe('scheduler init catch-up', () => {
  it('surfaces the most recent missed fire within the catch-up window', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    expect(fixture.created.map((o) => o.scheduledAt)).toEqual(['2026-07-10T09:00:00.000Z']);
  });

  it('ignores missed fires older than the catch-up window', () => {
    const fixture = createFixture({
      expression: '0 9 * * *',
      startAt: '2026-07-10T12:00:00.000Z',
      catchUpWindowMs: 60 * 60 * 1000,
    });
    fixture.scheduler.init();
    expect(fixture.created).toEqual([]);
  });

  it('does not duplicate an occurrence that already exists for the fire', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;
    fixture.scheduler.init();
    expect(fixture.created).toEqual([]);
    expect(fixture.repos.occurrences.countPending()).toBe(1);
  });
});

describe('scheduler tick', () => {
  it('creates occurrences as fire times pass', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;

    fixture.clock.current = new Date('2026-07-10T09:59:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created).toEqual([]);

    fixture.clock.current = new Date('2026-07-10T10:00:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created.map((o) => o.scheduledAt)).toEqual(['2026-07-10T10:00:00.000Z']);
  });

  it('creates every fire passed while running', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;

    fixture.clock.current = new Date('2026-07-10T12:00:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created.map((o) => o.scheduledAt)).toEqual([
      '2026-07-10T10:00:00.000Z',
      '2026-07-10T11:00:00.000Z',
      '2026-07-10T12:00:00.000Z',
    ]);
  });

  it('reopens elapsed snoozes and reports them', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    const occurrence = fixture.created[0];
    fixture.occurrenceService.snooze(occurrence.id, 5);
    expect(fixture.repos.occurrences.countPending()).toBe(0);

    fixture.clock.current = new Date('2026-07-10T09:36:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.reopened.map((o) => o.id)).toEqual([occurrence.id]);
    expect(fixture.repos.occurrences.countPending()).toBe(1);
  });
});

describe('scheduler refresh', () => {
  it('stops tracking schedules that were deactivated', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;

    fixture.repos.schedules.replaceForTodo(fixture.todoId, [
      { expression: '0 * * * *', timezone: 'UTC', active: false },
    ]);
    fixture.scheduler.refresh();

    fixture.clock.current = new Date('2026-07-10T11:00:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created).toEqual([]);
  });
});
