import { useState } from 'react';
import { describeExpression } from '../../../shared/schedule-presets';
import type { TodoWithSchedules } from '../../../shared/types';
import { Modal } from '../components/Modal';
import { TodoForm } from '../components/TodoForm';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion } from '../lib/hooks';

function describeSchedules(todo: TodoWithSchedules): string {
  if (todo.schedules.length === 0) {
    return 'No schedule';
  }
  return todo.schedules
    .map(
      (schedule) =>
        `${describeExpression(schedule.expression)}${schedule.active ? '' : ' (paused)'}`,
    )
    .join(' · ');
}

interface TodoCardProps {
  todo: TodoWithSchedules;
  onEdit: () => void;
  onDelete: () => void;
}

function TodoCard({ todo, onEdit, onDelete }: TodoCardProps): React.JSX.Element {
  return (
    <div
      className={`card todo-card ${todo.active ? '' : 'todo-card-inactive'}`}
      data-testid="todo-card"
    >
      <div className="todo-meta">
        <div className="action-title">
          <span className="action-name">{todo.name}</span>
          {todo.category && <span className="chip">{todo.category}</span>}
          {!todo.active && <span className="chip">inactive</span>}
        </div>
        {todo.description && <div className="muted">{todo.description}</div>}
        <div className="todo-schedules">{describeSchedules(todo)}</div>
      </div>
      <div className="action-actions">
        <button type="button" className="btn btn-small" onClick={onEdit} data-testid="edit-todo">
          Edit
        </button>
        <button
          type="button"
          className="btn btn-small btn-danger-ghost"
          onClick={onDelete}
          data-testid="delete-todo"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function TodosView(): React.JSX.Element {
  const version = useDataVersion();
  const { data: todos, reload } = useAsyncData(() => api.listTodos(), [version]);
  const [editing, setEditing] = useState<TodoWithSchedules | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TodoWithSchedules | null>(null);

  const confirmDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.deleteTodo(deleting.id);
    setDeleting(null);
    reload();
  };

  return (
    <div className="view">
      <div className="view-header">
        <h1 className="view-title">Todos</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating(true)}
          data-testid="new-todo"
        >
          New todo
        </button>
      </div>

      {todos !== null && todos.length === 0 && (
        <div className="empty-state" data-testid="todos-empty">
          <div className="empty-state-icon">＋</div>
          <h2>No todos yet</h2>
          <p className="muted">Create your first commitment to start building accountability.</p>
        </div>
      )}

      {(todos ?? []).map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onEdit={() => setEditing(todo)}
          onDelete={() => setDeleting(todo)}
        />
      ))}

      {(creating || editing) && (
        <TodoForm
          todo={editing}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <Modal title={`Delete "${deleting.name}"?`} onClose={() => setDeleting(null)}>
          <p className="muted">
            This deletes the todo, its schedules and its entire action history. This cannot be
            undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={confirmDelete}
              data-testid="confirm-delete"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
