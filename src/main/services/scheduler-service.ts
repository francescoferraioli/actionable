import { nextFireTime, previousFireTime } from '../../shared/schedule';
import type { Action, Schedule } from '../../shared/types';
import type { ActionRepository } from '../db/action-repository';
import type { ScheduleRepository } from '../db/schedule-repository';
import type { TodoRepository } from '../db/todo-repository';
import type { ActionService } from './action-service';

export interface SchedulerDeps {
  schedules: ScheduleRepository;
  todos: TodoRepository;
  actions: ActionRepository;
  actionService: ActionService;
  onActionsCreated: (actions: Action[]) => void;
  onActionsReopened: (actions: Action[]) => void;
  now: () => Date;
  tickMs: number;
  /** How far back a missed fire is still worth surfacing after downtime. */
  catchUpWindowMs?: number;
}

const DEFAULT_CATCH_UP_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Safety cap on fires processed per schedule per tick (dense crons). */
const MAX_FIRES_PER_TICK = 60;

/**
 * Drives action creation. Keeps an in-memory next-fire time per active
 * schedule, ticks on an interval, and wakes elapsed snoozes. Lives entirely in
 * the main process so it keeps running while the window is closed.
 */
export function createSchedulerService(deps: SchedulerDeps) {
  const catchUpWindowMs = deps.catchUpWindowMs ?? DEFAULT_CATCH_UP_WINDOW_MS;
  const nextFires = new Map<number, { schedule: Schedule; nextFire: Date }>();
  let interval: NodeJS.Timeout | null = null;

  const titleForSchedule = (schedule: Schedule): string => {
    const todo = deps.todos.get(schedule.todoId);
    if (!todo) {
      throw new Error(`Todo ${schedule.todoId} not found for schedule ${schedule.id}`);
    }
    return todo.name;
  };

  const trackSchedule = (schedule: Schedule, from: Date): void => {
    const nextFire = nextFireTime(schedule.expression, schedule.timezone, from);
    if (nextFire) {
      nextFires.set(schedule.id, { schedule, nextFire });
    }
  };

  /**
   * Surfaces the single most recent fire missed while the app was not
   * running. Only the latest one: piling up every missed "drink water" after
   * a weekend away would be noise, not accountability.
   */
  const catchUpSchedule = (schedule: Schedule, now: Date): Action | null => {
    const lastFire = previousFireTime(schedule.expression, schedule.timezone, now);
    if (!lastFire) {
      return null;
    }
    if (now.getTime() - lastFire.getTime() > catchUpWindowMs) {
      return null;
    }
    return deps.actionService.createFromSchedule(
      schedule.todoId,
      schedule.id,
      titleForSchedule(schedule),
      lastFire,
    );
  };

  const processSchedule = (
    entry: { schedule: Schedule; nextFire: Date },
    now: Date,
  ): Action[] => {
    const created: Action[] = [];
    let { nextFire } = entry;
    while (nextFire.getTime() <= now.getTime() && created.length < MAX_FIRES_PER_TICK) {
      const action = deps.actionService.createFromSchedule(
        entry.schedule.todoId,
        entry.schedule.id,
        titleForSchedule(entry.schedule),
        nextFire,
      );
      if (action) {
        created.push(action);
      }
      const following = nextFireTime(entry.schedule.expression, entry.schedule.timezone, nextFire);
      if (!following) {
        break;
      }
      nextFire = following;
    }
    entry.nextFire = nextFire;
    return created;
  };

  const service = {
    /** Loads active schedules, catches up missed fires, computes next fires. */
    init(): void {
      const now = deps.now();
      nextFires.clear();
      const caughtUp = deps.schedules
        .listActive()
        .map((schedule) => {
          trackSchedule(schedule, now);
          return catchUpSchedule(schedule, now);
        })
        .filter((action): action is Action => action !== null);
      if (caughtUp.length > 0) {
        deps.onActionsCreated(caughtUp);
      }
    },

    /** Recomputes tracked schedules after todo/schedule changes. No catch-up. */
    refresh(): void {
      const now = deps.now();
      nextFires.clear();
      deps.schedules.listActive().forEach((schedule) => trackSchedule(schedule, now));
    },

    tick(): void {
      const now = deps.now();
      const created = [...nextFires.values()].flatMap((entry) => processSchedule(entry, now));
      if (created.length > 0) {
        deps.onActionsCreated(created);
      }
      const reopened = deps.actionService.reopenDueSnoozes();
      if (reopened.length > 0) {
        deps.onActionsReopened(reopened);
      }
    },

    start(): void {
      service.init();
      interval = setInterval(() => service.tick(), deps.tickMs);
    },

    stop(): void {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };

  return service;
}

export type SchedulerService = ReturnType<typeof createSchedulerService>;
