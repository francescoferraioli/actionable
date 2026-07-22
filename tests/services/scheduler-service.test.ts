import { describe, expect, it } from 'vitest';
import { createActionService } from '../../src/main/services/action-service';
import { createSchedulerService } from '../../src/main/services/scheduler-service';
import type { Action } from '../../src/shared/types';
import { createRepos, createTestDb, seedTodo, type Repos } from '../helpers/test-db';

interface Fixture {
  repos: Repos;
  scheduler: ReturnType<typeof createSchedulerService>;
  clock: { current: Date };
  created: Action[];
  reopened: Action[];
  actionService: ReturnType<typeof createActionService>;
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
  const actionService = createActionService({
    actions: repos.actions,
    events: repos.events,
    now,
  });
  const created: Action[] = [];
  const reopened: Action[] = [];
  const todo = seedTodo(repos);
  const scheduler = createSchedulerService({
    schedules: repos.schedules,
    todos: repos.todos,
    actions: repos.actions,
    actionService,
    onActionsCreated: (actions) => created.push(...actions),
    onActionsReopened: (actions) => reopened.push(...actions),
    now,
    tickMs: 1000,
    catchUpWindowMs: options.catchUpWindowMs,
  });
  const [schedule] = repos.schedules.replaceForTodo(todo.id, [
    { expression: options.expression ?? '0 * * * *', timezone: 'UTC' },
  ]);
  return {
    repos,
    scheduler,
    clock,
    created,
    reopened,
    actionService,
    todoId: todo.id,
    scheduleId: schedule.id,
  };
}

describe('scheduler init catch-up', () => {
  it('surfaces the most recent missed fire within the catch-up window', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    expect(fixture.created.map((a) => a.scheduledAt)).toEqual(['2026-07-10T09:00:00.000Z']);
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

  it('does not duplicate an action that already exists for the fire', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;
    fixture.scheduler.init();
    expect(fixture.created).toEqual([]);
    expect(fixture.repos.actions.countPending()).toBe(1);
  });
});

describe('scheduler tick', () => {
  it('creates actions as fire times pass', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;

    fixture.clock.current = new Date('2026-07-10T09:59:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created).toEqual([]);

    fixture.clock.current = new Date('2026-07-10T10:00:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created.map((a) => a.scheduledAt)).toEqual(['2026-07-10T10:00:00.000Z']);
  });

  it('creates every fire passed while running', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    fixture.created.length = 0;

    fixture.clock.current = new Date('2026-07-10T12:00:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.created.map((a) => a.scheduledAt)).toEqual([
      '2026-07-10T10:00:00.000Z',
      '2026-07-10T11:00:00.000Z',
      '2026-07-10T12:00:00.000Z',
    ]);
  });

  it('reopens elapsed snoozes and reports them', () => {
    const fixture = createFixture({ startAt: '2026-07-10T09:30:00.000Z' });
    fixture.scheduler.init();
    const action = fixture.created[0];
    fixture.actionService.snooze(action.id, 5);
    expect(fixture.repos.actions.countPending()).toBe(0);

    fixture.clock.current = new Date('2026-07-10T09:36:00.000Z');
    fixture.scheduler.tick();
    expect(fixture.reopened.map((a) => a.id)).toEqual([action.id]);
    expect(fixture.repos.actions.countPending()).toBe(1);
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
