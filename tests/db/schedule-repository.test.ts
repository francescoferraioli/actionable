import { describe, expect, it } from 'vitest';
import type { ScheduleInput } from '../../src/shared/types';
import { createRepos, createTestDb, seedTodo, type Repos } from '../helpers/test-db';

const HOURLY = { expression: '0 * * * *', timezone: 'Australia/Sydney' };
const DAILY = { expression: '0 7 * * *', timezone: 'Australia/Sydney' };

describe('schedule repository replaceForTodo', () => {
  interface Input {
    existing: ScheduleInput[];
    replacement: ScheduleInput[];
  }

  interface Output {
    expressions: string[];
    /** Indexes into `existing` whose schedule ids must survive the replace. */
    keptExistingIndexes: number[];
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input) => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const existing = repos.schedules.replaceForTodo(todo.id, input.existing);
    const result = repos.schedules.replaceForTodo(todo.id, input.replacement);
    return { repos, existing, result };
  };

  const verify = (
    { existing, result }: ReturnType<typeof setup>,
    output: Output,
  ): void => {
    expect(result.map((schedule) => schedule.expression)).toEqual(output.expressions);
    const keptIds = output.keptExistingIndexes.map((index) => existing[index].id);
    const resultIds = result.map((schedule) => schedule.id);
    keptIds.forEach((id) => expect(resultIds).toContain(id));
  };

  const testCases: TestCase[] = [
    {
      description: 'adds new schedules',
      input: { existing: [], replacement: [HOURLY, DAILY] },
      output: { expressions: [HOURLY.expression, DAILY.expression], keptExistingIndexes: [] },
    },
    {
      description: 'keeps matching schedules with their ids',
      input: { existing: [HOURLY, DAILY], replacement: [HOURLY, DAILY] },
      output: { expressions: [HOURLY.expression, DAILY.expression], keptExistingIndexes: [0, 1] },
    },
    {
      description: 'removes schedules missing from the replacement set',
      input: { existing: [HOURLY, DAILY], replacement: [DAILY] },
      output: { expressions: [DAILY.expression], keptExistingIndexes: [1] },
    },
    {
      description: 'keeps a match while replacing the rest',
      input: {
        existing: [HOURLY, DAILY],
        replacement: [DAILY, { expression: '0 9 * * 1', timezone: 'Australia/Sydney' }],
      },
      output: { expressions: [DAILY.expression, '0 9 * * 1'], keptExistingIndexes: [1] },
    },
    {
      description: 'toggles the active flag on a kept schedule',
      input: { existing: [HOURLY], replacement: [{ ...HOURLY, active: false }] },
      output: { expressions: [HOURLY.expression], keptExistingIndexes: [0] },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });

  it('applies the active flag from the replacement input', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    repos.schedules.replaceForTodo(todo.id, [HOURLY]);
    const [schedule] = repos.schedules.replaceForTodo(todo.id, [{ ...HOURLY, active: false }]);
    expect(schedule.active).toBe(false);
  });
});

describe('schedule repository listActive', () => {
  interface Input {
    todoActive: boolean;
    scheduleActive: boolean;
  }

  interface Output {
    listed: boolean;
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input): Repos => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    repos.schedules.replaceForTodo(todo.id, [{ ...HOURLY, active: input.scheduleActive }]);
    repos.todos.update({ ...todo, active: input.todoActive }, todo.createdAt);
    return repos;
  };

  const verify = (repos: Repos, output: Output): void => {
    expect(repos.schedules.listActive().length).toBe(output.listed ? 1 : 0);
  };

  const testCases: TestCase[] = [
    {
      description: 'lists a schedule when both todo and schedule are active',
      input: { todoActive: true, scheduleActive: true },
      output: { listed: true },
    },
    {
      description: 'excludes schedules of inactive todos',
      input: { todoActive: false, scheduleActive: true },
      output: { listed: false },
    },
    {
      description: 'excludes inactive schedules',
      input: { todoActive: true, scheduleActive: false },
      output: { listed: false },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      verify(setup(input), output);
    });
  });
});
