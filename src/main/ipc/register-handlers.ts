import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import type {
  CreateTodoInput,
  HistoryFilters,
  UpdateTodoInput,
} from '../../shared/types';
import type { DismissReasonRepository } from '../db/dismiss-reason-repository';
import type { EventRepository } from '../db/event-repository';
import type { ActionRepository } from '../db/action-repository';
import { SETTING_INBOX_FOLDER, type SettingsRepository } from '../db/settings-repository';
import type { AnalyticsService } from '../services/analytics-service';
import type { ActionService } from '../services/action-service';
import type { TodoService } from '../services/todo-service';

export interface IpcDeps {
  todoService: TodoService;
  actionService: ActionService;
  analyticsService: AnalyticsService;
  actions: ActionRepository;
  events: EventRepository;
  dismissReasons: DismissReasonRepository;
  settings: SettingsRepository;
  pickInboxFolder: () => Promise<string | null>;
  /** Called after any todo/schedule mutation (scheduler must re-plan). */
  onTodosChanged: () => void;
  /** Called after any action mutation (unread state changed). */
  onActionsChanged: () => void;
  /** Called when the watched inbox folder path changes. */
  onInboxFolderChanged: () => void;
}

export function registerIpcHandlers(deps: IpcDeps): void {
  ipcMain.handle(IpcChannels.todosList, () => deps.todoService.list());

  ipcMain.handle(IpcChannels.todosCreate, (_event, input: CreateTodoInput) => {
    const todo = deps.todoService.create(input);
    deps.onTodosChanged();
    return todo;
  });

  ipcMain.handle(IpcChannels.todosUpdate, (_event, input: UpdateTodoInput) => {
    const todo = deps.todoService.update(input);
    deps.onTodosChanged();
    return todo;
  });

  ipcMain.handle(IpcChannels.todosDelete, (_event, id: number) => {
    deps.todoService.delete(id);
    deps.onTodosChanged();
  });

  ipcMain.handle(IpcChannels.categoriesList, () => deps.todoService.listCategories());

  ipcMain.handle(IpcChannels.actionsListPending, () => deps.actions.listPending());

  ipcMain.handle(IpcChannels.actionsComplete, (_event, id: number) => {
    deps.actionService.complete(id);
    deps.onActionsChanged();
  });

  ipcMain.handle(IpcChannels.actionsDismiss, (_event, id: number, reason: string) => {
    deps.actionService.dismiss(id, reason);
    deps.onActionsChanged();
  });

  ipcMain.handle(IpcChannels.actionsSnooze, (_event, id: number, minutes: number) => {
    deps.actionService.snooze(id, minutes);
    deps.onActionsChanged();
  });

  ipcMain.handle(IpcChannels.actionsDelete, (_event, id: number) => {
    deps.actionService.delete(id);
    deps.onActionsChanged();
  });

  ipcMain.handle(IpcChannels.actionsHistory, (_event, filters: HistoryFilters) =>
    deps.actions.listHistory(filters),
  );

  ipcMain.handle(IpcChannels.actionEventsList, (_event, actionId: number) =>
    deps.events.listForAction(actionId),
  );

  ipcMain.handle(IpcChannels.dismissReasonsList, () => deps.dismissReasons.list());

  ipcMain.handle(IpcChannels.analyticsSummary, (_event, rangeDays: number) =>
    deps.analyticsService.summary(rangeDays),
  );

  ipcMain.handle(IpcChannels.unreadCount, () => deps.actions.countPending());

  ipcMain.handle(IpcChannels.settingsGetInboxFolder, () =>
    deps.settings.get(SETTING_INBOX_FOLDER),
  );

  ipcMain.handle(IpcChannels.settingsSetInboxFolder, (_event, path: string | null) => {
    if (path) {
      deps.settings.set(SETTING_INBOX_FOLDER, path);
    } else {
      deps.settings.delete(SETTING_INBOX_FOLDER);
    }
    deps.onInboxFolderChanged();
  });

  ipcMain.handle(IpcChannels.settingsPickInboxFolder, async () => {
    const path = await deps.pickInboxFolder();
    if (path) {
      deps.settings.set(SETTING_INBOX_FOLDER, path);
      deps.onInboxFolderChanged();
    }
    return path;
  });
}
