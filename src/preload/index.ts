import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type ActionableApi } from '../shared/ipc';
import type { CreateTodoInput, HistoryFilters, UpdateTodoInput } from '../shared/types';

const api: ActionableApi = {
  listTodos: () => ipcRenderer.invoke(IpcChannels.todosList),
  createTodo: (input: CreateTodoInput) => ipcRenderer.invoke(IpcChannels.todosCreate, input),
  updateTodo: (input: UpdateTodoInput) => ipcRenderer.invoke(IpcChannels.todosUpdate, input),
  deleteTodo: (id: number) => ipcRenderer.invoke(IpcChannels.todosDelete, id),
  listCategories: () => ipcRenderer.invoke(IpcChannels.categoriesList),
  listPendingActions: () => ipcRenderer.invoke(IpcChannels.actionsListPending),
  completeAction: (id: number) => ipcRenderer.invoke(IpcChannels.actionsComplete, id),
  dismissAction: (id: number, reason: string) =>
    ipcRenderer.invoke(IpcChannels.actionsDismiss, id, reason),
  snoozeAction: (id: number, minutes: number) =>
    ipcRenderer.invoke(IpcChannels.actionsSnooze, id, minutes),
  deleteAction: (id: number) => ipcRenderer.invoke(IpcChannels.actionsDelete, id),
  openActionUrl: (id: number) => ipcRenderer.invoke(IpcChannels.actionsOpenUrl, id),
  listHistory: (filters: HistoryFilters) =>
    ipcRenderer.invoke(IpcChannels.actionsHistory, filters),
  listActionEvents: (actionId: number) =>
    ipcRenderer.invoke(IpcChannels.actionEventsList, actionId),
  listDismissReasons: () => ipcRenderer.invoke(IpcChannels.dismissReasonsList),
  getAnalytics: (rangeDays: number) => ipcRenderer.invoke(IpcChannels.analyticsSummary, rangeDays),
  getUnreadCount: () => ipcRenderer.invoke(IpcChannels.unreadCount),
  getInboxFolder: () => ipcRenderer.invoke(IpcChannels.settingsGetInboxFolder),
  setInboxFolder: (path: string | null) =>
    ipcRenderer.invoke(IpcChannels.settingsSetInboxFolder, path),
  pickInboxFolder: () => ipcRenderer.invoke(IpcChannels.settingsPickInboxFolder),
  onDataChanged: (listener: () => void) => {
    const wrapped = (): void => listener();
    ipcRenderer.on(IpcChannels.dataChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IpcChannels.dataChanged, wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('actionable', api);
