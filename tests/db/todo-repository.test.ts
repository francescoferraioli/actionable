import { describe, expect, it } from 'vitest';
import { createRepos, createTestDb, seedTodo, T0, type Repos } from '../helpers/test-db';

describe('todo repository', () => {
  it('creates a todo with the given fields and timestamps', () => {
    const repos = createRepos(createTestDb());
    const todo = repos.todos.create(
      { name: 'Stretch', description: 'Neck and back', category: 'health' },
      T0,
    );
    expect(todo).toMatchObject({
      name: 'Stretch',
      description: 'Neck and back',
      category: 'health',
      active: true,
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it('updates fields and the updated timestamp', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    const later = '2026-07-02T00:00:00.000Z';
    const updated = repos.todos.update(
      { id: todo.id, name: 'Drink more water', description: null, category: 'health', active: false },
      later,
    );
    expect(updated).toMatchObject({
      name: 'Drink more water',
      category: 'health',
      active: false,
      createdAt: T0,
      updatedAt: later,
    });
  });

  it('deletes a todo', () => {
    const repos = createRepos(createTestDb());
    const todo = seedTodo(repos);
    repos.todos.delete(todo.id);
    expect(repos.todos.get(todo.id)).toBeNull();
  });

  interface Input {
    todos: { name: string; category: string | null }[];
  }

  interface Output {
    names?: string[];
    categories?: string[];
  }

  interface TestCase {
    description: string;
    input: Input;
    output: Output;
  }

  const setup = (input: Input): Repos => {
    const repos = createRepos(createTestDb());
    input.todos.forEach((todo) => seedTodo(repos, todo));
    return repos;
  };

  const verify = (repos: Repos, output: Output): void => {
    if (output.names) {
      expect(repos.todos.list().map((todo) => todo.name)).toEqual(output.names);
    }
    if (output.categories) {
      expect(repos.todos.listCategories()).toEqual(output.categories);
    }
  };

  const testCases: TestCase[] = [
    {
      description: 'lists todos sorted by name, case-insensitively',
      input: {
        todos: [
          { name: 'stretch', category: null },
          { name: 'Drink water', category: null },
        ],
      },
      output: { names: ['Drink water', 'stretch'] },
    },
    {
      description: 'lists distinct categories sorted, skipping nulls',
      input: {
        todos: [
          { name: 'A', category: 'work' },
          { name: 'B', category: 'health' },
          { name: 'C', category: 'health' },
          { name: 'D', category: null },
        ],
      },
      output: { categories: ['health', 'work'] },
    },
  ];

  testCases.forEach(({ description, input, output }) => {
    it(description, () => {
      const repos = setup(input);
      verify(repos, output);
    });
  });
});
