import { useState } from 'react';
import { formatDayHeading, formatTime } from '../../../shared/format';
import type {
  HistoryFilters,
  OccurrenceStatus,
  OccurrenceWithTodo,
} from '../../../shared/types';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion, useNow } from '../lib/hooks';

type StatusFilter = OccurrenceStatus | 'all';

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

const STATUS_ICONS: Record<OccurrenceStatus, { symbol: string; className: string }> = {
  completed: { symbol: '✓', className: 'history-icon-completed' },
  dismissed: { symbol: '✗', className: 'history-icon-dismissed' },
  snoozed: { symbol: '⏾', className: 'history-icon-snoozed' },
  pending: { symbol: '•', className: 'history-icon-pending' },
};

function statusDetail(occurrence: OccurrenceWithTodo): string {
  switch (occurrence.status) {
    case 'completed':
      return `Completed at ${formatTime(occurrence.completedAt ?? occurrence.scheduledAt)}`;
    case 'dismissed':
      return `Dismissed${occurrence.dismissReason ? ` (${occurrence.dismissReason.toLowerCase()})` : ''}`;
    case 'snoozed':
      return occurrence.snoozedUntil
        ? `Snoozed until ${formatTime(occurrence.snoozedUntil)}`
        : 'Snoozed';
    case 'pending':
      return 'Pending';
  }
}

function HistoryRow({ occurrence }: { occurrence: OccurrenceWithTodo }): React.JSX.Element {
  const icon = STATUS_ICONS[occurrence.status];
  return (
    <div className="card history-row" data-testid="history-row">
      <div className={`history-icon ${icon.className}`}>{icon.symbol}</div>
      <div className="history-detail">
        <div className="occurrence-title">
          <span className="occurrence-name">{occurrence.todoName}</span>
          {occurrence.todoCategory && <span className="chip">{occurrence.todoCategory}</span>}
        </div>
        <div className="muted" data-testid="history-status">
          {statusDetail(occurrence)}
        </div>
      </div>
      <div className="history-time">{formatTime(occurrence.scheduledAt)}</div>
    </div>
  );
}

export function HistoryView(): React.JSX.Element {
  const version = useDataVersion();
  const now = useNow();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const { data: todos } = useAsyncData(() => api.listTodos(), [version]);
  const { data: categories } = useAsyncData(() => api.listCategories(), [version]);
  const { data: occurrences } = useAsyncData(
    () => api.listHistory(toHistoryFilters(filters)),
    [version, filters],
  );

  // The inbox owns pending items; history shows what already happened.
  const visible = (occurrences ?? []).filter(
    (occurrence) => filters.status !== 'all' || occurrence.status !== 'pending',
  );

  const groups = visible.reduce<{ heading: string; items: OccurrenceWithTodo[] }[]>(
    (accumulator, occurrence) => {
      const heading = formatDayHeading(occurrence.scheduledAt, now);
      const group = accumulator.find((candidate) => candidate.heading === heading);
      if (group) {
        group.items.push(occurrence);
        return accumulator;
      }
      return [...accumulator, { heading, items: [occurrence] }];
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

      {occurrences !== null && visible.length === 0 && (
        <div className="empty-state" data-testid="history-empty">
          <div className="empty-state-icon">🕘</div>
          <h2>No history yet</h2>
          <p className="muted">Actioned occurrences will show up here.</p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.heading} className="day-group">
          <h2 className="day-heading">{group.heading}</h2>
          {group.items.map((occurrence) => (
            <HistoryRow key={occurrence.id} occurrence={occurrence} />
          ))}
        </section>
      ))}
    </div>
  );
}
