import type { DatabaseSync } from 'node:sqlite';
import type { Todo } from '../../shared/types';
import { toTodo, type TodoRow } from './rows';

export interface CreateTodoRecord {
  name: string;
  description: string | null;
  category: string | null;
}

export interface UpdateTodoRecord extends CreateTodoRecord {
  id: number;
  active: boolean;
}

export function createTodoRepository(db: DatabaseSync) {
  return {
    create(input: CreateTodoRecord, now: string): Todo {
      const result = db
        .prepare(
          `INSERT INTO todos (name, description, category, active, created_at, updated_at)
           VALUES (?, ?, ?, 1, ?, ?)`,
        )
        .run(input.name, input.description, input.category, now, now);
      return this.getOrThrow(Number(result.lastInsertRowid));
    },

    update(input: UpdateTodoRecord, now: string): Todo {
      db.prepare(
        `UPDATE todos
         SET name = ?, description = ?, category = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      ).run(input.name, input.description, input.category, input.active ? 1 : 0, now, input.id);
      return this.getOrThrow(input.id);
    },

    get(id: number): Todo | null {
      const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
      return row ? toTodo(row) : null;
    },

    getOrThrow(id: number): Todo {
      const todo = this.get(id);
      if (!todo) {
        throw new Error(`Todo ${id} not found`);
      }
      return todo;
    },

    list(): Todo[] {
      const rows = db
        .prepare('SELECT * FROM todos ORDER BY active DESC, name COLLATE NOCASE')
        .all() as unknown as TodoRow[];
      return rows.map(toTodo);
    },

    listCategories(): string[] {
      const rows = db
        .prepare(
          `SELECT DISTINCT category FROM todos
           WHERE category IS NOT NULL AND category != ''
           ORDER BY category COLLATE NOCASE`,
        )
        .all() as unknown as { category: string }[];
      return rows.map((row) => row.category);
    },

    delete(id: number): void {
      db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    },
  };
}

export type TodoRepository = ReturnType<typeof createTodoRepository>;
