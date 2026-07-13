import { describe, expect, it } from 'vitest';
import {
  describeExpression,
  expressionToPreset,
  presetToExpression,
  type SchedulePreset,
} from '../../src/shared/schedule-presets';

describe('schedule presets', () => {
  interface Input {
    preset: SchedulePreset;
  }

  interface Output {
    expression: string;
    description: string;
    /** Round-trip target; defaults to the input preset. */
    roundTrip?: SchedulePreset;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input) => {
    const expression = presetToExpression(input.preset);
    return {
      expression,
      described: describeExpression(expression),
      roundTripped: expressionToPreset(expression),
    };
  };

  const verify = (result: ReturnType<typeof setup>, input: Input, output: Output): void => {
    expect(result.expression).toBe(output.expression);
    expect(result.described).toBe(output.description);
    expect(result.roundTripped).toEqual(output.roundTrip ?? input.preset);
  };

  const testCases: TestCase[] = [
    {
      description: 'daily at 7am',
      input: { preset: { kind: 'daily', hour: 7, minute: 0 } },
      output: { expression: '0 7 * * *', description: 'Daily at 7:00 AM' },
    },
    {
      description: 'daily at 12:30pm handles noon formatting',
      input: { preset: { kind: 'daily', hour: 12, minute: 30 } },
      output: { expression: '30 12 * * *', description: 'Daily at 12:30 PM' },
    },
    {
      description: 'weekly Monday at 9am',
      input: { preset: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 } },
      output: { expression: '0 9 * * 1', description: 'Weekly on Monday at 9:00 AM' },
    },
    {
      description: 'every hour 9am to 5pm',
      input: { preset: { kind: 'hourlyBetween', startHour: 9, endHour: 17, minute: 0 } },
      output: { expression: '0 9-17 * * *', description: 'Every hour from 9am to 5pm' },
    },
    {
      description: 'every hour at half past shows the minute',
      input: { preset: { kind: 'hourlyBetween', startHour: 9, endHour: 17, minute: 30 } },
      output: {
        expression: '30 9-17 * * *',
        description: 'Every hour from 9am to 5pm at :30',
      },
    },
    {
      description: 'custom cron falls through unchanged',
      input: { preset: { kind: 'custom', expression: '*/10 9-17 * * 1-5' } },
      output: {
        expression: '*/10 9-17 * * 1-5',
        description: 'Cron: */10 9-17 * * 1-5',
      },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), input, output);
    });
  });
});
