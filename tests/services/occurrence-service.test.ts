import { describe, expect, it } from 'vitest';
import { createOccurrenceService } from '../../src/main/services/occurrence-service';
import type { Occurrence, OccurrenceEventType } from '../../src/shared/types';
import { createRepos, createTestDb, seedOccurrence, seedTodo } from '../helpers/test-db';

const NOW = new Date('2026-07-10T10:00:00.000Z');

function createFixture() {
  const repos = createRepos(createTestDb());
  const service = createOccurrenceService({
    occurrences: repos.occurrences,
    events: repos.events,
    now: () => NOW,
  });
  const todo = seedTodo(repos);
  return { repos, service, todo };
}

describe('occurrence service actions', () => {
  interface Input {
    action: 'complete' | 'dismiss' | 'snooze';
    reason?: string;
    minutes?: number;
  }

  interface Output {
    occurrence: Partial<Occurrence>;
    eventType: OccurrenceEventType;
    eventMetadata: Record<string, unknown>;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input) => {
    const { repos, service, todo } = createFixture();
    const occurrence = seedOccurrence(repos, todo.id);
    const act = {
      complete: () => service.complete(occurrence.id),
      dismiss: () => service.dismiss(occurrence.id, input.reason ?? 'Other'),
      snooze: () => service.snooze(occurrence.id, input.minutes ?? 5),
    };
    return { repos, result: act[input.action](), occurrenceId: occurrence.id };
  };

  const verify = ({ repos, result, occurrenceId }: ReturnType<typeof setup>, output: Output): void => {
    expect(result).toMatchObject(output.occurrence);
    const events = repos.events.listForOccurrence(occurrenceId);
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
        occurrence: { status: 'completed', completedAt: NOW.toISOString() },
        eventType: 'completed',
        eventMetadata: {},
      },
    },
    {
      description: 'dismiss stores the reason and appends a dismissed event',
      input: { action: 'dismiss', reason: 'Too busy' },
      output: {
        occurrence: {
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
        occurrence: { status: 'snoozed', snoozedUntil: '2026-07-10T10:15:00.000Z' },
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
    const occurrence = seedOccurrence(repos, todo.id);
    expect(() => service.snooze(occurrence.id, 0)).toThrow();
  });
});

describe('occurrence service createFromSchedule', () => {
  const fireTime = new Date('2026-07-10T09:00:00.000Z');

  const setupWithSchedule = () => {
    const { repos, service, todo } = createFixture();
    const [schedule] = repos.schedules.replaceForTodo(todo.id, [
      { expression: '0 * * * *', timezone: 'UTC' },
    ]);
    return { repos, service, todo, schedule };
  };

  it('creates a pending occurrence with a created event', () => {
    const { repos, service, todo, schedule } = setupWithSchedule();
    const occurrence = service.createFromSchedule(todo.id, schedule.id, fireTime);
    expect(occurrence).toMatchObject({
      status: 'pending',
      scheduledAt: fireTime.toISOString(),
      scheduleId: schedule.id,
    });
    const events = repos.events.listForOccurrence(occurrence!.id);
    expect(events.map((event) => event.eventType)).toEqual(['created']);
  });

  it('returns null instead of duplicating an existing fire', () => {
    const { service, todo, schedule } = setupWithSchedule();
    expect(service.createFromSchedule(todo.id, schedule.id, fireTime)).not.toBeNull();
    expect(service.createFromSchedule(todo.id, schedule.id, fireTime)).toBeNull();
  });
});

describe('occurrence service reopenDueSnoozes', () => {
  const setup = (snoozedUntil: string) => {
    const { repos, service, todo } = createFixture();
    const occurrence = seedOccurrence(repos, todo.id);
    repos.occurrences.setStatus(occurrence.id, { status: 'snoozed', snoozedUntil });
    return { repos, service, occurrenceId: occurrence.id };
  };

  it('reopens occurrences whose snooze elapsed and appends a reopened event', () => {
    const { repos, service, occurrenceId } = setup('2026-07-10T09:59:00.000Z');
    const reopened = service.reopenDueSnoozes();
    expect(reopened.map((occurrence) => occurrence.id)).toEqual([occurrenceId]);
    expect(reopened[0]).toMatchObject({ status: 'pending', snoozedUntil: null });
    const events = repos.events.listForOccurrence(occurrenceId);
    expect(events.map((event) => event.eventType)).toEqual(['reopened']);
  });

  it('leaves future snoozes alone', () => {
    const { service } = setup('2026-07-10T11:00:00.000Z');
    expect(service.reopenDueSnoozes()).toEqual([]);
  });
});
