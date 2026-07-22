import type {
  AnalyticsSummary,
  CreateTodoInput,
  DismissReason,
  HistoryFilters,
  ActionEvent,
  ActionWithTodo,
  TodoWithSchedules,
  UpdateTodoInput,
} from './types';

export const IpcChannels = {
  todosList: 'todos:list',
  todosCreate: 'todos:create',
  todosUpdate: 'todos:update',
  todosDelete: 'todos:delete',
  categoriesList: 'categories:list',
  actionsListPending: 'actions:list-pending',
  actionsComplete: 'actions:complete',
  actionsDismiss: 'actions:dismiss',
  actionsSnooze: 'actions:snooze',
  actionsDelete: 'actions:delete',
  actionsHistory: 'actions:history',
  actionEventsList: 'action-events:list',
  dismissReasonsList: 'dismiss-reasons:list',
  analyticsSummary: 'analytics:summary',
  unreadCount: 'unread:count',
  settingsGetInboxFolder: 'settings:get-inbox-folder',
  settingsSetInboxFolder: 'settings:set-inbox-folder',
  settingsPickInboxFolder: 'settings:pick-inbox-folder',
  dataChanged: 'app:data-changed',
} as const;

/** The API the preload script exposes to the renderer as `window.actionable`. */
export interface ActionableApi {
  listTodos(): Promise<TodoWithSchedules[]>;
  createTodo(input: CreateTodoInput): Promise<TodoWithSchedules>;
  updateTodo(input: UpdateTodoInput): Promise<TodoWithSchedules>;
  deleteTodo(id: number): Promise<void>;
  listCategories(): Promise<string[]>;
  listPendingActions(): Promise<ActionWithTodo[]>;
  completeAction(id: number): Promise<void>;
  dismissAction(id: number, reason: string): Promise<void>;
  snoozeAction(id: number, minutes: number): Promise<void>;
  deleteAction(id: number): Promise<void>;
  listHistory(filters: HistoryFilters): Promise<ActionWithTodo[]>;
  listActionEvents(actionId: number): Promise<ActionEvent[]>;
  listDismissReasons(): Promise<DismissReason[]>;
  getAnalytics(rangeDays: number): Promise<AnalyticsSummary>;
  getUnreadCount(): Promise<number>;
  getInboxFolder(): Promise<string | null>;
  setInboxFolder(path: string | null): Promise<void>;
  pickInboxFolder(): Promise<string | null>;
  /** Subscribes to change notifications; returns an unsubscribe function. */
  onDataChanged(listener: () => void): () => void;
}
