import { describe, expect, it } from 'vitest';
import { createActionService } from '../../src/main/services/action-service';
import type { Action, ActionEventType } from '../../src/shared/types';
import { createRepos, createTestDb, seedAction, seedTodo } from '../helpers/test-db';

const NOW = new Date('2026-07-10T10:00:00.000Z');

function createFixture() {
  const repos = createRepos(createTestDb());
  const service = createActionService({
    actions: repos.actions,
    events: repos.events,
    now: () => NOW,
  });
  const todo = seedTodo(repos);
  return { repos, service, todo };
}

describe('action service actions', () => {
  interface Input {
    action: 'complete' | 'dismiss' | 'snooze';
    reason?: string;
    minutes?: number;
  }

  interface Output {
    action: Partial<Action>;
    eventType: ActionEventType;
    eventMetadata: Record<string, unknown>;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input) => {
    const { repos, service, todo } = createFixture();
    const action = seedAction(repos, todo.id);
    const act = {
      complete: () => service.complete(action.id),
      dismiss: () => service.dismiss(action.id, input.reason ?? 'Other'),
      snooze: () => service.snooze(action.id, input.minutes ?? 5),
    };
    return { repos, result: act[input.action](), actionId: action.id };
  };

  const verify = ({ repos, result, actionId }: ReturnType<typeof setup>, output: Output): void => {
    expect(result).toMatchObject(output.action);
    const events = repos.events.listForAction(actionId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(output.eventType);
    expect(events[0].metadata).toEqual(output.eventMetadata);
    expect(events[0].timestamp).toBe(NOW.toISOString());
  };

  const testCases: TestCase[] = [
    {
      description: 'complete stores the timestamp and appends a completed event',
      input: { action: 'complete' },
      output: {
        action: { status: 'completed', completedAt: NOW.toISOString() },
        eventType: 'completed',
        eventMetadata: {},
      },
    },
    {
      description: 'dismiss stores the reason and appends a dismissed event',
      input: { action: 'dismiss', reason: 'Too busy' },
      output: {
        action: {
          status: 'dismissed',
          dismissedAt: NOW.toISOString(),
          dismissReason: 'Too busy',
        },
        eventType: 'dismissed',
        eventMetadata: { reason: 'Too busy' },
      },
    },
    {
      description: 'snooze stores the wake time and appends a snoozed event',
      input: { action: 'snooze', minutes: 15 },
      output: {
        action: { status: 'snoozed', snoozedUntil: '2026-07-10T10:15:00.000Z' },
        eventType: 'snoozed',
        eventMetadata: { minutes: 15, until: '2026-07-10T10:15:00.000Z' },
      },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });

  it('rejects non-positive snooze durations', () => {
    const { repos, service, todo } = createFixture();
    const action = seedAction(repos, todo.id);
    expect(() => service.snooze(action.id, 0)).toThrow();
  });
});

describe('action service createFromSchedule', () => {
  const fireTime = new Date('2026-07-10T09:00:00.000Z');

  const setupWithSchedule = () => {
    const { repos, service, todo } = createFixture();
    const [schedule] = repos.schedules.replaceForTodo(todo.id, [
      { expression: '0 * * * *', timezone: 'UTC' },
    ]);
    return { repos, service, todo, schedule };
  };

  it('creates a pending action with a created event', () => {
    const { repos, service, todo, schedule } = setupWithSchedule();
    const action = service.createFromSchedule(todo.id, schedule.id, todo.name, fireTime);
    expect(action).toMatchObject({
      status: 'pending',
      scheduledAt: fireTime.toISOString(),
      scheduleId: schedule.id,
      title: todo.name,
    });
    const events = repos.events.listForAction(action!.id);
    expect(events.map((event) => event.eventType)).toEqual(['created']);
  });

  it('returns null instead of duplicating an existing fire', () => {
    const { service, todo, schedule } = setupWithSchedule();
    expect(service.createFromSchedule(todo.id, schedule.id, todo.name, fireTime)).not.toBeNull();
    expect(service.createFromSchedule(todo.id, schedule.id, todo.name, fireTime)).toBeNull();
  });
});

describe('action service createFromFile', () => {
  it('creates a file-sourced action without a todo', () => {
    const repos = createRepos(createTestDb());
    const service = createActionService({
      actions: repos.actions,
      events: repos.events,
      now: () => NOW,
    });
    const action = service.createFromFile(
      'Fix the bug',
      '# Details\n\nDo the thing.',
      'https://example.com/issue/1',
    );
    expect(action).toMatchObject({
      source: 'file',
      todoId: null,
      scheduleId: null,
      title: 'Fix the bug',
      bodyMd: '# Details\n\nDo the thing.',
      url: 'https://example.com/issue/1',
      status: 'pending',
    });
    const events = repos.events.listForAction(action.id);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('created');
    expect(events[0].metadata).toEqual({
      source: 'file',
      url: 'https://example.com/issue/1',
    });
  });
});

describe('action service reopenDueSnoozes', () => {
  const setup = (snoozedUntil: string) => {
    const { repos, service, todo } = createFixture();
    const action = seedAction(repos, todo.id);
    repos.actions.setStatus(action.id, { status: 'snoozed', snoozedUntil });
    return { repos, service, actionId: action.id };
  };

  it('reopens actions whose snooze elapsed and appends a reopened event', () => {
    const { repos, service, actionId } = setup('2026-07-10T09:59:00.000Z');
    const reopened = service.reopenDueSnoozes();
    expect(reopened.map((action) => action.id)).toEqual([actionId]);
    expect(reopened[0]).toMatchObject({ status: 'pending', snoozedUntil: null });
    const events = repos.events.listForAction(actionId);
    expect(events.map((event) => event.eventType)).toEqual(['reopened']);
  });

  it('leaves future snoozes alone', () => {
    const { service } = setup('2026-07-10T11:00:00.000Z');
    expect(service.reopenDueSnoozes()).toEqual([]);
  });
});

describe('action service delete', () => {
  it('removes the action and its events', () => {
    const { repos, service, todo } = createFixture();
    const action = seedAction(repos, todo.id);
    repos.events.append(action.id, 'created', {}, NOW.toISOString());

    service.delete(action.id);

    expect(repos.actions.get(action.id)).toBeNull();
    expect(repos.events.listForAction(action.id)).toEqual([]);
  });
});
