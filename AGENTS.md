# AGENTS.md

Guidance for coding agents working on Actionable, an Electron + React + TypeScript + SQLite accountability todo app. Read the [README](README.md) for the product concepts (todo definitions, schedules, occurrences, events) before changing behaviour.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev app with hot reload | `npm run dev` |
| Build to `out/` | `npm run build` |
| Unit tests | `npm test` (watch: `npm run test:watch`) |
| Single test file | `npx vitest run tests/services/scheduler-service.test.ts` |
| E2E tests | `npm run test:e2e` (builds first; requires a display) |
| Typecheck | `npm run typecheck` |
| Typecheck + unit tests | `npm run check` |
| Package unsigned `.app` into `dist/` | `npm run package` |
| Package and reinstall to `/Applications` | `npm run install:app` |

Always run `npm run check` before committing. Run the e2e suite when touching the scheduler, IPC, preload or renderer flows.

## Architecture rules

- **Three processes, one contract.** Renderer code never touches Node APIs; it calls `window.actionable`, typed by [ActionableApi](src/shared/ipc.ts). Main-process handlers live in [register-handlers.ts](src/main/ipc/register-handlers.ts) and the preload bridge in [preload/index.ts](src/preload/index.ts). To add an endpoint: add the channel and method to [ipc.ts](src/shared/ipc.ts), implement the handler, bridge it in preload, then use it in the renderer. Keep all four in sync.
- **Pure core, impure edges.** Cron math ([schedule.ts](src/shared/schedule.ts)), presets ([schedule-presets.ts](src/shared/schedule-presets.ts)), analytics ([analytics.ts](src/shared/analytics.ts)) and formatting ([format.ts](src/shared/format.ts)) are pure and deterministic; timezone-dependent values (local hour, date keys) are computed by callers and passed in. Keep new logic in this style: pure functions in `src/shared/`, side effects in services and repositories.
- **Services take dependencies, including the clock.** Every service receives `now: () => Date` and its repositories via a `create*Service(deps)` factory. Never call `new Date()` inside domain logic; take it from `deps.now()` so tests can inject a fake clock.
- **Every occurrence state change appends an event.** Complete, dismiss, snooze and reopen must go through [occurrence-service.ts](src/main/services/occurrence-service.ts), which writes to `occurrence_events`. Do not update occurrence status directly from a handler.
- **After a mutation, notify.** IPC handlers call `onTodosChanged` (also re-plans the scheduler) or `onOccurrencesChanged`; both refresh the unread badge and broadcast `data-changed`, which the renderer listens to via `useDataVersion`. A mutation that skips this leaves stale UI and a stale badge.
- **Schema changes are new migrations.** Append a new SQL string to the array in [migrations.ts](src/main/db/migrations.ts); never edit an existing entry. Timestamps are stored as ISO 8601 UTC strings; booleans as 0/1 integers mapped in [rows.ts](src/main/db/rows.ts).

## Coding conventions

- Declarative, functional style: pure small functions, array transformations over loops, return-early over nesting, no classes (factory functions returning objects).
- Comments only for non-obvious behaviour or invariants, never restating the code.
- SQLite access uses `node:sqlite` (`DatabaseSync`). Rows come back as generic records; cast through the row interfaces in [rows.ts](src/main/db/rows.ts) and map to domain types there.

## Testing conventions

- Unit tests use vitest, in `tests/`, against in-memory SQLite via [test-db.ts](tests/helpers/test-db.ts). Prefer the data-driven pattern used throughout: a typed `TestCase { description, input, output }` array, one `setup(input)` function, one `verify(result, output)` function, and a single `forEach` loop. Keep `input` and `output` minimal; constants live in `setup`.
- E2E tests use Playwright's Electron support, in `e2e/`, launching the built app via the fixtures in [e2e/helpers/app.ts](e2e/helpers/app.ts) (isolated userData, 250ms scheduler tick, notifications disabled). Use `data-testid` selectors; add test ids to new UI. For schedules that must fire during a test, use `cronFiringInSeconds` (6-field cron with seconds).
- Scheduler and service tests drive time by mutating the injected clock and calling `init()`/`tick()` directly; they never sleep.

## Gotchas

- `better-sqlite3` is intentionally not used; `node:sqlite` needs no native rebuild and works in both Electron and plain Node (22+), which is what lets vitest exercise the real database layer.
- Closing the window hides it (`close` is prevented unless quitting); the app quits only via the tray menu or `app.quit()`. E2E teardown quits through `app.quit()`, not window close.
- The app takes a single-instance lock. A second dev instance against the same userData will silently exit.
- The tray icon is an empty image with a text title (macOS text-only menu bar item); do not "fix" it by removing the empty `nativeImage`.
- `out/` is generated by electron-vite; never edit it. `npm run test:e2e` rebuilds before running.
- The unique index on `occurrences(schedule_id, scheduled_at)` is the dedupe mechanism for schedule fires; creation goes through `createFromSchedule`, which checks it and returns null on duplicates.
- Packaging is unsigned by design: [electron-builder.yml](electron-builder.yml) sets `identity: null` and [install-app.sh](scripts/install-app.sh) ad-hoc signs afterwards so Apple Silicon launches the bundle. No runtime `node_modules` ship in the app; electron-vite bundles everything into `out/`.
- **All packages live in `devDependencies`, intentionally.** electron-vite externalizes anything in `dependencies` (leaving a bare `require()` in the main bundle), which crashes the packaged app because it ships no `node_modules`. Add new packages to `devDependencies`; the install script fails fast if an unbundled require sneaks into `out/`.
