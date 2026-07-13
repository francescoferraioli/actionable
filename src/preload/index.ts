import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type ActionableApi } from '../shared/ipc';
import type { CreateTodoInput, HistoryFilters, UpdateTodoInput } from '../shared/types';

const api: ActionableApi = {
  listTodos: () => ipcRenderer.invoke(IpcChannels.todosList),
  createTodo: (input: CreateTodoInput) => ipcRenderer.invoke(IpcChannels.todosCreate, input),
  updateTodo: (input: UpdateTodoInput) => ipcRenderer.invoke(IpcChannels.todosUpdate, input),
  deleteTodo: (id: number) => ipcRenderer.invoke(IpcChannels.todosDelete, id),
  listCategories: () => ipcRenderer.invoke(IpcChannels.categoriesList),
  listPendingOccurrences: () => ipcRenderer.invoke(IpcChannels.occurrencesListPending),
  completeOccurrence: (id: number) => ipcRenderer.invoke(IpcChannels.occurrencesComplete, id),
  dismissOccurrence: (id: number, reason: string) =>
    ipcRenderer.invoke(IpcChannels.occurrencesDismiss, id, reason),
  snoozeOccurrence: (id: number, minutes: number) =>
    ipcRenderer.invoke(IpcChannels.occurrencesSnooze, id, minutes),
  listHistory: (filters: HistoryFilters) =>
    ipcRenderer.invoke(IpcChannels.occurrencesHistory, filters),
  listOccurrenceEvents: (occurrenceId: number) =>
    ipcRenderer.invoke(IpcChannels.occurrenceEventsList, occurrenceId),
  listDismissReasons: () => ipcRenderer.invoke(IpcChannels.dismissReasonsList),
  getAnalytics: (rangeDays: number) => ipcRenderer.invoke(IpcChannels.analyticsSummary, rangeDays),
  getUnreadCount: () => ipcRenderer.invoke(IpcChannels.unreadCount),
  onDataChanged: (listener: () => void) => {
    const wrapped = (): void => listener();
    ipcRenderer.on(IpcChannels.dataChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IpcChannels.dataChanged, wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('actionable', api);
