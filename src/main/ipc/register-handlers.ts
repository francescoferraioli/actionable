import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import type {
  CreateTodoInput,
  HistoryFilters,
  UpdateTodoInput,
} from '../../shared/types';
import type { DismissReasonRepository } from '../db/dismiss-reason-repository';
import type { EventRepository } from '../db/event-repository';
import type { OccurrenceRepository } from '../db/occurrence-repository';
import type { AnalyticsService } from '../services/analytics-service';
import type { OccurrenceService } from '../services/occurrence-service';
import type { TodoService } from '../services/todo-service';

export interface IpcDeps {
  todoService: TodoService;
  occurrenceService: OccurrenceService;
  analyticsService: AnalyticsService;
  occurrences: OccurrenceRepository;
  events: EventRepository;
  dismissReasons: DismissReasonRepository;
  /** Called after any todo/schedule mutation (scheduler must re-plan). */
  onTodosChanged: () => void;
  /** Called after any occurrence mutation (unread state changed). */
  onOccurrencesChanged: () => void;
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

  ipcMain.handle(IpcChannels.occurrencesListPending, () => deps.occurrences.listPending());

  ipcMain.handle(IpcChannels.occurrencesComplete, (_event, id: number) => {
    deps.occurrenceService.complete(id);
    deps.onOccurrencesChanged();
  });

  ipcMain.handle(IpcChannels.occurrencesDismiss, (_event, id: number, reason: string) => {
    deps.occurrenceService.dismiss(id, reason);
    deps.onOccurrencesChanged();
  });

  ipcMain.handle(IpcChannels.occurrencesSnooze, (_event, id: number, minutes: number) => {
    deps.occurrenceService.snooze(id, minutes);
    deps.onOccurrencesChanged();
  });

  ipcMain.handle(IpcChannels.occurrencesDelete, (_event, id: number) => {
    deps.occurrenceService.delete(id);
    deps.onOccurrencesChanged();
  });

  ipcMain.handle(IpcChannels.occurrencesHistory, (_event, filters: HistoryFilters) =>
    deps.occurrences.listHistory(filters),
  );

  ipcMain.handle(IpcChannels.occurrenceEventsList, (_event, occurrenceId: number) =>
    deps.events.listForOccurrence(occurrenceId),
  );

  ipcMain.handle(IpcChannels.dismissReasonsList, () => deps.dismissReasons.list());

  ipcMain.handle(IpcChannels.analyticsSummary, (_event, rangeDays: number) =>
    deps.analyticsService.summary(rangeDays),
  );

  ipcMain.handle(IpcChannels.unreadCount, () => deps.occurrences.countPending());
}
