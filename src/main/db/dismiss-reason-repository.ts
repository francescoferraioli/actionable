import type { DatabaseSync } from 'node:sqlite';
import type { DismissReason } from '../../shared/types';

interface DismissReasonRow {
  id: number;
  label: string;
  sort_order: number;
}

export function createDismissReasonRepository(db: DatabaseSync) {
  return {
    list(): DismissReason[] {
      const rows = db
        .prepare('SELECT * FROM dismiss_reasons ORDER BY sort_order')
        .all() as unknown as DismissReasonRow[];
      return rows.map((row) => ({ id: row.id, label: row.label, sortOrder: row.sort_order }));
    },

    add(label: string): DismissReason {
      const row = db.prepare('SELECT MAX(sort_order) AS max_order FROM dismiss_reasons').get() as {
        max_order: number | null;
      };
      const sortOrder = (row.max_order ?? 0) + 1;
      const result = db
        .prepare('INSERT INTO dismiss_reasons (label, sort_order) VALUES (?, ?)')
        .run(label, sortOrder);
      return { id: Number(result.lastInsertRowid), label, sortOrder };
    },
  };
}

export type DismissReasonRepository = ReturnType<typeof createDismissReasonRepository>;
