import { describe, expect, it } from 'vitest';
import {
  computeAnalytics,
  type OccurrenceForAnalytics,
} from '../../src/shared/analytics';
import type { OccurrenceStatus } from '../../src/shared/types';

const occurrence = (
  overrides: Partial<OccurrenceForAnalytics> & { status: OccurrenceStatus },
): OccurrenceForAnalytics => ({
  todoId: 1,
  todoName: 'Drink water',
  dismissReason: null,
  hour: 9,
  dateKey: '2026-07-10',
  ...overrides,
});

describe('computeAnalytics totals and rates', () => {
  interface Input {
    statuses: OccurrenceStatus[];
  }

  interface Output {
    completed: number;
    dismissed: number;
    pending: number;
    completionRate: number | null;
    dismissRate: number | null;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input) =>
    computeAnalytics({
      occurrences: input.statuses.map((status) => occurrence({ status })),
      snoozeEventCount: 0,
      rangeDays: 30,
      dateKeys: ['2026-07-10'],
    });

  const verify = (result: ReturnType<typeof setup>, output: Output): void => {
    expect(result.totals).toMatchObject({
      completed: output.completed,
      dismissed: output.dismissed,
      pending: output.pending,
    });
    const [todo] = result.todos;
    expect(todo?.completionRate ?? null).toBe(output.completionRate);
    expect(todo?.dismissRate ?? null).toBe(output.dismissRate);
  };

  const testCases: TestCase[] = [
    {
      description: 'computes rates over all occurrences',
      input: {
        statuses: ['completed', 'completed', 'completed', 'dismissed', 'pending'],
      },
      output: {
        completed: 3,
        dismissed: 1,
        pending: 1,
        completionRate: 0.6,
        dismissRate: 0.2,
      },
    },
    {
      description: 'returns null rates when there are no occurrences',
      input: { statuses: [] },
      output: { completed: 0, dismissed: 0, pending: 0, completionRate: null, dismissRate: null },
    },
    {
      description: 'a fully dismissed todo has a zero completion rate',
      input: { statuses: ['dismissed', 'dismissed'] },
      output: { completed: 0, dismissed: 2, pending: 0, completionRate: 0, dismissRate: 1 },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });
});

describe('computeAnalytics best hour', () => {
  interface Input {
    /** [hour, status] pairs for a single todo. */
    occurrences: [number, OccurrenceStatus][];
  }

  interface Output {
    bestHour: { hour: number; rate: number } | null;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input) =>
    computeAnalytics({
      occurrences: input.occurrences.map(([hour, status]) => occurrence({ hour, status })),
      snoozeEventCount: 0,
      rangeDays: 30,
      dateKeys: ['2026-07-10'],
    });

  const verify = (result: ReturnType<typeof setup>, output: Output): void => {
    const bestHour = result.todos[0]?.bestHour ?? null;
    if (output.bestHour === null) {
      expect(bestHour).toBeNull();
      return;
    }
    expect(bestHour).toMatchObject(output.bestHour);
  };

  const testCases: TestCase[] = [
    {
      description: 'picks the hour with the highest completion rate',
      input: {
        occurrences: [
          [7, 'completed'],
          [7, 'completed'],
          [7, 'completed'],
          [9, 'completed'],
          [9, 'dismissed'],
          [9, 'dismissed'],
        ],
      },
      output: { bestHour: { hour: 7, rate: 1 } },
    },
    {
      description: 'ignores hours with fewer samples than the minimum',
      input: {
        occurrences: [
          [7, 'completed'],
          [7, 'completed'],
          [9, 'completed'],
          [9, 'completed'],
          [9, 'dismissed'],
        ],
      },
      output: { bestHour: { hour: 9, rate: 2 / 3 } },
    },
    {
      description: 'prefers the earlier hour on a tie',
      input: {
        occurrences: [
          [14, 'completed'],
          [14, 'completed'],
          [14, 'completed'],
          [7, 'completed'],
          [7, 'completed'],
          [7, 'completed'],
        ],
      },
      output: { bestHour: { hour: 7, rate: 1 } },
    },
    {
      description: 'returns null when no hour has enough samples',
      input: {
        occurrences: [
          [7, 'completed'],
          [9, 'completed'],
        ],
      },
      output: { bestHour: null },
    },
    {
      description: 'returns null when nothing was ever completed',
      input: {
        occurrences: [
          [7, 'dismissed'],
          [7, 'dismissed'],
          [7, 'dismissed'],
        ],
      },
      output: { bestHour: null },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });
});

describe('computeAnalytics breakdowns', () => {
  it('counts dismiss reasons in descending order', () => {
    const result = computeAnalytics({
      occurrences: [
        occurrence({ status: 'dismissed', dismissReason: 'Too busy' }),
        occurrence({ status: 'dismissed', dismissReason: 'Too busy' }),
        occurrence({ status: 'dismissed', dismissReason: 'Forgot' }),
        occurrence({ status: 'completed' }),
      ],
      snoozeEventCount: 0,
      rangeDays: 30,
      dateKeys: ['2026-07-10'],
    });
    expect(result.dismissReasonBreakdown).toEqual([
      { reason: 'Too busy', count: 2 },
      { reason: 'Forgot', count: 1 },
    ]);
  });

  it('builds a daily trend across the provided date keys', () => {
    const result = computeAnalytics({
      occurrences: [
        occurrence({ status: 'completed', dateKey: '2026-07-10' }),
        occurrence({ status: 'completed', dateKey: '2026-07-11' }),
        occurrence({ status: 'dismissed', dateKey: '2026-07-11' }),
      ],
      snoozeEventCount: 2,
      rangeDays: 3,
      dateKeys: ['2026-07-09', '2026-07-10', '2026-07-11'],
    });
    expect(result.dailyTrend).toEqual([
      { date: '2026-07-09', completed: 0, dismissed: 0 },
      { date: '2026-07-10', completed: 1, dismissed: 0 },
      { date: '2026-07-11', completed: 1, dismissed: 1 },
    ]);
    expect(result.totals.snoozeEvents).toBe(2);
  });

  it('sorts todos by occurrence volume', () => {
    const result = computeAnalytics({
      occurrences: [
        occurrence({ todoId: 1, todoName: 'Water', status: 'completed' }),
        occurrence({ todoId: 2, todoName: 'Exercise', status: 'completed' }),
        occurrence({ todoId: 2, todoName: 'Exercise', status: 'dismissed' }),
      ],
      snoozeEventCount: 0,
      rangeDays: 30,
      dateKeys: ['2026-07-10'],
    });
    expect(result.todos.map((todo) => todo.todoName)).toEqual(['Exercise', 'Water']);
  });
});
