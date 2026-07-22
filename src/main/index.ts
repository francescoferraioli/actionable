import { app, BrowserWindow, dialog } from 'electron';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, watch } from 'node:fs';
import { join } from 'node:path';
import { IpcChannels } from '../shared/ipc';
import type { Action } from '../shared/types';
import { openDatabase } from './db/database';
import { createDismissReasonRepository } from './db/dismiss-reason-repository';
import { createEventRepository } from './db/event-repository';
import { createActionRepository } from './db/action-repository';
import { createScheduleRepository } from './db/schedule-repository';
import { SETTING_INBOX_FOLDER, createSettingsRepository } from './db/settings-repository';
import { createTodoRepository } from './db/todo-repository';
import { registerIpcHandlers } from './ipc/register-handlers';
import { createAnalyticsService } from './services/analytics-service';
import { createFolderWatcherService } from './services/folder-watcher-service';
import { createNotificationService } from './services/notification-service';
import { createActionService } from './services/action-service';
import { createSchedulerService } from './services/scheduler-service';
import { createTodoService } from './services/todo-service';
import { createUnreadService } from './services/unread-service';

const env = {
  userDataOverride: process.env.ACTIONABLE_USER_DATA,
  dbPathOverride: process.env.ACTIONABLE_DB_PATH,
  tickMs: Number(process.env.ACTIONABLE_TICK_MS ?? 15_000),
  notificationsEnabled: process.env.ACTIONABLE_DISABLE_NOTIFICATIONS !== '1',
};

if (env.userDataOverride) {
  app.setPath('userData', env.userDataOverride);
} else if (!app.isPackaged) {
  // Keep dev data (and its single-instance lock) separate from the installed
  // app, whose userData dir would otherwise collide on case-insensitive
  // filesystems ("actionable" vs "Actionable").
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

let mainWindow: BrowserWindow | null = null;
let quitting = false;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'Actionable',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  window.on('ready-to-show', () => window.show());
  // Closing the window hides it; the scheduler keeps running and the tray
  // keeps the app alive. Quit is explicit (tray menu or Cmd+Q).
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on('closed', () => {
    mainWindow = null;
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function showWindow(): void {
  if (!mainWindow) {
    mainWindow = createWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function broadcastDataChanged(): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(IpcChannels.dataChanged);
  });
}

function bootstrap(): void {
  const userData = app.getPath('userData');
  mkdirSync(userData, { recursive: true });
  const db = openDatabase(env.dbPathOverride ?? join(userData, 'actionable.db'));

  const now = (): Date => new Date();
  const todos = createTodoRepository(db);
  const schedules = createScheduleRepository(db);
  const actions = createActionRepository(db);
  const events = createEventRepository(db);
  const dismissReasons = createDismissReasonRepository(db);
  const settings = createSettingsRepository(db);

  const todoService = createTodoService({ todos, schedules, now });
  const actionService = createActionService({ actions, events, now });
  const analyticsService = createAnalyticsService({ actions, events, now });
  const notifications = createNotificationService({
    enabled: env.notificationsEnabled,
    onOpen: showWindow,
  });
  const unread = createUnreadService({
    actions,
    onOpen: showWindow,
    onQuit: () => app.quit(),
  });

  const onInboxChanged = (): void => {
    unread.refresh();
    broadcastDataChanged();
  };

  const notifyDue = (created: Action[]): void => {
    created.forEach((action) => {
      const todoDescription =
        action.todoId !== null ? (todos.get(action.todoId)?.description ?? null) : null;
      notifications.actionDue(
        action.title,
        action.source === 'file' ? action.bodyMd : todoDescription,
        action.source === 'file',
      );
    });
    onInboxChanged();
  };

  const notifyBack = (reopened: Action[]): void => {
    reopened.forEach((action) => {
      notifications.actionBack(action.title);
    });
    onInboxChanged();
  };

  const listMarkdownFiles = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => entry.name);

  const folderWatcher = createFolderWatcherService({
    actionService,
    getInboxFolder: () => settings.get(SETTING_INBOX_FOLDER),
    readFile: (path) => readFileSync(path, 'utf8'),
    unlink: (path) => unlinkSync(path),
    watch: (folder, onFile) => {
      const watcher = watch(folder, (_event, filename) => {
        if (filename && typeof filename === 'string') {
          onFile(filename);
        }
      });
      return () => watcher.close();
    },
    onActionsCreated: notifyDue,
  });

  const restartFolderWatcher = (): void => {
    folderWatcher.start(listMarkdownFiles);
  };

  const scheduler = createSchedulerService({
    schedules,
    todos,
    actions,
    actionService,
    onActionsCreated: notifyDue,
    onActionsReopened: notifyBack,
    now,
    tickMs: env.tickMs,
  });

  registerIpcHandlers({
    todoService,
    actionService,
    analyticsService,
    actions,
    events,
    dismissReasons,
    settings,
    pickInboxFolder: async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });
      return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
    },
    onTodosChanged: () => {
      scheduler.refresh();
      onInboxChanged();
    },
    onActionsChanged: onInboxChanged,
    onInboxFolderChanged: restartFolderWatcher,
  });

  unread.initTray();
  scheduler.start();
  restartFolderWatcher();

  app.on('before-quit', () => {
    quitting = true;
    scheduler.stop();
    folderWatcher.stop();
    db.close();
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    bootstrap();
    mainWindow = createWindow();

    app.on('activate', showWindow);
  });
}
