import { describe, expect, it } from 'vitest';
import {
  fireTimesBetween,
  isValidExpression,
  isValidTimezone,
  nextFireTime,
  previousFireTime,
} from '../../src/shared/schedule';

describe('nextFireTime', () => {
  interface Input {
    expression: string;
    timezone: string;
    after: string;
  }

  interface Output {
    next: string | null;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input): Date | null =>
    nextFireTime(input.expression, input.timezone, new Date(input.after));

  const verify = (result: Date | null, output: Output): void => {
    expect(result?.toISOString() ?? null).toBe(output.next);
  };

  const testCases: TestCase[] = [
    {
      description: 'finds the next hourly fire within a window',
      input: { expression: '0 9-17 * * *', timezone: 'UTC', after: '2026-07-10T08:30:00.000Z' },
      output: { next: '2026-07-10T09:00:00.000Z' },
    },
    {
      description: 'rolls over to the next day after the window closes',
      input: { expression: '0 9-17 * * *', timezone: 'UTC', after: '2026-07-10T17:30:00.000Z' },
      output: { next: '2026-07-11T09:00:00.000Z' },
    },
    {
      description: 'respects the timezone (7am Sydney is 9pm UTC the day before in July)',
      input: {
        expression: '0 7 * * *',
        timezone: 'Australia/Sydney',
        after: '2026-07-10T08:30:00.000Z',
      },
      output: { next: '2026-07-10T21:00:00.000Z' },
    },
    {
      description: 'finds the next weekly fire (Monday 9am UTC)',
      input: { expression: '0 9 * * 1', timezone: 'UTC', after: '2026-07-10T08:30:00.000Z' },
      output: { next: '2026-07-13T09:00:00.000Z' },
    },
    {
      description: 'supports 6-field expressions with seconds',
      input: { expression: '*/2 * * * * *', timezone: 'UTC', after: '2026-07-10T08:30:00.500Z' },
      output: { next: '2026-07-10T08:30:02.000Z' },
    },
    {
      description: 'returns null for an invalid expression',
      input: { expression: 'not a cron', timezone: 'UTC', after: '2026-07-10T08:30:00.000Z' },
      output: { next: null },
    },
    {
      description: 'returns null for an invalid timezone',
      input: { expression: '0 * * * *', timezone: 'Nope/Nowhere', after: '2026-07-10T08:30:00.000Z' },
      output: { next: null },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });
});

describe('previousFireTime', () => {
  interface Input {
    expression: string;
    at: string;
  }

  interface Output {
    previous: string | null;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input): Date | null =>
    previousFireTime(input.expression, 'UTC', new Date(input.at));

  const verify = (result: Date | null, output: Output): void => {
    expect(result?.toISOString() ?? null).toBe(output.previous);
  };

  const testCases: TestCase[] = [
    {
      description: 'finds the most recent fire before the given time',
      input: { expression: '0 * * * *', at: '2026-07-10T08:30:00.000Z' },
      output: { previous: '2026-07-10T08:00:00.000Z' },
    },
    {
      description: 'includes a fire exactly at the given time',
      input: { expression: '0 * * * *', at: '2026-07-10T08:00:00.000Z' },
      output: { previous: '2026-07-10T08:00:00.000Z' },
    },
    {
      description: 'returns null for an invalid expression',
      input: { expression: 'nope', at: '2026-07-10T08:00:00.000Z' },
      output: { previous: null },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });
});

describe('fireTimesBetween', () => {
  it('returns fires in (from, to] exclusive of from, inclusive of to', () => {
    const times = fireTimesBetween(
      '0 * * * *',
      'UTC',
      new Date('2026-07-10T08:00:00.000Z'),
      new Date('2026-07-10T11:00:00.000Z'),
    );
    expect(times.map((time) => time.toISOString())).toEqual([
      '2026-07-10T09:00:00.000Z',
      '2026-07-10T10:00:00.000Z',
      '2026-07-10T11:00:00.000Z',
    ]);
  });

  it('caps results at the limit for dense expressions', () => {
    const times = fireTimesBetween(
      '* * * * * *',
      'UTC',
      new Date('2026-07-10T08:00:00.000Z'),
      new Date('2026-07-10T09:00:00.000Z'),
      10,
    );
    expect(times).toHaveLength(10);
  });

  it('returns an empty list when no fire falls in the window', () => {
    const times = fireTimesBetween(
      '0 9 * * *',
      'UTC',
      new Date('2026-07-10T10:00:00.000Z'),
      new Date('2026-07-10T11:00:00.000Z'),
    );
    expect(times).toEqual([]);
  });
});

describe('validation', () => {
  it('accepts valid cron expressions and timezones', () => {
    expect(isValidExpression('0 9-17 * * *')).toBe(true);
    expect(isValidTimezone('Australia/Sydney')).toBe(true);
  });

  it('rejects invalid cron expressions and timezones', () => {
    expect(isValidExpression('every day at 9')).toBe(false);
    expect(isValidTimezone('Nope/Nowhere')).toBe(false);
  });
});
