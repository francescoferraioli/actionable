import { useState } from 'react';
import { isValidExpression, isValidTimezone } from '../../../shared/schedule';
import {
  expressionToPreset,
  presetToExpression,
} from '../../../shared/schedule-presets';
import type { ScheduleInput, TodoWithSchedules } from '../../../shared/types';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/hooks';
import { Modal } from './Modal';
import {
  newScheduleFormValue,
  ScheduleEditor,
  scheduleFormValueKey,
  type ScheduleFormValue,
} from './ScheduleEditor';

interface TodoFormProps {
  /** When set the form edits this todo; otherwise it creates a new one. */
  todo: TodoWithSchedules | null;
  onSaved: () => void;
  onCancel: () => void;
}

const toFormValues = (todo: TodoWithSchedules): ScheduleFormValue[] =>
  todo.schedules.map((schedule) => ({
    key: scheduleFormValueKey(),
    preset: expressionToPreset(schedule.expression),
    timezone: schedule.timezone,
    active: schedule.active,
  }));

const toScheduleInput = (value: ScheduleFormValue): ScheduleInput => ({
  expression: presetToExpression(value.preset),
  timezone: value.timezone,
  active: value.active,
});

const isScheduleValid = (value: ScheduleFormValue): boolean =>
  isValidExpression(presetToExpression(value.preset)) && isValidTimezone(value.timezone);

export function TodoForm({ todo, onSaved, onCancel }: TodoFormProps): React.JSX.Element {
  const [name, setName] = useState(todo?.name ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [category, setCategory] = useState(todo?.category ?? '');
  const [active, setActive] = useState(todo?.active ?? true);
  const [schedules, setSchedules] = useState<ScheduleFormValue[]>(() =>
    todo ? toFormValues(todo) : [newScheduleFormValue()],
  );
  const [error, setError] = useState<string | null>(null);
  const { data: categories } = useAsyncData(() => api.listCategories(), []);

  const valid = name.trim().length > 0 && schedules.every(isScheduleValid);

  const save = async (): Promise<void> => {
    if (!valid) {
      return;
    }
    const base = {
      name,
      description: description || null,
      category: category || null,
      schedules: schedules.map(toScheduleInput),
    };
    try {
      if (todo) {
        await api.updateTodo({ ...base, id: todo.id, active });
      } else {
        await api.createTodo(base);
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const updateSchedule = (next: ScheduleFormValue): void =>
    setSchedules((current) =>
      current.map((schedule) => (schedule.key === next.key ? next : schedule)),
    );

  const removeSchedule = (key: number): void =>
    setSchedules((current) => current.filter((schedule) => schedule.key !== key));

  return (
    <Modal title={todo ? 'Edit todo' : 'New todo'} onClose={onCancel}>
      <div className="form-field">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Drink water"
          data-testid="todo-name-input"
          autoFocus
        />
      </div>
      <div className="form-field">
        <label>Description (optional)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          data-testid="todo-description-input"
        />
      </div>
      <div className="form-field">
        <label>Category (optional)</label>
        <input
          type="text"
          list="category-options"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="e.g. health"
          data-testid="todo-category-input"
        />
        <datalist id="category-options">
          {(categories ?? []).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
      {todo && (
        <div className="form-field">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              data-testid="todo-active-checkbox"
            />
            Active
          </label>
        </div>
      )}

      <h3 className="section-title">Schedules</h3>
      {schedules.map((schedule) => (
        <ScheduleEditor
          key={schedule.key}
          value={schedule}
          onChange={updateSchedule}
          onRemove={() => removeSchedule(schedule.key)}
        />
      ))}
      <button
        type="button"
        className="btn btn-small"
        onClick={() => setSchedules((current) => [...current, newScheduleFormValue()])}
        data-testid="add-schedule"
      >
        + Add schedule
      </button>

      {error && <p className="schedule-preview-invalid">{error}</p>}

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={save}
          data-testid="save-todo"
        >
          {todo ? 'Save changes' : 'Create todo'}
        </button>
      </div>
    </Modal>
  );
}
