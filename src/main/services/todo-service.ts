import { isValidExpression, isValidTimezone } from '../../shared/schedule';
import type {
  CreateTodoInput,
  ScheduleInput,
  Todo,
  TodoWithSchedules,
  UpdateTodoInput,
} from '../../shared/types';
import type { ScheduleRepository } from '../db/schedule-repository';
import type { TodoRepository } from '../db/todo-repository';

export interface TodoServiceDeps {
  todos: TodoRepository;
  schedules: ScheduleRepository;
  now: () => Date;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Todo name must not be empty');
  }
  return trimmed;
}

function validateSchedules(inputs: ScheduleInput[]): void {
  inputs.forEach((input) => {
    if (!isValidExpression(input.expression)) {
      throw new Error(`Invalid schedule expression: ${input.expression}`);
    }
    if (!isValidTimezone(input.timezone)) {
      throw new Error(`Invalid timezone: ${input.timezone}`);
    }
  });
}

const normalizeOptional = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function createTodoService(deps: TodoServiceDeps) {
  const withSchedules = (todo: Todo): TodoWithSchedules => ({
    ...todo,
    schedules: deps.schedules.listForTodo(todo.id),
  });

  return {
    list(): TodoWithSchedules[] {
      return deps.todos.list().map(withSchedules);
    },

    get(id: number): TodoWithSchedules {
      return withSchedules(deps.todos.getOrThrow(id));
    },

    create(input: CreateTodoInput): TodoWithSchedules {
      validateSchedules(input.schedules);
      const todo = deps.todos.create(
        {
          name: validateName(input.name),
          description: normalizeOptional(input.description),
          category: normalizeOptional(input.category),
        },
        deps.now().toISOString(),
      );
      deps.schedules.replaceForTodo(todo.id, input.schedules);
      return withSchedules(todo);
    },

    update(input: UpdateTodoInput): TodoWithSchedules {
      validateSchedules(input.schedules);
      const todo = deps.todos.update(
        {
          id: input.id,
          name: validateName(input.name),
          description: normalizeOptional(input.description),
          category: normalizeOptional(input.category),
          active: input.active,
        },
        deps.now().toISOString(),
      );
      deps.schedules.replaceForTodo(todo.id, input.schedules);
      return withSchedules(todo);
    },

    delete(id: number): void {
      deps.todos.delete(id);
    },

    listCategories(): string[] {
      return deps.todos.listCategories();
    },
  };
}

export type TodoService = ReturnType<typeof createTodoService>;
