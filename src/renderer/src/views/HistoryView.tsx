import { useState } from 'react';
import { formatDayHeading, formatTime } from '../../../shared/format';
import type {
  HistoryFilters,
  ActionStatus,
  ActionWithTodo,
} from '../../../shared/types';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion, useNow } from '../lib/hooks';

type StatusFilter = ActionStatus | 'all';

interface FilterState {
  fromDate: string;
  toDate: string;
  todoId: string;
  category: string;
  status: StatusFilter;
}

const INITIAL_FILTERS: FilterState = {
  fromDate: '',
  toDate: '',
  todoId: '',
  category: '',
  status: 'all',
};

function toHistoryFilters(state: FilterState): HistoryFilters {
  return {
    // Date inputs are local dates; cover the full local day.
    from: state.fromDate ? new Date(`${state.fromDate}T00:00:00`).toISOString() : undefined,
    to: state.toDate
      ? new Date(new Date(`${state.toDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    todoId: state.todoId ? Number(state.todoId) : undefined,
    category: state.category || undefined,
    status: state.status === 'all' ? undefined : state.status,
  };
}

const STATUS_ICONS: Record<ActionStatus, { symbol: string; className: string }> = {
  completed: { symbol: '✓', className: 'history-icon-completed' },
  dismissed: { symbol: '✗', className: 'history-icon-dismissed' },
  snoozed: { symbol: '⏾', className: 'history-icon-snoozed' },
  pending: { symbol: '•', className: 'history-icon-pending' },
};

function statusDetail(action: ActionWithTodo): string {
  switch (action.status) {
    case 'completed':
      return `Completed at ${formatTime(action.completedAt ?? action.scheduledAt)}`;
    case 'dismissed':
      return `Dismissed${action.dismissReason ? ` (${action.dismissReason.toLowerCase()})` : ''}`;
    case 'snoozed':
      return action.snoozedUntil
        ? `Snoozed until ${formatTime(action.snoozedUntil)}`
        : 'Snoozed';
    case 'pending':
      return 'Pending';
  }
}

function HistoryRow({ action }: { action: ActionWithTodo }): React.JSX.Element {
  const icon = STATUS_ICONS[action.status];
  return (
    <div className="card history-row" data-testid="history-row">
      <div className={`history-icon ${icon.className}`}>{icon.symbol}</div>
      <div className="history-detail">
        <div className="action-title">
          <span className="action-name">{action.title}</span>
          {action.todoCategory && <span className="chip">{action.todoCategory}</span>}
        </div>
        <div className="muted" data-testid="history-status">
          {statusDetail(action)}
        </div>
      </div>
      <div className="history-time">{formatTime(action.scheduledAt)}</div>
    </div>
  );
}

export function HistoryView(): React.JSX.Element {
  const version = useDataVersion();
  const now = useNow();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const { data: todos } = useAsyncData(() => api.listTodos(), [version]);
  const { data: categories } = useAsyncData(() => api.listCategories(), [version]);
  const { data: actions } = useAsyncData(
    () => api.listHistory(toHistoryFilters(filters)),
    [version, filters],
  );

  // The inbox owns pending items; history shows what already happened.
  const visible = (actions ?? []).filter(
    (action) => filters.status !== 'all' || action.status !== 'pending',
  );

  const groups = visible.reduce<{ heading: string; items: ActionWithTodo[] }[]>(
    (accumulator, action) => {
      const heading = formatDayHeading(action.scheduledAt, now);
      const group = accumulator.find((candidate) => candidate.heading === heading);
      if (group) {
        group.items.push(action);
        return accumulator;
      }
      return [...accumulator, { heading, items: [action] }];
    },
    [],
  );

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]): void =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="view">
      <h1 className="view-title">History</h1>

      <div className="filters">
        <div className="form-field">
          <label>From</label>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) => setFilter('fromDate', event.target.value)}
          />
        </div>
        <div className="form-field">
          <label>To</label>
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) => setFilter('toDate', event.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Todo</label>
          <select
            value={filters.todoId}
            onChange={(event) => setFilter('todoId', event.target.value)}
            data-testid="history-todo-filter"
          >
            <option value="">All todos</option>
            {(todos ?? []).map((todo) => (
              <option key={todo.id} value={todo.id}>
                {todo.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(event) => setFilter('category', event.target.value)}
          >
            <option value="">All categories</option>
            {(categories ?? []).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Status</label>
          <select
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value as StatusFilter)}
            data-testid="history-status-filter"
          >
            <option value="all">All actioned</option>
            <option value="completed">Completed</option>
            <option value="dismissed">Dismissed</option>
            <option value="snoozed">Snoozed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {actions !== null && visible.length === 0 && (
        <div className="empty-state" data-testid="history-empty">
          <div className="empty-state-icon">🕘</div>
          <h2>No history yet</h2>
          <p className="muted">Actioned items will show up here.</p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.heading} className="day-group">
          <h2 className="day-heading">{group.heading}</h2>
          {group.items.map((action) => (
            <HistoryRow key={action.id} action={action} />
          ))}
        </section>
      ))}
    </div>
  );
}
