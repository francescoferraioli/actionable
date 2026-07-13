import type {
  AnalyticsSummary,
  CreateTodoInput,
  DismissReason,
  HistoryFilters,
  OccurrenceEvent,
  OccurrenceWithTodo,
  TodoWithSchedules,
  UpdateTodoInput,
} from './types';

export const IpcChannels = {
  todosList: 'todos:list',
  todosCreate: 'todos:create',
  todosUpdate: 'todos:update',
  todosDelete: 'todos:delete',
  categoriesList: 'categories:list',
  occurrencesListPending: 'occurrences:list-pending',
  occurrencesComplete: 'occurrences:complete',
  occurrencesDismiss: 'occurrences:dismiss',
  occurrencesSnooze: 'occurrences:snooze',
  occurrencesHistory: 'occurrences:history',
  occurrenceEventsList: 'occurrence-events:list',
  dismissReasonsList: 'dismiss-reasons:list',
  analyticsSummary: 'analytics:summary',
  unreadCount: 'unread:count',
  dataChanged: 'app:data-changed',
} as const;

/** The API the preload script exposes to the renderer as `window.actionable`. */
export interface ActionableApi {
  listTodos(): Promise<TodoWithSchedules[]>;
  createTodo(input: CreateTodoInput): Promise<TodoWithSchedules>;
  updateTodo(input: UpdateTodoInput): Promise<TodoWithSchedules>;
  deleteTodo(id: number): Promise<void>;
  listCategories(): Promise<string[]>;
  listPendingOccurrences(): Promise<OccurrenceWithTodo[]>;
  completeOccurrence(id: number): Promise<void>;
  dismissOccurrence(id: number, reason: string): Promise<void>;
  snoozeOccurrence(id: number, minutes: number): Promise<void>;
  listHistory(filters: HistoryFilters): Promise<OccurrenceWithTodo[]>;
  listOccurrenceEvents(occurrenceId: number): Promise<OccurrenceEvent[]>;
  listDismissReasons(): Promise<DismissReason[]>;
  getAnalytics(rangeDays: number): Promise<AnalyticsSummary>;
  getUnreadCount(): Promise<number>;
  /** Subscribes to change notifications; returns an unsubscribe function. */
  onDataChanged(listener: () => void): () => void;
}
