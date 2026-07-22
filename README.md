# Actionable

An accountability-based todo system for the desktop. Unlike traditional reminders, a todo is not considered done until you explicitly action it: scheduled todos create actions that land in an inbox, and each action must be completed, dismissed (with a reason) or snoozed. You can also drop markdown files into a configured inbox folder to create one-off actions instantly. Think of it as an accountability inbox for personal commitments.

Built with Electron, React, TypeScript and SQLite. Local-first: no cloud backend, all data lives on your machine.

## Core concepts

- **Todo definition**: a recurring or one-off commitment, e.g. "Drink water". It is not itself a reminder.
- **Schedule**: a cron-backed rule attached to a todo, e.g. every hour from 9am to 5pm, daily at 7am, weekly on Monday at 9am. A todo can have several schedules, each with its own timezone. Managed via [schedule presets](src/shared/schedule-presets.ts) that compile to cron, with raw cron as an escape hatch.
- **Action**: the thing in your inbox. Created when a schedule fires, or when a markdown file is dropped into the configured inbox folder. It is `pending` until you complete, dismiss or snooze it (file-sourced actions are complete-only).
- **Action events**: every state change (created, completed, dismissed, snoozed, reopened) is appended to an event-sourcing table, which powers history and analytics.

## Features

- **Inbox**: pending actions grouped by day. Schedule-sourced actions offer Complete, Dismiss and Snooze. File-sourced actions show a markdown preview (expandable) and offer Complete only. Dismissing requires picking a reason (the reason list is a seeded, extensible table). Snoozing offers 5 minutes, 15 minutes, 1 hour or a custom duration; when the snooze elapses the action returns to the inbox and you are notified again.
- **Inbox folder**: configure a folder in Settings. Drop a `.md` file there and the app creates an action immediately (filename → title, body → description) and deletes the file.
- **Unread state**: like email. Any pending action marks the app unread. The count shows on the macOS dock badge, the menu bar (tray) item, and the in-app inbox badge.
- **Desktop notifications**: an OS notification fires when an action is created or comes back from a snooze. Clicking it opens the app.
- **Background scheduling**: closing the window only hides it. The scheduler keeps running in the main process until you explicitly quit from the tray menu. On startup, the most recent fire missed while the app was not running (within 24 hours) is surfaced as a late action, so commitments do not silently vanish.
- **History**: past actions with completion time, dismissal reason or snooze target, filterable by date range, todo, category and status.
- **Analytics**: per-todo completion and dismiss rates for schedule-sourced actions only, best performing time of day, a daily completed/dismissed trend chart, snooze counts and a dismissal reason breakdown, over a 7, 30 or 90 day range.

## Getting started

Requires Node 22+ (the app uses the built-in `node:sqlite` module).

```bash
npm install
npm run dev        # run the app with hot reload
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run the app in development with hot reload |
| `npm run build` | Bundle main, preload and renderer into `out/` |
| `npm start` | Preview the built app |
| `npm test` | Unit tests (vitest) |
| `npm run test:e2e` | Build, then run Playwright end-to-end tests against the real app |
| `npm run typecheck` | Typecheck all TypeScript projects |
| `npm run check` | Typecheck plus unit tests |
| `npm run package` | Build and package an unsigned `Actionable.app` into `dist/` |
| `npm run install:app` | Package and (re)install into `/Applications`, then relaunch |

## Installing as a real app

```bash
npm run install:app
```

This runs [scripts/install-app.sh](scripts/install-app.sh): it bundles the app, packages it with electron-builder, ad-hoc signs it (no developer certificate needed), quits any running copy cleanly, replaces `/Applications/Actionable.app`, and launches the new version.

Why install rather than `npm run dev`:

- Notifications get their own identity. The installed app shows up as **Actionable** in System Settings → Notifications with its own permission entry; in dev the process is the generic Electron binary, so permission belongs to "Electron".
- You can add it as a login item (System Settings → General → Login Items) so the scheduler is always running.

The installed app and dev use separate databases: dev appends `-dev` to its userData directory, so `npm run dev` stores data in `~/Library/Application Support/actionable-dev` while the installed app uses `~/Library/Application Support/Actionable`. Dev experiments never touch your real data, and both can run at the same time.

## Architecture

Clean separation between the renderer, the main process, the database layer, the scheduler and notifications. Pure logic (cron computation, analytics, formatting) is isolated from side effects and unit tested directly.

- [Main process bootstrap](src/main/index.ts): wires the database, services, IPC, tray and window lifecycle.
- [Database layer](src/main/db/): `node:sqlite` with [versioned migrations](src/main/db/migrations.ts) and one repository per table ([todos](src/main/db/todo-repository.ts), [schedules](src/main/db/schedule-repository.ts), [actions](src/main/db/action-repository.ts), [events](src/main/db/event-repository.ts), [dismiss reasons](src/main/db/dismiss-reason-repository.ts), [settings](src/main/db/settings-repository.ts)).
- [Services](src/main/services/): [scheduler](src/main/services/scheduler-service.ts) (next-fire tracking, catch-up, snooze wake), [action transitions](src/main/services/action-service.ts) (state changes plus event sourcing), [folder watcher](src/main/services/folder-watcher-service.ts) (markdown file ingestion), [todo CRUD](src/main/services/todo-service.ts), [notifications](src/main/services/notification-service.ts), [unread badge and tray](src/main/services/unread-service.ts), [analytics](src/main/services/analytics-service.ts).
- [Shared pure logic](src/shared/): [cron schedule engine](src/shared/schedule.ts), [schedule presets](src/shared/schedule-presets.ts), [analytics computation](src/shared/analytics.ts), [formatting](src/shared/format.ts), [domain types](src/shared/types.ts) and the [typed IPC contract](src/shared/ipc.ts).
- [Preload](src/preload/index.ts): exposes the IPC contract to the renderer as `window.actionable`.
- [Renderer](src/renderer/src/): React views for [Inbox](src/renderer/src/views/InboxView.tsx), [Todos](src/renderer/src/views/TodosView.tsx), [History](src/renderer/src/views/HistoryView.tsx), [Analytics](src/renderer/src/views/AnalyticsView.tsx) and [Settings](src/renderer/src/views/SettingsView.tsx).

Data flows one way: the renderer calls the typed API, the main process mutates SQLite and broadcasts a `data-changed` event, and views refetch.

### Data storage

A single SQLite database at `<userData>/actionable.db`, in WAL mode. On macOS that is `~/Library/Application Support/Actionable/actionable.db` for the installed app and `~/Library/Application Support/actionable-dev/actionable.db` for `npm run dev` (dev deliberately uses its own directory so it never touches real data).

### Environment variables

| Variable | Purpose |
|---|---|
| `ACTIONABLE_USER_DATA` | Override the userData directory (used by e2e tests) |
| `ACTIONABLE_DB_PATH` | Override the database file path |
| `ACTIONABLE_TICK_MS` | Scheduler tick interval, default 15000 |
| `ACTIONABLE_DISABLE_NOTIFICATIONS` | Set to `1` to suppress OS notifications |

## Testing

- **Unit tests** (`tests/`): pure logic (schedule engine, presets, analytics) and the database layer and services against in-memory SQLite, with injected clocks. Run with `npm test`.
- **End-to-end tests** (`e2e/`): Playwright drives the built Electron app with a fast scheduler tick and an isolated userData directory, covering the full loop from schedule firing to inbox, actions, history and analytics. Run with `npm run test:e2e`.

## Future directions

The event-sourced action log and pure analytics layer are designed so AI recommendations, habit optimisation, suggested schedule changes, weekly reviews, adaptive scheduling and natural language todo creation can be added without reworking the data model.
