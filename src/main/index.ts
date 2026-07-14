import { app, BrowserWindow } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { IpcChannels } from '../shared/ipc';
import type { Occurrence } from '../shared/types';
import { openDatabase } from './db/database';
import { createDismissReasonRepository } from './db/dismiss-reason-repository';
import { createEventRepository } from './db/event-repository';
import { createOccurrenceRepository } from './db/occurrence-repository';
import { createScheduleRepository } from './db/schedule-repository';
import { createTodoRepository } from './db/todo-repository';
import { registerIpcHandlers } from './ipc/register-handlers';
import { createAnalyticsService } from './services/analytics-service';
import { createNotificationService } from './services/notification-service';
import { createOccurrenceService } from './services/occurrence-service';
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
  const occurrences = createOccurrenceRepository(db);
  const events = createEventRepository(db);
  const dismissReasons = createDismissReasonRepository(db);

  const todoService = createTodoService({ todos, schedules, now });
  const occurrenceService = createOccurrenceService({ occurrences, events, now });
  const analyticsService = createAnalyticsService({ occurrences, events, now });
  const notifications = createNotificationService({
    enabled: env.notificationsEnabled,
    onOpen: showWindow,
  });
  const unread = createUnreadService({
    occurrences,
    onOpen: showWindow,
    onQuit: () => app.quit(),
  });

  const onInboxChanged = (): void => {
    unread.refresh();
    broadcastDataChanged();
  };

  const notifyDue = (created: Occurrence[]): void => {
    created.forEach((occurrence) => {
      const todo = todos.get(occurrence.todoId);
      if (todo) {
        notifications.occurrenceDue(todo.name, todo.description);
      }
    });
    onInboxChanged();
  };

  const notifyBack = (reopened: Occurrence[]): void => {
    reopened.forEach((occurrence) => {
      const todo = todos.get(occurrence.todoId);
      if (todo) {
        notifications.occurrenceBack(todo.name);
      }
    });
    onInboxChanged();
  };

  const scheduler = createSchedulerService({
    schedules,
    occurrences,
    occurrenceService,
    onOccurrencesCreated: notifyDue,
    onOccurrencesReopened: notifyBack,
    now,
    tickMs: env.tickMs,
  });

  registerIpcHandlers({
    todoService,
    occurrenceService,
    analyticsService,
    occurrences,
    events,
    dismissReasons,
    onTodosChanged: () => {
      scheduler.refresh();
      onInboxChanged();
    },
    onOccurrencesChanged: onInboxChanged,
  });

  unread.initTray();
  scheduler.start();

  app.on('before-quit', () => {
    quitting = true;
    scheduler.stop();
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
