import { nextFireTime, previousFireTime } from '../../shared/schedule';
import type { Occurrence, Schedule } from '../../shared/types';
import type { OccurrenceRepository } from '../db/occurrence-repository';
import type { ScheduleRepository } from '../db/schedule-repository';
import type { OccurrenceService } from './occurrence-service';

export interface SchedulerDeps {
  schedules: ScheduleRepository;
  occurrences: OccurrenceRepository;
  occurrenceService: OccurrenceService;
  onOccurrencesCreated: (occurrences: Occurrence[]) => void;
  onOccurrencesReopened: (occurrences: Occurrence[]) => void;
  now: () => Date;
  tickMs: number;
  /** How far back a missed fire is still worth surfacing after downtime. */
  catchUpWindowMs?: number;
}

const DEFAULT_CATCH_UP_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Safety cap on fires processed per schedule per tick (dense crons). */
const MAX_FIRES_PER_TICK = 60;

/**
 * Drives occurrence creation. Keeps an in-memory next-fire time per active
 * schedule, ticks on an interval, and wakes elapsed snoozes. Lives entirely in
 * the main process so it keeps running while the window is closed.
 */
export function createSchedulerService(deps: SchedulerDeps) {
  const catchUpWindowMs = deps.catchUpWindowMs ?? DEFAULT_CATCH_UP_WINDOW_MS;
  const nextFires = new Map<number, { schedule: Schedule; nextFire: Date }>();
  let interval: NodeJS.Timeout | null = null;

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
  const catchUpSchedule = (schedule: Schedule, now: Date): Occurrence | null => {
    const lastFire = previousFireTime(schedule.expression, schedule.timezone, now);
    if (!lastFire) {
      return null;
    }
    if (now.getTime() - lastFire.getTime() > catchUpWindowMs) {
      return null;
    }
    return deps.occurrenceService.createFromSchedule(schedule.todoId, schedule.id, lastFire);
  };

  const processSchedule = (
    entry: { schedule: Schedule; nextFire: Date },
    now: Date,
  ): Occurrence[] => {
    const created: Occurrence[] = [];
    let { nextFire } = entry;
    while (nextFire.getTime() <= now.getTime() && created.length < MAX_FIRES_PER_TICK) {
      const occurrence = deps.occurrenceService.createFromSchedule(
        entry.schedule.todoId,
        entry.schedule.id,
        nextFire,
      );
      if (occurrence) {
        created.push(occurrence);
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
        .filter((occurrence): occurrence is Occurrence => occurrence !== null);
      if (caughtUp.length > 0) {
        deps.onOccurrencesCreated(caughtUp);
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
        deps.onOccurrencesCreated(created);
      }
      const reopened = deps.occurrenceService.reopenDueSnoozes();
      if (reopened.length > 0) {
        deps.onOccurrencesReopened(reopened);
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
